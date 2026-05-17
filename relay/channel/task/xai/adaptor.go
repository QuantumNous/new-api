package xai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
)

// TaskAdaptor implements xAI upstream video API:
// POST {origin}/v1/video/create , GET {origin}/v1/video/query?id={upstreamId}
// 若渠道「API 地址」已填到 .../v1/video/create，会先剥掉该后缀再拼接，避免出现 .../v1/video/create/v1/video/create。
type TaskAdaptor struct {
	taskcommon.BaseBilling
	baseURL string
	apiKey  string
}

// trimSuffixFold removes suffix from s with ASCII case-folding on the suffix match.
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

// xaiAPIOrigin returns scheme://host[:port] with optional path prefix, but without
// a trailing /v1/video/create or /v1/video/query segment (common misconfiguration).
func xaiAPIOrigin(raw string) string {
	b := strings.TrimRight(strings.TrimSpace(raw), "/")
	b = trimSuffixFold(b, "/v1/video/create")
	b = trimSuffixFold(b, "/v1/video/query")
	return strings.TrimRight(b, "/")
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = strings.TrimRight(strings.TrimSpace(info.ChannelBaseUrl), "/")
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) createURL() string {
	return xaiAPIOrigin(a.baseURL) + "/v1/video/create"
}

func buildXAIQueryURL(channelBase, upstreamTaskID string) (string, error) {
	u, err := url.Parse(xaiAPIOrigin(channelBase) + "/v1/video/query")
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("id", upstreamTaskID)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if info.Action == constant.TaskActionRemix {
		return service.TaskErrorWrapperLocal(fmt.Errorf("remix is not supported for xAI video"), "not_supported", http.StatusBadRequest)
	}
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.Action == constant.TaskActionRemix {
		return "", fmt.Errorf("remix is not supported for xAI video")
	}
	return a.createURL(), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Accept", "application/json")
	if ct := strings.TrimSpace(c.Request.Header.Get("Content-Type")); ct != "" {
		req.Header.Set("Content-Type", ct)
	} else {
		req.Header.Set("Content-Type", "application/json")
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
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
		return bytes.NewReader(cachedBody), nil
	}
	bodyMap["model"] = info.UpstreamModelName
	out, err := common.Marshal(bodyMap)
	if err != nil {
		return bytes.NewReader(cachedBody), nil
	}
	return bytes.NewReader(out), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// upstreamCreateResp matches xAI create JSON.
type upstreamCreateResp struct {
	ID               string `json:"id"`
	Status           string `json:"status"`
	StatusUpdateTime int64 `json:"status_update_time"`
}

// clientCreateResp aligns with OpenAI-style video task submit responses used elsewhere in the gateway.
type clientCreateResp struct {
	ID          string `json:"id"`
	TaskID      string `json:"task_id,omitempty"`
	Object      string `json:"object"`
	Model       string `json:"model"`
	Status      string `json:"status"`
	Progress    int    `json:"progress"`
	CreatedAt   int64  `json:"created_at"`
	CompletedAt int64  `json:"completed_at,omitempty"`
}

func mapUpstreamStatusForClient(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "pending", "queued", "submitted":
		return "queued"
	case "processing", "in_progress", "running":
		return "in_progress"
	case "completed", "success", "succeeded":
		return "completed"
	case "failed", "cancelled", "error":
		return "failed"
	default:
		return "queued"
	}
}

func statusUpdateTimeToCreatedAt(ts int64) int64 {
	if ts <= 0 {
		return 0
	}
	if ts > 1e12 {
		return ts / 1000
	}
	return ts
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var up upstreamCreateResp
	if err := common.Unmarshal(responseBody, &up); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}
	if strings.TrimSpace(up.ID) == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("upstream id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	out := clientCreateResp{
		ID:        info.PublicTaskID,
		TaskID:    info.PublicTaskID,
		Object:    "video",
		Model:     info.UpstreamModelName,
		Status:    mapUpstreamStatusForClient(up.Status),
		CreatedAt: statusUpdateTimeToCreatedAt(up.StatusUpdateTime),
	}
	c.JSON(http.StatusOK, out)
	return up.ID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	queryURL, err := buildXAIQueryURL(baseUrl, taskID)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodGet, queryURL, nil)
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

