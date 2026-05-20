package openaicompat

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

// helper: parse a marshaled ResponsesAPIEvent's JSON into a flat map so we can
// assert top-level fields without re-deriving the wire shape.
func unmarshalEvent(t *testing.T, ev ResponsesAPIEvent) map[string]any {
	t.Helper()
	data, err := common.Marshal(ev)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, common.Unmarshal(data, &m))
	return m
}

func TestStreamToResponses_SequenceIsMonotonic(t *testing.T) {
	state := NewResponsesStreamState()
	first := "hello"
	chunk := &dto.ChatCompletionsStreamResponse{
		Id:      "abc12345",
		Object:  "chat.completion.chunk",
		Created: 100,
		Model:   "test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Content: &first,
				},
			},
		},
	}
	events := ChatCompletionsStreamToResponsesEvents(chunk, state)
	require.NotEmpty(t, events)
	for i, ev := range events {
		want := int64(i + 1)
		if ev.SequenceNumber != want {
			t.Errorf("event[%d].seq=%d want %d", i, ev.SequenceNumber, want)
		}
	}
}

func TestStreamToResponses_CreatedAndInProgressOnce(t *testing.T) {
	state := NewResponsesStreamState()
	first := "a"
	chunk1 := &dto.ChatCompletionsStreamResponse{
		Id:    "x",
		Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &first}},
		},
	}
	ev1 := ChatCompletionsStreamToResponsesEvents(chunk1, state)
	chunk2 := &dto.ChatCompletionsStreamResponse{
		Id:    "x",
		Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &first}},
		},
	}
	ev2 := ChatCompletionsStreamToResponsesEvents(chunk2, state)

	count := func(events []ResponsesAPIEvent, t string) int {
		n := 0
		for _, e := range events {
			if e.Type == t {
				n++
			}
		}
		return n
	}
	all := append(ev1, ev2...)
	if count(all, "response.created") != 1 {
		t.Errorf("created count=%d want 1", count(all, "response.created"))
	}
	if count(all, "response.in_progress") != 1 {
		t.Errorf("in_progress count=%d want 1", count(all, "response.in_progress"))
	}
}

func TestStreamToResponses_ResponseIDPrefixed(t *testing.T) {
	state := NewResponsesStreamState()
	text := "hi"
	chunk := &dto.ChatCompletionsStreamResponse{
		Id:    "abc12345",
		Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &text}},
		},
	}
	events := ChatCompletionsStreamToResponsesEvents(chunk, state)
	require.NotEmpty(t, events)
	m := unmarshalEvent(t, events[0])
	resp, ok := m["response"].(map[string]any)
	require.True(t, ok)
	if resp["id"] != "resp_abc12345" {
		t.Errorf("id=%v want resp_abc12345", resp["id"])
	}
}

func TestStreamToResponses_MessageLifecycle(t *testing.T) {
	state := NewResponsesStreamState()
	text := "hello"
	c1 := &dto.ChatCompletionsStreamResponse{
		Id:    "x",
		Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &text}},
		},
	}
	ev := ChatCompletionsStreamToResponsesEvents(c1, state)
	wantTypes := []string{
		"response.created",
		"response.in_progress",
		"response.output_item.added",
		"response.content_part.added",
		"response.output_text.delta",
	}
	for i, want := range wantTypes {
		if i >= len(ev) {
			t.Errorf("missing event %d: %s", i, want)
			continue
		}
		if ev[i].Type != want {
			t.Errorf("event[%d].type=%s want %s", i, ev[i].Type, want)
		}
	}

	// EOS flush should close.
	flush := ChatCompletionsStreamToResponsesEvents(nil, state)
	typesWanted := []string{
		"response.output_text.done",
		"response.content_part.done",
		"response.output_item.done",
		"response.completed",
	}
	wireTypes := make([]string, 0, len(flush))
	for _, e := range flush {
		wireTypes = append(wireTypes, e.Type)
	}
	for _, want := range typesWanted {
		found := false
		for _, t2 := range wireTypes {
			if t2 == want {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("missing flush event %s in %v", want, wireTypes)
		}
	}
}

