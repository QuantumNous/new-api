package openaicompat

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/dto"
)

type ChatToResponsesStreamState struct {
	ResponseID     string
	CreatedAt      int64
	Model          string
	SentCreated    bool
	SentInProgress bool

	MessageItemID       string
	MessageOutputIndex  int
	MessageContentIndex int
	MessageItemAdded    bool
	MessageContentAdded bool

	NextOutputIndex int

	OutputText       strings.Builder
	ToolCallArgs     map[string]string
	ToolCallName     map[string]string
	ToolCallSent     map[string]bool
	ToolCallOrder    []string
	ToolCallOutIndex map[string]int
}

func NewChatToResponsesStreamState(responseID string, createdAt int64, model string) *ChatToResponsesStreamState {
	return &ChatToResponsesStreamState{
		ResponseID:          normalizeResponsesID(responseID),
		CreatedAt:           createdAt,
		Model:               model,
		MessageOutputIndex:  -1,
		MessageContentIndex: 0,
		NextOutputIndex:     0,
		ToolCallArgs:        make(map[string]string),
		ToolCallName:        make(map[string]string),
		ToolCallSent:        make(map[string]bool),
		ToolCallOutIndex:    make(map[string]int),
	}
}

func (s *ChatToResponsesStreamState) HandleChatChunk(chunk *dto.ChatCompletionsStreamResponse) []dto.ResponsesStreamResponse {
	if chunk == nil || len(chunk.Choices) == 0 {
		return nil
	}

	if chunk.Model != "" {
		s.Model = chunk.Model
	}
	if s.CreatedAt == 0 && chunk.Created != 0 {
		s.CreatedAt = chunk.Created
	}

	events := s.baseEvents()

	delta := chunk.Choices[0].Delta
	if delta.Content != nil {
		content := *delta.Content
		if content != "" {
			events = append(events, s.ensureMessageItemEvents()...)
			events = append(events, s.ensureContentPartEvents()...)
			s.OutputText.WriteString(content)
			events = append(events, s.outputTextDeltaEvent(content))
		}
	}

	if len(delta.ToolCalls) > 0 {
		for idx, call := range delta.ToolCalls {
			callID := strings.TrimSpace(call.ID)
			if callID == "" {
				if len(s.ToolCallOrder) > 0 {
					callID = s.ToolCallOrder[len(s.ToolCallOrder)-1]
				} else {
					callID = fmt.Sprintf("call_%d", idx)
				}
			}
			if call.Function.Name != "" {
				s.ToolCallName[callID] = call.Function.Name
			}
			if !s.ToolCallSent[callID] {
				s.ToolCallSent[callID] = true
				s.ToolCallOrder = append(s.ToolCallOrder, callID)
				outIndex := s.allocOutputIndex(callID)
				events = append(events, s.toolItemAddedEvent(callID, outIndex))
			}

			args := call.Function.Arguments
			if args == "" {
				continue
			}
			prev := s.ToolCallArgs[callID]
			deltaArgs := args
			if prev != "" && strings.HasPrefix(args, prev) {
				deltaArgs = args[len(prev):]
			}
			if deltaArgs == "" {
				continue
			}
			s.ToolCallArgs[callID] = args
			events = append(events, dto.ResponsesStreamResponse{
				Type:        "response.function_call_arguments.delta",
				ResponseID:  s.ResponseID,
				ItemID:      callID,
				OutputIndex: s.outputIndexPtr(callID),
				Delta:       deltaArgs,
			})
		}
	}

	return events
}

func (s *ChatToResponsesStreamState) FinalEvents(usage *dto.Usage) []dto.ResponsesStreamResponse {
	events := s.baseEvents()

	if s.MessageItemAdded {
		text := s.OutputText.String()
		if s.MessageContentAdded {
			events = append(events, s.outputTextDoneEvent(text))
			events = append(events, s.contentPartDoneEvent(text))
		}
		events = append(events, s.messageItemDoneEvent(text))
	}

	for _, callID := range s.ToolCallOrder {
		outIndex := s.outputIndexPtr(callID)
		args := s.ToolCallArgs[callID]
		if args != "" {
			events = append(events, dto.ResponsesStreamResponse{
				Type:        "response.function_call_arguments.done",
				ResponseID:  s.ResponseID,
				ItemID:      callID,
				OutputIndex: outIndex,
				Arguments:   args,
			})
		}
		events = append(events, dto.ResponsesStreamResponse{
			Type:        "response.output_item.done",
			ResponseID:  s.ResponseID,
			ItemID:      callID,
			OutputIndex: outIndex,
			Item: &dto.ResponsesOutput{
				Type:      "function_call",
				ID:        callID,
				Status:    "completed",
				CallId:    callID,
				Name:      s.ToolCallName[callID],
				Arguments: args,
			},
		})
	}

	output := s.buildFinalOutput()

	resp := &dto.OpenAIResponsesResponse{
		ID:        s.ResponseID,
		Object:    "response",
		CreatedAt: int(s.CreatedAt),
		Status:    "completed",
		Model:     s.Model,
		Output:    output,
		Usage:     usage,
	}
	events = append(events, dto.ResponsesStreamResponse{
		Type:       "response.completed",
		ResponseID: s.ResponseID,
		Response:   resp,
	})

	return events
}

