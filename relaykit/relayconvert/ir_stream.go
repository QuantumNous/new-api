package relayconvert

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/project"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	geminichat "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/gemini_chat"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
)

type irResponseStream struct {
	grounding    geminichat.GroundingStream
	from, target types.RelayFormat
	hub          *ir.StreamState
	responses    *ChatToResponsesStreamState
	options      ResponseStreamOptions
	usage        *dto.Usage
	text         strings.Builder
	terminal     []ir.Event
	finishing    bool
	choices      map[int]*irResponseStream
	singleChoice bool
}

func irStreamFactory(from, target types.RelayFormat) ResponseStreamStateFactory {
	return func(options ResponseStreamOptions) any {
		if options.ID == "" {
			options.ID = fmt.Sprintf("resp_%s", kitutil.GetUUID())
		}
		if options.Created == 0 {
			options.Created = time.Now().Unix()
		}
		state := &irResponseStream{from: from, target: target, options: options, hub: ir.NewStreamState(options.ID, options.Model)}
		state.hub.Created = options.Created
		if target == types.RelayFormatOpenAIResponses {
			state.responses = NewChatToResponsesStreamState(options.ID, options.Model)
			state.responses.Created = options.Created
			state.responses.EmitSequenceNumber = options.EmitSequenceNumber
		}
		return state
	}
}

func (s *irResponseStream) StreamUsage() *dto.Usage { return s.usage }
func (s *irResponseStream) SetStreamUsage(usage *dto.Usage) {
	s.usage = usage
	for _, choice := range s.choices {
		choice.SetStreamUsage(usage)
	}
	if usage != nil {
		s.hub.SetUsage(ir.Usage{Input: usage.PromptTokens, Output: usage.CompletionTokens, Thought: usage.CompletionTokenDetails.ReasoningTokens, CacheRead: usage.PromptTokensDetails.CachedTokens, CacheWrite: usage.PromptTokensDetails.CacheCreationTokensTotal()})
		if s.responses != nil {
			s.responses.SetStreamUsage(usage)
		}
	}
}
func (s *irResponseStream) UsageText() string {
	if len(s.choices) == 0 {
		return s.text.String()
	}
	var text strings.Builder
	for _, index := range slices.Sorted(maps.Keys(s.choices)) {
		text.WriteString(s.choices[index].UsageText())
	}
	return text.String()
}

func convertIRStream(ctx context.Context, info convmeta.Meta, response any, state any) ([]any, *dto.Usage, error) {
	s, ok := state.(*irResponseStream)
	if !ok || s == nil {
		return nil, nil, fmt.Errorf("IR stream state is required")
	}
	usage := canonicalUsageFromResponse(response)
	if usage != nil {
		s.SetStreamUsage(dto.MergeUsageNonZero(s.usage, usage))
	}
	if !s.singleChoice && (s.target == types.RelayFormatOpenAI || s.target == types.RelayFormatGemini) && (s.from == types.RelayFormatGemini || s.from == types.RelayFormatOpenAI) {
		frames, err := irStreamChoices(response)
		if err != nil {
			return nil, s.usage, err
		}
		if s.choices == nil {
			s.choices = make(map[int]*irResponseStream)
		}
		if len(frames) == 0 {
			for _, index := range slices.Sorted(maps.Keys(s.choices)) {
				frames = append(frames, irStreamChoice{index, response})
			}
		}
		var values []any
		for _, frame := range frames {
			choice := s.choices[frame.index]
			if choice == nil {
				choice = irStreamFactory(s.from, s.target)(s.options).(*irResponseStream)
				choice.singleChoice = true
				choice.hub.ChoiceIndex = frame.index
				s.choices[frame.index] = choice
			}
			choice.SetStreamUsage(s.usage)
			chunks, _, err := convertIRStream(ctx, info, frame.value, choice)
			if err != nil {
				return nil, s.usage, err
			}
			values = append(values, chunks...)
		}
		return values, s.usage, nil
	}
	if s.hub.Model == "" {
		s.hub.Model = convmeta.UpstreamModelName(info)
	}
	var events []ir.Event
	var err error
	if !s.hub.Done {
		events, err = project.FromStream(s.from, response, s.hub)
		if err != nil {
			return nil, s.usage, err
		}
	}
	s.SetStreamUsage(s.usage)
	if s.hub.PendingFinish {
		events = append(events, s.hub.TerminalEvents()...)
	}
	values, err := s.projectEvents(info, events)
	if err == nil && s.from == types.RelayFormatGemini && s.target == types.RelayFormatOpenAI {
		native, parseErr := asGeminiChatResponse(response)
		if parseErr != nil {
			return nil, s.usage, parseErr
		}
		var rendered strings.Builder
		for _, value := range values {
			if chunk, ok := value.(*dto.ChatCompletionsStreamResponse); ok {
				for _, choice := range chunk.Choices {
					rendered.WriteString(choice.Delta.GetContentString())
				}
			}
		}
		for _, candidate := range native.Candidates {
			if annotations := s.grounding.Observe(candidate, rendered.String()); len(annotations) > 0 {
				values = append(values, &dto.ChatCompletionsStreamResponse{Id: s.hub.ID, Model: s.hub.Model, Created: s.hub.Created, Object: "chat.completion.chunk", Choices: []dto.ChatCompletionsStreamResponseChoice{{Index: int(candidate.Index), Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Annotations: annotations}}}})
			}
		}
	}
	return values, s.usage, err
}

