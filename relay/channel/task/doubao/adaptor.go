package doubao

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/samber/lo"
)

// ============================
// Request / Response structures
// ============================

type ContentItem struct {
	Type      string     `json:"type,omitempty"`
	Text      string     `json:"text,omitempty"`
	ImageURL  *MediaURL  `json:"image_url,omitempty"`
	VideoURL  *MediaURL  `json:"video_url,omitempty"`
	AudioURL  *MediaURL  `json:"audio_url,omitempty"`
	DraftTask *DraftTask `json:"draft_task,omitempty"`
	Role      string     `json:"role,omitempty"`
}

type MediaURL struct {
	URL string `json:"url,omitempty"`
}

type DraftTask struct {
	ID string `json:"id,omitempty"`
}

type requestPayload struct {
	Model                 string         `json:"model"`
	Content               []ContentItem  `json:"content,omitempty"`
	CallbackURL           string         `json:"callback_url,omitempty"`
	ReturnLastFrame       *dto.BoolValue `json:"return_last_frame,omitempty"`
	ServiceTier           string         `json:"service_tier,omitempty"`
	ExecutionExpiresAfter *dto.IntValue  `json:"execution_expires_after,omitempty"`
	GenerateAudio         *dto.BoolValue `json:"generate_audio,omitempty"`
	Draft                 *dto.BoolValue `json:"draft,omitempty"`
	Tools                 []struct {
		Type string `json:"type,omitempty"`
	} `json:"tools,omitempty"`
	Resolution  string         `json:"resolution,omitempty"`
	Ratio       string         `json:"ratio,omitempty"`
	Duration    *dto.IntValue  `json:"duration,omitempty"`
	Frames      *dto.IntValue  `json:"frames,omitempty"`
	Seed        *dto.IntValue  `json:"seed,omitempty"`
	CameraFixed *dto.BoolValue `json:"camera_fixed,omitempty"`
	Watermark   *dto.BoolValue `json:"watermark,omitempty"`
}

type responsePayload struct {
	ID string `json:"id"` // task_id
}

type responseTask struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Status  string `json:"status"`
	Content struct {
		VideoURL string `json:"video_url"`
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
//
// When info.RelayFormat is RelayFormatVolc the body is a native Volc Ark request.
// We parse it minimally (just to detect model and content[]) without touching it,
// then set the action based on whether content[] contains an image_url item.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	if info.RelayFormat == types.RelayFormatVolc {
		return a.validateVolcNativeTaskRequest(c, info)
	}
	// Accept only POST /v1/video/generations as "generate" action.
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

// validateVolcNativeTaskRequest parses a Volc-native task submit body minimally.
// It detects the model name and whether content[] has image/video inputs to set action.
func (a *TaskAdaptor) validateVolcNativeTaskRequest(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	var body map[string]json.RawMessage
	if err := common.UnmarshalBodyReusable(c, &body); err != nil {
		return &dto.TaskError{
			Code:       "invalid_request",
			Message:    "invalid request body: " + err.Error(),
			StatusCode: http.StatusBadRequest,
			LocalError: true,
		}
	}

	// Extract model name
	if modelRaw, ok := body["model"]; ok {
		var modelName string
		if err := json.Unmarshal(modelRaw, &modelName); err == nil && modelName != "" {
			info.OriginModelName = modelName
		}
	}
	if info.OriginModelName == "" {
		return &dto.TaskError{
			Code:       "invalid_request",
			Message:    "model is required",
			StatusCode: http.StatusBadRequest,
			LocalError: true,
		}
	}

	// Determine action: if content[] has image_url or video_url items → Generate, else TextGenerate
	action := constant.TaskActionTextGenerate
	if contentRaw, ok := body["content"]; ok {
		if hasImageOrVideoInVolcContent(contentRaw) {
			action = constant.TaskActionGenerate
		}
	}
	// Ensure TaskRelayInfo is initialized before setting Action.
	if info.TaskRelayInfo == nil {
		info.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	}
	info.Action = action
	return nil
}

// hasImageOrVideoInVolcContent checks whether the Volc content[] JSON array contains
// any item with type "image_url" or "video_url".
func hasImageOrVideoInVolcContent(contentRaw json.RawMessage) bool {
	var items []map[string]json.RawMessage
	if err := json.Unmarshal(contentRaw, &items); err != nil {
		return false
	}
	for _, item := range items {
		typeRaw, ok := item["type"]
		if !ok {
			continue
		}
		var typeStr string
		if err := json.Unmarshal(typeRaw, &typeStr); err != nil {
			continue
		}
		if typeStr == "image_url" || typeStr == "video_url" {
			return true
		}
	}
	return false
}

// BuildRequestURL constructs the upstream URL.
func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/api/v3/contents/generations/tasks", a.baseURL), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

// EstimateBilling 检测请求 metadata 中是否包含视频输入，返回视频折扣 OtherRatio。
//
// For RelayFormatVolc, the video_url detection reads from the raw body content[]
// instead of TaskSubmitReq.Metadata, since the Volc body is not parsed into
// TaskSubmitReq for native pass-through requests.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if info.RelayFormat == types.RelayFormatVolc {
		return a.estimateBillingVolcNative(c, info)
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	if hasVideoInMetadata(req.Metadata) {
		if ratio, ok := GetVideoInputRatio(info.OriginModelName); ok {
			return map[string]float64{"video_input": ratio}
		}
	}
	return nil
}

