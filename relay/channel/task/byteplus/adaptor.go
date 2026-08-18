package byteplus

import (
	"bytes"
	"encoding/json"
	"errors"
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
	"github.com/QuantumNous/new-api/relay/channel/task/doubao"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/gin-gonic/gin"
)

const moderationSceneHeader = "x-ark-moderation-scene"
const moderationSceneSkip = "skip-ark-moderation"

const (
	bytePlusAssetSubmitLeaseDefaultSeconds = int64(72 * 60 * 60)
	bytePlusAssetSubmitLeaseMaxSeconds     = int64(259200)
)

var bytePlusAssetLeaseNow = func() int64 { return time.Now().Unix() }

// TaskAdaptor reuses BytePlus Ark's protocol-compatible Seedance implementation
// while keeping BytePlus routing and server-controlled headers isolated from the
// existing Doubao and VolcEngine channels.
type TaskAdaptor struct {
	doubao.TaskAdaptor

	// Per-second billing state, captured during EstimateBilling so that
	// SecondBillingRatios can report a pricing failure to the relay path.
	//
	// These shadow the embedded Doubao adaptor's identically-purposed fields
	// deliberately. This adaptor overrides EstimateBilling, so Doubao's fields
	// are never populated on a BytePlus request; without its own state the
	// promoted SecondBillingRatios would compile, always return (nil, nil), and
	// silently leave every request on the legacy token-settled path.
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
	//
	// Like the fields above, this shadows Doubao's deliberately.
	secondBillingErr error
}

// The relay's secondBillingAdaptor interface is unexported, so assert against a
// local interface with the same method set. Without this, a typo'd method name
// would compile and silently drop the request back onto the legacy path.
var _ interface {
	SecondBillingRatios() (map[string]float64, error)
} = (*TaskAdaptor)(nil)

// SecondBillingRatios implements the relay's secondBillingAdaptor interface.
// It must be defined here rather than inherited: the promoted Doubao method
// closes over Doubao's fields, which this adaptor's EstimateBilling never sets.
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

// ValidateTaskPriceData refuses a per-second-configured model that is not priced
// with a positive, finite fixed ModelPrice.
//
// This channel used to settle every completed task from upstream total_tokens.
// That recalculation is skipped only when the task is marked PerCallBilling,
// which controller/relay.go derives from PriceData.UsePrice — true exactly when
// a ModelPrice entry resolved. So a model configured for per-second billing but
// priced by ModelRatio would reserve per-second and then be re-priced from
// tokens at completion, silently contradicting the reservation the customer was
// quoted. Fail before submission instead. ComputeSecondBilling additionally
// divides by ModelPrice, so a non-positive one could not be priced at all.
//
// Models absent from the price table are untouched: they still need ModelRatio
// and UsePrice=false for token settlement to work.
func (a *TaskAdaptor) ValidateTaskPriceData(info *relaycommon.RelayInfo) *dto.TaskError {
	if info == nil {
		return service.TaskErrorWrapperLocal(errors.New("missing byteplus relay info"), "model_price_error", http.StatusBadRequest)
	}
	if !billing_setting.IsVideoModelConfigured(billing_setting.GetVideoPriceRules(), info.OriginModelName) {
		return nil
	}
	if !info.PriceData.UsePrice || !isPositiveFinite(info.PriceData.ModelPrice) {
		return service.TaskErrorWrapperLocal(
			errors.New("model price must be a positive finite fixed price"),
			"model_price_error", http.StatusBadRequest)
	}
	return nil
}

