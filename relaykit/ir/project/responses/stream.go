package responses

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

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
	events := make([]ir.Event, 0, 4)
	id, model := "", ""
	if event.Response != nil {
		id = event.Response.ID
		model = event.Response.Model
	}
	if ev := state.StartEvent(firstNonEmpty(id, state.ID), firstNonEmpty(model, state.Model)); ev != nil {
		events = append(events, *ev)
	}
	sourceIndex := responseEventOutputIndex(event)

	switch event.Type {
	case "response.created":
		return events, nil
	case "response.output_text.delta":
		idx, opened := ensureResponsesSourceBlock(state, sourceIndex, ir.BlockKindText)
		events = append(events, opened...)
		state.ResponsesSourceText = appendSourceFragment(state.ResponsesSourceText, sourceIndex, event.Delta)
		events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: event.Delta}})
		return events, nil
	case "response.output_text.done":
		idx, opened := ensureResponsesSourceBlock(state, sourceIndex, ir.BlockKindText)
		events = append(events, opened...)
		if delta := suffixDelta(state.ResponsesSourceText[sourceIndex], event.Text); delta != "" {
			state.ResponsesSourceText = appendSourceFragment(state.ResponsesSourceText, sourceIndex, delta)
			events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: delta}})
		}
		return events, nil
	case "response.reasoning_summary_text.delta":
		if event.Delta == "" {
			return events, nil
		}
		idx, opened := ensureResponsesSourceBlock(state, sourceIndex, ir.BlockKindThink)
		events = append(events, opened...)
		state.ResponsesSourceReasoning = appendSourceFragment(state.ResponsesSourceReasoning, sourceIndex, event.Delta)
		events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: event.Delta}})
		state.ResponsesSummarySeen = true
		return events, nil
	case "response.reasoning_summary_text.done":
		idx, opened := ensureResponsesSourceBlock(state, sourceIndex, ir.BlockKindThink)
		events = append(events, opened...)
		if delta := suffixDelta(state.ResponsesSourceReasoning[sourceIndex], event.Text); delta != "" {
			state.ResponsesSourceReasoning = appendSourceFragment(state.ResponsesSourceReasoning, sourceIndex, delta)
			events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: delta}})
		}
		state.ResponsesSummarySeen = true
		return events, nil
	case "response.output_item.added":
		if event.Item == nil || event.Item.Type != "function_call" {
			return events, nil
		}
		idx, opened := state.EnsureTool(sourceIndex, event.Item.CallId, event.Item.Name)
		if tool := state.ToolCalls[idx]; tool != nil && tool.ProviderItemID == "" {
			tool.ProviderItemID = event.Item.ID
		}
		return append(events, opened...), nil
	case "response.function_call_arguments.delta":
		idx, opened := state.EnsureTool(sourceIndex, "", "")
		events = append(events, opened...)
		state.ResponsesSourceArguments = appendSourceFragment(state.ResponsesSourceArguments, sourceIndex, event.Delta)
		events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{JSON: event.Delta}})
		return events, nil
	case "response.function_call_arguments.done":
		idx, opened := state.EnsureTool(sourceIndex, "", "")
		events = append(events, opened...)
		if delta := suffixDelta(state.ResponsesSourceArguments[sourceIndex], event.Arguments); delta != "" {
			state.ResponsesSourceArguments = appendSourceFragment(state.ResponsesSourceArguments, sourceIndex, delta)
			events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{JSON: delta}})
		}
		return events, nil
	case "response.output_item.done":
		itemEvents, err := completedResponsesItemEvents(state, sourceIndex, event.Item)
		if err != nil {
			return nil, err
		}
		return append(events, itemEvents...), nil
	case "response.completed", "response.done", "response.incomplete":
		if event.Response != nil {
			for outputIndex := range event.Response.Output {
				itemEvents, err := completedResponsesItemEvents(state, outputIndex, &event.Response.Output[outputIndex])
				if err != nil {
					return nil, err
				}
				events = append(events, itemEvents...)
			}
			if event.Response.Usage != nil {
				state.SetUsage(ir.Usage{
					Input:   event.Response.Usage.InputTokens,
					Output:  event.Response.Usage.OutputTokens,
					Thought: event.Response.Usage.CompletionTokenDetails.ReasoningTokens,
				})
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

func completedResponsesItemEvents(state *ir.StreamState, sourceIndex int, item *dto.ResponsesOutput) ([]ir.Event, error) {
	if item == nil {
		return nil, nil
	}
	var events []ir.Event
	switch item.Type {
	case "message":
		idx, opened := ensureResponsesSourceBlock(state, sourceIndex, ir.BlockKindText)
		events = append(events, opened...)
		text := responsesMessageText(*item)
		if delta := suffixDelta(state.ResponsesSourceText[sourceIndex], text); delta != "" {
			state.ResponsesSourceText = appendSourceFragment(state.ResponsesSourceText, sourceIndex, delta)
			events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: delta}})
		}
		events = append(events, state.StopBlock(idx)...)
	case "reasoning":
		text := reasoningSummaryText(*item)
		if text == "" {
			return nil, nil
		}
		idx, opened := ensureResponsesSourceBlock(state, sourceIndex, ir.BlockKindThink)
		events = append(events, opened...)
		if delta := suffixDelta(state.ResponsesSourceReasoning[sourceIndex], text); delta != "" {
			state.ResponsesSourceReasoning = appendSourceFragment(state.ResponsesSourceReasoning, sourceIndex, delta)
			events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{Text: delta}})
		}
		state.ResponsesSummarySeen = true
		events = append(events, state.StopBlock(idx)...)
	case "function_call":
		idx, opened := state.EnsureTool(sourceIndex, item.CallId, item.Name)
		events = append(events, opened...)
		arguments := item.ArgumentsString()
		if delta := suffixDelta(state.ResponsesSourceArguments[sourceIndex], arguments); delta != "" {
			state.ResponsesSourceArguments = appendSourceFragment(state.ResponsesSourceArguments, sourceIndex, delta)
			events = append(events, ir.Event{Kind: ir.EventBlockDelta, Index: idx, Delta: &ir.BlockDelta{JSON: delta}})
		}
		events = append(events, state.StopBlock(idx)...)
	}
	return events, nil
}

