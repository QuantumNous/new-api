package pollo

import (
	"bytes"
	"fmt"
	"io"
	"math"
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
	"github.com/QuantumNous/new-api/types"

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

const (
	// creditTokenScale converts a Pollo credit into the integer "token" unit that the
	// generic video-billing pipeline (controller.UpdateVideoSingleTask) settles on:
	//   TotalTokens = ceil(credit * creditTokenScale)
	// The admin configures the model's ModelRatio (按量计费) so that the settlement
	//   quota = TotalTokens * ModelRatio * groupRatio
	// equals the intended charge. For "$X per credit, no markup":
	//   ModelRatio = X * QuotaPerUnit / creditTokenScale   (e.g. $0.06 -> 0.06*500000/100 = 300)
	creditTokenScale = 100.0

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

// credit returns the actual Pollo credit consumed by this task (authoritative charge).
func (r *polloStatusResponse) credit() float64 {
	return r.Data.Credit
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
// Billing
// ============================

// EstimateBilling pre-charges the user with the precise credit quote from Pollo's free
// /validate endpoint. If validate is unavailable it falls back to a rough local estimate;
// either way the authoritative final charge is settled from the actual status credit at
// completion (see ParseTaskResult + controller.UpdateVideoSingleTask).
//
// Requires the model to be configured with a ModelRatio (按量计费). In fixed-price mode
// there is no per-credit rate to settle against, so we leave the framework default hold.
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

// creditToOtherRatio turns an absolute credit charge into the multiplier the framework
// applies to the (ratio-mode) base quota, so the pre-charge equals the eventual token
// settlement: ceil(credit*scale) * ModelRatio * groupRatio. Derived from the live base
// quota (not the /2 constant) so it stays correct if the framework changes.
func creditToOtherRatio(credit float64, pd types.PriceData) float64 {
	base := float64(pd.Quota)
	if base <= 0 {
		return 0
	}
	desired := credit * creditTokenScale * pd.ModelRatio * pd.GroupRatioInfo.GroupRatio
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

// validateURL derives the free price-estimate endpoint for the model.
//
//	bytedance/seedance-2-0           -> {base}/generation/bytedance/seedance-2-0/validate
//	bytedance/seedance-2-0/ref2video -> {base}/generation/bytedance/seedance-2-0/validate
func (a *TaskAdaptor) validateURL(info *relaycommon.RelayInfo) (string, bool) {
	ep, ok := modelEndpoints[info.OriginModelName]
	if !ok {
		return "", false
	}
	p := strings.TrimSuffix(ep.path, "/ref2video")
	return fmt.Sprintf("%s/generation/%s/validate", strings.TrimRight(a.baseURL, "/"), p), true
}

// estimateCreditLocal is a rough fallback used ONLY when /validate is unavailable.
// Coefficients are empirical (measured 2026-06): credit ≈ perSec(model) × seconds × resFactor.
// It only sizes the refundable pre-charge hold; the final charge is the real status credit.
func (a *TaskAdaptor) estimateCreditLocal(c *gin.Context, info *relaycommon.RelayInfo) float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return 0
	}
	seconds := float64(taskcommon.DefaultInt(req.Duration, 5))

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
