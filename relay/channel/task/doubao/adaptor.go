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
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/samber/lo"
)

// ============================
// Request / Response structures
// ============================

type ContentItem struct {
	Type        string         `json:"type,omitempty"`
	Text        string         `json:"text,omitempty"`
	ImageURL    map[string]any `json:"image_url,omitempty"`
	VideoURL    map[string]any `json:"video_url,omitempty"`
	AudioURL    map[string]any `json:"audio_url,omitempty"`
	Role        string         `json:"role,omitempty"`
	ExtraFields map[string]any `json:"-"`
}

type requestPayload struct {
	Model                 string           `json:"model"`
	Content               []ContentItem    `json:"content,omitempty"`
	CallbackURL           string           `json:"callback_url,omitempty"`
	ReturnLastFrame       *dto.BoolValue   `json:"return_last_frame,omitempty"`
	ServiceTier           string           `json:"service_tier,omitempty"`
	ExecutionExpiresAfter *dto.IntValue    `json:"execution_expires_after,omitempty"`
	GenerateAudio         *dto.BoolValue   `json:"generate_audio,omitempty"`
	Draft                 *dto.BoolValue   `json:"draft,omitempty"`
	Tools                 []map[string]any `json:"tools,omitempty"`
	Resolution            string           `json:"resolution,omitempty"`
	Ratio                 string           `json:"ratio,omitempty"`
	Duration              *dto.IntValue    `json:"duration,omitempty"`
	Frames                *dto.IntValue    `json:"frames,omitempty"`
	Seed                  *dto.IntValue    `json:"seed,omitempty"`
	CameraFixed           *dto.BoolValue   `json:"camera_fixed,omitempty"`
	Watermark             *dto.BoolValue   `json:"watermark,omitempty"`
	ExtraFields           map[string]any   `json:"-"`
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
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	// Accept only POST /v1/video/generations as "generate" action.
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
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
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	hasVideoInput := hasVideoInMetadata(req.Metadata)
	if conditionalPrice, ok := ratio_setting.GetTaskConditionalInputPrice(info.OriginModelName, getResolutionFromMetadata(req.Metadata), hasVideoInput); ok {
		info.PriceData.ConditionalInputPrice = conditionalPrice
	}
	if hasVideoInput {
		if ratio, ok := GetVideoInputRatio(info.OriginModelName); ok {
			return map[string]float64{"video_input": ratio}
		}
	}
	return nil
}

func getResolutionFromMetadata(metadata map[string]interface{}) string {
	if metadata == nil {
		return ""
	}
	if resolution, ok := metadata["resolution"].(string); ok {
		return strings.TrimSpace(resolution)
	}
	return ""
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

	if err := applyMetadataToRequestPayload(&r, req.Metadata); err != nil {
		return nil, err
	}

	if sec, _ := strconv.Atoi(req.Seconds); sec > 0 {
		r.Duration = lo.ToPtr(dto.IntValue(sec))
	} else if req.Duration > 0 {
		r.Duration = lo.ToPtr(dto.IntValue(req.Duration))
	}

	if req.HasImage() {
		for _, imgURL := range req.Images {
			r.Content = append(r.Content, ContentItem{
				Type:     "image_url",
				ImageURL: map[string]any{"url": imgURL},
			})
		}
	}
	if !hasTextContent(r.Content) && strings.TrimSpace(req.Prompt) != "" {
		r.Content = append(r.Content, ContentItem{
			Type: "text",
			Text: req.Prompt,
		})
	}

	return &r, nil
}

func (r requestPayload) MarshalJSON() ([]byte, error) {
	out := cloneAnyMap(r.ExtraFields)
	out["model"] = r.Model
	if len(r.Content) > 0 {
		out["content"] = r.Content
	}
	if r.CallbackURL != "" {
		out["callback_url"] = r.CallbackURL
	}
	if r.ReturnLastFrame != nil {
		out["return_last_frame"] = r.ReturnLastFrame
	}
	if r.ServiceTier != "" {
		out["service_tier"] = r.ServiceTier
	}
	if r.ExecutionExpiresAfter != nil {
		out["execution_expires_after"] = r.ExecutionExpiresAfter
	}
	if r.GenerateAudio != nil {
		out["generate_audio"] = r.GenerateAudio
	}
	if r.Draft != nil {
		out["draft"] = r.Draft
	}
	if len(r.Tools) > 0 {
		out["tools"] = r.Tools
	}
	if r.Resolution != "" {
		out["resolution"] = r.Resolution
	}
	if r.Ratio != "" {
		out["ratio"] = r.Ratio
	}
	if r.Duration != nil {
		out["duration"] = r.Duration
	}
	if r.Frames != nil {
		out["frames"] = r.Frames
	}
	if r.Seed != nil {
		out["seed"] = r.Seed
	}
	if r.CameraFixed != nil {
		out["camera_fixed"] = r.CameraFixed
	}
	if r.Watermark != nil {
		out["watermark"] = r.Watermark
	}
	return common.Marshal(out)
}

