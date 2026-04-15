package controller

import (
	"bytes"
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
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

const (
	asyncVideoObject                = "video"
	asyncVideoGeneration            = "/v1/video/generations"
	relayTaskPublicTaskIDContextKey = "relay_task_public_task_id"
)

type asyncVideoJob struct {
	TaskID   string
	Path     string
	Method   string
	RawQuery string
	Header   http.Header
	Body     []byte
	Keys     map[string]any
}

func RelayAsyncVideoGenerations(c *gin.Context) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		statusCode := http.StatusBadRequest
		if common.IsRequestBodyTooLargeError(err) {
			statusCode = http.StatusRequestEntityTooLarge
		}
		respondAsyncVideoOpenAIError(c, statusCode, err.Error(), types.ErrorCodeReadRequestBodyFailed)
		return
	}
	bodyBytes, err := storage.Bytes()
	if err != nil {
		respondAsyncVideoOpenAIError(c, http.StatusBadRequest, err.Error(), types.ErrorCodeReadRequestBodyFailed)
		return
	}

	req := readAsyncVideoTaskRequest(c, bodyBytes)
	task := initAsyncVideoTask(c, req)
	if err := task.Insert(); err != nil {
		respondAsyncVideoOpenAIError(c, http.StatusInternalServerError, err.Error(), types.ErrorCodeQueryDataError)
		return
	}

	job := asyncVideoJob{
		TaskID: task.TaskID,
		Path:   asyncVideoGeneration,
		Method: c.Request.Method,
		Header: c.Request.Header.Clone(),
		Body:   append([]byte(nil), bodyBytes...),
		Keys:   cloneAsyncImageContextKeys(c),
	}
	if c.Request != nil && c.Request.URL != nil {
		job.RawQuery = c.Request.URL.RawQuery
	}

	gopool.Go(func() {
		runAsyncVideoJob(job)
	})

	c.JSON(http.StatusOK, buildAsyncVideoTaskResponse(task))
}

func RelayAsyncVideoFetch(c *gin.Context) {
	taskID := strings.TrimSpace(c.Param("task_id"))
	if taskID == "" {
		respondAsyncVideoOpenAIError(c, http.StatusBadRequest, "task_id is required", types.ErrorCodeInvalidRequest)
		return
	}
	task, exist, err := model.GetByTaskId(c.GetInt("id"), taskID)
	if err != nil {
		respondAsyncVideoOpenAIError(c, http.StatusInternalServerError, err.Error(), types.ErrorCodeQueryDataError)
		return
	}
	if !exist || task == nil {
		respondAsyncVideoOpenAIError(c, http.StatusNotFound, "task_not_exist", types.ErrorCodeInvalidRequest)
		return
	}
	if shouldRefreshAsyncVideoTask(task) {
		if err := service.RefreshVideoTask(c.Request.Context(), task); err != nil {
			common.SysLog("refresh async video task failed: " + err.Error())
		}
		task, exist, err = model.GetByTaskId(c.GetInt("id"), taskID)
		if err != nil {
			respondAsyncVideoOpenAIError(c, http.StatusInternalServerError, err.Error(), types.ErrorCodeQueryDataError)
			return
		}
		if !exist || task == nil {
			respondAsyncVideoOpenAIError(c, http.StatusNotFound, "task_not_exist", types.ErrorCodeInvalidRequest)
			return
		}
	}
	c.JSON(http.StatusOK, buildAsyncVideoTaskResponse(task))
}

func shouldRefreshAsyncVideoTask(task *model.Task) bool {
	if task == nil {
		return false
	}
	if task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure {
		return false
	}
	if task.ChannelId <= 0 {
		return false
	}
	return strings.TrimSpace(task.PrivateData.UpstreamTaskID) != ""
}

func readAsyncVideoTaskRequest(c *gin.Context, bodyBytes []byte) relaycommon.TaskSubmitReq {
	var req relaycommon.TaskSubmitReq
	if strings.HasPrefix(c.GetHeader("Content-Type"), "application/json") && len(bodyBytes) > 0 {
		_ = common.Unmarshal(bodyBytes, &req)
		return req
	}
	if strings.Contains(c.GetHeader("Content-Type"), "multipart/form-data") {
		if form, err := common.ParseMultipartFormReusable(c); err == nil && form != nil {
			req.Prompt = strings.TrimSpace(firstAsyncVideoFormValue(form.Value, "prompt"))
			req.Model = strings.TrimSpace(firstAsyncVideoFormValue(form.Value, "model"))
			req.Image = strings.TrimSpace(firstAsyncVideoFormValue(form.Value, "image"))
			req.Size = strings.TrimSpace(firstAsyncVideoFormValue(form.Value, "size"))
			req.Seconds = strings.TrimSpace(firstAsyncVideoFormValue(form.Value, "seconds"))
			if duration, err := strconv.Atoi(strings.TrimSpace(firstAsyncVideoFormValue(form.Value, "duration"))); err == nil {
				req.Duration = duration
			}
			if images := form.Value["images"]; len(images) > 0 {
				req.Images = images
			}
		}
	}
	return req
}

