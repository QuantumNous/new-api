package jimengproxy

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
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

const maxInputImages = 2

type submitPayload struct {
	Model      string   `json:"model"`
	Prompt     string   `json:"prompt"`
	Ratio      string   `json:"ratio,omitempty"`
	Resolution string   `json:"resolution,omitempty"`
	Duration   int      `json:"duration,omitempty"`
	FilePaths  []string `json:"file_paths,omitempty"`
}

type submitResponse struct {
	SubmitID string `json:"submit_id"`
	Model    string `json:"model"`
	Status   string `json:"status"`
}

type queryResponse struct {
	SubmitID string `json:"submit_id"`
	Status   string `json:"status"`
	FailCode int    `json:"fail_code"`
	Error    any    `json:"error,omitempty"`
	Message  string `json:"message,omitempty"`
	Data     []struct {
		URL string `json:"url"`
	} `json:"data"`
}

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
	// secondBillingErr records that the model IS configured for per-second
	// billing but this request cannot be priced. It must be reported rather
	// than left as absent capture: EstimateBilling returns nil for a configured
	// model, so no legacy ratio applies either, and (nil, nil) would bill the
	// bare ModelPrice with no seconds multiplier — a 30-second render charged
	// as one unit. relay_task.go rejects the request on this error, before it
	// is submitted upstream, so it costs nothing.
	secondBillingErr error
}

// The relay's secondBillingAdaptor interface is unexported, so assert against a
// local interface with the same method set. Without this, a typo'd method name
// would compile and silently drop the request back onto the legacy path.
var _ interface {
	SecondBillingRatios() (map[string]float64, error)
} = (*TaskAdaptor)(nil)

// SecondBillingRatios implements the relay's secondBillingAdaptor interface.
func (a *TaskAdaptor) SecondBillingRatios() (map[string]float64, error) {
	if a.secondBillingErr != nil {
		return nil, a.secondBillingErr
	}
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

// resolveDimensions reports the billable characteristics of a request. It knows
// nothing about prices; the configured price table supplies those. This channel
// forwards `resolution` upstream verbatim as a tier label ("720p", "1080p"),
// which NormalizeResolution passes through after folding case; a client may also
// send pixel dimensions, which it folds by short side so portrait and landscape
// of one tier price identically. An unclassifiable value refuses rather than
// guessing a tier, which on a configured model becomes a rejected request.
func resolveDimensions(resolution string, hasVideo bool) (map[string]string, bool) {
	label, ok := taskcommon.NormalizeResolution(resolution)
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

// EstimateBilling captures the per-second billing inputs. This channel bills
// purely per call today, so there is no legacy per-second estimate to preserve:
// it always returns nil and all per-second pricing flows through
// SecondBillingRatios. A model absent from the price table is left exactly as it
// is today.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	// Clear the previous request's capture: a stale Err would reject this
	// request even when it is perfectly priceable. See SecondBillingState.Reset.
	a.resetSecondBilling()
	if info == nil {
		return nil
	}
	// Price the body the upstream will actually receive. Both inbound shapes
	// (seedance content[] and the basic task request) funnel into the same
	// stored TaskSubmitReq, and convertToSubmitPayload copies duration and
	// resolution from it verbatim.
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	payload := a.convertToSubmitPayload(&req)

	// One snapshot per request: a second fetch could straddle a config reload
	// and judge the model "configured" against one table while pricing it
	// against another. The snapshot is shallow, so each rule's Match map is
	// shared with the live table and must stay read-only.
	rules := billing_setting.GetVideoPriceRules()
	// Keyed on info.OriginModelName — the client-facing name the administrator
	// also prices with ModelPrice, which is ComputeSecondBilling's denominator.
	// Not the upstream name: model mapping would otherwise divide one model's
	// per-second rate by another model's price.
	configured := billing_setting.IsVideoModelConfigured(rules, info.OriginModelName)

	// Capture only when the length and tier are actually knowable: a wrong
	// duration or tier would misprice the request silently. convertToSubmitPayload
	// forwards duration only when positive and applies no default of its own, so
	// a non-positive value means the upstream picks the length — unknowable here.
	// For an UNCONFIGURED model that leaves the request on the per-call path,
	// which is the documented pre-existing behaviour. For a configured one there
	// is no per-call price left to fall back to — this channel contributes no
	// legacy ratios at all — so the request must be refused instead.
	secondsOK := payload.Duration > 0
	dims, dimsOK := resolveDimensions(payload.Resolution, false)
	switch {
	case !secondsOK && configured:
		a.secondBillingErr = taskcommon.UnpriceableDurationError(
			info.OriginModelName,
			"未提供正数 duration，上游将自行决定长度；"+
				"no positive duration was given, so the upstream picks the length")
	case !dimsOK && configured:
		a.secondBillingErr = taskcommon.UnpriceableDimensionError(
			info.OriginModelName, "resolution", payload.Resolution)
	case secondsOK && dimsOK:
		a.secondBillingModel = info.OriginModelName
		a.secondBillingDims = dims
		a.secondBillingSeconds = float64(payload.Duration)
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

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if hasSeedanceContent(c) {
		if _, err := taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate); err != nil {
			return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
		}
		return validateAndStoreInputImages(c, info)
	}
	if taskErr := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate); taskErr != nil {
		return taskErr
	}
	return validateAndStoreInputImages(c, info)
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/videos/submit", a.baseURL), nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	body := a.convertToSubmitPayload(&req)
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

func (a *TaskAdaptor) convertToSubmitPayload(req *relaycommon.TaskSubmitReq) *submitPayload {
	p := &submitPayload{
		Model:      req.Model,
		Prompt:     req.Prompt,
		Resolution: req.Resolution,
		Ratio:      req.Ratio,
	}
	if req.Duration > 0 {
		p.Duration = req.Duration
	}
	if req.HasImage() {
		p.FilePaths = req.Images
	}
	return p
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

	var sResp submitResponse
	if err := common.Unmarshal(responseBody, &sResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrap(err, "jimengproxy submit response was invalid"), "unmarshal_response_body_failed", http.StatusBadGateway)
		return
	}

	if sResp.SubmitID == "" || strings.EqualFold(sResp.Status, "failed") {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("jimengproxy submit task failed"), "invalid_response", http.StatusBadGateway)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return sResp.SubmitID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	payload, err := common.Marshal(map[string]string{"submit_id": taskID})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/v1/videos/query", baseUrl), bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var qr queryResponse
	if err := common.Unmarshal(respBody, &qr); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	info := &relaycommon.TaskInfo{Code: 0}
	switch strings.ToLower(strings.TrimSpace(qr.Status)) {
	case "completed":
		url := resultURL(qr)
		if url == "" {
			info.Status = model.TaskStatusFailure
			info.Progress = taskcommon.ProgressComplete
			info.Reason = "jimengproxy video generation completed without result url"
			break
		}
		info.Status = model.TaskStatusSuccess
		info.Progress = taskcommon.ProgressComplete
		info.Url = url
	case "failed":
		info.Status = model.TaskStatusFailure
		info.Progress = taskcommon.ProgressComplete
		info.Reason = failReason(qr)
	case "processing":
		info.Status = model.TaskStatusInProgress
		info.Progress = "50%"
	case "":
		info.Status = model.TaskStatusFailure
		info.Progress = taskcommon.ProgressComplete
		info.Reason = failReason(qr)
	default:
		info.Status = model.TaskStatusInProgress
		info.Progress = taskcommon.ProgressInProgress
	}
	return info, nil
}

