package jimengzhizinan

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
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

const maxInputImages = 2
const videoTasksPath = "/v1/videos"

type generationPayload struct {
	Model      string   `json:"model"`
	Prompt     string   `json:"prompt"`
	Ratio      string   `json:"ratio,omitempty"`
	Resolution string   `json:"resolution,omitempty"`
	Duration   int      `json:"duration,omitempty"`
	FilePaths  []string `json:"file_paths,omitempty"`
}

type videoDataItem struct {
	URL         string `json:"url"`
	VideoURL    string `json:"video_url,omitempty"`
	DownloadURL string `json:"download_url,omitempty"`
}

type submitResponse struct {
	ID       string `json:"id"`
	TaskID   string `json:"task_id"`
	SubmitID string `json:"submit_id"`
	Status   string `json:"status"`
	Error    any    `json:"error,omitempty"`
	Message  string `json:"message,omitempty"`
}

type pollResponse struct {
	ID       string               `json:"id"`
	TaskID   string               `json:"task_id"`
	Status   string               `json:"status"`
	Progress string               `json:"progress,omitempty"`
	URL      string               `json:"url,omitempty"`
	Data     []videoDataItem      `json:"data"`
	Error    any                  `json:"error,omitempty"`
	Message  string               `json:"message,omitempty"`
	Usage    dto.OpenAIVideoUsage `json:"usage,omitempty"`
}

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

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	seedReq, err := taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	images, err := validateSeedanceInput(seedReq)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	relaycommon.StoreTaskRequest(c, info, constant.TaskActionGenerate, taskSubmitReqFromSeedance(seedReq, images))
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s%s", strings.TrimRight(a.baseURL, "/"), videoTasksPath), nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	var seedReq dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &seedReq); err != nil {
		return nil, err
	}
	images, err := validateSeedanceInput(&seedReq)
	if err != nil {
		return nil, err
	}
	body := buildGenerationPayload(&seedReq, images)
	if info.IsModelMapped {
		body.Model = info.UpstreamModelName
	} else {
		info.UpstreamModelName = body.Model
	}
	data, err := common.MarshalNoHTMLEscape(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func buildGenerationPayload(req *dto.SeedanceVideoRequest, images []string) *generationPayload {
	p := &generationPayload{
		Model:      req.Model,
		Prompt:     req.PromptText(),
		Ratio:      req.Ratio,
		Resolution: req.Resolution,
	}
	if req.Duration != nil && *req.Duration > 0 {
		p.Duration = *req.Duration
	}
	if len(images) > 0 {
		p.FilePaths = images
	}
	return p
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	resp, err := channel.DoTaskApiRequest(a, c, info, requestBody)
	normalizeAcceptedStatus(resp)
	return resp, err
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var upstream submitResponse
	if err := common.Unmarshal(responseBody, &upstream); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrap(err, "jimeng zhizinan submit response was invalid"), "unmarshal_response_body_failed", http.StatusBadGateway)
		return
	}

	if isFailureStatus(upstream.Status) {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("jimeng zhizinan submit failed: %s", submitFailReason(upstream)), "upstream_error", http.StatusBadGateway)
		return
	}
	upstreamTaskID := firstNonEmpty(upstream.ID, upstream.TaskID, upstream.SubmitID)
	if upstreamTaskID == "" {
		taskErr = service.TaskErrorWrapper(
			fmt.Errorf("jimeng zhizinan async submit response missing id; upstream must return {id,status}"),
			"invalid_response", http.StatusBadGateway)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)
	return upstreamTaskID, responseBody, nil
}

func normalizeAcceptedStatus(resp *http.Response) {
	if resp != nil && resp.StatusCode == http.StatusAccepted {
		resp.StatusCode = http.StatusOK
	}
}

