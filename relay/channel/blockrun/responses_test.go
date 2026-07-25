package blockrun

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
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func TestBlockRunResponsesOutboundPipeline(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/responses", nil)
	zeroUint := uint(0)
	zeroFloat := 0.0
	request := dto.OpenAIResponsesRequest{
		Model:             "openai/gpt-5.4",
		Input:             []byte(`[{"role":"user","content":"hello"}]`),
		MaxOutputTokens:   &zeroUint,
		ParallelToolCalls: []byte(`false`),
		Temperature:       &zeroFloat,
		TopP:              &zeroFloat,
		ServiceTier:       "priority",
		StreamOptions:     &dto.StreamOptions{IncludeUsage: true},
		ToolChoice:        []byte(`{"type":"custom","name":"shell"}`),
		Tools:             []byte(`[{"type":"custom","name":"shell","description":"run a command","format":{"type":"text"}}]`),
		ClientMetadata:    []byte(`{"session_id":"sess-1"}`),
	}
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeResponses,
		RequestURLPath: "/v1/responses",
		RelayFormat:    types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://blockrun.ai/api",
			ParamOverride: map[string]any{
				"operations": []any{
					map[string]any{"mode": "set", "path": "metadata.gateway", "value": "blockrun"},
					map[string]any{"mode": "set", "path": "stream_options.include_usage", "value": true},
				},
			},
		},
	}

	converted, err := a.ConvertOpenAIResponsesRequest(c, info, request)
	if err != nil {
		t.Fatalf("convert responses request: %v", err)
	}
	jsonData, err := common.Marshal(converted)
	if err != nil {
		t.Fatalf("marshal converted request: %v", err)
	}
	jsonData, err = relaycommon.RemoveDisabledFieldsWithPassThroughDecision(jsonData, info.ChannelOtherSettings, false)
	if err != nil {
		t.Fatalf("remove disabled fields: %v", err)
	}
	jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
	if err != nil {
		t.Fatalf("apply param override: %v", err)
	}
	if !strings.Contains(string(jsonData), "stream_options") {
		t.Fatalf("test precondition failed: parameter override did not restore stream_options: %s", jsonData)
	}
	jsonData, err = removeBlockRunResponsesStreamOptions(jsonData)
	if err != nil {
		t.Fatalf("remove final BlockRun Responses stream_options: %v", err)
	}

	var got map[string]any
	if err := common.Unmarshal(jsonData, &got); err != nil {
		t.Fatalf("decode final outbound body: %v", err)
	}
	if _, exists := got["stream_options"]; exists {
		t.Fatalf("final outbound body must not contain stream_options: %s", jsonData)
	}
	if _, exists := got["service_tier"]; exists {
		t.Fatalf("disabled service_tier should be removed: %s", jsonData)
	}
	if got["parallel_tool_calls"] != false || got["max_output_tokens"] != float64(0) || got["temperature"] != float64(0) || got["top_p"] != float64(0) {
		t.Fatalf("explicit zero/false values changed: %s", jsonData)
	}
	metadata, ok := got["metadata"].(map[string]any)
	if !ok || metadata["gateway"] != "blockrun" {
		t.Fatalf("unrelated param override did not run: %s", jsonData)
	}
	tools, ok := got["tools"].([]any)
	if !ok || len(tools) != 1 || tools[0].(map[string]any)["type"] != "custom" {
		t.Fatalf("custom tool did not survive outbound pipeline: %s", jsonData)
	}
	choice, ok := got["tool_choice"].(map[string]any)
	if !ok || choice["type"] != "custom" || choice["name"] != "shell" {
		t.Fatalf("object tool_choice did not survive outbound pipeline: %s", jsonData)
	}
}

func TestRemoveBlockRunResponsesStreamOptions_PreservesRawJSON(t *testing.T) {
	body := []byte(`{"model":"openai/gpt-5.4","client_metadata":{"sequence":9007199254740993},"stream_options":{"include_usage":true}}`)
	cleaned, err := removeBlockRunResponsesStreamOptions(body)
	if err != nil {
		t.Fatalf("remove stream_options: %v", err)
	}
	if strings.Contains(string(cleaned), "stream_options") {
		t.Fatalf("stream_options still present: %s", cleaned)
	}
	if !strings.Contains(string(cleaned), `"sequence":9007199254740993`) {
		t.Fatalf("large integer JSON literal changed: %s", cleaned)
	}
}

