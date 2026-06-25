package common

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

type HasPrompt interface {
	GetPrompt() string
}

type HasImage interface {
	HasImage() bool
}

func GetFullRequestURL(baseURL string, requestURL string, channelType int) string {
	fullRequestURL := fmt.Sprintf("%s%s", baseURL, requestURL)

	if strings.HasPrefix(baseURL, "https://gateway.ai.cloudflare.com") {
		switch channelType {
		case constant.ChannelTypeOpenAI:
			fullRequestURL = fmt.Sprintf("%s%s", baseURL, strings.TrimPrefix(requestURL, "/v1"))
		case constant.ChannelTypeAzure:
			fullRequestURL = fmt.Sprintf("%s%s", baseURL, strings.TrimPrefix(requestURL, "/openai/deployments"))
		}
	}
	return fullRequestURL
}

func GetAPIVersion(c *gin.Context) string {
	query := c.Request.URL.Query()
	apiVersion := query.Get("api-version")
	if apiVersion == "" {
		apiVersion = c.GetString("api_version")
	}
	return apiVersion
}

func createTaskError(err error, code string, statusCode int, localError bool) *dto.TaskError {
	return &dto.TaskError{
		Code:       code,
		Message:    err.Error(),
		StatusCode: statusCode,
		LocalError: localError,
		Error:      err,
	}
}

func storeTaskRequest(c *gin.Context, info *RelayInfo, action string, requestObj TaskSubmitReq) {
	info.Action = action
	c.Set("task_request", requestObj)
}

// BuildTaskFetchBody builds the body map for TaskAdaptor.FetchTask during polling.
// Includes upstream_model / req_key when stored on the task (required by ApiWenhao and similar vendors).
func BuildTaskFetchBody(taskID, action, upstreamModel string) map[string]any {
	body := map[string]any{
		"task_id": taskID,
		"action":  action,
	}
	upstreamModel = strings.TrimSpace(upstreamModel)
	if upstreamModel != "" {
		body["upstream_model"] = upstreamModel
		body["req_key"] = upstreamModel
	}
	return body
}
func GetTaskRequest(c *gin.Context) (TaskSubmitReq, error) {
	v, exists := c.Get("task_request")
	if !exists {
		return TaskSubmitReq{}, fmt.Errorf("request not found in context")
	}
	req, ok := v.(TaskSubmitReq)
	if !ok {
		return TaskSubmitReq{}, fmt.Errorf("invalid task request type")
	}
	return req, nil
}

func validatePrompt(prompt string, content []map[string]interface{}) *dto.TaskError {
	if strings.TrimSpace(prompt) == "" {
		if len(content) == 0 {
			return createTaskError(fmt.Errorf("prompt is required"), "invalid_request", http.StatusBadRequest, true)
		}
	}
	return nil
}

func validateMultipartTaskRequest(c *gin.Context, info *RelayInfo, action string) (TaskSubmitReq, error) {
	var req TaskSubmitReq
	if _, err := c.MultipartForm(); err != nil {
		return req, err
	}

	formData := c.Request.PostForm
	req = TaskSubmitReq{
		Prompt:   formData.Get("prompt"),
		Model:    formData.Get("model"),
		Mode:     formData.Get("mode"),
		Image:    formData.Get("image"),
		Size:     formData.Get("size"),
		Metadata: make(map[string]interface{}),
	}

	// Also support prompt (and a few other text fields) sent as file parts
	// e.g. curl -F "prompt=@long_prompt.txt"
	if fullForm, err := c.MultipartForm(); err == nil && fullForm != nil {
		for _, key := range []string{"prompt", "model", "mode", "size"} {
			if v := formData.Get(key); strings.TrimSpace(v) != "" {
				continue
			}
			if fhs := fullForm.File[key]; len(fhs) > 0 {
				if f, err := fhs[0].Open(); err == nil {
					if b, err := io.ReadAll(f); err == nil && len(b) > 0 {
						switch key {
						case "prompt":
							req.Prompt = string(b)
						case "model":
							req.Model = string(b)
						case "mode":
							req.Mode = string(b)
						case "size":
							req.Size = string(b)
						}
					}
					f.Close()
				}
			}
		}
	}

	if durationStr := formData.Get("seconds"); durationStr != "" {
		if duration, err := strconv.Atoi(durationStr); err == nil {
			req.Duration = duration
		}
	}

	// Parse known bool fields from form (accept 1/0/true/false)
	for _, key := range []string{"generate_audio", "watermark", "draft"} {
		if v := formData.Get(key); v != "" {
			if b, ok := parseBoolFlexible(v); ok {
				switch key {
				case "generate_audio":
					req.GenerateAudio = &b
				case "watermark":
					req.Watermark = &b
				case "draft":
					req.Draft = &b
				}
			}
		}
	}

	if images := formData["images"]; len(images) > 0 {
		req.Images = images
	}

	for key, values := range formData {
		if len(values) > 0 && !isKnownTaskField(key) {
			if intVal, err := strconv.Atoi(values[0]); err == nil {
				req.Metadata[key] = intVal
			} else if floatVal, err := strconv.ParseFloat(values[0], 64); err == nil {
				req.Metadata[key] = floatVal
			} else {
				req.Metadata[key] = values[0]
			}
		}
	}
	return req, nil
}

