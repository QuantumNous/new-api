package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

type sseEvent struct {
	Type string
	Data map[string]any
}

// runChatToResponsesStream feeds a fake upstream Chat SSE body through
// OaiChatToResponsesStreamHandler and returns the emitted Responses events.
func runChatToResponsesStream(t *testing.T, chatSSE string) []sseEvent {
	return runChatToResponsesStreamWithCtx(t, chatSSE, nil)
}

func runChatToResponsesStreamWithCtx(t *testing.T, chatSSE string, toolCtx *dto.ResponsesToolContext) []sseEvent {
	t.Helper()

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	resp := &http.Response{Body: io.NopCloser(strings.NewReader(chatSSE))}
	// The real client is a Responses client (Codex): the stream must end with
	// response.completed and must NOT carry a Chat-style [DONE] sentinel.
	info := &relaycommon.RelayInfo{
		ChannelMeta:          &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o"},
		RelayFormat:          types.RelayFormatOpenAIResponses,
		ResponsesToolContext: toolCtx,
	}

	_, apiErr := OaiChatToResponsesStreamHandler(c, info, resp)
	if apiErr != nil {
		t.Fatalf("handler error: %v", apiErr)
	}

	return parseSSEEvents(t, recorder.Body.String())
}

func parseSSEEvents(t *testing.T, body string) []sseEvent {
	t.Helper()
	var events []sseEvent
	var curType string
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimRight(line, "\r")
		switch {
		case strings.HasPrefix(line, "event: "):
			curType = strings.TrimPrefix(line, "event: ")
		case strings.HasPrefix(line, "data: "):
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				events = append(events, sseEvent{Type: "[DONE]"})
				continue
			}
			var m map[string]any
			if err := common.UnmarshalJsonStr(data, &m); err != nil {
				t.Fatalf("bad event data %q: %v", data, err)
			}
			events = append(events, sseEvent{Type: curType, Data: m})
		}
	}
	return events
}

func eventTypes(events []sseEvent) []string {
	out := make([]string, 0, len(events))
	for _, e := range events {
		out = append(out, e.Type)
	}
	return out
}

func assertSequence(t *testing.T, got []string, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("event count = %d, want %d\n got: %v\nwant: %v", len(got), len(want), got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("event[%d] = %q, want %q\n got: %v\nwant: %v", i, got[i], want[i], got, want)
		}
	}
}

