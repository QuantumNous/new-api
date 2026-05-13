// Package kuaizi implements the new-api task adaptor for the Kuaizi 丽帧视频 2.0
// API (https://aiopenapi.kuaizi.cn/ai-open-platform-api/v1/lz/video/task).
//
// Protocol notes (different from every other adapter in this tree):
//   - Auth header is `ApiKey: <key>` (not `Authorization: Bearer`).
//   - Submit  → POST <base>/create
//     Status  → POST <base>/status   (JSON body: {"task_id":"..."})
//   - Every response is wrapped in {"code":int,"message":string,"data":{...}}.
//     code==200 means success; any other code is an upstream-reported error.
//   - There is no `model` field upstream; we map the pseudo-models registered
//     in constants.go (kuaizi-lizhen-fast / kuaizi-lizhen-pro) to the upstream
//     `mode` flag.
//
// The download URL key in the success status payload is not documented; we
// look at a small set of common keys and surface the raw body in logs when
// none match so operators can extend ExtractVideoURL.
package kuaizi

import (
	"bytes"
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

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// Wire-level types
// ============================

type imageInput struct {
	URL  string `json:"url"`
	Role string `json:"role,omitempty"` // first_frame / last_frame / reference_image
}

type videoInput struct {
	URL  string `json:"url"`
	Role string `json:"role,omitempty"` // reference_video
}

type audioInput struct {
	URL  string `json:"url"`
	Role string `json:"role,omitempty"` // reference_audio
}

// createRequest is the body of POST /create.
// Every field except prompt+generation_type is optional; only set ones from
// metadata or top-level TaskSubmitReq are forwarded so we don't override
// upstream defaults with zero values.
type createRequest struct {
	Prompt         string       `json:"prompt,omitempty"`
	GenerationType string       `json:"generation_type"`
	Mode           string       `json:"mode"`
	InputType      string       `json:"input_type,omitempty"`
	Images         []imageInput `json:"images,omitempty"`
	Videos         []videoInput `json:"videos,omitempty"`
	Audios         []audioInput `json:"audios,omitempty"`
	Resolution     string       `json:"resolution,omitempty"`
	Ratio          string       `json:"ratio,omitempty"`
	Duration       *int         `json:"duration,omitempty"`
	GenerateAudio  *bool        `json:"generate_audio,omitempty"`
	Seed           *int         `json:"seed,omitempty"`
	WebSearch      *bool        `json:"web_search,omitempty"`
}

// metadataOverrides mirrors createRequest minus the fields that are always
// taken from top-level TaskSubmitReq (prompt, generation_type, mode). Anything
// extra a caller passes via `metadata` lands here.
type metadataOverrides struct {
	InputType     string       `json:"input_type,omitempty"`
	Images        []imageInput `json:"images,omitempty"`
	Videos        []videoInput `json:"videos,omitempty"`
	Audios        []audioInput `json:"audios,omitempty"`
	Resolution    string       `json:"resolution,omitempty"`
	Ratio         string       `json:"ratio,omitempty"`
	Duration      *int         `json:"duration,omitempty"`
	GenerateAudio *bool        `json:"generate_audio,omitempty"`
	Seed          *int         `json:"seed,omitempty"`
	WebSearch     *bool        `json:"web_search,omitempty"`
}

// envelope is the {code,message,data} wrapper around every upstream response.
type envelope struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    map[string]any  `json:"data"`
}

