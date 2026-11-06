package volcengine

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	volcengineASRURL        = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash"
	volcengineASRResourceID = "volc.bigasr.auc_turbo"
)

type VolcengineASRRequest struct {
	User    VolcengineASRUser    `json:"user"`
	Audio   VolcengineASRAudio   `json:"audio"`
	Request VolcengineASRReqInfo `json:"request"`
}

type VolcengineASRUser struct {
	UID string `json:"uid"`
}

type VolcengineASRAudio struct {
	Data   string `json:"data"`
	Format string `json:"format,omitempty"`
}

type VolcengineASRReqInfo struct {
	ModelName      string `json:"model_name"`
	EnableITN      bool   `json:"enable_itn"`
	EnablePunc     bool   `json:"enable_punc"`
	EnableDDC      bool   `json:"enable_ddc"`
	ShowUtterances bool   `json:"show_utterances,omitempty"`
}

type VolcengineASRResponse struct {
	Code    int                  `json:"code"`
	Message string               `json:"message"`
	Result  *VolcengineASRResult `json:"result"`
}

type VolcengineASRResult struct {
	Text string `json:"text"`
}

func buildASRRequest(c *gin.Context, info *relaycommon.RelayInfo) (*VolcengineASRRequest, error) {
	appID, _, err := parseVolcengineAuth(info.ApiKey)
	if err != nil {
		return nil, err
	}

	formData, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return nil, fmt.Errorf("error parsing multipart form: %w", err)
	}

	fileHeaders := formData.File["file"]
	if len(fileHeaders) == 0 {
		return nil, errors.New("file is required")
	}

	fileHeader := fileHeaders[0]
	file, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("error opening audio file: %w", err)
	}
	defer file.Close()

	audioData, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("error reading audio file: %w", err)
	}

	request := &VolcengineASRRequest{
		User: VolcengineASRUser{
			UID: appID,
		},
		Audio: VolcengineASRAudio{
			Data:   base64.StdEncoding.EncodeToString(audioData),
			Format: detectAudioFormat(fileHeader.Filename, fileHeader.Header.Get("Content-Type")),
		},
		Request: VolcengineASRReqInfo{
			ModelName:      info.UpstreamModelName,
			EnableITN:      true,
			EnablePunc:     true,
			EnableDDC:      true,
			ShowUtterances: true,
		},
	}

	if request.Request.ModelName == "" {
		request.Request.ModelName = info.OriginModelName
	}

	return request, nil
}

func detectAudioFormat(filename string, contentType string) string {
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(filename)), ".")
	switch ext {
	case "wav", "mp3", "ogg", "opus", "m4a", "mp4", "aac", "flac":
		if ext == "opus" {
			return "ogg"
		}
		return ext
	}

	contentType = strings.ToLower(contentType)
	switch {
	case strings.Contains(contentType, "wav"):
		return "wav"
	case strings.Contains(contentType, "mpeg"), strings.Contains(contentType, "mp3"):
		return "mp3"
	case strings.Contains(contentType, "ogg"), strings.Contains(contentType, "opus"):
		return "ogg"
	default:
		return ""
	}
}

func handleASRResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, responseFormat string) (usage any, err *types.NewAPIError) {
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewErrorWithStatusCode(
			errors.New("failed to read volcengine asr response"),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}

	var volcResp VolcengineASRResponse
	if unmarshalErr := common.Unmarshal(body, &volcResp); unmarshalErr != nil {
		return nil, types.NewErrorWithStatusCode(
			errors.New("failed to parse volcengine asr response"),
			types.ErrorCodeBadResponseBody,
			http.StatusInternalServerError,
		)
	}

	statusCode := strings.TrimSpace(resp.Header.Get("X-Api-Status-Code"))
	if statusCode == "" && volcResp.Code != 0 {
		statusCode = fmt.Sprintf("%d", volcResp.Code)
	}
	if statusCode != "" && statusCode != "20000000" {
		message := strings.TrimSpace(resp.Header.Get("X-Api-Message"))
		if message == "" {
			message = strings.TrimSpace(volcResp.Message)
		}
		if message == "" {
			message = "volcengine asr request failed"
		}
		return nil, types.NewErrorWithStatusCode(
			errors.New(message),
			types.ErrorCodeBadResponse,
			http.StatusBadRequest,
		)
	}

	transcript := ""
	if volcResp.Result != nil {
		transcript = volcResp.Result.Text
	}

	// VolcEngine flash ASR currently maps safely to OpenAI-style `json` and `text`
	// outputs only. `srt` and `vtt` are not generated here.
	switch responseFormat {
	case "", "json", "verbose_json":
		payload, marshalErr := common.Marshal(dto.AudioResponse{Text: transcript})
		if marshalErr != nil {
			return nil, types.NewErrorWithStatusCode(
				marshalErr,
				types.ErrorCodeBadResponseBody,
				http.StatusInternalServerError,
			)
		}
		c.Header("Content-Type", gin.MIMEJSON)
		c.Status(http.StatusOK)
		_, _ = c.Writer.Write(payload)
	case "text":
		c.Header("Content-Type", "text/plain; charset=utf-8")
		c.Status(http.StatusOK)
		_, _ = io.Copy(c.Writer, bytes.NewBufferString(transcript))
	default:
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("unsupported response_format for volcengine asr: %s (unsupported formats include srt and vtt)", responseFormat),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
		)
	}

	estimate := info.GetEstimatePromptTokens()
	return &dto.Usage{
		PromptTokens: estimate,
		TotalTokens:  estimate,
	}, nil
}

func newVolcengineRequestID() string {
	return uuid.NewString()
}