func TestChatToResponsesStream_Text(t *testing.T) {
	chatSSE := strings.Join([]string{
		`data: {"id":"c1","object":"chat.completion.chunk","created":100,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"content":"Hel"}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"content":"lo"}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
		`data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`,
		`data: [DONE]`,
		"",
	}, "\n")

	events := runChatToResponsesStream(t, chatSSE)

	assertSequence(t, eventTypes(events), []string{
		"response.created",
		"response.output_item.added",
		"response.content_part.added",
		"response.output_text.delta",
		"response.output_text.delta",
		"response.output_text.done",
		"response.content_part.done",
		"response.output_item.done",
		"response.completed",
	})

	// text deltas concatenate to the full text
	var full string
	for _, e := range events {
		if e.Type == "response.output_text.delta" {
			full += e.Data["delta"].(string)
		}
	}
	if full != "Hello" {
		t.Errorf("concatenated delta = %q, want Hello", full)
	}

	// output_text.done carries the full text
	for _, e := range events {
		if e.Type == "response.output_text.done" && e.Data["text"] != "Hello" {
			t.Errorf("output_text.done text = %v, want Hello", e.Data["text"])
		}
	}

	// response.completed is the final event (no [DONE] for Responses clients)
	completed := events[len(events)-1]
	if completed.Type != "response.completed" {
		t.Fatalf("last event = %q, want response.completed", completed.Type)
	}
	respObj := completed.Data["response"].(map[string]any)
	if respObj["status"] != "completed" {
		t.Errorf("completed status = %v", respObj["status"])
	}
	usage := respObj["usage"].(map[string]any)
	if usage["input_tokens"].(float64) != 10 || usage["output_tokens"].(float64) != 5 {
		t.Errorf("usage = %v", usage)
	}
}

func TestChatToResponsesStream_UpstreamErrorFrame(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	chatSSE := strings.Join([]string{
		`data: {"error":{"message":"rate limited","type":"rate_limit_error","code":"429"}}`,
		`data: [DONE]`,
		"",
	}, "\n")

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	resp := &http.Response{Body: io.NopCloser(strings.NewReader(chatSSE))}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o"},
		RelayFormat: types.RelayFormatOpenAIResponses,
	}

	_, apiErr := OaiChatToResponsesStreamHandler(c, info, resp)
	if apiErr == nil {
		t.Fatal("expected error surfaced from in-stream error frame, got nil")
	}
	if !strings.Contains(recorder.Body.String(), "response.failed") {
		t.Errorf("error stream should emit response.failed: %s", recorder.Body.String())
	}
	// must NOT have emitted a response.completed
	if strings.Contains(recorder.Body.String(), "response.completed") {
		t.Errorf("error stream should not emit response.completed: %s", recorder.Body.String())
	}
}

func TestChatToResponsesStream_InlineThink(t *testing.T) {
	chatSSE := strings.Join([]string{
		`data: {"id":"c1","object":"chat.completion.chunk","created":100,"model":"deepseek-reasoner","choices":[{"index":0,"delta":{"content":"<think>\nNeed"}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"content":" context.</think>\n\npong"},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
		"",
	}, "\n")

	events := runChatToResponsesStream(t, chatSSE)
	var reasoning, answer string
	for _, event := range events {
		switch event.Type {
		case "response.reasoning_summary_text.delta":
			reasoning += event.Data["delta"].(string)
		case "response.output_text.delta":
			answer += event.Data["delta"].(string)
		}
	}
	if reasoning != "Need context." {
		t.Errorf("reasoning = %q", reasoning)
	}
	if answer != "pong" {
		t.Errorf("answer = %q", answer)
	}
	serialized, err := common.Marshal(events)
	if err != nil {
		t.Fatalf("marshal events: %v", err)
	}
	if strings.Contains(string(serialized), "<think>") || strings.Contains(string(serialized), "</think>") {
		t.Errorf("think tags leaked into events: %s", serialized)
	}
}

func TestChatToResponsesStream_CopiesOriginalRequestFields(t *testing.T) {
	chatSSE := strings.Join([]string{
		`data: {"id":"c1","object":"chat.completion.chunk","created":100,"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
		"",
	}, "\n")
	ctx := dto.NewResponsesToolContext()
	ctx.OriginalRequest = &dto.OpenAIResponsesRequest{
		Model:             "deepseek-chat",
		Instructions:      jsonRaw(t, "be concise"),
		ParallelToolCalls: jsonRaw(t, true),
		Temperature:       common.GetPointer(0.2),
		Metadata:          jsonRaw(t, map[string]any{"trace": "abc"}),
	}

	events := runChatToResponsesStreamWithCtx(t, chatSSE, ctx)
	completed := events[len(events)-1].Data["response"].(map[string]any)
	if completed["instructions"] != "be concise" || completed["parallel_tool_calls"] != true {
		t.Errorf("copied fields = %+v", completed)
	}
	if completed["temperature"] != 0.2 {
		t.Errorf("temperature = %v", completed["temperature"])
	}
}

func TestChatToResponsesStream_LengthTruncation(t *testing.T) {
	chatSSE := strings.Join([]string{
		`data: {"id":"c1","object":"chat.completion.chunk","created":100,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":"partial"}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{},"finish_reason":"length"}]}`,
		`data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`,
		`data: [DONE]`,
		"",
	}, "\n")

	events := runChatToResponsesStream(t, chatSSE)

	completed := events[len(events)-1]
	if completed.Type != "response.completed" {
		t.Fatalf("last event = %q", completed.Type)
	}
	respObj := completed.Data["response"].(map[string]any)
	if respObj["status"] != "incomplete" {
		t.Errorf("truncated stream status = %v, want incomplete", respObj["status"])
	}
	details, ok := respObj["incomplete_details"].(map[string]any)
	if !ok || details["reason"] != "max_output_tokens" {
		t.Errorf("incomplete_details = %v", respObj["incomplete_details"])
	}
}

func jsonRaw(t *testing.T, value any) []byte {
	t.Helper()
	data, err := common.Marshal(value)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return data
}

func TestChatToResponsesStream_ApplyPatchToolCall(t *testing.T) {
	// upstream model calls the fanned-out apply_patch_add_file sub-tool
	chatSSE := strings.Join([]string{
		`data: {"id":"c1","object":"chat.completion.chunk","created":100,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_9","type":"function","function":{"name":"apply_patch_add_file","arguments":""}}]}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"path\":\"a.txt\","}}]}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"content\":\"hi\"}"}}]}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
		`data: {"choices":[],"usage":{"prompt_tokens":8,"completion_tokens":3,"total_tokens":11}}`,
		`data: [DONE]`,
		"",
	}, "\n")

	ctx := dto.NewResponsesToolContext()
	ctx.CustomTools["apply_patch_add_file"] = dto.CodexCustomToolSpec{OpenAIName: "apply_patch", Kind: dto.CodexToolKindApplyPatch, ProxyAction: "add_file"}

	events := runChatToResponsesStreamWithCtx(t, chatSSE, ctx)

	assertSequence(t, eventTypes(events), []string{
		"response.created",
		"response.output_item.added", // custom_tool_call
		"response.custom_tool_call_input.delta",
		"response.custom_tool_call_input.done",
		"response.output_item.done",
		"response.completed",
	})

	// no function_call_arguments deltas for custom-proxy tools
	for _, e := range events {
		if e.Type == "response.function_call_arguments.delta" {
			t.Error("custom-proxy tool should suppress function_call_arguments.delta")
		}
	}

	added := events[1].Data["item"].(map[string]any)
	if added["type"] != "custom_tool_call" || added["name"] != "apply_patch" || added["id"] != "ctc_call_9" {
		t.Errorf("added item = %+v", added)
	}

	// the reconstructed input is a patch text delivered in one delta
	inputDelta := events[2].Data["delta"].(string)
	if !strings.Contains(inputDelta, "*** Add File: a.txt") || !strings.Contains(inputDelta, "+hi") {
		t.Errorf("custom_tool_call_input delta = %q", inputDelta)
	}

	// completed output carries the custom_tool_call
	completed := events[len(events)-1].Data["response"].(map[string]any)
	out := completed["output"].([]any)
	if len(out) != 1 || out[0].(map[string]any)["type"] != "custom_tool_call" {
		t.Errorf("completed output = %+v", out)
	}
}

func TestChatToResponsesStream_ApplyPatchSplitIdName(t *testing.T) {
	// id arrives in the first tool_calls delta; the function name (an apply_patch
	// proxy) and args arrive in later deltas. The item must open as a
	// custom_tool_call (ctc_ id), never as a function_call.
	chatSSE := strings.Join([]string{
		`data: {"id":"c1","object":"chat.completion.chunk","created":100,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_9","type":"function"}]}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"name":"apply_patch_add_file","arguments":"{\"path\":\"a.txt\","}}]}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"content\":\"hi\"}"}}]}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
		`data: {"choices":[],"usage":{"prompt_tokens":8,"completion_tokens":3,"total_tokens":11}}`,
		`data: [DONE]`,
		"",
	}, "\n")

	ctx := dto.NewResponsesToolContext()
	ctx.CustomTools["apply_patch_add_file"] = dto.CodexCustomToolSpec{OpenAIName: "apply_patch", Kind: dto.CodexToolKindApplyPatch, ProxyAction: "add_file"}

	events := runChatToResponsesStreamWithCtx(t, chatSSE, ctx)

	assertSequence(t, eventTypes(events), []string{
		"response.created",
		"response.output_item.added", // custom_tool_call, opened once name known
		"response.custom_tool_call_input.delta",
		"response.custom_tool_call_input.done",
		"response.output_item.done",
		"response.completed",
	})

	// no function_call events despite the id arriving before the name
	for _, e := range events {
		if e.Type == "response.function_call_arguments.delta" || e.Type == "response.function_call_arguments.done" {
			t.Errorf("unexpected function_call event for a custom-proxy tool: %s", e.Type)
		}
	}
	added := events[1].Data["item"].(map[string]any)
	if added["type"] != "custom_tool_call" || added["name"] != "apply_patch" || added["id"] != "ctc_call_9" {
		t.Errorf("added item = %+v", added)
	}
	inputDelta := events[2].Data["delta"].(string)
	if !strings.Contains(inputDelta, "*** Add File: a.txt") || !strings.Contains(inputDelta, "+hi") {
		t.Errorf("reconstructed input = %q", inputDelta)
	}
}

