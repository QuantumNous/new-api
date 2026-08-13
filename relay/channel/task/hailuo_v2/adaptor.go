package hailuov2

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

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
)

const (
	ModelName                = "MiniMax-H3"
	ChannelName              = "minimax-h3-video"
	requestContextKey        = "hailuo_v2_request"
	createEndpoint           = "/v2/video_generation"
	queryEndpoint            = "/v2/query/video_generation/"
	minVideoDuration         = 4
	maxVideoDuration         = 15
	maxTextCharacters        = 7000
	maxReferenceImages       = 9
	maxReferenceVideos       = 3
	maxReferenceAudios       = 3
	maxReferenceInputSeconds = 15
	freeInputImages          = 5
	extraImagePriceUSD       = 0.04
	resolution2KMultiplier   = 1.625
	billingUnitsKey          = "billable_units"
	billingRegionIntlKey     = "h3_region_intl"
	billingResolution768PKey = "h3_resolution_768p"
	billingResolution2KKey   = "h3_resolution_2k"
)

var supportedRatios = map[string]struct{}{
	"adaptive": {},
	"21:9":     {},
	"16:9":     {},
	"4:3":      {},
	"1:1":      {},
	"3:4":      {},
	"9:16":     {},
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey  string
	baseURL string

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

var _ channel.TaskAdaptor = (*TaskAdaptor)(nil)
var _ channel.OpenAIVideoConverter = (*TaskAdaptor)(nil)

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

// hailuoResolutionLabels maps the two tiers MiniMax H3 renders onto price-table
// vocabulary. Neither belongs to the shared taskcommon.NormalizeResolution set:
// no other channel serves a 768-line tier, and "2K" is MiniMax's own label for
// a tier below the shared 4k/2160p one, so folding it into that vocabulary
// would price it against another channel's tier. The mapping is therefore
// channel-local and exact — mirroring isSupportedResolution, which is what the
// inbound validator accepts — so an unrecognised value refuses rather than
// guessing a tier.
var hailuoResolutionLabels = map[string]string{
	"768P": "768p",
	"2K":   "2k",
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

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.apiKey = info.ApiKey
	a.baseURL = normalizeBaseURL(info.ChannelBaseUrl)
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return a.validateAndStoreRequest(c, info)
}

func (a *TaskAdaptor) ValidateRequestAfterModelMapping(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return a.validateAndStoreRequest(c, info)
}

func (a *TaskAdaptor) validateAndStoreRequest(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if info == nil || info.ChannelMeta == nil || info.UpstreamModelName != ModelName {
		modelName := ""
		if info != nil && info.ChannelMeta != nil {
			modelName = info.UpstreamModelName
		}
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("unsupported upstream model %q", modelName),
			"unsupported_model", http.StatusBadRequest,
		)
	}

	var req VideoRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if code, err := validateVideoRequest(&req); err != nil {
		return service.TaskErrorWrapperLocal(err, code, http.StatusBadRequest)
	}

	req.Model = info.UpstreamModelName
	info.Action = videoAction(&req)
	c.Set(requestContextKey, req)
	return nil
}

func videoAction(req *VideoRequest) string {
	hasFirstFrame := false
	hasLastFrame := false
	hasReference := false

	for _, item := range req.Content {
		role := ""
		if item.Role != nil {
			role = strings.TrimSpace(*item.Role)
		}
		switch item.Type {
		case "image_url":
			switch role {
			case "", "first_frame":
				hasFirstFrame = true
			case "last_frame":
				hasLastFrame = true
			case "reference_image":
				hasReference = true
			}
		case "video_url", "audio_url":
			hasReference = true
		}
	}

	if hasReference {
		return constant.TaskActionReferenceGenerate
	}
	if hasFirstFrame && hasLastFrame {
		return constant.TaskActionFirstTailGenerate
	}
	if hasFirstFrame || hasLastFrame {
		return constant.TaskActionGenerate
	}
	return constant.TaskActionTextGenerate
}

