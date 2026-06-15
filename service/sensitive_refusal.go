package service

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"
)

const defaultSensitiveRefusalText = "很抱歉，你输入的内容含有敏感信息，我无法回答。"

func GetSensitiveRefusalText() string {
	if setting.SensitiveRefusalText != "" {
		return setting.SensitiveRefusalText
	}
	return defaultSensitiveRefusalText
}

// WriteSensitiveRefusal writes a well-formed refusal response (200 OK) when sensitive
// words are detected. Returns true when the response was written successfully; false
// means the caller should fall back to returning a 400 error instead.
func WriteSensitiveRefusal(c *gin.Context, relayFormat types.RelayFormat, relayInfo *relaycommon.RelayInfo, request dto.Request) bool {
	text := GetSensitiveRefusalText()

	switch relayFormat {
	case types.RelayFormatOpenAI:
		// Only chat/completions requests have Messages; /v1/completions (Prompt) and
		// /v1/moderations (Input) share the same RelayFormat but have different schemas,
		// so fall back to 400 for those.
		r, ok := request.(*dto.GeneralOpenAIRequest)
		if !ok || len(r.Messages) == 0 {
			return false
		}
		if relayInfo != nil && relayInfo.IsStream {
			return writeOpenAIStreamRefusal(c, text, relayInfo)
		}
		return writeOpenAIRefusal(c, text, relayInfo)

	case types.RelayFormatClaude:
		if relayInfo != nil && relayInfo.IsStream {
			return writeClaudeStreamRefusal(c, text, relayInfo)
		}
		return writeClaudeRefusal(c, text, relayInfo)

	default:
		// RelayFormatOpenAIResponses, RelayFormatOpenAIResponsesCompaction,
		// RelayFormatGemini, RelayFormatEmbedding, RelayFormatRerank,
		// RelayFormatOpenAIAudio, RelayFormatOpenAIImage,
		// RelayFormatTask, RelayFormatMjProxy, RelayFormatOpenAIRealtime
		// — these have endpoint-specific schemas; fall back to 400 error.
		return false
	}
}

func writeOpenAIRefusal(c *gin.Context, text string, relayInfo *relaycommon.RelayInfo) bool {
	model := ""
	if relayInfo != nil {
		model = relayInfo.OriginModelName
	}
	resp := dto.OpenAITextResponse{
		Id:      fmt.Sprintf("chatcmpl-sensitive-%d", time.Now().UnixNano()),
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   model,
		Choices: []dto.OpenAITextResponseChoice{
			{
				Index: 0,
				Message: dto.Message{
					Role:    "assistant",
					Content: text,
				},
				FinishReason: "stop",
			},
		},
		Usage: dto.Usage{},
	}
	c.JSON(http.StatusOK, resp)
	return true
}

func writeOpenAIStreamRefusal(c *gin.Context, text string, relayInfo *relaycommon.RelayInfo) bool {
	model := ""
	if relayInfo != nil {
		model = relayInfo.OriginModelName
	}
	id := fmt.Sprintf("chatcmpl-sensitive-%d", time.Now().UnixNano())
	created := time.Now().Unix()
	stop := "stop"

	content := text
	delta := dto.ChatCompletionsStreamResponse{
		Id:      id,
		Object:  "chat.completion.chunk",
		Created: created,
		Model:   model,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Role:    "assistant",
					Content: &content,
				},
			},
		},
	}
	finishChunk := dto.ChatCompletionsStreamResponse{
		Id:      id,
		Object:  "chat.completion.chunk",
		Created: created,
		Model:   model,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index:        0,
				Delta:        dto.ChatCompletionsStreamResponseChoiceDelta{},
				FinishReason: &stop,
			},
		},
	}

	deltaJson, err1 := common.Marshal(delta)
	finishJson, err2 := common.Marshal(finishChunk)
	if err1 != nil || err2 != nil {
		return false
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Writer.WriteHeader(http.StatusOK)

	c.Render(-1, common.CustomEvent{Data: "data: " + string(deltaJson)})
	c.Render(-1, common.CustomEvent{Data: "data: " + string(finishJson)})
	c.Render(-1, common.CustomEvent{Data: "data: [DONE]"})
	_ = relayhelper.FlushWriter(c)
	return true
}

func writeClaudeRefusal(c *gin.Context, text string, relayInfo *relaycommon.RelayInfo) bool {
	model := ""
	if relayInfo != nil {
		model = relayInfo.OriginModelName
	}
	textCopy := text
	resp := dto.ClaudeResponse{
		Id:    fmt.Sprintf("msg_sensitive_%d", time.Now().UnixNano()),
		Type:  "message",
		Role:  "assistant",
		Model: model,
		Content: []dto.ClaudeMediaMessage{
			{Type: "text", Text: &textCopy},
		},
		StopReason: "end_turn",
		Usage:      &dto.ClaudeUsage{},
	}
	c.JSON(http.StatusOK, resp)
	return true
}

func writeClaudeStreamRefusal(c *gin.Context, text string, relayInfo *relaycommon.RelayInfo) bool {
	model := ""
	if relayInfo != nil {
		model = relayInfo.OriginModelName
	}
	msgId := fmt.Sprintf("msg_sensitive_%d", time.Now().UnixNano())
	textCopy := text
	index := 0
	emptyStr := ""
	stopReason := "end_turn"

	events := []dto.ClaudeResponse{
		{
			Type: "message_start",
			Message: &dto.ClaudeMediaMessage{
				Id:    msgId,
				Type:  "message",
				Role:  "assistant",
				Model: model,
				Usage: &dto.ClaudeUsage{},
			},
		},
		{
			Type:         "content_block_start",
			Index:        &index,
			ContentBlock: &dto.ClaudeMediaMessage{Type: "text", Text: &emptyStr},
		},
		{
			Type:  "content_block_delta",
			Index: &index,
			Delta: &dto.ClaudeMediaMessage{Type: "text_delta", Text: &textCopy},
		},
		{
			Type:  "content_block_stop",
			Index: &index,
		},
		{
			// stop_reason goes inside delta per Anthropic SSE spec
			Type:  "message_delta",
			Delta: &dto.ClaudeMediaMessage{StopReason: &stopReason},
			Usage: &dto.ClaudeUsage{},
		},
		{
			Type: "message_stop",
		},
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Writer.WriteHeader(http.StatusOK)

	for _, ev := range events {
		_ = relayhelper.ClaudeData(c, ev)
	}
	return true
}
