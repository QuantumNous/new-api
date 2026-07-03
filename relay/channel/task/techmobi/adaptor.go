package techmobi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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

const generationTasksPath = "/v1/generation/tasks"

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = strings.TrimRight(info.ChannelBaseUrl, "/")
	if a.baseURL == "" {
		a.baseURL = constant.ChannelBaseURLs[constant.ChannelTypeTechMobiVideo]
	}
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) GetModelList() []string { return ModelList }
func (a *TaskAdaptor) GetChannelName() string { return ChannelName }

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	req, err := taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(req.Model) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("model field is required"), "missing_model", http.StatusBadRequest)
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return strings.TrimRight(a.baseURL, "/") + generationTasksPath, nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	var payload dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &payload); err != nil {
		return nil, err
	}
	if info.IsModelMapped {
		payload.Model = info.UpstreamModelName
	} else {
		info.UpstreamModelName = payload.Model
	}
	data, err := common.MarshalNoHTMLEscape(payload)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

type submitResponse struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Error   any    `json:"error,omitempty"`
	Message string `json:"message,omitempty"`
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
		taskErr = service.TaskErrorWrapper(errors.Wrap(err, "submit response was invalid"), "unmarshal_response_body_failed", http.StatusBadGateway)
		return
	}
	if normalizeTaskStatus(upstream.Status) == "failure" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("%s", submitFailReason(upstream)), "upstream_error", http.StatusBadGateway)
		return
	}
	if strings.TrimSpace(upstream.ID) == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("async submit response missing id"), "invalid_response", http.StatusBadGateway)
		return
	}

	if isGenerationTasksRequest(c) {
		c.JSON(http.StatusOK, gin.H{
			"id":     info.PublicTaskID,
			"status": "processing",
		})
		return strings.TrimSpace(upstream.ID), responseBody, nil
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)
	return strings.TrimSpace(upstream.ID), responseBody, nil
}

func isGenerationTasksRequest(c *gin.Context) bool {
	return c != nil && c.Request != nil && c.Request.URL != nil &&
		strings.HasPrefix(c.Request.URL.Path, generationTasksPath)
}

