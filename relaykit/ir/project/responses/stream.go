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
	case "response.reasoning_summary_text.delta", "response.reasoning_text.delta":
		idx, opened := state.EnsureBlock(ir.BlockKindThink)
		events = append(events, opened...)
		events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: event.Delta}})
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
		if event.Response != nil && event.Response.Usage != nil {
			state.SetUsage(ir.Usage{
				Input:  event.Response.Usage.InputTokens,
				Output: event.Response.Usage.OutputTokens,
			})
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
	out := make([]any, 0, len(events)+2)
	for _, event := range events {
		switch event.Kind {
		case ir.EventStart:
			if state.ResponsesCreated {
				continue
			}
			state.ResponsesCreated = true
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
			if event.Block != nil && event.Block.Kind == ir.BlockKindText && !state.ResponsesTextOpen {
				state.ResponsesTextOpen = true
				idx := event.Index
				out = append(out, dto.ResponsesStreamResponse{
					Type:        "response.output_item.added",
					OutputIndex: &idx,
					Item: &dto.ResponsesOutput{
						Type:   "message",
						ID:     firstNonEmpty(event.ID, state.ID) + "_msg",
						Status: "in_progress",
						Role:   "assistant",
					},
				})
			}
			if event.Block != nil && event.Block.Kind == ir.BlockKindToolUse {
				idx := event.Index
				name, id := "", ""
				if event.Block.ToolUse != nil {
					name = event.Block.ToolUse.Name
					id = event.Block.ToolUse.ID
				}
				out = append(out, dto.ResponsesStreamResponse{
					Type:        "response.output_item.added",
					OutputIndex: &idx,
					Item: &dto.ResponsesOutput{
						Type:   "function_call",
						ID:     id,
						CallId: id,
						Name:   name,
						Status: "in_progress",
					},
				})
			}
		case ir.EventBlockDelta:
			if event.Delta == nil {
				continue
			}
			idx := event.Index
			if event.Delta.JSON != "" {
				out = append(out, dto.ResponsesStreamResponse{
					Type:        "response.function_call_arguments.delta",
					OutputIndex: &idx,
					Delta:       event.Delta.JSON,
				})
				continue
			}
			if event.Delta.Text == "" {
				continue
			}
			typ := "response.output_text.delta"
			if state.BlockKinds[event.Index] == ir.BlockKindThink {
				typ = "response.reasoning_summary_text.delta"
			}
			out = append(out, dto.ResponsesStreamResponse{
				Type:        typ,
				OutputIndex: &idx,
				Delta:       event.Delta.Text,
			})
		case ir.EventUsage:
			if state.ResponsesTextOpen {
				idx := 0
				out = append(out, dto.ResponsesStreamResponse{
					Type:        "response.output_text.done",
					OutputIndex: &idx,
				})
			}
			for chatIdx, irIdx := range state.ToolIndex {
				_ = chatIdx
				idx := irIdx
				out = append(out, dto.ResponsesStreamResponse{
					Type:        "response.function_call_arguments.done",
					OutputIndex: &idx,
				})
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
