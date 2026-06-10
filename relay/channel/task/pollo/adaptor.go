package pollo

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
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
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// Pollo AI Seedance task adaptor.
// Docs: https://docs.pollo.ai/m/seedance/seedance-2-0
//
// Auth:   header "x-api-key: <key>"
// Submit: POST {base}/generation/bytedance/<model>[/ref2video]  -> {taskId, status}
// Status: GET  {base}/generation/{taskId}/status               -> {taskId, credit, generations:[{status,url,...}]}
//
// Like Doubao (relay/channel/task/doubao), a single model name covers both the
// reference-image (ref2video) and the plain text/image-to-video shapes. The
// upstream behaves differently per shape, but the client picks the shape by what
// it sends — supplying a non-empty metadata.refs[] switches the request to the
// /ref2video endpoint (input.duration + refs); otherwise it is a standard t2v/i2v
// request (input.length + optional image). The decision is made at request time
// from the payload, never from a separate "-ref" model name.

const defaultBaseURL = "https://pollo.ai/api/platform"

const (
	// creditTokenScale converts a Pollo credit into the integer "token" unit carried
	// through the generic video-billing pipeline (controller.UpdateVideoSingleTask):
	//   TotalTokens = round(credit * creditTokenScale)
	// This is only a transport/display unit for the credit. The actual charge is settled
	// against settleModelRatio (below) — NOT the admin-configured "display" ModelRatio.
	creditTokenScale = 100.0

	// settleModelRatio is the ratio Pollo billing actually settles against, intentionally
	// DECOUPLED from the per-model "display" ModelRatio configured in the admin panel:
	//
	//   model-square price (shown to users) = displayModelRatio * 2          ($/M)
	//   actual charge                        = round(credit*creditTokenScale) * settleModelRatio * groupRatio
	//                                        = credit * (creditTokenScale*settleModelRatio) * groupRatio
	//                                        = credit * 30000 * groupRatio
	//                                        => $0.06 / credit   (30000 / QuotaPerUnit, QuotaPerUnit=500000)
	//
	// This lets the model square show dreamina-aligned prices — seedance-2-0 at 7.7$/M
	// (display ModelRatio 3.85) and seedance-2-0-fast at 5.6$/M (display ModelRatio 2.8) —
	// while the per-credit charge stays at the original $0.06/credit for BOTH models,
	// regardless of the display ratio.
	//
	// IMPORTANT: because of this decoupling, changing a model's admin ModelRatio only
	// moves its displayed price, never the charge. To actually re-price Pollo, change
	// settleModelRatio here (300 == $0.06/credit; e.g. -30% => 300*0.769 ≈ 230.7).
	settleModelRatio = 300.0

	// otherRatioKey labels the pre-charge multiplier injected by EstimateBilling.
	otherRatioKey = "pollo_credit"

	// validateTimeout bounds the /validate round-trip so it never stalls a submit.
	validateTimeout = 20 * time.Second
)

// polloValidateResponse is the reply of the free price-estimate endpoint
//
//	{"code":"SUCCESS","data":{"cost":15,"totalCost":15}}
type polloValidateResponse struct {
	Code string `json:"code"`
	Data struct {
		Cost      float64 `json:"cost"`
		TotalCost float64 `json:"totalCost"`
	} `json:"data"`
}

func (r *polloValidateResponse) credit() float64 {
	if r.Data.TotalCost > 0 {
		return r.Data.TotalCost
	}
	return r.Data.Cost
}

// refEndpointSuffix is appended to a model's base path for reference-image generation.
const refEndpointSuffix = "/ref2video"

// modelBasePaths maps a user-facing model name to its Pollo upstream base path.
// There is intentionally NO separate "-ref" model: whether a request hits the
// base path or the /ref2video variant is decided at request time from the payload
// (see isRefRequest), mirroring Doubao's single-model design.
var modelBasePaths = map[string]string{
	"seedance-2-0":      "bytedance/seedance-2-0",
	"seedance-2-0-fast": "bytedance/seedance-2-0-fast",
}