func TestChatToResponsesStream_FunctionSplitIdName(t *testing.T) {
	// A plain function tool with id/args before the name: buffered args must be
	// flushed as one delta when the item opens.
	chatSSE := strings.Join([]string{
		`data: {"id":"c1","object":"chat.completion.chunk","created":100,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"arguments":"{\"a\":"}}]}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"name":"get_weather","arguments":"1}"}}]}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
		`data: [DONE]`,
		"",
	}, "\n")

	events := runChatToResponsesStream(t, chatSSE)

	// added is a function_call; the flushed delta contains the buffered args
	added := events[1].Data["item"].(map[string]any)
	if added["type"] != "function_call" || added["name"] != "get_weather" {
		t.Fatalf("added item = %+v", added)
	}
	var args string
	for _, e := range events {
		if e.Type == "response.function_call_arguments.delta" {
			args += e.Data["delta"].(string)
		}
	}
	if args != `{"a":1}` {
		t.Errorf("concatenated args = %q, want {\"a\":1}", args)
	}
}

func TestChatToResponsesStream_Reasoning(t *testing.T) {
	chatSSE := strings.Join([]string{
		`data: {"id":"c1","object":"chat.completion.chunk","created":100,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"Let me think"}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"reasoning_content":" about it."}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"content":"Answer"}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
		`data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`,
		`data: [DONE]`,
		"",
	}, "\n")

	events := runChatToResponsesStream(t, chatSSE)

	assertSequence(t, eventTypes(events), []string{
		"response.created",
		"response.output_item.added", // reasoning
		"response.reasoning_summary_part.added",
		"response.reasoning_summary_text.delta",
		"response.reasoning_summary_text.delta",
		"response.reasoning_summary_text.done",
		"response.reasoning_summary_part.done",
		"response.output_item.done",  // reasoning
		"response.output_item.added", // message
		"response.content_part.added",
		"response.output_text.delta",
		"response.output_text.done",
		"response.content_part.done",
		"response.output_item.done", // message
		"response.completed",
	})

	// reasoning summary deltas concatenate
	var summary string
	for _, e := range events {
		if e.Type == "response.reasoning_summary_text.delta" {
			summary += e.Data["delta"].(string)
		}
	}
	if summary != "Let me think about it." {
		t.Errorf("reasoning summary = %q", summary)
	}

	// response.completed output has reasoning first, then message
	completed := events[len(events)-1].Data["response"].(map[string]any)
	output := completed["output"].([]any)
	if len(output) != 2 {
		t.Fatalf("output len = %d, want 2", len(output))
	}
	if output[0].(map[string]any)["type"] != "reasoning" {
		t.Errorf("output[0] type = %v, want reasoning", output[0].(map[string]any)["type"])
	}
	if output[1].(map[string]any)["type"] != "message" {
		t.Errorf("output[1] type = %v, want message", output[1].(map[string]any)["type"])
	}
}