func validateVideoRequest(req *VideoRequest) (string, error) {
	if strings.TrimSpace(req.Model) == "" {
		return "invalid_model", fmt.Errorf("model is required")
	}
	if req.Duration < minVideoDuration || req.Duration > maxVideoDuration {
		return "invalid_duration", fmt.Errorf("duration must be between %d and %d", minVideoDuration, maxVideoDuration)
	}
	if !isSupportedResolution(req.Resolution) {
		return "invalid_resolution", fmt.Errorf("resolution must be 768P or 2K")
	}
	if req.CallbackURL != nil {
		return "unsupported_callback_url", fmt.Errorf("callback_url is not supported")
	}

	ratio := ""
	if req.Ratio != nil {
		ratio = strings.TrimSpace(*req.Ratio)
		if ratio != "" {
			if _, ok := supportedRatios[ratio]; !ok {
				return "invalid_ratio", fmt.Errorf("unsupported ratio %q", ratio)
			}
		}
	}

	hasText := false
	textCharacters := 0
	firstFrames := 0
	lastFrames := 0
	referenceImages := 0
	referenceVideos := 0
	referenceAudios := 0

	for _, item := range req.Content {
		role := ""
		if item.Role != nil {
			role = strings.TrimSpace(*item.Role)
		}
		if contentPayloadCount(item) != 1 {
			return "invalid_content", fmt.Errorf("each content item must contain exactly one matching payload")
		}

		switch item.Type {
		case "text":
			if item.Text == nil || strings.TrimSpace(*item.Text) == "" || role != "" {
				return "invalid_content", fmt.Errorf("text content must be non-empty and must not have a role")
			}
			hasText = true
			textCharacters += utf8.RuneCountInString(*item.Text)
			if textCharacters > maxTextCharacters {
				return "invalid_content", fmt.Errorf("text content exceeds %d characters", maxTextCharacters)
			}
		case "image_url":
			if item.ImageURL == nil || strings.TrimSpace(item.ImageURL.URL) == "" {
				return "invalid_content", fmt.Errorf("image_url is required")
			}
			switch role {
			case "", "first_frame":
				firstFrames++
			case "last_frame":
				lastFrames++
			case "reference_image":
				referenceImages++
			default:
				return "invalid_content", fmt.Errorf("invalid image role %q", role)
			}
		case "video_url":
			if item.VideoURL == nil || strings.TrimSpace(item.VideoURL.URL) == "" || role != "reference_video" {
				return "invalid_content", fmt.Errorf("video_url requires role reference_video")
			}
			referenceVideos++
		case "audio_url":
			if item.AudioURL == nil || strings.TrimSpace(item.AudioURL.URL) == "" || role != "reference_audio" {
				return "invalid_content", fmt.Errorf("audio_url requires role reference_audio")
			}
			referenceAudios++
		default:
			return "invalid_content", fmt.Errorf("unsupported content type %q", item.Type)
		}
	}

	if !hasText {
		return "invalid_content", fmt.Errorf("content must include a non-empty text item")
	}
	if firstFrames > 1 || lastFrames > 1 {
		return "invalid_content", fmt.Errorf("first_frame and last_frame may each appear at most once")
	}
	if referenceImages > maxReferenceImages || referenceVideos > maxReferenceVideos || referenceAudios > maxReferenceAudios {
		return "invalid_content", fmt.Errorf("content exceeds reference media limits")
	}
	hasFrames := firstFrames > 0 || lastFrames > 0
	hasReference := referenceImages > 0 || referenceVideos > 0 || referenceAudios > 0
	if hasFrames && hasReference {
		return "invalid_content", fmt.Errorf("frame and reference inputs are mutually exclusive")
	}
	if referenceAudios > 0 && referenceImages == 0 && referenceVideos == 0 {
		return "invalid_content", fmt.Errorf("reference audio requires a reference image or video")
	}
	if !hasFrames && !hasReference && (ratio == "" || ratio == "adaptive") {
		return "invalid_ratio", fmt.Errorf("text-only generation requires a non-adaptive ratio")
	}
	if (hasFrames || hasReference) && ratio == "" {
		req.Ratio = common.GetPointer("adaptive")
	}
	return "", nil
}

