package ollama

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	ResponseFormat string
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	adaptor := claude.Adaptor{}
	return adaptor.ConvertClaudeRequest(c, info, request)
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	a.ResponseFormat = ""
	info.IsStream = false
	if info.RelayMode != relayconstant.RelayModeAudioTranscription && info.RelayMode != relayconstant.RelayModeAudioTranslation {
		return nil, fmt.Errorf("ollama audio relay mode %d is not supported", info.RelayMode)
	}
	if request.Model == "" {
		return nil, types.NewOpenAIError(errors.New("model is required"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	formData, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return nil, types.NewOpenAIError(fmt.Errorf("error parsing multipart form: %w", err), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	defer formData.RemoveAll()
	fileHeaders := formData.File["file"]
	if len(fileHeaders) == 0 {
		return nil, types.NewOpenAIError(errors.New("file is required"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	fileHeader := fileHeaders[0]
	if fileHeader.Size == 0 {
		return nil, types.NewOpenAIError(errors.New("file is empty"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	a.ResponseFormat = strings.TrimSpace(request.ResponseFormat)
	if values := formData.Value["response_format"]; len(values) > 0 {
		a.ResponseFormat = strings.TrimSpace(values[0])
	}
	if a.ResponseFormat == "" {
		a.ResponseFormat = "json"
	}

	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)
	if err := writer.WriteField("model", request.Model); err != nil {
		return nil, fmt.Errorf("write audio model field: %w", err)
	}
	for key, values := range formData.Value {
		if key == "model" {
			continue
		}
		if key == "stream" && len(values) > 0 {
			stream, err := strconv.ParseBool(values[0])
			if err != nil {
				return nil, types.NewOpenAIError(fmt.Errorf("invalid stream value %q: %w", values[0], err), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			info.IsStream = stream
		}
		for _, value := range values {
			if err := writer.WriteField(key, value); err != nil {
				return nil, fmt.Errorf("write audio form field %q: %w", key, err)
			}
		}
	}

	file, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("open audio file: %w", err)
	}
	defer file.Close()

	partHeader := make(textproto.MIMEHeader)
	partHeader.Set("Content-Disposition", mime.FormatMediaType("form-data", map[string]string{
		"name":     "file",
		"filename": fileHeader.Filename,
	}))
	if contentType := fileHeader.Header.Get("Content-Type"); contentType != "" {
		partHeader.Set("Content-Type", contentType)
	}
	part, err := writer.CreatePart(partHeader)
	if err != nil {
		return nil, fmt.Errorf("create audio form file: %w", err)
	}
	written, err := io.Copy(part, file)
	if err != nil {
		return nil, fmt.Errorf("copy audio file: %w", err)
	}
	if written == 0 {
		return nil, types.NewOpenAIError(errors.New("file is empty"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("close multipart body: %w", err)
	}

	contentType := writer.FormDataContentType()
	c.Request.Header.Set("Content-Type", contentType)
	return &requestBody, nil
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	// OpenAI-compatible chat responses are handled by the OpenAI adaptor, which
	// relies on the thinking-to-content state initialized here.
	(&openai.Adaptor{}).Init(info)
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		return (&claude.Adaptor{}).GetRequestURL(info)
	default:
		baseURL := strings.TrimSuffix(info.ChannelBaseUrl, "/")
		switch info.RelayMode {
		case relayconstant.RelayModeAudioTranscription:
			return fmt.Sprintf("%s/v1/audio/transcriptions", baseURL), nil
		case relayconstant.RelayModeAudioTranslation:
			return fmt.Sprintf("%s/v1/audio/translations", baseURL), nil
		case relayconstant.RelayModeEmbeddings:
			return fmt.Sprintf("%s/api/embed", baseURL), nil
		case relayconstant.RelayModeResponses:
			return fmt.Sprintf("%s/v1/responses", baseURL), nil
		case relayconstant.RelayModeResponsesCompact:
			return fmt.Sprintf("%s/v1/responses/compact", baseURL), nil
		case relayconstant.RelayModeCompletions:
			return fmt.Sprintf("%s/api/generate", baseURL), nil
		default:
			if info.ChannelOtherSettings.OllamaOpenAIChat {
				return fmt.Sprintf("%s/v1/chat/completions", baseURL), nil
			}
			return fmt.Sprintf("%s/api/chat", baseURL), nil
		}
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		claude.CommonClaudeHeadersOperation(c, req, info)
		anthropicVersion := c.Request.Header.Get("anthropic-version")
		if anthropicVersion == "" {
			anthropicVersion = "2023-06-01"
		}
		req.Set("anthropic-version", anthropicVersion)
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	switch info.RelayMode {
	case relayconstant.RelayModeCompletions:
		return openAIToGenerate(c, request)
	default:
		if info.ChannelOtherSettings.OllamaOpenAIChat {
			return (&openai.Adaptor{}).ConvertOpenAIRequest(c, info, request)
		}
		return openAIChatToOllamaChat(c, request)
	}
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return requestOpenAI2Embeddings(request), nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	adaptor := openai.Adaptor{}
	return adaptor.ConvertOpenAIResponsesRequest(c, info, request)
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if info.RelayMode == relayconstant.RelayModeAudioTranscription || info.RelayMode == relayconstant.RelayModeAudioTranslation {
		return channel.DoFormRequest(a, c, info, requestBody)
	}
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		adaptor := claude.Adaptor{}
		return adaptor.DoResponse(c, resp, info)
	default:
		switch info.RelayMode {
		case relayconstant.RelayModeAudioTranscription, relayconstant.RelayModeAudioTranslation:
			return ollamaAudioSTTHandler(c, resp, info, a.ResponseFormat)
		case relayconstant.RelayModeEmbeddings:
			return ollamaEmbeddingHandler(c, info, resp)
		case relayconstant.RelayModeResponses, relayconstant.RelayModeResponsesCompact:
			adaptor := openai.Adaptor{}
			return adaptor.DoResponse(c, resp, info)
		default:
			// /api/generate always returns native NDJSON; chat follows the channel setting.
			if info.RelayMode != relayconstant.RelayModeCompletions && info.ChannelOtherSettings.OllamaOpenAIChat {
				adaptor := openai.Adaptor{}
				return adaptor.DoResponse(c, resp, info)
			}
			if info.IsStream {
				return ollamaStreamHandler(c, info, resp)
			}
			return ollamaChatHandler(c, info, resp)
		}
	}
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
