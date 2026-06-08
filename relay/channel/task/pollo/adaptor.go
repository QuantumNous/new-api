package pollo

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
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

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// Pollo AI Seedance task adaptor.
// Docs: https://docs.pollo.ai/m/seedance/seedance-2-0
//
// Auth:   header "x-api-key: <key>"
// Submit: POST {base}/generation/bytedance/<endpoint>           -> {taskId, status}
// Status: GET  {base}/generation/{taskId}/status               -> {taskId, credit, generations:[{status,url,...}]}

const defaultBaseURL = "https://pollo.ai/api/platform"

// endpoint maps a user-facing model name to its Pollo submit path and request shape.
// Non-ref models use input.length + optional image; ref models use input.duration + required refs[].
type endpoint struct {
	path  string // appended to {base}/generation/
	isRef bool
}

var modelEndpoints = map[string]endpoint{
	"seedance-2-0":          {path: "bytedance/seedance-2-0", isRef: false},
	"seedance-2-0-fast":     {path: "bytedance/seedance-2-0-fast", isRef: false},
	"seedance-2-0-ref":      {path: "bytedance/seedance-2-0/ref2video", isRef: true},
	"seedance-2-0-fast-ref": {path: "bytedance/seedance-2-0-fast/ref2video", isRef: true},
}

// ============================
// Request / Response structures
// ============================

type polloInput struct {
	Prompt      string `json:"prompt,omitempty"`
	Image       string `json:"image,omitempty"`      // image2video (non-ref only)
	ImageTail   string `json:"imageTail,omitempty"`  // optional tail frame (non-ref only)
	Resolution  string `json:"resolution,omitempty"` // 480p | 720p | 1080p
	AspectRatio string `json:"aspectRatio,omitempty"`
	Length      int    `json:"length,omitempty"`   // non-ref: 4-15 seconds
	Duration    int    `json:"duration,omitempty"` // ref:     4-15 seconds
	Seed        int    `json:"seed,omitempty"`

	GenerateAudio *bool `json:"generateAudio,omitempty"`
	WebSearch     *bool `json:"webSearch,omitempty"` // non-ref only
	VideoNum      int   `json:"videoNum,omitempty"`  // ref only, 1-4

	// Free-form provider-specific structures, passed through from metadata.
	Refs      []any `json:"refs,omitempty"`      // ref models: required, 1-13 items
	ImageMeta []any `json:"imageMeta,omitempty"` // ref models: optional
}

type polloRequest struct {
	Input        polloInput `json:"input"`
	WebhookUrl   string     `json:"webhookUrl,omitempty"`
	ClientSource string     `json:"clientSource,omitempty"`
}

// codeSuccess is the value of the "code" field on a successful Pollo response.
const codeSuccess = "SUCCESS"

// polloSubmitResponse matches the real wire format
//
//	{"code":"SUCCESS","message":"success","data":{"taskId":"...","status":"waiting"}}
//
// and also tolerates the flat {taskId,status} shape the OpenAPI doc advertises.
type polloSubmitResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Data    struct {
		TaskId string `json:"taskId"`
		Status string `json:"status"`
	} `json:"data"`
	// flat fallback
	TaskId string `json:"taskId"`
	Status string `json:"status"`
}

func (r *polloSubmitResponse) taskID() string {
	if r.Data.TaskId != "" {
		return r.Data.TaskId
	}
	return r.TaskId
}

// failed reports whether the envelope carries a non-success code.
func (r *polloSubmitResponse) failed() bool {
	return r.Code != "" && r.Code != codeSuccess
}

func (r *polloSubmitResponse) errMessage() string {
	return r.Message
}

type polloGeneration struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	FailMsg   string `json:"failMsg"`
	Url       string `json:"url"`
	MediaType string `json:"mediaType"`
}

type polloStatusResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Data    struct {
		TaskId      string            `json:"taskId"`
		Credit      float64           `json:"credit"`
		Generations []polloGeneration `json:"generations"`
	} `json:"data"`
	// flat fallback
	Generations []polloGeneration `json:"generations"`
}

