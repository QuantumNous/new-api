package claude

import (
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func ptrStr(s string) *string { return &s }
func ptrInt(i int) *int       { return &i }

func TestStreamStateThinkingTextToolUse(t *testing.T) {
	state := NewClaudeResponsesStreamState("claude-opus-4-7")
	state.CreatedAt = 1700000000
	state.ResponseID = "resp_abc"

	usage := &dto.ClaudeUsage{InputTokens: 50, OutputTokens: 0}
	feed := func(c *dto.ClaudeResponse) []dto.ResponsesStreamResponse {
		return state.HandleClaudeChunk(c)
	}

	all := []dto.ResponsesStreamResponse{}
	all = append(all, feed(&dto.ClaudeResponse{
		Type: "message_start",
		Message: &dto.ClaudeMediaMessage{
			Id:    "msg_xyz",
			Model: "claude-opus-4-7",
			Usage: usage,
		},
	})...)
	all = append(all, feed(&dto.ClaudeResponse{
		Type:         "content_block_start",
		Index:        ptrInt(0),
		ContentBlock: &dto.ClaudeMediaMessage{Type: "thinking", Thinking: ptrStr(""), Signature: ""},
	})...)
	all = append(all, feed(&dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: ptrInt(0),
		Delta: &dto.ClaudeMediaMessage{Type: "thinking_delta", Thinking: ptrStr("Let me think.")},
	})...)
	all = append(all, feed(&dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: ptrInt(0),
		Delta: &dto.ClaudeMediaMessage{Type: "signature_delta", Signature: "SIG_RAW"},
	})...)
	all = append(all, feed(&dto.ClaudeResponse{Type: "content_block_stop", Index: ptrInt(0)})...)

	all = append(all, feed(&dto.ClaudeResponse{
		Type:         "content_block_start",
		Index:        ptrInt(1),
		ContentBlock: &dto.ClaudeMediaMessage{Type: "text", Text: ptrStr("")},
	})...)
	all = append(all, feed(&dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: ptrInt(1),
		Delta: &dto.ClaudeMediaMessage{Type: "text_delta", Text: ptrStr("Hello ")},
	})...)
	all = append(all, feed(&dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: ptrInt(1),
		Delta: &dto.ClaudeMediaMessage{Type: "text_delta", Text: ptrStr("world.")},
	})...)
	all = append(all, feed(&dto.ClaudeResponse{Type: "content_block_stop", Index: ptrInt(1)})...)

	all = append(all, feed(&dto.ClaudeResponse{
		Type:         "content_block_start",
		Index:        ptrInt(2),
		ContentBlock: &dto.ClaudeMediaMessage{Type: "tool_use", Id: "toolu_001", Name: "get_weather"},
	})...)
	all = append(all, feed(&dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: ptrInt(2),
		Delta: &dto.ClaudeMediaMessage{Type: "input_json_delta", PartialJson: ptrStr(`{"city":`)},
	})...)
	all = append(all, feed(&dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: ptrInt(2),
		Delta: &dto.ClaudeMediaMessage{Type: "input_json_delta", PartialJson: ptrStr(`"SF"}`)},
	})...)
	all = append(all, feed(&dto.ClaudeResponse{Type: "content_block_stop", Index: ptrInt(2)})...)

	all = append(all, feed(&dto.ClaudeResponse{
		Type:  "message_delta",
		Delta: &dto.ClaudeMediaMessage{StopReason: ptrStr("tool_use")},
		Usage: &dto.ClaudeUsage{OutputTokens: 42},
	})...)
	all = append(all, feed(&dto.ClaudeResponse{Type: "message_stop"})...)
	all = append(all, state.FinalEvents()...)

	gotTypes := make([]string, 0, len(all))
	for _, e := range all {
		gotTypes = append(gotTypes, e.Type)
	}
	wantSeq := []string{
		respEventCreated, respEventInProgress,
		respEventOutputItemAdded, respEventReasoningSummaryPartAdded,
		respEventReasoningSummaryTextDelta,
		respEventReasoningSummaryTextDone, respEventReasoningSummaryPartDone, respEventOutputItemDone,
		respEventOutputItemAdded, respEventContentPartAdded,
		respEventOutputTextDelta, respEventOutputTextDelta,
		respEventOutputTextDone, respEventContentPartDone, respEventOutputItemDone,
		respEventOutputItemAdded,
		respEventFnCallArgsDelta, respEventFnCallArgsDelta,
		respEventFnCallArgsDone, respEventOutputItemDone,
		respEventCompleted,
	}
	if len(gotTypes) != len(wantSeq) {
		t.Fatalf("event count mismatch: got %d (%v), want %d (%v)", len(gotTypes), gotTypes, len(wantSeq), wantSeq)
	}
	for i, want := range wantSeq {
		if gotTypes[i] != want {
			t.Errorf("event[%d]: got %q want %q (full: %v)", i, gotTypes[i], want, gotTypes)
		}
	}

	for i, e := range all {
		if e.SequenceNumber != i {
			t.Errorf("event[%d].SequenceNumber=%d want %d", i, e.SequenceNumber, i)
		}
	}

	final := all[len(all)-1]
	if final.Response == nil || len(final.Response.Output) != 3 {
		t.Fatalf("final response should have 3 output items, got %+v", final.Response)
	}
	reasoning := final.Response.Output[0]
	if reasoning.Type != "reasoning" {
		t.Errorf("output[0].type=%q want reasoning", reasoning.Type)
	}
	if reasoning.EncryptedContent == "" {
		t.Error("reasoning encrypted_content should not be empty")
	}
	_, decodedSig, _, _ := DecodeReasoningEncryptedContent(reasoning.EncryptedContent)
	if decodedSig != "SIG_RAW" {
		t.Errorf("encrypted_content signature round-trip: got %q want SIG_RAW", decodedSig)
	}
	if len(reasoning.Summary) != 1 || reasoning.Summary[0].Text != "Let me think." {
		t.Errorf("reasoning.summary=%v want single 'Let me think.'", reasoning.Summary)
	}

	msg := final.Response.Output[1]
	if msg.Type != "message" || len(msg.Content) != 1 || msg.Content[0].Text != "Hello world." {
		t.Errorf("output[1] message wrong: %+v", msg)
	}

	tc := final.Response.Output[2]
	if tc.Type != "function_call" || tc.CallId != "toolu_001" || tc.Name != "get_weather" {
		t.Errorf("output[2] function_call wrong: %+v", tc)
	}
	if string(tc.Arguments) != `{"city":"SF"}` {
		t.Errorf("tool arguments: got %s want {\"city\":\"SF\"}", string(tc.Arguments))
	}
}