// resolveBasePath picks the Pollo base path for a request, preferring the mapped
// upstream model name (model mapping may rewrite it) and falling back to the origin
// model name. Used consistently by URL building, payload shaping, validation and
// billing so they never disagree on the model.
func resolveBasePath(info *relaycommon.RelayInfo) (string, bool) {
	if p, ok := modelBasePaths[info.UpstreamModelName]; ok {
		return p, true
	}
	if p, ok := modelBasePaths[info.OriginModelName]; ok {
		return p, true
	}
	return "", false
}

// isRefRequest reports whether a submit request carries reference images and must
// therefore use the /ref2video endpoint (input.duration + refs[]) instead of the
// standard t2v/i2v shape (input.length + optional image). Mirrors Doubao's
// hasVideoInMetadata: the request shape is detected from metadata, never from the
// model name. The signal is a non-empty metadata.refs array.
func isRefRequest(req *relaycommon.TaskSubmitReq) bool {
	if req == nil || req.Metadata == nil {
		return false
	}
	refs, ok := req.Metadata["refs"]
	if !ok {
		return false
	}
	switch v := refs.(type) {
	case []any:
		return len(v) > 0
	case []map[string]any:
		return len(v) > 0
	default:
		return false
	}
}

// ============================
// Request / Response structures
// ============================

// Numeric/bool fields use dto.IntValue / dto.BoolValue so string-typed values from
// Kling-style requests (e.g. {"duration":"5"}) are tolerated instead of hard-failing
// UnmarshalMetadata — the same tolerance the Doubao adaptor gets from its DTO types.
type polloInput struct {
	Prompt      string       `json:"prompt,omitempty"`
	Image       string       `json:"image,omitempty"`      // image2video (non-ref only)
	ImageTail   string       `json:"imageTail,omitempty"`  // optional tail frame (non-ref only)
	Resolution  string       `json:"resolution,omitempty"` // 480p | 720p | 1080p
	AspectRatio string       `json:"aspectRatio,omitempty"`
	Length      dto.IntValue `json:"length,omitempty"`   // non-ref: 4-15 seconds
	Duration    dto.IntValue `json:"duration,omitempty"` // ref:     4-15 seconds
	// Pointer so an explicit metadata.seed:0 (deterministic seed) is preserved upstream;
	// a non-pointer int+omitempty would drop the 0 and silently turn it into a random seed.
	Seed *dto.IntValue `json:"seed,omitempty"`

	GenerateAudio *dto.BoolValue `json:"generateAudio,omitempty"`
	WebSearch     *dto.BoolValue `json:"webSearch,omitempty"` // non-ref only
	VideoNum      dto.IntValue   `json:"videoNum,omitempty"`  // ref only, 1-4

	// Free-form provider-specific structures, passed through from metadata.
	Refs      []any `json:"refs,omitempty"`      // ref models: required, 1-13 items
	ImageMeta []any `json:"imageMeta,omitempty"` // ref models: optional
}

type polloRequest struct {
	Input        polloInput `json:"input"`
	WebhookUrl   string     `json:"webhookUrl,omitempty"`
	ClientSource string     `json:"clientSource,omitempty"`
}

// polloRef is one entry of Pollo's ref2video `refs` array. Pollo REQUIRES type/name/order
// plus the media field matching the type (verified live against the real API: a missing
// `name` returns HTTP 400 with a Zod "Required" error). Doubao-style content[] items map to
// ref types as: image_url(role=reference_image) -> image, video_url -> video, audio_url ->
// audio. Pollo's subject ref variant has no Doubao counterpart and is reachable only via a
// pollo-native metadata.refs passthrough.
type polloRef struct {
	Type  string `json:"type"`
	Name  string `json:"name"`
	Image string `json:"image,omitempty"`
	Video string `json:"video,omitempty"`
	Audio string `json:"audio,omitempty"`
	Order int    `json:"order"`
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
	// flat fallback (top-level credit + generations), kept symmetric so the flat shape
	// settles from real usage instead of silently falling back to the estimate.
	Credit      float64           `json:"credit"`
	Generations []polloGeneration `json:"generations"`
}

