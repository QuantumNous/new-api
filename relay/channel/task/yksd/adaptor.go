package yksd

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
	"github.com/QuantumNous/new-api/setting/billing_setting"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/tidwall/gjson"
)

// TaskAdaptor implements yk-sd (KYY Seedance special/discount) async video API
// with forced asset library ingestion for all media inputs.
type TaskAdaptor struct {
	taskcommon.BaseBilling
	baseURL string
	apiKey  string

	// assetClientFactory is overridable in tests.
	assetClientFactory func(baseURL, apiKey string) *assetClient
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = apiOrigin(info.ChannelBaseUrl)
	a.apiKey = info.ApiKey
}

func apiOrigin(raw string) string {
	b := strings.TrimRight(strings.TrimSpace(raw), "/")
	if b == "" {
		return defaultBase
	}
	for _, suf := range []string{createPath, "/v2/model-center/tasks", "/v2/model-center", "/v2", assetUpload, assetDetail, "/asset/seedance2"} {
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
	if info.Action == constant.TaskActionRemix {
		return service.TaskErrorWrapperLocal(fmt.Errorf("remix is not supported for yk-sd"), "not_supported", http.StatusBadRequest)
	}
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + createPath, nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	body, err := readRequestBodyMap(c)
	if err != nil {
		return nil, err
	}

	var raw []byte
	if storage, err := common.GetBodyStorage(c); err == nil {
		raw, _ = storage.Bytes()
	}
	if len(raw) == 0 {
		if b, e := common.Marshal(body); e == nil {
			raw = b
		}
	}
	if len(raw) > 0 {
		normalizeVolcOfficialInBodyMap(body, raw)
	}

	modelName := strings.TrimSpace(info.UpstreamModelName)
	if modelName == "" {
		modelName = strings.TrimSpace(info.OriginModelName)
	}
	if modelName == "" {
		if m, _ := body["model"].(string); strings.TrimSpace(m) != "" {
			modelName = strings.TrimSpace(m)
		}
	}
	if modelName == "" {
		return nil, fmt.Errorf("model is empty; use one of: %s", strings.Join(ModelList, ", "))
	}

	if err := normalizeCreateBody(body, modelName); err != nil {
		return nil, err
	}

	factory := a.assetClientFactory
	if factory == nil {
		factory = newAssetClient
	}
	if err := forceAssetsInBody(factory(a.baseURL, a.apiKey), body); err != nil {
		return nil, fmt.Errorf("force seedance assets: %w", err)
	}

	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func readRequestBodyMap(c *gin.Context) (map[string]interface{}, error) {
	if storage, err := common.GetBodyStorage(c); err == nil {
		raw, err := storage.Bytes()
		if err == nil && len(raw) > 0 {
			var body map[string]interface{}
			if err := common.Unmarshal(raw, &body); err == nil {
				if body == nil {
					body = make(map[string]interface{})
				}
				return body, nil
			}
		}
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, errors.Wrap(err, "get task request failed")
	}
	encoded, err := common.Marshal(req)
	if err != nil {
		return nil, err
	}
	var body map[string]interface{}
	if err := common.Unmarshal(encoded, &body); err != nil {
		return nil, err
	}
	if body == nil {
		body = make(map[string]interface{})
	}
	return body, nil
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
	if msg := extractErrorMessage(raw); msg != "" && isUpstreamError(raw) {
		return "", fmt.Errorf("%s", msg)
	}
	for _, path := range []string{"id", "task_id", "data.id", "data.task_id"} {
		if id := strings.TrimSpace(gjson.Get(raw, path).String()); id != "" {
			return id, nil
		}
	}
	return "", fmt.Errorf("task id not found in create response")
}

func isUpstreamError(raw string) bool {
	status := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "status").String()))
	if status == "failed" || status == "error" || status == "failure" {
		return true
	}
	if errNode := gjson.Get(raw, "error"); errNode.Exists() && errNode.Type != gjson.Null {
		if status == "" || status == "failed" {
			return true
		}
	}
	if msg := strings.TrimSpace(gjson.Get(raw, "message").String()); msg != "" {
		if code := gjson.Get(raw, "statusCode"); code.Exists() && code.Int() >= 400 {
			return true
		}
	}
	if code := gjson.Get(raw, "code"); code.Exists() && code.Type == gjson.Number && code.Int() >= 400 {
		if extractErrorMessage(raw) != "" {
			return true
		}
	}
	return false
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	queryURL, err := buildQueryURL(baseUrl, taskID)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodGet, queryURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func buildQueryURL(baseUrl, taskID string) (string, error) {
	u, err := url.Parse(apiOrigin(baseUrl) + queryPathFmt + url.PathEscape(taskID))
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	raw := string(respBody)
	if isUpstreamError(raw) {
		ti := relaycommon.TaskInfo{
			Status:   model.TaskStatusFailure,
			Progress: "100%",
			Reason:   extractErrorMessage(raw),
		}
		if ti.Reason == "" {
			ti.Reason = "task failed"
		}
		return &ti, nil
	}

	status := resolveUpstreamStatus(raw)
	taskResult := relaycommon.TaskInfo{Code: 0}

	if isFailureUpstreamStatus(status) {
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = extractErrorMessage(raw)
		if taskResult.Reason == "" {
			taskResult.Reason = "task failed"
		}
		return &taskResult, nil
	}

	if u := extractVideoURL(raw); u != "" && isSuccessLikeUpstreamStatus(status) {
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = u
		return &taskResult, nil
	}

	if isInProgressUpstreamStatus(status) {
		taskResult.Status = model.TaskStatusInProgress
		if status == "queued" {
			taskResult.Status = model.TaskStatusQueued
		}
		taskResult.Progress = formatProgress(raw, status)
		return &taskResult, nil
	}

	if isSuccessLikeUpstreamStatus(status) {
		if u := extractVideoURL(raw); u != "" {
			taskResult.Status = model.TaskStatusSuccess
			taskResult.Progress = "100%"
			taskResult.Url = u
			return &taskResult, nil
		}
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = "completed but video url is empty"
		return &taskResult, nil
	}

	if u := extractVideoURL(raw); u != "" {
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = u
		return &taskResult, nil
	}

	taskResult.Status = model.TaskStatusInProgress
	taskResult.Progress = formatProgress(raw, status)
	return &taskResult, nil
}

