package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestFlattenResponsesContentArraysForRetry_NoChange(t *testing.T) {
	raw := []byte(`{"model":"gpt-5.4","input":[{"type":"message","role":"user","content":"你好"}]}`)
	out, changed := flattenResponsesContentArraysForRetry(raw)
	if changed {
		t.Fatalf("expected unchanged, got changed=true body=%s", string(out))
	}
	if string(out) != string(raw) {
		t.Fatalf("expected identical body when unchanged")
	}
}

func TestFlattenResponsesContentArraysForRetry_FlattensMessageTextParts(t *testing.T) {
	raw := []byte(`{"input":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Hello"},{"type":"output_text","text":"World"}]}]}`)
	out, changed := flattenResponsesContentArraysForRetry(raw)
	if !changed {
		t.Fatal("expected changed=true")
	}
	var req map[string]any
	if err := common.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	input := req["input"].([]any)
	item := input[0].(map[string]any)
	content, ok := item["content"].(string)
	if !ok {
		t.Fatalf("expected flattened string content, got %#v", item["content"])
	}
	if content != "Hello\nWorld" {
		t.Fatalf("unexpected flattened content: %q", content)
	}
}

func TestFlattenResponsesContentArraysForRetry_StripsReasoningContentKeepsSummary(t *testing.T) {
	raw := []byte(`{"input":[{"type":"reasoning","content":[{"type":"reasoning_text","text":"internal"}],"encrypted_content":null}]}`)
	out, changed := flattenResponsesContentArraysForRetry(raw)
	if !changed {
		t.Fatal("expected changed=true")
	}
	var req map[string]any
	if err := common.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	input := req["input"].([]any)
	item := input[0].(map[string]any)
	if _, exists := item["content"]; exists {
		t.Fatalf("expected reasoning.content removed, got %#v", item["content"])
	}
	summary, exists := item["summary"]
	if !exists {
		t.Fatal("expected reasoning.summary to exist")
	}
	summaryArr, ok := summary.([]any)
	if !ok || len(summaryArr) != 0 {
		t.Fatalf("expected empty summary array, got %#v", summary)
	}
}

func TestSummarizeResponsesReasoningItemsForRetry_ConvertsSummaryToAssistantMessage(t *testing.T) {
	raw := []byte(`{"input":[{"type":"reasoning","summary":[{"type":"summary_text","text":"first"},{"type":"summary_text","text":"second"}]}]}`)
	out, changed := summarizeResponsesReasoningItemsForRetry(raw)
	if !changed {
		t.Fatal("expected changed=true")
	}
	var req map[string]any
	if err := common.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	input := req["input"].([]any)
	if len(input) != 1 {
		t.Fatalf("expected one converted input item, got %d", len(input))
	}
	item := input[0].(map[string]any)
	if item["type"] != "message" {
		t.Fatalf("expected converted item type=message, got %#v", item["type"])
	}
	if item["role"] != "assistant" {
		t.Fatalf("expected converted role=assistant, got %#v", item["role"])
	}
	content, _ := item["content"].(string)
	if content != "[Context Summary]\nfirst\n\nsecond" {
		t.Fatalf("unexpected summarized content: %q", content)
	}
}

func TestStripResponsesReasoningItemsForRetry_RemovesReasoningItems(t *testing.T) {
	raw := []byte(`{"input":[{"type":"reasoning","summary":[{"type":"summary_text","text":"first"}]},{"type":"message","role":"user","content":"hello"}]}`)
	out, changed := stripResponsesReasoningItemsForRetry(raw)
	if !changed {
		t.Fatal("expected changed=true")
	}
	var req map[string]any
	if err := common.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	input := req["input"].([]any)
	if len(input) != 1 {
		t.Fatalf("expected one remaining input item, got %d", len(input))
	}
	item := input[0].(map[string]any)
	if item["type"] != "message" {
		t.Fatalf("expected remaining item type=message, got %#v", item["type"])
	}
}

func TestIsResponsesToolPairingError(t *testing.T) {
	cases := []struct {
		name    string
		message string
		want    bool
	}{
		{
			name:    "cooai no tool output found",
			message: "No tool output found for tool call call_02_9r7hnOiZfy9N67N7azD82137.",
			want:    true,
		},
		{
			name:    "no output found for function call",
			message: "No output found for function call call_abc123",
			want:    true,
		},
		{
			name:    "no function call found",
			message: "No function call found for function_call_output item with call_id fc_123",
			want:    true,
		},
		{
			name:    "missing tool output",
			message: "tool output missing for call call_abc123",
			want:    true,
		},
		{
			name:    "unrelated error",
			message: "The server had an error while processing your request.",
			want:    false,
		},
	}
	for _, tc := range cases {
		if got := isResponsesToolPairingError(tc.message); got != tc.want {
			t.Fatalf("%s: isResponsesToolPairingError(%q) = %v, want %v", tc.name, tc.message, got, tc.want)
		}
	}
}