func contentPayloadCount(item ContentItem) int {
	count := 0
	if item.Text != nil {
		count++
	}
	if item.ImageURL != nil {
		count++
	}
	if item.VideoURL != nil {
		count++
	}
	if item.AudioURL != nil {
		count++
	}
	return count
}

func isSupportedResolution(resolution string) bool {
	return resolution == "768P" || resolution == "2K"
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + createEndpoint, nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, _ *relaycommon.RelayInfo) (io.Reader, error) {
	value, ok := c.Get(requestContextKey)
	if !ok {
		return nil, fmt.Errorf("validated request not found in context")
	}
	req, ok := value.(VideoRequest)
	if !ok {
		return nil, fmt.Errorf("invalid validated request type")
	}
	data, err := common.MarshalNoHTMLEscape(req)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var createResponse CreateResponse
	if err := common.Unmarshal(responseBody, &createResponse); err != nil {
		return "", nil, service.TaskErrorWrapper(err, "unmarshal_response_body_failed", http.StatusInternalServerError)
	}
	if strings.TrimSpace(createResponse.TaskID) == "" {
		var errorResponse ErrorResponse
		if err := common.Unmarshal(responseBody, &errorResponse); err == nil && errorResponse.Error.Message != "" {
			return "", nil, service.TaskErrorWrapperLocal(
				fmt.Errorf("upstream request failed: %s", errorResponse.Error.Message),
				"upstream_error", http.StatusBadGateway,
			)
		}
		return "", nil, service.TaskErrorWrapperLocal(
			fmt.Errorf("upstream task_id is empty"), "invalid_response", http.StatusBadGateway,
		)
	}

	var persistedResponse map[string]any
	if err := common.Unmarshal(responseBody, &persistedResponse); err != nil {
		return "", nil, service.TaskErrorWrapper(err, "sanitize_response_body_failed", http.StatusInternalServerError)
	}
	delete(persistedResponse, "task_id")
	taskData, err := common.Marshal(persistedResponse)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "sanitize_response_body_failed", http.StatusInternalServerError)
	}

	video := dto.NewOpenAIVideo()
	video.ID = info.PublicTaskID
	video.TaskID = info.PublicTaskID
	video.CreatedAt = time.Now().Unix()
	video.Model = info.OriginModelName
	c.JSON(http.StatusOK, video)
	return createResponse.TaskID, taskData, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	requestURL := normalizeBaseURL(baseURL) + queryEndpoint + url.PathEscape(taskID)
	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	responseBody, err := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("read task response failed: %w", err)
	}

	var persistedResponse map[string]any
	if err := common.Unmarshal(responseBody, &persistedResponse); err != nil {
		return nil, fmt.Errorf("sanitize task response failed: %w", err)
	}
	if task, ok := persistedResponse["task"].(map[string]any); ok {
		delete(task, "id")
	}
	sanitizedBody, err := common.Marshal(persistedResponse)
	if err != nil {
		return nil, fmt.Errorf("sanitize task response failed: %w", err)
	}
	resp.Body = io.NopCloser(bytes.NewReader(sanitizedBody))
	resp.ContentLength = int64(len(sanitizedBody))
	resp.Header.Set("Content-Length", strconv.Itoa(len(sanitizedBody)))
	return resp, nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var response QueryResponse
	if err := common.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("unmarshal task result failed: %w", err)
	}
	if response.Task.Status == "" {
		var errorResponse ErrorResponse
		if err := common.Unmarshal(respBody, &errorResponse); err == nil && (errorResponse.Error.Message != "" || errorResponse.Error.HTTPCode != "") {
			httpCode, parseErr := strconv.Atoi(errorResponse.Error.HTTPCode)
			if parseErr == nil && (httpCode == http.StatusBadRequest || httpCode == http.StatusUnauthorized || httpCode == http.StatusForbidden || httpCode == http.StatusNotFound) {
				return &relaycommon.TaskInfo{
					Code:     httpCode,
					Status:   model.TaskStatusFailure,
					Reason:   errorResponse.Error.Message,
					Progress: taskcommon.ProgressComplete,
				}, nil
			}
			return nil, fmt.Errorf("upstream query failed (%s): %s", errorResponse.Error.HTTPCode, errorResponse.Error.Message)
		}
		return nil, fmt.Errorf("upstream query returned empty task status")
	}

	result := &relaycommon.TaskInfo{TaskID: response.Task.ID}
	switch response.Task.Status {
	case "queued":
		result.Status = model.TaskStatusQueued
		result.Progress = taskcommon.ProgressQueued
	case "running":
		result.Status = model.TaskStatusInProgress
		result.Progress = taskcommon.ProgressInProgress
	case "succeeded":
		if err := validateSuccessfulTask(&response.Task); err != nil {
			return nil, err
		}
		result.Status = model.TaskStatusSuccess
		result.Progress = taskcommon.ProgressComplete
		result.Url = response.Task.Content.URL
		result.TotalTokens = *response.Task.Usage.TotalSeconds
		if response.Task.Usage.OutputSeconds != nil && *response.Task.Usage.OutputSeconds > 0 {
			result.CompletionTokens = *response.Task.Usage.OutputSeconds
		}
	case "failed", "cancelled":
		result.Status = model.TaskStatusFailure
		result.Progress = taskcommon.ProgressComplete
		result.Reason = response.Task.Status
		if response.Task.Error != nil {
			if response.Task.Error.Message != "" {
				result.Reason = response.Task.Error.Message
			}
			result.Code, _ = strconv.Atoi(response.Task.Error.Code)
		}
	default:
		return nil, fmt.Errorf("unknown upstream task status %q", response.Task.Status)
	}
	return result, nil
}

