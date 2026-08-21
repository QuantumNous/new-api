package groksubscription

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	grokmedia "github.com/QuantumNous/new-api/relay/channel/groksubscription"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

const (
	channelName         = "grok_subscription_video"
	sanitizedSubmitData = `{}`
)

var apiBase = "https://api.x.ai"

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType   int
	secondBilling taskcommon.SecondBillingState
}

type mediaCredentialFunc func(c *gin.Context, info *relaycommon.RelayInfo) (string, error)

var getMediaCredentialForRequest mediaCredentialFunc = func(c *gin.Context, info *relaycommon.RelayInfo) (string, error) {
	ctx := context.Background()
	if c != nil && c.Request != nil {
		ctx = c.Request.Context()
	}
	credential, err := grokmedia.EnsureMediaCredential(ctx, info.ChannelId, true)
	if err != nil {
		return "", err
	}
	return credential.AccessToken, nil
}

var ensurePollingCredential = grokmedia.EnsureMediaCredential
var forceRefreshPollingCredential = grokmedia.ForceRefreshMediaCredential

func setMediaCredentialForTest(fn mediaCredentialFunc) func() {
	original := getMediaCredentialForRequest
	getMediaCredentialForRequest = fn
	return func() { getMediaCredentialForRequest = original }
}

func setPollingCredentialForTest(ensure func(context.Context, int, bool) (grokmedia.MediaCredential, error), refresh func(context.Context, int) (grokmedia.MediaCredential, error)) func() {
	originalEnsure := ensurePollingCredential
	originalRefresh := forceRefreshPollingCredential
	if ensure != nil {
		ensurePollingCredential = ensure
	}
	if refresh != nil {
		forceRefreshPollingCredential = refresh
	}
	return func() {
		ensurePollingCredential = originalEnsure
		forceRefreshPollingCredential = originalRefresh
	}
}

func setAPIBaseForTest(base string) func() {
	original := apiBase
	apiBase = strings.TrimRight(base, "/")
	return func() { apiBase = original }
}

type submitResponse struct {
	RequestID string       `json:"request_id"`
	Error     *errorObject `json:"error,omitempty"`
}

type pollResponse struct {
	RequestID string       `json:"request_id,omitempty"`
	Status    string       `json:"status"`
	Video     *videoObject `json:"video,omitempty"`
	Progress  *int         `json:"progress,omitempty"`
	Usage     *usageObject `json:"usage,omitempty"`
	Error     *errorObject `json:"error,omitempty"`
	Message   string       `json:"message,omitempty"`
}

type videoObject struct {
	URL        string  `json:"url,omitempty"`
	Duration   float64 `json:"duration,omitempty"`
	Resolution string  `json:"resolution,omitempty"`
}

type usageObject struct {
	CompletionTokens int   `json:"completion_tokens,omitempty"`
	TotalTokens      int   `json:"total_tokens,omitempty"`
	CostInUSDTicks   int64 `json:"cost_in_usd_ticks,omitempty"`
}

type errorObject struct {
	Message string `json:"message,omitempty"`
	Code    string `json:"code,omitempty"`
}

func (e *errorObject) reason() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	if info != nil {
		a.ChannelType = info.ChannelType
	}
}

func (a *TaskAdaptor) GetModelList() []string {
	return []string{ModelGrokImagineVideo, ModelGrokImagineVideo15}
}

func (a *TaskAdaptor) GetChannelName() string { return channelName }

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	req, err := validateVideoRequest(c, info)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if info.TaskRelayInfo == nil {
		info.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	}
	info.Action = req.Action
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	action := ""
	if info != nil && info.TaskRelayInfo != nil {
		action = info.Action
	}
	path, ok := actionPath(action)
	if !ok {
		return "", fmt.Errorf("unsupported action %q", action)
	}
	return apiBase + path, nil
}