func TestSanitizeResponsesToolPairingForRetry_FabricatesMissingOutput(t *testing.T) {
	raw := []byte(`{"input":[` +
		`{"type":"message","role":"user","content":"分析这张图"},` +
		`{"type":"function_call","call_id":"call_02_9r7hnOiZfy9N67N7azD82137","name":"analyze","arguments":"{}"},` +
		`{"type":"message","role":"user","content":"继续"}]}`)
	out, changed := sanitizeResponsesToolPairingForRetry(raw)
	if !changed {
		t.Fatal("expected changed=true")
	}
	var req map[string]any
	if err := common.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	input := req["input"].([]any)
	if len(input) != 4 {
		t.Fatalf("expected 4 input items, got %d", len(input))
	}
	fabricated := input[2].(map[string]any)
	if fabricated["type"] != "function_call_output" {
		t.Fatalf("expected fabricated function_call_output at index 2, got %#v", fabricated)
	}
	if fabricated["call_id"] != "call_02_9r7hnOiZfy9N67N7azD82137" {
		t.Fatalf("unexpected fabricated call_id: %v", fabricated["call_id"])
	}
	if fabricated["output"] != responsesOmittedToolOutputPlaceholder {
		t.Fatalf("unexpected placeholder output: %v", fabricated["output"])
	}
}

func TestSanitizeResponsesToolPairingForRetry_DropsOrphanOutput(t *testing.T) {
	raw := []byte(`{"input":[` +
		`{"type":"function_call_output","call_id":"call_01","output":"orphan"},` +
		`{"type":"message","role":"user","content":"hello"}]}`)
	out, changed := sanitizeResponsesToolPairingForRetry(raw)
	if !changed {
		t.Fatal("expected changed=true")
	}
	var req map[string]any
	if err := common.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	input := req["input"].([]any)
	if len(input) != 1 {
		t.Fatalf("expected orphan output dropped, got %d items: %#v", len(input), input)
	}
	item := input[0].(map[string]any)
	if item["type"] != "message" {
		t.Fatalf("expected remaining message item, got %#v", item)
	}
}

func TestSanitizeResponsesToolPairingForRetry_KeepsParallelCalls(t *testing.T) {
	raw := []byte(`{"input":[` +
		`{"type":"message","role":"user","content":"hello"},` +
		`{"type":"function_call","call_id":"call_01","name":"a","arguments":"{}"},` +
		`{"type":"function_call","call_id":"call_02","name":"b","arguments":"{}"},` +
		`{"type":"function_call_output","call_id":"call_01","output":"out1"},` +
		`{"type":"function_call_output","call_id":"call_02","output":"out2"},` +
		`{"type":"message","role":"user","content":"继续"}]}`)
	out, changed := sanitizeResponsesToolPairingForRetry(raw)
	if changed {
		t.Fatalf("expected no change for well-paired parallel calls, body=%s", string(out))
	}
	if string(out) != string(raw) {
		t.Fatalf("expected identical body when unchanged")
	}
}

func TestSanitizeResponsesToolPairingForRetry_NoChangeWhenPaired(t *testing.T) {
	raw := []byte(`{"input":[` +
		`{"type":"message","role":"user","content":"hello"},` +
		`{"type":"function_call","call_id":"call_01","name":"a","arguments":"{}"},` +
		`{"type":"function_call_output","call_id":"call_01","output":"out1"}]}`)
	out, changed := sanitizeResponsesToolPairingForRetry(raw)
	if changed {
		t.Fatalf("expected no change for well-paired conversation, body=%s", string(out))
	}
	if string(out) != string(raw) {
		t.Fatalf("expected identical body when unchanged")
	}
}

func TestSanitizeResponsesToolPairingForRetry_KeepsOutputWithPreviousResponseID(t *testing.T) {
	// previous_response_id 续跑场景：input 中只有 function_call_output，
	// 其 function_call 位于上游服务端会话中，必须保留，不能当作孤儿输出删除
	raw := []byte(`{"previous_response_id":"resp_123","input":[` +
		`{"type":"function_call_output","call_id":"call_02_9r7hnOiZfy9N67N7azD82137","output":"real tool result"}]}`)
	out, changed := sanitizeResponsesToolPairingForRetry(raw)
	if changed {
		t.Fatalf("expected no change with previous_response_id, body=%s", string(out))
	}
	if string(out) != string(raw) {
		t.Fatalf("expected identical body when unchanged")
	}
}

func TestSanitizeResponsesToolPairingForRetry_StillFabricatesWithPreviousResponseID(t *testing.T) {
	// previous_response_id 场景下仍为当前 input 中缺失响应的 function_call 补占位
	raw := []byte(`{"previous_response_id":"resp_123","input":[` +
		`{"type":"function_call","call_id":"call_09","name":"a","arguments":"{}"},` +
		`{"type":"message","role":"user","content":"继续"}]}`)
	out, changed := sanitizeResponsesToolPairingForRetry(raw)
	if !changed {
		t.Fatal("expected changed=true")
	}
	var req map[string]any
	if err := common.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	input := req["input"].([]any)
	if len(input) != 3 {
		t.Fatalf("expected 3 input items, got %d", len(input))
	}
	fabricated := input[1].(map[string]any)
	if fabricated["type"] != "function_call_output" || fabricated["call_id"] != "call_09" {
		t.Fatalf("expected fabricated output for call_09, got %#v", fabricated)
	}
}

