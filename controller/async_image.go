package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const (
	asyncImageObject     = "image.task"
	asyncImagePlatform   = constant.TaskPlatform("image")
	asyncImageGeneration = "/v1/images/generations"
	asyncImageEdits      = "/v1/images/edits"
	asyncImageTaskQueued = dto.VideoStatusQueued
)

type asyncImageJob struct {
	TaskID    string
	Action    string
	RelayPath string
	Method    string
	RawQuery  string
	Header    http.Header
	Body      []byte
	Keys      map[string]any
}

func RelayAsyncImageGenerations(c *gin.Context) {
	relayAsyncImage(c, constant.TaskActionImageGenerate, asyncImageGeneration)
}

func RelayAsyncImageEdits(c *gin.Context) {
	relayAsyncImage(c, constant.TaskActionImageEdit, asyncImageEdits)
}

func RelayAsyncImageFetch(c *gin.Context) {
	taskID := strings.TrimSpace(c.Param("task_id"))
	if taskID == "" {
		respondAsyncImageOpenAIError(c, http.StatusBadRequest, "task_id is required", types.ErrorCodeInvalidRequest)
		return
	}

	task, exist, err := model.GetByTaskId(c.GetInt("id"), taskID)
	if err != nil {
		respondAsyncImageOpenAIError(c, http.StatusInternalServerError, err.Error(), types.ErrorCodeQueryDataError)
		return
	}
	if !exist || task == nil {
		respondAsyncImageOpenAIError(c, http.StatusNotFound, "task_not_exist", types.ErrorCodeInvalidRequest)
		return
	}

	c.JSON(http.StatusOK, buildAsyncImageTaskResponse(task))
}

func relayAsyncImage(c *gin.Context, action string, relayPath string) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		statusCode := http.StatusBadRequest
		if common.IsRequestBodyTooLargeError(err) {
			statusCode = http.StatusRequestEntityTooLarge
		}
		respondAsyncImageOpenAIError(c, statusCode, err.Error(), types.ErrorCodeReadRequestBodyFailed)
		return
	}
	bodyBytes, err := storage.Bytes()
	if err != nil {
		respondAsyncImageOpenAIError(c, http.StatusBadRequest, err.Error(), types.ErrorCodeReadRequestBodyFailed)
		return
	}
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		respondAsyncImageOpenAIError(c, http.StatusBadRequest, err.Error(), types.ErrorCodeReadRequestBodyFailed)
		return
	}
	c.Request.Body = io.NopCloser(storage)

	request, err := helper.GetAndValidateRequest(c, types.RelayFormatOpenAIImage)
	if err != nil {
		respondAsyncImageOpenAIError(c, http.StatusBadRequest, err.Error(), types.ErrorCodeInvalidRequest)
		return
	}

	imageReq, ok := request.(*dto.ImageRequest)
	if !ok {
		respondAsyncImageOpenAIError(c, http.StatusBadRequest, fmt.Sprintf("invalid image request type: %T", request), types.ErrorCodeInvalidRequest)
		return
	}
	relayBodyBytes := bodyBytes
	if !strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		normalizedBodyBytes, err := common.Marshal(imageReq)
		if err != nil {
			respondAsyncImageOpenAIError(c, http.StatusBadRequest, err.Error(), types.ErrorCodeInvalidRequest)
			return
		}
		relayBodyBytes = normalizedBodyBytes
	}

	task := initAsyncImageTask(c, action, imageReq)
	if err := task.Insert(); err != nil {
		respondAsyncImageOpenAIError(c, http.StatusInternalServerError, err.Error(), types.ErrorCodeQueryDataError)
		return
	}

	job := asyncImageJob{
		TaskID:    task.TaskID,
		Action:    action,
		RelayPath: relayPath,
		Method:    c.Request.Method,
		Header:    c.Request.Header.Clone(),
		Body:      append([]byte(nil), relayBodyBytes...),
		Keys:      cloneAsyncImageContextKeys(c),
	}
	if c.Request != nil && c.Request.URL != nil {
		job.RawQuery = c.Request.URL.RawQuery
	}

	gopool.Go(func() {
		runAsyncImageJob(job)
	})

	c.JSON(http.StatusOK, buildAsyncImageTaskResponse(task))
}