type upstreamQueryResp struct {
	Status   string  `json:"status"`
	VideoURL *string `json:"video_url"`

	// Some upstreams return message at top-level.
	Message string `json:"message,omitempty"`

	// Some upstreams return error as a plain string, others as an object.
	Error any `json:"error,omitempty"`
}

func extractErrorMessage(errField any) string {
	if errField == nil {
		return ""
	}
	switch v := errField.(type) {
	case string:
		return strings.TrimSpace(v)
	case map[string]interface{}:
		return extractErrorMessageFromMap(v)
	default:
		// Best-effort stringification, but keep it conservative to avoid noisy reasons.
		return ""
	}
}

func extractErrorMessageFromMap(v map[string]interface{}) string {
	if msg, ok := v["message"].(string); ok && strings.TrimSpace(msg) != "" {
		return strings.TrimSpace(msg)
	}
	if inner, ok := v["error"].(map[string]interface{}); ok {
		if msg, ok := inner["message"].(string); ok && strings.TrimSpace(msg) != "" {
			return strings.TrimSpace(msg)
		}
	}
	return ""
}

func normalizeStatus(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func upstreamQueryHasSignal(up upstreamQueryResp) bool {
	return normalizeStatus(up.Status) != "" ||
		up.Error != nil ||
		up.VideoURL != nil ||
		strings.TrimSpace(up.Message) != ""
}

// parseXAIUpstreamQuery parses query JSON whether fields are at top-level or nested under "data"
// (some upstreams / proxies wrap payloads as {"data":{...}}).
func parseXAIUpstreamQuery(respBody []byte) (upstreamQueryResp, error) {
	var up upstreamQueryResp
	if err := common.Unmarshal(respBody, &up); err != nil {
		return up, err
	}
	if upstreamQueryHasSignal(up) {
		return up, nil
	}
	var wrap struct {
		Data json.RawMessage `json:"data"`
	}
	if err := common.Unmarshal(respBody, &wrap); err != nil {
		return up, nil
	}
	if len(wrap.Data) == 0 || string(wrap.Data) == "null" {
		return up, nil
	}
	var inner upstreamQueryResp
	if err := common.Unmarshal(wrap.Data, &inner); err != nil {
		return up, nil
	}
	if upstreamQueryHasSignal(inner) {
		return inner, nil
	}
	return up, nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	up, err := parseXAIUpstreamQuery(respBody)
	if err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{Code: 0}

	status := normalizeStatus(up.Status)
	reason := strings.TrimSpace(up.Message)
	if reason == "" {
		reason = extractErrorMessage(up.Error)
	}

	switch status {
	case "pending", "queued", "submitted":
		taskResult.Status = model.TaskStatusQueued
	case "processing", "in_progress", "running":
		taskResult.Status = model.TaskStatusInProgress
	case "completed", "success", "succeeded":
		taskResult.Status = model.TaskStatusSuccess
		if up.VideoURL != nil {
			u := strings.TrimSpace(*up.VideoURL)
			if u != "" {
				taskResult.Url = u
			}
		}
	case "failed", "failure", "cancelled", "canceled", "error":
		taskResult.Status = model.TaskStatusFailure
		if reason != "" {
			taskResult.Reason = reason
		} else {
			taskResult.Reason = "task failed"
		}
	default:
		// If upstream returns an error message but omits/changes status,
		// fail fast so the task doesn't get stuck in polling.
		if reason != "" {
			taskResult.Status = model.TaskStatusFailure
			taskResult.Reason = reason
			return &taskResult, nil
		}
		taskResult.Status = model.TaskStatusInProgress
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return nil
}

func (a *TaskAdaptor) GetChannelName() string {
	return "xai"
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	openAIVideo := originTask.ToOpenAIVideo()
	up, err := parseXAIUpstreamQuery(originTask.Data)
	if err == nil && up.VideoURL != nil && strings.TrimSpace(*up.VideoURL) != "" {
		openAIVideo.SetMetadata("url", strings.TrimSpace(*up.VideoURL))
	}
	return common.Marshal(openAIVideo)
}