func (a *TaskAdaptor) FetchTask(baseURL string, key string, body map[string]any, proxy string) (*http.Response, error) {
	upstreamTaskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(upstreamTaskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if base == "" {
		base = strings.TrimRight(a.baseURL, "/")
	}
	taskURL := fmt.Sprintf("%s%s/%s", base, generationTasksPath, url.PathEscape(strings.TrimSpace(upstreamTaskID)))
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
	return client.Do(req)
}

type pollResponse struct {
	ID       string               `json:"id"`
	Status   string               `json:"status"`
	Content  pollContent          `json:"content,omitempty"`
	Error    any                  `json:"error,omitempty"`
	Message  string               `json:"message,omitempty"`
	Usage    dto.OpenAIVideoUsage `json:"usage,omitempty"`
	Progress string               `json:"progress,omitempty"`
}

type pollContent []contentItem

type contentItem struct {
	Type     string          `json:"type"`
	VideoURL *videoURLObject `json:"video_url,omitempty"`
}

type videoURLObject struct {
	URL string `json:"url,omitempty"`
}

func (c *pollContent) UnmarshalJSON(data []byte) error {
	if len(bytes.TrimSpace(data)) == 0 || string(bytes.TrimSpace(data)) == "null" {
		*c = nil
		return nil
	}

	var items []contentItem
	if err := json.Unmarshal(data, &items); err == nil {
		*c = items
		return nil
	}

	var obj map[string]json.RawMessage
	if err := json.Unmarshal(data, &obj); err != nil {
		return err
	}

	var out []contentItem
	item := contentItem{Type: "video_url"}
	if raw, ok := obj["type"]; ok {
		_ = json.Unmarshal(raw, &item.Type)
	}
	if raw, ok := obj["video_url"]; ok && string(bytes.TrimSpace(raw)) != "null" {
		var videoURL videoURLObject
		if err := json.Unmarshal(raw, &videoURL); err != nil {
			return err
		}
		item.VideoURL = &videoURL
		out = append(out, item)
	}
	*c = out
	return nil
}

func (v *videoURLObject) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || string(trimmed) == "null" {
		return nil
	}
	var url string
	if err := json.Unmarshal(trimmed, &url); err == nil {
		v.URL = url
		return nil
	}
	type alias videoURLObject
	var obj alias
	if err := json.Unmarshal(trimmed, &obj); err != nil {
		return err
	}
	v.URL = obj.URL
	return nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var pr pollResponse
	if err := common.Unmarshal(respBody, &pr); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}
	info := &relaycommon.TaskInfo{Code: 0, TaskID: strings.TrimSpace(pr.ID)}
	if strings.TrimSpace(pr.Progress) != "" {
		info.Progress = strings.TrimSpace(pr.Progress)
	}

	switch normalizeTaskStatus(pr.Status) {
	case "success":
		videoURL := firstVideoURL(pr)
		if videoURL == "" {
			info.Status = model.TaskStatusFailure
			info.Progress = defaultProgress(info.Progress, taskcommon.ProgressComplete)
			info.Reason = "generation completed without result url"
			return info, nil
		}
		info.Status = model.TaskStatusSuccess
		info.Progress = defaultProgress(info.Progress, taskcommon.ProgressComplete)
		info.Url = videoURL
		info.CompletionTokens = pr.Usage.CompletionTokens
		info.TotalTokens = usageTotalTokens(pr.Usage)
	case "failure":
		info.Status = model.TaskStatusFailure
		info.Progress = defaultProgress(info.Progress, taskcommon.ProgressComplete)
		info.Reason = failReason(pr)
	case "queued":
		info.Status = model.TaskStatusQueued
		info.Progress = defaultProgress(info.Progress, taskcommon.ProgressQueued)
	case "in_progress":
		info.Status = model.TaskStatusInProgress
		info.Progress = defaultProgress(info.Progress, taskcommon.ProgressInProgress)
	default:
		if videoURL := firstVideoURL(pr); videoURL != "" {
			info.Status = model.TaskStatusSuccess
			info.Progress = defaultProgress(info.Progress, taskcommon.ProgressComplete)
			info.Url = videoURL
			info.CompletionTokens = pr.Usage.CompletionTokens
			info.TotalTokens = usageTotalTokens(pr.Usage)
			break
		}
		if pr.Error != nil || strings.TrimSpace(pr.Message) != "" {
			info.Status = model.TaskStatusFailure
			info.Progress = defaultProgress(info.Progress, taskcommon.ProgressComplete)
			info.Reason = failReason(pr)
			break
		}
		info.Status = model.TaskStatusInProgress
		info.Progress = defaultProgress(info.Progress, taskcommon.ProgressInProgress)
	}
	return info, nil
}

func defaultProgress(value, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}

func usageTotalTokens(usage dto.OpenAIVideoUsage) int {
	if usage.TotalTokens > 0 {
		return usage.TotalTokens
	}
	return usage.CompletionTokens
}

func firstVideoURL(pr pollResponse) string {
	for _, item := range pr.Content {
		if item.VideoURL == nil {
			continue
		}
		if item.Type != "" && item.Type != "video_url" {
			continue
		}
		if url := strings.TrimSpace(item.VideoURL.URL); url != "" {
			return url
		}
	}
	return ""
}

func normalizeTaskStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "succeeded", "success", "completed", strings.ToLower(string(model.TaskStatusSuccess)):
		return "success"
	case "failed", "failure", strings.ToLower(string(model.TaskStatusFailure)):
		return "failure"
	case "queued", "pending", strings.ToLower(string(model.TaskStatusQueued)):
		return "queued"
	case "processing", "running", "in_progress", strings.ToLower(string(model.TaskStatusInProgress)):
		return "in_progress"
	default:
		return ""
	}
}

func submitFailReason(resp submitResponse) string {
	reason := upstreamErrorMessage(resp.Message, resp.Error)
	if reason == "" {
		return "upstream task submit failed"
	}
	return taskcommon.ScrubBrandedText(reason)
}

func failReason(resp pollResponse) string {
	reason := upstreamErrorMessage(resp.Message, resp.Error)
	if reason == "" {
		return "video generation failed"
	}
	return taskcommon.ScrubBrandedText(reason)
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
