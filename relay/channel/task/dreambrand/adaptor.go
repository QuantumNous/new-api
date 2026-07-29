package dreambrand

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

type requestPayload struct {
	Prompt   string  `json:"prompt"`
	Model    string  `json:"model"`
	Size     *string `json:"size,omitempty"`
	Duration *string `json:"duration,omitempty"`
	Pic      *string `json:"pic,omitempty"`
}

type createResponse struct {
	ID     string `json:"id"`
	TaskID string `json:"task_id"`
}

type createResponseEnvelope struct {
	Data createResponse `json:"data"`
}

type taskResponse struct {
	ID      string          `json:"id"`
	TaskID  string          `json:"task_id"`
	Status  string          `json:"status"`
	URL     string          `json:"url"`
	Created int64           `json:"created"`
	Message string          `json:"message"`
	Msg     string          `json:"msg"`
	Reason  string          `json:"reason"`
	Error   json.RawMessage `json:"error"`
}

type taskResponseEnvelope struct {
	Data taskResponse `json:"data"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	baseURL string
	apiKey  string
}

func buildURL(baseURL, path string) string {
	return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(path, "/")
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return buildURL(a.baseURL, CreatePath), nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	payload := requestPayload{
		Prompt: req.Prompt,
	}
	modelName := info.UpstreamModelName
	if modelName == "" {
		modelName = req.Model
	}
	payload.Model = ResolveModelName(modelName)
	info.UpstreamModelName = payload.Model
	if req.Size != "" {
		payload.Size = stringPointer(req.Size)
	}
	if duration, ok := resolveDuration(req); ok {
		payload.Duration = stringPointer(duration)
	}
	if pic := firstImage(req); pic != "" {
		payload.Pic = stringPointer(pic)
	}

	data, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func stringPointer(value string) *string {
	return &value
}

func resolveDuration(req relaycommon.TaskSubmitReq) (string, bool) {
	if req.DurationSet || req.Duration != 0 {
		return strconv.Itoa(req.Duration), true
	}
	seconds := strings.TrimSpace(req.Seconds)
	if seconds != "" {
		return seconds, true
	}
	return "", false
}

func firstImage(req relaycommon.TaskSubmitReq) string {
	if len(req.Images) > 0 {
		return strings.TrimSpace(req.Images[0])
	}
	if image := strings.TrimSpace(req.Image); image != "" {
		return image
	}
	return strings.TrimSpace(req.InputReference)
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	created, err := parseCreateResponse(responseBody)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
	}
	taskID = created.ID
	if taskID == "" {
		taskID = created.TaskID
	}
	if taskID == "" {
		return "", nil, service.TaskErrorWrapper(errors.New("task_id is empty"), "invalid_response", http.StatusInternalServerError)
	}

	video := dto.NewOpenAIVideo()
	video.ID = info.PublicTaskID
	video.TaskID = info.PublicTaskID
	video.CreatedAt = time.Now().Unix()
	video.Model = info.OriginModelName
	if req, getErr := relaycommon.GetTaskRequest(c); getErr == nil {
		video.Size = req.Size
		if duration, ok := resolveDuration(req); ok {
			video.Seconds = duration
		}
	}
	c.JSON(http.StatusOK, video)

	return taskID, responseBody, nil
}

func parseCreateResponse(body []byte) (createResponse, error) {
	var direct createResponse
	if err := common.Unmarshal(body, &direct); err != nil {
		return createResponse{}, err
	}
	if direct.ID != "" || direct.TaskID != "" {
		return direct, nil
	}

	var envelope createResponseEnvelope
	if err := common.Unmarshal(body, &envelope); err != nil {
		return createResponse{}, err
	}
	return envelope.Data, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, errors.New("invalid task_id")
	}

	uri := buildURL(baseURL, fmt.Sprintf(QueryPath, url.PathEscape(taskID)))
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func parseTaskResponse(body []byte) (taskResponse, error) {
	var direct taskResponse
	if err := common.Unmarshal(body, &direct); err != nil {
		return taskResponse{}, err
	}
	if direct.ID != "" || direct.TaskID != "" || direct.Status != "" || direct.URL != "" ||
		direct.Message != "" || direct.Msg != "" || direct.Reason != "" || len(direct.Error) > 0 {
		return direct, nil
	}

	var envelope taskResponseEnvelope
	if err := common.Unmarshal(body, &envelope); err != nil {
		return taskResponse{}, err
	}
	return envelope.Data, nil
}

func normalizeStatus(status string) model.TaskStatus {
	normalized := strings.ToLower(strings.TrimSpace(status))
	normalized = strings.NewReplacer("-", "_", " ", "_").Replace(normalized)
	switch normalized {
	case "submitted", "created", "not_start", "not_started":
		return model.TaskStatusSubmitted
	case "queued", "queue", "pending", "waiting":
		return model.TaskStatusQueued
	case "processing", "in_progress", "running", "generating":
		return model.TaskStatusInProgress
	case "success", "succeeded", "completed", "complete", "done":
		return model.TaskStatusSuccess
	case "failed", "failure", "error", "cancelled", "canceled", "expired":
		return model.TaskStatusFailure
	default:
		return model.TaskStatusInProgress
	}
}

func errorReason(response taskResponse) string {
	for _, value := range []string{response.Message, response.Msg, response.Reason} {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	if len(response.Error) == 0 || string(response.Error) == "null" {
		return ""
	}
	var message string
	if err := common.Unmarshal(response.Error, &message); err == nil {
		return message
	}
	var object struct {
		Message string `json:"message"`
		Msg     string `json:"msg"`
		Code    string `json:"code"`
	}
	if err := common.Unmarshal(response.Error, &object); err == nil {
		for _, value := range []string{object.Message, object.Msg, object.Code} {
			if strings.TrimSpace(value) != "" {
				return value
			}
		}
	}
	return string(response.Error)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	response, err := parseTaskResponse(respBody)
	if err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}
	status := normalizeStatus(response.Status)
	reason := errorReason(response)
	if strings.TrimSpace(response.Status) == "" && reason != "" {
		status = model.TaskStatusFailure
	}
	result := &relaycommon.TaskInfo{
		TaskID: response.ID,
		Status: string(status),
		Url:    response.URL,
		Reason: reason,
	}
	if result.TaskID == "" {
		result.TaskID = response.TaskID
	}
	switch status {
	case model.TaskStatusSubmitted:
		result.Progress = taskcommon.ProgressSubmitted
	case model.TaskStatusQueued:
		result.Progress = taskcommon.ProgressQueued
	case model.TaskStatusInProgress:
		result.Progress = taskcommon.ProgressInProgress
	case model.TaskStatusSuccess, model.TaskStatusFailure:
		result.Progress = taskcommon.ProgressComplete
	}
	return result, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	response, err := parseTaskResponse(originTask.Data)
	if err != nil {
		return nil, errors.Wrap(err, "unmarshal dreambrand task data failed")
	}

	video := dto.NewOpenAIVideo()
	video.ID = originTask.TaskID
	video.TaskID = originTask.TaskID
	video.Status = originTask.Status.ToVideoStatus()
	video.SetProgressStr(originTask.Progress)
	video.CreatedAt = originTask.CreatedAt
	if response.Created > 0 {
		video.CreatedAt = response.Created
	}
	video.CompletedAt = originTask.UpdatedAt
	video.Model = originTask.Properties.OriginModelName
	resultURL := response.URL
	if resultURL == "" {
		resultURL = originTask.GetResultURL()
	}
	if resultURL != "" {
		video.SetMetadata("url", resultURL)
	}
	if originTask.Status == model.TaskStatusFailure {
		message := errorReason(response)
		if message == "" {
			message = originTask.FailReason
		}
		code := strings.ToLower(strings.TrimSpace(response.Status))
		if code == "" {
			code = "failed"
		}
		video.Error = &dto.OpenAIVideoError{
			Message: message,
			Code:    code,
		}
	}
	return common.Marshal(video)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}
