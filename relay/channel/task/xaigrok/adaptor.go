// Package xaigrok implements the new-api async task adaptor for the xAI Grok
// Imagine video-generation API.
//
// Protocol (submit → poll):
//   - Submit: POST {base}/v1/videos/generations
//     body: {"model":"grok-imagine-video-1.5","prompt":"...","image":{"url":"..."},"duration":6}
//     response (HTTP 200): {"request_id":"<id>"}
//   - Poll:   GET {base}/v1/videos/{request_id}
//     response: {"status":"pending|done|failed|expired","video":{"url":"..."},"usage":{...},"progress":...}
//
// Client-facing inbound format matches Sora (OpenAI-style video submit:
// {model, prompt, image/images/input_reference?, duration/seconds?}). The
// mapping to the upstream Grok wire format happens entirely inside
// BuildRequestBody.
//
// This is a whitelabel channel: the upstream provider identity, host, and the
// real vidgen result URL must never reach customers. Results are served through
// the /v1/videos/{task_id}/content proxy; error text is scrubbed via
// taskcommon.ScrubBrandedText.
package xaigrok

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// Upstream wire-level types
// ============================

// xaiImageInput is the image-to-video reference object the upstream expects.
type xaiImageInput struct {
	URL string `json:"url"`
}

// xaiVideoRequest is the upstream submit body. Optional scalar fields use
// pointers + omitempty (CLAUDE.md Rule 5) so an explicit zero is preserved and
// an absent value is omitted rather than sent as a silent default.
type xaiVideoRequest struct {
	Model    string         `json:"model"`
	Prompt   string         `json:"prompt"`
	Image    *xaiImageInput `json:"image,omitempty"`
	Duration *int           `json:"duration,omitempty"`
}

// xaiUsage mirrors the token usage the upstream reports on completion. Field
// names follow the OpenAI-style convention; unknown fields decode to zero,
// which is harmless (usage is best-effort surfaced, never billed here).
type xaiUsage struct {
	CompletionTokens int `json:"completion_tokens,omitempty"`
	TotalTokens      int `json:"total_tokens,omitempty"`
}

// xaiSubmitResponse is the submit (POST) response body.
type xaiSubmitResponse struct {
	RequestID string `json:"request_id"`
	// Some deployments echo an error object instead of a request_id on failure.
	Error *xaiErrorObject `json:"error,omitempty"`
}

// xaiPollResponse is the poll (GET) response body.
type xaiPollResponse struct {
	RequestID string          `json:"request_id,omitempty"`
	Status    string          `json:"status"`
	Video     *xaiImageInput  `json:"video,omitempty"`
	Model     string          `json:"model,omitempty"`
	Progress  *int            `json:"progress,omitempty"`
	Usage     *xaiUsage       `json:"usage,omitempty"`
	Error     *xaiErrorObject `json:"error,omitempty"`
	// Some deployments surface failure text as a flat string field.
	Message string `json:"message,omitempty"`
}

type xaiErrorObject struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}

func (e *xaiErrorObject) reason() string {
	if e == nil {
		return ""
	}
	return e.Message
}

// ============================
// Adaptor
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

// ValidateRequestAndSetAction parses the inbound OpenAI-style video request
// (same as Sora), then runs Grok-specific value checks. The parsed request is
// stored in the gin context by ValidateMultipartDirect for BuildRequestBody /
// EstimateBilling to reuse.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if taskErr := relaycommon.ValidateMultipartDirect(c, info); taskErr != nil {
		return taskErr
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}

	if !isSupportedModel(req.Model) {
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("unsupported model %q; expected %s or %s", req.Model, ModelGrokImagineVideo, ModelGrokImagineVideo15),
			"invalid_request", http.StatusBadRequest)
	}

	// Fail fast on an out-of-range duration instead of surfacing an upstream error later.
	if d := resolveDuration(req); d != 0 && (d < 0 || d > maxDurationSeconds) {
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("duration %d is invalid; must be between 1 and %d seconds", d, maxDurationSeconds),
			"invalid_request", http.StatusBadRequest)
	}

	// Apply the same fetch/SSRF policy used elsewhere before forwarding a
	// user-supplied image URL to an upstream that will fetch it.
	if imageURL := resolveImageURL(req); imageURL != "" {
		if err := taskcommon.ValidateRemoteMediaURL(imageURL); err != nil {
			return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
		}
	}

	return nil
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + "/v1/videos/generations", nil
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
		return nil, errors.Wrap(err, "get_task_request_failed")
	}

	modelName := info.UpstreamModelName
	if modelName == "" {
		modelName = req.Model
	}

	body := buildXaiVideoRequest(req, modelName)

	// Keep '&' literal in any image URL forwarded upstream (some upstream URL
	// fetchers consume the escaped '&' byte-for-byte instead of decoding).
	data, err := common.MarshalNoHTMLEscape(body)
	if err != nil {
		return nil, err
	}
	if common.DebugEnabled {
		common.SysLog(fmt.Sprintf("[xaigrok] POST %s/v1/videos/generations body=%s", a.baseURL, string(data)))
	}
	return bytes.NewReader(data), nil
}

// buildXaiVideoRequest maps the shared OpenAI-style video request to the Grok
// upstream body. Pure function (no gin/IO) so the mapping is unit-testable.
func buildXaiVideoRequest(req relaycommon.TaskSubmitReq, modelName string) xaiVideoRequest {
	body := xaiVideoRequest{
		Model:  modelName,
		Prompt: req.Prompt,
	}
	if imageURL := resolveImageURL(req); imageURL != "" {
		body.Image = &xaiImageInput{URL: imageURL}
	}
	if d := resolveDuration(req); d > 0 {
		body.Duration = &d
	}
	return body
}