func TestIsResponsesEncryptedContentErrorMessage(t *testing.T) {
	cases := []struct {
		name    string
		message string
		want    bool
	}{
		{
			name:    "openai encrypted content unverifiable",
			message: "The encrypted content 7ea0...4c-0 could not be verified. Reason: Encrypted content could not be decrypted or parsed.",
			want:    true,
		},
		{
			name:    "decrypted only",
			message: "Encrypted content could not be decrypted.",
			want:    true,
		},
		{
			name:    "unrelated",
			message: "This model's maximum context length is 128000 tokens.",
			want:    false,
		},
	}
	for _, tc := range cases {
		if got := isResponsesEncryptedContentErrorMessage(tc.message); got != tc.want {
			t.Fatalf("%s: got=%v want=%v", tc.name, got, tc.want)
		}
	}
}

func TestSummarizeResponsesReasoningItemsForRetry_RemovesEncryptedContentByReplacement(t *testing.T) {
	raw := []byte(`{"input":[{"type":"reasoning","id":"rs_1","encrypted_content":"abc","summary":[{"type":"summary_text","text":"safe summary"}]}]}`)
	out, changed := summarizeResponsesReasoningItemsForRetry(raw)
	if !changed {
		t.Fatal("expected changed=true")
	}
	var req map[string]any
	if err := common.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	input := req["input"].([]any)
	if len(input) != 1 {
		t.Fatalf("expected one converted item, got %d", len(input))
	}
	item := input[0].(map[string]any)
	if item["type"] != "message" || item["role"] != "assistant" {
		t.Fatalf("expected assistant summary message, got %#v", item)
	}
}

func TestStripResponsesReasoningItemsForRetry_RemovesEncryptedContentReasoning(t *testing.T) {
	raw := []byte(`{"input":[{"type":"reasoning","id":"rs_1","encrypted_content":"abc","summary":[]},{"type":"message","role":"user","content":"hello"}]}`)
	out, changed := stripResponsesReasoningItemsForRetry(raw)
	if !changed {
		t.Fatal("expected changed=true")
	}
	var req map[string]any
	if err := common.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	input := req["input"].([]any)
	if len(input) != 1 {
		t.Fatalf("expected reasoning removed, got %d items", len(input))
	}
	if input[0].(map[string]any)["type"] != "message" {
		t.Fatalf("expected remaining message, got %#v", input[0])
	}
}

func TestSummarizeResponsesReasoningItemsForRetry_DropsEncryptedContentWithoutSummary(t *testing.T) {
	raw := []byte(`{"input":[{"type":"reasoning","id":"rs_1","encrypted_content":"abc","summary":[]},{"type":"message","role":"user","content":"hello"}]}`)
	out, changed := summarizeResponsesReasoningItemsForRetry(raw)
	if !changed {
		t.Fatal("expected changed=true")
	}
	var req map[string]any
	if err := common.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	input := req["input"].([]any)
	if len(input) != 1 {
		t.Fatalf("expected encrypted reasoning dropped, got %d items", len(input))
	}
	if input[0].(map[string]any)["type"] != "message" {
		t.Fatalf("expected remaining message, got %#v", input[0])
	}
}

func TestFlattenResponsesContentArraysForRetry_RemovesEncryptedContent(t *testing.T) {
	raw := []byte(`{"input":[{"type":"reasoning","id":"rs_1","encrypted_content":"abc"},{"type":"message","role":"user","content":"hello"}]}`)
	out, changed := flattenResponsesContentArraysForRetry(raw)
	if !changed {
		t.Fatal("expected changed=true")
	}
	var req map[string]any
	if err := common.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	input := req["input"].([]any)
	if len(input) != 2 {
		t.Fatalf("expected two items, got %d", len(input))
	}
	item := input[0].(map[string]any)
	if _, exists := item["encrypted_content"]; exists {
		t.Fatalf("expected encrypted_content removed, got %#v", item["encrypted_content"])
	}
	if _, exists := item["summary"]; !exists {
		t.Fatal("expected reasoning.summary to exist after encrypted_content removal")
	}
}

func TestHasResponsesReasoningItems(t *testing.T) {
	withReasoning := []byte(`{"input":[{"type":"message","role":"user","content":"hi"},{"type":"reasoning","encrypted_content":"abc"}]}`)
	if !hasResponsesReasoningItems(withReasoning) {
		t.Fatal("expected reasoning items detected")
	}
	withoutReasoning := []byte(`{"input":[{"type":"message","role":"user","content":"hi"}]}`)
	if hasResponsesReasoningItems(withoutReasoning) {
		t.Fatal("expected no reasoning items")
	}
}