func finalizeIRStream(ctx context.Context, info convmeta.Meta, state any) ([]any, *dto.Usage, error) {
	s, ok := state.(*irResponseStream)
	if !ok || s == nil {
		return nil, nil, fmt.Errorf("IR stream state is required")
	}
	if len(s.choices) > 0 {
		var values []any
		for _, index := range slices.Sorted(maps.Keys(s.choices)) {
			chunks, _, err := finalizeIRStream(ctx, info, s.choices[index])
			if err != nil {
				return nil, s.usage, err
			}
			values = append(values, chunks...)
		}
		return values, s.usage, nil
	}
	if s.usage == nil && info != nil && s.target == types.RelayFormatClaude {
		s.SetStreamUsage(info.EnsureClaudeConvertInfo().Usage)
	}
	if source, ok := s.hub.SourceState.(interface{ Finalize() error }); ok {
		if err := source.Finalize(); err != nil {
			return nil, s.usage, err
		}
	}
	s.finishing = true
	events := append(s.terminal, s.hub.Finalize()...)
	s.terminal = nil
	values, err := s.projectEvents(info, events)
	if err != nil {
		return nil, s.usage, err
	}
	if s.responses != nil {
		values = append(values, streamValuesFromAny(FinalizeChatCompletionsStreamToResponses(s.responses))...)
	}
	return values, s.usage, nil
}

func (s *irResponseStream) projectEvents(info convmeta.Meta, events []ir.Event) ([]any, error) {
	if s.options.DeferTerminal && !s.finishing {
		visible := make([]ir.Event, 0, len(events))
		for _, event := range events {
			if event.Kind == ir.EventFinish || event.Kind == ir.EventUsage {
				s.terminal = append(s.terminal, event)
			} else {
				visible = append(visible, event)
			}
		}
		events = visible
	}
	for i := range events {
		if events[i].Kind == ir.EventUsage {
			events[i].Usage = &s.hub.Usage
		}
		if events[i].Delta != nil {
			s.text.WriteString(events[i].Delta.Text)
			s.text.WriteString(events[i].Delta.JSON)
		}
	}
	if s.responses != nil {
		s.responses.Tools = convmeta.ResponsesToolStateOf(info)
		events, err := s.responses.ProjectIR(events, s.hub)
		return streamValuesFromAny(events), err
	}
	values, err := project.ToStream(s.target, events, s.hub)
	if err != nil {
		return nil, err
	}
	out := make([]any, 0, len(values))
	for _, value := range values {
		if chunk, ok := value.(*dto.ChatCompletionsStreamResponse); ok {
			if !s.options.IncludeUsage && s.from == types.RelayFormatOpenAIResponses {
				chunk.Usage = nil
			}
			irApplyResponseUsage(chunk, s.usage)
			if s.from == types.RelayFormatOpenAIResponses {
				out = append(out, *chunk)
			} else {
				out = append(out, chunk)
			}
		} else {
			irApplyResponseUsage(value, s.usage)
			out = append(out, value)
		}
	}
	if info != nil && s.target == types.RelayFormatClaude && s.hub.Done {
		converted := info.EnsureClaudeConvertInfo()
		converted.Done = true
		if converted.Usage == nil {
			converted.Usage = s.usage
		}
	}
	return out, nil
}

