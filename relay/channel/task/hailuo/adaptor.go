package hailuo

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"
)

// https://platform.minimaxi.com/docs/api-reference/video-generation-intro
type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string

	// Per-second billing state, captured during EstimateBilling so that
	// SecondBillingRatios can report a pricing failure to the relay path.
	secondBillingModel      string
	secondBillingDims       map[string]string
	secondBillingSeconds    float64
	secondBillingModelPrice float64
	secondBillingRules      []billing_setting.VideoPriceRule
}

// The relay's secondBillingAdaptor interface is unexported, so assert against a
// local interface with the same method set. Without this, a typo'd method name
// would compile and silently drop the request back onto the legacy path.
var _ interface {
	SecondBillingRatios() (map[string]float64, error)
} = (*TaskAdaptor)(nil)

// SecondBillingRatios implements the relay's secondBillingAdaptor interface.
func (a *TaskAdaptor) SecondBillingRatios() (map[string]float64, error) {
	if a.secondBillingModel == "" {
		return nil, nil
	}
	return taskcommon.ComputeSecondBilling(
		a.secondBillingRules,
		a.secondBillingModel,
		a.secondBillingDims,
		a.secondBillingSeconds,
		a.secondBillingModelPrice,
	)
}

// hailuoResolutionLabels maps the tiers MiniMax renders onto price-table
// vocabulary. The mapping is channel-local and exact, mirroring the constants
// the model configs actually name, rather than going through the shared
// taskcommon.NormalizeResolution: MiniMax uses its own upper-case labels, and
// 512P and 768P have no counterpart in the shared vocabulary — no other channel
// serves those tiers — so folding them in would price them against another
// channel's tier. An unrecognised value refuses rather than guessing, which on
// a configured model becomes a rejected request.
var hailuoResolutionLabels = map[string]string{
	Resolution512P:  "512p",
	Resolution720P:  "720p",
	Resolution768P:  "768p",
	Resolution1080P: "1080p",
}

// resolveDimensions reports the billable characteristics of a request. It knows
// nothing about prices; the configured price table supplies those.
func resolveDimensions(resolution string, hasVideo bool) (map[string]string, bool) {
	label, ok := hailuoResolutionLabels[resolution]
	if !ok {
		return nil, false
	}
	has := "false"
	if hasVideo {
		has = "true"
	}
	return map[string]string{
		"resolution": label,
		"has_video":  has,
	}, true
}

