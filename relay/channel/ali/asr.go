package ali

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// isQwenASRModel 判断是否走 ASR 路径（chat/completions + input_audio，而非标准 whisper 接口）。
func isQwenASRModel(modelName string) bool {
	return strings.Contains(strings.ToLower(modelName), "asr")
}

// asr_options 在请求体顶层（SDK 中通过 extra_body 传入）。
type qwenASRChatRequest struct {
	Model      string           `json:"model"`
	Messages   []qwenASRMessage `json:"messages"`
	Stream     bool             `json:"stream"`
	ASROptions *qwenASROptions  `json:"asr_options,omitempty"`
}

type qwenASRMessage struct {
	Role    string           `json:"role"`
	Content []qwenASRContent `json:"content"`
}

type qwenASRContent struct {
	Type       string          `json:"type"`
	InputAudio *qwenInputAudio `json:"input_audio,omitempty"`
}

type qwenInputAudio struct {
	Data string `json:"data"`
}

type qwenASROptions struct {
	Language  string `json:"language,omitempty"`
	EnableITN *bool  `json:"enable_itn,omitempty"`
}

// 未启用对象存储时中间件透传原始文件，回退为 Base64，使 ASR 不硬依赖 OSS。
func asrAudioData(c *gin.Context) (string, error) {
	if urls := c.PostFormArray("file"); len(urls) > 0 && urls[0] != "" {
		return urls[0], nil
	}

	b64s, err := relaycommon.GetBase64sFromForm(c, "file")
	if err != nil {
		return "", err
	}
	return b64s[0].String(), nil
}

func (a *Adaptor) convertASRRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	audioData, err := asrAudioData(c)
	if err != nil {
		return nil, err
	}

	asrReq := qwenASRChatRequest{
		Model:  info.UpstreamModelName,
		Stream: false,
		Messages: []qwenASRMessage{
			{
				Role: "user",
				Content: []qwenASRContent{
					{
						Type:       "input_audio",
						InputAudio: &qwenInputAudio{Data: audioData},
					},
				},
			},
		},
	}

	var options qwenASROptions
	hasOptions := false
	if request.Language != nil {
		var lang string
		if err := common.Unmarshal(request.Language, &lang); err == nil && lang != "" {
			options.Language = lang
			hasOptions = true
		}
	}
	if v := c.PostForm("enable_itn"); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			options.EnableITN = &b
			hasOptions = true
		}
	}
	if hasOptions {
		asrReq.ASROptions = &options
	}

	jsonData, err := common.Marshal(asrReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ASR request: %w", err)
	}
	return bytes.NewReader(jsonData), nil
}

func handleASRResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	var textResp dto.OpenAITextResponse
	if err := common.DecodeJson(resp.Body, &textResp); err != nil {
		return nil, types.NewError(fmt.Errorf("failed to parse ASR response: %w", err), types.ErrorCodeBadResponse)
	}

	resultText := ""
	if len(textResp.Choices) > 0 {
		resultText = textResp.Choices[0].Message.StringContent()
	}

	responseFormat := "json"
	if audioReq, ok := info.Request.(*dto.AudioRequest); ok && audioReq.ResponseFormat != "" {
		responseFormat = audioReq.ResponseFormat
	}

	switch responseFormat {
	case "text":
		c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(resultText))
	case "verbose_json":
		c.JSON(http.StatusOK, dto.WhisperVerboseJSONResponse{Task: "transcribe", Text: resultText})
	default:
		c.JSON(http.StatusOK, dto.AudioResponse{Text: resultText})
	}

	usage := &textResp.Usage
	if usage.TotalTokens == 0 {
		usage.PromptTokens = info.GetEstimatePromptTokens()
		usage.TotalTokens = usage.PromptTokens
	}
	return usage, nil
}