func ensureResponsesSourceBlock(state *ir.StreamState, sourceIndex int, kind ir.BlockKind) (int, []ir.Event) {
	if state.ResponsesSourceBlocks == nil {
		state.ResponsesSourceBlocks = make(map[int]int)
	}
	if index, ok := state.ResponsesSourceBlocks[sourceIndex]; ok {
		return index, nil
	}
	index, events := state.EnsureBlock(kind)
	state.ResponsesSourceBlocks[sourceIndex] = index
	return index, events
}

func responsesMessageText(item dto.ResponsesOutput) string {
	var text strings.Builder
	for _, part := range item.Content {
		if part.Type == "output_text" || part.Type == "text" || part.Type == "" {
			text.WriteString(part.Text)
		}
	}
	return text.String()
}

func responseEventOutputIndex(event *dto.ResponsesStreamResponse) int {
	if event != nil && event.OutputIndex != nil {
		return *event.OutputIndex
	}
	return 0
}

func appendSourceFragment(values map[int]string, index int, fragment string) map[int]string {
	if values == nil {
		values = make(map[int]string)
	}
	values[index] += fragment
	return values
}

func suffixDelta(previous, complete string) string {
	if complete == "" || complete == previous {
		return ""
	}
	if strings.HasPrefix(complete, previous) {
		return complete[len(previous):]
	}
	return complete
}