func (r *polloStatusResponse) gens() []polloGeneration {
	if len(r.Data.Generations) > 0 {
		return r.Data.Generations
	}
	return r.Generations
}

// credit returns the actual Pollo credit consumed by this task (authoritative charge),
// preferring the nested shape and falling back to the flat top-level credit.
func (r *polloStatusResponse) credit() float64 {
	if r.Data.Credit > 0 {
		return r.Data.Credit
	}
	return r.Credit
}

// failed reports whether the status envelope carries a non-success code, e.g.
// {"code":"NOT_FOUND"} / {"code":"UNAUTHORIZED"} for an invalid/expired upstream
// task or key. Such envelopes have no generations and must NOT be treated as queued.
func (r *polloStatusResponse) failed() bool {
	return r.Code != "" && r.Code != codeSuccess
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string

	// isRef records whether the current request resolved to the /ref2video shape.
	// It is set by convertToRequestPayload (called from BuildRequestBody) and read
	// by BuildRequestURL. This is safe because the adaptor is instantiated per
	// request and BuildRequestBody always runs before BuildRequestURL in the submit
	// flow (relay_task.go), so the two never disagree on ref vs non-ref.
	isRef bool
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.apiKey = info.ApiKey
	a.baseURL = taskcommon.DefaultString(info.ChannelBaseUrl, defaultBaseURL)
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	// Do NOT resolve the base path here: this runs BEFORE ModelMappedHelper, so for a
	// model-mapped channel (alias -> real model) UpstreamModelName is still the alias and
	// resolveBasePath would reject it. The model is validated post-mapping in
	// BuildRequestURL (and validateURL), which already error on an unknown model —
	// keeping model mapping fully functional for this channel.
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	base, ok := resolveBasePath(info)
	if !ok {
		return "", fmt.Errorf("unsupported pollo model: %s", info.UpstreamModelName)
	}
	path := base
	if a.isRef {
		path += refEndpointSuffix
	}
	return fmt.Sprintf("%s/generation/%s", strings.TrimRight(a.baseURL, "/"), path), nil
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

	taskInfo := &relaycommon.TaskInfo{}

	// Error envelope (e.g. {"code":"NOT_FOUND"}) — invalid/expired upstream task or key.
	// Must fail (and refund) instead of being mistaken for an empty/queued result.
	if resp.failed() {
		taskInfo.Status = model.TaskStatusFailure
		taskInfo.Progress = taskcommon.ProgressComplete
		taskInfo.Reason = taskcommon.DefaultString(resp.Message, resp.Code)
		return taskInfo, nil
	}

	gens := resp.gens()
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
		// Carry the real Pollo credit into the token field so the generic video-billing
		// pipeline settles the final charge from actual usage (multiplied by ModelRatio).
		if credit := resp.credit(); credit > 0 {
			// Round (not Ceil) — credit*scale is a clean integer for real credits;
			// Round removes float noise (e.g. 4.4*100 == 440.00000000000006).
			tokens := int(math.Round(credit * creditTokenScale))
			taskInfo.CompletionTokens = tokens
			taskInfo.TotalTokens = tokens
		}
		return taskInfo, nil
	}

	taskInfo.Status = model.TaskStatusInProgress
	taskInfo.Progress = taskcommon.ProgressInProgress
	return taskInfo, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	models := make([]string, 0, len(modelBasePaths))
	for m := range modelBasePaths {
		models = append(models, m)
	}
	return models
}

func (a *TaskAdaptor) GetChannelName() string {
	return "pollo"
}

// ============================
// Billing
// ============================

