package ali

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
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
		Data struct {
			Audio  string `json:"audio,omitempty"`
			Status int    `json:"status,omitempty"`
		} `json:"data,omitempty"`
		ExtraInfo struct {
			AudioFormat     string `json:"audio_format,omitempty"`
			UsageCharacters int    `json:"usage_characters,omitempty"`
		} `json:"extra_info,omitempty"`
		BaseResp struct {
			StatusCode int    `json:"status_code,omitempty"`
			StatusMsg  string `json:"status_msg,omitempty"`
		} `json:"base_resp,omitempty"`
	} `json:"output"`
	Usage AliUsage `json:"usage"`
	AliError
}

func convertOpenAIToAliTTS(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	if isAliMiniMaxSpeechModel(request.Model) {
		return convertOpenAIToAliMiniMaxTTS(c, info, request)
	}

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

func convertOpenAIToAliMiniMaxTTS(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	input := map[string]interface{}{
		"text": request.Input,
	}
	voiceSetting := map[string]interface{}{}
	if request.Voice != "" {
		voiceSetting["voice_id"] = request.Voice
	}
	if request.Speed != nil {
		voiceSetting["speed"] = *request.Speed
	}
	if len(voiceSetting) > 0 {
		input["voice_setting"] = voiceSetting
	}
	if request.ResponseFormat != "" {
		input["audio_setting"] = map[string]interface{}{
			"format": request.ResponseFormat,
		}
	}
	if len(request.Metadata) > 0 {
		var metadata map[string]interface{}
		if err := json.Unmarshal(request.Metadata, &metadata); err != nil {
			return nil, fmt.Errorf("error unmarshalling metadata to ali minimax tts input: %w", err)
		}
		for key, value := range metadata {
			input[key] = value
		}
	}
	aliReq := map[string]interface{}{
		"model": request.Model,
		"input": input,
	}
	jsonData, err := common.Marshal(aliReq)
	if err != nil {
		return nil, fmt.Errorf("error marshalling ali minimax tts request: %w", err)
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

func isAliMiniMaxSpeechModel(model string) bool {
	model = strings.TrimSpace(model)
	return strings.HasPrefix(model, "MiniMax/") || strings.HasPrefix(model, "speech-")
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
	if aliResp.Output.BaseResp.StatusCode != 0 && aliResp.Output.BaseResp.StatusMsg != "" {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("ali minimax tts error: %d - %s", aliResp.Output.BaseResp.StatusCode, aliResp.Output.BaseResp.StatusMsg),
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
	} else if aliResp.Output.Data.Audio != "" {
		if strings.HasPrefix(aliResp.Output.Data.Audio, "http") {
			c.Redirect(http.StatusFound, aliResp.Output.Data.Audio)
		} else {
			decoded, decodeErr := hex.DecodeString(aliResp.Output.Data.Audio)
			if decodeErr != nil {
				return types.NewErrorWithStatusCode(
					fmt.Errorf("failed to decode ali minimax audio data: %w", decodeErr),
					types.ErrorCodeBadResponse,
					http.StatusInternalServerError,
				), nil
			}
			contentType := "audio/mpeg"
			switch strings.ToLower(aliResp.Output.ExtraInfo.AudioFormat) {
			case "wav":
				contentType = "audio/wav"
			case "flac":
				contentType = "audio/flac"
			case "aac":
				contentType = "audio/aac"
			case "pcm":
				contentType = "audio/pcm"
			}
			c.Data(http.StatusOK, contentType, decoded)
		}
	} else {
		c.Data(resp.StatusCode, "application/json", body)
	}

	promptTokens := info.GetEstimatePromptTokens()
	if aliResp.Usage.Count > 0 {
		promptTokens = aliResp.Usage.Count
	} else if aliResp.Output.ExtraInfo.UsageCharacters > 0 {
		promptTokens = aliResp.Output.ExtraInfo.UsageCharacters
	}
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

// AliVoiceCloneResponse 阿里语音克隆响应结构
type AliVoiceCloneResponse struct {
	Output struct {
		Voice   string `json:"voice,omitempty"`
		VoiceID string `json:"voice_id,omitempty"`
	} `json:"output"`
	Usage struct {
		Count      int `json:"count,omitempty"`      // CosyVoice: 按次计费
		Characters int `json:"characters,omitempty"` // Qwen: 按字符计费（当传入text时）
	} `json:"usage"`
	RequestID string `json:"request_id"`
	AliError
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

	var cloneResp AliVoiceCloneResponse
	if err := common.Unmarshal(body, &cloneResp); err == nil && cloneResp.Code != "" {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("ali voice clone error: %s - %s", cloneResp.Code, cloneResp.Message),
			types.ErrorCodeBadResponse,
			http.StatusBadRequest,
		), nil
	}

	c.Data(resp.StatusCode, "application/json", body)

	// 计算使用量
	// 1. 基础创建费用（按次）- 通过 model_price 配置
	// 2. 样例音频字符数（当传入 text 时）- 通过 usage.characters 计费
	promptTokens := info.GetEstimatePromptTokens()
	if promptTokens == 0 {
		promptTokens = 1 // 至少计费1个token（创建操作）
	}

	// 如果有样例音频字符数（Qwen传入text时），计入completion tokens
	completionTokens := 0
	if cloneResp.Usage.Characters > 0 {
		completionTokens = cloneResp.Usage.Characters
	}

	return nil, &dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalTokens:      promptTokens + completionTokens,
		PromptTokensDetails: dto.InputTokenDetails{
			TextTokens: promptTokens,
		},
		CompletionTokenDetails: dto.OutputTokenDetails{
			AudioTokens: completionTokens,
		},
	}
}