func TestResponsesRequestReasoningRoundTrip(t *testing.T) {
	sig := "SIG_FROM_CLAUDE_PRIOR_TURN"
	encryptedRaw := EncodeThinkingSignature(sig)
	inputJSON := `[
		{"role":"user","content":"hi"},
		{"type":"reasoning","id":"rs_1","encrypted_content":"` + encryptedRaw + `","summary":[{"type":"summary_text","text":"thinking text"}]},
		{"role":"assistant","content":[{"type":"output_text","text":"answer"}]}
	]`
	req := &dto.OpenAIResponsesRequest{
		Model: "claude-opus-4-7",
		Input: []byte(inputJSON),
	}
	claude, err := ConvertResponsesRequestToClaude(req)
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if len(claude.Messages) != 2 {
		t.Fatalf("messages=%d want 2", len(claude.Messages))
	}
	assistant := claude.Messages[1]
	if assistant.Role != "assistant" {
		t.Fatalf("messages[1].role=%q want assistant", assistant.Role)
	}
	blocks, _ := assistant.ParseContent()
	if len(blocks) != 2 {
		t.Fatalf("assistant blocks=%d want 2 (thinking + text)", len(blocks))
	}
	if blocks[0].Type != "thinking" {
		t.Errorf("blocks[0].type=%q want thinking", blocks[0].Type)
	}
	if blocks[0].Signature != sig {
		t.Errorf("blocks[0].signature=%q want %q", blocks[0].Signature, sig)
	}
	if blocks[0].Thinking == nil || *blocks[0].Thinking != "thinking text" {
		t.Errorf("blocks[0].thinking=%v want 'thinking text'", blocks[0].Thinking)
	}
	if blocks[1].Type != "text" {
		t.Errorf("blocks[1].type=%q want text", blocks[1].Type)
	}
}

