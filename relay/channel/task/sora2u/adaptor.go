package sora2u

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

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
	proxy   string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = apiOrigin(info.ChannelBaseUrl)
	a.apiKey = info.ApiKey
	a.proxy = strings.TrimSpace(info.ChannelSetting.Proxy)
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if info.Action == constant.TaskActionRemix {
		return service.TaskErrorWrapperLocal(fmt.Errorf("remix is not supported for Sora2U"), "not_supported", http.StatusBadRequest)
	}
	if taskErr := relaycommon.ValidateMultipartDirect(c, info); taskErr != nil {
		return taskErr
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	prompt := strings.TrimSpace(req.Prompt)
	if utf8.RuneCountInString(prompt) < 10 {
		return service.TaskErrorWrapperLocal(fmt.Errorf("prompt must be at least 10 characters"), "invalid_request", http.StatusBadRequest)
	}
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return map[string]float64{"seconds": 5}
	}
	seconds, _ := strconv.Atoi(req.Seconds)
	if seconds == 0 {
		seconds = req.Duration
	}
	if seconds <= 0 {
		seconds = 5
	}
	return map[string]float64{"seconds": float64(seconds)}
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
	contentType := c.GetHeader("Content-Type")
	var bodyMap map[string]interface{}

	if strings.Contains(contentType, "multipart/form-data") {
		formData, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, errors.Wrap(err, "parse_multipart_failed")
		}
		bodyMap = multipartFormToBodyMap(formData)
	} else {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return nil, errors.Wrap(err, "get_request_body_failed")
		}
		cachedBody, err := storage.Bytes()
		if err != nil {
			return nil, errors.Wrap(err, "read_body_bytes_failed")
		}
		if err := common.Unmarshal(cachedBody, &bodyMap); err != nil {
			return nil, errors.Wrap(err, "unmarshal_request_body_failed")
		}
		if bodyMap == nil {
			bodyMap = map[string]interface{}{}
		}
	}

	bodyMap["model"] = info.UpstreamModelName
	normalizeCreateBody(bodyMap)
	out, err := common.Marshal(bodyMap)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_request_body_failed")
	}
	c.Request.Header.Set("Content-Type", "application/json")
	return bytes.NewReader(out), nil
}

func multipartFormToBodyMap(formData *multipart.Form) map[string]interface{} {
	body := make(map[string]interface{})
	if formData == nil {
		return body
	}
	scalarKeys := []string{
		"prompt", "model", "seconds", "duration", "size", "aspect_ratio", "resolution",
		"mute", "disable_audio", "reference", "reference_url", "image", "image_base64", "image_url",
	}
	for _, key := range scalarKeys {
		if vals := formData.Value[key]; len(vals) > 0 {
			v := strings.TrimSpace(vals[0])
			if v == "" {
				continue
			}
			if key == "mute" || key == "disable_audio" {
				if b, ok := parseBoolFlexible(v); ok {
					body[key] = b
				}
				continue
			}
			if key == "duration" {
				if n, err := strconv.Atoi(v); err == nil {
					body[key] = n
					continue
				}
			}
			body[key] = v
		}
	}
	if vals := formData.Value["references"]; len(vals) > 0 {
		body["references"] = nonEmptyStrings(vals)
	}
	if vals := formData.Value["reference_urls"]; len(vals) > 0 {
		body["reference_urls"] = nonEmptyStrings(vals)
	}

	var fileRefs []string
	for fieldName, files := range formData.File {
		lower := strings.ToLower(fieldName)
		if !(strings.Contains(lower, "image") || strings.Contains(lower, "reference") ||
			strings.Contains(lower, "video") || strings.Contains(lower, "audio") ||
			lower == "input_reference" || lower == "file") {
			continue
		}
		for _, fh := range files {
			dataURL, err := fileHeaderToDataURL(fh)
			if err != nil || dataURL == "" {
				continue
			}
			fileRefs = append(fileRefs, dataURL)
		}
	}
	if len(fileRefs) == 1 {
		if _, has := body["reference"]; !has {
			body["reference"] = fileRefs[0]
		} else {
			body["references"] = append(stringSlice(body["references"]), fileRefs...)
		}
	} else if len(fileRefs) > 1 {
		body["references"] = append(stringSlice(body["references"]), fileRefs...)
	}
	return body
}

func fileHeaderToDataURL(fh *multipart.FileHeader) (string, error) {
	f, err := fh.Open()
	if err != nil {
		return "", err
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		return "", err
	}
	if len(data) == 0 {
		return "", fmt.Errorf("empty file")
	}
	ct := fh.Header.Get("Content-Type")
	if ct == "" || ct == "application/octet-stream" {
		ct = http.DetectContentType(data)
	}
	return "data:" + ct + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}

func nonEmptyStrings(vals []string) []string {
	out := make([]string, 0, len(vals))
	for _, v := range vals {
		v = strings.TrimSpace(v)
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}

func stringSlice(v interface{}) []string {
	switch x := v.(type) {
	case []string:
		return append([]string{}, x...)
	case []interface{}:
		out := make([]string, 0, len(x))
		for _, e := range x {
			if s, ok := e.(string); ok && strings.TrimSpace(s) != "" {
				out = append(out, strings.TrimSpace(s))
			}
		}
		return out
	default:
		return nil
	}
}

func parseBoolFlexible(s string) (bool, bool) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "1", "true", "yes", "on":
		return true, true
	case "0", "false", "no", "off":
		return false, true
	default:
		return false, false
	}
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

type clientCreateResp struct {
	ID        string `json:"id"`
	TaskID    string `json:"task_id,omitempty"`
	Object    string `json:"object"`
	Model     string `json:"model"`
	Status    string `json:"status"`
	Progress  int    `json:"progress"`
	CreatedAt int64  `json:"created_at"`
}

func mapUpstreamStatusForClient(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "pending", "queued", "submitted":
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

	out := clientCreateResp{
		ID:        info.PublicTaskID,
		TaskID:    info.PublicTaskID,
		Object:    "video",
		Model:     info.UpstreamModelName,
		Status:    mapUpstreamStatusForClient(status),
		CreatedAt: common.GetTimestamp(),
	}
	c.JSON(http.StatusOK, out)
	return upstreamID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	uri := apiOrigin(baseUrl) + createPath + "/" + strings.TrimSpace(taskID)
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
	return parseTaskResult(respBody)
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	openAIVideo := originTask.ToOpenAIVideo()
	if u := strings.TrimSpace(gjson.GetBytes(originTask.Data, "task.video_url").String()); u != "" {
		openAIVideo.SetMetadata("url", u)
	} else if u := strings.TrimSpace(gjson.GetBytes(originTask.Data, "video_url").String()); u != "" {
		openAIVideo.SetMetadata("url", u)
	}
	return common.Marshal(openAIVideo)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}