func initAsyncImageTask(c *gin.Context, action string, imageReq *dto.ImageRequest) *model.Task {
	now := time.Now().Unix()
	if requestStartTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime); !requestStartTime.IsZero() {
		now = requestStartTime.Unix()
	}
	modelName := strings.TrimSpace(common.GetContextKeyString(c, constant.ContextKeyOriginalModel))
	if modelName == "" && imageReq != nil {
		modelName = strings.TrimSpace(imageReq.Model)
	}

	task := &model.Task{
		TaskID:     model.GenerateTaskID(),
		Platform:   asyncImagePlatform,
		UserId:     c.GetInt("id"),
		Group:      common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		ChannelId:  common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		Action:     action,
		Status:     model.TaskStatusSubmitted,
		SubmitTime: now,
		Progress:   taskcommon.ProgressSubmitted,
		Properties: model.Properties{
			OriginModelName:   modelName,
			UpstreamModelName: modelName,
		},
	}
	if imageReq != nil {
		task.Properties.Input = strings.TrimSpace(imageReq.Prompt)
	}
	task.PrivateData.RequestId = strings.TrimSpace(c.GetString(common.RequestIdKey))
	task.PrivateData.TokenId = c.GetInt("token_id")
	return task
}

func cloneAsyncImageContextKeys(c *gin.Context) map[string]any {
	keys := make(map[string]any, len(c.Keys))
	for key, value := range c.Keys {
		if key == common.KeyBodyStorage || key == common.KeyRequestBody {
			continue
		}
		keys[key] = value
	}
	return keys
}

func runAsyncImageJob(job asyncImageJob) {
	task, exist, err := model.GetByOnlyTaskId(job.TaskID)
	if err != nil || !exist || task == nil {
		if err != nil {
			common.SysError("get async image task error: " + err.Error())
		}
		return
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	targetURL := job.RelayPath
	if strings.TrimSpace(job.RawQuery) != "" {
		targetURL += "?" + job.RawQuery
	}
	req := httptest.NewRequest(job.Method, targetURL, bytes.NewReader(job.Body))
	req.Header = job.Header.Clone()
	req.ContentLength = int64(len(job.Body))
	if parsedURL, parseErr := url.Parse(targetURL); parseErr == nil {
		req.URL = parsedURL
	}
	ctx.Request = req
	for key, value := range job.Keys {
		ctx.Set(key, value)
	}
	ctx.Set(common.RequestIdKey, task.TaskID)
	common.SetContextKey(ctx, constant.ContextKeyRequestStartTime, time.Now())

	bodyStorage, err := common.CreateBodyStorage(job.Body)
	if err != nil {
		updateAsyncImageTaskFailure(task, nil, err.Error())
		return
	}
	ctx.Set(common.KeyBodyStorage, bodyStorage)
	defer common.CleanupBodyStorage(ctx)

	updateAsyncImageTaskRunning(task)
	Relay(ctx, types.RelayFormatOpenAIImage)

	responseBody := recorder.Body.Bytes()
	statusCode := recorder.Code
	if statusCode == 0 {
		statusCode = http.StatusOK
	}
	if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		updateAsyncImageTaskFailure(task, responseBody, extractPlaygroundTaskErrorMessage(responseBody, "async image request failed"))
		return
	}
	updateAsyncImageTaskSuccess(task, ctx, responseBody)
}

func updateAsyncImageTaskRunning(task *model.Task) {
	if task == nil || task.Status != model.TaskStatusSubmitted {
		return
	}
	task.Status = model.TaskStatusInProgress
	task.Progress = taskcommon.ProgressInProgress
	task.StartTime = time.Now().Unix()
	if err := task.Update(); err != nil {
		common.SysError("update async image task running error: " + err.Error())
	}
}

