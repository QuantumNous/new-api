package mao

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// TaskAdaptor implements mao (catertx Seedance) async video API.
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
	for _, suf := range []string{createPath, "/video/generations", "/v1/video/generations"} {
		b = trimSuffixFold(b, suf)
	}
	if strings.HasSuffix(strings.ToLower(b), "/v1") {
		return strings.TrimRight(b, "/")
	}
	return strings.TrimRight(b, "/") + "/v1"
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

	logic := strings.TrimSpace(info.UpstreamModelName)
	if logic == "" {
		logic = strings.TrimSpace(info.OriginModelName)
	}
	if logic == "" {
		return nil, fmt.Errorf("model is empty; use one of: %s", strings.Join(ModelList, ", "))
	}

	payload, err := buildUpstreamPayload(body, logic)
	if err != nil {
		return nil, errors.Wrap(err, "build upstream payload failed")
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	c.Set(taskcommon.GinKeyUpstreamRequestBody, string(data))
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
	return parseTaskResult(respBody)
}

func durationFromRequest(req *relaycommon.TaskSubmitReq) int {
	if req.Duration > 0 {
		return req.Duration
	}
	if sec, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil && sec > 0 {
		return sec
	}
	return 0
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if !billing_setting.IsPerSecondModel(info.OriginModelName) && !isPerSecondModel(info.OriginModelName) {
		return nil
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	sec := durationFromRequest(&req)
	if sec <= 0 {
		sec = taskcommon.DefaultPerSecondPrechargeSeconds
	}
	return map[string]float64{"seconds": float64(sec)}
}

// AdjustBillingOnComplete settles per_second models by upstream actual duration.
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
	if !billing_setting.IsPerSecondModel(modelName) && !isPerSecondModel(modelName) {
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