// EstimateBilling pre-charges the user with the precise credit quote from Pollo's free
// /validate endpoint. If validate is unavailable it falls back to a rough local estimate.
// The authoritative final charge is settled at completion by AdjustBillingOnComplete
// (service.settleTaskBillingOnComplete, priority #1).
//
// Requires the model to have a (display) ModelRatio configured — it gates 按量计费 mode.
// In fixed-price mode there is no per-credit rate to settle against, so we leave the
// framework default hold. The rate actually charged is the fixed settleModelRatio, not
// the display ModelRatio (see creditToOtherRatio / settleModelRatio).
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if info.PriceData.UsePrice || info.PriceData.ModelRatio <= 0 || info.PriceData.Quota <= 0 {
		return nil
	}

	credit, ok := a.fetchValidateCredit(c, info)
	if !ok || credit <= 0 {
		// validate unavailable: size a reasonable refundable hold; the real charge is
		// settled from the status credit at completion.
		credit = a.estimateCreditLocal(c, info)
	}
	if credit <= 0 {
		return nil
	}

	ratio := creditToOtherRatio(credit, info.PriceData)
	if ratio <= 0 {
		return nil
	}
	return map[string]float64{otherRatioKey: ratio}
}

// AdjustBillingOnComplete returns the authoritative final quota for a completed task,
// computed from the real Pollo credit (carried in taskResult.TotalTokens = round(credit*scale))
// and the fixed settleModelRatio: quota = round(credit*scale) * settleModelRatio * groupRatio.
// It deliberately uses settleModelRatio, NOT the snapshot's display ModelRatio, so the
// charge stays decoupled from the model-square price (see settleModelRatio doc).
//
// Returning a positive value makes service.settleTaskBillingOnComplete use this exact
// amount (priority #1) and SKIP the token-recalc fallback. That fallback would otherwise
// re-multiply the persisted OtherRatios — including the precharge-only "pollo_credit"
// ratio — and double-count it (charging credit*scale*settleModelRatio*group*pollo_credit).
func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	if task == nil || taskResult == nil || taskResult.TotalTokens <= 0 {
		return 0
	}
	bc := task.PrivateData.BillingContext
	if bc == nil || bc.ModelRatio <= 0 {
		return 0 // not ratio-mode credit billing; let the framework keep the pre-charge
	}
	// Preserve an explicit zero group ratio: a task submitted from a free group
	// (ratio 0) was pre-charged 0, so it must settle to 0 — never coerce 0 -> 1,
	// which would charge the user for a free task. A negative ratio is an invalid
	// snapshot, so we bail and let the framework keep the pre-charge.
	groupRatio := bc.GroupRatio
	if groupRatio < 0 {
		return 0
	}
	return int(math.Round(float64(taskResult.TotalTokens) * settleModelRatio * groupRatio))
}

// creditToOtherRatio turns an absolute credit charge into the multiplier the framework
// applies to the (ratio-mode) base quota, so the pre-charge equals the eventual token
// settlement: round(credit*scale) * settleModelRatio * groupRatio. Uses settleModelRatio
// (not pd.ModelRatio) so the pre-charge matches the decoupled final charge. Derived from
// the live base quota (not the /2 constant) so it stays correct if the framework changes.
func creditToOtherRatio(credit float64, pd types.PriceData) float64 {
	base := float64(pd.Quota)
	if base <= 0 {
		return 0
	}
	desired := credit * creditTokenScale * settleModelRatio * pd.GroupRatioInfo.GroupRatio
	return desired / base
}

// fetchValidateCredit calls Pollo's free /validate endpoint and returns the quoted credit.
func (a *TaskAdaptor) fetchValidateCredit(c *gin.Context, info *relaycommon.RelayInfo) (float64, bool) {
	url, ok := a.validateURL(info)
	if !ok {
		return 0, false
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return 0, false
	}
	body, err := a.convertToRequestPayload(&req, info)
	if err != nil {
		return 0, false
	}
	data, err := common.Marshal(body)
	if err != nil {
		return 0, false
	}

	httpReq, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return 0, false
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("x-api-key", a.apiKey)

	client := &http.Client{Timeout: validateTimeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		return 0, false
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, false
	}

	var vResp polloValidateResponse
	if err := common.Unmarshal(respBody, &vResp); err != nil {
		return 0, false
	}
	if vResp.Code != "" && vResp.Code != codeSuccess {
		return 0, false
	}
	credit := vResp.credit()
	return credit, credit > 0
}