func validateSuccessfulTask(task *VideoTask) error {
	if task.Content == nil || strings.TrimSpace(task.Content.URL) == "" {
		return fmt.Errorf("succeeded task is missing content.url")
	}
	if task.Usage == nil {
		return fmt.Errorf("succeeded task is missing usage")
	}
	if task.Usage.TotalSeconds == nil || *task.Usage.TotalSeconds <= 0 {
		return fmt.Errorf("succeeded task has invalid usage.total_seconds")
	}
	if task.Usage.InputImageCount == nil || *task.Usage.InputImageCount < 0 {
		return fmt.Errorf("succeeded task has invalid usage.input_image_count")
	}
	if !isSupportedResolution(task.Resolution) {
		return fmt.Errorf("succeeded task has invalid resolution %q", task.Resolution)
	}
	return nil
}

func (a *TaskAdaptor) GetModelList() []string { return []string{ModelName} }
func (a *TaskAdaptor) GetChannelName() string { return ChannelName }

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var response QueryResponse
	if len(originTask.Data) > 0 {
		if err := common.Unmarshal(originTask.Data, &response); err != nil {
			return nil, fmt.Errorf("unmarshal H3 task data failed: %w", err)
		}
	}

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
		video.Error = &dto.OpenAIVideoError{Message: originTask.FailReason}
		if response.Task.Error != nil {
			video.Error.Code = response.Task.Error.Code
			if response.Task.Error.Message != "" {
				video.Error.Message = response.Task.Error.Message
			}
		}
	}
	return common.Marshal(video)
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	// Clear the previous request's capture: a stale Err would reject this
	// request even when it is perfectly priceable. See SecondBillingState.Reset.
	a.resetSecondBilling()
	value, ok := c.Get(requestContextKey)
	if !ok {
		return nil
	}
	req, ok := value.(VideoRequest)
	if !ok || info == nil || info.PriceData.ModelPrice <= 0 || !isFinite(info.PriceData.ModelPrice) {
		return nil
	}

	seconds := float64(req.Duration)
	inputImages := 0
	hasReferenceVideo := false
	for _, item := range req.Content {
		switch item.Type {
		case "image_url":
			inputImages++
		case "video_url":
			hasReferenceVideo = true
		}
	}

	// One snapshot per request: a second fetch could straddle a config reload
	// and judge the model "configured" against one table while pricing it
	// against another. The snapshot is shallow, so each rule's Match map is
	// shared with the live table and must stay read-only.
	rules := billing_setting.GetVideoPriceRules()
	// The configured table is keyed on info.OriginModelName — the client-facing
	// name the administrator also prices with ModelPrice, which is the
	// denominator in ComputeSecondBilling. The legacy path below keys nothing on
	// a model name at all (it only ever serves the single upstream MiniMax-H3),
	// so the two are deliberately independent.
	//
	// The captured length is the REQUESTED OUTPUT length, deliberately without
	// the maxReferenceInputSeconds pad the legacy reservation adds below. Input
	// media length is not knowable at submit time, and the price table has its
	// own answer for that: a total_duration rule substitutes its bounded
	// FallbackSeconds. Adding the pad here would double-count against such a
	// rule and overprice an output_duration one.
	//
	// req.Duration is validated into [minVideoDuration, maxVideoDuration] before
	// this runs, so the length is always determinable; an unrecognised
	// resolution is the only way a request goes unpriced. For an UNCONFIGURED
	// model that leaves it on the legacy path, which refuses the same tiers
	// (billingResolution accepts exactly 768P and 2K) and so returns nil too.
	// For a configured one there is no legacy path to fall back to — the early
	// return below skips it — so the request must be refused instead.
	//
	// hailuoResolutionLabels and isSupportedResolution agree today, making this
	// unreachable. It is kept because they are separate lists: adding a tier to
	// the validator without adding it here would otherwise bill every request
	// at that tier as a single unit rather than failing.
	dims, dimsOK := resolveDimensions(req.Resolution, hasReferenceVideo)
	configured := billing_setting.IsVideoModelConfigured(rules, info.OriginModelName)
	if dimsOK {
		a.secondBillingModel = info.OriginModelName
		a.secondBillingDims = dims
		a.secondBillingSeconds = seconds
		a.secondBillingModelPrice = info.PriceData.ModelPrice
		a.secondBillingRules = rules
	} else if configured {
		a.secondBillingErr = taskcommon.UnpriceableDimensionError(
			info.OriginModelName, "resolution", req.Resolution)
	}
	// A model in the price table is priced by SecondBillingRatios; returning
	// nil here keeps the legacy hardcoded ratios from also applying. It also
	// drops the extraImagePriceUSD surcharge: under configured pricing the
	// administrator's per-second rate is the whole price, and a surcharge the
	// table cannot express would be an invisible addition to it. An
	// administrator who wants to charge more for image-heavy requests adds a
	// dimension to the rule instead.
	if configured {
		return nil
	}

	if hasReferenceVideo {
		seconds += maxReferenceInputSeconds
	}
	resolutionMultiplier, resolutionMarker, ok := billingResolution(req.Resolution)
	if !ok {
		return nil
	}
	estimatedUSD := info.PriceData.ModelPrice * seconds * resolutionMultiplier
	if inputImages > freeInputImages {
		estimatedUSD += extraImagePriceUSD * float64(inputImages-freeInputImages)
	}
	billableUnits := estimatedUSD / info.PriceData.ModelPrice
	if billableUnits <= 0 || !isFinite(billableUnits) {
		return nil
	}
	return map[string]float64{
		billingUnitsKey:      billableUnits,
		billingRegionIntlKey: 1,
		resolutionMarker:     1,
	}
}

