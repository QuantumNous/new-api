package blockrunvideo

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
)

// ============================
// Request / Response structures
// ============================

// requestPayload 是发往 api2 (BlockRun proxy) 创建接口的请求体。
// 仅包含 proxy 真正会读取并转发的字段(见对接文档):
// model / prompt / seconds / resolution / ratio / image_url。
// watermark、seed、generateAudio 等参数 proxy 不转发,故不发送。
type requestPayload struct {
	Model      string `json:"model"`
	Prompt     string `json:"prompt,omitempty"`
	Seconds    string `json:"seconds,omitempty"`
	Resolution string `json:"resolution,omitempty"`
	Ratio      string `json:"ratio,omitempty"`
	ImageURL   string `json:"image_url,omitempty"`
}

// responseTask 是创建/查询接口的响应体。
// 注意:api2 失败时 error 是【字符串】而非对象,故此处用 string。
type responseTask struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	Progress int    `json:"progress"`
	URL      string `json:"url"`
	Data     []struct {
		URL string `json:"url"`
	} `json:"data"`
	Error     string `json:"error"`
	CreatedAt int64  `json:"created_at"`
}

// ============================
// Adaptor implementation
// ============================

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

// billableSeconds reads the output length off the body the upstream will
// actually receive. This channel's length field is a STRING ("8"), so it has to
// be parsed back rather than assumed numeric — and anything that is not a
// positive whole number of seconds reports false so the caller skips capture.
//
// convertToRequestPayload renders the field only from a positive inbound
// duration and applies no default, so an omitted, zero, or negative duration
// leaves it empty and hands the length to the proxy. That length is unknowable
// here, and a guessed one would misprice the request silently.
func billableSeconds(secondsField string) (int, bool) {
	seconds, err := strconv.Atoi(strings.TrimSpace(secondsField))
	if err != nil || seconds <= 0 {
		return 0, false
	}
	return seconds, true
}

// unknowableLengthReason explains why billableSeconds refused, in terms the
// caller can act on. It is only meaningful when that function returned false.
//
// One message covers every case reachable from a real request:
// convertToRequestPayload writes the upstream field only as strconv.Itoa of a
// positive duration, so the only value billableSeconds can refuse in production
// is the empty string it leaves when no positive duration was given. The parser
// in billableSeconds still guards the malformed shapes — it is the layer that
// keeps a future change to that mapping from being priced off a bad string —
// but naming them here would be a branch no request can take.
func unknowableLengthReason() string {
	return "未提供正数 duration，上游将自行决定长度；" +
		"no positive duration was given, so the upstream picks the length"
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
	// Price the body the upstream will actually receive, which
	// convertToRequestPayload derives from the stored request.
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	payload, err := a.convertToRequestPayload(&req)
	if err != nil {
		return nil
	}

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
	// duration or tier would misprice the request silently. For an UNCONFIGURED
	// model that leaves the request on the per-call path, which is the documented
	// pre-existing behaviour. For a configured one there is no per-call price
	// left to fall back to — this channel contributes no legacy ratios at all —
	// so the request must be refused instead.
	//
	// has_video is always false: the channel accepts an input image only (there
	// is no video input field on the upstream body at all).
	seconds, secondsOK := billableSeconds(payload.Seconds)
	dims, dimsOK := resolveDimensions(payload.Resolution, false)
	switch {
	case !secondsOK && configured:
		a.secondBillingErr = taskcommon.UnpriceableDurationError(
			info.OriginModelName, unknowableLengthReason())
	case !dimsOK && configured:
		a.secondBillingErr = taskcommon.UnpriceableDimensionError(
			info.OriginModelName, "resolution", payload.Resolution)
	case secondsOK && dimsOK:
		a.secondBillingModel = info.OriginModelName
		a.secondBillingDims = dims
		a.secondBillingSeconds = float64(seconds)
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

// BuildRequestURL 创建任务: POST {baseURL}/v1/video/generations
func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/video/generations", a.baseURL), nil
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

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq) (*requestPayload, error) {
	r := requestPayload{
		Model:      req.Model,
		Prompt:     req.Prompt,
		Resolution: req.Resolution,
		Ratio:      req.Ratio,
	}

	// 时长(秒):取顶层 duration。
	if req.Duration > 0 {
		r.Seconds = strconv.Itoa(req.Duration)
	}

	// 图生视频:取第一张输入图。
	if req.HasImage() {
		r.ImageURL = req.Images[0]
	}

	return &r, nil
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

	var dResp responseTask
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	// 创建成功必须拿到 id;若上游同时回了 error/failed(如即时校验拒绝),
	// 也视为创建失败,避免白白进入轮询并占用预扣额。
	if dResp.ID == "" || dResp.Error != "" || dResp.Status == "failed" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("create task failed, body=%s", responseBody), "invalid_response", http.StatusBadGateway)
		return
	}

	// 用公开 task_xxxx ID 返回给客户端,不暴露上游 video_xxx。
	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return dResp.ID, responseBody, nil
}