func (c ContentItem) MarshalJSON() ([]byte, error) {
	out := cloneAnyMap(c.ExtraFields)
	if c.Type != "" {
		out["type"] = c.Type
	}
	if c.Text != "" {
		out["text"] = c.Text
	}
	if c.ImageURL != nil {
		out["image_url"] = c.ImageURL
	}
	if c.VideoURL != nil {
		out["video_url"] = c.VideoURL
	}
	if c.AudioURL != nil {
		out["audio_url"] = c.AudioURL
	}
	if c.Role != "" {
		out["role"] = c.Role
	}
	return common.Marshal(out)
}

func applyMetadataToRequestPayload(target *requestPayload, metadata map[string]any) error {
	if metadata == nil {
		return nil
	}
	metaCopy := cloneAnyMap(metadata)
	if err := taskcommon.UnmarshalMetadata(metaCopy, target); err != nil {
		return errors.Wrap(err, "unmarshal metadata failed")
	}
	target.ExtraFields = extractUnknownRequestPayloadFields(metadata)
	if contentRaw, ok := metadata["content"]; ok {
		content, err := buildContentItems(contentRaw)
		if err != nil {
			return err
		}
		target.Content = content
	}
	if toolsRaw, ok := metadata["tools"]; ok {
		target.Tools = buildMapSlice(toolsRaw)
	}
	return nil
}

func buildContentItems(raw any) ([]ContentItem, error) {
	itemsRaw, ok := raw.([]any)
	if !ok {
		return nil, fmt.Errorf("invalid content type")
	}
	items := make([]ContentItem, 0, len(itemsRaw))
	for _, itemRaw := range itemsRaw {
		itemMap, ok := itemRaw.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("invalid content item type")
		}
		item := ContentItem{
			ExtraFields: extractUnknownContentItemFields(itemMap),
		}
		if v, ok := itemMap["type"].(string); ok {
			item.Type = v
		}
		if v, ok := itemMap["text"].(string); ok {
			item.Text = v
		}
		if v, ok := itemMap["role"].(string); ok {
			item.Role = v
		}
		if v, ok := itemMap["image_url"].(map[string]any); ok {
			item.ImageURL = cloneAnyMap(v)
		}
		if v, ok := itemMap["video_url"].(map[string]any); ok {
			item.VideoURL = cloneAnyMap(v)
		}
		if v, ok := itemMap["audio_url"].(map[string]any); ok {
			item.AudioURL = cloneAnyMap(v)
		}
		items = append(items, item)
	}
	return items, nil
}

func buildMapSlice(raw any) []map[string]any {
	itemsRaw, ok := raw.([]any)
	if !ok {
		return nil
	}
	items := make([]map[string]any, 0, len(itemsRaw))
	for _, itemRaw := range itemsRaw {
		itemMap, ok := itemRaw.(map[string]any)
		if !ok {
			continue
		}
		items = append(items, cloneAnyMap(itemMap))
	}
	return items
}

func hasTextContent(content []ContentItem) bool {
	for _, item := range content {
		if item.Type == "text" && strings.TrimSpace(item.Text) != "" {
			return true
		}
	}
	return false
}

func extractUnknownRequestPayloadFields(metadata map[string]any) map[string]any {
	known := map[string]struct{}{
		"model": {}, "content": {}, "callback_url": {}, "return_last_frame": {}, "service_tier": {},
		"execution_expires_after": {}, "generate_audio": {}, "draft": {}, "tools": {}, "resolution": {},
		"ratio": {}, "duration": {}, "frames": {}, "seed": {}, "camera_fixed": {}, "watermark": {},
	}
	out := map[string]any{}
	for key, value := range metadata {
		if _, ok := known[key]; ok {
			continue
		}
		out[key] = cloneAnyValue(value)
	}
	return out
}

func extractUnknownContentItemFields(item map[string]any) map[string]any {
	known := map[string]struct{}{
		"type": {}, "text": {}, "image_url": {}, "video_url": {}, "audio_url": {}, "role": {},
	}
	out := map[string]any{}
	for key, value := range item {
		if _, ok := known[key]; ok {
			continue
		}
		out[key] = cloneAnyValue(value)
	}
	return out
}

func cloneAnyMap(src map[string]any) map[string]any {
	if src == nil {
		return map[string]any{}
	}
	return cloneAnyValue(src).(map[string]any)
}

func cloneAnyValue(src any) any {
	raw, err := common.Marshal(src)
	if err != nil {
		return src
	}
	var dst any
	if err := common.Unmarshal(raw, &dst); err != nil {
		return src
	}
	return dst
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
