package openaicompat

import (
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// ResponsesAPIEvent is a generic Responses-API event envelope. It is encoded
// as JSON for SSE wire transmission; the `Type` field becomes the SSE `event:`
// header, and the full envelope becomes the `data:` payload.
type ResponsesAPIEvent struct {
	Type           string `json:"type"`
	SequenceNumber int64  `json:"sequence_number"`
	// Payload holds the event-specific fields. It is rendered as siblings of
	// `type`/`sequence_number` on the wire via the custom MarshalJSON below.
	Payload map[string]any `json:"-"`
}

// MarshalJSON flattens Payload into the top-level object alongside `type` and
// `sequence_number`.
func (e ResponsesAPIEvent) MarshalJSON() ([]byte, error) {
	m := make(map[string]any, len(e.Payload)+2)
	for k, v := range e.Payload {
		m[k] = v
	}
	// Dedicated fields always win over payload to prevent shadowing.
	m["type"] = e.Type
	m["sequence_number"] = e.SequenceNumber
	return common.Marshal(m)
}

// emitEvent builds an event and increments the seq counter.
func emitEvent(state *ResponsesStreamState, eventType string, payload map[string]any) ResponsesAPIEvent {
	if payload == nil {
		payload = map[string]any{}
	}
	return ResponsesAPIEvent{
		Type:           eventType,
		SequenceNumber: state.NextSeq(),
		Payload:        payload,
	}
}

// ChatCompletionsStreamToResponsesEvents translates one Chat-Completions
// stream chunk into a sequence of Responses-API SSE events. A nil `chunk`
// flushes any still-open output_item and emits `response.completed` exactly
// once (idempotent on subsequent nil calls).
//
// Spec coverage:
//   - §5.1: sequence counter starts at 1, monotonic
//   - §5.2: response.created + response.in_progress emitted once on first usable chunk
//   - §5.3: message lifecycle (added/content_part.added/delta/done events)
//   - §5.4: reasoning lifecycle (output_item.added/reasoning_summary_part.added/delta/done)
//   - §5.5: function_call lifecycle (added with arguments:"" / delta / done)
//   - §5.6: <think> ... </think> inline tag recognition
//   - §5.7: null-chunk flush with deterministic close order
//   - §5.8: error events emit a single response.failed (dedup)
//   - §5.9: usage propagation on response.completed (cache token decomposition)
//   - §5.10: custom_tool_call alias
func ChatCompletionsStreamToResponsesEvents(chunk *dto.ChatCompletionsStreamResponse, state *ResponsesStreamState) []ResponsesAPIEvent {
	if state == nil {
		// Defensive: cannot translate without state.
		return nil
	}

	if chunk == nil {
		return flushOnEOS(state)
	}

	events := make([]ResponsesAPIEvent, 0, 4)

	// Emit response.created + response.in_progress exactly once on the first
	// usable chunk.
	if !state.Started {
		respID := strings.TrimSpace(chunk.Id)
		if respID == "" {
			respID = "chat"
		}
		respID = "resp_" + respID
		state.ResponseID = respID
		state.Model = chunk.Model
		state.CreatedAt = chunk.Created
		if state.CreatedAt == 0 {
			state.CreatedAt = time.Now().Unix()
		}
		responseEnvelope := buildResponseEnvelope(state, "in_progress")
		events = append(events, emitEvent(state, "response.created", map[string]any{
			"response": responseEnvelope,
		}))
		events = append(events, emitEvent(state, "response.in_progress", map[string]any{
			"response": responseEnvelope,
		}))
		state.Started = true
		state.InProgressSent = true
	}

	if len(chunk.Choices) == 0 {
		return events
	}
	choice := chunk.Choices[0]
	delta := choice.Delta

	// Track usage update on every chunk that carries one.
	if chunk.Usage != nil {
		state.Usage.PromptTokens = chunk.Usage.PromptTokens
		state.Usage.CompletionTokens = chunk.Usage.CompletionTokens
		state.Usage.TotalTokens = chunk.Usage.TotalTokens
		state.Usage.CachedTokens = chunk.Usage.PromptTokensDetails.CachedTokens
		state.Usage.CacheCreationTokens = chunk.Usage.PromptTokensDetails.CachedCreationTokens
		state.Usage.ReasoningTokens = chunk.Usage.CompletionTokenDetails.ReasoningTokens
	}

	// Tool call deltas take precedence over text.
	for _, tc := range delta.ToolCalls {
		evs := handleToolCallDelta(state, tc)
		events = append(events, evs...)
	}

	// Reasoning content delta -> reasoning output_item lifecycle.
	if rc := delta.GetReasoningContent(); rc != "" {
		// Close any open message before opening reasoning.
		events = append(events, closeMessageIfOpen(state)...)
		events = append(events, ensureReasoningOpen(state)...)
		events = append(events, emitEvent(state, "response.reasoning_summary_text.delta", map[string]any{
			"item_id":       state.ResponseID,
			"output_index":  state.ReasoningItemIndex,
			"summary_index": 0,
			"delta":         rc,
		}))
	}

	// Text content delta. Honour <think> ... </think> inline markers.
	if delta.Content != nil && *delta.Content != "" {
		text := *delta.Content
		events = append(events, handleTextDeltaWithInlineThink(state, text)...)
	}

	// Finish reason — record but do not emit response.completed until we
	// receive a null chunk (or the upstream gracefully terminates).
	if choice.FinishReason != nil && *choice.FinishReason != "" {
		state.FinalFinishReason = *choice.FinishReason
	}

	return events
}

// EmitChatStreamErrorEvent emits a single response.failed event for upstream
// error events. Calling this more than once is a no-op (spec §5.8).
func EmitChatStreamErrorEvent(state *ResponsesStreamState, message string) []ResponsesAPIEvent {
	if state == nil || state.ErrorEmitted {
		return nil
	}
	state.ErrorEmitted = true
	if !state.Started {
		// Emit the minimum prelude.
		if state.CreatedAt == 0 {
			state.CreatedAt = time.Now().Unix()
		}
		if state.ResponseID == "" {
			state.ResponseID = "resp_error"
		}
		envelope := buildResponseEnvelope(state, "failed")
		_ = emitEvent(state, "response.created", map[string]any{"response": envelope})
		state.Started = true
	}
	events := []ResponsesAPIEvent{
		emitEvent(state, "response.failed", map[string]any{
			"response": map[string]any{
				"id":     state.ResponseID,
				"status": "failed",
				"error":  map[string]any{"message": message},
			},
		}),
	}
	// response.failed is terminal — mark the stream as completed so any
	// subsequent flushOnEOS is a no-op and we never emit both response.failed
	// and response.completed on the same stream.
	state.CompletedSent = true
	return events
}

func handleTextDeltaWithInlineThink(state *ResponsesStreamState, text string) []ResponsesAPIEvent {
	events := make([]ResponsesAPIEvent, 0, 2)
	for text != "" {
		if state.InThinkInlineTag {
			// Looking for </think>.
			if idx := strings.Index(text, "</think>"); idx >= 0 {
				inside := text[:idx]
				rest := text[idx+len("</think>"):]
				if inside != "" {
					events = append(events, ensureReasoningOpen(state)...)
					events = append(events, emitEvent(state, "response.reasoning_summary_text.delta", map[string]any{
						"item_id":       state.ResponseID,
						"output_index":  state.ReasoningItemIndex,
						"summary_index": 0,
						"delta":         inside,
					}))
				}
				// Close reasoning.
				events = append(events, closeReasoningIfOpen(state)...)
				state.InThinkInlineTag = false
				text = rest
				continue
			}
			// All remaining text is reasoning.
			events = append(events, ensureReasoningOpen(state)...)
			events = append(events, emitEvent(state, "response.reasoning_summary_text.delta", map[string]any{
				"item_id":       state.ResponseID,
				"output_index":  state.ReasoningItemIndex,
				"summary_index": 0,
				"delta":         text,
			}))
			return events
		}

		// Not in think tag.
		if idx := strings.Index(text, "<think>"); idx >= 0 {
			before := text[:idx]
			rest := text[idx+len("<think>"):]
			if before != "" {
				events = append(events, closeReasoningIfOpen(state)...)
				events = append(events, ensureMessageOpen(state)...)
				events = append(events, emitEvent(state, "response.output_text.delta", map[string]any{
					"item_id":       state.ResponseID,
					"output_index":  state.MessageItemIndex,
					"content_index": 0,
					"delta":         before,
				}))
			}
			// Open reasoning.
			events = append(events, closeMessageIfOpen(state)...)
			state.InThinkInlineTag = true
			text = rest
			continue
		}

		// No tag; plain text.
		events = append(events, closeReasoningIfOpen(state)...)
		events = append(events, ensureMessageOpen(state)...)
		events = append(events, emitEvent(state, "response.output_text.delta", map[string]any{
			"item_id":       state.ResponseID,
			"output_index":  state.MessageItemIndex,
			"content_index": 0,
			"delta":         text,
		}))
		return events
	}
	return events
}

func handleToolCallDelta(state *ResponsesStreamState, tc dto.ToolCallResponse) []ResponsesAPIEvent {
	events := make([]ResponsesAPIEvent, 0, 2)

	idx := 0
	if tc.Index != nil {
		idx = *tc.Index
	}
	fc, ok := state.FuncCalls[idx]
	if !ok {
		fc = &ResponsesStreamFuncCall{
			ID:        tc.ID,
			Name:      tc.Function.Name,
			ItemIndex: nextItemIndex(state),
		}
		state.FuncCalls[idx] = fc

		// Close any open text/reasoning before opening function_call.
		events = append(events, closeMessageIfOpen(state)...)
		events = append(events, closeReasoningIfOpen(state)...)

		callID := fc.ID
		if callID == "" {
			callID = tc.ID
			fc.ID = tc.ID
		}
		events = append(events, emitEvent(state, "response.output_item.added", map[string]any{
			"output_index": fc.ItemIndex,
			"item": map[string]any{
				"type":      "function_call",
				"call_id":   callID,
				"name":      fc.Name,
				"arguments": "",
			},
		}))
	} else {
		// Update ID/name if the chunk carries new info.
		if tc.ID != "" && fc.ID == "" {
			fc.ID = tc.ID
		}
		if tc.Function.Name != "" && fc.Name == "" {
			fc.Name = tc.Function.Name
		}
	}

	// Argument deltas.
	if tc.Function.Arguments != "" {
		fc.ArgsBuf += tc.Function.Arguments
		events = append(events, emitEvent(state, "response.function_call_arguments.delta", map[string]any{
			"item_id":      fc.ID,
			"output_index": fc.ItemIndex,
			"delta":        tc.Function.Arguments,
		}))
	}
	return events
}

func ensureMessageOpen(state *ResponsesStreamState) []ResponsesAPIEvent {
	if state.MessageItemOpen {
		return nil
	}
	events := make([]ResponsesAPIEvent, 0, 2)
	state.MessageItemIndex = nextItemIndex(state)
	state.MessageItemOpen = true
	state.MessageContentPartOpen = true
	events = append(events, emitEvent(state, "response.output_item.added", map[string]any{
		"output_index": state.MessageItemIndex,
		"item": map[string]any{
			"type":    "message",
			"role":    "assistant",
			"content": []any{},
		},
	}))
	events = append(events, emitEvent(state, "response.content_part.added", map[string]any{
		"item_id":       state.ResponseID,
		"output_index":  state.MessageItemIndex,
		"content_index": 0,
		"part": map[string]any{
			"type": "output_text",
			"text": "",
		},
	}))
	return events
}

func closeMessageIfOpen(state *ResponsesStreamState) []ResponsesAPIEvent {
	if !state.MessageItemOpen {
		return nil
	}
	events := make([]ResponsesAPIEvent, 0, 3)
	events = append(events, emitEvent(state, "response.output_text.done", map[string]any{
		"item_id":       state.ResponseID,
		"output_index":  state.MessageItemIndex,
		"content_index": 0,
	}))
	events = append(events, emitEvent(state, "response.content_part.done", map[string]any{
		"item_id":       state.ResponseID,
		"output_index":  state.MessageItemIndex,
		"content_index": 0,
	}))
	events = append(events, emitEvent(state, "response.output_item.done", map[string]any{
		"output_index": state.MessageItemIndex,
		"item": map[string]any{
			"type": "message",
			"role": "assistant",
		},
	}))
	state.MessageItemOpen = false
	state.MessageContentPartOpen = false
	return events
}

func ensureReasoningOpen(state *ResponsesStreamState) []ResponsesAPIEvent {
	if state.ReasoningItemOpen {
		return nil
	}
	events := make([]ResponsesAPIEvent, 0, 2)
	state.ReasoningItemIndex = nextItemIndex(state)
	state.ReasoningItemOpen = true
	state.ReasoningSummaryPartOpen = true
	events = append(events, emitEvent(state, "response.output_item.added", map[string]any{
		"output_index": state.ReasoningItemIndex,
		"item": map[string]any{
			"type":    "reasoning",
			"summary": []any{},
		},
	}))
	events = append(events, emitEvent(state, "response.reasoning_summary_part.added", map[string]any{
		"item_id":       state.ResponseID,
		"output_index":  state.ReasoningItemIndex,
		"summary_index": 0,
		"part": map[string]any{
			"type": "summary_text",
			"text": "",
		},
	}))
	return events
}

func closeReasoningIfOpen(state *ResponsesStreamState) []ResponsesAPIEvent {
	if !state.ReasoningItemOpen {
		return nil
	}
	events := make([]ResponsesAPIEvent, 0, 3)
	events = append(events, emitEvent(state, "response.reasoning_summary_text.done", map[string]any{
		"item_id":       state.ResponseID,
		"output_index":  state.ReasoningItemIndex,
		"summary_index": 0,
	}))
	events = append(events, emitEvent(state, "response.reasoning_summary_part.done", map[string]any{
		"item_id":       state.ResponseID,
		"output_index":  state.ReasoningItemIndex,
		"summary_index": 0,
	}))
	events = append(events, emitEvent(state, "response.output_item.done", map[string]any{
		"output_index": state.ReasoningItemIndex,
		"item": map[string]any{
			"type": "reasoning",
		},
	}))
	state.ReasoningItemOpen = false
	state.ReasoningSummaryPartOpen = false
	return events
}

func closeAllOpenFunctionCalls(state *ResponsesStreamState) []ResponsesAPIEvent {
	events := make([]ResponsesAPIEvent, 0)
	for _, fc := range state.FuncCalls {
		if fc.Done {
			continue
		}
		args := fc.ArgsBuf
		if strings.TrimSpace(args) == "" {
			args = "{}"
		}
		events = append(events, emitEvent(state, "response.function_call_arguments.done", map[string]any{
			"item_id":      fc.ID,
			"output_index": fc.ItemIndex,
			"arguments":    args,
		}))
		events = append(events, emitEvent(state, "response.output_item.done", map[string]any{
			"output_index": fc.ItemIndex,
			"item": map[string]any{
				"type":      "function_call",
				"call_id":   fc.ID,
				"name":      fc.Name,
				"arguments": args,
			},
		}))
		fc.Done = true
	}
	return events
}

func nextItemIndex(state *ResponsesStreamState) int {
	idx := state.ItemIndex
	state.ItemIndex++
	return idx
}

func flushOnEOS(state *ResponsesStreamState) []ResponsesAPIEvent {
	if state.CompletedSent {
		return nil
	}
	events := make([]ResponsesAPIEvent, 0, 6)

	// If we never started, emit the prelude before anything else so the wire
	// still has a well-formed sequence.
	if !state.Started {
		if state.CreatedAt == 0 {
			state.CreatedAt = time.Now().Unix()
		}
		if state.ResponseID == "" {
			state.ResponseID = "resp_chat"
		}
		envelope := buildResponseEnvelope(state, "in_progress")
		events = append(events, emitEvent(state, "response.created", map[string]any{"response": envelope}))
		events = append(events, emitEvent(state, "response.in_progress", map[string]any{"response": envelope}))
		state.Started = true
		state.InProgressSent = true
	}
	// Close in deterministic order: message, reasoning (if inline-only),
	// then function_calls.
	events = append(events, closeMessageIfOpen(state)...)
	events = append(events, closeReasoningIfOpen(state)...)
	events = append(events, closeAllOpenFunctionCalls(state)...)

	envelope := buildResponseEnvelope(state, "completed")
	// Attach usage.
	envelope["usage"] = buildResponsesUsage(state)
	events = append(events, emitEvent(state, "response.completed", map[string]any{
		"response": envelope,
	}))
	state.CompletedSent = true
	return events
}

func buildResponseEnvelope(state *ResponsesStreamState, status string) map[string]any {
	return map[string]any{
		"id":         state.ResponseID,
		"object":     "response",
		"created_at": state.CreatedAt,
		"model":      state.Model,
		"status":     status,
		"output":     []any{},
	}
}

func buildResponsesUsage(state *ResponsesStreamState) map[string]any {
	if state.Usage == nil {
		return map[string]any{
			"input_tokens":  0,
			"output_tokens": 0,
			"total_tokens":  0,
		}
	}
	cached := state.Usage.CachedTokens
	cacheCreation := state.Usage.CacheCreationTokens
	input := state.Usage.PromptTokens - cached - cacheCreation
	if input < 0 {
		input = 0
	}
	u := map[string]any{
		"input_tokens":  input,
		"output_tokens": state.Usage.CompletionTokens,
		"total_tokens":  state.Usage.PromptTokens + state.Usage.CompletionTokens,
	}
	if cached > 0 || cacheCreation > 0 {
		details := map[string]any{}
		if cached > 0 {
			details["cached_tokens"] = cached
		}
		if cacheCreation > 0 {
			details["cache_creation_tokens"] = cacheCreation
		}
		u["input_tokens_details"] = details
	}
	if state.Usage.ReasoningTokens > 0 {
		u["output_tokens_details"] = map[string]any{
			"reasoning_tokens": state.Usage.ReasoningTokens,
		}
	}
	return u
}