// FetchTask 查询任务: GET {baseURL}/v1/video/generations/{id}
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/v1/video/generations/%s", baseUrl, taskID)
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

// ExtractUpstreamVideoURL 从持久化在 task.Data 的上游响应里解析真实视频地址
// (顶层 url,回退 data[0].url)。白标场景下客户拿到的是代理地址,真实地址只在
// 服务端由 controller.VideoProxy 用此函数取回。无法解析时返回 ""。
func ExtractUpstreamVideoURL(taskData []byte) string {
	if len(taskData) == 0 {
		return ""
	}
	var rt responseTask
	if err := common.Unmarshal(taskData, &rt); err != nil {
		return ""
	}
	return resultURL(rt)
}

// resultURL 返回上游响应里的视频地址:优先顶层 url,回退 data[0].url,无则 ""。
func resultURL(rt responseTask) string {
	if rt.URL != "" {
		return rt.URL
	}
	if len(rt.Data) > 0 {
		return rt.Data[0].URL
	}
	return ""
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var rt responseTask
	if err := common.Unmarshal(respBody, &rt); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	info := &relaycommon.TaskInfo{Code: 0}
	switch rt.Status {
	case "queued", "pending":
		info.Status = model.TaskStatusQueued
		info.Progress = "10%"
	case "in_progress", "processing", "running":
		info.Status = model.TaskStatusInProgress
		if rt.Progress > 0 && rt.Progress < 100 {
			info.Progress = fmt.Sprintf("%d%%", rt.Progress)
		} else {
			info.Progress = "50%"
		}
	case "completed", "succeeded":
		info.Status = model.TaskStatusSuccess
		info.Progress = "100%"
		info.Url = resultURL(rt)
	case "failed", "cancelled":
		info.Status = model.TaskStatusFailure
		info.Progress = "100%"
		info.Reason = rt.Error
	default:
		// 无可识别状态:若带 error(如 "task not found"),视为失败以触发结算/退款;
		// 否则保持进行中,等待下一轮轮询(api2 在 ~300s 内必达终态)。
		if rt.Error != "" {
			info.Status = model.TaskStatusFailure
			info.Progress = "100%"
			info.Reason = rt.Error
		} else {
			info.Status = model.TaskStatusInProgress
			info.Progress = "30%"
		}
	}
	return info, nil
}

// ConvertToOpenAIVideo 构造返回给客户端的视频对象。
// 白标:成功时 metadata.url 用代理地址(originTask.GetResultURL,已在轮询成功时
// 被设为 /v1/videos/{task_id}/content),绝不返回上游 blockrun.ai 真实地址;
// 失败时错误信息经 ScrubBrandedText 脱敏。
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
			Message: taskcommon.ScrubBrandedText(originTask.FailReason),
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