func TestResponsesRequestPreviousResponseIDRejected(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Model:              "claude-opus-4-7",
		Input:              []byte(`"hi"`),
		PreviousResponseID: "resp_prev_xxx",
	}
	_, err := ConvertResponsesRequestToClaude(req)
	if err == nil || !strings.Contains(err.Error(), "previous_response_id") {
		t.Errorf("expected previous_response_id rejection, got %v", err)
	}
}

func TestResponsesRequestJSONSchemaFormatRejected(t *testing.T) {
	textRaw, _ := common.Marshal(map[string]any{"format": map[string]any{"type": "json_schema"}})
	req := &dto.OpenAIResponsesRequest{
		Model: "claude-opus-4-7",
		Input: []byte(`"hi"`),
		Text:  textRaw,
	}
	_, err := ConvertResponsesRequestToClaude(req)
	if err == nil || !strings.Contains(err.Error(), "json_schema") {
		t.Errorf("expected json_schema rejection, got %v", err)
	}
}

func TestResponsesRequestReasoningEffortMapsToAdaptive(t *testing.T) {
	cases := []struct {
		name     string
		effort   string
		summary  string
		wantType string
		wantDisp string
	}{
		{"minimal disables", "minimal", "", "disabled", ""},
		{"low to adaptive summarized", "low", "", "adaptive", "summarized"},
		{"medium to adaptive summarized", "medium", "auto", "adaptive", "summarized"},
		{"high to adaptive summarized", "high", "concise", "adaptive", "summarized"},
		{"summary none omits", "high", "none", "adaptive", "omitted"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := &dto.OpenAIResponsesRequest{
				Model:     "claude-opus-4-7",
				Input:     []byte(`"hi"`),
				Reasoning: &dto.Reasoning{Effort: tc.effort, Summary: tc.summary},
			}
			claude, err := ConvertResponsesRequestToClaude(req)
			if err != nil {
				t.Fatalf("convert: %v", err)
			}
			if claude.Thinking == nil {
				t.Fatalf("Thinking is nil")
			}
			if claude.Thinking.Type != tc.wantType {
				t.Errorf("Thinking.Type=%q want %q", claude.Thinking.Type, tc.wantType)
			}
			if claude.Thinking.Display != tc.wantDisp {
				t.Errorf("Thinking.Display=%q want %q", claude.Thinking.Display, tc.wantDisp)
			}
		})
	}
}

func TestResponsesRequestToolCallRoundTrip(t *testing.T) {
	inputJSON := `[
		{"role":"user","content":"what is the weather in SF?"},
		{"type":"function_call","call_id":"toolu_001","name":"get_weather","arguments":"{\"city\":\"SF\"}"},
		{"type":"function_call_output","call_id":"toolu_001","output":"sunny"}
	]`
	req := &dto.OpenAIResponsesRequest{
		Model: "claude-opus-4-7",
		Input: []byte(inputJSON),
	}
	claude, err := ConvertResponsesRequestToClaude(req)
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if len(claude.Messages) != 3 {
		t.Fatalf("messages=%d want 3 (user / assistant tool_use / user tool_result)", len(claude.Messages))
	}
	assistant := claude.Messages[1]
	blocks, _ := assistant.ParseContent()
	if len(blocks) != 1 || blocks[0].Type != "tool_use" || blocks[0].Id != "toolu_001" {
		t.Errorf("assistant blocks wrong: %+v", blocks)
	}
	if blocks[0].Name != "get_weather" {
		t.Errorf("tool name=%q want get_weather", blocks[0].Name)
	}
	inputMap, ok := blocks[0].Input.(map[string]any)
	if !ok || inputMap["city"] != "SF" {
		t.Errorf("tool input=%v want {city:SF}", blocks[0].Input)
	}
	user2 := claude.Messages[2]
	blocks2, _ := user2.ParseContent()
	if len(blocks2) != 1 || blocks2[0].Type != "tool_result" || blocks2[0].ToolUseId != "toolu_001" {
		t.Errorf("tool_result wrong: %+v", blocks2)
	}
	if blocks2[0].Content != "sunny" {
		t.Errorf("tool_result content=%v want sunny", blocks2[0].Content)
	}
}