func TestBlockRunDoResponse_NativeResponsesJSON(t *testing.T) {
	body := `{"id":"resp_native_json","object":"response","status":"completed","model":"openai/gpt-5.4","output":[{"id":"ct_1","type":"custom_tool_call","call_id":"call_1","name":"shell","input":"ls"}],"usage":{"input_tokens":11,"output_tokens":7,"total_tokens":18,"input_tokens_details":{"cached_tokens":3}}}`
	rec := httptest.NewRecorder()
	c, _ := newResponseTestContext(rec, "/v1/responses")
	info := responsesInfo(false)

	usageAny, apiErr := (&Adaptor{}).DoResponse(c, responseForBody(body, "application/json"), info)
	if apiErr != nil {
		t.Fatalf("native Responses JSON failed: %v", apiErr)
	}
	usage, ok := usageAny.(*dto.Usage)
	if !ok {
		t.Fatalf("expected *dto.Usage, got %T", usageAny)
	}
	if usage.PromptTokens != 11 || usage.CompletionTokens != 7 || usage.TotalTokens != 18 || usage.PromptTokensDetails.CachedTokens != 3 {
		t.Fatalf("unexpected native usage: %#v", usage)
	}
	if rec.Body.String() != body {
		t.Fatalf("native Responses body was reshaped:\n got %s\nwant %s", rec.Body.String(), body)
	}
	if got := c.GetString(common.UpstreamRequestIdKey); got != "resp_native_json" {
		t.Fatalf("captured upstream id = %q, want resp_native_json", got)
	}
}

func TestBlockRunDoResponse_NativeResponsesStream(t *testing.T) {
	ensureResponseStreamTimeout(t)
	upstream := strings.Join([]string{
		`event: response.created`,
		`data: {"type":"response.created","response":{"id":"resp_native_stream","object":"response","status":"in_progress"}}`,
		``,
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":0,"content_index":0,"delta":"pong"}`,
		``,
		`event: response.output_item.added`,
		`data: {"type":"response.output_item.added","output_index":1,"item":{"id":"ct_stream_1","type":"custom_tool_call","name":"shell","input":""}}`,
		``,
		`event: response.custom_tool_call_input.delta`,
		`data: {"type":"response.custom_tool_call_input.delta","output_index":1,"item_id":"ct_stream_1","delta":"ls -la"}`,
		``,
		`event: response.custom_tool_call_input.done`,
		`data: {"type":"response.custom_tool_call_input.done","output_index":1,"item_id":"ct_stream_1","input":"ls -la"}`,
		``,
		`event: response.output_item.done`,
		`data: {"type":"response.output_item.done","output_index":1,"item":{"id":"ct_stream_1","type":"custom_tool_call","name":"shell","input":"ls -la"}}`,
		``,
		`event: response.completed`,
		`data: {"type":"response.completed","response":{"id":"resp_native_stream","status":"completed","usage":{"input_tokens":9,"output_tokens":4,"total_tokens":13,"input_tokens_details":{"cached_tokens":2}}}}`,
		``,
	}, "\n")
	rec := httptest.NewRecorder()
	c, _ := newResponseTestContext(rec, "/v1/responses")
	info := responsesInfo(true)

	usageAny, apiErr := (&Adaptor{}).DoResponse(c, responseForBody(upstream, "text/event-stream"), info)
	if apiErr != nil {
		t.Fatalf("native Responses stream failed: %v", apiErr)
	}
	usage := usageAny.(*dto.Usage)
	if usage.PromptTokens != 9 || usage.CompletionTokens != 4 || usage.TotalTokens != 13 || usage.PromptTokensDetails.CachedTokens != 2 {
		t.Fatalf("unexpected native stream usage: %#v", usage)
	}
	for _, want := range []string{
		"event: response.created",
		`"id":"resp_native_stream"`,
		"event: response.output_text.delta",
		`"delta":"pong"`,
		"event: response.output_item.added",
		"event: response.custom_tool_call_input.delta",
		"event: response.custom_tool_call_input.done",
		"event: response.output_item.done",
		`"id":"ct_stream_1"`,
		`"type":"custom_tool_call"`,
		`"name":"shell"`,
		`"input":"ls -la"`,
		"event: response.completed",
	} {
		if !strings.Contains(rec.Body.String(), want) {
			t.Fatalf("downstream SSE missing %q:\n%s", want, rec.Body.String())
		}
	}
	if got := c.GetString(common.UpstreamRequestIdKey); got != "resp_native_stream" {
		t.Fatalf("captured upstream id = %q, want resp_native_stream", got)
	}
}

