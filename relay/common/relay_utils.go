package common

import (
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	"strings"

	"github.com/gin-gonic/gin"
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

func storeTaskRequest(c *gin.Context, info *RelayInfo, action string, requestObj interface{}) {
	info.Action = action
	c.Set("task_request", requestObj)
}

func validatePrompt(prompt string) *dto.TaskError {
	if strings.TrimSpace(prompt) == "" {
		return createTaskError(fmt.Errorf("prompt is required"), "invalid_request", http.StatusBadRequest, true)
	}
	return nil
}

func ValidateBasicTaskRequest(c *gin.Context, info *RelayInfo, action string) *dto.TaskError {
	var req TaskSubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return createTaskError(err, "invalid_request", http.StatusBadRequest, true)
	}

	if taskErr := validatePrompt(req.Prompt); taskErr != nil {
		return taskErr
	}

	if len(req.Images) == 0 && strings.TrimSpace(req.Image) != "" {
		// 兼容单图上传
		req.Images = []string{req.Image}
	}

	storeTaskRequest(c, info, action, req)
	return nil
}

func ValidateTaskRequestWithImage(c *gin.Context, info *RelayInfo, requestObj interface{}) *dto.TaskError {
	hasPrompt, ok := requestObj.(HasPrompt)
	if !ok {
		return createTaskError(fmt.Errorf("request must have prompt"), "invalid_request", http.StatusBadRequest, true)
	}

	if taskErr := validatePrompt(hasPrompt.GetPrompt()); taskErr != nil {
		return taskErr
	}

	action := constant.TaskActionTextGenerate
	if hasImage, ok := requestObj.(HasImage); ok && hasImage.HasImage() {
		action = constant.TaskActionGenerate
	}

	storeTaskRequest(c, info, action, requestObj)
	return nil
}

func ValidateTaskRequestWithImageBinding(c *gin.Context, info *RelayInfo) *dto.TaskError {
	var req TaskSubmitReq
	if err := c.ShouldBindJSON(&req); err != nil {
		return createTaskError(err, "invalid_request_body", http.StatusBadRequest, false)
	}

	return ValidateTaskRequestWithImage(c, info, req)
}
