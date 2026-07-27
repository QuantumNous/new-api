package openaicompat

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func toolsRaw(t *testing.T, tools []any) []byte {
	t.Helper()
	b, err := common.Marshal(tools)
	if err != nil {
		t.Fatalf("marshal tools: %v", err)
	}
	return b
}

func TestBuildCodexToolContext(t *testing.T) {
	raw := toolsRaw(t, []any{
		map[string]any{"type": "custom", "name": "apply_patch"},
		map[string]any{"type": "function", "name": "get_weather", "parameters": map[string]any{"type": "object"}},
		map[string]any{"type": "local_shell", "name": "shell"},
	})
	ctx := BuildCodexToolContext(raw)

	if spec, ok := ctx.LookupCustomTool("apply_patch"); !ok || spec.Kind != dto.CodexToolKindApplyPatch {
		t.Fatalf("apply_patch context = %+v", spec)
	}
	// 5 fanned proxy sub-tools registered
	for _, suffix := range []string{"add_file", "delete_file", "update_file", "replace_file", "batch"} {
		name := "apply_patch_" + suffix
		spec, ok := ctx.LookupCustomTool(name)
		if !ok || spec.OpenAIName != "apply_patch" || spec.ProxyAction != suffix {
			t.Errorf("proxy %s = %+v (ok=%v)", name, spec, ok)
		}
	}
	if _, ok := ctx.FunctionTools["get_weather"]; !ok {
		t.Error("get_weather should be a function tool")
	}
	if spec, ok := ctx.LookupCustomTool("shell"); !ok || spec.Kind != dto.CodexToolKindBuiltIn {
		t.Errorf("shell builtin = %+v", spec)
	}
}

func TestApplyPatchProxyTools(t *testing.T) {
	tools := applyPatchProxyTools("apply_patch", "")
	if len(tools) != 5 {
		t.Fatalf("want 5 sub-tools, got %d", len(tools))
	}
	wantNames := []string{"apply_patch_add_file", "apply_patch_delete_file", "apply_patch_update_file", "apply_patch_replace_file", "apply_patch_batch"}
	for i, tool := range tools {
		fn := tool["function"].(map[string]any)
		if fn["name"] != wantNames[i] {
			t.Errorf("tool[%d] name = %v, want %s", i, fn["name"], wantNames[i])
		}
		if _, ok := fn["parameters"].(map[string]any); !ok {
			t.Errorf("tool[%d] missing parameters schema", i)
		}
	}
}

func TestResponsesToolsConversion(t *testing.T) {
	raw := toolsRaw(t, []any{
		map[string]any{"type": "custom", "name": "apply_patch"},
		map[string]any{"type": "custom", "name": "my_freeform"},
		map[string]any{"type": "function", "name": "fn1", "parameters": map[string]any{"type": "object"}},
	})
	ctx := BuildCodexToolContext(raw)
	tools := responsesToolsToChatToolsWithContext(raw, ctx)
	// 5 (apply_patch) + 1 (generic) + 1 (function) = 7
	if len(tools) != 7 {
		t.Fatalf("want 7 chat tools, got %d", len(tools))
	}
	// generic freeform tool has an `input` string param
	var freeform map[string]any
	for _, tl := range tools {
		fn := tl["function"].(map[string]any)
		if fn["name"] == "my_freeform" {
			freeform = fn
		}
	}
	if freeform == nil {
		t.Fatal("my_freeform not converted")
	}
	props := freeform["parameters"].(map[string]any)["properties"].(map[string]any)
	if _, ok := props["input"]; !ok {
		t.Errorf("freeform tool should have input param: %+v", props)
	}
}

func TestApplyPatchRoundTrip(t *testing.T) {
	// model calls apply_patch_add_file with structured args -> patch text
	args := `{"path":"a.txt","content":"line1\nline2"}`
	patch := reconstructApplyPatchInput(dto.CodexPatchActionAddFile, args)
	want := "*** Begin Patch\n*** Add File: a.txt\n+line1\n+line2\n*** End Patch"
	if patch != want {
		t.Fatalf("patch text =\n%q\nwant\n%q", patch, want)
	}

	// reverse: history patch text -> sub-tool name + args
	subName, gotArgs := buildCustomToolCallHistory("apply_patch", jsonStr(patch))
	if subName != "apply_patch_add_file" {
		t.Errorf("subName = %s", subName)
	}
	var m map[string]any
	if err := common.UnmarshalJsonStr(gotArgs, &m); err != nil {
		t.Fatalf("args: %v", err)
	}
	if m["path"] != "a.txt" || m["content"] != "line1\nline2" {
		t.Errorf("round-trip args = %+v", m)
	}
}