func TestStreamToResponses_ReasoningLifecycle(t *testing.T) {
	state := NewResponsesStreamState()
	r1 := "step1"
	c1 := &dto.ChatCompletionsStreamResponse{
		Id:    "x",
		Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ReasoningContent: &r1}},
		},
	}
	ev := ChatCompletionsStreamToResponsesEvents(c1, state)
	hasAdded := false
	hasPartAdded := false
	hasDelta := false
	for _, e := range ev {
		switch e.Type {
		case "response.output_item.added":
			hasAdded = true
		case "response.reasoning_summary_part.added":
			hasPartAdded = true
		case "response.reasoning_summary_text.delta":
			hasDelta = true
		}
	}
	if !hasAdded || !hasPartAdded || !hasDelta {
		t.Errorf("missing reasoning events: added=%v partAdded=%v delta=%v", hasAdded, hasPartAdded, hasDelta)
	}
}

func TestStreamToResponses_FunctionCallLifecycle(t *testing.T) {
	state := NewResponsesStreamState()
	idx0 := 0
	c1 := &dto.ChatCompletionsStreamResponse{
		Id:    "x",
		Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index:    &idx0,
							ID:       "c1",
							Type:     "function",
							Function: dto.FunctionResponse{Name: "search", Arguments: "{"},
						},
					},
				},
			},
		},
	}
	ev := ChatCompletionsStreamToResponsesEvents(c1, state)
	added := false
	delta := false
	for _, e := range ev {
		if e.Type == "response.output_item.added" {
			added = true
			m := unmarshalEvent(t, e)
			if item, ok := m["item"].(map[string]any); ok {
				if item["type"] != "function_call" {
					t.Errorf("output_item.added.type=%v want function_call", item["type"])
				}
				if item["arguments"] != "" {
					t.Errorf("initial arguments=%v want \"\"", item["arguments"])
				}
			}
		}
		if e.Type == "response.function_call_arguments.delta" {
			delta = true
		}
	}
	if !added || !delta {
		t.Errorf("missing function_call events: added=%v delta=%v", added, delta)
	}

	// Flush should close with done events.
	flush := ChatCompletionsStreamToResponsesEvents(nil, state)
	hasArgsDone := false
	hasItemDone := false
	for _, e := range flush {
		if e.Type == "response.function_call_arguments.done" {
			hasArgsDone = true
			m := unmarshalEvent(t, e)
			if m["arguments"] != "{" {
				t.Errorf("done args=%v want '{'", m["arguments"])
			}
		}
		if e.Type == "response.output_item.done" {
			hasItemDone = true
		}
	}
	if !hasArgsDone || !hasItemDone {
		t.Errorf("missing close events: args.done=%v item.done=%v", hasArgsDone, hasItemDone)
	}
}

func TestStreamToResponses_FunctionCallEmptyArgsDefaultsCurly(t *testing.T) {
	state := NewResponsesStreamState()
	idx0 := 0
	c1 := &dto.ChatCompletionsStreamResponse{
		Id:    "x",
		Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index:    &idx0,
							ID:       "c1",
							Type:     "function",
							Function: dto.FunctionResponse{Name: "f"},
						},
					},
				},
			},
		},
	}
	_ = ChatCompletionsStreamToResponsesEvents(c1, state)
	flush := ChatCompletionsStreamToResponsesEvents(nil, state)
	for _, e := range flush {
		if e.Type == "response.function_call_arguments.done" {
			m := unmarshalEvent(t, e)
			if m["arguments"] != "{}" {
				t.Errorf("empty args default=%v want {}", m["arguments"])
			}
		}
	}
}

