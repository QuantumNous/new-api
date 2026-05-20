package apiwenhao

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
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

const (
	ChannelName        = "apiwenhao"
	createTaskPath     = "/open/v1/createtask"
	queryTaskPath      = "/open/v1/querytask"
	createSuccessCode  = 1
	resTypeSuccess     = "success"
	resTypeFail        = "fail"
)

// inProgressResTypes are upstream res_type values that mean the task is still running.
var inProgressResTypes = map[string]struct{}{
	"generating":   {},
	"processing":   {},
	"pending":      {},
	"queued":       {},
	"running":      {},
	"in_progress":  {},
	"submitting":   {},
	"submitted":    {},
}

// TaskAdaptor implements ApiWenhao async create/query task API.
type TaskAdaptor struct {
	taskcommon.BaseBilling
	baseURL string
	apiKey  string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = apiOrigin(info.ChannelBaseUrl)
	a.apiKey = info.ApiKey
}

func apiOrigin(raw string) string {
	b := strings.TrimRight(strings.TrimSpace(raw), "/")
	for _, suf := range []string{createTaskPath, queryTaskPath, "/open/v1"} {
		b = trimSuffixFold(b, suf)
	}
	return strings.TrimRight(b, "/")
}

func trimSuffixFold(s, suf string) string {
	if len(s) < len(suf) {
		return s
	}
	tail := s[len(s)-len(suf):]
	if strings.EqualFold(tail, suf) {
		return strings.TrimRight(s[:len(s)-len(suf)], "/")
	}
	return s
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + createTaskPath, nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
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
	body, err := a.convertCreatePayload(&req, info)
	if err != nil {
		return nil, errors.Wrap(err, "convert create payload failed")
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

type upstreamEnvelope struct {
	ReqKey string                 `json:"req_key"`
	Data   map[string]interface{} `json:"data"`
}

func (a *TaskAdaptor) convertCreatePayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*upstreamEnvelope, error) {
	reqKey := strings.TrimSpace(info.UpstreamModelName)
	if reqKey == "" {
		return nil, fmt.Errorf("upstream model (req_key) is empty; configure model mapping on the channel")
	}

	data := map[string]interface{}{}
	if strings.TrimSpace(req.Prompt) != "" {
		data["prompt"] = req.Prompt
	}
	if ratio := strings.TrimSpace(req.AspectRatio); ratio != "" {
		data["aspect_ratio"] = ratio
	} else if ratio := strings.TrimSpace(req.Ratio); ratio != "" {
		data["aspect_ratio"] = ratio
	}
	if size := strings.TrimSpace(req.Size); size != "" {
		data["size"] = size
	}
	if images := collectInputImages(req); len(images) > 0 {
		data["image"] = images
	}
	if err := taskcommon.UnmarshalMetadata(req.Metadata, &data); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	return &upstreamEnvelope{ReqKey: reqKey, Data: data}, nil
}

func collectInputImages(req *relaycommon.TaskSubmitReq) []string {
	if len(req.Images) > 0 {
		return req.Images
	}
	if strings.TrimSpace(req.Image) != "" {
		return []string{strings.TrimSpace(req.Image)}
	}
	return nil
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

	upstreamID, err := parseCreateTaskID(responseBody)
	if err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "invalid_response", http.StatusInternalServerError)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.Model = info.OriginModelName
	ov.Status = dto.VideoStatusQueued
	c.JSON(http.StatusOK, ov)
	return upstreamID, responseBody, nil
}

func parseCreateTaskID(respBody []byte) (string, error) {
	raw := string(respBody)
	if code := gjson.Get(raw, "code"); code.Exists() && code.Int() != createSuccessCode {
		msg := strings.TrimSpace(gjson.Get(raw, "msg").String())
		if msg == "" {
			msg = strings.TrimSpace(gjson.Get(raw, "data.msg").String())
		}
		if msg == "" {
			msg = "upstream create task failed"
		}
		return "", fmt.Errorf("%s", msg)
	}
	for _, path := range []string{
		"data.task_id",
		"data.data.task_id",
		"task_id",
	} {
		id := strings.TrimSpace(gjson.Get(raw, path).String())
		if id != "" {
			return id, nil
		}
	}
	return "", fmt.Errorf("task_id not found in create response")
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	reqKey := fetchReqKey(body)
	if reqKey == "" {
		return nil, fmt.Errorf("req_key is required for query; ensure task has upstream model mapping stored")
	}

	payload := upstreamEnvelope{
		ReqKey: reqKey,
		Data: map[string]interface{}{
			"task_id": taskID,
		},
	}
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return nil, errors.Wrap(err, "marshal query payload failed")
	}

	url := apiOrigin(baseUrl) + queryTaskPath
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func fetchReqKey(body map[string]any) string {
	for _, k := range []string{"req_key", "upstream_model"} {
		if v, ok := body[k].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	raw := unwrapQueryJSON(respBody)
	resType := getResType(raw)

	taskResult := relaycommon.TaskInfo{Code: 0}

	switch resType {
	case resTypeFail:
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = extractFailureReason(raw)
		return &taskResult, nil
	case resTypeSuccess:
		if url := extractMediaURL(raw); url != "" {
			taskResult.Status = model.TaskStatusSuccess
			taskResult.Progress = "100%"
			taskResult.Url = url
			return &taskResult, nil
		}
		if status := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "data.result.status").String())); status == "completed" {
			if url := extractMediaURL(raw); url != "" {
				taskResult.Status = model.TaskStatusSuccess
				taskResult.Progress = "100%"
				taskResult.Url = url
				return &taskResult, nil
			}
		}
	}

	if _, ok := inProgressResTypes[resType]; ok || (resType == "" && isUpstreamInProgress(raw)) {
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = extractProgressLabel(raw)
		return &taskResult, nil
	}

	taskResult.Status = model.TaskStatusInProgress
	taskResult.Progress = extractProgressLabel(raw)
	return &taskResult, nil
}