func isPositiveFinite(v float64) bool {
	return v > 0 && !math.IsNaN(v) && !math.IsInf(v, 0)
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.TaskAdaptor.Init(info)
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	// Clear the previous request's capture: a stale Err would reject this
	// request even when it is perfectly priceable. See SecondBillingState.Reset.
	a.resetSecondBilling()
	seedReq, err := taskcommon.GetSeedanceRequest(c)
	if err != nil {
		return nil
	}
	// priceModelName is the client-facing name the administrator prices, and
	// the only name the per-second table is keyed on. It is deliberately NOT
	// the legacy path's seedReq.Model fallback below: ValidateTaskPriceData
	// keys on OriginModelName, so falling back here would price a request the
	// fixed-price guard never checked, dividing the configured rate by a
	// ModelPrice resolved for a different name.
	priceModelName := strings.TrimSpace(info.OriginModelName)
	modelName := priceModelName
	if modelName == "" {
		modelName = seedReq.Model
	}
	// Ark defaults an omitted resolution to the 720p tier. Naming it explicitly
	// is behaviour-preserving for getVideoInputRatio — which buckets "" and
	// "720p" into the same base-tier key — and lets the configured price table
	// match a rule on the tier actually rendered.
	resolution := seedReq.Resolution
	if strings.TrimSpace(resolution) == "" {
		resolution = "720p"
	}
	hasVideo := len(seedReq.Videos()) > 0

	// One snapshot per request: a second fetch could straddle a config reload
	// and judge the model "configured" against one table while pricing it
	// against another. The snapshot is shallow, so each rule's Match map is
	// shared with the live table and must stay read-only.
	rules := billing_setting.GetVideoPriceRules()
	configured := billing_setting.IsVideoModelConfigured(rules, priceModelName)
	// Task model mapping rewrites info.UpstreamModelName to a private ep-*
	// endpoint, which must never reach pricing.
	//
	// Capture only when the length is actually knowable: a wrong duration would
	// misprice the request silently. For an UNCONFIGURED model that leaves it
	// on the legacy token-settled path, which is the documented previous
	// behaviour. For a configured one there is no legacy path to fall back to —
	// the early return below skips it — so the request must be refused instead.
	seconds, secondsOK := taskcommon.SeedanceBillableSeconds(seedReq)
	dims, dimsOK := resolveDimensions(resolution, hasVideo)
	switch {
	case !secondsOK && configured:
		a.secondBillingErr = taskcommon.UnpriceableDurationError(
			priceModelName, taskcommon.SeedanceUnknowableLengthReason(seedReq))
	case !dimsOK && configured:
		a.secondBillingErr = taskcommon.UnpriceableDimensionError(
			priceModelName, "resolution", resolution)
	case secondsOK && dimsOK:
		a.secondBillingModel = priceModelName
		a.secondBillingDims = dims
		a.secondBillingSeconds = seconds
		a.secondBillingModelPrice = info.PriceData.ModelPrice
		a.secondBillingRules = rules
	}
	// A model in the price table is priced by SecondBillingRatios; returning
	// nil here keeps the legacy video_input ratio from also applying.
	if configured {
		return nil
	}

	ratio, ok := getVideoInputRatio(modelName, seedReq.Resolution, hasVideo)
	if !ok || ratio == 1.0 {
		return nil
	}
	return map[string]float64{"video_input": ratio}
}

// resolveDimensions reports the billable characteristics of a request. It knows
// nothing about prices; the configured price table supplies those. BytePlus
// serves 480p/720p/1080p/4K, all of which NormalizeResolution classifies.
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

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	if info == nil {
		return errors.New("missing byteplus relay info")
	}
	creds, err := service.ParseBytePlusCredentials(info.ApiKey)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+creds.APIKey)
	req.Header.Set(moderationSceneHeader, moderationSceneSkip)
	return nil
}

// DoRequest must dispatch with the BytePlus receiver. Calling the embedded
// Doubao method would bind the helper to *doubao.TaskAdaptor and bypass this
// adapter's fixed moderation header.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	body, err := a.TaskAdaptor.BuildRequestBodyWithoutAssetRewrite(c, info)
	if err != nil {
		return nil, err
	}
	raw, err := io.ReadAll(body)
	if err != nil {
		return nil, err
	}
	rewriteMap, hasGeneralized := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
	if !hasGeneralized {
		rewriteMap, _ = common.GetContextKeyType[map[string]string](c, constant.ContextKeyBytePlusAssetRewriteMap)
		if err := extendBytePlusAssetLeasesBeforeSubmit(c, raw, rewriteMap); err != nil {
			return nil, err
		}
	}
	rewritten, err := rewriteBytePlusAssetReferences(raw, rewriteMap)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(rewritten), nil
}

func extendBytePlusAssetLeasesBeforeSubmit(c *gin.Context, raw []byte, rewriteMap map[string]string) error {
	publicIDs, err := bytePlusLocalAssetReferencesInRequest(raw, rewriteMap)
	if err != nil || len(publicIDs) == 0 {
		return err
	}
	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	if userID == 0 {
		return nil
	}
	now := bytePlusAssetLeaseNow()
	_, err = model.ExtendBytePlusAssetLeasesForSubmit(userID, publicIDs, now+bytePlusAssetSubmitLeaseSeconds(raw), now)
	if err != nil {
		return fmt.Errorf("invalid byteplus asset reference")
	}
	return nil
}

func bytePlusAssetSubmitLeaseSeconds(raw []byte) int64 {
	seconds := bytePlusAssetSubmitLeaseDefaultSeconds
	var payload struct {
		ExecutionExpiresAfter *int `json:"execution_expires_after"`
	}
	if err := common.Unmarshal(raw, &payload); err == nil && payload.ExecutionExpiresAfter != nil {
		requested := int64(*payload.ExecutionExpiresAfter)
		if requested > seconds {
			seconds = requested
		}
	}
	if seconds > bytePlusAssetSubmitLeaseMaxSeconds {
		return bytePlusAssetSubmitLeaseMaxSeconds
	}
	return seconds
}

