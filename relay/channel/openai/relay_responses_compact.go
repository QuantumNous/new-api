package openai

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func OaiResponsesCompactionHandler(c *gin.Context, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var compactResp dto.OpenAIResponsesCompactionResponse
	if err := common.Unmarshal(responseBody, &compactResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oaiError := compactResp.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	usage := dto.Usage{}
	if compactResp.Usage != nil {
		usage.PromptTokens = compactResp.Usage.InputTokens
		usage.CompletionTokens = compactResp.Usage.OutputTokens
		usage.TotalTokens = compactResp.Usage.TotalTokens
		if compactResp.Usage.InputTokensDetails != nil {
			usage.PromptTokensDetails.CachedTokens = compactResp.Usage.InputTokensDetails.CachedTokens
		}
	}

	if shouldReturnResponsesCompactionEventStream(c) {
		if err := sendResponsesCompactionCompletedEvent(c, compactResp); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		return &usage, nil
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	return &usage, nil
}

func shouldReturnResponsesCompactionEventStream(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return false
	}
	return strings.Contains(strings.ToLower(c.Request.Header.Get("Accept")), "text/event-stream")
}

func sendResponsesCompactionCompletedEvent(c *gin.Context, compactResp dto.OpenAIResponsesCompactionResponse) error {
	if c == nil || c.Writer == nil {
		return nil
	}

	payload := map[string]any{
		"type":     "response.completed",
		"response": compactResp,
	}
	jsonData, err := common.Marshal(payload)
	if err != nil {
		return err
	}

	relayhelper.SetEventStreamHeaders(c)
	c.Render(-1, common.CustomEvent{Data: "event: response.completed\n"})
	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("data: %s", string(jsonData))})
	return relayhelper.FlushWriter(c)
}
