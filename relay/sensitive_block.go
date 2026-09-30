package relay

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// HandleSensitiveWordsDetected records an interception log and, when the relay
// format supports it, writes a simulated successful model reply. Returns true
// when a simulated reply was written so the caller should not emit an error body.
func HandleSensitiveWordsDetected(c *gin.Context, info *relaycommon.RelayInfo, words []string) (simulated bool, err error) {
	reply := setting.GetSensitiveBlockReply()
	canSimulate := canSimulateSensitiveReply(info)
	service.RecordSensitiveBlockLog(c, info, words, canSimulate)

	if !canSimulate {
		return false, nil
	}

	modelName := ""
	if info != nil {
		modelName = info.OriginModelName
	}
	if modelName == "" {
		modelName = c.GetString("original_model")
	}

	switch {
	case info != nil && info.RelayFormat == types.RelayFormatClaude:
		err = writeClaudeSensitiveReply(c, info, modelName, reply)
	case info != nil && info.RelayFormat == types.RelayFormatGemini:
		err = writeGeminiSensitiveReply(c, reply)
	case info != nil && info.RelayFormat == types.RelayFormatOpenAIResponses:
		err = writeOpenAIResponsesSensitiveReply(c, modelName, reply)
	default:
		err = writeOpenAISensitiveReply(c, info, modelName, reply)
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func canSimulateSensitiveReply(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return true
	}
	switch info.RelayFormat {
	case types.RelayFormatOpenAI, types.RelayFormatClaude:
		return true
	case types.RelayFormatGemini:
		return !info.IsStream
	case types.RelayFormatOpenAIResponses:
		return !info.IsStream
	default:
		return false
	}
}

func writeOpenAISensitiveReply(c *gin.Context, info *relaycommon.RelayInfo, modelName, reply string) error {
	created := common.GetTimestamp()
	responseID := helper.GetResponseID(c)
	isStream := info != nil && info.IsStream

	if isStream {
		helper.SetEventStreamHeaders(c)
		start := helper.GenerateStartEmptyResponse(responseID, created, modelName, nil)
		if err := helper.ObjectData(c, start); err != nil {
			return err
		}
		contentChunk := &dto.ChatCompletionsStreamResponse{
			Id:      responseID,
			Object:  "chat.completion.chunk",
			Created: created,
			Model:   modelName,
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{
					Index: 0,
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{},
				},
			},
		}
		contentChunk.Choices[0].Delta.SetContentString(reply)
		if err := helper.ObjectData(c, contentChunk); err != nil {
			return err
		}
		if stop := helper.GenerateStopResponse(responseID, created, modelName, "stop"); stop != nil {
			if err := helper.ObjectData(c, stop); err != nil {
				return err
			}
		}
		helper.Done(c)
		return nil
	}

	message := dto.Message{Role: "assistant"}
	message.SetStringContent(reply)
	c.JSON(http.StatusOK, dto.OpenAITextResponse{
		Id:      responseID,
		Model:   modelName,
		Object:  "chat.completion",
		Created: created,
		Choices: []dto.OpenAITextResponseChoice{
			{
				Index:        0,
				Message:      message,
				FinishReason: "stop",
			},
		},
		Usage: dto.Usage{},
	})
	return nil
}

func writeClaudeSensitiveReply(c *gin.Context, info *relaycommon.RelayInfo, modelName, reply string) error {
	createdID := fmt.Sprintf("msg_%s", c.GetString(common.RequestIdKey))
	if createdID == "msg_" {
		createdID = helper.GetResponseID(c)
	}
	textBlock := dto.ClaudeMediaMessage{Type: "text"}
	textBlock.SetText(reply)

	if info != nil && info.IsStream {
		helper.SetEventStreamHeaders(c)
		_ = helper.ClaudeData(c, dto.ClaudeResponse{
			Type: "message_start",
			Message: &dto.ClaudeMediaMessage{
				Id:    createdID,
				Type:  "message",
				Role:  "assistant",
				Model: modelName,
			},
		})
		index := 0
		_ = helper.ClaudeData(c, dto.ClaudeResponse{
			Type:  "content_block_start",
			Index: &index,
			ContentBlock: &dto.ClaudeMediaMessage{
				Type: "text",
			},
		})
		delta := dto.ClaudeMediaMessage{Type: "text_delta"}
		delta.SetText(reply)
		_ = helper.ClaudeData(c, dto.ClaudeResponse{
			Type:  "content_block_delta",
			Index: &index,
			Delta: &delta,
		})
		_ = helper.ClaudeData(c, dto.ClaudeResponse{
			Type:  "content_block_stop",
			Index: &index,
		})
		_ = helper.ClaudeData(c, dto.ClaudeResponse{
			Type: "message_delta",
			Usage: &dto.ClaudeUsage{
				OutputTokens: 0,
			},
			Delta: &dto.ClaudeMediaMessage{
				StopReason: common.GetPointer("end_turn"),
			},
		})
		_ = helper.ClaudeData(c, dto.ClaudeResponse{Type: "message_stop"})
		return nil
	}

	c.JSON(http.StatusOK, dto.ClaudeResponse{
		Id:         createdID,
		Type:       "message",
		Role:       "assistant",
		Model:      modelName,
		Content:    []dto.ClaudeMediaMessage{textBlock},
		StopReason: "end_turn",
		Usage: &dto.ClaudeUsage{
			InputTokens:  0,
			OutputTokens: 0,
		},
	})
	return nil
}

func writeGeminiSensitiveReply(c *gin.Context, reply string) error {
	finishReason := "STOP"
	c.JSON(http.StatusOK, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Role: "model",
					Parts: []dto.GeminiPart{
						{Text: reply},
					},
				},
				FinishReason: &finishReason,
				Index:        0,
			},
		},
	})
	return nil
}

func writeOpenAIResponsesSensitiveReply(c *gin.Context, modelName, reply string) error {
	responseID := fmt.Sprintf("resp_%s", c.GetString(common.RequestIdKey))
	if responseID == "resp_" {
		responseID = helper.GetResponseID(c)
	}
	msgID := fmt.Sprintf("msg_%s", c.GetString(common.RequestIdKey))
	status, err := common.Marshal("completed")
	if err != nil {
		return err
	}
	c.JSON(http.StatusOK, dto.OpenAIResponsesResponse{
		ID:        responseID,
		Object:    "response",
		CreatedAt: dto.IntValue(common.GetTimestamp()),
		Status:    status,
		Model:     modelName,
		Output: []dto.ResponsesOutput{
			{
				Type:   "message",
				ID:     msgID,
				Status: "completed",
				Role:   "assistant",
				Content: []dto.ResponsesOutputContent{
					{
						Type:        "output_text",
						Text:        reply,
						Annotations: []any{},
					},
				},
			},
		},
		Usage: &dto.Usage{},
	})
	return nil
}