func (a *TaskAdaptor) FetchTask(baseURL string, key string, body map[string]any, proxy string) (*http.Response, error) {
	upstreamTaskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(upstreamTaskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	if isAbsoluteURL(upstreamTaskID) {
		return nil, fmt.Errorf("absolute task_id url is not allowed")
	}
	taskURL := a.taskStatusURL(baseURL, upstreamTaskID)
	req, err := http.NewRequest(http.MethodGet, taskURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	normalizeAcceptedStatus(resp)
	return resp, err
}

func (a *TaskAdaptor) taskStatusURL(baseURL string, upstreamTaskID string) string {
	taskID := strings.TrimSpace(upstreamTaskID)
	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if base == "" {
		base = strings.TrimRight(a.baseURL, "/")
	}
	return fmt.Sprintf("%s%s/%s", base, videoTasksPath, url.PathEscape(taskID))
}

func isAbsoluteURL(value string) bool {
	parsed, err := url.Parse(strings.TrimSpace(value))
	return err == nil && parsed.Scheme != "" && parsed.Host != ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func submitFailReason(resp submitResponse) string {
	reason := upstreamErrorMessage(resp.Message, resp.Error)
	if reason == "" {
		return "upstream task submit failed"
	}
	return reason
}

func upstreamErrorMessage(message string, errValue any) string {
	if strings.TrimSpace(message) != "" {
		return strings.TrimSpace(message)
	}
	switch v := errValue.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(v)
	case map[string]any:
		if msg := common.Interface2String(v["message"]); strings.TrimSpace(msg) != "" {
			return strings.TrimSpace(msg)
		}
		if code := common.Interface2String(v["code"]); strings.TrimSpace(code) != "" {
			return strings.TrimSpace(code)
		}
	}
	raw, err := common.Marshal(errValue)
	if err != nil {
		return common.Interface2String(errValue)
	}
	return string(raw)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var pr pollResponse
	if err := common.Unmarshal(respBody, &pr); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}
	info := &relaycommon.TaskInfo{Code: 0}
	info.TaskID = firstNonEmpty(pr.ID, pr.TaskID)
	if strings.TrimSpace(pr.Progress) != "" {
		info.Progress = strings.TrimSpace(pr.Progress)
	}
	switch normalizeTaskStatus(pr.Status) {
	case "success":
		videoURL := firstVideoURL(pr)
		if videoURL == "" {
			info.Status = model.TaskStatusFailure
			info.Progress = taskcommon.ProgressComplete
			info.Reason = "jimeng zhizinan generation completed without result url"
			break
		}
		info.Status = model.TaskStatusSuccess
		if info.Progress == "" {
			info.Progress = taskcommon.ProgressComplete
		}
		info.Url = videoURL
		info.CompletionTokens = pr.Usage.CompletionTokens
		info.TotalTokens = pr.Usage.TotalTokens
	case "failure":
		info.Status = model.TaskStatusFailure
		if info.Progress == "" {
			info.Progress = taskcommon.ProgressComplete
		}
		info.Reason = failReason(pr)
	case "queued":
		info.Status = model.TaskStatusQueued
		if info.Progress == "" {
			info.Progress = taskcommon.ProgressQueued
		}
	case "submitted":
		info.Status = model.TaskStatusSubmitted
		if info.Progress == "" {
			info.Progress = taskcommon.ProgressSubmitted
		}
	case "in_progress":
		info.Status = model.TaskStatusInProgress
		if info.Progress == "" {
			info.Progress = taskcommon.ProgressInProgress
		}
	default:
		if url := firstVideoURL(pr); url != "" {
			info.Status = model.TaskStatusSuccess
			if info.Progress == "" {
				info.Progress = taskcommon.ProgressComplete
			}
			info.Url = url
			info.CompletionTokens = pr.Usage.CompletionTokens
			info.TotalTokens = pr.Usage.TotalTokens
			break
		}
		if pr.Error != nil || strings.TrimSpace(pr.Message) != "" {
			info.Status = model.TaskStatusFailure
			if info.Progress == "" {
				info.Progress = taskcommon.ProgressComplete
			}
			info.Reason = failReason(pr)
			break
		}
		info.Status = model.TaskStatusInProgress
		if info.Progress == "" {
			info.Progress = taskcommon.ProgressInProgress
		}
	}
	return info, nil
}

func firstVideoURL(pr pollResponse) string {
	if strings.TrimSpace(pr.URL) != "" {
		return strings.TrimSpace(pr.URL)
	}
	return firstURL(pr.Data)
}

func firstURL(items []videoDataItem) string {
	if len(items) == 0 {
		return ""
	}
	for _, item := range items {
		for _, candidate := range []string{item.URL, item.VideoURL, item.DownloadURL} {
			if strings.TrimSpace(candidate) != "" {
				return strings.TrimSpace(candidate)
			}
		}
	}
	return ""
}

func normalizeTaskStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case strings.ToLower(string(model.TaskStatusSuccess)), "completed", "succeeded", "success":
		return "success"
	case strings.ToLower(string(model.TaskStatusFailure)), "failed", "failure":
		return "failure"
	case strings.ToLower(string(model.TaskStatusQueued)), "queued", "pending":
		return "queued"
	case strings.ToLower(string(model.TaskStatusSubmitted)), "submitted":
		return "submitted"
	case strings.ToLower(string(model.TaskStatusInProgress)), "processing", "running", "in_progress":
		return "in_progress"
	default:
		return ""
	}
}