func updateAsyncImageTaskSuccess(task *model.Task, c *gin.Context, responseBody []byte) {
	var imageResponse dto.ImageResponse
	if err := common.Unmarshal(responseBody, &imageResponse); err != nil {
		updateAsyncImageTaskFailure(task, responseBody, "image result parse failed")
		return
	}
	if len(imageResponse.Data) == 0 {
		updateAsyncImageTaskFailure(task, responseBody, "image result is empty")
		return
	}

	resultURL := ""
	for _, item := range imageResponse.Data {
		if resultURL = buildPlaygroundImageResultURL(item); resultURL != "" {
			break
		}
	}
	if resultURL == "" {
		updateAsyncImageTaskFailure(task, responseBody, "image result url is empty")
		return
	}

	task.Status = model.TaskStatusSuccess
	task.Progress = taskcommon.ProgressComplete
	task.FinishTime = time.Now().Unix()
	task.FailReason = ""
	task.PrivateData.ResultURL = resultURL
	task.Data = append([]byte(nil), responseBody...)
	if c != nil {
		if channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId); channelID > 0 {
			task.ChannelId = channelID
		}
	}
	if err := task.Update(); err != nil {
		common.SysError("update async image task success error: " + err.Error())
	}
}

func updateAsyncImageTaskFailure(task *model.Task, responseBody []byte, failReason string) {
	if task == nil {
		return
	}
	task.Status = model.TaskStatusFailure
	task.Progress = taskcommon.ProgressComplete
	task.FinishTime = time.Now().Unix()
	task.FailReason = strings.TrimSpace(failReason)
	task.PrivateData.ResultURL = ""
	if len(responseBody) > 0 {
		task.Data = append([]byte(nil), responseBody...)
	}
	if err := task.Update(); err != nil {
		common.SysError("update async image task failure error: " + err.Error())
	}
}

func buildAsyncImageTaskResponse(task *model.Task) *dto.AsyncImageTaskResponse {
	resp := &dto.AsyncImageTaskResponse{
		ID:          task.TaskID,
		TaskID:      task.TaskID,
		Object:      asyncImageObject,
		Model:       task.Properties.OriginModelName,
		Status:      mapAsyncImageStatus(task.Status),
		Progress:    parseAsyncImageProgress(task.Progress),
		CreatedAt:   task.SubmitTime,
		CompletedAt: task.FinishTime,
		ResultURL:   task.PrivateData.ResultURL,
	}
	if task.Status == model.TaskStatusFailure {
		resp.Error = &dto.AsyncImageTaskError{
			Message: strings.TrimSpace(task.FailReason),
			Code:    string(types.ErrorCodeBadResponse),
		}
	}
	if task.Status == model.TaskStatusSuccess && len(task.Data) > 0 {
		var imageResponse dto.ImageResponse
		if err := common.Unmarshal(task.Data, &imageResponse); err == nil {
			resp.Data = imageResponse.Data
		}
	}
	return resp
}

func mapAsyncImageStatus(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusSuccess:
		return dto.VideoStatusCompleted
	case model.TaskStatusFailure:
		return dto.VideoStatusFailed
	case model.TaskStatusInProgress:
		return dto.VideoStatusInProgress
	case model.TaskStatusQueued, model.TaskStatusSubmitted, model.TaskStatusNotStart:
		return asyncImageTaskQueued
	default:
		return dto.VideoStatusUnknown
	}
}

func parseAsyncImageProgress(progress string) int {
	trimmed := strings.TrimSpace(strings.TrimSuffix(progress, "%"))
	if trimmed == "" {
		return 0
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil {
		return 0
	}
	return parsed
}

func respondAsyncImageOpenAIError(c *gin.Context, statusCode int, message string, code any) {
	c.JSON(statusCode, gin.H{
		"error": types.OpenAIError{
			Message: strings.TrimSpace(message),
			Type:    string(types.ErrorTypeNewAPIError),
			Param:   "",
			Code:    code,
		},
	})
}