// EstimateBilling captures the per-second billing inputs. Hailuo has no legacy
// per-second estimate to preserve — it bills purely per call today — so this
// always returns nil and all per-second pricing flows through
// SecondBillingRatios. A model absent from the price table is left exactly as
// it is today.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if info == nil {
		return nil
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	// Price the body the upstream will actually receive: convertToRequestPayload
	// applies the 6s default, resolves size to the model config's resolution
	// tier, and then lets metadata override both, so deriving the dimensions any
	// other way could bill a length or tier the upstream never renders.
	payload, err := a.convertToRequestPayload(&req, info)
	if err != nil {
		return nil
	}
	// Duration is a *int upstream: metadata can null it out or set it
	// non-positive, either of which means the length is not determinable.
	// Capture nothing rather than price off a guess, which leaves the request on
	// the per-call path exactly as today.
	if payload.Duration == nil || *payload.Duration <= 0 {
		return nil
	}

	// One snapshot per request: a second fetch could straddle a config reload
	// and judge the model "configured" against one table while pricing it
	// against another. The snapshot is shallow, so each rule's Match map is
	// shared with the live table and must stay read-only.
	rules := billing_setting.GetVideoPriceRules()
	// Keyed on info.OriginModelName — the client-facing name the administrator
	// also prices with ModelPrice, which is ComputeSecondBilling's denominator.
	// Not the upstream name: the model configs carry different default tiers, so
	// keying on the mapped name would divide one model's rate by another's price.
	if dims, ok := resolveDimensions(payload.Resolution, false); ok {
		a.secondBillingModel = info.OriginModelName
		a.secondBillingDims = dims
		a.secondBillingSeconds = float64(*payload.Duration)
		a.secondBillingModelPrice = info.PriceData.ModelPrice
		a.secondBillingRules = rules
	}
	return nil
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s%s", a.baseURL, TextToVideoEndpoint), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	v, exists := c.Get("task_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}
	req, ok := v.(relaycommon.TaskSubmitReq)
	if !ok {
		return nil, fmt.Errorf("invalid request type in context")
	}

	body, err := a.convertToRequestPayload(&req, info)
	if err != nil {
		return nil, errors.Wrap(err, "convert request payload failed")
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
	_ = resp.Body.Close()

	var hResp VideoResponse
	if err := common.Unmarshal(responseBody, &hResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if hResp.BaseResp.StatusCode != StatusSuccess {
		taskErr = service.TaskErrorWrapper(
			fmt.Errorf("hailuo api error: %s", hResp.BaseResp.StatusMsg),
			strconv.Itoa(hResp.BaseResp.StatusCode),
			http.StatusBadRequest,
		)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return hResp.TaskID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s%s?task_id=%s", baseUrl, QueryTaskEndpoint, taskID)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
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

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*VideoRequest, error) {
	modelConfig := GetModelConfig(info.UpstreamModelName)
	duration := DefaultDuration
	if req.Duration > 0 {
		duration = req.Duration
	}
	resolution := modelConfig.DefaultResolution
	if req.Size != "" {
		resolution = a.parseResolutionFromSize(req.Size, modelConfig)
	}

	videoRequest := &VideoRequest{
		Model:      info.UpstreamModelName,
		Prompt:     req.Prompt,
		Duration:   &duration,
		Resolution: resolution,
	}
	if err := req.UnmarshalMetadata(&videoRequest); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata to video request failed")
	}

	return videoRequest, nil
}

func (a *TaskAdaptor) parseResolutionFromSize(size string, modelConfig ModelConfig) string {
	switch {
	case strings.Contains(size, "1080"):
		return Resolution1080P
	case strings.Contains(size, "768"):
		return Resolution768P
	case strings.Contains(size, "720"):
		return Resolution720P
	case strings.Contains(size, "512"):
		return Resolution512P
	default:
		return modelConfig.DefaultResolution
	}
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	resTask := QueryTaskResponse{}
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{}

	if resTask.BaseResp.StatusCode == StatusSuccess {
		taskResult.Code = 0
	} else {
		taskResult.Code = resTask.BaseResp.StatusCode
		taskResult.Reason = resTask.BaseResp.StatusMsg
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
	}

	switch resTask.Status {
	case TaskStatusPreparing, TaskStatusQueueing, TaskStatusProcessing:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
		if resTask.Status == TaskStatusProcessing {
			taskResult.Progress = "50%"
		}
	case TaskStatusSuccess:
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = a.buildVideoURL(resTask.TaskID, resTask.FileID)
	case TaskStatusFailed:
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		if taskResult.Reason == "" {
			taskResult.Reason = "task failed"
		}
	default:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var hailuoResp QueryTaskResponse
	if err := common.Unmarshal(originTask.Data, &hailuoResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal hailuo task data failed")
	}

	openAIVideo := originTask.ToOpenAIVideo()
	if hailuoResp.BaseResp.StatusCode != StatusSuccess {
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: hailuoResp.BaseResp.StatusMsg,
			Code:    strconv.Itoa(hailuoResp.BaseResp.StatusCode),
		}
	}

	jsonData, err := common.Marshal(openAIVideo)
	if err != nil {
		return nil, errors.Wrap(err, "marshal openai video failed")
	}

	return jsonData, nil
}

func (a *TaskAdaptor) buildVideoURL(_, fileID string) string {
	if a.apiKey == "" || a.baseURL == "" {
		return ""
	}

	url := fmt.Sprintf("%s/v1/files/retrieve?file_id=%s", a.baseURL, fileID)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return ""
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)

	resp, err := service.GetHttpClient().Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	var retrieveResp RetrieveFileResponse
	if err := common.Unmarshal(responseBody, &retrieveResp); err != nil {
		return ""
	}

	if retrieveResp.BaseResp.StatusCode != StatusSuccess {
		return ""
	}

	return retrieveResp.File.DownloadURL
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func containsInt(slice []int, item int) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