// statusResponseData is the shape we observe inside envelope.Data for /status.
// Field names come from a real upstream response, not the doc — the spec is
// out of date:
//   - failure text lives in `error`, not `fail_reason`
//   - token counts are nested under `usage`, not flat
type statusResponseData struct {
	TaskID   string `json:"task_id"`
	Status   string `json:"status"`
	Error    string `json:"error"`
	Duration int    `json:"duration"`
	VideoURL string `json:"video_url"`
	TosKey   string `json:"tos_key"`
	Usage    struct {
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
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

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + "/create", nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("ApiKey", a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	modelName := info.UpstreamModelName
	if modelName == "" {
		modelName = req.Model
	}
	mode, ok := ModelToMode(modelName)
	if !ok {
		return nil, fmt.Errorf("unsupported kuaizi model %q; expected %s or %s",
			modelName, ModelLizhenFast, ModelLizhenPro)
	}

	body := createRequest{
		Prompt:         req.Prompt,
		GenerationType: "video",
		Mode:           mode,
	}

	if req.HasImage() {
		for _, u := range req.Images {
			body.Images = append(body.Images, imageInput{URL: u})
		}
	}

	// Caller-supplied overrides take precedence over the defaults above.
	if len(req.Metadata) > 0 {
		var over metadataOverrides
		if err := req.UnmarshalMetadata(&over); err != nil {
			return nil, errors.Wrap(err, "unmarshal metadata failed")
		}
		if over.InputType != "" {
			body.InputType = over.InputType
		}
		if len(over.Images) > 0 {
			body.Images = over.Images
		}
		if len(over.Videos) > 0 {
			body.Videos = over.Videos
		}
		if len(over.Audios) > 0 {
			body.Audios = over.Audios
		}
		if over.Resolution != "" {
			body.Resolution = over.Resolution
		}
		if over.Ratio != "" {
			body.Ratio = over.Ratio
		}
		if over.Duration != nil {
			body.Duration = over.Duration
		}
		if over.GenerateAudio != nil {
			body.GenerateAudio = over.GenerateAudio
		}
		if over.Seed != nil {
			body.Seed = over.Seed
		}
		if over.WebSearch != nil {
			body.WebSearch = over.WebSearch
		}
	}

	// Top-level shortcut: seconds/duration on TaskSubmitReq wins over metadata
	// only when metadata didn't already set duration.
	if body.Duration == nil {
		if sec, parseErr := strconv.Atoi(req.Seconds); parseErr == nil && sec > 0 {
			d := sec
			body.Duration = &d
		} else if req.Duration > 0 {
			d := req.Duration
			body.Duration = &d
		}
	}

	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, body io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, body)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var env envelope
	if err := common.Unmarshal(responseBody, &env); err != nil {
		taskErr = service.TaskErrorWrapper(
			errors.Wrapf(err, "body: %s", responseBody),
			"unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	tid, _ := env.Data["task_id"].(string)

	// Kuaizi documents success as code==200, but some deployments return
	// code==0. Treat the presence of a non-empty task_id as the authoritative
	// success signal; otherwise propagate the full upstream body in the error
	// so operators can see exactly what came back.
	if tid == "" {
		taskErr = service.TaskErrorWrapper(
			fmt.Errorf("kuaizi upstream code=%d message=%q body=%s", env.Code, env.Message, string(responseBody)),
			"upstream_error", http.StatusBadGateway)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return tid, responseBody, nil
}

// FetchTask polls /status. Kuaizi expects POST with {"task_id":"..."} — no
// other adapter in this tree uses POST for a fetch step, so we implement it
// inline rather than delegating to a helper.
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	payload, err := common.Marshal(map[string]string{"task_id": taskID})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, baseUrl+"/status", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("ApiKey", key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) GetModelList() []string { return ModelList }
func (a *TaskAdaptor) GetChannelName() string { return ChannelName }

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var env envelope
	if err := common.Unmarshal(respBody, &env); err != nil {
		return nil, errors.Wrap(err, "unmarshal task status failed")
	}
	// Same lenient success check as DoResponse: presence of data is the signal.
	// Kuaizi returns code==200 per spec but some deployments return 0.
	if env.Data == nil {
		return &relaycommon.TaskInfo{
			Code:   env.Code,
			Status: model.TaskStatusFailure,
			Reason: fmt.Sprintf("kuaizi status code=%d message=%q body=%s", env.Code, env.Message, string(respBody)),
		}, nil
	}

	// Re-marshal the inner data so we can decode into a typed struct.
	rawData, err := common.Marshal(env.Data)
	if err != nil {
		return nil, errors.Wrap(err, "remarshal task data failed")
	}
	var data statusResponseData
	if err := common.Unmarshal(rawData, &data); err != nil {
		return nil, errors.Wrap(err, "unmarshal task data failed")
	}

	info := &relaycommon.TaskInfo{Code: 0}
	switch data.Status {
	case "running":
		info.Status = model.TaskStatusInProgress
		info.Progress = "50%"
	case "succeeded":
		info.Status = model.TaskStatusSuccess
		info.Progress = "100%"
		info.Url = data.VideoURL
		if info.Url == "" {
			info.Url = extractVideoURL(env.Data)
		}
		info.CompletionTokens = data.Usage.CompletionTokens
		info.TotalTokens = data.Usage.TotalTokens
	case "failed":
		info.Status = model.TaskStatusFailure
		info.Progress = "100%"
		info.Reason = data.Error
	default:
		info.Status = model.TaskStatusInProgress
		info.Progress = "30%"
	}
	return info, nil
}

// extractVideoURL is a defensive fallback for the success download link.
// Real Kuaizi responses use `video_url`, which statusResponseData reads
// directly; this helper handles the case where a future API revision moves
// the field around without breaking the polling flow.
func extractVideoURL(data map[string]any) string {
	candidates := []string{"video_url", "url", "download_url", "output_url", "result_url"}
	for _, k := range candidates {
		if s, ok := data[k].(string); ok && s != "" {
			return s
		}
	}
	// Nested {result: {url}} / {output: {url}} forms.
	for _, k := range []string{"result", "output"} {
		if nested, ok := data[k].(map[string]any); ok {
			for _, inner := range []string{"url", "video_url", "download_url"} {
				if s, ok := nested[inner].(string); ok && s != "" {
					return s
				}
			}
		}
	}
	return ""
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var env envelope
	if err := common.Unmarshal(originTask.Data, &env); err != nil {
		return nil, errors.Wrap(err, "unmarshal kuaizi task data failed")
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = originTask.TaskID
	ov.TaskID = originTask.TaskID
	ov.Status = originTask.Status.ToVideoStatus()
	ov.SetProgressStr(originTask.Progress)
	ov.SetMetadata("url", extractVideoURL(env.Data))
	ov.CreatedAt = originTask.CreatedAt
	ov.CompletedAt = originTask.UpdatedAt
	ov.Model = originTask.Properties.OriginModelName

	if originTask.Status == model.TaskStatusFailure {
		ov.Error = &dto.OpenAIVideoError{
			Message: originTask.FailReason,
			Code:    strconv.Itoa(env.Code),
		}
	}

	return common.Marshal(ov)
}