func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, _ *relaycommon.TaskInfo) int {
	return calculateCompletedQuota(task)
}

func (a *TaskAdaptor) AdjustPerCallBillingOnComplete(task *model.Task, _ *relaycommon.TaskInfo) int {
	return calculateCompletedQuota(task)
}

func calculateCompletedQuota(task *model.Task) int {
	if task == nil || task.PrivateData.BillingContext == nil {
		return keepReservedQuota(task, "billing snapshot is missing")
	}
	billing := task.PrivateData.BillingContext
	// A reservation priced from the configured per-second table is already the
	// final price: the administrator's rate times the length the customer asked
	// for, frozen into the snapshot at submit time. There is nothing to
	// recompute here — this settlement rescales the legacy reservation using
	// the legacy formula, whose inputs (billableUnits, the region and
	// resolution markers, extraImagePriceUSD) a per-second reservation never
	// wrote. Returning 0 keeps the frozen reservation, which is the intended
	// outcome, so it must not travel through keepReservedQuota: that logs an
	// error and would fire on every completed per-second task.
	if perSecondReservation(billing.OtherRatios) {
		return 0
	}
	if billing.ModelPrice <= 0 || !isFinite(billing.ModelPrice) || task.Quota <= 0 {
		return keepReservedQuota(task, "billing snapshot price or reserved quota is invalid")
	}
	reservedUnits, ok := billing.OtherRatios[billingUnitsKey]
	if !ok || reservedUnits <= 0 || !isFinite(reservedUnits) {
		return keepReservedQuota(task, "reserved billable units are invalid")
	}
	if marker, ok := billing.OtherRatios[billingRegionIntlKey]; !ok || marker != 1 {
		return keepReservedQuota(task, "international region marker is missing or invalid")
	}
	resolution, multiplier, ok := resolutionFromBillingMarkers(billing.OtherRatios)
	if !ok {
		return keepReservedQuota(task, "resolution marker is missing, invalid, or ambiguous")
	}

	var response QueryResponse
	if err := common.Unmarshal(task.Data, &response); err != nil {
		return keepReservedQuota(task, "completion response could not be decoded")
	}
	if response.Task.Usage == nil || response.Task.Usage.TotalSeconds == nil || response.Task.Usage.InputImageCount == nil {
		return keepReservedQuota(task, "completion usage is incomplete")
	}
	if *response.Task.Usage.TotalSeconds <= 0 || *response.Task.Usage.InputImageCount < 0 {
		return keepReservedQuota(task, "completion usage is invalid")
	}
	if response.Task.Resolution != resolution {
		return keepReservedQuota(task, "completion resolution does not match the reservation")
	}

	actualUSD := billing.ModelPrice * float64(*response.Task.Usage.TotalSeconds) * multiplier
	if *response.Task.Usage.InputImageCount > freeInputImages {
		actualUSD += extraImagePriceUSD * float64(*response.Task.Usage.InputImageCount-freeInputImages)
	}
	actualUnits := actualUSD / billing.ModelPrice
	if actualUnits <= 0 || !isFinite(actualUnits) {
		return keepReservedQuota(task, "calculated actual billable units are invalid")
	}
	actualQuota := float64(task.Quota) * actualUnits / reservedUnits
	if actualQuota < 1 || actualQuota > float64(math.MaxInt) || !isFinite(actualQuota) {
		return keepReservedQuota(task, "calculated completion quota is invalid")
	}
	return int(actualQuota)
}