// validateURL derives the free price-estimate endpoint for the model. Both the
// standard and the ref2video shapes price against the same base /validate endpoint:
//
//	seedance-2-0 (t2v/i2v or ref2video) -> {base}/generation/bytedance/seedance-2-0/validate
func (a *TaskAdaptor) validateURL(info *relaycommon.RelayInfo) (string, bool) {
	base, ok := resolveBasePath(info)
	if !ok {
		return "", false
	}
	return fmt.Sprintf("%s/generation/%s/validate", strings.TrimRight(a.baseURL, "/"), base), true
}

// estimateCreditLocal is a rough fallback used ONLY when /validate is unavailable.
// Coefficients are empirical (measured 2026-06): credit ≈ perSec(model) × seconds × resFactor.
// It only sizes the refundable pre-charge hold; the final charge is the real status credit.
func (a *TaskAdaptor) estimateCreditLocal(c *gin.Context, info *relaycommon.RelayInfo) float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return 0
	}
	seconds := float64(resolveSeconds(&req))

	resolution := "720p"
	if r, ok := req.Metadata["resolution"].(string); ok && r != "" {
		resolution = r
	}

	perSec := 3.0 // standard @720p
	if strings.Contains(info.OriginModelName, "fast") {
		perSec = 2.4
	}
	resFactor := 1.0 // 720p
	switch resolution {
	case "480p":
		resFactor = 0.47
	case "1080p":
		resFactor = 2.43
	}
	return perSec * seconds * resFactor
}

// ============================
// helpers
// ============================

// resolveSeconds resolves the requested video duration with Seconds-first precedence,
// mirroring the canonical pattern in relay/common/relay_utils.go:136-139 and every sibling
// video adaptor. OpenAI-compatible clients send the duration in the string `seconds` field
// (dto.OpenAIVideo.Seconds), which the JSON submit path captures into req.Seconds but never
// folds into req.Duration (that fold only happens on the multipart path). Without this,
// taskcommon.DefaultInt(req.Duration, 5) silently builds and prices a 5s clip for an
// 8/10/15-second `seconds` request.
func resolveSeconds(req *relaycommon.TaskSubmitReq) int {
	if s, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil && s > 0 {
		return s
	}
	if req.Duration > 0 {
		return req.Duration
	}
	// Doubao-style clients may carry the duration only in metadata.duration (the same key
	// Doubao reads). Honor it before the default; top-level seconds/duration above still win.
	if d, ok := metaInt(req.Metadata, "duration"); ok && d > 0 {
		return d
	}
	// Doubao/Jimeng-style frame counts (frames = 24*seconds + 1, e.g. 121 -> 5s, 241 -> 10s).
	// Doubao forwards `frames` natively; Pollo has no frames param, so convert to seconds.
	if f, ok := metaInt(req.Metadata, "frames"); ok && f > 24 {
		return int(math.Round(float64(f-1) / 24.0))
	}
	return taskcommon.DefaultInt(req.Duration, 5)
}

// metadataKeyAliases maps Doubao/Kling/Jimeng-style snake_case keys onto the pollo-native
// camelCase fields so the same request body drives both the Doubao and Pollo channels.
// The native key always wins when both are present; alias keys are left in place (they are
// unknown to polloInput and ignored by the JSON overlay).
var metadataKeyAliases = map[string]string{
	"generate_audio": "generateAudio",
	"web_search":     "webSearch",
	"video_num":      "videoNum",
	"aspect_ratio":   "aspectRatio", // Kling / Jimeng
	"image_tail":     "imageTail",   // Kling
	"image_meta":     "imageMeta",
}

func normalizeMetadataAliases(metadata map[string]any) {
	if metadata == nil {
		return
	}
	for alias, native := range metadataKeyAliases {
		if _, exists := metadata[native]; exists {
			continue
		}
		if v, ok := metadata[alias]; ok {
			metadata[native] = v
		}
	}
}