func getResType(raw string) string {
	for _, path := range []string{"res_type", "data.res_type"} {
		if rt := strings.ToLower(strings.TrimSpace(gjson.Get(raw, path).String())); rt != "" {
			return rt
		}
	}
	return ""
}

func isUpstreamInProgress(raw string) bool {
	stateText := strings.TrimSpace(gjson.Get(raw, "data.data.state_text").String())
	if stateText == "" {
		stateText = strings.TrimSpace(gjson.Get(raw, "data.state_text").String())
	}
	if stateText == "进行中" || strings.Contains(stateText, "进行") {
		return true
	}
	state := gjson.Get(raw, "data.data.state").Int()
	if state == 0 && gjson.Get(raw, "data.data").Exists() {
		upStatus := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "data.data.result.status").String()))
		if upStatus == "unknown" || upStatus == "processing" || upStatus == "queued" {
			return true
		}
	}
	return false
}

func extractProgressLabel(raw string) string {
	for _, path := range []string{
		"data.data.result.progress",
		"data.result.progress",
		"data.data.result.result.progress",
	} {
		p := gjson.Get(raw, path).Int()
		if p > 0 && p < 100 {
			return fmt.Sprintf("%d%%", p)
		}
	}
	for _, path := range []string{"data.data.state_text", "data.state_text", "data.data.tips"} {
		if label := strings.TrimSpace(gjson.Get(raw, path).String()); label != "" {
			return label
		}
	}
	return "30%"
}

func unwrapQueryJSON(respBody []byte) string {
	raw := string(respBody)
	if getResType(raw) != "" || extractMediaURL(raw) != "" {
		return raw
	}
	// Query often wraps as {code,msg,data:{res_type,...}} or {code,data:{data:{...},res_type}}.
	for _, path := range []string{"data", "data.data"} {
		v := gjson.Get(raw, path)
		if !v.Exists() || !v.IsObject() {
			continue
		}
		candidate := v.Raw
		if getResType(candidate) != "" {
			return candidate
		}
	}
	if inner := gjson.Get(raw, "data"); inner.Exists() && inner.IsObject() {
		if inner.Get("res_type").Exists() {
			return inner.Raw
		}
	}
	return raw
}

func extractMediaURL(raw string) string {
	for _, path := range []string{
		"data.video_url",
		"video_url",
		"data.data.video_url",
		"data.image_url",
		"image_url",
		"data.data.image_url",
		"data.result.result.videos.0.url.0",
		"data.result.result.videos.0.url",
		"data.data.result.result.videos.0.url.0",
	} {
		val := gjson.Get(raw, path)
		if !val.Exists() {
			continue
		}
		if val.IsArray() {
			u := strings.TrimSpace(val.Array()[0].String())
			if u != "" {
				return u
			}
			continue
		}
		u := strings.TrimSpace(val.String())
		if u != "" {
			return u
		}
	}
	return ""
}

func extractFailureReason(raw string) string {
	for _, path := range []string{
		"data.error.message",
		"data.data.error.message",
		"data.msg",
		"msg",
	} {
		if msg := strings.TrimSpace(gjson.Get(raw, path).String()); msg != "" {
			if msg == "操作成功" || msg == "进行中" || strings.Contains(msg, "进行") {
				continue
			}
			return msg
		}
	}
	return "task failed"
}

func (a *TaskAdaptor) GetModelList() []string {
	return nil
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	openAIVideo := originTask.ToOpenAIVideo()
	if ti, err := a.ParseTaskResult(originTask.Data); err == nil && ti != nil {
		if ti.Status == model.TaskStatusSuccess && ti.Url != "" {
			openAIVideo.SetMetadata("url", ti.Url)
			openAIVideo.Status = dto.VideoStatusCompleted
		} else if ti.Status == model.TaskStatusFailure {
			openAIVideo.Status = dto.VideoStatusFailed
			openAIVideo.Error = &dto.OpenAIVideoError{Message: ti.Reason}
		}
	}
	return common.Marshal(openAIVideo)
}
