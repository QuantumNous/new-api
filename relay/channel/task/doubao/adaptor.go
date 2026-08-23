package doubao

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/samber/lo"
)

// ============================
// Request / Response structures
// ============================

type ContentItem struct {
	Type      string              `json:"type,omitempty"`
	Text      string              `json:"text,omitempty"`
	ImageURL  *MediaURL           `json:"image_url,omitempty"`
	VideoURL  *MediaURL           `json:"video_url,omitempty"`
	AudioURL  *MediaURL           `json:"audio_url,omitempty"`
	DraftTask *DraftTaskReference `json:"draft_task,omitempty"`
	Role      string              `json:"role,omitempty"`
}

type MediaURL struct {
	URL string `json:"url,omitempty"`
}

type DraftTaskReference struct {
	ID string `json:"id"`
}

type requestPayload struct {
	Model                 string         `json:"model"`
	Content               []ContentItem  `json:"content,omitempty"`
	CallbackURL           string         `json:"callback_url,omitempty"`
	OutputFormat          string         `json:"output_format,omitempty"`
	ReturnLastFrame       *dto.BoolValue `json:"return_last_frame,omitempty"`
	ServiceTier           string         `json:"service_tier,omitempty"`
	ExecutionExpiresAfter *dto.IntValue  `json:"execution_expires_after,omitempty"`
	GenerateAudio         *dto.BoolValue `json:"generate_audio,omitempty"`
	Draft                 *dto.BoolValue `json:"draft,omitempty"`
	Tools                 []struct {
		Type string `json:"type,omitempty"`
	} `json:"tools,omitempty"`
	SafetyIdentifier string         `json:"safety_identifier,omitempty"`
	Priority         *dto.IntValue  `json:"priority,omitempty"`
	Resolution       string         `json:"resolution,omitempty"`
	Ratio            string         `json:"ratio,omitempty"`
	Duration         *dto.IntValue  `json:"duration,omitempty"`
	Frames           *dto.IntValue  `json:"frames,omitempty"`
	Seed             *dto.IntValue  `json:"seed,omitempty"`
	CameraFixed      *dto.BoolValue `json:"camera_fixed,omitempty"`
	Watermark        *dto.BoolValue `json:"watermark,omitempty"`
}

type responsePayload struct {
	ID string `json:"id"` // task_id
}

