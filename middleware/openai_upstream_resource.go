package middleware

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

type openAIBatchInputLine struct {
	CustomId string `json:"custom_id"`
	Method   string `json:"method"`
	URL      string `json:"url"`
	Body     struct {
		Model string `json:"model"`
	} `json:"body"`
}

var supportedOpenAIBatchEndpoints = map[string]struct{}{
	"/v1/responses":          {},
	"/v1/chat/completions":   {},
	"/v1/embeddings":         {},
	"/v1/completions":        {},
	"/v1/images/generations": {},
	"/v1/images/edits":       {},
}

type openAIBatchCreateRequest struct {
	InputFileId string `json:"input_file_id"`
}

const maxOpenAIBatchRequests = 50_000

func extractOpenAIBatchUploadModel(c *gin.Context) (string, error) {
	mediaType, params, err := mime.ParseMediaType(c.Request.Header.Get("Content-Type"))
	if err != nil || mediaType != "multipart/form-data" || params["boundary"] == "" {
		return "", errors.New("multipart/form-data request is required")
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return "", err
	}
	reader, err := storage.NewReader()
	if err != nil {
		return "", err
	}
	defer reader.Close()

	multipartReader := multipart.NewReader(reader, params["boundary"])
	purpose := ""
	purposeFound := false
	modelName := ""
	fileFound := false
	customIds := make(map[string]struct{})
	for {
		part, nextErr := multipartReader.NextPart()
		if errors.Is(nextErr, io.EOF) {
			break
		}
		if nextErr != nil {
			return "", fmt.Errorf("invalid multipart request: %w", nextErr)
		}

		switch part.FormName() {
		case "purpose":
			if purposeFound {
				part.Close()
				return "", errors.New("duplicate purpose field")
			}
			purposeFound = true
			value, readErr := io.ReadAll(io.LimitReader(part, 64))
			if readErr != nil {
				part.Close()
				return "", readErr
			}
			purpose = strings.TrimSpace(string(value))
		case "file":
			if fileFound {
				part.Close()
				return "", errors.New("duplicate file field")
			}
			fileFound = true
			scanner := bufio.NewScanner(part)
			maxRequestBodyMB := constant.MaxRequestBodyMB
			if maxRequestBodyMB <= 0 {
				maxRequestBodyMB = 128
			}
			scanner.Buffer(make([]byte, 64*1024), maxRequestBodyMB<<20)
			lineNumber := 0
			for scanner.Scan() {
				rawLine := bytes.TrimSpace(scanner.Bytes())
				if len(rawLine) == 0 {
					continue
				}
				lineNumber++
				if lineNumber > maxOpenAIBatchRequests {
					part.Close()
					return "", fmt.Errorf("batch input file must not exceed %d requests", maxOpenAIBatchRequests)
				}
				var line openAIBatchInputLine
				if decodeErr := common.Unmarshal(rawLine, &line); decodeErr != nil {
					part.Close()
					return "", fmt.Errorf("invalid batch input file at line %d: %w", lineNumber, decodeErr)
				}
				line.CustomId = strings.TrimSpace(line.CustomId)
				if line.CustomId == "" {
					part.Close()
					return "", fmt.Errorf("custom_id is required at line %d", lineNumber)
				}
				if _, duplicate := customIds[line.CustomId]; duplicate {
					part.Close()
					return "", fmt.Errorf("custom_id must be unique at line %d", lineNumber)
				}
				customIds[line.CustomId] = struct{}{}
				if line.Method != http.MethodPost {
					part.Close()
					return "", fmt.Errorf("batch method must be POST at line %d", lineNumber)
				}
				if _, supported := supportedOpenAIBatchEndpoints[line.URL]; !supported {
					part.Close()
					return "", fmt.Errorf("unsupported batch endpoint %q at line %d", line.URL, lineNumber)
				}
				lineModel := strings.TrimSpace(line.Body.Model)
				if lineModel == "" {
					part.Close()
					return "", fmt.Errorf("model is required at line %d", lineNumber)
				}
				if modelName == "" {
					modelName = lineModel
				} else if modelName != lineModel {
					part.Close()
					return "", errors.New("all batch requests must use the same model")
				}
			}
			if scanErr := scanner.Err(); scanErr != nil {
				part.Close()
				return "", fmt.Errorf("invalid batch input file: %w", scanErr)
			}
		}
		part.Close()
	}

	if purpose != "batch" {
		return "", errors.New("purpose must be batch")
	}
	if !fileFound {
		return "", errors.New("batch input file is required")
	}
	if modelName == "" {
		return "", errors.New("model is required in the first batch input request")
	}
	return modelName, nil
}

