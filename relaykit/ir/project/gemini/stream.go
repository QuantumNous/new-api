package gemini

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
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
					rememberGeminiTool(state, event.Index, event.Block.ToolUse.Name, string(event.Block.ToolUse.Input))
					if part := emitGeminiToolIfReady(state, event.Index, false); part != nil {
						parts = append(parts, *part)
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
				rememberGeminiTool(state, event.Index, name, event.Delta.JSON)
				if part := emitGeminiToolIfReady(state, event.Index, false); part != nil {
					parts = append(parts, *part)
				}
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
		case ir.EventBlockStop:
			if part := emitGeminiToolIfReady(state, event.Index, true); part != nil {
				parts = append(parts, *part)
			}
		case ir.EventFinish:
			parts = append(parts, flushGeminiTools(state)...)
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

func rememberGeminiTool(state *ir.StreamState, index int, name, fragment string) {
	if state == nil {
		return
	}
	if state.GeminiToolName == nil {
		state.GeminiToolName = map[int]string{}
	}
	if state.GeminiToolJSON == nil {
		state.GeminiToolJSON = map[int]string{}
	}
	if name != "" {
		state.GeminiToolName[index] = name
		state.OpenName = name
	}
	if fragment != "" {
		state.GeminiToolJSON[index] += fragment
	}
}

func emitGeminiToolIfReady(state *ir.StreamState, index int, force bool) *dto.GeminiPart {
	if state == nil {
		return nil
	}
	if state.GeminiToolEmitted != nil && state.GeminiToolEmitted[index] {
		return nil
	}
	raw := ""
	if state.GeminiToolJSON != nil {
		raw = state.GeminiToolJSON[index]
	}
	name := ""
	if state.GeminiToolName != nil {
		name = state.GeminiToolName[index]
	}
	if name == "" {
		name = state.OpenName
	}
	args, ok := parseGeminiToolArgs(raw)
	if !ok && !force {
		return nil
	}
	if name == "" {
		return nil
	}
	if !ok {
		args = map[string]any{}
	}
	if state.GeminiToolEmitted == nil {
		state.GeminiToolEmitted = map[int]bool{}
	}
	state.GeminiToolEmitted[index] = true
	return &dto.GeminiPart{
		FunctionCall: &dto.FunctionCall{
			FunctionName: name,
			Arguments:    args,
		},
	}
}

func flushGeminiTools(state *ir.StreamState) []dto.GeminiPart {
	if state == nil || state.GeminiToolJSON == nil {
		return nil
	}
	indexes := make([]int, 0, len(state.GeminiToolJSON)+len(state.GeminiToolName))
	seen := map[int]struct{}{}
	for idx := range state.GeminiToolJSON {
		indexes = append(indexes, idx)
		seen[idx] = struct{}{}
	}
	for idx := range state.GeminiToolName {
		if _, ok := seen[idx]; ok {
			continue
		}
		indexes = append(indexes, idx)
	}
	sort.Ints(indexes)
	parts := make([]dto.GeminiPart, 0, len(indexes))
	for _, idx := range indexes {
		if part := emitGeminiToolIfReady(state, idx, true); part != nil {
			parts = append(parts, *part)
		}
	}
	return parts
}

func parseGeminiToolArgs(raw string) (any, bool) {
	if strings.TrimSpace(raw) == "" {
		return map[string]any{}, false
	}
	var value any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return nil, false
	}
	switch value.(type) {
	case map[string]any, []any:
		return value, true
	default:
		return nil, false
	}
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
