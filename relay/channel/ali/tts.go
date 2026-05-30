package ali

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type AliTTSRequest struct {
	Model      string                 `json:"model"`
	Input      AliTTSInput            `json:"input"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
}

type AliTTSInput struct {
	Text  string `json:"text"`
	Voice string `json:"voice,omitempty"`
}

type AliTTSResponse struct {
	Output struct {
		Audio struct {
			Url  string `json:"url,omitempty"`
			Data string `json:"data,omitempty"`
		} `json:"audio,omitempty"`
	} `json:"output"`
	Usage AliUsage `json:"usage"`
	AliError
}

func convertOpenAIToAliTTS(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	parameters := map[string]interface{}{}
	if request.ResponseFormat != "" {
		parameters["format"] = request.ResponseFormat
	}
	if request.Speed != nil {
		parameters["speed"] = *request.Speed
	}
	if len(request.Metadata) > 0 {
		var metadata map[string]interface{}
		if err := json.Unmarshal(request.Metadata, &metadata); err != nil {
			return nil, fmt.Errorf("error unmarshalling metadata to ali tts parameters: %w", err)
		}
		for key, value := range metadata {
			parameters[key] = value
		}
	}

	aliReq := AliTTSRequest{
		Model: request.Model,
		Input: AliTTSInput{
			Text:  request.Input,
			Voice: request.Voice,
		},
		Parameters: parameters,
	}
	if len(parameters) == 0 {
		aliReq.Parameters = nil
	}

	jsonData, err := common.Marshal(aliReq)
	if err != nil {
		return nil, fmt.Errorf("error marshalling ali tts request: %w", err)
	}
	return bytes.NewReader(jsonData), nil
}

func convertAliVoiceClone(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	body, err := storage.Bytes()
	if err != nil {
		return nil, err
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	if request.Model != "" {
		payload["model"] = request.Model
	}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(jsonData), nil
}

func aliTTSHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.Usage) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("failed to read ali tts response: %w", err),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		), nil
	}
	defer service.CloseResponseBodyGracefully(resp)

	var aliResp AliTTSResponse
	if err := common.Unmarshal(body, &aliResp); err != nil {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("failed to unmarshal ali tts response: %w", err),
			types.ErrorCodeBadResponseBody,
			http.StatusInternalServerError,
		), nil
	}
	if aliResp.Code != "" {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("ali tts error: %s - %s", aliResp.Code, aliResp.Message),
			types.ErrorCodeBadResponse,
			http.StatusBadRequest,
		), nil
	}

	if aliResp.Output.Audio.Url != "" {
		c.Redirect(http.StatusFound, aliResp.Output.Audio.Url)
	} else if aliResp.Output.Audio.Data != "" {
		audioData := aliResp.Output.Audio.Data
		if comma := strings.Index(audioData, ","); comma >= 0 {
			audioData = audioData[comma+1:]
		}
		decoded, decodeErr := base64.StdEncoding.DecodeString(audioData)
		if decodeErr != nil {
			return types.NewErrorWithStatusCode(
				fmt.Errorf("failed to decode ali tts audio data: %w", decodeErr),
				types.ErrorCodeBadResponse,
				http.StatusInternalServerError,
			), nil
		}
		c.Data(http.StatusOK, "audio/mpeg", decoded)
	} else {
		c.Data(resp.StatusCode, "application/json", body)
	}

	promptTokens := info.GetEstimatePromptTokens()
	totalTokens := aliResp.Usage.TotalTokens
	if totalTokens == 0 {
		totalTokens = promptTokens
	}
	if aliResp.Usage.InputTokens > 0 {
		promptTokens = aliResp.Usage.InputTokens
	}
	audioTokens := common.Max(totalTokens-promptTokens, 0)
	return nil, &dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: audioTokens,
		TotalTokens:      totalTokens,
		PromptTokensDetails: dto.InputTokenDetails{
			TextTokens: promptTokens,
		},
		CompletionTokenDetails: dto.OutputTokenDetails{
			AudioTokens: audioTokens,
		},
	}
}

func aliVoiceCloneHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.Usage) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("failed to read ali voice clone response: %w", err),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		), nil
	}
	defer service.CloseResponseBodyGracefully(resp)

	var aliResp AliResponse
	if err := common.Unmarshal(body, &aliResp); err == nil && aliResp.Code != "" {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("ali voice clone error: %s - %s", aliResp.Code, aliResp.Message),
			types.ErrorCodeBadResponse,
			http.StatusBadRequest,
		), nil
	}

	c.Data(resp.StatusCode, "application/json", body)
	totalTokens := info.GetEstimatePromptTokens()
	if totalTokens == 0 {
		totalTokens = 1
	}
	return nil, &dto.Usage{
		PromptTokens: totalTokens,
		TotalTokens:  totalTokens,
	}
}
