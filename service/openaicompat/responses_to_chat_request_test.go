package openaicompat

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/samber/lo"
)

func raw(t *testing.T, v any) []byte {
	t.Helper()
	b, err := common.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return b
}

func TestResponsesRequestToChat_TextAndInstructions(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model:        "gpt-4o",
		Instructions: raw(t, "You are helpful."),
		Input: raw(t, []map[string]any{
			{"type": "message", "role": "user", "content": []map[string]any{
				{"type": "input_text", "text": "Hello"},
			}},
		}),
		Temperature:     common.GetPointer(0.7),
		TopP:            common.GetPointer(0.9),
		MaxOutputTokens: lo.ToPtr(uint(256)),
		Stream:          lo.ToPtr(true),
	}

	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got.Model != "gpt-4o" {
		t.Errorf("model = %q", got.Model)
	}
	if len(got.Messages) != 2 {
		t.Fatalf("messages len = %d, want 2", len(got.Messages))
	}
	if got.Messages[0].Role != "system" || got.Messages[0].Content != "You are helpful." {
		t.Errorf("system msg = %+v", got.Messages[0])
	}
	// text-only content collapses to plain string
	if got.Messages[1].Role != "user" || got.Messages[1].Content != "Hello" {
		t.Errorf("user msg = %+v", got.Messages[1])
	}
	if got.Temperature == nil || *got.Temperature != 0.7 {
		t.Errorf("temperature = %v", got.Temperature)
	}
	if got.TopP == nil || *got.TopP != 0.9 {
		t.Errorf("top_p = %v", got.TopP)
	}
	if got.MaxTokens == nil || *got.MaxTokens != 256 {
		t.Errorf("max_tokens = %v", got.MaxTokens)
	}
	if got.Stream == nil || !*got.Stream {
		t.Errorf("stream = %v", got.Stream)
	}
}

func TestResponsesRequestToChat_ToolCallRoundTrip(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model: "gpt-4o",
		Input: raw(t, []map[string]any{
			{"type": "message", "role": "user", "content": "run ls"},
			{"type": "message", "role": "assistant", "content": []map[string]any{
				{"type": "output_text", "text": "sure"},
			}},
			{"type": "function_call", "call_id": "call_1", "name": "shell", "arguments": `{"cmd":"ls"}`},
			{"type": "function_call_output", "call_id": "call_1", "output": "file.txt"},
		}),
	}

	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// user, assistant(with tool_calls), tool
	if len(got.Messages) != 3 {
		t.Fatalf("messages len = %d, want 3: %+v", len(got.Messages), got.Messages)
	}

	asst := got.Messages[1]
	if asst.Role != "assistant" || asst.Content != "sure" {
		t.Errorf("assistant msg = %+v", asst)
	}
	tcs := asst.ParseToolCalls()
	if len(tcs) != 1 {
		t.Fatalf("tool_calls len = %d, want 1", len(tcs))
	}
	if tcs[0].ID != "call_1" || tcs[0].Type != "function" {
		t.Errorf("tool call = %+v", tcs[0])
	}
	if tcs[0].Function.Name != "shell" || tcs[0].Function.Arguments != `{"cmd":"ls"}` {
		t.Errorf("tool call function = %+v", tcs[0].Function)
	}

	toolMsg := got.Messages[2]
	if toolMsg.Role != "tool" || toolMsg.ToolCallId != "call_1" || toolMsg.Content != "file.txt" {
		t.Errorf("tool msg = %+v", toolMsg)
	}
}