func (s *ChatToResponsesStreamState) createdEvent() dto.ResponsesStreamResponse {
	resp := &dto.OpenAIResponsesResponse{
		ID:        s.ResponseID,
		Object:    "response",
		CreatedAt: int(s.CreatedAt),
		Status:    "in_progress",
		Model:     s.Model,
	}
	return dto.ResponsesStreamResponse{
		Type:       "response.created",
		ResponseID: s.ResponseID,
		Response:   resp,
	}
}

func (s *ChatToResponsesStreamState) inProgressEvent() dto.ResponsesStreamResponse {
	resp := &dto.OpenAIResponsesResponse{
		ID:        s.ResponseID,
		Object:    "response",
		CreatedAt: int(s.CreatedAt),
		Status:    "in_progress",
		Model:     s.Model,
	}
	return dto.ResponsesStreamResponse{
		Type:       "response.in_progress",
		ResponseID: s.ResponseID,
		Response:   resp,
	}
}

func (s *ChatToResponsesStreamState) baseEvents() []dto.ResponsesStreamResponse {
	events := make([]dto.ResponsesStreamResponse, 0, 2)
	if !s.SentCreated {
		events = append(events, s.createdEvent())
		s.SentCreated = true
	}
	if !s.SentInProgress {
		events = append(events, s.inProgressEvent())
		s.SentInProgress = true
	}
	return events
}

func (s *ChatToResponsesStreamState) ensureMessageItemEvents() []dto.ResponsesStreamResponse {
	if s.MessageItemAdded {
		return nil
	}
	s.MessageItemAdded = true
	if s.MessageOutputIndex < 0 {
		s.MessageOutputIndex = s.NextOutputIndex
		s.NextOutputIndex++
	}
	if s.MessageItemID == "" {
		s.MessageItemID = s.buildMessageItemID()
	}
	outIndex := s.MessageOutputIndex
	return []dto.ResponsesStreamResponse{
		{
			Type:        "response.output_item.added",
			ResponseID:  s.ResponseID,
			OutputIndex: &outIndex,
			Item: &dto.ResponsesOutput{
				ID:      s.MessageItemID,
				Type:    "message",
				Status:  "in_progress",
				Role:    "assistant",
				Content: []dto.ResponsesOutputContent{},
			},
		},
	}
}

func (s *ChatToResponsesStreamState) ensureContentPartEvents() []dto.ResponsesStreamResponse {
	if s.MessageContentAdded {
		return nil
	}
	s.MessageContentAdded = true
	outIndex := s.MessageOutputIndex
	contentIndex := s.MessageContentIndex
	part := dto.ResponsesOutputContent{
		Type:        "output_text",
		Text:        "",
		Annotations: []interface{}{},
	}
	return []dto.ResponsesStreamResponse{
		{
			Type:         "response.content_part.added",
			ResponseID:   s.ResponseID,
			ItemID:       s.MessageItemID,
			OutputIndex:  &outIndex,
			ContentIndex: &contentIndex,
			Part:         &part,
		},
	}
}

func (s *ChatToResponsesStreamState) outputTextDeltaEvent(delta string) dto.ResponsesStreamResponse {
	outIndex := s.MessageOutputIndex
	contentIndex := s.MessageContentIndex
	return dto.ResponsesStreamResponse{
		Type:         "response.output_text.delta",
		ResponseID:   s.ResponseID,
		ItemID:       s.MessageItemID,
		OutputIndex:  &outIndex,
		ContentIndex: &contentIndex,
		Delta:        delta,
	}
}