// metaWebSearchFromTools reads the Doubao tools contract ([{"type":"web_search"}]) and
// reports whether web search is requested.
func metaWebSearchFromTools(metadata map[string]any) bool {
	if metadata == nil {
		return false
	}
	tools, ok := metadata["tools"].([]any)
	if !ok {
		return false
	}
	for _, t := range tools {
		if m, ok := t.(map[string]any); ok && m["type"] == "web_search" {
			return true
		}
	}
	return false
}

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*polloRequest, error) {
	input := polloInput{
		Prompt:     req.Prompt,
		Resolution: "720p",
		// Seed left nil: absent => omitted (provider picks random); a client-supplied
		// metadata.seed (including 0) is applied below by UnmarshalMetadata.
	}

	// 0) Fold Doubao/Kling/Jimeng-style snake_case keys onto the pollo-native camelCase
	//    fields (generate_audio, aspect_ratio, image_tail, ...). Native keys win.
	normalizeMetadataAliases(req.Metadata)

	// 1) Overlay pollo-native fields from metadata (resolution, aspectRatio, length, duration,
	//    seed, generateAudio, webSearch, videoNum, refs, imageMeta, image, imageTail...). This
	//    preserves the original pollo-native request shape; the Doubao-style content[] inputs
	//    below take precedence over anything overlaid here.
	if err := taskcommon.UnmarshalMetadata(req.Metadata, &input); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}

	// The prompt is always the top-level req.Prompt, mirroring Doubao (which rejects all
	// metadata text items and appends req.Prompt as the only text content).
	input.Prompt = req.Prompt

	// Doubao tools contract ([{"type":"web_search"}]) -> pollo webSearch flag.
	if input.WebSearch == nil && metaWebSearchFromTools(req.Metadata) {
		ws := dto.BoolValue(true)
		input.WebSearch = &ws
	}

	// 2) Doubao-compatible media inputs: parse metadata.content[] items by type/role so a
	//    single client request works on both the Doubao and Pollo channels. Mappings:
	//    image_url first_frame|absent -> input.image, last_frame -> input.imageTail,
	//    reference_image -> refs[{type:image}]; video_url -> refs[{type:video}];
	//    audio_url -> refs[{type:audio}] (refs route to /ref2video). Mirrors the Doubao
	//    adaptor's content[] contract (see doubao/adaptor.go convertToRequestPayload).
	media := extractRoleMedia(req.Metadata)
	// Top-level images[]/image (no role) fall back to first/last frame, matching Doubao's
	// req.Images handling (Doubao forwards every entry; Pollo's i2v shape carries at most a
	// first frame + tail frame). Jimeng-style image_urls[] is the final fallback.
	if media.firstFrame == "" {
		if req.Image != "" {
			media.firstFrame = req.Image
		} else if len(req.Images) > 0 {
			media.firstFrame = req.Images[0]
		} else if urls := metaStringSlice(req.Metadata, "image_urls"); len(urls) > 0 {
			media.firstFrame = urls[0]
		}
	}
	if media.lastFrame == "" {
		if len(req.Images) > 1 {
			media.lastFrame = req.Images[1]
		} else if urls := metaStringSlice(req.Metadata, "image_urls"); len(urls) > 1 {
			media.lastFrame = urls[1]
		}
	}
	if media.firstFrame != "" {
		input.Image = media.firstFrame
	}
	if media.lastFrame != "" {
		input.ImageTail = media.lastFrame
	}
	if refs := media.buildRefs(); len(refs) > 0 {
		// Build Pollo's ref schema {type, name, image|video|audio, order}. name is REQUIRED
		// by Pollo (verified live: omitting it => HTTP 400), so auto-assign ref1/ref2/...;
		// order is 1-based. Overrides any metadata.refs overlaid in step 1 so content[] wins.
		input.Refs = refs
	}

	// 3) Reference mode iff we ended up with refs (from content[] reference media OR a
	//    pollo-native metadata.refs). BuildRequestURL keys off a.isRef to pick /ref2video.
	a.isRef = len(input.Refs) > 0

	// 4) Duration field differs by endpoint: ref2video uses input.duration, t2v/i2v uses
	//    input.length. Seconds-first precedence (resolveSeconds).
	seconds := resolveSeconds(req)
	if a.isRef {
		input.Duration = dto.IntValue(seconds)
		input.Length = 0
		// ref2video carries refs only — no first/last-frame image fields.
		input.Image = ""
		input.ImageTail = ""
		// aspectRatio is REQUIRED by Pollo's ref2video schema (verified live). Accept Doubao's
		// `ratio` alias and fall back to a default so a Doubao-style request (which omits the
		// pollo-native aspectRatio) is not rejected upstream.
		if input.AspectRatio == "" {
			if r, ok := metaString(req.Metadata, "ratio"); ok {
				input.AspectRatio = r
			} else {
				input.AspectRatio = "16:9"
			}
		}
		// Doubao's generate_audio defaults to false; Pollo's ref2video defaults to true.
		// Pin the Doubao default when the client did not opt in, so the same request yields
		// the same output (and credit cost) on both channels.
		if input.GenerateAudio == nil {
			ga := dto.BoolValue(false)
			input.GenerateAudio = &ga
		}
	} else {
		input.Length = dto.IntValue(seconds)
		input.Duration = 0
		// Accept Doubao's `ratio` alias for the i2v/t2v shape too (optional here).
		if input.AspectRatio == "" {
			if r, ok := metaString(req.Metadata, "ratio"); ok {
				input.AspectRatio = r
			}
		}
	}

	preq := &polloRequest{Input: input}
	// Doubao's callback_url -> Pollo webhookUrl (pollo-native keys win). NOTE: the webhook
	// payload format is Pollo's, not Doubao's — only the address parameter is mapped.
	for _, key := range []string{"webhookUrl", "webhook_url", "callback_url"} {
		if cb, ok := metaString(req.Metadata, key); ok {
			preq.WebhookUrl = cb
			break
		}
	}
	return preq, nil
}