func TestResponsesRequestToChat_ParallelToolCallsNoPrecedingAssistant(t *testing.T) {
	// function_call with no preceding assistant message should synthesize one.
	req := &dto.OpenAIResponsesRequest{
		Model: "gpt-4o",
		Input: raw(t, []map[string]any{
			{"type": "function_call", "call_id": "a", "name": "f1", "arguments": "{}"},
			{"type": "function_call", "call_id": "b", "name": "f2", "arguments": "{}"},
		}),
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(got.Messages) != 1 {
		t.Fatalf("messages len = %d, want 1", len(got.Messages))
	}
	tcs := got.Messages[0].ParseToolCalls()
	if len(tcs) != 2 {
		t.Fatalf("tool_calls len = %d, want 2 (parallel)", len(tcs))
	}
}

func TestResponsesRequestToChat_Tools(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model: "gpt-4o",
		Input: raw(t, "hi"),
		Tools: raw(t, []map[string]any{
			{"type": "function", "name": "get_weather", "description": "gets weather",
				"parameters": map[string]any{"type": "object"}},
			{"type": "web_search_preview"}, // dropped (no Chat equivalent)
		}),
		ToolChoice: raw(t, map[string]any{"type": "function", "name": "get_weather"}),
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(got.Tools) != 1 {
		t.Fatalf("tools len = %d, want 1", len(got.Tools))
	}
	if got.Tools[0].Type != "function" || got.Tools[0].Function.Name != "get_weather" {
		t.Errorf("tool = %+v", got.Tools[0])
	}
	// tool_choice object un-nested into Chat shape
	tc, ok := got.ToolChoice.(map[string]any)
	if !ok {
		t.Fatalf("tool_choice type = %T", got.ToolChoice)
	}
	fn, ok := tc["function"].(map[string]any)
	if !ok || fn["name"] != "get_weather" {
		t.Errorf("tool_choice = %+v", tc)
	}
}

func TestResponsesRequestToChat_ToolChoiceDroppedWithoutTools(t *testing.T) {
	// Codex's context-compaction request carries tool_choice:"auto" but no tools.
	// vLLM rejects tool_choice without tools, so it must not be forwarded.
	req := &dto.OpenAIResponsesRequest{
		Model:      "gpt-4o",
		Input:      raw(t, "summarize"),
		ToolChoice: raw(t, "auto"),
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(got.Tools) != 0 {
		t.Fatalf("tools len = %d, want 0", len(got.Tools))
	}
	if got.ToolChoice != nil {
		t.Errorf("tool_choice = %v, want nil when no tools", got.ToolChoice)
	}
}

func TestResponsesRequestToChat_TextFormatJSONSchema(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model: "gpt-4o",
		Input: raw(t, "hi"),
		Text: raw(t, map[string]any{
			"format": map[string]any{
				"type":   "json_schema",
				"name":   "my_schema",
				"schema": map[string]any{"type": "object"},
				"strict": true,
			},
		}),
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got.ResponseFormat == nil || got.ResponseFormat.Type != "json_schema" {
		t.Fatalf("response_format = %+v", got.ResponseFormat)
	}
	var js map[string]any
	if err := common.Unmarshal(got.ResponseFormat.JsonSchema, &js); err != nil {
		t.Fatalf("json_schema unmarshal: %v", err)
	}
	if js["name"] != "my_schema" {
		t.Errorf("json_schema = %+v", js)
	}
	if _, ok := js["type"]; ok {
		t.Errorf("json_schema should not contain the format type key: %+v", js)
	}
}

func TestResponsesRequestToChat_PreservesExplicitZero(t *testing.T) {
	// Rule 6: explicit zero/false must survive the conversion.
	req := &dto.OpenAIResponsesRequest{
		Model:             "gpt-4o",
		Input:             raw(t, "hi"),
		Temperature:       common.GetPointer(0.0),
		ParallelToolCalls: raw(t, false),
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got.Temperature == nil || *got.Temperature != 0 {
		t.Errorf("temperature should be explicit 0, got %v", got.Temperature)
	}
	if got.ParallelTooCalls == nil || *got.ParallelTooCalls != false {
		t.Errorf("parallel_tool_calls should be explicit false, got %v", got.ParallelTooCalls)
	}
}

func TestResponsesRequestToChat_StringInput(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model: "gpt-4o",
		Input: raw(t, "just a string"),
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(got.Messages) != 1 || got.Messages[0].Role != "user" || got.Messages[0].Content != "just a string" {
		t.Errorf("messages = %+v", got.Messages)
	}
}

func TestResponsesRequestToChat_PreviousResponseID(t *testing.T) {
	// previous_response_id means stateful mode; a Chat-only upstream cannot load
	// the prior state, so it is rejected regardless of the (incremental) input.
	cases := []*dto.OpenAIResponsesRequest{
		{Model: "gpt-4o", PreviousResponseID: "resp_prev"},
		{Model: "gpt-4o", PreviousResponseID: "resp_prev", Input: raw(t, "next turn")},
		{Model: "gpt-4o", PreviousResponseID: "resp_prev", Instructions: raw(t, "You are helpful.")},
		{Model: "o3-mini", PreviousResponseID: "resp_prev", Instructions: raw(t, "You are helpful.")},
	}
	for i, req := range cases {
		if _, _, err := ResponsesRequestToChatCompletionsRequest(req); err == nil {
			t.Errorf("case %d: expected error for previous_response_id", i)
		}
	}

	// no previous_response_id -> proceeds normally.
	ok := &dto.OpenAIResponsesRequest{Model: "gpt-4o", Input: raw(t, "hi")}
	if _, _, err := ResponsesRequestToChatCompletionsRequest(ok); err != nil {
		t.Errorf("unexpected error without previous_response_id: %v", err)
	}
}

func TestResponsesRequestToChat_Conversation(t *testing.T) {
	// conversation as a stored-state reference (string or object) -> reject
	for i, conv := range []any{"conv_123", map[string]any{"id": "conv_123"}} {
		req := &dto.OpenAIResponsesRequest{
			Model:        "gpt-4o",
			Input:        raw(t, "hi"),
			Conversation: raw(t, conv),
		}
		if _, _, err := ResponsesRequestToChatCompletionsRequest(req); err == nil {
			t.Errorf("case %d: expected error for conversation reference", i)
		}
	}

	// no conversation -> fine
	ok := &dto.OpenAIResponsesRequest{Model: "gpt-4o", Input: raw(t, "hi")}
	if _, _, err := ResponsesRequestToChatCompletionsRequest(ok); err != nil {
		t.Errorf("unexpected error without conversation: %v", err)
	}
}

func TestResponsesRequestToChat_InputFile(t *testing.T) {
	// OpenAI/Codex shape: file fields at the top level of the input_file part.
	topLevel := &dto.OpenAIResponsesRequest{
		Model: "gpt-4o",
		Input: raw(t, []map[string]any{
			{"type": "message", "role": "user", "content": []map[string]any{
				{"type": "input_file", "file_id": "file-123", "filename": "a.pdf"},
			}},
		}),
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(topLevel)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if id := inputFileID(t, got); id != "file-123" {
		t.Errorf("top-level input_file file_id = %q, want file-123", id)
	}

	// nested shape produced by our own chat→responses converter.
	nested := &dto.OpenAIResponsesRequest{
		Model: "gpt-4o",
		Input: raw(t, []map[string]any{
			{"type": "message", "role": "user", "content": []map[string]any{
				{"type": "input_file", "file": map[string]any{"file_id": "file-999"}},
			}},
		}),
	}
	got2, _, err := ResponsesRequestToChatCompletionsRequest(nested)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if id := inputFileID(t, got2); id != "file-999" {
		t.Errorf("nested input_file file_id = %q, want file-999", id)
	}
}

func inputFileID(t *testing.T, req *dto.GeneralOpenAIRequest) string {
	t.Helper()
	if len(req.Messages) == 0 {
		t.Fatal("no messages")
	}
	for _, part := range req.Messages[len(req.Messages)-1].ParseContent() {
		if part.Type != dto.ContentTypeFile {
			continue
		}
		if m, ok := part.File.(map[string]any); ok {
			if id, ok := m["file_id"].(string); ok {
				return id
			}
		}
	}
	return ""
}

func TestResponsesRequestToChat_ServiceTier(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model:       "gpt-4o",
		Input:       raw(t, "hi"),
		ServiceTier: "flex",
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	var tier string
	if err := common.Unmarshal(got.ServiceTier, &tier); err != nil {
		t.Fatalf("service_tier unmarshal: %v (raw=%s)", err, got.ServiceTier)
	}
	if tier != "flex" {
		t.Errorf("service_tier = %q, want flex", tier)
	}

	// absent service_tier stays empty
	noTier := &dto.OpenAIResponsesRequest{Model: "gpt-4o", Input: raw(t, "hi")}
	got2, _, _ := ResponsesRequestToChatCompletionsRequest(noTier)
	if len(got2.ServiceTier) != 0 {
		t.Errorf("service_tier should be empty, got %s", got2.ServiceTier)
	}
}

func TestResponsesRequestToChat_SafetyAndCacheFields(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model:                "gpt-4o",
		Input:                raw(t, "hi"),
		SafetyIdentifier:     raw(t, "user-42"),
		PromptCacheKey:       raw(t, "cache-key-1"),
		PromptCacheRetention: raw(t, map[string]any{"type": "in_memory"}),
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}

	var safety string
	if err := common.Unmarshal(got.SafetyIdentifier, &safety); err != nil || safety != "user-42" {
		t.Errorf("safety_identifier = %s (%v)", got.SafetyIdentifier, err)
	}
	if got.PromptCacheKey != "cache-key-1" {
		t.Errorf("prompt_cache_key = %q, want cache-key-1", got.PromptCacheKey)
	}
	var retention map[string]any
	if err := common.Unmarshal(got.PromptCacheRetention, &retention); err != nil || retention["type"] != "in_memory" {
		t.Errorf("prompt_cache_retention = %s (%v)", got.PromptCacheRetention, err)
	}

	// absent -> stay empty
	got2, _, _ := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{Model: "gpt-4o", Input: raw(t, "hi")})
	if len(got2.SafetyIdentifier) != 0 || got2.PromptCacheKey != "" || len(got2.PromptCacheRetention) != 0 {
		t.Errorf("fields should be empty when unset: safety=%s key=%q retention=%s", got2.SafetyIdentifier, got2.PromptCacheKey, got2.PromptCacheRetention)
	}
}

func TestResponsesRequestToChat_InstructionsRole(t *testing.T) {
	cases := []struct {
		model string
		want  string
	}{
		{"gpt-4o", "system"},
		{"glm-4.6", "system"},
		{"o3-mini", "developer"},
		{"gpt-5-codex", "developer"},
	}
	for _, tc := range cases {
		t.Run(tc.model, func(t *testing.T) {
			req := &dto.OpenAIResponsesRequest{
				Model:        tc.model,
				Instructions: raw(t, "You are helpful."),
				Input:        raw(t, "hi"),
			}
			got, _, err := ResponsesRequestToChatCompletionsRequest(req)
			if err != nil {
				t.Fatalf("err: %v", err)
			}
			if len(got.Messages) == 0 || got.Messages[0].Role != tc.want {
				t.Errorf("instructions role = %q, want %q", got.Messages[0].Role, tc.want)
			}
			if got.Messages[0].Content != "You are helpful." {
				t.Errorf("instructions content = %v", got.Messages[0].Content)
			}
		})
	}
}

func TestResponsesRequestToChat_StoredPrompt(t *testing.T) {
	// prompt references a server-side stored prompt -> reject
	withPrompt := &dto.OpenAIResponsesRequest{
		Model:  "gpt-4o",
		Input:  raw(t, "hi"),
		Prompt: raw(t, map[string]any{"id": "pmpt_123", "version": "1"}),
	}
	if _, _, err := ResponsesRequestToChatCompletionsRequest(withPrompt); err == nil {
		t.Error("expected error for stored prompt reference")
	}

	// no prompt -> fine
	noPrompt := &dto.OpenAIResponsesRequest{Model: "gpt-4o", Input: raw(t, "hi")}
	if _, _, err := ResponsesRequestToChatCompletionsRequest(noPrompt); err != nil {
		t.Errorf("unexpected error without prompt: %v", err)
	}
}

func TestResponsesRequestToChat_InputImageDetail(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model: "gpt-4o",
		Input: raw(t, []map[string]any{
			{"type": "message", "role": "user", "content": []map[string]any{
				{"type": "input_image", "image_url": "https://x/a.png", "detail": "high"},
			}},
		}),
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	parts := got.Messages[len(got.Messages)-1].ParseContent()
	var img *dto.MessageImageUrl
	for _, part := range parts {
		if part.Type == dto.ContentTypeImageURL {
			img = part.GetImageMedia()
		}
	}
	if img == nil {
		t.Fatal("no image content")
	}
	if img.Url != "https://x/a.png" || img.Detail != "high" {
		t.Errorf("image = %+v, want url+detail=high", img)
	}
}

func TestResponsesRequestToChat_TopLogProbsAndEnableThinking(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model:          "gpt-4o",
		Input:          raw(t, "hi"),
		TopLogProbs:    lo.ToPtr(5),
		EnableThinking: raw(t, false), // explicit client extension
		Reasoning:      &dto.Reasoning{Effort: "high"},
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got.TopLogProbs == nil || *got.TopLogProbs != 5 {
		t.Errorf("top_logprobs = %v, want 5", got.TopLogProbs)
	}
	if got.LogProbs == nil || !*got.LogProbs {
		t.Errorf("logprobs should be true when top_logprobs set, got %v", got.LogProbs)
	}
	// explicit enable_thinking=false wins over the reasoning-derived mapping
	if string(got.EnableThinking) != "false" {
		t.Errorf("enable_thinking = %s, want false (client explicit)", got.EnableThinking)
	}

	// qwen model with reasoning only -> inferred enable_thinking=true still works
	inferred := &dto.OpenAIResponsesRequest{
		Model:     "qwen3-max",
		Input:     raw(t, "hi"),
		Reasoning: &dto.Reasoning{Effort: "high"},
	}
	got2, _, _ := ResponsesRequestToChatCompletionsRequest(inferred)
	if string(got2.EnableThinking) != "true" {
		t.Errorf("inferred enable_thinking = %s, want true", got2.EnableThinking)
	}
}

func TestResponsesRequestToChat_StrictTool(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model: "gpt-4o",
		Input: raw(t, "hi"),
		Tools: raw(t, []map[string]any{
			{"type": "function", "name": "fn1", "strict": true,
				"parameters": map[string]any{"type": "object"}},
		}),
	}
	got, _, err := ResponsesRequestToChatCompletionsRequest(req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(got.Tools) != 1 {
		t.Fatalf("tools len = %d", len(got.Tools))
	}
	if s, ok := got.Tools[0].Function.Strict.(bool); !ok || !s {
		t.Errorf("strict = %v, want true", got.Tools[0].Function.Strict)
	}
	// serialized upstream payload carries strict
	b, _ := common.Marshal(got.Tools[0])
	if !strings.Contains(string(b), `"strict":true`) {
		t.Errorf("serialized tool missing strict: %s", b)
	}
}

func TestResponsesRequestToChat_Errors(t *testing.T) {
	if _, _, err := ResponsesRequestToChatCompletionsRequest(nil); err == nil {
		t.Error("expected error for nil request")
	}
	if _, _, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{}); err == nil {
		t.Error("expected error for missing model")
	}
}
