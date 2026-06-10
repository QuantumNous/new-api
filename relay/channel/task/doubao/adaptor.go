package doubao

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
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

// ============================
// Request / Response structures
// ============================

// ContentItem and MediaURL are the Volcengine seedance content[] item shapes.
// Aliased to the shared inbound dto so the identical structs are defined once.
// The official seedance content[] format new-api exposes (dto.SeedanceVideoRequest)
// is modeled directly on Ark's POST /api/v3/contents/generations/tasks body, so the
// content[] array passes through to the upstream verbatim.
type ContentItem = dto.SeedanceContentItem
type MediaURL = dto.SeedanceURLObject

// toolItem is the Ark `tools[]` entry (e.g. {"type":"web_search"}). It is a
// Doubao/Ark extension beyond the official seedance schema.
type toolItem struct {
	Type string `json:"type,omitempty"`
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
	Tools                 []toolItem     `json:"tools,omitempty"`
	Resolution            string         `json:"resolution,omitempty"`
	Ratio                 string         `json:"ratio,omitempty"`
	Duration              *dto.IntValue  `json:"duration,omitempty"`
	Frames                *dto.IntValue  `json:"frames,omitempty"`
	Seed                  *dto.IntValue  `json:"seed,omitempty"`
	CameraFixed           *dto.BoolValue `json:"camera_fixed,omitempty"`
	Watermark             *dto.BoolValue `json:"watermark,omitempty"`
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

// ValidateRequestAndSetAction parses the inbound body as the shared, official
// seedance content[] request (via taskcommon.BindSeedanceRequest) and sets the
// action. The body stays reusable so BuildRequestBody / EstimateBilling can
// re-read it. No more legacy prompt/images/metadata inbound shape.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	if _, err := taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	return nil
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

// EstimateBilling detects whether the request carries a video input (a
// video_url content item) and, if so, returns the model's video-input discount
// ratio. It reuses the seedance request parsed by BindSeedanceRequest (no
// metadata, no extra body decode).
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	// Reuse the request already parsed by BindSeedanceRequest (in
	// ValidateRequestAndSetAction) instead of re-decoding the body.
	seedReq, err := taskcommon.GetSeedanceRequest(c)
	if err != nil {
		return nil
	}
	if len(seedReq.Videos()) == 0 {
		return nil
	}
	// The video-input discount is keyed on the upstream model name. When the
	// channel uses model mapping, info.OriginModelName is the client-facing
	// alias (absent from videoInputRatioMap), while info.UpstreamModelName —
	// already resolved by ModelMappedHelper before EstimateBilling runs — is the
	// real model. Fall back to OriginModelName for unmapped channels.
	modelName := info.UpstreamModelName
	if modelName == "" {
		modelName = info.OriginModelName
	}
	if ratio, ok := GetVideoInputRatio(modelName); ok {
		return map[string]float64{"video_input": ratio}
	}
	return nil
}

// doubaoExtensions are optional fields beyond the official seedance schema that
// clients may set to drive Doubao/Ark-specific upstream features. Pure seedance
// callers simply omit them.
type doubaoExtensions struct {
	ServiceTier           string         `json:"service_tier"`
	ExecutionExpiresAfter *dto.IntValue  `json:"execution_expires_after"`
	Draft                 *dto.BoolValue `json:"draft"`
	Tools                 []toolItem     `json:"tools"`
}

// BuildRequestBody re-parses the (reusable) body as the official seedance
// request plus Doubao-only extensions and translates it into the Ark upstream
// body.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	// The official seedance fields and the Doubao-only extension keys are
	// siblings in the same JSON body; decode both in a single pass.
	var inbound struct {
		dto.SeedanceVideoRequest
		doubaoExtensions
	}
	if err := common.UnmarshalBodyReusable(c, &inbound); err != nil {
		return nil, err
	}
	seedReq := inbound.SeedanceVideoRequest

	body := buildDoubaoCreateRequest(&seedReq, inbound.doubaoExtensions)
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

// buildDoubaoCreateRequest translates the shared, official seedance content[]
// request (plus Doubao-only extensions) into the Ark POST .../tasks body. Pure
// function — no gin/IO — so the mapping is unit-testable in isolation. Because
// the official content[] format mirrors Ark's wire format, content passes
// through verbatim and only the typed scalar wrappers differ.
func buildDoubaoCreateRequest(seedReq *dto.SeedanceVideoRequest, ext doubaoExtensions) *requestPayload {
	return &requestPayload{
		Model:                 seedReq.Model,
		Content:               seedReq.Content,
		Resolution:            seedReq.Resolution,
		Ratio:                 seedReq.Ratio,
		Duration:              toIntValue(seedReq.Duration),
		Frames:                toIntValue(seedReq.Frames),
		Seed:                  toIntValue(seedReq.Seed),
		CameraFixed:           toBoolValue(seedReq.CameraFixed),
		Watermark:             toBoolValue(seedReq.Watermark),
		GenerateAudio:         toBoolValue(seedReq.GenerateAudio),
		ReturnLastFrame:       toBoolValue(seedReq.ReturnLastFrame),
		CallbackURL:           seedReq.CallbackURL,
		ServiceTier:           ext.ServiceTier,
		ExecutionExpiresAfter: ext.ExecutionExpiresAfter,
		Draft:                 ext.Draft,
		Tools:                 ext.Tools,
	}
}

// toIntValue / toBoolValue convert the official seedance request's *int / *bool
// pointers into the Ark wire types, preserving nil (absent => omitted).
func toIntValue(v *int) *dto.IntValue {
	if v == nil {
		return nil
	}
	iv := dto.IntValue(*v)
	return &iv
}

func toBoolValue(v *bool) *dto.BoolValue {
	if v == nil {
		return nil
	}
	bv := dto.BoolValue(*v)
	return &bv
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
