package chat

import (
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
)

func FromStream(chunk *dto.ChatCompletionsStreamResponse, state *ir.StreamState) ([]ir.Event, error) {
	if chunk == nil {
		return nil, fmt.Errorf("chat stream chunk is nil")
	}
	if state == nil {
		state = ir.NewStreamState(chunk.Id, chunk.Model)
	}
	events := make([]ir.Event, 0, 4)
	if ev := state.StartEvent(chunk.Id, chunk.Model); ev != nil {
		events = append(events, *ev)
	}
	for _, choice := range chunk.Choices {
		if reasoning := choice.Delta.GetReasoningContent(); reasoning != "" {
			idx, opened := state.EnsureBlock(ir.BlockKindThink)
			events = append(events, opened...)
			events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: reasoning}})
		}
		if content := choice.Delta.GetContentString(); content != "" {
			idx, opened := state.EnsureBlock(ir.BlockKindText)
			events = append(events, opened...)
			events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: content}})
		}
		for _, tool := range choice.Delta.ToolCalls {
			sourceIndex, err := state.ResolveToolSourceIndex(tool.Index, tool.ID, tool.Function.Name)
			if err != nil {
				return nil, err
			}
			idx, opened := state.EnsureTool(sourceIndex, tool.ID, tool.Function.Name)
			events = append(events, opened...)
			if tool.Function.Arguments != "" || (len(opened) == 0 && (tool.ID != "" || tool.Function.Name != "")) {
				events = append(events, ir.Event{
					Kind:  ir.EventBlockDelta,
					Index: idx,
					Block: &ir.Block{Kind: ir.BlockKindToolUse, ToolUse: &ir.ToolUseBlock{ID: tool.ID, Name: tool.Function.Name}},
					Delta: &ir.BlockDelta{JSON: tool.Function.Arguments},
				})
			}
		}
		if choice.FinishReason != nil && *choice.FinishReason != "" {
			state.SetFinish(ir.FinishFromChat(*choice.FinishReason), *choice.FinishReason)
		}
	}
	if chunk.Usage != nil {
		state.SetUsage(ir.Usage{
			Input:   chunk.Usage.PromptTokens,
			Output:  chunk.Usage.CompletionTokens,
			Thought: chunk.Usage.CompletionTokenDetails.ReasoningTokens,
		})
	}
	return events, nil
}

func ToStream(events []ir.Event, state *ir.StreamState) ([]any, error) {
	if state == nil {
		state = ir.NewStreamState("", "")
	}
	out := make([]any, 0, len(events))
	for _, event := range events {
		chunk := &dto.ChatCompletionsStreamResponse{
			Id:      firstNonEmpty(event.ID, state.ID),
			Object:  "chat.completion.chunk",
			Created: state.Created,
			Model:   firstNonEmpty(event.Model, state.Model),
			Choices: []dto.ChatCompletionsStreamResponseChoice{{Index: 0}},
		}
		delta := &chunk.Choices[0].Delta
		switch event.Kind {
		case ir.EventStart:
			if state.ChatRoleSent {
				continue
			}
			state.ChatRoleSent = true
			delta.Role = "assistant"
			delta.SetContentString("")
		case ir.EventBlockStart:
			if event.Block != nil && event.Block.Kind == ir.BlockKindToolUse && event.Block.ToolUse != nil {
				idx := event.Index
				delta.ToolCalls = []dto.ToolCallResponse{{
					Index: &idx,
					ID:    event.Block.ToolUse.ID,
					Type:  "function",
					Function: dto.FunctionResponse{
						Name: event.Block.ToolUse.Name,
					},
				}}
			} else {
				continue
			}
		case ir.EventBlockDelta:
			if event.Delta == nil {
				continue
			}
			if event.Delta.Text != "" {
				if state.KindOf(event.Index) == ir.BlockKindThink {
					delta.SetReasoningContent(event.Delta.Text)
				} else {
					delta.SetContentString(event.Delta.Text)
				}
			}
			if event.Delta.JSON != "" {
				idx := event.Index
				delta.ToolCalls = []dto.ToolCallResponse{{
					Index: &idx,
					Type:  "function",
					Function: dto.FunctionResponse{
						Arguments: event.Delta.JSON,
					},
				}}
			}
			if event.Delta.Text == "" && event.Delta.JSON == "" {
				continue
			}
		case ir.EventFinish:
			reason := ""
			if event.Finish != nil {
				reason = event.Finish.ToChatFinishReason()
			}
			if reason == "" {
				reason = ir.FinishFromChat(state.ProviderFinish).ToChatFinishReason()
				if reason == "" {
					reason = ir.FinishFromGemini(state.ProviderFinish).ToChatFinishReason()
				}
			}
			if reason == "stop" && len(state.ToolIndex) > 0 {
				reason = "tool_calls"
			}
			if reason != "" {
				chunk.Choices[0].FinishReason = &reason
			}
		case ir.EventUsage:
			if event.Usage != nil {
				chunk.Usage = &dto.Usage{
					PromptTokens:     event.Usage.Input,
					CompletionTokens: event.Usage.Output,
					TotalTokens:      event.Usage.Input + event.Usage.Output,
					CompletionTokenDetails: dto.OutputTokenDetails{
						ReasoningTokens: event.Usage.Thought,
					},
				}
			}
			if len(out) > 0 {
				if prev, ok := out[len(out)-1].(*dto.ChatCompletionsStreamResponse); ok {
					prev.Usage = chunk.Usage
					continue
				}
			}
		case ir.EventBlockStop, ir.EventPing, ir.EventError:
			continue
		default:
			continue
		}
		out = append(out, chunk)
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