func TestApplyPatchUpdateRoundTrip(t *testing.T) {
	patch := "*** Begin Patch\n*** Update File: b.txt\n@@ ctx\n context line\n-old\n+new\n*** End Patch"
	ops := parseApplyPatchOperations(patch)
	if len(ops) != 1 || ops[0]["type"] != "update_file" {
		t.Fatalf("ops = %+v", ops)
	}
	rebuilt := buildApplyPatchText(ops)
	if rebuilt != patch {
		t.Errorf("rebuilt =\n%q\nwant\n%q", rebuilt, patch)
	}
}

func TestApplyPatchRawPatchShortCircuit(t *testing.T) {
	// a batch carrying raw_patch returns it verbatim
	raw := "*** Begin Patch\n*** Delete File: gone.txt\n*** End Patch"
	args := marshalString(map[string]any{"operations": []any{}, "raw_patch": raw})
	got := reconstructApplyPatchInput(dto.CodexPatchActionBatch, args)
	if got != raw {
		t.Errorf("raw_patch short-circuit failed: %q", got)
	}
}

func TestResponseToolCallItem(t *testing.T) {
	raw := toolsRaw(t, []any{
		map[string]any{"type": "custom", "name": "apply_patch"},
		map[string]any{"type": "function", "name": "fn1", "parameters": map[string]any{"type": "object"}},
	})
	ctx := BuildCodexToolContext(raw)

	// apply_patch sub-tool -> custom_tool_call collapsed to apply_patch
	item := ResponseToolCallItem("call_1", "apply_patch_add_file", `{"path":"a.txt","content":"x"}`, ctx)
	if item["type"] != "custom_tool_call" || item["name"] != "apply_patch" {
		t.Fatalf("apply_patch item = %+v", item)
	}
	if item["id"] != "ctc_call_1" || item["call_id"] != "call_1" {
		t.Errorf("apply_patch item ids = %+v", item)
	}
	input, _ := item["input"].(string)
	if !strings.Contains(input, "*** Add File: a.txt") {
		t.Errorf("apply_patch input = %q", input)
	}

	// plain function -> function_call
	fnItem := ResponseToolCallItem("call_2", "fn1", `{"a":1}`, ctx)
	if fnItem["type"] != "function_call" || fnItem["name"] != "fn1" || fnItem["id"] != "fc_call_2" {
		t.Errorf("function item = %+v", fnItem)
	}
}

func TestNamespaceToolRoundTrip(t *testing.T) {
	raw := toolsRaw(t, []any{
		map[string]any{"type": "namespace", "name": "mcp", "tools": []any{
			map[string]any{"type": "function", "name": "search", "parameters": map[string]any{"type": "object"}},
		}},
	})
	ctx := BuildCodexToolContext(raw)
	tools := responsesToolsToChatToolsWithContext(raw, ctx)
	if len(tools) != 1 {
		t.Fatalf("want 1 flattened tool, got %d", len(tools))
	}
	fn := tools[0]["function"].(map[string]any)
	if fn["name"] != "mcp__search" {
		t.Fatalf("flattened name = %v", fn["name"])
	}
	// response side un-flattens
	item := ResponseToolCallItem("c1", "mcp__search", `{}`, ctx)
	if item["type"] != "function_call" || item["name"] != "search" || item["namespace"] != "mcp" {
		t.Errorf("un-flatten = %+v", item)
	}
}

func TestToolChoiceApplyPatch(t *testing.T) {
	raw := toolsRaw(t, []any{map[string]any{"type": "custom", "name": "apply_patch"}})
	ctx := BuildCodexToolContext(raw)
	tc := responsesToolChoiceToChatWithContext(jsonBytes(t, map[string]any{"type": "custom", "name": "apply_patch"}), ctx)
	m, ok := tc.(map[string]any)
	if !ok {
		t.Fatalf("tool_choice type %T", tc)
	}
	fn := m["function"].(map[string]any)
	if fn["name"] != "apply_patch_batch" {
		t.Errorf("apply_patch tool_choice -> %v, want apply_patch_batch", fn["name"])
	}
}