func TestStreamMaxTokensIncompleteEvent(t *testing.T) {
	state := NewClaudeResponsesStreamState("claude-opus-4-7")
	state.CreatedAt = 1700000000
	state.ResponseID = "resp_x"

	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:    "message_start",
		Message: &dto.ClaudeMediaMessage{Id: "msg_1", Model: "claude-opus-4-7", Usage: &dto.ClaudeUsage{InputTokens: 10}},
	})
	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:         "content_block_start",
		Index:        ptrInt(0),
		ContentBlock: &dto.ClaudeMediaMessage{Type: "text", Text: ptrStr("")},
	})
	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: ptrInt(0),
		Delta: &dto.ClaudeMediaMessage{Type: "text_delta", Text: ptrStr("partial")},
	})
	state.HandleClaudeChunk(&dto.ClaudeResponse{Type: "content_block_stop", Index: ptrInt(0)})
	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:  "message_delta",
		Delta: &dto.ClaudeMediaMessage{StopReason: ptrStr("max_tokens")},
		Usage: &dto.ClaudeUsage{OutputTokens: 100},
	})
	final := state.FinalEvents()
	if len(final) != 1 || final[0].Type != respEventIncomplete {
		t.Fatalf("final event type=%v want response.incomplete (len=%d)", final, len(final))
	}
	if final[0].Response == nil || final[0].Response.IncompleteDetails == nil {
		t.Fatalf("final response missing incomplete_details: %+v", final[0].Response)
	}
	if final[0].Response.IncompleteDetails.Reason != "max_output_tokens" {
		t.Errorf("incomplete_details.reason=%q want max_output_tokens", final[0].Response.IncompleteDetails.Reason)
	}
	raw, _ := common.Marshal(final[0].Response.IncompleteDetails)
	if !strings.Contains(string(raw), `"reason":"max_output_tokens"`) {
		t.Errorf("serialized JSON should use 'reason' key, got %s", string(raw))
	}
}

func TestNonStreamMaxTokensIncomplete(t *testing.T) {
	cr := &dto.ClaudeResponse{
		Id:         "msg_2",
		Type:       "message",
		Role:       "assistant",
		Model:      "claude-opus-4-7",
		StopReason: "max_tokens",
		Content: []dto.ClaudeMediaMessage{
			{Type: "text", Text: ptrStr("partial")},
		},
		Usage: &dto.ClaudeUsage{InputTokens: 5, OutputTokens: 50},
	}
	resp := ConvertClaudeResponseToResponses(cr)
	if resp.IncompleteDetails == nil {
		t.Fatal("incomplete_details should be set")
	}
	if resp.IncompleteDetails.Reason != "max_output_tokens" {
		t.Errorf("reason=%q want max_output_tokens", resp.IncompleteDetails.Reason)
	}
}

func TestAssistantTextThenReasoningRejected(t *testing.T) {
	encryptedRaw := EncodeThinkingSignature("SIG")
	inputJSON := `[
		{"role":"user","content":"hi"},
		{"role":"assistant","content":[{"type":"output_text","text":"hello"}]},
		{"type":"reasoning","id":"rs_1","encrypted_content":"` + encryptedRaw + `","summary":[{"type":"summary_text","text":"thought"}]}
	]`
	req := &dto.OpenAIResponsesRequest{Model: "claude-opus-4-7", Input: []byte(inputJSON)}
	_, err := ConvertResponsesRequestToClaude(req)
	if err == nil || !strings.Contains(err.Error(), "reasoning") {
		t.Errorf("expected rejection for reasoning after text, got %v", err)
	}
}

func TestAssistantReasoningThenTextAllowed(t *testing.T) {
	encryptedRaw := EncodeThinkingSignature("SIG")
	inputJSON := `[
		{"role":"user","content":"hi"},
		{"type":"reasoning","id":"rs_1","encrypted_content":"` + encryptedRaw + `","summary":[{"type":"summary_text","text":"thought"}]},
		{"role":"assistant","content":[{"type":"output_text","text":"hello"}]}
	]`
	req := &dto.OpenAIResponsesRequest{Model: "claude-opus-4-7", Input: []byte(inputJSON)}
	claude, err := ConvertResponsesRequestToClaude(req)
	if err != nil {
		t.Fatalf("should not err: %v", err)
	}
	if len(claude.Messages) != 2 {
		t.Fatalf("messages=%d want 2", len(claude.Messages))
	}
	assistant := claude.Messages[1]
	blocks, _ := assistant.ParseContent()
	if len(blocks) != 2 {
		t.Fatalf("blocks=%d want 2 (thinking+text)", len(blocks))
	}
	if blocks[0].Type != "thinking" || blocks[1].Type != "text" {
		t.Errorf("block order wrong: %s, %s", blocks[0].Type, blocks[1].Type)
	}
}