func billingResolution(resolution string) (float64, string, bool) {
	switch resolution {
	case "768P":
		return 1, billingResolution768PKey, true
	case "2K":
		return resolution2KMultiplier, billingResolution2KKey, true
	default:
		return 0, "", false
	}
}

// perSecondReservation reports whether a persisted billing snapshot was priced
// from the configured per-second table. The two reservation shapes are disjoint
// by construction — EstimateBilling returns nil for a configured model, so the
// legacy keys are never written alongside the per-second one — which is what
// makes a single key a sufficient discriminator.
func perSecondReservation(ratios map[string]float64) bool {
	_, ok := ratios[taskcommon.BillingUnitsKey]
	return ok
}

func resolutionFromBillingMarkers(ratios map[string]float64) (string, float64, bool) {
	marker768P, has768P := ratios[billingResolution768PKey]
	marker2K, has2K := ratios[billingResolution2KKey]
	if has768P == has2K {
		return "", 0, false
	}
	if has768P && marker768P == 1 {
		return "768P", 1, true
	}
	if has2K && marker2K == 1 {
		return "2K", resolution2KMultiplier, true
	}
	return "", 0, false
}

func keepReservedQuota(task *model.Task, reason string) int {
	taskID := "unknown"
	if task != nil && task.TaskID != "" {
		taskID = task.TaskID
	}
	common.SysError(fmt.Sprintf("MiniMax H3 task %s keeps its pre-consumed quota: %s", taskID, reason))
	return 0
}

func isFinite(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}

func normalizeBaseURL(baseURL string) string {
	baseURL = strings.TrimRight(baseURL, "/")
	if baseURL == "" {
		return constant.ChannelBaseURLs[constant.ChannelTypeMiniMaxH3]
	}
	return baseURL
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
