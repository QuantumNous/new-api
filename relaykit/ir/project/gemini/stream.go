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
					rememberGeminiTool(state, event.Index, event.Block.ToolUse.ID, event.Block.ToolUse.Name, string(event.Block.ToolUse.Input))
				}
			}
		case ir.EventBlockDelta:
			id, name := "", ""
			if event.Block != nil && event.Block.ToolUse != nil {
				id = event.Block.ToolUse.ID
				name = event.Block.ToolUse.Name
			}
			if event.Delta == nil {
				rememberGeminiTool(state, event.Index, id, name, "")
				continue
			}
			if event.Delta.JSON != "" || id != "" || name != "" {
				rememberGeminiTool(state, event.Index, id, name, event.Delta.JSON)
				if event.Delta.JSON != "" {
					continue
				}
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

func rememberGeminiTool(state *ir.StreamState, index int, id, name, fragment string) {
	if state == nil {
		return
	}
	if state.ToolCalls == nil {
		state.ToolCalls = map[int]*ir.ToolStreamState{}
	}
	tool := state.ToolCalls[index]
	if tool == nil {
		tool = &ir.ToolStreamState{BlockIndex: index, SourceIndex: index}
		state.ToolCalls[index] = tool
	}
	if id != "" {
		tool.ID = id
	}
	if name != "" {
		tool.Name = name
	}
	if fragment == "" {
		return
	}
	tool.Fragments = append(tool.Fragments, fragment)
	tool.Accumulated += fragment
	if _, ok := parseGeminiToolArgs(fragment); ok {
		tool.LatestSnapshot = fragment
	}
}

func emitGeminiToolIfReady(state *ir.StreamState, index int, force bool) *dto.GeminiPart {
	if state == nil || state.ToolCalls == nil {
		return nil
	}
	tool := state.ToolCalls[index]
	if tool == nil || tool.Emitted || tool.Name == "" {
		return nil
	}
	args, ok := finalGeminiToolArgs(tool)
	if !ok && !force {
		return nil
	}
	if !ok {
		args = map[string]any{}
	}
	tool.Emitted = true
	return &dto.GeminiPart{
		FunctionCall: &dto.FunctionCall{
			FunctionName: tool.Name,
			Arguments:    args,
		},
	}
}

func finalGeminiToolArgs(tool *ir.ToolStreamState) (any, bool) {
	if tool == nil {
		return nil, false
	}
	if args, ok := parseGeminiToolArgs(tool.Accumulated); ok {
		return args, true
	}
	if args, ok := parseGeminiToolArgs(tool.LatestSnapshot); ok {
		return args, true
	}
	return nil, false
}

func flushGeminiTools(state *ir.StreamState) []dto.GeminiPart {
	if state == nil || len(state.ToolCalls) == 0 {
		return nil
	}
	indexes := make([]int, 0, len(state.ToolCalls))
	for idx := range state.ToolCalls {
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