func TestToolChoiceChatShapedName(t *testing.T) {
	ctx := dto.NewResponsesToolContext()
	// chat-shaped tool_choice: name nested under function
	tc := responsesToolChoiceToChatWithContext(jsonBytes(t, map[string]any{
		"type": "function", "function": map[string]any{"name": "get_weather"},
	}), ctx)
	m, ok := tc.(map[string]any)
	if !ok {
		t.Fatalf("tool_choice type %T", tc)
	}
	if m["function"].(map[string]any)["name"] != "get_weather" {
		t.Errorf("chat-shaped tool_choice name = %v, want get_weather", m["function"].(map[string]any)["name"])
	}

	// flat Responses shape still works
	tc2 := responsesToolChoiceToChatWithContext(jsonBytes(t, map[string]any{
		"type": "function", "name": "fn1",
	}), ctx)
	if tc2.(map[string]any)["function"].(map[string]any)["name"] != "fn1" {
		t.Errorf("flat tool_choice name lost")
	}
}

func TestReasoningPerProvider(t *testing.T) {
	cases := []struct {
		model  string
		effort string
		check  func(t *testing.T, out *dto.GeneralOpenAIRequest)
	}{
		{"glm-4.6", "high", func(t *testing.T, out *dto.GeneralOpenAIRequest) {
			if string(out.THINKING) != `{"type":"enabled"}` {
				t.Errorf("glm thinking = %s", out.THINKING)
			}
		}},
		{"qwen3-max", "high", func(t *testing.T, out *dto.GeneralOpenAIRequest) {
			if string(out.EnableThinking) != "true" {
				t.Errorf("qwen enable_thinking = %s", out.EnableThinking)
			}
		}},
		{"minimax-m2", "high", func(t *testing.T, out *dto.GeneralOpenAIRequest) {
			if string(out.ReasoningSplit) != "true" {
				t.Errorf("minimax reasoning_split = %s", out.ReasoningSplit)
			}
		}},
		{"deepseek-v3", "high", func(t *testing.T, out *dto.GeneralOpenAIRequest) {
			if out.ReasoningEffort != "high" {
				t.Errorf("deepseek reasoning_effort = %s", out.ReasoningEffort)
			}
		}},
		{"gpt-5-codex", "medium", func(t *testing.T, out *dto.GeneralOpenAIRequest) {
			if out.ReasoningEffort != "medium" {
				t.Errorf("gpt-5 reasoning_effort = %s", out.ReasoningEffort)
			}
		}},
		{"llama-3.3", "high", func(t *testing.T, out *dto.GeneralOpenAIRequest) {
			// unknown model, default style, not reasoning-effort-capable -> nothing set
			if out.ReasoningEffort != "" {
				t.Errorf("llama reasoning_effort should be empty, got %s", out.ReasoningEffort)
			}
		}},
	}
	for _, tc := range cases {
		t.Run(tc.model, func(t *testing.T) {
			out := &dto.GeneralOpenAIRequest{}
			applyChatReasoningOptions(out, &dto.Reasoning{Effort: tc.effort}, tc.model)
			tc.check(t, out)
		})
	}
}

func TestG2ReasoningUsesSummary(t *testing.T) {
	resp := &dto.OpenAITextResponse{
		Model: "glm-4.6",
		Choices: []dto.OpenAITextResponseChoice{{
			Message: dto.Message{
				Role:             "assistant",
				Content:          "final answer",
				ReasoningContent: common.GetPointer("let me think"),
			},
			FinishReason: "stop",
		}},
	}
	out, err := ChatCompletionsResponseToResponsesResponse(resp, "id1", nil)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	var reasoning *dto.ResponsesOutput
	for i := range out.Output {
		if out.Output[i].Type == "reasoning" {
			reasoning = &out.Output[i]
		}
	}
	if reasoning == nil {
		t.Fatal("no reasoning output item")
	}
	if len(reasoning.Summary) != 1 || reasoning.Summary[0].Type != "summary_text" || reasoning.Summary[0].Text != "let me think" {
		t.Errorf("reasoning summary = %+v", reasoning.Summary)
	}
	if len(reasoning.Content) != 0 {
		t.Errorf("reasoning should use summary, not content: %+v", reasoning.Content)
	}
	// serialized shape uses "summary"
	b, _ := common.Marshal(reasoning)
	if !strings.Contains(string(b), `"summary"`) {
		t.Errorf("serialized reasoning item missing summary: %s", b)
	}
}

