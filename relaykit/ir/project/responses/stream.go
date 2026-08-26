package responses

import (
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
)

func FromStream(event *dto.ResponsesStreamResponse, state *ir.StreamState) ([]ir.Event, error) {
	if event == nil {
		return nil, fmt.Errorf("responses stream event is nil")
	}
	if state == nil {
		state = ir.NewStreamState("", "")
	}
	events := make([]ir.Event, 0, 3)
	id, model := "", ""
	if event.Response != nil {
		id = event.Response.ID
		model = event.Response.Model
	}
	if ev := state.StartEvent(firstNonEmpty(id, state.ID), firstNonEmpty(model, state.Model)); ev != nil {
		events = append(events, *ev)
	}
	switch event.Type {
	case "response.created":
		return events, nil
	case "response.output_text.delta":
		idx, opened := state.EnsureBlock(ir.BlockKindText)
		events = append(events, opened...)
		events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: event.Delta}})
		return events, nil
	case "response.reasoning_summary_text.delta":
		if event.Delta == "" {
			return events, nil
		}
		idx, opened := state.EnsureBlock(ir.BlockKindThink)
		events = append(events, opened...)
		events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: event.Delta}})
		state.ResponsesSummarySeen = true
		return events, nil
	case "response.output_item.added":
		if event.Item == nil || event.Item.Type != "function_call" {
			return events, nil
		}
		chatIdx := 0
		if event.OutputIndex != nil {
			chatIdx = *event.OutputIndex
		}
		_, opened := state.EnsureTool(chatIdx, firstNonEmpty(event.Item.CallId, event.Item.ID), event.Item.Name)
		return append(events, opened...), nil
	case "response.function_call_arguments.delta":
		chatIdx := 0
		if event.OutputIndex != nil {
			chatIdx = *event.OutputIndex
		}
		idx, opened := state.EnsureTool(chatIdx, event.ItemID, "")
		events = append(events, opened...)
		events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{JSON: event.Delta}})
		return events, nil
	case "response.completed", "response.done", "response.incomplete":
		if event.Response != nil {
			if event.Response.Usage != nil {
				state.SetUsage(ir.Usage{
					Input:   event.Response.Usage.InputTokens,
					Output:  event.Response.Usage.OutputTokens,
					Thought: event.Response.Usage.CompletionTokenDetails.ReasoningTokens,
				})
			}
			if !state.ResponsesSummarySeen {
				events = append(events, summaryEventsFromOutput(state, event.Response.Output)...)
			}
		}
		finish := ir.FinishStop
		if event.Type == "response.incomplete" {
			finish = ir.FinishLength
		}
		state.SetFinish(finish, "")
		return events, nil
	default:
		return events, nil
	}
}

func ToStream(events []ir.Event, state *ir.StreamState) ([]any, error) {
	if state == nil {
		state = ir.NewStreamState("", "")
	}
	out := make([]any, 0, len(events)+4)
	for _, event := range events {
		switch event.Kind {
		case ir.EventStart:
			if state.ResponsesCreated {
				continue
			}
			state.ResponsesCreated = true
			if event.ID != "" {
				state.ID = event.ID
			}
			if event.Model != "" {
				state.Model = event.Model
			}
			out = append(out, dto.ResponsesStreamResponse{
				Type: "response.created",
				Response: &dto.OpenAIResponsesResponse{
					ID:     firstNonEmpty(event.ID, state.ID),
					Object: "response",
					Model:  firstNonEmpty(event.Model, state.Model),
					Status: []byte(`"in_progress"`),
				},
			})
		case ir.EventBlockStart:
			kind := ir.BlockKindText
			if event.Block != nil {
				kind = event.Block.Kind
			}
			out = append(out, ensureResponsesItem(state, event.Index, kind, event.Block)...)
		case ir.EventBlockDelta:
			if event.Delta == nil {
				continue
			}
			kind := state.KindOf(event.Index)
			if kind == "" && event.Delta.JSON != "" {
				kind = ir.BlockKindToolUse
			}
			if kind == "" {
				kind = ir.BlockKindText
			}
			out = append(out, ensureResponsesItem(state, event.Index, kind, event.Block)...)
			idx := event.Index
			itemID := responsesStreamItemID(state, idx, kind, event.Block)
			if event.Delta.JSON != "" {
				out = append(out, dto.ResponsesStreamResponse{
					Type:        "response.function_call_arguments.delta",
					OutputIndex: &idx,
					ItemID:      itemID,
					Delta:       event.Delta.JSON,
				})
				continue
			}
			if event.Delta.Text == "" {
				continue
			}
			typ := "response.output_text.delta"
			if kind == ir.BlockKindThink {
				typ = "response.reasoning_summary_text.delta"
			}
			out = append(out, dto.ResponsesStreamResponse{
				Type:        typ,
				OutputIndex: &idx,
				ItemID:      itemID,
				Delta:       event.Delta.Text,
			})
		case ir.EventUsage:
			for idx := 0; idx < state.NextIndex; idx++ {
				kind := state.KindOf(idx)
				itemID := responsesStreamItemID(state, idx, kind, nil)
				i := idx
				switch kind {
				case ir.BlockKindText:
					out = append(out, dto.ResponsesStreamResponse{
						Type:        "response.output_text.done",
						OutputIndex: &i,
						ItemID:      itemID,
					})
				case ir.BlockKindToolUse:
					out = append(out, dto.ResponsesStreamResponse{
						Type:        "response.function_call_arguments.done",
						OutputIndex: &i,
						ItemID:      itemID,
					})
				}
			}
			resp := &dto.OpenAIResponsesResponse{
				ID:     state.ID,
				Object: "response",
				Model:  state.Model,
				Status: []byte(`"completed"`),
			}
			if event.Usage != nil {
				resp.Usage = &dto.Usage{
					InputTokens:  event.Usage.Input,
					OutputTokens: event.Usage.Output,
					TotalTokens:  event.Usage.Input + event.Usage.Output,
				}
			}
			out = append(out, dto.ResponsesStreamResponse{
				Type:     "response.completed",
				Response: resp,
			})
		}
	}
	return out, nil
}