func (s *ChatToResponsesStreamState) outputTextDoneEvent(text string) dto.ResponsesStreamResponse {
	outIndex := s.MessageOutputIndex
	contentIndex := s.MessageContentIndex
	return dto.ResponsesStreamResponse{
		Type:         "response.output_text.done",
		ResponseID:   s.ResponseID,
		ItemID:       s.MessageItemID,
		OutputIndex:  &outIndex,
		ContentIndex: &contentIndex,
		Text:         text,
	}
}

func (s *ChatToResponsesStreamState) contentPartDoneEvent(text string) dto.ResponsesStreamResponse {
	outIndex := s.MessageOutputIndex
	contentIndex := s.MessageContentIndex
	part := dto.ResponsesOutputContent{
		Type:        "output_text",
		Text:        text,
		Annotations: []interface{}{},
	}
	return dto.ResponsesStreamResponse{
		Type:         "response.content_part.done",
		ResponseID:   s.ResponseID,
		ItemID:       s.MessageItemID,
		OutputIndex:  &outIndex,
		ContentIndex: &contentIndex,
		Part:         &part,
	}
}

func (s *ChatToResponsesStreamState) messageItemDoneEvent(text string) dto.ResponsesStreamResponse {
	outIndex := s.MessageOutputIndex
	item := dto.ResponsesOutput{
		ID:     s.MessageItemID,
		Type:   "message",
		Status: "completed",
		Role:   "assistant",
		Content: []dto.ResponsesOutputContent{
			{
				Type:        "output_text",
				Text:        text,
				Annotations: []interface{}{},
			},
		},
	}
	return dto.ResponsesStreamResponse{
		Type:        "response.output_item.done",
		ResponseID:  s.ResponseID,
		ItemID:      s.MessageItemID,
		OutputIndex: &outIndex,
		Item:        &item,
	}
}

func (s *ChatToResponsesStreamState) toolItemAddedEvent(callID string, outIndex int) dto.ResponsesStreamResponse {
	item := dto.ResponsesOutput{
		Type:   "function_call",
		ID:     callID,
		Status: "in_progress",
		CallId: callID,
		Name:   s.ToolCallName[callID],
	}
	return dto.ResponsesStreamResponse{
		Type:        "response.output_item.added",
		ResponseID:  s.ResponseID,
		ItemID:      callID,
		OutputIndex: &outIndex,
		Item:        &item,
	}
}

func (s *ChatToResponsesStreamState) allocOutputIndex(callID string) int {
	if idx, ok := s.ToolCallOutIndex[callID]; ok {
		return idx
	}
	idx := s.NextOutputIndex
	s.NextOutputIndex++
	s.ToolCallOutIndex[callID] = idx
	return idx
}

func (s *ChatToResponsesStreamState) outputIndexPtr(callID string) *int {
	idx, ok := s.ToolCallOutIndex[callID]
	if !ok {
		return nil
	}
	return &idx
}

func (s *ChatToResponsesStreamState) buildMessageItemID() string {
	if s.ResponseID == "" {
		return "msg_0"
	}
	return "msg_" + strings.TrimPrefix(s.ResponseID, "resp_")
}

func (s *ChatToResponsesStreamState) buildFinalOutput() []dto.ResponsesOutput {
	itemsByIndex := make(map[int]dto.ResponsesOutput)
	if s.MessageItemAdded {
		text := strings.TrimSpace(s.OutputText.String())
		itemsByIndex[s.MessageOutputIndex] = dto.ResponsesOutput{
			ID:     s.MessageItemID,
			Type:   "message",
			Status: "completed",
			Role:   "assistant",
			Content: []dto.ResponsesOutputContent{
				{
					Type:        "output_text",
					Text:        text,
					Annotations: []interface{}{},
				},
			},
		}
	}
	for _, callID := range s.ToolCallOrder {
		idx, ok := s.ToolCallOutIndex[callID]
		if !ok {
			continue
		}
		itemsByIndex[idx] = dto.ResponsesOutput{
			Type:      "function_call",
			ID:        callID,
			Status:    "completed",
			CallId:    callID,
			Name:      s.ToolCallName[callID],
			Arguments: s.ToolCallArgs[callID],
		}
	}
	output := make([]dto.ResponsesOutput, 0, len(itemsByIndex))
	for i := 0; i < s.NextOutputIndex; i++ {
		if item, ok := itemsByIndex[i]; ok {
			output = append(output, item)
		}
	}
	return output
}
