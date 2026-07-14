package openai

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func upstreamErrorStatusCode(statusCode int) int {
	return types.NormalizeUpstreamErrorStatusCode(statusCode)
}

func responsesStreamError(event *dto.ResponsesStreamResponse) *types.NewAPIError {
	if event == nil {
		return nil
	}
	switch event.Type {
	case "error", "response.error", "response.failed":
		if openAIError := event.GetOpenAIError(); openAIError != nil && openAIError.Type != "" {
			return types.WithOpenAIError(*openAIError, http.StatusBadGateway)
		}
		return types.NewOpenAIError(fmt.Errorf("responses stream error: %s", event.Type), types.ErrorCodeBadResponse, http.StatusBadGateway)
	default:
		return nil
	}
}

func writeConvertedStreamError(c *gin.Context, info *relaycommon.RelayInfo, apiErr *types.NewAPIError) {
	if apiErr == nil {
		return
	}
	if info != nil && info.RelayFormat == types.RelayFormatClaude {
		_ = helper.ClaudeData(c, dto.ClaudeResponse{Type: "error", Error: apiErr.ToClaudeError()})
		return
	}
	_ = helper.ObjectData(c, gin.H{"error": apiErr.ToOpenAIError()})
}

func writeResponsesStreamError(c *gin.Context, apiErr *types.NewAPIError) {
	if apiErr == nil {
		return
	}
	openAIError := apiErr.ToOpenAIError()
	_ = helper.ObjectData(c, gin.H{
		"type":    "error",
		"code":    openAIError.Code,
		"message": openAIError.Message,
		"param":   openAIError.Param,
	})
}