func (r *polloStatusResponse) gens() []polloGeneration {
	if len(r.Data.Generations) > 0 {
		return r.Data.Generations
	}
	return r.Generations
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
	a.apiKey = info.ApiKey
	a.baseURL = taskcommon.DefaultString(info.ChannelBaseUrl, defaultBaseURL)
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if err := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate); err != nil {
		return err
	}
	if _, ok := modelEndpoints[info.OriginModelName]; !ok {
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("unsupported pollo model: %s", info.OriginModelName),
			"invalid_model", http.StatusBadRequest)
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	ep, ok := modelEndpoints[info.UpstreamModelName]
	if !ok {
		// fall back to origin model name (mapping is keyed on the seedance model id)
		ep, ok = modelEndpoints[info.OriginModelName]
		if !ok {
			return "", fmt.Errorf("unsupported pollo model: %s", info.UpstreamModelName)
		}
	}
	return fmt.Sprintf("%s/generation/%s", strings.TrimRight(a.baseURL, "/"), ep.path), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-api-key", a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}
	body, err := a.convertToRequestPayload(&req, info)
	if err != nil {
		return nil, err
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}

	var pResp polloSubmitResponse
	if err = common.Unmarshal(responseBody, &pResp); err != nil {
		taskErr = service.TaskErrorWrapper(err, "unmarshal_response_failed", http.StatusInternalServerError)
		return
	}

	upstreamTaskID := pResp.taskID()
	if pResp.failed() || upstreamTaskID == "" {
		msg := pResp.errMessage()
		if msg == "" {
			msg = string(responseBody)
		}
		taskErr = service.TaskErrorWrapperLocal(fmt.Errorf("%s", msg), "task_failed", http.StatusBadRequest)
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

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	base := taskcommon.DefaultString(baseUrl, defaultBaseURL)
	url := fmt.Sprintf("%s/generation/%s/status", strings.TrimRight(base, "/"), taskID)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-api-key", key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var resp polloStatusResponse
	if err := common.Unmarshal(respBody, &resp); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal response body")
	}

	gens := resp.gens()
	taskInfo := &relaycommon.TaskInfo{}
	if len(gens) == 0 {
		// No generation yet — treat as still queued.
		taskInfo.Status = model.TaskStatusQueued
		taskInfo.Progress = taskcommon.ProgressQueued
		return taskInfo, nil
	}

	// Aggregate: any failure -> failure; all succeed -> success; otherwise in progress.
	allSucceed := true
	for _, g := range gens {
		switch g.Status {
		case "failed":
			taskInfo.Status = model.TaskStatusFailure
			taskInfo.Reason = taskcommon.DefaultString(g.FailMsg, "generation failed")
			return taskInfo, nil
		case "succeed":
			// keep checking the rest
		default: // waiting / processing
			allSucceed = false
		}
	}

	if allSucceed {
		taskInfo.Status = model.TaskStatusSuccess
		taskInfo.Progress = taskcommon.ProgressComplete
		for _, g := range gens {
			if g.Url != "" {
				taskInfo.Url = g.Url
				break
			}
		}
		return taskInfo, nil
	}

	taskInfo.Status = model.TaskStatusInProgress
	taskInfo.Progress = taskcommon.ProgressInProgress
	return taskInfo, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	models := make([]string, 0, len(modelEndpoints))
	for m := range modelEndpoints {
		models = append(models, m)
	}
	return models
}

func (a *TaskAdaptor) GetChannelName() string {
	return "pollo"
}

// ============================
// helpers
// ============================

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*polloRequest, error) {
	ep := modelEndpoints[info.OriginModelName]

	input := polloInput{
		Prompt:     req.Prompt,
		Resolution: "720p",
		Seed:       0,
	}

	seconds := taskcommon.DefaultInt(req.Duration, 5)
	if ep.isRef {
		input.Duration = seconds
	} else {
		input.Length = seconds
		input.Image = req.Image
	}

	// Overlay any provider-specific fields supplied via metadata
	// (refs, aspectRatio, resolution, generateAudio, webSearch, videoNum, imageMeta, seed, imageTail...).
	if err := taskcommon.UnmarshalMetadata(req.Metadata, &input); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}

	return &polloRequest{Input: input}, nil
}

// ConvertToOpenAIVideo renders a stored task into the OpenAI video API response shape.
func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	ov := dto.NewOpenAIVideo()
	ov.ID = originTask.TaskID
	ov.TaskID = originTask.TaskID
	ov.Status = originTask.Status.ToVideoStatus()
	ov.SetProgressStr(originTask.Progress)

	if len(originTask.Data) > 0 {
		var resp polloStatusResponse
		if err := common.Unmarshal(originTask.Data, &resp); err == nil {
			for _, g := range resp.gens() {
				if g.Url != "" {
					ov.SetMetadata("url", g.Url)
					break
				}
			}
		}
	}

	if originTask.Status == model.TaskStatusFailure {
		ov.Error = &dto.OpenAIVideoError{Message: originTask.FailReason}
	}
	return common.Marshal(ov)
}
