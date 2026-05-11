package mineru

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return info.ChannelBaseUrl + "/file_parse", nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	// MinerU is self-hosted, no auth needed
	// Content-Type will be set by DoRequest with multipart boundary
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	// For MinerU, we need to rebuild the multipart form from the original request
	// and send it to the upstream MinerU service

	var requestBuf bytes.Buffer
	writer := multipart.NewWriter(&requestBuf)

	// Get the cached multipart form if available
	mf := c.Request.MultipartForm
	if mf == nil {
		// Try to parse it if not already parsed
		if _, parseErr := c.MultipartForm(); parseErr != nil {
			return nil, fmt.Errorf("failed to parse multipart form: %w", parseErr)
		}
		mf = c.Request.MultipartForm
	}

	if mf == nil {
		return nil, errors.New("no multipart form data available")
	}

	// Copy all form values (model is used for gateway channel selection only,
	// not forwarded to MinerU; backend and other params are passed through)
	for key, values := range mf.Value {
		if key == "model" {
			continue
		}
		for _, value := range values {
			if err := writer.WriteField(key, value); err != nil {
				return nil, fmt.Errorf("failed to write form field %s: %w", key, err)
			}
		}
	}

	// Copy all files
	for fieldName, fileHeaders := range mf.File {
		for _, fileHeader := range fileHeaders {
			file, err := fileHeader.Open()
			if err != nil {
				return nil, fmt.Errorf("failed to open file %s: %w", fileHeader.Filename, err)
			}

			part, err := writer.CreateFormFile(fieldName, fileHeader.Filename)
			if err != nil {
				file.Close()
				return nil, fmt.Errorf("failed to create form file for %s: %w", fileHeader.Filename, err)
			}

			if _, err := io.Copy(part, file); err != nil {
				file.Close()
				return nil, fmt.Errorf("failed to copy file %s: %w", fileHeader.Filename, err)
			}
			file.Close()
		}
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Use DoFormRequest to send the multipart request
	fullRequestURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}

	req, err := http.NewRequest(c.Request.Method, fullRequestURL, &requestBuf)
	if err != nil {
		return nil, fmt.Errorf("new request failed: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Apply header override
	headerOverride, err := channel.ResolveHeaderOverride(info, c)
	if err != nil {
		return nil, err
	}
	for key, value := range headerOverride {
		req.Header.Set(key, value)
	}

	resp, err := channel.DoRequest(c, req, info)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}

	return resp, nil
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if resp == nil {
		return nil, types.NewError(errors.New("response is nil"), types.ErrorCodeDoRequestFailed)
	}

	// Read response body
	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewError(fmt.Errorf("failed to read response body: %w", readErr), types.ErrorCodeDoRequestFailed)
	}
	resp.Body.Close()

	// Parse the response
	var result MinerUFileParseResult
	if parseErr := common.Unmarshal(body, &result); parseErr != nil {
		// If not valid JSON, just pass through the raw response
		c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
		return &dto.Usage{PromptTokens: 1, TotalTokens: 1}, nil
	}

	// Check for error
	if result.Error != "" {
		return nil, types.NewErrorWithStatusCode(
			errors.New(result.Error),
			types.ErrorCodeDoRequestFailed,
			http.StatusInternalServerError,
		)
	}

	// Check status - pending means something went wrong since we expect completed
	if result.Status == "failed" {
		return nil, types.NewErrorWithStatusCode(
			errors.New("mineru processing failed"),
			types.ErrorCodeDoRequestFailed,
			http.StatusInternalServerError,
		)
	}

	// Pass through the response
	c.Data(resp.StatusCode, "application/json", body)

	// Return usage for billing (1 call = 1 token for per-call billing)
	return &dto.Usage{PromptTokens: 1, TotalTokens: 1}, nil
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
