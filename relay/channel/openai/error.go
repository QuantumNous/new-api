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

// upstreamErrorStatusCode prevents error payloads carried by HTTP 2xx from
// being exposed as successful relay responses.
func upstreamErrorStatusCode(statusCode int) int {
	return types.NormalizeUpstreamErrorStatusCode(statusCode)
}

// responsesStreamError recognizes terminal Responses API error event variants
// and normalizes them to a retry-aware relay error.
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

// writeConvertedStreamError emits a mid-stream failure in the converted
// Claude or OpenAI Chat protocol selected by the client.
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

// writeResponsesStreamError emits the flat type=error payload required by an
// already-started OpenAI Responses stream.
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
