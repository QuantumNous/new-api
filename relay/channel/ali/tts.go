package ali

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

type AliTTSRequest struct {
	Model string      `json:"model"`
	Input AliTTSInput `json:"input"`
}

type AliTTSInput struct {
	Text         string  `json:"text"`
	Voice        string  `json:"voice,omitempty"`
	LanguageType string  `json:"language_type,omitempty"`
	Speed        float64 `json:"speed,omitempty"`
	Volume       float64 `json:"volume,omitempty"`
	Pitch        float64 `json:"pitch,omitempty"`
}

type AliTTSResponse struct {
	Output    AliTTSOutput `json:"output"`
	Usage     AliTTSUsage  `json:"usage"`
	RequestID string       `json:"request_id"`
	Code      string       `json:"code,omitempty"`
	Message   string       `json:"message,omitempty"`
}

type AliTTSOutput struct {
	Audio AliTTSAudio `json:"audio,omitempty"`
}

type AliTTSAudio struct {
	URL       string `json:"url,omitempty"`
	Data      string `json:"data,omitempty"`
	ID        string `json:"id,omitempty"`
	ExpiresAt int64  `json:"expires_at,omitempty"`
}

type AliTTSUsage struct {
	Characters int `json:"characters"`
}

var openAIToAliVoiceMap = map[string]string{
	"alloy":   "Cherry",
	"echo":    "Alex",
	"fable":   "Bella",
	"onyx":    "Olivia",
	"nova":    "Luna",
	"shimmer": "Emily",
}

func mapOpenAIVoiceToAli(openAIVoice string) string {
	if voice, ok := openAIToAliVoiceMap[openAIVoice]; ok {
		return voice
	}
	return openAIVoice
}

func convertOpenAITTSRequestToAli(oaiReq dto.AudioRequest) *AliTTSRequest {
	aliReq := &AliTTSRequest{
		Model: oaiReq.Model,
		Input: AliTTSInput{
			Text:         oaiReq.Input,
			Voice:        mapOpenAIVoiceToAli(oaiReq.Voice),
			LanguageType: "Chinese",
		},
	}

	if oaiReq.Speed != nil && *oaiReq.Speed > 0 {
		aliReq.Input.Speed = *oaiReq.Speed
	}

	return aliReq
}

func handleAliTTSResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to read ali TTS response: %w", readErr),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}
	defer resp.Body.Close()

	var aliResp AliTTSResponse
	if unmarshalErr := common.Unmarshal(body, &aliResp); unmarshalErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to unmarshal ali TTS response: %w", unmarshalErr),
			types.ErrorCodeBadResponseBody,
			http.StatusInternalServerError,
		)
	}

	if aliResp.Code != "" && aliResp.Code != "Success" {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("ali TTS error: %s - %s", aliResp.Code, aliResp.Message),
			types.ErrorCodeBadResponse,
			http.StatusBadRequest,
		)
	}

	// 优先使用 URL，如果没有则使用 base64 data
	if aliResp.Output.Audio.URL != "" {
		c.Redirect(http.StatusFound, aliResp.Output.Audio.URL)
	} else if aliResp.Output.Audio.Data != "" {
		// 如果是 base64 编码的音频数据
		audioData, decodeErr := base64.StdEncoding.DecodeString(aliResp.Output.Audio.Data)
		if decodeErr != nil {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("failed to decode audio data: %w", decodeErr),
				types.ErrorCodeBadResponse,
				http.StatusInternalServerError,
			)
		}
		c.Data(http.StatusOK, "audio/mpeg", audioData)
	} else {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("no audio URL or data in ali TTS response"),
			types.ErrorCodeBadResponse,
			http.StatusBadRequest,
		)
	}

	usage = &dto.Usage{
		PromptTokens:     info.GetEstimatePromptTokens(),
		CompletionTokens: 0,
		TotalTokens:      aliResp.Usage.Characters,
	}

	return usage, nil
}
