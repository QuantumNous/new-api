package gemini

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

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
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionTextGenerate)
}

// BuildRequestURL constructs the Gemini API predictLongRunning endpoint for Veo.
func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	modelName := info.UpstreamModelName
	version := model_setting.GetGeminiVersionSetting(modelName)

	return fmt.Sprintf(
		"%s/%s/models/%s:predictLongRunning",
		a.baseURL,
		version,
		modelName,
	), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-goog-api-key", a.apiKey)
	return nil
}

// BuildRequestBody converts request into the Veo predictLongRunning format.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	v, ok := c.Get("task_request")
	if !ok {
		return nil, fmt.Errorf("request not found in context")
	}
	req, ok := v.(relaycommon.TaskSubmitReq)
	if !ok {
		return nil, fmt.Errorf("unexpected task_request type")
	}

	instance := VeoInstance{Prompt: req.Prompt}
	if img := ExtractMultipartImage(c, info); img != nil {
		instance.Image = img
	} else if len(req.Images) > 0 {
		if parsed := ParseImageInput(req.Images[0]); parsed != nil {
			instance.Image = parsed
			info.Action = constant.TaskActionGenerate
		}
	}

	params := &VeoParameters{}
	if err := taskcommon.UnmarshalMetadata(req.Metadata, params); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	if params.DurationSeconds == 0 && req.Duration > 0 {
		params.DurationSeconds = req.Duration
	}
	if params.Resolution == "" && req.Size != "" {
		params.Resolution = SizeToVeoResolution(req.Size)
	}
	if params.AspectRatio == "" && req.Size != "" {
		params.AspectRatio = SizeToVeoAspectRatio(req.Size)
	}
	params.Resolution = strings.ToLower(params.Resolution)
	params.SampleCount = 1

	body := VeoRequestPayload{
		Instances:  []VeoInstance{instance},
		Parameters: params,
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
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var s submitResponse
	if err := common.Unmarshal(responseBody, &s); err != nil {
		return "", nil, service.TaskErrorWrapper(err, "unmarshal_response_failed", http.StatusInternalServerError)
	}
	if strings.TrimSpace(s.Name) == "" {
		return "", nil, service.TaskErrorWrapper(fmt.Errorf("missing operation name"), "invalid_response", http.StatusInternalServerError)
	}
	taskID = taskcommon.EncodeLocalTaskID(s.Name)
	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)
	return taskID, responseBody, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return []string{
		"veo-3.0-generate-001",
		"veo-3.0-fast-generate-001",
		"veo-3.1-generate-preview",
		"veo-3.1-fast-generate-preview",
	}
}

func (a *TaskAdaptor) GetChannelName() string {
	return "gemini"
}

// EstimateBilling returns OtherRatios based on durationSeconds and resolution.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	v, ok := c.Get("task_request")
	if !ok {
		return nil
	}
	req, ok := v.(relaycommon.TaskSubmitReq)
	if !ok {
		return nil
	}

	seconds := ResolveVeoDuration(req.Metadata, req.Duration, req.Seconds)
	resolution := ResolveVeoResolution(req.Metadata, req.Size)
	resRatio := VeoResolutionRatio(info.UpstreamModelName, resolution)

	return map[string]float64{
		"seconds":    float64(seconds),
		"resolution": resRatio,
	}
}

// FetchTask polls task status via the Gemini operations GET endpoint.
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	upstreamName, err := taskcommon.DecodeLocalTaskID(taskID)
	if err != nil {
		return nil, fmt.Errorf("decode task_id failed: %w", err)
	}

	version := model_setting.GetGeminiVersionSetting("default")
	url := fmt.Sprintf("%s/%s/%s", baseUrl, version, upstreamName)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-goog-api-key", key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var op operationResponse
	if err := common.Unmarshal(respBody, &op); err != nil {
		return nil, fmt.Errorf("unmarshal operation response failed: %w", err)
	}

	ti := &relaycommon.TaskInfo{}

	if op.Error.Message != "" {
		ti.Status = model.TaskStatusFailure
		ti.Reason = op.Error.Message
		ti.Progress = "100%"
		return ti, nil
	}

	if !op.Done {
		ti.Status = model.TaskStatusInProgress
		ti.Progress = "50%"
		return ti, nil
	}

	ti.Status = model.TaskStatusSuccess
	ti.Progress = "100%"

	ti.TaskID = taskcommon.EncodeLocalTaskID(op.Name)

	if len(op.Response.GenerateVideoResponse.GeneratedVideos) > 0 {
		if uri := op.Response.GenerateVideoResponse.GeneratedVideos[0].Video.URI; uri != "" {
			ti.RemoteUrl = uri
		}
	}

	return ti, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	upstreamTaskID := task.GetUpstreamTaskID()
	upstreamName, err := taskcommon.DecodeLocalTaskID(upstreamTaskID)
	if err != nil {
		upstreamName = ""
	}
	modelName := extractModelFromOperationName(upstreamName)
	if strings.TrimSpace(modelName) == "" {
		modelName = "veo-3.0-generate-001"
	}

	video := dto.NewOpenAIVideo()
	video.ID = task.TaskID
	video.Model = modelName
	video.Status = task.Status.ToVideoStatus()
	video.SetProgressStr(task.Progress)
	video.CreatedAt = task.CreatedAt
	if task.FinishTime > 0 {
		video.CompletedAt = task.FinishTime
	} else if task.UpdatedAt > 0 {
		video.CompletedAt = task.UpdatedAt
	}

	return common.Marshal(video)
}

// ============================
// helpers
// ============================

var modelRe = regexp.MustCompile(`models/([^/]+)/operations/`)

func extractModelFromOperationName(name string) string {
	if name == "" {
		return ""
	}
	if m := modelRe.FindStringSubmatch(name); len(m) == 2 {
		return m[1]
	}
	if idx := strings.Index(name, "models/"); idx >= 0 {
		s := name[idx+len("models/"):]
		if p := strings.Index(s, "/operations/"); p > 0 {
			return s[:p]
		}
	}
	return ""
}