func ToStream(events []ir.Event, state *ir.StreamState) ([]any, error) {
	if state == nil {
		state = ir.NewStreamState("", "")
	}
	out := make([]any, 0, len(events)*2+4)
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
			appendResponsesEvent(state, &out, dto.ResponsesStreamResponse{
				Type: "response.created",
				Response: &dto.OpenAIResponsesResponse{
					ID:     firstNonEmpty(event.ID, state.ID),
					Object: "response",
					Model:  firstNonEmpty(event.Model, state.Model),
					Status: json.RawMessage(`"in_progress"`),
					Output: []dto.ResponsesOutput{},
				},
			})
		case ir.EventBlockStart:
			kind := ir.BlockKindText
			if event.Block != nil {
				kind = event.Block.Kind
			}
			for _, responseEvent := range ensureResponsesItem(state, event.Index, kind, event.Block) {
				appendResponsesEvent(state, &out, responseEvent)
			}
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
			for _, responseEvent := range ensureResponsesItem(state, event.Index, kind, event.Block) {
				appendResponsesEvent(state, &out, responseEvent)
			}
			item := responsesItemState(state, event.Index, kind, event.Block)
			idx, zero := event.Index, 0
			if event.Delta.JSON != "" {
				item.Arguments += event.Delta.JSON
				appendResponsesEvent(state, &out, dto.ResponsesStreamResponse{
					Type:        "response.function_call_arguments.delta",
					OutputIndex: &idx,
					ItemID:      item.ItemID,
					Delta:       event.Delta.JSON,
				})
				continue
			}
			if event.Delta.Text == "" {
				continue
			}
			item.Text += event.Delta.Text
			typ := "response.output_text.delta"
			responseEvent := dto.ResponsesStreamResponse{
				Type:         typ,
				OutputIndex:  &idx,
				ContentIndex: &zero,
				ItemID:       item.ItemID,
				Delta:        event.Delta.Text,
			}
			if kind == ir.BlockKindThink {
				responseEvent.Type = "response.reasoning_summary_text.delta"
				responseEvent.ContentIndex = nil
				responseEvent.SummaryIndex = &zero
			}
			appendResponsesEvent(state, &out, responseEvent)
		case ir.EventBlockStop:
			for _, responseEvent := range completeResponsesItem(state, event.Index) {
				appendResponsesEvent(state, &out, responseEvent)
			}
		case ir.EventUsage:
			for _, index := range responsesItemIndexes(state) {
				for _, responseEvent := range completeResponsesItem(state, index) {
					appendResponsesEvent(state, &out, responseEvent)
				}
			}
			resp := &dto.OpenAIResponsesResponse{
				ID:     state.ID,
				Object: "response",
				Model:  state.Model,
				Status: json.RawMessage(`"completed"`),
				Output: completedResponsesOutput(state),
			}
			if event.Usage != nil {
				resp.Usage = &dto.Usage{
					InputTokens:      event.Usage.Input,
					OutputTokens:     event.Usage.Output,
					TotalTokens:      event.Usage.Input + event.Usage.Output,
					PromptTokens:     event.Usage.Input,
					CompletionTokens: event.Usage.Output,
					CompletionTokenDetails: dto.OutputTokenDetails{
						ReasoningTokens: event.Usage.Thought,
					},
				}
			}
			appendResponsesEvent(state, &out, dto.ResponsesStreamResponse{Type: "response.completed", Response: resp})
		}
	}
	return out, nil
}

func ensureResponsesItem(state *ir.StreamState, index int, kind ir.BlockKind, block *ir.Block) []dto.ResponsesStreamResponse {
	item := responsesItemState(state, index, kind, block)
	if item.Added {
		return nil
	}
	item.Added = true
	idx, zero := index, 0
	wireItem := responsesWireItem(item, false)
	events := []dto.ResponsesStreamResponse{{
		Type:        "response.output_item.added",
		OutputIndex: &idx,
		ItemID:      wireItem.ID,
		Item:        &wireItem,
	}}
	switch item.Kind {
	case ir.BlockKindText:
		part := &dto.ResponsesReasoningSummaryPart{Type: "output_text", Text: "", Annotations: []interface{}{}}
		events = append(events, dto.ResponsesStreamResponse{
			Type:         "response.content_part.added",
			OutputIndex:  &idx,
			ContentIndex: &zero,
			ItemID:       item.ItemID,
			Part:         part,
		})
		item.PartAdded = true
	case ir.BlockKindThink:
		part := &dto.ResponsesReasoningSummaryPart{Type: "summary_text", Text: ""}
		events = append(events, dto.ResponsesStreamResponse{
			Type:         "response.reasoning_summary_part.added",
			OutputIndex:  &idx,
			SummaryIndex: &zero,
			ItemID:       item.ItemID,
			Part:         part,
		})
		item.PartAdded = true
	}
	return events
}