func TestStreamToResponses_InlineThinkTag(t *testing.T) {
	state := NewResponsesStreamState()
	text := "intro<think>step"
	c1 := &dto.ChatCompletionsStreamResponse{
		Id:    "x",
		Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &text}},
		},
	}
	ev := ChatCompletionsStreamToResponsesEvents(c1, state)
	gotText := false
	gotReasoning := false
	for _, e := range ev {
		if e.Type == "response.output_text.delta" {
			gotText = true
		}
		if e.Type == "response.reasoning_summary_text.delta" {
			gotReasoning = true
		}
	}
	if !gotText || !gotReasoning {
		t.Errorf("inline marker: text=%v reasoning=%v", gotText, gotReasoning)
	}
}

func TestStreamToResponses_InlineThinkClose(t *testing.T) {
	state := NewResponsesStreamState()
	t1 := "intro<think>step"
	c1 := &dto.ChatCompletionsStreamResponse{
		Id: "x", Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &t1}},
		},
	}
	_ = ChatCompletionsStreamToResponsesEvents(c1, state)
	t2 := "more</think>answer"
	c2 := &dto.ChatCompletionsStreamResponse{
		Id: "x", Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &t2}},
		},
	}
	ev2 := ChatCompletionsStreamToResponsesEvents(c2, state)
	// Must close reasoning then open message and emit text "answer".
	hasReasoningClose := false
	hasTextOpen := false
	hasTextDeltaAnswer := false
	for _, e := range ev2 {
		if e.Type == "response.reasoning_summary_text.done" {
			hasReasoningClose = true
		}
		if e.Type == "response.content_part.added" {
			hasTextOpen = true
		}
		if e.Type == "response.output_text.delta" {
			m := unmarshalEvent(t, e)
			if s, _ := m["delta"].(string); strings.Contains(s, "answer") {
				hasTextDeltaAnswer = true
			}
		}
	}
	if !hasReasoningClose || !hasTextOpen || !hasTextDeltaAnswer {
		t.Errorf("close path missing: reasoningClose=%v textOpen=%v ans=%v", hasReasoningClose, hasTextOpen, hasTextDeltaAnswer)
	}
}

func TestStreamToResponses_NullFlushIdempotent(t *testing.T) {
	state := NewResponsesStreamState()
	text := "hi"
	c1 := &dto.ChatCompletionsStreamResponse{
		Id: "x", Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &text}},
		},
	}
	_ = ChatCompletionsStreamToResponsesEvents(c1, state)
	f1 := ChatCompletionsStreamToResponsesEvents(nil, state)
	f2 := ChatCompletionsStreamToResponsesEvents(nil, state)
	count := 0
	for _, e := range f1 {
		if e.Type == "response.completed" {
			count++
		}
	}
	for _, e := range f2 {
		if e.Type == "response.completed" {
			count++
		}
	}
	if count != 1 {
		t.Errorf("response.completed emitted %d times, want 1", count)
	}
}

func TestStreamToResponses_ErrorMappedOnce(t *testing.T) {
	state := NewResponsesStreamState()
	ev1 := EmitChatStreamErrorEvent(state, "boom")
	ev2 := EmitChatStreamErrorEvent(state, "boom")
	if len(ev2) != 0 {
		t.Errorf("second emit returned %d events", len(ev2))
	}
	count := 0
	for _, e := range ev1 {
		if e.Type == "response.failed" {
			count++
		}
	}
	if count != 1 {
		t.Errorf("response.failed count=%d want 1", count)
	}
}

func TestStreamToResponses_UsagePropagation(t *testing.T) {
	state := NewResponsesStreamState()
	text := "hi"
	c1 := &dto.ChatCompletionsStreamResponse{
		Id: "x", Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &text}},
		},
		Usage: &dto.Usage{
			PromptTokens:     100,
			CompletionTokens: 50,
			TotalTokens:      150,
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens:         30,
				CachedCreationTokens: 20,
			},
		},
	}
	_ = ChatCompletionsStreamToResponsesEvents(c1, state)
	flush := ChatCompletionsStreamToResponsesEvents(nil, state)
	var completed map[string]any
	for _, e := range flush {
		if e.Type == "response.completed" {
			completed = unmarshalEvent(t, e)
		}
	}
	require.NotNil(t, completed)
	resp, _ := completed["response"].(map[string]any)
	usage, _ := resp["usage"].(map[string]any)
	// input_tokens = 100 - 30 - 20 = 50
	if u, _ := usage["input_tokens"].(float64); int(u) != 50 {
		t.Errorf("input_tokens=%v want 50", usage["input_tokens"])
	}
	if u, _ := usage["output_tokens"].(float64); int(u) != 50 {
		t.Errorf("output_tokens=%v want 50", usage["output_tokens"])
	}
	det, _ := usage["input_tokens_details"].(map[string]any)
	require.NotNil(t, det)
	if c, _ := det["cached_tokens"].(float64); int(c) != 30 {
		t.Errorf("cached_tokens=%v want 30", det["cached_tokens"])
	}
}