func TestChatResponseToResponses_ExtractsReasoningDetailsAndInlineThink(t *testing.T) {
	reasoningDetails := jsonBytes(t, []map[string]any{
		{"summary": "Step one."},
		{"parts": []map[string]any{{"text": "Step two."}}},
	})
	cases := []struct {
		name      string
		message   dto.Message
		rawBody   []byte
		reasoning string
		answer    string
	}{
		{
			name:    "reasoning details",
			message: dto.Message{Role: "assistant", Content: "final"},
			rawBody: jsonBytes(t, map[string]any{
				"choices": []map[string]any{{"message": map[string]any{"reasoning_details": json.RawMessage(reasoningDetails)}}},
			}),
			reasoning: "Step one.\n\nStep two.",
			answer:    "final",
		},
		{
			name:      "inline think",
			message:   dto.Message{Role: "assistant", Content: "<think>\nNeed context.\n</think>\n\npong"},
			reasoning: "Need context.",
			answer:    "pong",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp := &dto.OpenAITextResponse{
				Model: "deepseek-reasoner",
				Choices: []dto.OpenAITextResponseChoice{{
					Message:      tc.message,
					FinishReason: "stop",
				}},
			}
			EnrichChatResponseReasoningDetails(resp, tc.rawBody)
			out, err := ChatCompletionsResponseToResponsesResponse(resp, "id1", nil)
			if err != nil {
				t.Fatalf("err: %v", err)
			}
			if len(out.Output) != 2 {
				t.Fatalf("output = %+v", out.Output)
			}
			if out.Output[0].Type != "reasoning" || out.Output[0].Summary[0].Text != tc.reasoning {
				t.Errorf("reasoning output = %+v", out.Output[0])
			}
			if out.Output[1].Type != "message" || out.Output[1].Content[0].Text != tc.answer {
				t.Errorf("message output = %+v", out.Output[1])
			}
		})
	}
}

func TestChatResponseToResponses_CopiesOriginalRequestFields(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model:             "deepseek-chat",
		Instructions:      jsonBytes(t, "be concise"),
		MaxOutputTokens:   common.GetPointer(uint(123)),
		ParallelToolCalls: jsonBytes(t, true),
		Reasoning:         &dto.Reasoning{Effort: "high"},
		Temperature:       common.GetPointer(0.25),
		TopP:              common.GetPointer(0.8),
		ToolChoice:        jsonBytes(t, "auto"),
		Tools: jsonBytes(t, []map[string]any{{
			"type": "function", "name": "lookup", "parameters": map[string]any{"type": "object"},
		}}),
		Metadata: jsonBytes(t, map[string]any{"trace": "abc"}),
	}
	ctx := dto.NewResponsesToolContext()
	ctx.OriginalRequest = req
	resp := &dto.OpenAITextResponse{
		Model: "deepseek-chat",
		Choices: []dto.OpenAITextResponseChoice{{
			Message:      dto.Message{Role: "assistant", Content: "ok"},
			FinishReason: "stop",
		}},
	}

	out, err := ChatCompletionsResponseToResponsesResponse(resp, "id1", ctx)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if string(out.Instructions) != `"be concise"` || out.MaxOutputTokens != 123 {
		t.Errorf("instructions/max tokens = %s/%d", out.Instructions, out.MaxOutputTokens)
	}
	if !out.ParallelToolCalls || out.Reasoning == nil || out.Reasoning.Effort != "high" {
		t.Errorf("parallel/reasoning = %v/%+v", out.ParallelToolCalls, out.Reasoning)
	}
	if out.Temperature != 0.25 || out.TopP != 0.8 || len(out.Tools) != 1 {
		t.Errorf("temperature/top_p/tools = %v/%v/%+v", out.Temperature, out.TopP, out.Tools)
	}
}

func TestOSeriesMaxCompletionTokens(t *testing.T) {
	if !isOpenAIOSeries("o3-mini") {
		t.Error("o3-mini should be o-series")
	}
	if isOpenAIOSeries("gpt-4o") {
		t.Error("gpt-4o is not o-series")
	}
}

// helpers

func jsonStr(s string) []byte {
	b, _ := common.Marshal(s)
	return b
}

func jsonBytes(t *testing.T, v any) []byte {
	t.Helper()
	b, err := common.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return b
}