func completeResponsesItem(state *ir.StreamState, index int) []dto.ResponsesStreamResponse {
	item := responsesItemState(state, index, state.KindOf(index), nil)
	if item.Done || !item.Added {
		return nil
	}
	item.Done = true
	idx, zero := index, 0
	wireItem := responsesWireItem(item, true)
	events := make([]dto.ResponsesStreamResponse, 0, 3)
	switch item.Kind {
	case ir.BlockKindText:
		part := &dto.ResponsesReasoningSummaryPart{Type: "output_text", Text: item.Text, Annotations: []interface{}{}}
		events = append(events,
			dto.ResponsesStreamResponse{Type: "response.output_text.done", OutputIndex: &idx, ContentIndex: &zero, ItemID: item.ItemID, Text: item.Text},
			dto.ResponsesStreamResponse{Type: "response.content_part.done", OutputIndex: &idx, ContentIndex: &zero, ItemID: item.ItemID, Part: part},
		)
	case ir.BlockKindThink:
		part := &dto.ResponsesReasoningSummaryPart{Type: "summary_text", Text: item.Text}
		events = append(events,
			dto.ResponsesStreamResponse{Type: "response.reasoning_summary_text.done", OutputIndex: &idx, SummaryIndex: &zero, ItemID: item.ItemID, Text: item.Text},
			dto.ResponsesStreamResponse{Type: "response.reasoning_summary_part.done", OutputIndex: &idx, SummaryIndex: &zero, ItemID: item.ItemID, Part: part},
		)
	case ir.BlockKindToolUse:
		events = append(events, dto.ResponsesStreamResponse{
			Type:        "response.function_call_arguments.done",
			OutputIndex: &idx,
			ItemID:      item.ItemID,
			Arguments:   item.Arguments,
		})
	}
	events = append(events, dto.ResponsesStreamResponse{
		Type:        "response.output_item.done",
		OutputIndex: &idx,
		ItemID:      item.ItemID,
		Item:        &wireItem,
	})
	return events
}

func responsesItemState(state *ir.StreamState, index int, kind ir.BlockKind, block *ir.Block) *ir.ResponsesStreamItemState {
	if state.ResponsesItems == nil {
		state.ResponsesItems = make(map[int]*ir.ResponsesStreamItemState)
	}
	item := state.ResponsesItems[index]
	if item == nil {
		item = &ir.ResponsesStreamItemState{Kind: kind}
		state.ResponsesItems[index] = item
	}
	if item.Kind == "" {
		item.Kind = kind
	}
	if item.Kind == ir.BlockKindToolUse {
		id, name := state.ToolMetadata(index)
		if block != nil && block.ToolUse != nil {
			id = firstNonEmpty(block.ToolUse.ID, id)
			name = firstNonEmpty(block.ToolUse.Name, name)
		}
		item.CallID = ir.CanonicalToolCallID(state.ToolIDScope, index, id)
		item.Name = name
		item.ItemID = responsesFunctionItemID(item.CallID)
	} else if item.ItemID == "" {
		prefix := "msg"
		if item.Kind == ir.BlockKindThink {
			prefix = "rs"
		}
		item.ItemID = responsesOutputID(state.ID, prefix, index)
	}
	return item
}

func responsesWireItem(item *ir.ResponsesStreamItemState, completed bool) dto.ResponsesOutput {
	status := "in_progress"
	if completed {
		status = "completed"
	}
	out := dto.ResponsesOutput{ID: item.ItemID, Status: status}
	switch item.Kind {
	case ir.BlockKindThink:
		out.Type = "reasoning"
		if completed {
			out.Summary = []dto.ResponsesReasoningSummaryPart{{Type: "summary_text", Text: item.Text}}
		}
	case ir.BlockKindToolUse:
		out.Type = "function_call"
		out.CallId = item.CallID
		out.Name = item.Name
		if completed {
			out.Arguments = responsesArgumentsRaw(item.Arguments)
		}
	default:
		out.Type = "message"
		out.Role = "assistant"
		if completed {
			out.Content = []dto.ResponsesOutputContent{{Type: "output_text", Text: item.Text, Annotations: []interface{}{}}}
		} else {
			out.Content = []dto.ResponsesOutputContent{}
		}
	}
	return out
}

func responsesArgumentsRaw(arguments string) json.RawMessage {
	raw, err := json.Marshal(arguments)
	if err != nil {
		return json.RawMessage(`""`)
	}
	return raw
}

func completedResponsesOutput(state *ir.StreamState) []dto.ResponsesOutput {
	indexes := responsesItemIndexes(state)
	output := make([]dto.ResponsesOutput, 0, len(indexes))
	for _, index := range indexes {
		item := state.ResponsesItems[index]
		if item == nil || !item.Done {
			continue
		}
		output = append(output, responsesWireItem(item, true))
	}
	return output
}

func responsesItemIndexes(state *ir.StreamState) []int {
	if state == nil || len(state.ResponsesItems) == 0 {
		return nil
	}
	indexes := make([]int, 0, len(state.ResponsesItems))
	for index := range state.ResponsesItems {
		indexes = append(indexes, index)
	}
	sort.Ints(indexes)
	return indexes
}

func appendResponsesEvent(state *ir.StreamState, out *[]any, event dto.ResponsesStreamResponse) {
	sequence := state.ResponsesSequence
	state.ResponsesSequence++
	event.SequenceNumber = &sequence
	*out = append(*out, event)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
