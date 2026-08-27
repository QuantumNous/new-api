package openai

import (
	"strings"

	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
)

type chatStreamToolSlot struct {
	choice int
	index  int
}

type chatStreamToolID struct {
	choice int
	id     string
}

type chatStreamToolStats struct {
	id   string
	name string
}

// chatStreamStats accumulates token-estimation text and logical tool calls from
// an OpenAI Chat Completions stream. Tool identity is stable across argument
// fragments: choice/index is the primary slot and call ID is an alias. A new ID
// reusing a slot starts a new logical call instead of merging or double-billing
// fragments from the previous call.
type chatStreamStats struct {
	text   strings.Builder
	tools  []*chatStreamToolStats
	bySlot map[chatStreamToolSlot]int
	byID   map[chatStreamToolID]int
}

func newChatStreamStats() *chatStreamStats {
	return &chatStreamStats{
		bySlot: make(map[chatStreamToolSlot]int),
		byID:   make(map[chatStreamToolID]int),
	}
}

func (s *chatStreamStats) Observe(streamResponse dto.ChatCompletionsStreamResponse) {
	if s == nil {
		return
	}
	for _, choice := range streamResponse.Choices {
		s.text.WriteString(choice.Delta.GetContentString())
		s.text.WriteString(choice.Delta.GetReasoningContent())
		for position, toolCall := range choice.Delta.ToolCalls {
			toolIndex := position
			if toolCall.Index != nil {
				toolIndex = *toolCall.Index
			}
			tool := s.resolveTool(choice.Index, toolIndex, toolCall.ID)
			if tool.name == "" && toolCall.Function.Name != "" {
				tool.name = toolCall.Function.Name
				s.text.WriteString(tool.name)
			}
			s.text.WriteString(toolCall.Function.Arguments)
		}
	}
}

func (s *chatStreamStats) resolveTool(choiceIndex, toolIndex int, callID string) *chatStreamToolStats {
	if callID != "" {
		if index, ok := s.byID[chatStreamToolID{choice: choiceIndex, id: callID}]; ok {
			return s.tools[index]
		}
	}

	slot := chatStreamToolSlot{choice: choiceIndex, index: toolIndex}
	if index, ok := s.bySlot[slot]; ok {
		tool := s.tools[index]
		if callID == "" || tool.id == "" || tool.id == callID {
			if callID != "" && tool.id == "" {
				tool.id = callID
				s.byID[chatStreamToolID{choice: choiceIndex, id: callID}] = index
			}
			return tool
		}
	}

	tool := &chatStreamToolStats{id: callID}
	index := len(s.tools)
	s.tools = append(s.tools, tool)
	s.bySlot[slot] = index
	if callID != "" {
		s.byID[chatStreamToolID{choice: choiceIndex, id: callID}] = index
	}
	return tool
}

func (s *chatStreamStats) Text() string {
	if s == nil {
		return ""
	}
	return s.text.String()
}

func (s *chatStreamStats) ToolCount() int {
	if s == nil {
		return 0
	}
	return len(s.tools)
}

func (s *chatStreamStats) FunctionCallNames() []string {
	if s == nil {
		return nil
	}
	names := make([]string, 0, len(s.tools))
	for _, tool := range s.tools {
		if tool != nil && tool.name != "" {
			names = append(names, tool.name)
		}
	}
	return names
}

// ProcessStreamResponse is retained for channel-specific stream handlers that
// already own their lifecycle. OaiStreamHandler uses chatStreamStats so logical
// tool calls are deduplicated across the complete stream.
func ProcessStreamResponse(streamResponse dto.ChatCompletionsStreamResponse, responseTextBuilder *strings.Builder, toolCount *int) error {
	for _, choice := range streamResponse.Choices {
		responseTextBuilder.WriteString(choice.Delta.GetContentString())
		responseTextBuilder.WriteString(choice.Delta.GetReasoningContent())
		if len(choice.Delta.ToolCalls) > *toolCount {
			*toolCount = len(choice.Delta.ToolCalls)
		}
		for _, tool := range choice.Delta.ToolCalls {
			responseTextBuilder.WriteString(tool.Function.Name)
			responseTextBuilder.WriteString(tool.Function.Arguments)
		}
	}
	return nil
}

func processCompletionsStreamResponse(streamResponse dto.CompletionsStreamResponse, responseTextBuilder *strings.Builder) {
	for _, choice := range streamResponse.Choices {
		responseTextBuilder.WriteString(choice.Text)
	}
}

func sendResponsesStreamData(c *gin.Context, streamResponse dto.ResponsesStreamResponse, data string) {
	if data == "" {
		return
	}
	_ = helper.ResponseChunkData(c, streamResponse, data)
}
