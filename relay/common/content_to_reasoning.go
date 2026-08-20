package common

import (
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/content2reasoning"
)

const (
	DefaultContentToReasoningStart = "<mm:think>"
	DefaultContentToReasoningEnd   = "</mm:think>"
)

// ContentToReasoningSession keeps per-choice parser state for one relay response.
type ContentToReasoningSession struct {
	markers         []content2reasoning.Pair
	states          map[int]*content2reasoning.State
	lastID          string
	lastCreated     int64
	lastModel       string
	lastFingerprint *string
	flushed         bool
}

type contentToReasoningMetadataChoice struct {
	index  int
	choice dto.ChatCompletionsStreamResponseChoice
}

func defaultContentToReasoningMarkers() []content2reasoning.Pair {
	return []content2reasoning.Pair{
		{Start: DefaultContentToReasoningStart, End: DefaultContentToReasoningEnd},
	}
}

func (info *RelayInfo) ContentToReasoningEnabled() bool {
	if info == nil || info.ChannelMeta == nil {
		return false
	}
	if info.ChannelSetting.ThinkingToContent {
		return false
	}
	setting := info.ChannelOtherSettings.ContentToReasoning
	return setting != nil && setting.Enabled
}

func (info *RelayInfo) ensureContentToReasoningSession() (*ContentToReasoningSession, error) {
	if info.ContentToReasoningSession != nil {
		return info.ContentToReasoningSession, nil
	}
	var markers []content2reasoning.Pair
	setting := info.ChannelOtherSettings.ContentToReasoning
	if setting == nil {
		markers = defaultContentToReasoningMarkers()
	} else if len(setting.Markers) == 0 {
		markers = defaultContentToReasoningMarkers()
	} else {
		markers = make([]content2reasoning.Pair, len(setting.Markers))
		for i, marker := range setting.Markers {
			markers[i] = content2reasoning.Pair{Start: marker.Start, End: marker.End}
		}
	}
	session := &ContentToReasoningSession{
		markers: markers,
		states:  make(map[int]*content2reasoning.State),
	}
	info.ContentToReasoningSession = session
	return session, nil
}

func (info *RelayInfo) contentToReasoningState(index int) (*content2reasoning.State, error) {
	session, err := info.ensureContentToReasoningSession()
	if err != nil {
		return nil, err
	}
	if state := session.states[index]; state != nil {
		return state, nil
	}
	state, err := content2reasoning.NewState(session.markers)
	if err != nil {
		return nil, err
	}
	session.states[index] = state
	return state, nil
}

// TransformContentToReasoningStream converts one OpenAI stream response. When no
// marker state is active and no marker is present, the original response is
// returned unchanged. Metadata-only events are passed through untouched.
func (info *RelayInfo) TransformContentToReasoningStream(data string) ([]*dto.ChatCompletionsStreamResponse, error) {
	var stream dto.ChatCompletionsStreamResponse
	if err := common.UnmarshalJsonStr(data, &stream); err != nil {
		return nil, err
	}

	session, err := info.ensureContentToReasoningSession()
	if err != nil {
		return nil, err
	}
	session.lastID = stream.Id
	session.lastCreated = stream.Created
	session.lastModel = stream.Model
	session.lastFingerprint = stream.SystemFingerprint

	type plan struct {
		fragments []content2reasoning.Fragment
	}
	plans := make(map[int]plan, len(stream.Choices))
	tailChoices := make([]contentToReasoningMetadataChoice, 0, len(stream.Choices))

	for _, choice := range stream.Choices {
		text := choice.Delta.GetContentString()
		alreadyStructured := choice.Delta.GetReasoningContent() != ""
		if text == "" || alreadyStructured {
			tailChoices = append(tailChoices, contentToReasoningMetadataChoice{index: choice.Index, choice: choice})
			continue
		}

		state, err := info.contentToReasoningState(choice.Index)
		if err != nil {
			return nil, err
		}
		fragments := state.Feed(text)
		if len(fragments) == 0 {
			// Mid-marker: keep metadata, suppress the buffered content.
			metadataOnly := choice
			metadataOnly.Delta.Content = nil
			tailChoices = append(tailChoices, contentToReasoningMetadataChoice{index: choice.Index, choice: metadataOnly})
			continue
		}
		plans[choice.Index] = plan{fragments: fragments}
	}

	maxFragments := 0
	for _, item := range plans {
		if len(item.fragments) > maxFragments {
			maxFragments = len(item.fragments)
		}
	}

	if maxFragments == 0 {
		if len(tailChoices) == 0 {
			if stream.Usage == nil {
				return nil, nil
			}
			response := newStreamResponseShell(&stream)
			response.Usage = stream.Usage
			return []*dto.ChatCompletionsStreamResponse{response}, nil
		}
		response := newStreamResponseShell(&stream)
		response.Choices = choicesFromMetadata(tailChoices)
		response.Usage = stream.Usage
		return []*dto.ChatCompletionsStreamResponse{response}, nil
	}

	outputs := make([]*dto.ChatCompletionsStreamResponse, 0, maxFragments)
	for ordinal := 0; ordinal < maxFragments; ordinal++ {
		response := newStreamResponseShell(&stream)
		response.Choices = make([]dto.ChatCompletionsStreamResponseChoice, 0, len(stream.Choices))

		for i := range stream.Choices {
			item, planned := plans[stream.Choices[i].Index]
			if !planned || ordinal >= len(item.fragments) {
				continue
			}
			choice := stream.Choices[i]
			choice.Delta = cleanStreamDelta(choice.Delta)
			if ordinal == 0 {
				choice.Delta.Role = stream.Choices[i].Delta.Role
			}
			applyStreamFragment(&choice, item.fragments[ordinal])
			if ordinal == len(item.fragments)-1 {
				applyStreamChoiceMetadata(&choice, stream.Choices[i])
			}
			response.Choices = append(response.Choices, choice)
		}

		if ordinal == maxFragments-1 {
			response.Choices = append(response.Choices, choicesFromMetadata(tailChoices)...)
			response.Usage = stream.Usage
		}
		if len(response.Choices) > 0 {
			outputs = append(outputs, response)
		}
	}

	return outputs, nil
}