// roleMedia holds Doubao-style content[] media bucketed by type/role.
type roleMedia struct {
	firstFrame string
	lastFrame  string
	references []string // image_url role=reference_image -> refs[{type:image}]
	videos     []string // video_url -> refs[{type:video}]
	audios     []string // audio_url -> refs[{type:audio}]
}

// buildRefs renders the bucketed reference media into Pollo's ref2video refs schema with
// auto-assigned names (ref1, ref2, ...) and 1-based order, images first, then videos and
// audios — matching the content[] declaration order within each type.
func (rm roleMedia) buildRefs() []any {
	total := len(rm.references) + len(rm.videos) + len(rm.audios)
	if total == 0 {
		return nil
	}
	refs := make([]any, 0, total)
	order := 1
	add := func(r polloRef) {
		r.Name = fmt.Sprintf("ref%d", order)
		r.Order = order
		refs = append(refs, r)
		order++
	}
	for _, url := range rm.references {
		add(polloRef{Type: "image", Image: url})
	}
	for _, url := range rm.videos {
		add(polloRef{Type: "video", Video: url})
	}
	for _, url := range rm.audios {
		add(polloRef{Type: "audio", Audio: url})
	}
	return refs
}

// extractRoleMedia parses Doubao-style metadata.content[] items, bucketing each by type and
// role: image_url "last_frame" -> tail frame, image_url "reference_image" -> image reference
// list, any other image_url (incl. "first_frame" / absent) -> first frame; video_url -> video
// reference list; audio_url -> audio reference list. Mirrors the Doubao content contract so
// the same client request drives both channels. Text items are ignored (prompt comes from the
// top-level field, as on Doubao).
func extractRoleMedia(metadata map[string]any) roleMedia {
	var rm roleMedia
	if metadata == nil {
		return rm
	}
	raw, ok := metadata["content"]
	if !ok {
		return rm
	}
	items, ok := raw.([]any)
	if !ok {
		return rm
	}
	for _, it := range items {
		m, ok := it.(map[string]any)
		if !ok {
			continue
		}
		switch t, _ := m["type"].(string); t {
		case "image_url":
			url := mediaURLFromItem(m, "image_url")
			if url == "" {
				continue
			}
			switch role, _ := m["role"].(string); role {
			case "last_frame":
				if rm.lastFrame == "" {
					rm.lastFrame = url
				}
			case "reference_image":
				rm.references = append(rm.references, url)
			default: // "first_frame" or absent
				if rm.firstFrame == "" {
					rm.firstFrame = url
				}
			}
		case "video_url":
			if url := mediaURLFromItem(m, "video_url"); url != "" {
				rm.videos = append(rm.videos, url)
			}
		case "audio_url":
			if url := mediaURLFromItem(m, "audio_url"); url != "" {
				rm.audios = append(rm.audios, url)
			}
		}
	}
	return rm
}