func TestResponsesAPIEvent_MarshalJSON_PayloadCannotShadowDedicatedFields(t *testing.T) {
	ev := ResponsesAPIEvent{
		Type:           "response.completed",
		SequenceNumber: 42,
		Payload: map[string]any{
			"type":            "ATTACKER_OVERRIDE",
			"sequence_number": 9999,
			"response":        map[string]any{"id": "resp_1"},
		},
	}
	raw, err := ev.MarshalJSON()
	require.NoError(t, err)
	var got map[string]any
	require.NoError(t, common.Unmarshal(raw, &got))
	require.Equal(t, "response.completed", got["type"], "dedicated type must win over payload key")
	require.EqualValues(t, 42, got["sequence_number"], "dedicated sequence_number must win over payload key")
	require.NotNil(t, got["response"], "non-conflicting payload keys must still be present")
}

func TestStreamToResponses_ErrorPreventsSubsequentCompleted(t *testing.T) {
	state := NewResponsesStreamState()
	// Drive at least one usable chunk so state.Started is true.
	text := "Hi"
	finish := ""
	chunk := &dto.ChatCompletionsStreamResponse{
		Id:    "abc",
		Model: "claude-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta:        dto.ChatCompletionsStreamResponseChoiceDelta{Content: &text},
				FinishReason: &finish,
			},
		},
	}
	_ = ChatCompletionsStreamToResponsesEvents(chunk, state)

	// Now emit a failure.
	errEvents := EmitChatStreamErrorEvent(state, "upstream blew up")
	require.NotEmpty(t, errEvents)

	// The flush MUST be a no-op now: no response.completed must follow.
	flushEvents := ChatCompletionsStreamToResponsesEvents(nil, state)
	for _, ev := range flushEvents {
		require.NotEqual(t, "response.completed", ev.Type,
			"response.completed must NOT fire after response.failed")
	}
}

func TestStreamToResponses_ToolCloseBeforeTextAndReverse(t *testing.T) {
	// Open text first, then tool_call: text must close before tool opens.
	state := NewResponsesStreamState()
	tx := "hello"
	c1 := &dto.ChatCompletionsStreamResponse{
		Id: "x", Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: &tx}},
		},
	}
	_ = ChatCompletionsStreamToResponsesEvents(c1, state)
	idx0 := 0
	c2 := &dto.ChatCompletionsStreamResponse{
		Id: "x", Model: "m",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index:    &idx0,
							ID:       "c1",
							Type:     "function",
							Function: dto.FunctionResponse{Name: "x"},
						},
					},
				},
			},
		},
	}
	ev := ChatCompletionsStreamToResponsesEvents(c2, state)
	idxTextDone := -1
	idxToolAdded := -1
	for i, e := range ev {
		if e.Type == "response.output_text.done" && idxTextDone == -1 {
			idxTextDone = i
		}
		if e.Type == "response.output_item.added" {
			m := unmarshalEvent(t, e)
			if item, ok := m["item"].(map[string]any); ok && item["type"] == "function_call" {
				idxToolAdded = i
			}
		}
	}
	if idxTextDone == -1 || idxToolAdded == -1 || idxTextDone >= idxToolAdded {
		t.Errorf("ordering wrong: textDone=%d toolAdded=%d", idxTextDone, idxToolAdded)
	}
}