func TestToolChoiceAllowedToolsRejected(t *testing.T) {
	tc, _ := common.Marshal(map[string]any{"type": "allowed_tools", "tools": []map[string]any{{"type": "function", "name": "x"}}})
	req := &dto.OpenAIResponsesRequest{
		Model:      "claude-opus-4-7",
		Input:      []byte(`"hi"`),
		ToolChoice: tc,
	}
	_, err := ConvertResponsesRequestToClaude(req)
	if err == nil || !strings.Contains(err.Error(), "allowed_tools") {
		t.Errorf("expected allowed_tools rejection, got %v", err)
	}
}

func TestStreamServerToolUseSkipped(t *testing.T) {
	state := NewClaudeResponsesStreamState("claude-opus-4-7")
	state.CreatedAt = 1700000000
	state.ResponseID = "resp_x"

	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:    "message_start",
		Message: &dto.ClaudeMediaMessage{Id: "msg_1", Model: "claude-opus-4-7", Usage: &dto.ClaudeUsage{InputTokens: 10}},
	})
	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:         "content_block_start",
		Index:        ptrInt(0),
		ContentBlock: &dto.ClaudeMediaMessage{Type: "server_tool_use", Id: "stu_1", Name: "web_search"},
	})
	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: ptrInt(0),
		Delta: &dto.ClaudeMediaMessage{Type: "input_json_delta", PartialJson: ptrStr(`{"q":`)},
	})
	state.HandleClaudeChunk(&dto.ClaudeResponse{Type: "content_block_stop", Index: ptrInt(0)})

	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:         "content_block_start",
		Index:        ptrInt(1),
		ContentBlock: &dto.ClaudeMediaMessage{Type: "text", Text: ptrStr("")},
	})
	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: ptrInt(1),
		Delta: &dto.ClaudeMediaMessage{Type: "text_delta", Text: ptrStr("answer")},
	})
	state.HandleClaudeChunk(&dto.ClaudeResponse{Type: "content_block_stop", Index: ptrInt(1)})
	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:  "message_delta",
		Delta: &dto.ClaudeMediaMessage{StopReason: ptrStr("end_turn")},
	})
	final := state.FinalEvents()
	if final[0].Response == nil {
		t.Fatal("final response nil")
	}
	for _, item := range final[0].Response.Output {
		if item.Type == "unknown" {
			t.Errorf("output should not contain type:unknown items, got %+v", item)
		}
	}
	if len(final[0].Response.Output) != 1 {
		t.Errorf("output count=%d want 1 (only text)", len(final[0].Response.Output))
	}
	if len(final[0].Response.Output) >= 1 {
		msg := final[0].Response.Output[0]
		if msg.Type != "message" || msg.Content[0].Text != "answer" {
			t.Errorf("output[0] wrong: %+v", msg)
		}
		want := 1
		if msg.Content[0].Text != "answer" || len(final[0].Response.Output) != want {
			t.Errorf("expected only the text message at output[0], got %+v", final[0].Response.Output)
		}
	}
}

func TestStreamMalformedEnvelopeInInputRejected(t *testing.T) {
	bad := reasoningEnvelopePrefix + "not-base64!!!"
	inputJSON := `[
		{"role":"user","content":"hi"},
		{"type":"reasoning","id":"rs_1","encrypted_content":"` + bad + `","summary":[{"type":"summary_text","text":"x"}]}
	]`
	req := &dto.OpenAIResponsesRequest{Model: "claude-opus-4-7", Input: []byte(inputJSON)}
	_, err := ConvertResponsesRequestToClaude(req)
	if err == nil || !strings.Contains(err.Error(), "envelope") {
		t.Errorf("expected envelope decode error, got %v", err)
	}
}