// ContentToReasoningFlush emits any state buffered because a reasoning marker had
// not closed before the stream ended. It is a no-op after the first call.
func (info *RelayInfo) ContentToReasoningFlush() ([]*dto.ChatCompletionsStreamResponse, bool) {
	if info == nil || info.ContentToReasoningSession == nil {
		return nil, false
	}
	session := info.ContentToReasoningSession
	if session.flushed {
		return nil, false
	}
	session.flushed = true

	indexes := make([]int, 0, len(session.states))
	for index := range session.states {
		indexes = append(indexes, index)
	}
	sort.Ints(indexes)

	outputs := make([]*dto.ChatCompletionsStreamResponse, 0, len(indexes))
	for _, index := range indexes {
		state := session.states[index]
		fragments, unclosed := state.Done()
		if !unclosed && len(fragments) == 0 {
			continue
		}
		response := dto.ChatCompletionsStreamResponse{
			Id:                session.lastID,
			Object:            "chat.completion.chunk",
			Created:           session.lastCreated,
			Model:             session.lastModel,
			SystemFingerprint: session.lastFingerprint,
			Choices:          make([]dto.ChatCompletionsStreamResponseChoice, 0, len(fragments)),
		}
		for _, fragment := range fragments {
			choice := dto.ChatCompletionsStreamResponseChoice{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{},
				Index: index,
			}
			applyStreamFragment(&choice, fragment)
			response.Choices = append(response.Choices, choice)
		}
		if len(response.Choices) > 0 {
			outputs = append(outputs, &response)
		}
	}
	return outputs, len(outputs) > 0
}

// TransformContentToReasoningFull mutates a non-streaming OpenAI response.
func (info *RelayInfo) TransformContentToReasoningFull(response *dto.OpenAITextResponse) bool {
	if response == nil || info == nil || !info.ContentToReasoningEnabled() {
		return false
	}
	session, err := info.ensureContentToReasoningSession()
	if err != nil {
		return false
	}
	_ = session

	changed := false
	for i := range response.Choices {
		message := &response.Choices[i].Message
		content := message.StringContent()
		if content == "" || message.GetReasoningContent() != "" {
			continue
		}
		if !message.IsStringContent() {
			continue
		}
		result := content2reasoning.SplitText(content, session.markers)
		if !result.Found {
			continue
		}
		message.SetStringContent(result.Content)
		if result.Reasoning != "" {
			reasoning := result.Reasoning
			message.ReasoningContent = &reasoning
			message.Reasoning = nil
		}
		changed = true
	}
	return changed
}

func newStreamResponseShell(source *dto.ChatCompletionsStreamResponse) *dto.ChatCompletionsStreamResponse {
	return &dto.ChatCompletionsStreamResponse{
		Id:                source.Id,
		Object:            source.Object,
		Created:           source.Created,
		Model:             source.Model,
		SystemFingerprint: source.SystemFingerprint,
	}
}

func cleanStreamDelta(delta dto.ChatCompletionsStreamResponseChoiceDelta) dto.ChatCompletionsStreamResponseChoiceDelta {
	return dto.ChatCompletionsStreamResponseChoiceDelta{}
}

func applyStreamFragment(choice *dto.ChatCompletionsStreamResponseChoice, fragment content2reasoning.Fragment) {
	switch fragment.Kind {
	case content2reasoning.KindThinking:
		choice.Delta.SetReasoningContent(fragment.Text)
	case content2reasoning.KindContent:
		choice.Delta.SetContentString(fragment.Text)
	}
}

func applyStreamChoiceMetadata(target *dto.ChatCompletionsStreamResponseChoice, source dto.ChatCompletionsStreamResponseChoice) {
	target.FinishReason = source.FinishReason
	target.Logprobs = source.Logprobs
	target.Delta.ToolCalls = source.Delta.ToolCalls
}

func choicesFromMetadata(choices []contentToReasoningMetadataChoice) []dto.ChatCompletionsStreamResponseChoice {
	result := make([]dto.ChatCompletionsStreamResponseChoice, 0, len(choices))
	for _, item := range choices {
		result = append(result, item.choice)
	}
	return result
}