func TestChatToResponsesStream_ToolCall(t *testing.T) {
	chatSSE := strings.Join([]string{
		`data: {"id":"c1","object":"chat.completion.chunk","created":100,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant"}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":""}}]}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"city\":"}}]}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"NYC\"}"}}]}}]}`,
		`data: {"id":"c1","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
		`data: {"choices":[],"usage":{"prompt_tokens":8,"completion_tokens":3,"total_tokens":11}}`,
		`data: [DONE]`,
		"",
	}, "\n")

	events := runChatToResponsesStream(t, chatSSE)

	assertSequence(t, eventTypes(events), []string{
		"response.created",
		"response.output_item.added",
		"response.function_call_arguments.delta",
		"response.function_call_arguments.delta",
		"response.function_call_arguments.done",
		"response.output_item.done",
		"response.completed",
	})

	// output_item.added carries the function call identity
	added := events[1].Data["item"].(map[string]any)
	if added["type"] != "function_call" || added["name"] != "get_weather" || added["call_id"] != "call_1" {
		t.Errorf("function_call item.added = %v", added)
	}

	// arguments deltas concatenate to the full JSON args
	var args string
	for _, e := range events {
		if e.Type == "response.function_call_arguments.delta" {
			args += e.Data["delta"].(string)
		}
	}
	if args != `{"city":"NYC"}` {
		t.Errorf("concatenated args = %q", args)
	}

	// arguments.done carries the full args
	for _, e := range events {
		if e.Type == "response.function_call_arguments.done" && e.Data["arguments"] != `{"city":"NYC"}` {
			t.Errorf("arguments.done = %v", e.Data["arguments"])
		}
	}
}