func TestStreamInterleavedThinkingText(t *testing.T) {
	state := NewClaudeResponsesStreamState("claude-opus-4-7")
	state.CreatedAt = 1700000000
	state.ResponseID = "resp_x"

	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:    "message_start",
		Message: &dto.ClaudeMediaMessage{Id: "msg_1", Model: "claude-opus-4-7", Usage: &dto.ClaudeUsage{InputTokens: 10}},
	})

	for i, blockType := range []string{"thinking", "text", "thinking", "text"} {
		state.HandleClaudeChunk(&dto.ClaudeResponse{
			Type:         "content_block_start",
			Index:        ptrInt(i),
			ContentBlock: &dto.ClaudeMediaMessage{Type: blockType, Text: ptrStr(""), Thinking: ptrStr(""), Signature: ""},
		})
		deltaType := "text_delta"
		var delta dto.ClaudeMediaMessage
		if blockType == "thinking" {
			deltaType = "thinking_delta"
			delta = dto.ClaudeMediaMessage{Type: deltaType, Thinking: ptrStr("t" + strconv.Itoa(i))}
		} else {
			delta = dto.ClaudeMediaMessage{Type: deltaType, Text: ptrStr("x" + strconv.Itoa(i))}
		}
		state.HandleClaudeChunk(&dto.ClaudeResponse{Type: "content_block_delta", Index: ptrInt(i), Delta: &delta})
		if blockType == "thinking" {
			state.HandleClaudeChunk(&dto.ClaudeResponse{
				Type:  "content_block_delta",
				Index: ptrInt(i),
				Delta: &dto.ClaudeMediaMessage{Type: "signature_delta", Signature: "S" + strconv.Itoa(i)},
			})
		}
		state.HandleClaudeChunk(&dto.ClaudeResponse{Type: "content_block_stop", Index: ptrInt(i)})
	}
	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:  "message_delta",
		Delta: &dto.ClaudeMediaMessage{StopReason: ptrStr("end_turn")},
	})
	final := state.FinalEvents()
	if len(final[0].Response.Output) != 4 {
		t.Fatalf("output count=%d want 4 (interleaved)", len(final[0].Response.Output))
	}
	wantTypes := []string{"reasoning", "message", "reasoning", "message"}
	for i, item := range final[0].Response.Output {
		if item.Type != wantTypes[i] {
			t.Errorf("output[%d].type=%q want %q", i, item.Type, wantTypes[i])
		}
	}
	r0 := final[0].Response.Output[0]
	if r0.EncryptedContent == "" {
		t.Error("reasoning[0].encrypted_content empty")
	}
	_, sig, _, err := DecodeReasoningEncryptedContent(r0.EncryptedContent)
	if err != nil || sig != "S0" {
		t.Errorf("reasoning[0] sig roundtrip=%q want S0 err=%v", sig, err)
	}
	r2 := final[0].Response.Output[2]
	_, sig2, _, _ := DecodeReasoningEncryptedContent(r2.EncryptedContent)
	if sig2 != "S2" {
		t.Errorf("reasoning[2] sig=%q want S2", sig2)
	}
}

func TestStreamRedactedThinkingEmitsEncryptedContent(t *testing.T) {
	state := NewClaudeResponsesStreamState("claude-opus-4-7")
	state.CreatedAt = 1700000000
	state.ResponseID = "resp_x"

	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:    "message_start",
		Message: &dto.ClaudeMediaMessage{Id: "msg_1", Model: "claude-opus-4-7", Usage: &dto.ClaudeUsage{InputTokens: 10}},
	})
	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:         "content_block_start",
		Index:        ptrInt(0),
		ContentBlock: &dto.ClaudeMediaMessage{Type: "redacted_thinking", Data: "REDACTED_BLOB"},
	})
	state.HandleClaudeChunk(&dto.ClaudeResponse{Type: "content_block_stop", Index: ptrInt(0)})
	state.HandleClaudeChunk(&dto.ClaudeResponse{
		Type:  "message_delta",
		Delta: &dto.ClaudeMediaMessage{StopReason: ptrStr("end_turn")},
	})
	final := state.FinalEvents()
	if len(final[0].Response.Output) != 1 {
		t.Fatalf("output count=%d want 1", len(final[0].Response.Output))
	}
	out := final[0].Response.Output[0]
	if out.Type != "reasoning" {
		t.Errorf("type=%q want reasoning", out.Type)
	}
	if out.EncryptedContent == "" {
		t.Fatal("encrypted_content empty")
	}
	kind, _, data, err := DecodeReasoningEncryptedContent(out.EncryptedContent)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if kind != ReasoningKindRedacted || data != "REDACTED_BLOB" {
		t.Errorf("roundtrip kind=%q data=%q want redacted/REDACTED_BLOB", kind, data)
	}
}