// PrepareOpenAIUpstreamResource resolves the model and channel before the
// regular distributor runs. Uploads select a channel by model; all later
// resource operations are pinned to the channel stored for the owning user.
func PrepareOpenAIUpstreamResource() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !operation_setting.IsOpenAIBatchEnabled() {
			abortWithOpenAiMessage(c, http.StatusNotFound, "OpenAI Batch API is not enabled")
			return
		}
		userId := common.GetContextKeyInt(c, constant.ContextKeyUserId)
		path := c.Request.URL.Path
		method := c.Request.Method

		var modelName string
		var channelId int
		var resource *model.OpenAIUpstreamResource
		switch {
		case method == http.MethodPost && path == "/v1/files":
			var err error
			modelName, err = extractOpenAIBatchUploadModel(c)
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, err.Error())
				return
			}
		case method == http.MethodPost && path == "/v1/batches":
			var request openAIBatchCreateRequest
			if err := common.UnmarshalBodyReusable(c, &request); err != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, "invalid batch request: "+err.Error())
				return
			}
			request.InputFileId = strings.TrimSpace(request.InputFileId)
			if request.InputFileId == "" {
				abortWithOpenAiMessage(c, http.StatusBadRequest, "input_file_id is required")
				return
			}
			var found bool
			var err error
			resource, found, err = model.GetOpenAIUpstreamResource(userId, model.OpenAIUpstreamResourceTypeFile, request.InputFileId)
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusInternalServerError, "failed to resolve input file")
				return
			}
			if !found {
				abortWithOpenAiMessage(c, http.StatusNotFound, "input file not found")
				return
			}
			modelName = resource.Model
			channelId = resource.ChannelId
		case strings.HasPrefix(path, "/v1/batches/"):
			var found bool
			var err error
			resource, found, err = model.GetOpenAIUpstreamResource(userId, model.OpenAIUpstreamResourceTypeBatch, c.Param("id"))
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusInternalServerError, "failed to resolve batch")
				return
			}
			if !found {
				abortWithOpenAiMessage(c, http.StatusNotFound, "batch not found")
				return
			}
			modelName = resource.Model
			channelId = resource.ChannelId
		case strings.HasPrefix(path, "/v1/files/"):
			var found bool
			var err error
			resource, found, err = model.GetOpenAIUpstreamResource(userId, model.OpenAIUpstreamResourceTypeFile, c.Param("id"))
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusInternalServerError, "failed to resolve file")
				return
			}
			if !found {
				abortWithOpenAiMessage(c, http.StatusNotFound, "file not found")
				return
			}
			modelName = resource.Model
			channelId = resource.ChannelId
		default:
			abortWithOpenAiMessage(c, http.StatusNotFound, "resource endpoint not found")
			return
		}

		common.SetContextKey(c, constant.ContextKeyUpstreamResourceModel, modelName)
		if channelId > 0 {
			common.SetContextKey(c, constant.ContextKeyUpstreamResourceChannelId, channelId)
			common.SetContextKey(c, constant.ContextKeyUpstreamResourceKeyIndex, resource.ChannelKeyIndex)
			common.SetContextKey(c, constant.ContextKeyUpstreamResourceKeyFingerprint, resource.ChannelKeyFingerprint)
		}
		c.Next()
	}
}
