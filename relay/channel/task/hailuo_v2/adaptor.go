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
}

var _ channel.TaskAdaptor = (*TaskAdaptor)(nil)
var _ channel.OpenAIVideoConverter = (*TaskAdaptor)(nil)

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
