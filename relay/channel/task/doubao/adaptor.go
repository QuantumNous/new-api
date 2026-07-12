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
	"github.com/QuantumNous/new-api/setting/billing_setting"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/samber/lo"
	"github.com/tidwall/gjson"
)

// ============================
// Request / Response structures
// ============================

type ContentItem struct {
	Type     string    `json:"type,omitempty"`
	Text     string    `json:"text,omitempty"`
	ImageURL *MediaURL `json:"image_url,omitempty"`
	VideoURL *MediaURL `json:"video_url,omitempty"`
	AudioURL *MediaURL `json:"audio_url,omitempty"`
	Role     string    `json:"role,omitempty"`
}

type MediaURL struct {
	URL string `json:"url,omitempty"`
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

type responseTask struct {
	ID      dto.StringValue `json:"id"`
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
	ChannelType   int
	apiKey        string
	baseURL       string
	videoAPIStyle string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
	a.videoAPIStyle = info.ChannelOtherSettings.VolcengineVideoAPIStyle
}

// ValidateRequestAndSetAction parses body, validates fields and sets default action.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	// Accept only POST /v1/video/generations as "generate" action.
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

// BuildRequestURL constructs the upstream URL.
func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return BuildVideoSubmitURL(a.baseURL, a.videoAPIStyle), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

// EstimateBilling returns OtherRatios for per-second duration and optional video-input discount.
// When billing_mode=per_second, multiplies by requested duration (default 10s if omitted).
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	ratios := map[string]float64{}
	if billing_setting.IsPerSecondModel(info.OriginModelName) {
		sec := durationFromRequest(&req)
		if sec <= 0 {
			sec = 10
		}
		ratios["seconds"] = float64(sec)
	}
	if hasVideoInput(&req) {
		if ratio, ok := billing_setting.GetVideoInputRatio(info.OriginModelName); ok {
			ratios["video_input"] = ratio
		}
	}
	if len(ratios) == 0 {
		return nil
	}
	return ratios
}

func durationFromRequest(req *relaycommon.TaskSubmitReq) int {
	if req == nil {
		return 0
	}
	if req.Duration > 0 {
		return req.Duration
	}
	if sec, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil && sec > 0 {
		return sec
	}
	if req.Metadata != nil {
		for _, key := range []string{"duration", "seconds"} {
			if v, ok := req.Metadata[key]; ok {
				switch n := v.(type) {
				case float64:
					if n > 0 {
						return int(n)
					}
				case int:
					if n > 0 {
						return n
					}
				case string:
					if sec, err := strconv.Atoi(strings.TrimSpace(n)); err == nil && sec > 0 {
						return sec
					}
				}
			}
		}
	}
	return 0
}

// hasVideoInput 检查官方 content 数组或 metadata.content 是否包含 video_url 条目。
func hasVideoInput(req *relaycommon.TaskSubmitReq) bool {
	if req == nil {
		return false
	}
	if hasVideoInContent(req.Content) {
		return true
	}
	if req.Metadata == nil {
		return false
	}
	contentRaw, ok := req.Metadata["content"]
	if !ok {
		return false
	}
	contentSlice, ok := contentRaw.([]interface{})
	if !ok {
		return false
	}
	content := make([]map[string]interface{}, 0, len(contentSlice))
	for _, item := range contentSlice {
		if itemMap, ok := item.(map[string]interface{}); ok {
			content = append(content, itemMap)
		}
	}
	return hasVideoInContent(content)
}