func resolveUpstreamStatus(raw string) string {
	return strings.ToLower(strings.TrimSpace(gjson.Get(raw, "status").String()))
}

func isFailureUpstreamStatus(status string) bool {
	switch status {
	case "failed", "failure", "error", "cancelled", "canceled":
		return true
	default:
		return false
	}
}

func isInProgressUpstreamStatus(status string) bool {
	switch status {
	case "pending", "queued", "processing", "running", "in_progress", "submitted":
		return true
	default:
		return false
	}
}

func isSuccessLikeUpstreamStatus(status string) bool {
	switch status {
	case "success", "completed", "succeeded":
		return true
	default:
		return false
	}
}

func formatProgress(raw, status string) string {
	if p := gjson.Get(raw, "progress"); p.Exists() {
		switch p.Type {
		case gjson.Number:
			n := int(p.Int())
			if n < 0 {
				n = 0
			}
			if n > 100 {
				n = 100
			}
			return strconv.Itoa(n) + "%"
		case gjson.String:
			s := strings.TrimSpace(p.String())
			if s != "" {
				if !strings.HasSuffix(s, "%") {
					if n, err := strconv.Atoi(s); err == nil {
						return strconv.Itoa(n) + "%"
					}
				}
				return s
			}
		}
	}
	switch status {
	case "queued", "pending", "submitted":
		return "10%"
	case "processing", "running", "in_progress":
		return "50%"
	default:
		return "30%"
	}
}

func extractVideoURL(raw string) string {
	for _, path := range []string{"video_url", "result_url", "url", "data.video_url", "data.result_url"} {
		val := gjson.Get(raw, path)
		if !val.Exists() {
			continue
		}
		if u := strings.TrimSpace(val.String()); u != "" && strings.HasPrefix(u, "http") {
			return u
		}
	}
	return ""
}

func extractErrorMessage(raw string) string {
	for _, path := range []string{
		"error.message",
		"error",
		"errorMessage",
		"message",
		"msg",
		"fail_reason",
	} {
		node := gjson.Get(raw, path)
		if !node.Exists() || node.Type == gjson.Null {
			continue
		}
		if node.Type == gjson.String {
			if msg := strings.TrimSpace(node.String()); msg != "" {
				return msg
			}
			continue
		}
		if msg := strings.TrimSpace(node.Get("message").String()); msg != "" {
			return msg
		}
	}
	return ""
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if !billing_setting.IsPerSecondModel(info.OriginModelName) && !isYkSdPerSecondModel(info.OriginModelName) {
		return nil
	}
	sec := 0
	if body, err := readRequestBodyMap(c); err == nil {
		sec = durationFromBody(body)
	}
	if sec <= 0 {
		if req, err := relaycommon.GetTaskRequest(c); err == nil {
			if req.Duration > 0 {
				sec = req.Duration
			} else if n, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil && n > 0 {
				sec = n
			}
		}
	}
	if sec <= 0 {
		sec = defaultDurationSeconds
	}
	return map[string]float64{"seconds": float64(sec)}
}

func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	if task == nil || taskResult == nil || taskResult.Status != model.TaskStatusSuccess {
		return 0
	}
	bc := task.PrivateData.BillingContext
	if bc == nil || bc.ModelPrice <= 0 {
		return 0
	}
	modelName := bc.OriginModelName
	if modelName == "" {
		modelName = task.Properties.OriginModelName
	}
	if !billing_setting.IsPerSecondModel(modelName) && !isYkSdPerSecondModel(modelName) {
		return 0
	}
	sec := taskcommon.ExtractDurationSecondsFromJSON(task.Data)
	if sec <= 0 {
		return 0
	}
	return taskcommon.QuotaFromPerSecondModelPrice(bc.ModelPrice, sec, bc.GroupRatio, bc.OtherRatios)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	openAIVideo := originTask.ToOpenAIVideo()
	if ti, err := a.ParseTaskResult(originTask.Data); err == nil && ti != nil {
		switch ti.Status {
		case model.TaskStatusSuccess:
			openAIVideo.Status = dto.VideoStatusCompleted
			if ti.Url != "" {
				openAIVideo.SetMetadata("url", ti.Url)
			}
		case model.TaskStatusFailure:
			openAIVideo.Status = dto.VideoStatusFailed
			openAIVideo.Error = &dto.OpenAIVideoError{Message: ti.Reason}
		case model.TaskStatusInProgress, model.TaskStatusQueued, model.TaskStatusSubmitted:
			openAIVideo.Status = dto.VideoStatusInProgress
			if ti.Progress != "" {
				openAIVideo.SetProgressStr(ti.Progress)
			}
		}
	}
	return common.Marshal(openAIVideo)
}
