package zzdh

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/tidwall/gjson"
)

type TaskAdaptor struct {
	taskcommon.BaseBilling
	baseURL string
	apiKey  string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = apiOrigin(info.ChannelBaseUrl)
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if info.Action == constant.TaskActionRemix {
		return service.TaskErrorWrapperLocal(fmt.Errorf("remix is not supported for ZiZiDongHua"), "not_supported", http.StatusBadRequest)
	}
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	sec := defaultDurSec
	if body, err := readBodyMap(c); err == nil {
		if d := durationFromBody(body); d > 0 {
			sec = d
		}
	} else if req, err := relaycommon.GetTaskRequest(c); err == nil {
		if req.Duration > 0 {
			sec = req.Duration
		} else if n, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil && n > 0 {
			sec = n
		}
	}
	if sec < minDurSec {
		sec = defaultDurSec
	}
	return map[string]float64{"seconds": float64(sec)}
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + createPath, nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	bodyMap, err := readBodyMap(c)
	if err != nil {
		return nil, err
	}
	modelName := strings.TrimSpace(info.UpstreamModelName)
	if modelName == "" {
		return nil, fmt.Errorf("upstream model is empty; configure model mapping on the channel")
	}
	if err := normalizeCreateBody(bodyMap, modelName); err != nil {
		return nil, err
	}
	out, err := common.Marshal(bodyMap)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_request_body_failed")
	}
	c.Request.Header.Set("Content-Type", "application/json")
	return bytes.NewReader(out), nil
}

func readBodyMap(c *gin.Context) (map[string]interface{}, error) {
	contentType := c.GetHeader("Content-Type")
	if strings.Contains(contentType, "multipart/form-data") {
		formData, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, errors.Wrap(err, "parse_multipart_failed")
		}
		return multipartFormToBodyMap(formData), nil
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_request_body_failed")
	}
	cachedBody, err := storage.Bytes()
	if err != nil {
		return nil, errors.Wrap(err, "read_body_bytes_failed")
	}
	var bodyMap map[string]interface{}
	if err := common.Unmarshal(cachedBody, &bodyMap); err != nil {
		return nil, errors.Wrap(err, "unmarshal_request_body_failed")
	}
	if bodyMap == nil {
		bodyMap = map[string]interface{}{}
	}
	return bodyMap, nil
}

func multipartFormToBodyMap(formData *multipart.Form) map[string]interface{} {
	body := make(map[string]interface{})
	if formData == nil {
		return body
	}
	scalarKeys := []string{
		"prompt", "model", "seconds", "duration", "size", "aspect_ratio", "ratio",
		"resolution", "fps", "seed",
	}
	for _, key := range scalarKeys {
		if vals := formData.Value[key]; len(vals) > 0 {
			v := strings.TrimSpace(vals[0])
			if v == "" {
				continue
			}
			if key == "duration" || key == "fps" || key == "seed" {
				if n, err := strconv.Atoi(v); err == nil {
					body[key] = n
					continue
				}
			}
			body[key] = v
		}
	}
	// JSON array fields may be posted as a single JSON string.
	for _, key := range []string{"reference_images", "reference_videos", "reference_audios", "image_with_roles", "extra"} {
		if vals := formData.Value[key]; len(vals) > 0 {
			raw := strings.TrimSpace(vals[0])
			if raw == "" {
				continue
			}
			var parsed interface{}
			if err := common.Unmarshal([]byte(raw), &parsed); err == nil {
				body[key] = parsed
			}
		}
	}
	return body
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	upstreamID, status, err := parseCreateTask(responseBody)
	if err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "invalid_response", http.StatusInternalServerError)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.Model = info.OriginModelName
	ov.Status = mapUpstreamStatusForClient(status)
	c.JSON(http.StatusOK, ov)
	return upstreamID, responseBody, nil
}

func parseCreateTask(respBody []byte) (taskID, status string, err error) {
	raw := string(respBody)
	for _, path := range []string{"task_id", "id", "data.task_id", "data.id"} {
		if id := strings.TrimSpace(gjson.Get(raw, path).String()); id != "" {
			taskID = id
			break
		}
	}
	if taskID == "" {
		return "", "", fmt.Errorf("task id not found in create response")
	}
	status = strings.TrimSpace(gjson.Get(raw, "status").String())
	if status == "" {
		status = strings.TrimSpace(gjson.Get(raw, "data.status").String())
	}
	return taskID, status, nil
}

func mapUpstreamStatusForClient(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "queued", "pending", "submitted":
		return dto.VideoStatusQueued
	case "processing", "in_progress", "running":
		return dto.VideoStatusInProgress
	case "completed", "success", "succeeded":
		return dto.VideoStatusCompleted
	case "failed", "failure", "cancelled", "canceled", "error":
		return dto.VideoStatusFailed
	default:
		return dto.VideoStatusQueued
	}
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	uri := apiOrigin(baseUrl) + queryPathPref + strings.TrimSpace(taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Accept", "application/json")
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	raw := string(respBody)
	status := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "status").String()))
	if status == "" {
		status = strings.ToLower(strings.TrimSpace(gjson.Get(raw, "data.status").String()))
	}

	taskResult := relaycommon.TaskInfo{Code: 0}
	switch status {
	case "queued", "pending", "submitted":
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = "10%"
	case "processing", "in_progress", "running":
		taskResult.Status = model.TaskStatusInProgress
		if p := gjson.Get(raw, "progress").Int(); p > 0 && p < 100 {
			taskResult.Progress = fmt.Sprintf("%d%%", p)
		} else if p := gjson.Get(raw, "data.progress").Int(); p > 0 && p < 100 {
			taskResult.Progress = fmt.Sprintf("%d%%", p)
		} else {
			taskResult.Progress = "40%"
		}
	case "completed", "success", "succeeded":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		// Url left empty — download via authenticated /v1/videos/{id}/content proxy.
	case "failed", "failure", "cancelled", "canceled", "error":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = extractErrorMessage(raw)
		if taskResult.Reason == "" {
			taskResult.Reason = "task failed"
		}
	default:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
	}
	return &taskResult, nil
}

func extractErrorMessage(raw string) string {
	for _, path := range []string{
		"message",
		"msg",
		"error",
		"error.message",
		"data.message",
		"data.error",
		"data.error.message",
	} {
		if msg := strings.TrimSpace(gjson.Get(raw, path).String()); msg != "" {
			return msg
		}
	}
	return ""
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	openAIVideo := originTask.ToOpenAIVideo()
	if originTask.Status == model.TaskStatusSuccess {
		openAIVideo.Status = dto.VideoStatusCompleted
		openAIVideo.SetMetadata("url", taskcommon.BuildProxyURL(originTask.TaskID))
	} else if ti, err := a.ParseTaskResult(originTask.Data); err == nil && ti != nil {
		switch ti.Status {
		case model.TaskStatusSuccess:
			openAIVideo.Status = dto.VideoStatusCompleted
			openAIVideo.SetMetadata("url", taskcommon.BuildProxyURL(originTask.TaskID))
		case model.TaskStatusFailure:
			openAIVideo.Status = dto.VideoStatusFailed
			openAIVideo.Error = &dto.OpenAIVideoError{Message: ti.Reason}
		case model.TaskStatusInProgress, model.TaskStatusQueued, model.TaskStatusSubmitted:
			openAIVideo.Status = dto.VideoStatusInProgress
		}
	}
	return common.Marshal(openAIVideo)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}