func isFailureStatus(status string) bool {
	return normalizeTaskStatus(status) == "failure"
}

func failReason(pr pollResponse) string {
	if reason := upstreamErrorMessage(pr.Message, pr.Error); reason != "" {
		return reason
	}
	return "jimeng zhizinan video generation failed"
}

// ExtractUpstreamVideoURL resolves the real video URL persisted in task.Data.
// Customer-facing URLs for this channel point at /v1/videos/{task_id}/content.
func ExtractUpstreamVideoURL(taskData []byte) string {
	if len(taskData) == 0 {
		return ""
	}
	var pr pollResponse
	if err := common.Unmarshal(taskData, &pr); err != nil {
		return ""
	}
	return firstVideoURL(pr)
}

func taskSubmitReqFromSeedance(req *dto.SeedanceVideoRequest, images []string) relaycommon.TaskSubmitReq {
	taskReq := relaycommon.TaskSubmitReq{
		Model:      req.Model,
		Prompt:     req.PromptText(),
		Resolution: req.Resolution,
		Ratio:      req.Ratio,
	}
	if req.Duration != nil && *req.Duration > 0 {
		taskReq.Duration = *req.Duration
	}
	taskReq.Images = slices.Clone(images)
	return taskReq
}

func validateSeedanceInput(req *dto.SeedanceVideoRequest) ([]string, error) {
	if len(req.Videos()) > 0 {
		return nil, fmt.Errorf("jimeng zhizinan does not support video_url content")
	}
	if len(req.Audios()) > 0 {
		return nil, fmt.Errorf("jimeng zhizinan does not support audio_url content")
	}
	images := req.Images()
	if len(images) > maxInputImages {
		return nil, fmt.Errorf("jimeng zhizinan supports at most %d input images", maxInputImages)
	}
	normalized := make([]string, 0, len(images))
	for _, image := range images {
		trimmed := strings.TrimSpace(image.URL)
		if trimmed == "" {
			return nil, fmt.Errorf("image url must not be empty")
		}
		if err := validateImageURL(trimmed); err != nil {
			return nil, err
		}
		normalized = append(normalized, trimmed)
	}
	return normalized, nil
}

func validateImageURL(raw string) error {
	return taskcommon.ValidateRemoteMediaURL(raw)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
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
		ov.Error = &dto.OpenAIVideoError{
			Message: taskcommon.ScrubBrandedText(originTask.FailReason),
		}
	}
	return common.Marshal(ov)
}