// irStreamConverter preserves the single-envelope API while sharing the same IR
// state machine as the chunk API. Hosts should prefer explicit stream states.
func irStreamConverter(from, target types.RelayFormat) ResponseStreamConverterFunc {
	return func(ctx context.Context, info convmeta.Meta, response any) (any, *dto.Usage, error) {
		key := string(from) + ":" + string(target)
		carrier, _ := info.(interface {
			TextStreamState(string) any
			SetTextStreamState(string, any)
		})
		var state *irResponseStream
		if carrier != nil {
			state, _ = carrier.TextStreamState(key).(*irResponseStream)
		}
		if state == nil {
			state = irStreamFactory(from, target)(ResponseStreamOptions{Model: convmeta.UpstreamModelName(info), IncludeUsage: true}).(*irResponseStream)
			if carrier != nil {
				carrier.SetTextStreamState(key, state)
			}
		}
		values, usage, err := convertIRStream(ctx, info, response, state)
		if err != nil {
			return nil, usage, err
		}
		switch target {
		case types.RelayFormatClaude:
			out := make([]*dto.ClaudeResponse, 0, len(values))
			for _, value := range values {
				out = append(out, value.(*dto.ClaudeResponse))
			}
			return out, usage, nil
		case types.RelayFormatGemini:
			out := &dto.GeminiChatResponse{}
			indexes := map[int64]int{}
			for _, value := range values {
				chunk := value.(*dto.GeminiChatResponse)
				for _, candidate := range chunk.Candidates {
					index, exists := indexes[candidate.Index]
					if !exists {
						indexes[candidate.Index] = len(out.Candidates)
						out.Candidates = append(out.Candidates, candidate)
						continue
					}
					out.Candidates[index].Content.Parts = append(out.Candidates[index].Content.Parts, candidate.Content.Parts...)
					if candidate.FinishReason != nil {
						out.Candidates[index].FinishReason = candidate.FinishReason
					}
				}
				if chunk.HasUsageMetadata {
					out.HasUsageMetadata = true
					out.UsageMetadata = chunk.UsageMetadata
				}
			}
			return out, usage, nil
		case types.RelayFormatOpenAI:
			out := mergeIRChatChunks(values, state.hub)
			out.Usage = usage
			// Legacy Gemini callers emit STOP separately at EOF.
			if from == types.RelayFormatGemini {
				for i := range out.Choices {
					if out.Choices[i].FinishReason != nil && *out.Choices[i].FinishReason == "stop" {
						out.Choices[i].FinishReason = nil
					}
				}
			}
			return out, usage, nil
		default:
			return values, usage, nil
		}
	}
}

// irStreamChoices isolates alternative answers before entering the block hub.
type irStreamChoice struct {
	index int
	value any
}

func irStreamChoices(value any) ([]irStreamChoice, error) {
	switch value := value.(type) {
	case dto.ChatCompletionsStreamResponse:
		return irStreamChoices(&value)
	case *dto.ChatCompletionsStreamResponse:
		frames := make([]irStreamChoice, 0, len(value.Choices))
		for _, choice := range value.Choices {
			frame := *value
			frame.Choices = []dto.ChatCompletionsStreamResponseChoice{choice}
			frames = append(frames, irStreamChoice{choice.Index, &frame})
		}
		return frames, nil
	case dto.GeminiChatResponse:
		return irStreamChoices(&value)
	case *dto.GeminiChatResponse:
		frames := make([]irStreamChoice, 0, len(value.Candidates))
		for _, choice := range value.Candidates {
			frame := *value
			frame.Candidates = []dto.GeminiChatCandidate{choice}
			frames = append(frames, irStreamChoice{int(choice.Index), &frame})
		}
		return frames, nil
	default:
		return nil, fmt.Errorf("unexpected multi-choice stream type %T", value)
	}
}

// mergeIRChatChunks preserves choice and tool indexes for the single-envelope facade.
func mergeIRChatChunks(values []any, hub *ir.StreamState) *dto.ChatCompletionsStreamResponse {
	out := &dto.ChatCompletionsStreamResponse{Id: hub.ID, Model: hub.Model, Created: hub.Created, Object: "chat.completion.chunk"}
	indexes := map[int]int{}
	for _, value := range values {
		var chunk *dto.ChatCompletionsStreamResponse
		switch typed := value.(type) {
		case *dto.ChatCompletionsStreamResponse:
			chunk = typed
		case dto.ChatCompletionsStreamResponse:
			chunk = &typed
		}
		if chunk == nil {
			continue
		}
		out.Id, out.Model, out.Created = chunk.Id, chunk.Model, chunk.Created
		for _, choice := range chunk.Choices {
			index, exists := indexes[choice.Index]
			if !exists {
				index = len(out.Choices)
				indexes[choice.Index] = index
				out.Choices = append(out.Choices, dto.ChatCompletionsStreamResponseChoice{Index: choice.Index})
			}
			target := &out.Choices[index]
			delta := &target.Delta
			if choice.Delta.Role != "" {
				delta.Role = choice.Delta.Role
			}
			if content := choice.Delta.GetContentString(); content != "" {
				delta.SetContentString(delta.GetContentString() + content)
			}
			if think := choice.Delta.GetReasoningContent(); think != "" {
				delta.SetReasoningContent(delta.GetReasoningContent() + think)
			}
			if len(choice.Delta.Annotations) > 0 {
				delta.Annotations = choice.Delta.Annotations
			}
			for _, tool := range choice.Delta.ToolCalls {
				matched := false
				for i := range delta.ToolCalls {
					current := &delta.ToolCalls[i]
					if current.Index == nil || tool.Index == nil || *current.Index != *tool.Index {
						continue
					}
					if tool.ID != "" {
						current.ID = tool.ID
					}
					if tool.Function.Name != "" {
						current.Function.Name = tool.Function.Name
					}
					current.Function.Arguments += tool.Function.Arguments
					matched = true
					break
				}
				if !matched {
					delta.ToolCalls = append(delta.ToolCalls, tool)
				}
			}
			if choice.FinishReason != nil {
				target.FinishReason = choice.FinishReason
			}
		}
	}
	if len(out.Choices) == 0 {
		out.Choices = []dto.ChatCompletionsStreamResponseChoice{{Index: 0}}
	}
	return out
}
