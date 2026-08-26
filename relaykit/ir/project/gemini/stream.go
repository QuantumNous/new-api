package gemini

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/internal/jsonx"
)

func FromStream(resp *dto.GeminiChatResponse, state *ir.StreamState) ([]ir.Event, error) {
	if resp == nil {
		return nil, fmt.Errorf("gemini stream chunk is nil")
	}
	if state == nil {
		state = ir.NewStreamState("", "")
	}
	events := make([]ir.Event, 0, 4)
	if ev := state.StartEvent(state.ID, state.Model); ev != nil {
		events = append(events, *ev)
	}
	var text, think strings.Builder
	toolCount := 0
	var finish string
	for _, candidate := range resp.Candidates {
		if candidate.FinishReason != nil {
			finish = *candidate.FinishReason
		}
		for _, part := range candidate.Content.Parts {
			if part.Thought {
				think.WriteString(part.Text)
				continue
			}
			if part.FunctionCall != nil {
				toolCount++
				if toolCount > state.GeminiToolCount {
					idx, opened := state.EnsureTool(toolCount-1, "", part.FunctionCall.FunctionName)
					events = append(events, opened...)
					args := marshalArgs(part.FunctionCall.Arguments)
					if args != "" {
						events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{JSON: args}})
					}
				}
				continue
			}
			text.WriteString(part.Text)
		}
	}
	if delta := suffixDelta(state.GeminiThink, think.String()); delta != "" {
		idx, opened := state.EnsureBlock(ir.BlockKindThink)
		events = append(events, opened...)
		events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: delta}})
		state.GeminiThink = think.String()
	}
	if delta := suffixDelta(state.GeminiText, text.String()); delta != "" {
		idx, opened := state.EnsureBlock(ir.BlockKindText)
		events = append(events, opened...)
		events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: delta}})
		state.GeminiText = text.String()
	}
	if toolCount > state.GeminiToolCount {
		state.GeminiToolCount = toolCount
	}
	if meta := resp.GetUsageMetadata(); meta != nil && (meta.TotalTokenCount > 0 || meta.PromptTokenCount > 0) {
		state.SetUsage(ir.Usage{
			Input:   meta.PromptTokenCount,
			Output:  meta.CandidatesTokenCount + meta.ThoughtsTokenCount,
			Thought: meta.ThoughtsTokenCount,
		})
	}
	if finish != "" {
		finishKind := ir.FinishFromGemini(finish)
		if (toolCount > 0 || state.GeminiToolCount > 0) && finishKind == ir.FinishStop {
			finishKind = ir.FinishTool
		}
		state.SetFinish(finishKind, "")
	}
	if finish != "" || state.Finish != "" {
		events = append(events, state.TerminalEvents()...)
	}
	return events, nil
}

func ToStream(events []ir.Event, state *ir.StreamState) ([]any, error) {
	if state == nil {
		state = ir.NewStreamState("", "")
	}
	resp := &dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{{
			Content:       dto.GeminiChatContent{Role: "model"},
			SafetyRatings: []dto.GeminiChatSafetyRating{},
		}},
	}
	parts := make([]dto.GeminiPart, 0)
	hasFinish := false
	for _, event := range events {
		switch event.Kind {
		case ir.EventBlockStart:
			if event.Block == nil {
				continue
			}
			switch event.Block.Kind {
			case ir.BlockKindThink:
				text := ""
				if event.Block.Think != nil {
					text = event.Block.Think.Text
				}
				if text != "" {
					parts = append(parts, dto.GeminiPart{Text: text, Thought: true})
				}
			case ir.BlockKindText:
				text := ""
				if event.Block.Text != nil {
					text = event.Block.Text.Text
				}
				if text != "" {
					parts = append(parts, dto.GeminiPart{Text: text})
				}
			case ir.BlockKindToolUse:
				if event.Block.ToolUse != nil {
					state.OpenName = event.Block.ToolUse.Name
					if jsonx.Present(event.Block.ToolUse.Input) {
						parts = append(parts, dto.GeminiPart{
							FunctionCall: &dto.FunctionCall{
								FunctionName: event.Block.ToolUse.Name,
								Arguments:    jsonRaw(string(event.Block.ToolUse.Input)),
							},
						})
					}
				}
			}
		case ir.EventBlockDelta:
			if event.Delta == nil {
				continue
			}
			if event.Delta.JSON != "" {
				name := state.OpenName
				if name == "" && event.Block != nil && event.Block.ToolUse != nil {
					name = event.Block.ToolUse.Name
				}
				parts = append(parts, dto.GeminiPart{
					FunctionCall: &dto.FunctionCall{
						FunctionName: name,
						Arguments:    jsonRaw(event.Delta.JSON),
					},
				})
				continue
			}
			if event.Delta.Text == "" {
				continue
			}
			part := dto.GeminiPart{Text: event.Delta.Text}
			if state.KindOf(event.Index) == ir.BlockKindThink {
				part.Thought = true
			}
			parts = append(parts, part)
		case ir.EventFinish:
			reason := "STOP"
			if event.Finish != nil {
				switch *event.Finish {
				case ir.FinishLength:
					reason = "MAX_TOKENS"
				case ir.FinishFilter:
					reason = "SAFETY"
				}
			}
			if state.ProviderFinish != "" {
				reason = state.ProviderFinish
			}
			resp.Candidates[0].FinishReason = &reason
			hasFinish = true
		case ir.EventUsage:
			if event.Usage != nil {
				resp.UsageMetadata = dto.GeminiUsageMetadata{
					PromptTokenCount:     event.Usage.Input,
					CandidatesTokenCount: event.Usage.Output - event.Usage.Thought,
					ThoughtsTokenCount:   event.Usage.Thought,
					TotalTokenCount:      event.Usage.Input + event.Usage.Output,
				}
				resp.HasUsageMetadata = true
			}
		}
	}
	resp.Candidates[0].Content.Parts = parts
	if len(parts) == 0 && !hasFinish && !resp.HasUsageMetadata {
		return nil, nil
	}
	return []any{resp}, nil
}

func suffixDelta(prev, next string) string {
	if next == "" {
		return ""
	}
	if prev == "" {
		return next
	}
	if strings.HasPrefix(next, prev) {
		return next[len(prev):]
	}
	return next
}

func jsonRaw(s string) any {
	if s == "" {
		return nil
	}
	var value any
	if err := json.Unmarshal([]byte(s), &value); err == nil {
		return value
	}
	return s
}

func marshalArgs(value any) string {
	if value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	case []byte:
		return string(typed)
	default:
		raw, err := json.Marshal(typed)
		if err != nil {
			return ""
		}
		return string(raw)
	}
}