func ValidateMultipartDirect(c *gin.Context, info *RelayInfo) *dto.TaskError {
	var prompt string
	var model string
	var seconds int
	var size string
	var hasInputReference bool

	var req TaskSubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return createTaskError(err, "invalid_json", http.StatusBadRequest, true)
	}

	prompt = req.Prompt
	model = req.Model
	size = req.Size
	seconds, _ = strconv.Atoi(req.Seconds)
	if seconds == 0 {
		seconds = req.Duration
	}
	if req.InputReference != "" {
		req.Images = []string{req.InputReference}
	}
	if len(req.Images) == 0 && strings.TrimSpace(req.Image) != "" {
		req.Images = []string{strings.TrimSpace(req.Image)}
	}

	if strings.TrimSpace(req.Model) == "" {
		return createTaskError(fmt.Errorf("model field is required"), "missing_model", http.StatusBadRequest, true)
	}

	if req.HasImage() {
		hasInputReference = true
	}

	if taskErr := validatePrompt(prompt, req.Content); taskErr != nil {
		return taskErr
	}

	action := constant.TaskActionTextGenerate
	if hasInputReference {
		action = constant.TaskActionGenerate
	}
	if strings.HasPrefix(model, "sora-2") {

		if size == "" {
			size = "720x1280"
		}

		if seconds <= 0 {
			seconds = 4
		}

		if model == "sora-2" && !lo.Contains([]string{"720x1280", "1280x720"}, size) {
			return createTaskError(fmt.Errorf("sora-2 size is invalid"), "invalid_size", http.StatusBadRequest, true)
		}
		if model == "sora-2-pro" && !lo.Contains([]string{"720x1280", "1280x720", "1792x1024", "1024x1792"}, size) {
			return createTaskError(fmt.Errorf("sora-2 size is invalid"), "invalid_size", http.StatusBadRequest, true)
		}
		// OtherRatios 已移到 Sora adaptor 的 EstimateBilling 中设置
	}

	storeTaskRequest(c, info, action, req)

	return nil
}

// parseBoolFlexible converts common form representations of bool to a bool value.
func parseBoolFlexible(s string) (bool, bool) {
	ls := strings.ToLower(strings.TrimSpace(s))
	switch ls {
	case "1", "true", "yes", "on":
		return true, true
	case "0", "false", "no", "off", "":
		return false, true
	}
	// try numeric
	if i, err := strconv.Atoi(ls); err == nil {
		return i != 0, true
	}
	return false, false
}

func isKnownTaskField(field string) bool {
	knownFields := map[string]bool{
		"prompt":          true,
		"model":           true,
		"mode":            true,
		"image":           true,
		"images":          true,
		"size":            true,
		"duration":        true,
		"seconds":         true,
		"input_reference": true, // Sora 特有字段
		"generate_audio":  true,
		"aspect_ratio":    true,
		"resolution":      true,
		"watermark":       true,
		"draft":           true,
	}
	return knownFields[field]
}

func ValidateBasicTaskRequest(c *gin.Context, info *RelayInfo, action string) *dto.TaskError {
	var err error
	contentType := c.GetHeader("Content-Type")
	var req TaskSubmitReq
	if strings.HasPrefix(contentType, "multipart/form-data") {
		req, err = validateMultipartTaskRequest(c, info, action)
		if err != nil {
			return createTaskError(err, "invalid_multipart_form", http.StatusBadRequest, true)
		}
	}
	// 为了metadata字段的兼容性，统一UnmarshalBodyReusable
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return createTaskError(err, "invalid_request", http.StatusBadRequest, true)
	}

	if taskErr := validatePrompt(req.Prompt, req.Content); taskErr != nil {
		return taskErr
	}

	if len(req.Images) == 0 && strings.TrimSpace(req.Image) != "" {
		// 兼容单图上传
		req.Images = []string{req.Image}
	}

	storeTaskRequest(c, info, action, req)
	return nil
}