func TestBlockRunDoResponse_TruncatedTextFallback(t *testing.T) {
	ensureResponseStreamTimeout(t)
	service.InitTokenEncoders()
	upstream := "event: response.output_text.delta\n" +
		`data: {"type":"response.output_text.delta","output_index":0,"content_index":0,"delta":"partial answer"}` + "\n\n"
	rec := httptest.NewRecorder()
	c, _ := newResponseTestContext(rec, "/v1/responses")
	info := responsesInfo(true)
	info.SetEstimatePromptTokens(6)

	usageAny, apiErr := (&Adaptor{}).DoResponse(c, responseForBody(upstream, "text/event-stream"), info)
	if apiErr != nil {
		t.Fatalf("truncated native Responses stream failed: %v", apiErr)
	}
	usage := usageAny.(*dto.Usage)
	if usage.PromptTokens != 6 || usage.CompletionTokens <= 0 || usage.TotalTokens != usage.PromptTokens+usage.CompletionTokens {
		t.Fatalf("text fallback did not produce usable usage: %#v", usage)
	}
	if !strings.Contains(rec.Body.String(), "partial answer") {
		t.Fatalf("truncated text was not forwarded: %s", rec.Body.String())
	}
}

func TestBlockRunDoResponse_TruncatedToolOnlyUsesIncompleteUsage(t *testing.T) {
	ensureResponseStreamTimeout(t)
	upstream := strings.Join([]string{
		"event: response.output_item.done",
		`data: {"type":"response.output_item.done","output_index":0,"item":{"id":"ct_truncated","type":"custom_tool_call","status":"incomplete","name":"shell","input":"pwd"}}`,
		"",
		"event: response.incomplete",
		`data: {"type":"response.incomplete","response":{"id":"resp_truncated","status":"incomplete","incomplete_details":{"reason":"max_output_tokens"},"usage":{"input_tokens":61,"output_tokens":16,"total_tokens":77,"input_tokens_details":{"cached_tokens":5}}}}`,
		"",
	}, "\n")
	rec := httptest.NewRecorder()
	c, _ := newResponseTestContext(rec, "/v1/responses")
	info := responsesInfo(true)
	info.SetEstimatePromptTokens(6)

	usageAny, apiErr := (&Adaptor{}).DoResponse(c, responseForBody(upstream, "text/event-stream"), info)
	if apiErr != nil {
		t.Fatalf("tool-only truncated native Responses stream failed: %v", apiErr)
	}
	usage := usageAny.(*dto.Usage)
	if usage.PromptTokens != 61 || usage.CompletionTokens != 16 || usage.TotalTokens != 77 || usage.PromptTokensDetails.CachedTokens != 5 {
		t.Fatalf("tool-only incomplete usage was not captured: %#v", usage)
	}
	for _, want := range []string{"event: response.output_item.done", "event: response.incomplete", `"id":"ct_truncated"`, `"type":"custom_tool_call"`, `"name":"shell"`, `"input":"pwd"`} {
		if !strings.Contains(rec.Body.String(), want) {
			t.Fatalf("tool-only event missing %q: %s", want, rec.Body.String())
		}
	}
}

func TestBlockRunChatResponseRegression(t *testing.T) {
	body := `{"id":"chatcmpl-regression","object":"chat.completion","model":"openai/gpt-5.4","choices":[{"index":0,"message":{"role":"assistant","content":"pong"},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":4,"total_tokens":7}}`
	rec := httptest.NewRecorder()
	c, _ := newResponseTestContext(rec, "/v1/chat/completions")
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "openai/gpt-5.4"},
	}

	usageAny, apiErr := (&Adaptor{}).DoResponse(c, responseForBody(body, "application/json"), info)
	if apiErr != nil {
		t.Fatalf("BlockRun Chat regression: %v", apiErr)
	}
	usage := usageAny.(*dto.Usage)
	if usage.PromptTokens != 3 || usage.CompletionTokens != 4 || usage.TotalTokens != 7 {
		t.Fatalf("chat usage changed: %#v", usage)
	}
	if rec.Body.String() != body || strings.Contains(rec.Body.String(), `"object":"response"`) {
		t.Fatalf("chat response shape changed: %s", rec.Body.String())
	}
}

func newResponseTestContext(rec *httptest.ResponseRecorder, path string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, path, nil)
	return c, rec
}

func responsesInfo(stream bool) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		RelayFormat: types.RelayFormatOpenAI,
		IsStream:    stream,
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "openai/gpt-5.4"},
	}
}

func responseForBody(body, contentType string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{contentType}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func ensureResponseStreamTimeout(t *testing.T) {
	t.Helper()
	previous := constant.StreamingTimeout
	if previous <= 0 {
		constant.StreamingTimeout = 30
	}
	t.Cleanup(func() { constant.StreamingTimeout = previous })
}