func bytePlusLocalAssetReferencesInRequest(raw []byte, rewriteMap map[string]string) ([]string, error) {
	if !bytes.Contains(bytes.ToLower(raw), []byte("asset:")) {
		return nil, nil
	}
	var payload map[string]any
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&payload); err != nil {
		return nil, err
	}
	content, ok := payload["content"].([]any)
	if !ok {
		return nil, nil
	}
	seen := map[string]struct{}{}
	var publicIDs []string
	for _, itemAny := range content {
		item, ok := itemAny.(map[string]any)
		if !ok {
			continue
		}
		for _, field := range []string{"image_url", "video_url", "audio_url"} {
			media, ok := item[field].(map[string]any)
			if !ok {
				continue
			}
			urlValue, ok := media["url"].(string)
			if !ok || !isBytePlusAssetSchemeURL(urlValue) {
				continue
			}
			if !service.IsStrictBytePlusAssetURI(urlValue) {
				return nil, fmt.Errorf("invalid byteplus asset reference")
			}
			if _, ok := rewriteMap[urlValue]; !ok {
				return nil, fmt.Errorf("invalid byteplus asset reference")
			}
			publicID := strings.TrimPrefix(urlValue, "asset://")
			if _, ok := seen[publicID]; ok {
				continue
			}
			seen[publicID] = struct{}{}
			publicIDs = append(publicIDs, publicID)
		}
	}
	return publicIDs, nil
}

func rewriteBytePlusAssetReferences(raw []byte, rewriteMap map[string]string) ([]byte, error) {
	if !bytes.Contains(bytes.ToLower(raw), []byte("asset:")) {
		return raw, nil
	}
	var payload map[string]json.RawMessage
	if err := common.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	contentRaw, ok := payload["content"]
	if !ok {
		return raw, nil
	}
	var content []map[string]json.RawMessage
	if err := common.Unmarshal(contentRaw, &content); err != nil {
		return raw, nil
	}
	rewritten := false
	for itemIdx, item := range content {
		for _, field := range []string{"image_url", "video_url", "audio_url"} {
			mediaRaw, ok := item[field]
			if !ok {
				continue
			}
			var media map[string]json.RawMessage
			if err := common.Unmarshal(mediaRaw, &media); err != nil {
				continue
			}
			var urlValue string
			if err := common.Unmarshal(media["url"], &urlValue); err != nil || !isBytePlusAssetSchemeURL(urlValue) {
				continue
			}
			if !service.IsStrictBytePlusAssetURI(urlValue) {
				return nil, fmt.Errorf("invalid byteplus asset reference")
			}
			upstreamURL, ok := rewriteMap[urlValue]
			if !ok || strings.TrimSpace(upstreamURL) == "" {
				return nil, fmt.Errorf("invalid byteplus asset reference")
			}
			urlRaw, err := common.Marshal(upstreamURL)
			if err != nil {
				return nil, err
			}
			media["url"] = urlRaw
			updatedMedia, err := common.Marshal(media)
			if err != nil {
				return nil, err
			}
			content[itemIdx][field] = updatedMedia
			rewritten = true
		}
	}
	if !rewritten {
		return raw, nil
	}
	contentBytes, err := common.Marshal(content)
	if err != nil {
		return nil, err
	}
	payload["content"] = contentBytes
	return common.Marshal(payload)
}

func isBytePlusAssetSchemeURL(raw string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(raw)), "asset:")
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	creds, err := service.ParseBytePlusCredentials(key)
	if err != nil {
		return nil, err
	}
	return a.TaskAdaptor.FetchTask(baseUrl, creds.APIKey, body, proxy)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var submitResp struct {
		ID string `json:"id"`
	}
	if err := common.Unmarshal(responseBody, &submitResp); err != nil {
		return "", nil, service.TaskErrorWrapperLocal(
			errors.New("invalid upstream submit response"),
			"unmarshal_response_body_failed",
			http.StatusBadGateway,
		)
	}
	if submitResp.ID == "" {
		return "", nil, service.TaskErrorWrapperLocal(
			errors.New("invalid upstream submit response"),
			"invalid_response",
			http.StatusBadGateway,
		)
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return submitResp.ID, responseBody, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	info, err := a.TaskAdaptor.ParseTaskResult(respBody)
	if err != nil || info == nil {
		return info, err
	}
	info.Reason = taskcommon.ScrubBrandedText(info.Reason)
	return info, nil
}

func ExtractUpstreamVideoURL(taskData []byte) string {
	if len(taskData) == 0 {
		return ""
	}
	var response struct {
		Content struct {
			VideoURL string `json:"video_url"`
		} `json:"content"`
	}
	if err := common.Unmarshal(taskData, &response); err != nil {
		return ""
	}
	return response.Content.VideoURL
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	video := dto.NewOpenAIVideo()
	video.ID = originTask.TaskID
	video.TaskID = originTask.TaskID
	video.Status = originTask.Status.ToVideoStatus()
	video.SetProgressStr(originTask.Progress)
	video.CreatedAt = originTask.CreatedAt
	video.CompletedAt = originTask.UpdatedAt
	video.Model = originTask.Properties.OriginModelName

	if originTask.Status == model.TaskStatusSuccess {
		video.SetMetadata("url", originTask.GetResultURL())
	}
	if originTask.Status == model.TaskStatusFailure {
		video.Error = &dto.OpenAIVideoError{
			Message: taskcommon.ScrubBrandedText(originTask.FailReason),
		}
	}
	return common.Marshal(video)
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