type responseTask struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Status  string `json:"status"`
	Content struct {
		VideoURL     string `json:"video_url"`
		LastFrameURL string `json:"last_frame_url"`
	} `json:"content"`
	Seed            int    `json:"seed"`
	Resolution      string `json:"resolution"`
	Duration        int    `json:"duration"`
	Ratio           string `json:"ratio"`
	FramesPerSecond int    `json:"framespersecond"`
	ServiceTier     string `json:"service_tier"`
	Tools           []struct {
		Type string `json:"type"`
	} `json:"tools"`
	Usage struct {
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
		ToolUsage        struct {
			WebSearch int `json:"web_search"`
		} `json:"tool_usage"`
	} `json:"usage"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
	CreatedAt int64 `json:"created_at"`
	UpdatedAt int64 `json:"updated_at"`
}

// ============================
// Adaptor implementation
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

// ValidateRequestAndSetAction parses body, validates fields and sets default action.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *taskdto.TaskError) {
	// Seedance supports media-only requests and duration=-1 adaptive generation.
	if taskErr = relaycommon.ValidateTaskRequest(c, info, constant.TaskActionGenerate, relaycommon.TaskValidationOptions{
		AllowEmptyPrompt:  true,
		AllowAutoDuration: true,
	}); taskErr != nil {
		return taskErr
	}

	if err := mergeTopLevelFieldsIntoMetadata(c); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	payload, err := a.convertToRequestPayload(&req)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if !hasUsableContent(payload.Content) {
		return service.TaskErrorWrapperLocal(fmt.Errorf("content must contain text, media, or a draft task"), "invalid_request", http.StatusBadRequest)
	}
	return nil
}

var topLevelMetadataFields = []string{
	"content",
	"callback_url",
	"output_format",
	"return_last_frame",
	"service_tier",
	"execution_expires_after",
	"generate_audio",
	"draft",
	"tools",
	"safety_identifier",
	"priority",
	"resolution",
	"ratio",
	"frames",
	"seed",
	"camera_fixed",
	"watermark",
}

// mergeTopLevelFieldsIntoMetadata accepts both the project's generic
// metadata envelope and the top-level request fields used by the Ark API.
func mergeTopLevelFieldsIntoMetadata(c *gin.Context) error {
	if strings.HasPrefix(c.GetHeader("Content-Type"), "multipart/form-data") {
		return nil
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return err
	}
	var rawRequest map[string]interface{}
	if err := common.UnmarshalBodyReusable(c, &rawRequest); err != nil {
		return err
	}
	if req.Metadata == nil {
		req.Metadata = make(map[string]interface{})
	}
	for _, field := range topLevelMetadataFields {
		if value, ok := rawRequest[field]; ok {
			req.Metadata[field] = value
		}
	}
	relaycommon.SetTaskRequest(c, req)
	return nil
}

func hasUsableContent(content []ContentItem) bool {
	for _, item := range content {
		switch item.Type {
		case "text":
			if strings.TrimSpace(item.Text) != "" {
				return true
			}
		case "image_url":
			if item.ImageURL != nil && strings.TrimSpace(item.ImageURL.URL) != "" {
				return true
			}
		case "video_url":
			if item.VideoURL != nil && strings.TrimSpace(item.VideoURL.URL) != "" {
				return true
			}
		case "audio_url":
			if item.AudioURL != nil && strings.TrimSpace(item.AudioURL.URL) != "" {
				return true
			}
		case "draft_task":
			if item.DraftTask != nil && strings.TrimSpace(item.DraftTask.ID) != "" {
				return true
			}
		}
	}
	return false
}

// BuildRequestURL constructs the upstream URL.
func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return strings.TrimRight(a.baseURL, "/") + constant.ArkContentGenerationTasksPath, nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

// EstimateBilling is unused for Seedance: absolute token/超分 quoting lives in
// helper.ApplySeedanceTaskPrice. Other Doubao-compatible models keep the default.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	return nil
}

func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	return service.SettleSeedanceTaskQuota(task, taskResult)
}

// BuildRequestBody converts request into Doubao specific format.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	body, err := a.convertToRequestPayload(&req)
	if err != nil {
		return nil, errors.Wrap(err, "convert request payload failed")
	}
	if info.IsModelMapped {
		body.Model = info.UpstreamModelName
	} else {
		info.UpstreamModelName = body.Model
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

// DoRequest delegates to common helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response, returns taskID etc.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *taskdto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	// Parse Doubao response
	var dResp responsePayload
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if dResp.ID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}
	if strings.HasPrefix(c.Request.URL.Path, constant.ArkContentGenerationTasksPath) {
		c.JSON(http.StatusOK, responsePayload{ID: info.PublicTaskID})
		return dResp.ID, responseBody, nil
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return dResp.ID, responseBody, nil
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s%s/%s", strings.TrimRight(baseUrl, "/"), constant.ArkContentGenerationTasksPath, taskID)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq) (*requestPayload, error) {
	r := requestPayload{
		Model:   req.Model,
		Content: []ContentItem{},
	}

	// Add images if present
	if req.HasImage() {
		for _, imgURL := range req.Images {
			r.Content = append(r.Content, ContentItem{
				Type: "image_url",
				ImageURL: &MediaURL{
					URL: imgURL,
				},
			})
		}
	}

	metadata := req.Metadata
	if err := taskcommon.UnmarshalMetadata(metadata, &r); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}

	if req.Duration != 0 {
		r.Duration = lo.ToPtr(dto.IntValue(req.Duration))
	}
	if req.Seconds != "" {
		if sec, err := strconv.Atoi(req.Seconds); err == nil && sec != 0 {
			r.Duration = lo.ToPtr(dto.IntValue(sec))
		}
	}

	if r.Frames != nil {
		r.Duration = nil
	}
	if strings.TrimSpace(req.Prompt) != "" {
		r.Content = lo.Reject(r.Content, func(c ContentItem, _ int) bool { return c.Type == "text" })
		r.Content = append(r.Content, ContentItem{
			Type: "text",
			Text: req.Prompt,
		})
	}

	return &r, nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	resTask := responseTask{}
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	// Map Doubao status to internal status
	switch resTask.Status {
	case "pending", "queued":
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = "10%"
	case "processing", "running":
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "50%"
	case "succeeded":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = resTask.Content.VideoURL
		// 解析 usage 信息用于按倍率计费
		taskResult.CompletionTokens = resTask.Usage.CompletionTokens
		taskResult.TotalTokens = resTask.Usage.TotalTokens
		if taskResult.TotalTokens <= 0 {
			taskResult.TotalTokens = resTask.Usage.CompletionTokens
		}
		taskResult.DurationSeconds = resTask.Duration
	case "failed", "cancelled", "expired":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = resTask.Error.Message
		if taskResult.Reason == "" && resTask.Status == "cancelled" {
			taskResult.Reason = "task cancelled"
		}
		if taskResult.Reason == "" && resTask.Status == "expired" {
			taskResult.Reason = "task expired"
		}
	default:
		// Unknown status, treat as processing
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var dResp responseTask
	if err := common.Unmarshal(originTask.Data, &dResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal doubao task data failed")
	}

	openAIVideo := dto.NewOpenAIVideo()
	openAIVideo.ID = originTask.TaskID
	openAIVideo.TaskID = originTask.TaskID
	openAIVideo.Status = originTask.Status.ToVideoStatus()
	openAIVideo.SetProgressStr(originTask.Progress)
	openAIVideo.SetMetadata("url", dResp.Content.VideoURL)
	if dResp.Content.LastFrameURL != "" {
		openAIVideo.SetMetadata("last_frame_url", dResp.Content.LastFrameURL)
	}
	openAIVideo.CreatedAt = originTask.CreatedAt
	openAIVideo.CompletedAt = originTask.UpdatedAt
	openAIVideo.Model = originTask.Properties.OriginModelName

	if dResp.Status == "failed" || dResp.Status == "cancelled" || dResp.Status == "expired" {
		message := dResp.Error.Message
		if message == "" && dResp.Status == "cancelled" {
			message = "task cancelled"
		}
		if message == "" && dResp.Status == "expired" {
			message = "task expired"
		}
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: message,
			Code:    dResp.Error.Code,
		}
	}

	return common.Marshal(openAIVideo)
}

func (a *TaskAdaptor) ConvertToArkVideo(originTask *model.Task) ([]byte, error) {
	dResp := make(map[string]any)
	if len(bytes.TrimSpace(originTask.Data)) > 0 {
		if err := common.Unmarshal(originTask.Data, &dResp); err != nil {
			return nil, errors.Wrap(err, "unmarshal doubao task data failed")
		}
	}

	dResp["id"] = originTask.TaskID
	if taskModel, _ := dResp["model"].(string); strings.TrimSpace(taskModel) == "" {
		dResp["model"] = originTask.Properties.OriginModelName
	}
	status, _ := dResp["status"].(string)
	if strings.TrimSpace(status) == "" {
		switch originTask.Status {
		case model.TaskStatusNotStart, model.TaskStatusSubmitted, model.TaskStatusQueued:
			status = "queued"
		case model.TaskStatusInProgress:
			status = "running"
		case model.TaskStatusSuccess:
			status = "succeeded"
		case model.TaskStatusFailure:
			status = "failed"
		default:
			status = "unknown"
		}
		dResp["status"] = status
	}
	if _, ok := dResp["created_at"]; !ok {
		dResp["created_at"] = originTask.CreatedAt
	}
	if _, ok := dResp["updated_at"]; !ok {
		dResp["updated_at"] = originTask.UpdatedAt
	}
	if status == "failed" && strings.TrimSpace(originTask.FailReason) != "" {
		errorPayload, _ := dResp["error"].(map[string]any)
		if errorPayload == nil {
			errorPayload = make(map[string]any)
		}
		if message, _ := errorPayload["message"].(string); strings.TrimSpace(message) == "" {
			errorPayload["message"] = originTask.FailReason
		}
		dResp["error"] = errorPayload
	}

	return common.Marshal(dResp)
}