// mediaURLFromItem pulls the URL out of a content item's media field, tolerating both the
// canonical object form {"image_url":{"url":"..."}} and a bare string {"image_url":"..."}.
func mediaURLFromItem(m map[string]any, key string) string {
	switch v := m[key].(type) {
	case map[string]any:
		s, _ := v["url"].(string)
		return s
	case string:
		return v
	default:
		return ""
	}
}

// metaStringSlice returns a []string metadata value (e.g. Jimeng's image_urls), tolerating
// the JSON []any form.
func metaStringSlice(metadata map[string]any, key string) []string {
	if metadata == nil {
		return nil
	}
	switch v := metadata[key].(type) {
	case []string:
		return v
	case []any:
		out := make([]string, 0, len(v))
		for _, it := range v {
			if s, ok := it.(string); ok && s != "" {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}

// metaString returns a non-empty string value for key in metadata.
func metaString(metadata map[string]any, key string) (string, bool) {
	if metadata == nil {
		return "", false
	}
	if s, ok := metadata[key].(string); ok && s != "" {
		return s, true
	}
	return "", false
}

// metaInt returns an int metadata value, tolerating JSON's float64 numbers, native ints, and
// numeric strings.
func metaInt(metadata map[string]any, key string) (int, bool) {
	if metadata == nil {
		return 0, false
	}
	switch v := metadata[key].(type) {
	case float64:
		return int(v), true
	case int:
		return v, true
	case int64:
		return int(v), true
	case string:
		if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
			return n, true
		}
	}
	return 0, false
}

// ConvertToOpenAIVideo renders a stored task into the OpenAI video API response shape.
// Field population mirrors the Doubao adaptor's ConvertToOpenAIVideo exactly (created_at,
// completed_at, model, and an always-present metadata.url) so clients polling
// GET /v1/videos/{id} see the same response shape on either channel.
func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	ov := dto.NewOpenAIVideo()
	ov.ID = originTask.TaskID
	ov.TaskID = originTask.TaskID
	ov.Status = originTask.Status.ToVideoStatus()
	ov.SetProgressStr(originTask.Progress)
	ov.CreatedAt = originTask.CreatedAt
	ov.CompletedAt = originTask.UpdatedAt
	ov.Model = originTask.Properties.OriginModelName

	videoURL := ""
	var upstreamCode string
	if len(originTask.Data) > 0 {
		var resp polloStatusResponse
		if err := common.Unmarshal(originTask.Data, &resp); err == nil {
			for _, g := range resp.gens() {
				if g.Url != "" {
					videoURL = g.Url
					break
				}
			}
			if resp.failed() {
				upstreamCode = resp.Code
			}
		}
	}
	ov.SetMetadata("url", videoURL)

	if originTask.Status == model.TaskStatusFailure {
		ov.Error = &dto.OpenAIVideoError{
			Message: originTask.FailReason,
			Code:    upstreamCode,
		}
	}
	return common.Marshal(ov)
}
