package helper

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/gin-gonic/gin"
)

// WriteProjectedStreamResults writes IR-projected stream values in the client format.
func WriteProjectedStreamResults(c *gin.Context, info *relaycommon.RelayInfo, results []relayconvert.ResponseResult) error {
	for _, result := range results {
		if err := WriteProjectedStreamValue(c, info, result.Value); err != nil {
			return err
		}
	}
	return nil
}

// WriteProjectedStreamValue emits one converted stream value as SSE.
func WriteProjectedStreamValue(c *gin.Context, info *relaycommon.RelayInfo, value any) error {
	if value == nil {
		return nil
	}
	switch typed := value.(type) {
	case dto.ChatCompletionsStreamResponse:
		return WriteChatCompletionsStream(c, info, &typed)
	case *dto.ChatCompletionsStreamResponse:
		return WriteChatCompletionsStream(c, info, typed)
	case dto.ClaudeResponse:
		return ClaudeData(c, typed)
	case *dto.ClaudeResponse:
		if typed == nil {
			return nil
		}
		return ClaudeData(c, *typed)
	case []*dto.ClaudeResponse:
		for _, event := range typed {
			if event == nil {
				continue
			}
			if err := ClaudeData(c, *event); err != nil {
				return err
			}
		}
		return nil
	case dto.GeminiChatResponse:
		return writeGeminiStream(c, &typed)
	case *dto.GeminiChatResponse:
		return writeGeminiStream(c, typed)
	case relayconvert.ChatToResponsesStreamEvent:
		return writeResponsesStreamEvent(c, typed)
	case dto.ResponsesStreamResponse:
		return writeResponsesPayload(c, typed)
	case *dto.ResponsesStreamResponse:
		if typed == nil {
			return nil
		}
		return writeResponsesPayload(c, *typed)
	default:
		return fmt.Errorf("unsupported projected stream type %T", value)
	}
}

// WriteChatCompletionsStream writes a Chat Completions chunk, applying channel
// dialect (force format / thinking_to_content) when requested.
func WriteChatCompletionsStream(c *gin.Context, info *relaycommon.RelayInfo, chunk *dto.ChatCompletionsStreamResponse) error {
	if chunk == nil {
		return nil
	}
	if len(chunk.Choices) == 0 && chunk.Usage == nil {
		return nil
	}
	if info == nil {
		return ObjectData(c, chunk)
	}
	data, err := common.Marshal(chunk)
	if err != nil {
		return err
	}
	return WriteChatCompletionsStreamData(c, info, string(data), info.ChannelSetting.ForceFormat, info.ChannelSetting.ThinkingToContent)
}

// WriteChatCompletionsStreamData is the Chat SSE dialect: optional re-marshal
// (ForceFormat) and thinking_to_content wrapping.
func WriteChatCompletionsStreamData(c *gin.Context, info *relaycommon.RelayInfo, data string, forceFormat bool, thinkToContent bool) error {
	if data == "" {
		return nil
	}
	if !forceFormat && !thinkToContent {
		return StringData(c, data)
	}

	var lastStreamResponse dto.ChatCompletionsStreamResponse
	if err := common.UnmarshalJsonStr(data, &lastStreamResponse); err != nil {
		return err
	}
	if !thinkToContent {
		return ObjectData(c, lastStreamResponse)
	}
	if info == nil {
		return ObjectData(c, lastStreamResponse)
	}

	hasThinkingContent := false
	hasContent := false
	var thinkingContent strings.Builder
	for _, choice := range lastStreamResponse.Choices {
		if len(choice.Delta.GetReasoningContent()) > 0 {
			hasThinkingContent = true
			thinkingContent.WriteString(choice.Delta.GetReasoningContent())
		}
		if len(choice.Delta.GetContentString()) > 0 {
			hasContent = true
		}
	}

	if info.ThinkingContentInfo.IsFirstThinkingContent {
		if hasThinkingContent {
			response := lastStreamResponse.Copy()
			for i := range response.Choices {
				response.Choices[i].Delta.SetContentString("<think>\n" + thinkingContent.String())
				response.Choices[i].Delta.ReasoningContent = nil
				response.Choices[i].Delta.Reasoning = nil
			}
			info.ThinkingContentInfo.IsFirstThinkingContent = false
			info.ThinkingContentInfo.HasSentThinkingContent = true
			return ObjectData(c, response)
		}
	}

	if len(lastStreamResponse.Choices) == 0 {
		return ObjectData(c, lastStreamResponse)
	}

	for i, choice := range lastStreamResponse.Choices {
		if hasContent && !info.ThinkingContentInfo.SendLastThinkingContent && info.ThinkingContentInfo.HasSentThinkingContent {
			response := lastStreamResponse.Copy()
			for j := range response.Choices {
				response.Choices[j].Delta.SetContentString("\n</think>\n")
				response.Choices[j].Delta.ReasoningContent = nil
				response.Choices[j].Delta.Reasoning = nil
			}
			info.ThinkingContentInfo.SendLastThinkingContent = true
			_ = ObjectData(c, response)
		}

		if len(choice.Delta.GetReasoningContent()) > 0 {
			lastStreamResponse.Choices[i].Delta.SetContentString(choice.Delta.GetReasoningContent())
			lastStreamResponse.Choices[i].Delta.ReasoningContent = nil
			lastStreamResponse.Choices[i].Delta.Reasoning = nil
		} else if !hasThinkingContent && !hasContent {
			lastStreamResponse.Choices[i].Delta.ReasoningContent = nil
			lastStreamResponse.Choices[i].Delta.Reasoning = nil
		}
	}

	return ObjectData(c, lastStreamResponse)
}

func writeGeminiStream(c *gin.Context, response *dto.GeminiChatResponse) error {
	if response == nil {
		return nil
	}
	payload, err := common.Marshal(response)
	if err != nil {
		return err
	}
	c.Render(-1, common.CustomEvent{Data: "data: " + string(payload)})
	return FlushWriter(c)
}

func writeResponsesStreamEvent(c *gin.Context, event relayconvert.ChatToResponsesStreamEvent) error {
	return writeResponsesPayload(c, event.Payload)
}

func writeResponsesPayload(c *gin.Context, event dto.ResponsesStreamResponse) error {
	data, err := common.Marshal(event)
	if err != nil {
		return err
	}
	return ResponseChunkData(c, dto.ResponsesStreamResponse{Type: event.Type}, string(data))
}