func firstAsyncVideoFormValue(values map[string][]string, key string) string {
	if len(values[key]) == 0 {
		return ""
	}
	return values[key][0]
}

func initAsyncVideoTask(c *gin.Context, req relaycommon.TaskSubmitReq) *model.Task {
	now := time.Now().Unix()
	if requestStartTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime); !requestStartTime.IsZero() {
		now = requestStartTime.Unix()
	}
	modelName := strings.TrimSpace(common.GetContextKeyString(c, constant.ContextKeyOriginalModel))
	if modelName == "" {
		modelName = strings.TrimSpace(req.Model)
	}

	action := constant.TaskActionTextGenerate
	if req.HasImage() {
		action = constant.TaskActionGenerate
	}

	platform := constant.TaskPlatform("")
	if channelType := common.GetContextKeyInt(c, constant.ContextKeyChannelType); channelType > 0 {
		platform = constant.TaskPlatform(strconv.Itoa(channelType))
	}

	task := &model.Task{
		TaskID:     model.GenerateTaskID(),
		Platform:   platform,
		UserId:     c.GetInt("id"),
		Group:      common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		ChannelId:  common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		Action:     action,
		Status:     model.TaskStatusSubmitted,
		SubmitTime: now,
		Progress:   taskcommon.ProgressSubmitted,
		Properties: model.Properties{
			Input:             strings.TrimSpace(req.Prompt),
			OriginModelName:   modelName,
			UpstreamModelName: modelName,
		},
	}
	task.PrivateData.RequestId = strings.TrimSpace(c.GetString(common.RequestIdKey))
	task.PrivateData.TokenId = c.GetInt("token_id")
	return task
}

func runAsyncVideoJob(job asyncVideoJob) {
	task, exist, err := model.GetByOnlyTaskId(job.TaskID)
	if err != nil || !exist || task == nil {
		if err != nil {
			common.SysError("get async video task error: " + err.Error())
		}
		return
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	targetURL := job.Path
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
	ctx.Set(relayTaskPublicTaskIDContextKey, task.TaskID)
	common.SetContextKey(ctx, constant.ContextKeyRequestStartTime, time.Now())

	bodyStorage, err := common.CreateBodyStorage(job.Body)
	if err != nil {
		updateAsyncVideoTaskFailure(task, nil, err.Error())
		return
	}
	ctx.Set(common.KeyBodyStorage, bodyStorage)
	defer common.CleanupBodyStorage(ctx)

	updateAsyncVideoTaskRunning(task)
	RelayTask(ctx)

	responseBody := recorder.Body.Bytes()
	statusCode := recorder.Code
	if statusCode == 0 {
		statusCode = http.StatusOK
	}
	if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		updateAsyncVideoTaskFailure(task, responseBody, extractPlaygroundTaskErrorMessage(responseBody, "async video request failed"))
	}
}

func updateAsyncVideoTaskFailure(task *model.Task, responseBody []byte, failReason string) {
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
		common.SysError("update async video task failure error: " + err.Error())
	}
}

func updateAsyncVideoTaskRunning(task *model.Task) {
	if task == nil || task.Status != model.TaskStatusSubmitted {
		return
	}
	task.Status = model.TaskStatusInProgress
	task.Progress = taskcommon.ProgressInProgress
	task.StartTime = time.Now().Unix()
	if err := task.Update(); err != nil {
		common.SysError("update async video task running error: " + err.Error())
	}
}

func buildAsyncVideoTaskResponse(task *model.Task) *dto.AsyncVideoTaskResponse {
	resp := &dto.AsyncVideoTaskResponse{
		ID:          task.TaskID,
		TaskID:      task.TaskID,
		Object:      asyncVideoObject,
		Model:       task.Properties.OriginModelName,
		Status:      task.Status.ToVideoStatus(),
		URL:         strings.TrimSpace(task.PrivateData.ResultURL),
		Progress:    parseAsyncImageProgress(task.Progress),
		CreatedAt:   task.SubmitTime,
		CompletedAt: task.FinishTime,
	}

	if len(task.Data) > 0 {
		if resp.URL == "" {
			resp.URL = strings.TrimSpace(gjson.GetBytes(task.Data, "url").String())
		}
		resp.Seconds = strings.TrimSpace(gjson.GetBytes(task.Data, "seconds").String())
		resp.Size = strings.TrimSpace(gjson.GetBytes(task.Data, "size").String())
	}

	if task.Status == model.TaskStatusFailure {
		resp.Error = &dto.AsyncVideoTaskError{
			Message: strings.TrimSpace(task.FailReason),
			Code:    string(types.ErrorCodeBadResponse),
		}
	}
	return resp
}

func respondAsyncVideoOpenAIError(c *gin.Context, statusCode int, message string, code any) {
	c.JSON(statusCode, gin.H{
		"error": types.OpenAIError{
			Message: strings.TrimSpace(message),
			Type:    string(types.ErrorTypeNewAPIError),
			Param:   "",
			Code:    code,
		},
	})
}