func resultURL(qr queryResponse) string {
	if len(qr.Data) == 0 {
		return ""
	}
	return strings.TrimSpace(qr.Data[0].URL)
}

func failReason(qr queryResponse) string {
	if qr.FailCode != 0 {
		return fmt.Sprintf("jimengproxy video generation failed, fail_code=%d", qr.FailCode)
	}
	if strings.TrimSpace(qr.Message) != "" || qr.Error != nil {
		return "jimengproxy video query failed"
	}
	return "jimengproxy video generation failed"
}

func hasSeedanceContent(c *gin.Context) bool {
	var raw map[string]any
	if err := common.UnmarshalBodyReusable(c, &raw); err != nil {
		return false
	}
	content, ok := raw["content"]
	if !ok {
		return false
	}
	items, ok := content.([]any)
	return ok && len(items) > 0
}

func validateAndStoreInputImages(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if err := normalizeInputImages(&req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	relaycommon.StoreTaskRequest(c, info, constant.TaskActionGenerate, req)
	return nil
}

func normalizeInputImages(req *relaycommon.TaskSubmitReq) error {
	if len(req.Images) > maxInputImages {
		return fmt.Errorf("jimengproxy supports at most %d input images", maxInputImages)
	}
	images := make([]string, 0, len(req.Images))
	for _, image := range req.Images {
		trimmed := strings.TrimSpace(image)
		if trimmed == "" {
			return fmt.Errorf("image url must not be empty")
		}
		if err := validateImageURL(trimmed); err != nil {
			return err
		}
		images = append(images, trimmed)
	}
	req.Images = images
	return nil
}

func validateImageURL(raw string) error {
	return taskcommon.ValidateRemoteMediaURL(raw)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
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
			Message: originTask.FailReason,
		}
	}

	return common.Marshal(ov)
}

// resetSecondBilling clears the per-request capture. The adaptor instance can
// outlive a request when injected for tests, so the fields must not carry over.
func (a *TaskAdaptor) resetSecondBilling() {
	a.secondBillingModel = ""
	a.secondBillingDims = nil
	a.secondBillingSeconds = 0
	a.secondBillingModelPrice = 0
	a.secondBillingRules = nil
	a.secondBillingErr = nil
}
