package ollama

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func ollamaAudioSTTHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, responseFormat string) (usage any, err *types.NewAPIError) {
	if info.IsStream {
		return ollamaAudioStreamHandler(c, resp, info)
	}

	defer service.CloseResponseBodyGracefully(resp)
	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewOpenAIError(readErr, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	usage = ollamaAudioUsage(responseBody, info)

	switch strings.ToLower(strings.TrimSpace(responseFormat)) {
	case "", "json":
		var audioResponse dto.AudioResponse
		if err := common.Unmarshal(responseBody, &audioResponse); err != nil {
			return usage, types.NewOpenAIError(fmt.Errorf("invalid ollama transcription response: %w", err), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		var marshalErr error
		responseBody, marshalErr = common.Marshal(audioResponse)
		if marshalErr != nil {
			return usage, types.NewOpenAIError(marshalErr, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
		}
	case "verbose_json":
		var audioResponse dto.WhisperVerboseJSONResponse
		if err := common.Unmarshal(responseBody, &audioResponse); err != nil {
			return usage, types.NewOpenAIError(fmt.Errorf("invalid ollama verbose transcription response: %w", err), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)
	return usage, nil
}

func ollamaAudioStreamHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)
	usage = ollamaAudioUsage(nil, info)

	for key, values := range resp.Header {
		if !service.ShouldCopyUpstreamHeader(c, key, values) {
			continue
		}
		c.Writer.Header().Set(key, values[0])
	}
	c.Writer.WriteHeader(resp.StatusCode)

	buffer := make([]byte, 32<<10)
	for {
		read, readErr := resp.Body.Read(buffer)
		if read > 0 {
			if _, writeErr := c.Writer.Write(buffer[:read]); writeErr != nil {
				return usage, types.NewOpenAIError(writeErr, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
			}
			c.Writer.Flush()
		}
		if readErr != nil {
			if errors.Is(readErr, io.EOF) {
				return usage, nil
			}
			return usage, types.NewOpenAIError(readErr, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
		}
	}
}

func ollamaAudioUsage(responseBody []byte, info *relaycommon.RelayInfo) *dto.Usage {
	var responseData struct {
		Usage *dto.Usage `json:"usage"`
	}
	if len(responseBody) > 0 && common.Unmarshal(responseBody, &responseData) == nil && responseData.Usage != nil && responseData.Usage.TotalTokens > 0 {
		usage := responseData.Usage
		if usage.PromptTokens == 0 {
			usage.PromptTokens = usage.InputTokens
		}
		if usage.CompletionTokens == 0 {
			usage.CompletionTokens = usage.OutputTokens
		}
		return usage
	}

	promptTokens := 0
	if info != nil {
		promptTokens = info.GetEstimatePromptTokens()
	}
	return &dto.Usage{
		PromptTokens: promptTokens,
		TotalTokens:  promptTokens,
	}
}