func actionPath(action string) (string, bool) {
	switch action {
	case actionGenerate:
		return "/v1/videos/generations", true
	case actionEdit:
		return "/v1/videos/edits", true
	case actionExtend:
		return "/v1/videos/extensions", true
	default:
		return "", false
	}
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	token, err := getMediaCredentialForRequest(c, info)
	if err != nil {
		return err
	}
	req.Header = http.Header{}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := getVideoRequest(c)
	if err != nil {
		return nil, err
	}
	body := buildUpstreamVideoRequest(req)
	if info != nil && strings.TrimSpace(info.UpstreamModelName) != "" {
		body.Model = strings.TrimSpace(info.UpstreamModelName)
	}
	data, err := common.MarshalNoHTMLEscape(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	resp, err := channel.DoTaskApiRequest(a, c, info, requestBody)
	if err != nil {
		return nil, err
	}
	normalizeAcceptedStatus(resp)
	return resp, nil
}

func normalizeAcceptedStatus(resp *http.Response) {
	if resp != nil && resp.StatusCode == http.StatusAccepted {
		resp.StatusCode = http.StatusOK
	}
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	if resp == nil || resp.Body == nil {
		return "", nil, service.TaskErrorWrapperLocal(fmt.Errorf("upstream task submit failed"), "read_response_body_failed", http.StatusInternalServerError)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}

	var sub submitResponse
	if err := common.Unmarshal(responseBody, &sub); err != nil {
		return "", nil, service.TaskErrorWrapperLocal(
			fmt.Errorf("upstream task submit failed"),
			"invalid_response", http.StatusBadGateway)
	}
	if strings.TrimSpace(sub.RequestID) == "" {
		return "", nil, service.TaskErrorWrapperLocal(
			fmt.Errorf("%s", sanitizedSubmitError(sub.Error.reason())),
			"invalid_response", http.StatusBadGateway)
	}
	writeClientEnvelope(c, info)
	return sub.RequestID, []byte(sanitizedSubmitData), nil
}

func sanitizedSubmitError(reason string) string {
	scrubbed := taskcommon.ScrubBrandedText(reason)
	if scrubbed == "" || taskcommon.ContainsBrandKeyword(scrubbed) || strings.Contains(strings.ToLower(scrubbed), "token") || strings.Contains(scrubbed, "http") {
		return "upstream task submit failed"
	}
	return scrubbed
}

func writeClientEnvelope(c *gin.Context, info *relaycommon.RelayInfo) {
	ov := dto.NewOpenAIVideo()
	if info != nil && info.TaskRelayInfo != nil {
		ov.ID = info.PublicTaskID
		ov.TaskID = info.PublicTaskID
	}
	if info != nil {
		ov.Model = info.OriginModelName
	}
	ov.CreatedAt = time.Now().Unix()
	c.JSON(http.StatusOK, ov)
}

func (a *TaskAdaptor) FetchTask(baseURL string, key string, body map[string]any, proxy string) (*http.Response, error) {
	return a.FetchTaskWithContext(context.Background(), baseURL, key, body, proxy)
}

func (a *TaskAdaptor) FetchTaskWithContext(ctx context.Context, _ string, _ string, body map[string]any, proxy string) (*http.Response, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	taskID, _ := body["task_id"].(string)
	if strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	channelID, _ := intFromAny(body["channel_id"])
	if channelID <= 0 {
		return nil, fmt.Errorf("invalid channel_id")
	}
	credential, err := ensurePollingCredential(ctx, channelID, false)
	if err != nil {
		return nil, err
	}
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	resp, err := fetchTaskWithCredential(ctx, client, taskID, credential.AccessToken)
	if err != nil {
		return nil, err
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		return resp, nil
	}
	_ = resp.Body.Close()
	credential, err = forceRefreshPollingCredential(ctx, channelID)
	if err != nil {
		return nil, err
	}
	return fetchTaskWithCredential(ctx, client, taskID, credential.AccessToken)
}

func fetchTaskWithCredential(ctx context.Context, client *http.Client, taskID string, accessToken string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiBase+"/v1/videos/"+url.PathEscape(strings.TrimSpace(taskID)), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)
	return client.Do(req)
}

func intFromAny(v any) (int, bool) {
	switch t := v.(type) {
	case int:
		return t, true
	case int64:
		return int(t), true
	case float64:
		return int(t), true
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(t))
		return n, err == nil
	default:
		return 0, false
	}
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var poll pollResponse
	if err := common.Unmarshal(respBody, &poll); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}
	info := &relaycommon.TaskInfo{Code: 0}
	switch strings.ToLower(strings.TrimSpace(poll.Status)) {
	case "pending":
		info.Status = string(model.TaskStatusQueued)
		info.Progress = taskcommon.ProgressQueued
	case "done":
		if poll.Video == nil || strings.TrimSpace(poll.Video.URL) == "" {
			return nil, fmt.Errorf("completed task response did not include a video url")
		}
		info.TaskID = strings.TrimSpace(poll.RequestID)
		info.Status = string(model.TaskStatusSuccess)
		info.Progress = taskcommon.ProgressComplete
		info.Url = poll.Video.URL
		info.Duration = poll.Video.Duration
		info.Resolution = poll.Video.Resolution
		if poll.Usage != nil {
			info.CompletionTokens = poll.Usage.CompletionTokens
			info.TotalTokens = poll.Usage.TotalTokens
		}
	case "failed", "expired":
		info.Status = string(model.TaskStatusFailure)
		info.Progress = taskcommon.ProgressComplete
		reason := poll.Error.reason()
		if reason == "" {
			reason = poll.Message
		}
		if reason == "" {
			reason = "task failed at upstream provider"
		}
		info.Reason = taskcommon.ScrubBrandedText(reason)
	default:
		return nil, fmt.Errorf("unknown grok subscription video task status %q", poll.Status)
	}
	return info, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	ov := dto.NewOpenAIVideo()
	ov.ID = originTask.TaskID
	ov.TaskID = originTask.TaskID
	ov.Status = originTask.Status.ToVideoStatus()
	ov.SetProgressStr(originTask.Progress)
	ov.CreatedAt = originTask.CreatedAt
	ov.CompletedAt = originTask.UpdatedAt
	ov.Model = originTask.Properties.OriginModelName
	if originTask.Status == model.TaskStatusSuccess {
		ov.SetMetadata("url", originTask.GetResultURL())
	}
	if originTask.Status == model.TaskStatusFailure {
		ov.Error = &dto.OpenAIVideoError{Message: taskcommon.ScrubBrandedText(originTask.FailReason)}
	}
	ov.Usage = originTask.PrivateData.UsageDTO()
	return common.Marshal(ov)
}

var _ = billing_setting.BasisOutputDuration
