package claude

import (
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
)

func ptr[T any](v T) *T { return &v }

func FromStream(resp *dto.ClaudeResponse, state *ir.StreamState) ([]ir.Event, error) {
	if resp == nil {
		return nil, fmt.Errorf("claude stream event is nil")
	}
	if state == nil {
		state = ir.NewStreamState("", "")
	}
	switch resp.Type {
	case "message_start":
		id, model := "", ""
		if resp.Message != nil {
			id = resp.Message.Id
			model = resp.Message.Model
			if resp.Message.Usage != nil {
				state.SetUsage(ir.Usage{
					Input:  resp.Message.Usage.InputTokens,
					Output: resp.Message.Usage.OutputTokens,
				})
			}
		}
		if ev := state.StartEvent(id, model); ev != nil {
			return []ir.Event{*ev}, nil
		}
		return nil, nil
	case "content_block_start":
		if resp.ContentBlock == nil {
			return nil, nil
		}
		kind := ir.BlockKindText
		id, name := resp.ContentBlock.Id, resp.ContentBlock.Name
		switch resp.ContentBlock.Type {
		case "thinking", "redacted_thinking":
			kind = ir.BlockKindThink
		case "tool_use":
			kind = ir.BlockKindToolUse
		}
		index := 0
		if resp.Index != nil {
			index = *resp.Index
		}
		if kind == ir.BlockKindToolUse {
			idx, events := state.EnsureTool(index, id, name)
			_ = idx
			return events, nil
		}
		_, events := state.EnsureBlock(kind)
		return events, nil
	case "content_block_delta":
		if resp.Delta == nil {
			return nil, nil
		}
		index := state.OpenIndex
		if resp.Index != nil {
			index = *resp.Index
		}
		delta := &ir.BlockDelta{}
		switch resp.Delta.Type {
		case "thinking_delta":
			if resp.Delta.Thinking != nil {
				delta.Text = *resp.Delta.Thinking
			}
		case "input_json_delta":
			if resp.Delta.PartialJson != nil {
				delta.JSON = *resp.Delta.PartialJson
			}
		case "signature_delta":
			if resp.Delta.Thinking != nil {
				delta.Signature = *resp.Delta.Thinking
			}
		default:
			if resp.Delta.Text != nil {
				delta.Text = *resp.Delta.Text
			}
		}
		return []ir.Event{{Kind: ir.EventBlockDelta, Index: index, Delta: delta}}, nil
	case "content_block_stop":
		return state.StopOpen(), nil
	case "message_delta":
		if resp.Delta != nil && resp.Delta.StopReason != nil {
			state.SetFinish(ir.FinishFromClaude(*resp.Delta.StopReason), *resp.Delta.StopReason)
		}
		if resp.Usage != nil {
			state.SetUsage(ir.Usage{
				Input:  resp.Usage.InputTokens,
				Output: resp.Usage.OutputTokens,
			})
		}
		return state.TerminalEvents(), nil
	case "message_stop":
		if !state.TerminalSent {
			return state.TerminalEvents(), nil
		}
		return nil, nil
	default:
		return nil, nil
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
			msg := &dto.ClaudeMediaMessage{
				Id:    firstNonEmpty(event.ID, state.ID),
				Model: firstNonEmpty(event.Model, state.Model),
				Type:  "message",
				Role:  "assistant",
				Usage: &dto.ClaudeUsage{InputTokens: state.Usage.Input},
			}
			msg.SetContent(make([]any, 0))
			out = append(out, &dto.ClaudeResponse{Type: "message_start", Message: msg})
		case ir.EventBlockStart:
			index := event.Index
			resp := &dto.ClaudeResponse{Type: "content_block_start", Index: &index}
			block := &dto.ClaudeMediaMessage{Type: "text", Text: ptr("")}
			if event.Block != nil {
				switch event.Block.Kind {
				case ir.BlockKindThink:
					block = &dto.ClaudeMediaMessage{Type: "thinking", Thinking: ptr("")}
				case ir.BlockKindToolUse:
					name, id := "", ""
					if event.Block.ToolUse != nil {
						name = event.Block.ToolUse.Name
						id = event.Block.ToolUse.ID
					}
					block = &dto.ClaudeMediaMessage{
						Id:    id,
						Type:  "tool_use",
						Name:  name,
						Input: map[string]any{},
					}
				}
			}
			resp.ContentBlock = block
			out = append(out, resp)
		case ir.EventBlockDelta:
			if event.Delta == nil {
				continue
			}
			index := event.Index
			delta := &dto.ClaudeMediaMessage{Type: "text_delta"}
			if event.Delta.JSON != "" {
				delta.Type = "input_json_delta"
				delta.PartialJson = ptr(event.Delta.JSON)
			} else if event.Delta.Signature != "" {
				delta.Type = "signature_delta"
				delta.Thinking = ptr(event.Delta.Signature)
			} else if state.BlockKinds[event.Index] == ir.BlockKindThink {
				delta.Type = "thinking_delta"
				delta.Thinking = ptr(event.Delta.Text)
			} else {
				delta.Text = ptr(event.Delta.Text)
			}
			out = append(out, &dto.ClaudeResponse{Type: "content_block_delta", Index: &index, Delta: delta})
		case ir.EventBlockStop:
			index := event.Index
			out = append(out, &dto.ClaudeResponse{Type: "content_block_stop", Index: &index})
		case ir.EventFinish:
			// Stop reason is applied with usage so split Gemini usage chunks still map.
		case ir.EventUsage:
			usage := &dto.ClaudeUsage{}
			if event.Usage != nil {
				usage.InputTokens = event.Usage.Input
				usage.OutputTokens = event.Usage.Output
			}
			stop := state.Finish.ToClaudeStopReason()
			if stop == "" {
				stop = "end_turn"
			}
			out = append(out, &dto.ClaudeResponse{
				Type:  "message_delta",
				Usage: usage,
				Delta: &dto.ClaudeMediaMessage{StopReason: ptr(stop)},
			})
			out = append(out, &dto.ClaudeResponse{Type: "message_stop"})
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