// resolveImageURL picks the image-to-video reference URL from the OpenAI-style
// request, preferring the singular `image`, then the first of `images`, then
// `input_reference` (ValidateMultipartDirect already folds input_reference into
// Images, but we check it directly too for robustness).
func resolveImageURL(req relaycommon.TaskSubmitReq) string {
	if s := strings.TrimSpace(req.Image); s != "" {
		return s
	}
	for _, u := range req.Images {
		if s := strings.TrimSpace(u); s != "" {
			return s
		}
	}
	return strings.TrimSpace(req.InputReference)
}

// resolveDuration reads the requested duration in seconds from either the
// numeric `duration` field or the stringified `seconds` field.
func resolveDuration(req relaycommon.TaskSubmitReq) int {
	if req.Duration != 0 {
		return req.Duration
	}
	if req.Seconds != "" {
		if s, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil {
			return s
		}
	}
	return 0
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	resp, err := channel.DoTaskApiRequest(a, c, info, requestBody)
	if err != nil {
		return nil, err
	}
	// 202-gate: the generic orchestrator rejects any non-200 from DoRequest
	// before DoResponse runs. The upstream submit is documented as 200, but
	// normalize a 202 defensively so DoResponse always receives the body.
	normalizeAcceptedStatus(resp)
	return resp, nil
}

// normalizeAcceptedStatus rewrites a 202 Accepted to 200 OK in place so the
// generic task orchestrator forwards the response to DoResponse.
func normalizeAcceptedStatus(resp *http.Response) {
	if resp != nil && resp.StatusCode == http.StatusAccepted {
		resp.StatusCode = http.StatusOK
	}
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var submitResp xaiSubmitResponse
	if err := common.Unmarshal(responseBody, &submitResp); err != nil {
		taskErr = service.TaskErrorWrapper(
			errors.Wrapf(err, "body: %s", responseBody),
			"unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if submitResp.RequestID == "" {
		// Scrub any upstream-branded error text before surfacing it.
		reason := taskcommon.ScrubBrandedText(submitResp.Error.reason())
		if reason == "" {
			reason = "upstream did not return a request_id"
		}
		taskErr = service.TaskErrorWrapperLocal(
			fmt.Errorf("%s", reason), "invalid_response", http.StatusBadGateway)
		return
	}

	// Return the public task_xxxx ID to the client — never the upstream request_id.
	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return submitResp.RequestID, responseBody, nil
}

// FetchTask polls GET {base}/v1/videos/{request_id}.
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/v1/videos/%s", baseUrl, taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
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

func (a *TaskAdaptor) GetModelList() []string { return ModelList }
func (a *TaskAdaptor) GetChannelName() string { return ChannelName }

// EstimateBilling bills per generated second. The upstream charges per second
// of output, so the model's ModelPrice is treated as a per-second rate and
// multiplied by the requested duration. Without this override a 15s clip would
// be billed as a single flat unit and sold well below cost. Mirrors sora.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, _ *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	seconds := resolveDuration(req)
	if seconds <= 0 {
		seconds = defaultBillingSeconds
	}
	return map[string]float64{"seconds": float64(seconds)}
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var poll xaiPollResponse
	if err := common.Unmarshal(respBody, &poll); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := &relaycommon.TaskInfo{Code: 0}

	switch strings.ToLower(poll.Status) {
	case "done", "completed", "succeeded", "success":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		if poll.Video != nil {
			// Stored in task.Data; the public ResultURL is overridden to the
			// proxy URL for whitelabel channels (see service/task_polling.go).
			taskResult.Url = poll.Video.URL
		}
		if poll.Usage != nil {
			taskResult.CompletionTokens = poll.Usage.CompletionTokens
			taskResult.TotalTokens = poll.Usage.TotalTokens
		}
	case "failed", "expired", "cancelled", "canceled":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		reason := poll.Error.reason()
		if reason == "" {
			reason = poll.Message
		}
		if reason == "" {
			reason = "task failed at upstream provider"
		}
		taskResult.Reason = taskcommon.ScrubBrandedText(reason)
	case "pending", "queued", "in_progress", "processing", "":
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = progressPercent(poll.Progress, "30%")
	default:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = progressPercent(poll.Progress, "30%")
	}

	return taskResult, nil
}

// progressPercent renders an upstream 0-100 progress value as "N%", falling back
// to def when progress is absent or out of the (0,100) range.
func progressPercent(progress *int, def string) string {
	if progress != nil && *progress > 0 && *progress < 100 {
		return fmt.Sprintf("%d%%", *progress)
	}
	return def
}

// ExtractUpstreamVideoURL parses the persisted poll body in task.Data and
// returns the real upstream video URL. Used server-side by controller.VideoProxy
// to fetch the MP4 without ever exposing the upstream host to the customer.
func ExtractUpstreamVideoURL(taskData []byte) string {
	if len(taskData) == 0 {
		return ""
	}
	var poll xaiPollResponse
	if err := common.Unmarshal(taskData, &poll); err != nil {
		return ""
	}
	if poll.Video != nil {
		return poll.Video.URL
	}
	return ""
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

	// Use the whitelabeled proxy URL stored at success time — never the real
	// upstream vidgen URL. Token usage is injected generically from
	// task.PrivateData by the relay OpenAI-video fetch path.
	if originTask.Status == model.TaskStatusSuccess {
		ov.SetMetadata("url", originTask.GetResultURL())
	}
	if originTask.Status == model.TaskStatusFailure {
		ov.Error = &dto.OpenAIVideoError{
			Message: taskcommon.ScrubBrandedText(originTask.FailReason),
		}
	}

	return common.Marshal(ov)
}