// estimateBillingVolcNative checks the raw Volc body for video_url content items.
func (a *TaskAdaptor) estimateBillingVolcNative(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil
	}
	rawBytes, err := storage.Bytes()
	if err != nil {
		return nil
	}
	var body map[string]json.RawMessage
	if err = json.Unmarshal(rawBytes, &body); err != nil {
		return nil
	}
	contentRaw, ok := body["content"]
	if !ok {
		return nil
	}
	if hasVideoInVolcContent(contentRaw) {
		if ratio, ok := GetVideoInputRatio(info.OriginModelName); ok {
			return map[string]float64{"video_input": ratio}
		}
	}
	return nil
}

// hasVideoInVolcContent checks whether the Volc content[] JSON array contains
// any item with type "video_url" (or has a "video_url" key in the item).
func hasVideoInVolcContent(contentRaw json.RawMessage) bool {
	var items []map[string]json.RawMessage
	if err := json.Unmarshal(contentRaw, &items); err != nil {
		return false
	}
	for _, item := range items {
		typeRaw, ok := item["type"]
		if ok {
			var typeStr string
			if err := json.Unmarshal(typeRaw, &typeStr); err == nil && typeStr == "video_url" {
				return true
			}
		}
		if _, hasVideoURL := item["video_url"]; hasVideoURL {
			return true
		}
	}
	return false
}

// hasVideoInMetadata 直接检查 metadata 的 content 数组是否包含 video_url 条目，
// 避免构建完整的上游 requestPayload。
func hasVideoInMetadata(metadata map[string]interface{}) bool {
	if metadata == nil {
		return false
	}
	contentRaw, ok := metadata["content"]
	if !ok {
		return false
	}
	contentSlice, ok := contentRaw.([]interface{})
	if !ok {
		return false
	}
	for _, item := range contentSlice {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if itemMap["type"] == "video_url" {
			return true
		}
		if _, has := itemMap["video_url"]; has {
			return true
		}
	}
	return false
}

// BuildRequestBody converts request into Doubao specific format.
//
// When info.RelayFormat is RelayFormatVolc, the client sent a native Volc body.
// We forward it byte-identical to upstream to preserve all Volc-specific fields
// (tools, resolution, ratio, duration, etc.) without normalization.
//
// For non-Volc paths (e.g. /v1/video/generations), the existing TaskSubmitReq
// normalization is performed as before.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	if info.RelayFormat == types.RelayFormatVolc {
		// Native Volc pass-through: forward the original body byte-identical.
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return nil, fmt.Errorf("BuildRequestBody (volc native): read body failed: %w", err)
		}
		if _, err = storage.Seek(0, io.SeekStart); err != nil {
			return nil, fmt.Errorf("BuildRequestBody (volc native): seek body failed: %w", err)
		}
		rawBytes, err := storage.Bytes()
		if err != nil {
			return nil, fmt.Errorf("BuildRequestBody (volc native): read bytes failed: %w", err)
		}
		// If model is mapped, patch just the model field in the JSON.
		if info.IsModelMapped && info.UpstreamModelName != "" {
			rawBytes, err = patchVolcBodyModel(rawBytes, info.UpstreamModelName)
			if err != nil {
				return nil, fmt.Errorf("BuildRequestBody (volc native): patch model failed: %w", err)
			}
		} else {
			// Extract model name from raw body so info.UpstreamModelName is populated.
			if info.UpstreamModelName == "" {
				var bodyMap map[string]json.RawMessage
				if jsonErr := json.Unmarshal(rawBytes, &bodyMap); jsonErr == nil {
					if modelRaw, ok := bodyMap["model"]; ok {
						var m string
						if jsonErr2 := json.Unmarshal(modelRaw, &m); jsonErr2 == nil && m != "" {
							info.UpstreamModelName = m
						}
					}
				}
			}
		}
		return bytes.NewReader(rawBytes), nil
	}

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

// patchVolcBodyModel replaces the "model" field in a raw Volc JSON body with
// the mapped upstream model name, preserving all other fields.
func patchVolcBodyModel(rawBody []byte, upstreamModel string) ([]byte, error) {
	var bodyMap map[string]json.RawMessage
	if err := json.Unmarshal(rawBody, &bodyMap); err != nil {
		return rawBody, err
	}
	modelJSON, err := json.Marshal(upstreamModel)
	if err != nil {
		return rawBody, err
	}
	bodyMap["model"] = modelJSON
	return json.Marshal(bodyMap)
}

// DoRequest delegates to common helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response, returns taskID etc.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
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

	uri := fmt.Sprintf("%s/api/v3/contents/generations/tasks/%s", baseUrl, taskID)

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

	if sec, _ := strconv.Atoi(req.Seconds); sec > 0 {
		r.Duration = lo.ToPtr(dto.IntValue(sec))
	}

	r.Content = lo.Reject(r.Content, func(c ContentItem, _ int) bool { return c.Type == "text" })
	r.Content = append(r.Content, ContentItem{
		Type: "text",
		Text: req.Prompt,
	})

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
	case "failed":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = resTask.Error.Message
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
	openAIVideo.CreatedAt = originTask.CreatedAt
	openAIVideo.CompletedAt = originTask.UpdatedAt
	openAIVideo.Model = originTask.Properties.OriginModelName

	if dResp.Status == "failed" {
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: dResp.Error.Message,
			Code:    dResp.Error.Code,
		}
	}

	return common.Marshal(openAIVideo)
}