func ensureResponsesItem(state *ir.StreamState, index int, kind ir.BlockKind, block *ir.Block) []any {
	if state.ResponsesItemAdded == nil {
		state.ResponsesItemAdded = map[int]bool{}
	}
	if state.ResponsesItemAdded[index] {
		return nil
	}
	itemID := responsesStreamItemID(state, index, kind, block)
	state.ResponsesItemAdded[index] = true
	idx := index
	item := &dto.ResponsesOutput{ID: itemID, Status: "in_progress"}
	switch kind {
	case ir.BlockKindThink:
		item.Type = "reasoning"
	case ir.BlockKindToolUse:
		item.Type = "function_call"
		callID := itemID
		name := ""
		if block != nil && block.ToolUse != nil {
			if block.ToolUse.ID != "" {
				callID = block.ToolUse.ID
			}
			name = block.ToolUse.Name
		}
		if name == "" {
			name = state.OpenName
		}
		item.Name = name
		item.CallId = callID
		item.ID = responsesFunctionItemID(callID)
		if state.ResponsesItemID == nil {
			state.ResponsesItemID = map[int]string{}
		}
		state.ResponsesItemID[index] = item.ID
	default:
		item.Type = "message"
		item.Role = "assistant"
		state.ResponsesTextOpen = true
	}
	return []any{dto.ResponsesStreamResponse{
		Type:        "response.output_item.added",
		OutputIndex: &idx,
		ItemID:      item.ID,
		Item:        item,
	}}
}

func responsesStreamItemID(state *ir.StreamState, index int, kind ir.BlockKind, block *ir.Block) string {
	if state.ResponsesItemID == nil {
		state.ResponsesItemID = map[int]string{}
	}
	if id := state.ResponsesItemID[index]; id != "" {
		return id
	}
	prefix := "msg"
	switch kind {
	case ir.BlockKindThink:
		prefix = "rs"
	case ir.BlockKindToolUse:
		prefix = "fc"
		if block != nil && block.ToolUse != nil && block.ToolUse.ID != "" {
			id := responsesFunctionItemID(block.ToolUse.ID)
			state.ResponsesItemID[index] = id
			return id
		}
	}
	id := responsesOutputID(state.ID, prefix, index)
	state.ResponsesItemID[index] = id
	return id
}

func summaryEventsFromOutput(state *ir.StreamState, output []dto.ResponsesOutput) []ir.Event {
	var events []ir.Event
	for _, item := range output {
		if item.Type != "reasoning" {
			continue
		}
		text := reasoningSummaryText(item)
		if text == "" {
			continue
		}
		idx, opened := state.EnsureBlock(ir.BlockKindThink)
		events = append(events, opened...)
		events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: text}})
		state.ResponsesSummarySeen = true
	}
	return events
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
