package volcengine

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"one-api/dto"
	"one-api/relay/channel"
	"one-api/relay/channel/openai"
	relaycommon "one-api/relay/common"
	"one-api/relay/constant"
	"one-api/types"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	//TODO implement me
	panic("implement me")
	return nil, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	switch info.RelayMode {
	case constant.RelayModeImagesEdits:
		// Volcengine image edit API requires JSON format instead of multipart/form-data
		const maxMemory = 32 << 20 // 32MB
		if err := c.Request.ParseMultipartForm(maxMemory); err != nil {
			return nil, errors.New("failed to parse multipart form")
		}

		jsonRequest, err := buildVolcengineImageRequest(c, request.Model)
		if err != nil {
			return nil, err
		}

		jsonData, err := json.Marshal(jsonRequest)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal json request: %w", err)
		}

		return bytes.NewReader(jsonData), nil
	default:
		return request, nil
	}
}

// buildVolcengineImageRequest creates a JSON request for Volcengine image APIs.
func buildVolcengineImageRequest(c *gin.Context, model string) (map[string]any, error) {
	// Initialize empty request map for multipart form data
	jsonRequest := make(map[string]any)

	// Set model parameter
	jsonRequest["model"] = model
	processFormFields(c, jsonRequest)

	// Handle image file
	imageFile := extractFirstImageFile(c)
	if imageFile != nil {
		base64Image, err := fileHeaderToBase64(imageFile)
		if err != nil {
			return nil, err
		}
		jsonRequest["image"] = base64Image
	}

	return jsonRequest, nil
}

// processFormFields processes form fields and adds them to the request map
func processFormFields(c *gin.Context, jsonRequest map[string]any) {
	if c.Request.PostForm == nil {
		return
	}

	for key, values := range c.Request.PostForm {
		if key == "model" {
			continue
		}
		if len(values) > 0 {
			switch key {
			case "n", "seed":
				if v, err := strconv.Atoi(values[0]); err == nil {
					jsonRequest[key] = v
				}
			case "guidance_scale":
				if v, err := strconv.ParseFloat(values[0], 64); err == nil {
					jsonRequest[key] = v
				}
			case "watermark":
				jsonRequest[key] = values[0] == "true"
			default:
				jsonRequest[key] = values[0]
			}
		}
	}
}

// extractFirstImageFile finds the first uploaded image file from various possible field names.
func extractFirstImageFile(c *gin.Context) *multipart.FileHeader {
	if c.Request.MultipartForm == nil || c.Request.MultipartForm.File == nil {
		return nil
	}

	// Define possible field names for the image
	fieldNames := []string{"image", "image[]"}

	for _, fieldName := range fieldNames {
		if files, ok := c.Request.MultipartForm.File[fieldName]; ok && len(files) > 0 {
			return files[0]
		}
	}

	// Fallback: check for fields like "image[0]", "image[1]" etc.
	for fieldName, files := range c.Request.MultipartForm.File {
		if strings.HasPrefix(fieldName, "image[") && len(files) > 0 {
			return files[0]
		}
	}

	return nil
}

// fileHeaderToBase64 converts an uploaded file to a data URI string.
func fileHeaderToBase64(fileHeader *multipart.FileHeader) (string, error) {
	// Define maximum allowed file size (10MB)
	const maxFileSize = 10 << 20 // 10MB

	// Check file size before processing
	if fileHeader.Size > maxFileSize {
		return "", fmt.Errorf("image file size %d bytes exceeds maximum allowed size of %d bytes", fileHeader.Size, maxFileSize)
	}

	file, err := fileHeader.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open image file: %w", err)
	}
	defer file.Close()

	fileContent, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("failed to read image file: %w", err)
	}

	fileBase64 := base64.StdEncoding.EncodeToString(fileContent)
	mimeType := detectImageMimeType(fileHeader.Filename)

	return fmt.Sprintf("data:%s;base64,%s", mimeType, fileBase64), nil
}

// detectImageMimeType determines the MIME type based on the file extension
func detectImageMimeType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	default:
		// Try to detect from extension if possible
		if strings.HasPrefix(ext, ".jp") {
			return "image/jpeg"
		}
		// Default to png as a fallback
		return "image/png"
	}
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	switch info.RelayMode {
	case constant.RelayModeChatCompletions:
		if strings.HasPrefix(info.UpstreamModelName, "bot") {
			return fmt.Sprintf("%s/api/v3/bots/chat/completions", info.BaseUrl), nil
		}
		return fmt.Sprintf("%s/api/v3/chat/completions", info.BaseUrl), nil
	case constant.RelayModeEmbeddings:
		return fmt.Sprintf("%s/api/v3/embeddings", info.BaseUrl), nil
	case constant.RelayModeImagesGenerations:
		return fmt.Sprintf("%s/api/v3/images/generations", info.BaseUrl), nil
	case constant.RelayModeImagesEdits:
		return info.BaseUrl + "/api/v3/images/generations", nil
	default:
	}
	return "", fmt.Errorf("unsupported relay mode: %d", info.RelayMode)
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Content-Type", "application/json")
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayMode {
	case constant.RelayModeChatCompletions:
		if info.IsStream {
			usage, err = openai.OaiStreamHandler(c, info, resp)
		} else {
			usage, err = openai.OpenaiHandler(c, info, resp)
		}
	case constant.RelayModeEmbeddings:
		usage, err = openai.OpenaiHandler(c, info, resp)
	case constant.RelayModeImagesGenerations, constant.RelayModeImagesEdits:
		usage, err = openai.OpenaiHandlerWithUsage(c, info, resp)
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