func hasVideoInContent(content []map[string]interface{}) bool {
	for _, item := range content {
		if item == nil {
			continue
		}
		if item["type"] == "video_url" {
			return true
		}
		if _, has := item["video_url"]; has {
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

	upstreamID, err := parseCreateTaskID(responseBody)
	if err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return upstreamID, responseBody, nil
}

// parseCreateTaskID extracts the upstream Volc task id from create responses.
// Native Volc returns {"id":"cgt-..."}; some gateways wrap it as
// {"id":33,"upstream_task_id":"cgt-...","upstream_response":{"id":"cgt-..."}}.
func parseCreateTaskID(respBody []byte) (string, error) {
	raw := string(respBody)
	for _, path := range []string{
		"upstream_task_id",
		"upstream_response.id",
		"data.id",
		"data.task_id",
		"id",
	} {
		id := strings.TrimSpace(gjson.Get(raw, path).String())
		if id == "" {
			continue
		}
		if path == "id" && !isLikelyVolcTaskID(id) {
			continue
		}
		return id, nil
	}
	return "", fmt.Errorf("task id not found in create response")
}

func isLikelyVolcTaskID(id string) bool {
	if strings.HasPrefix(id, "cgt-") {
		return true
	}
	// Skip bare numeric gateway record ids (e.g. 33).
	if _, err := strconv.ParseInt(id, 10, 64); err == nil {
		return false
	}
	return id != ""
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := BuildVideoFetchURL(baseUrl, a.videoAPIStyle, taskID)

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
		Model: req.Model,
	}

	// Use Content array if provided
	if len(req.Content) > 0 {
		for _, item := range req.Content {
			contentItem := ContentItem{}
			if t, ok := item["type"].(string); ok {
				contentItem.Type = t
			}
			if text, ok := item["text"].(string); ok {
				contentItem.Text = text
			}
			if imageURL, ok := item["image_url"].(map[string]interface{}); ok {
				if url, ok := imageURL["url"].(string); ok {
					contentItem.ImageURL = &MediaURL{URL: url}
				}
			}
			if videoURL, ok := item["video_url"].(map[string]interface{}); ok {
				if url, ok := videoURL["url"].(string); ok {
					contentItem.VideoURL = &MediaURL{URL: url}
				}
			}
			if audioURL, ok := item["audio_url"].(map[string]interface{}); ok {
				if url, ok := audioURL["url"].(string); ok {
					contentItem.AudioURL = &MediaURL{URL: url}
				}
			}
			if role, ok := item["role"].(string); ok {
				contentItem.Role = role
			}
			r.Content = append(r.Content, contentItem)
		}
	} else {
		r.Content = []ContentItem{}

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

		r.Content = lo.Reject(r.Content, func(c ContentItem, _ int) bool { return c.Type == "text" })
		r.Content = append(r.Content, ContentItem{
			Type: "text",
			Text: req.Prompt,
		})
	}

	metadata := req.Metadata
	if err := taskcommon.UnmarshalMetadata(metadata, &r); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}

	if sec, _ := strconv.Atoi(req.Seconds); sec > 0 {
		r.Duration = lo.ToPtr(dto.IntValue(sec))
	}

	if req.Duration > 0 {
		r.Duration = lo.ToPtr(dto.IntValue(req.Duration))
	}
	if req.Ratio != "" {
		r.Ratio = req.Ratio
	}
	if req.AspectRatio != "" {
		r.Ratio = req.AspectRatio
	}
	if req.Resolution != "" {
		r.Resolution = req.Resolution
	}
	if req.GenerateAudio != nil {
		r.GenerateAudio = lo.ToPtr(dto.BoolValue(*req.GenerateAudio))
	}
	if req.Watermark != nil {
		r.Watermark = lo.ToPtr(dto.BoolValue(*req.Watermark))
	}
	if req.Draft != nil {
		r.Draft = lo.ToPtr(dto.BoolValue(*req.Draft))
	}

	return &r, nil
}

// normalizeTaskPollBody unwraps gateway poll responses that nest the Volc payload under
// upstream_response, and leaves native Volc bodies unchanged.
func normalizeTaskPollBody(respBody []byte) []byte {
	raw := string(respBody)
	if upstream := gjson.Get(raw, "upstream_response"); upstream.Exists() && upstream.IsObject() {
		return []byte(upstream.Raw)
	}
	return respBody
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	resTask := responseTask{}
	if err := common.Unmarshal(normalizeTaskPollBody(respBody), &resTask); err != nil {
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
	if err := common.Unmarshal(normalizeTaskPollBody(originTask.Data), &dResp); err != nil {
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
