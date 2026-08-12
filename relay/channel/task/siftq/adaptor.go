package siftq

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

const requestContextKey = "siftq_video_request"

type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey  string
	baseURL string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.apiKey = info.ApiKey
	a.baseURL = info.ChannelBaseUrl
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	if taskErr := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionTextGenerate); taskErr != nil {
		return taskErr
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(req.Model) != ModelName {
		return service.TaskErrorWrapperLocal(fmt.Errorf("model must be %s", ModelName), "invalid_model", http.StatusBadRequest)
	}
	payload, action, err := convertRequest(req)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	info.Action = action
	c.Set(requestContextKey, payload)
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, _ *relaycommon.RelayInfo) map[string]float64 {
	payload, ok := c.Get(requestContextKey)
	if !ok {
		return nil
	}
	req, ok := payload.(*videoRequest)
	if !ok || req.Duration <= 0 {
		return nil
	}
	return map[string]float64{"seconds": float64(req.Duration)}
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return joinURL(info.ChannelBaseUrl, createVideoPath), nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, _ *relaycommon.RelayInfo) (io.Reader, error) {
	payload, ok := c.Get(requestContextKey)
	if !ok {
		return nil, fmt.Errorf("validated SiftQ request not found in context")
	}
	req, ok := payload.(*videoRequest)
	if !ok {
		return nil, fmt.Errorf("invalid SiftQ request in context")
	}
	body, err := common.Marshal(req)
	if err != nil {
		return nil, err
	}
	if len(body) > maxRequestBytes {
		return nil, fmt.Errorf("request body exceeds 64 MB")
	}
	return bytes.NewReader(body), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *taskdto.TaskError) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var result createResponse
	if err := common.Unmarshal(body, &result); err != nil {
		return "", nil, service.TaskErrorWrapper(errors.Wrap(err, "unmarshal SiftQ create response"), "unmarshal_response_body_failed", http.StatusBadGateway)
	}
	if strings.TrimSpace(result.TaskID) == "" {
		return "", nil, service.TaskErrorWrapperLocal(fmt.Errorf("SiftQ response is missing task_id"), "invalid_upstream_response", http.StatusBadGateway)
	}

	video := kitdto.NewOpenAIVideo()
	video.ID = info.PublicTaskID
	video.TaskID = info.PublicTaskID
	video.CreatedAt = time.Now().Unix()
	video.Model = ModelName
	c.JSON(http.StatusOK, video)
	return result.TaskID, body, nil
}

func (a *TaskAdaptor) ParseErrorResponse(statusCode int, body []byte) *taskdto.TaskError {
	var envelope errorEnvelope
	if err := common.Unmarshal(body, &envelope); err != nil || strings.TrimSpace(envelope.Error.Message) == "" {
		return service.TaskErrorWrapper(fmt.Errorf("SiftQ request failed with status %d", statusCode), "siftq_api_error", statusCode)
	}
	code := strings.TrimSpace(envelope.Error.Type)
	if code == "" {
		code = "siftq_api_error"
	}
	message := envelope.Error.Message
	if envelope.RequestID != "" {
		message = fmt.Sprintf("%s (request_id: %s)", message, envelope.RequestID)
	}
	return service.TaskErrorWrapper(errors.New(message), code, statusCode)
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	requestURL := joinURL(baseURL, queryVideoPath+"/"+url.PathEscape(taskID))
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
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(body []byte) (*relaycommon.TaskInfo, error) {
	var result queryResponse
	if err := common.Unmarshal(body, &result); err != nil {
		return nil, errors.Wrap(err, "unmarshal SiftQ task response")
	}
	if result.Task.ID == "" {
		var envelope errorEnvelope
		if err := common.Unmarshal(body, &envelope); err == nil && envelope.Error.Message != "" {
			code, _ := strconv.Atoi(envelope.Error.HTTPCode)
			if code == http.StatusTooManyRequests || code >= http.StatusInternalServerError {
				return nil, fmt.Errorf("transient SiftQ error: %s", envelope.Error.Message)
			}
			return relaycommon.FailTaskInfo(envelope.Error.Message), nil
		}
		return nil, fmt.Errorf("SiftQ task response is missing task.id")
	}

	info := &relaycommon.TaskInfo{
		TaskID:        result.Task.ID,
		OutputSeconds: result.Task.Usage.OutputSeconds,
		TotalTokens:   result.Task.Usage.TotalTokens,
	}
	switch result.Task.Status {
	case "queued":
		info.Status = model.TaskStatusQueued
		info.Progress = taskcommon.ProgressQueued
	case "running":
		info.Status = model.TaskStatusInProgress
		info.Progress = taskcommon.ProgressInProgress
	case "succeeded":
		if result.Task.Modality == "text" || result.Task.TaskType == "h3_context_ir" {
			return nil, fmt.Errorf("SiftQ Context-IR tasks are not video outputs")
		}
		if strings.TrimSpace(result.Task.Content.URL) == "" {
			return nil, fmt.Errorf("succeeded SiftQ video task is missing content.url")
		}
		info.Status = model.TaskStatusSuccess
		info.Progress = taskcommon.ProgressComplete
		info.Url = result.Task.Content.URL
	case "failed", "cancelled":
		info.Status = model.TaskStatusFailure
		info.Progress = taskcommon.ProgressComplete
		if result.Task.Error != nil {
			info.Code, _ = strconv.Atoi(result.Task.Error.Code)
			info.Reason = result.Task.Error.Message
		}
		if info.Reason == "" {
			info.Reason = "SiftQ task " + result.Task.Status
		}
	default:
		return nil, fmt.Errorf("unknown SiftQ task status %q", result.Task.Status)
	}
	return info, nil
}

func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, result *relaycommon.TaskInfo) int {
	if task == nil || result == nil || result.OutputSeconds <= 0 || task.PrivateData.BillingContext == nil {
		return 0
	}
	estimated := task.PrivateData.BillingContext.OtherRatios["seconds"]
	if estimated <= 0 {
		return 0
	}
	quota, _ := common.QuotaFromFloatChecked(float64(task.Quota) * float64(result.OutputSeconds) / estimated)
	return quota
}

func (a *TaskAdaptor) GetModelList() []string { return ModelList }
func (a *TaskAdaptor) GetChannelName() string { return ChannelName }

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	video := task.ToOpenAIVideo()
	video.Model = ModelName
	// A freshly persisted async task is NOT_START until the polling worker runs.
	// The upstream task has already been accepted at this point, so expose the
	// public state as queued instead of the generic unknown fallback.
	if task.Status == model.TaskStatusNotStart {
		video.Status = kitdto.VideoStatusQueued
	}
	if task.Status == model.TaskStatusFailure {
		video.Error = &kitdto.OpenAIVideoError{Message: task.FailReason, Code: "siftq_task_failed"}
	}
	return common.Marshal(video)
}

func convertRequest(req relaycommon.TaskSubmitReq) (*videoRequest, string, error) {
	if metadataModel, ok := req.Metadata["model"].(string); ok && strings.TrimSpace(metadataModel) != "" && metadataModel != ModelName {
		return nil, "", fmt.Errorf("metadata.model cannot override fixed model %s", ModelName)
	}
	overrides := requestOverrides{}
	if err := req.UnmarshalMetadata(&overrides); err != nil {
		return nil, "", errors.Wrap(err, "parse SiftQ metadata")
	}
	duration := req.Duration
	if overrides.Duration != nil {
		duration = *overrides.Duration
	}
	if duration == 0 && req.Seconds != "" {
		duration, _ = strconv.Atoi(req.Seconds)
	}
	if duration == 0 {
		duration = defaultDuration
	}
	if duration < 4 || duration > 15 {
		return nil, "", fmt.Errorf("duration must be an integer from 4 through 15")
	}
	resolution := strings.ToUpper(strings.TrimSpace(overrides.Resolution))
	if resolution == "" {
		resolution = strings.ToUpper(strings.TrimSpace(req.Size))
	}
	if resolution == "" {
		resolution = defaultResolution
	}
	if _, ok := validResolutions[resolution]; !ok {
		return nil, "", fmt.Errorf("resolution must be 768P or 2K")
	}

	content := overrides.Content
	if len(content) == 0 {
		content = []contentItem{{Type: "text", Text: strings.TrimSpace(req.Prompt)}}
		images := normalizedImages(req)
		switch {
		case strings.EqualFold(req.Mode, "reference") || len(images) > 2:
			for _, image := range images {
				content = append(content, contentItem{Type: "image_url", ImageURL: &mediaURL{URL: image}, Role: "reference_image"})
			}
		case len(images) == 2:
			content = append(content,
				contentItem{Type: "image_url", ImageURL: &mediaURL{URL: images[0]}, Role: "first_frame"},
				contentItem{Type: "image_url", ImageURL: &mediaURL{URL: images[1]}, Role: "last_frame"},
			)
		case len(images) == 1:
			content = append(content, contentItem{Type: "image_url", ImageURL: &mediaURL{URL: images[0]}, Role: "first_frame"})
		}
	} else if !containsText(content) {
		content = append([]contentItem{{Type: "text", Text: strings.TrimSpace(req.Prompt)}}, content...)
	}

	mode, err := validateAndNormalizeContent(content)
	if err != nil {
		return nil, "", err
	}
	ratio := strings.TrimSpace(overrides.Ratio)
	if ratio == "" {
		if mode == "text" {
			ratio = defaultTextRatio
		} else {
			ratio = adaptiveRatio
		}
	}
	if _, ok := validRatios[ratio]; !ok {
		return nil, "", fmt.Errorf("invalid ratio %q", ratio)
	}
	if mode == "text" && ratio == adaptiveRatio {
		return nil, "", fmt.Errorf("text-to-video requires a concrete ratio")
	}
	if mode == "frame" {
		ratio = adaptiveRatio
	}
	if overrides.CallbackURL != "" {
		parsed, err := url.ParseRequestURI(overrides.CallbackURL)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			return nil, "", fmt.Errorf("callback_url must be an absolute HTTP(S) URL")
		}
	}

	action := constant.TaskActionTextGenerate
	if mode == "frame" {
		action = constant.TaskActionGenerate
	} else if mode == "reference" {
		action = constant.TaskActionReferenceGenerate
	}
	return &videoRequest{
		Model:       ModelName,
		Content:     content,
		Resolution:  resolution,
		Duration:    duration,
		Ratio:       ratio,
		CallbackURL: overrides.CallbackURL,
	}, action, nil
}

func validateAndNormalizeContent(content []contentItem) (string, error) {
	textCount, firstCount, lastCount := 0, 0, 0
	referenceImages, referenceVideos, referenceAudios := 0, 0, 0
	imageCount := 0
	for i := range content {
		item := &content[i]
		item.Type = strings.TrimSpace(item.Type)
		item.Role = strings.TrimSpace(item.Role)
		switch item.Type {
		case "text":
			if strings.TrimSpace(item.Text) == "" {
				return "", fmt.Errorf("content[%d].text is required", i)
			}
			if len([]rune(item.Text)) > 7000 {
				return "", fmt.Errorf("content[%d].text exceeds 7000 characters", i)
			}
			textCount++
		case "image_url":
			if item.ImageURL == nil {
				return "", fmt.Errorf("content[%d].image_url is required", i)
			}
			imageCount++
			if item.Role == "" {
				item.Role = "first_frame"
			}
			if err := validateMediaURL(item.ImageURL.URL, "image", 30<<20); err != nil {
				return "", fmt.Errorf("content[%d]: %w", i, err)
			}
			switch item.Role {
			case "first_frame":
				firstCount++
			case "last_frame":
				lastCount++
			case "reference_image":
				referenceImages++
			default:
				return "", fmt.Errorf("content[%d] has invalid image role %q", i, item.Role)
			}
		case "video_url":
			if item.VideoURL == nil || item.Role != "reference_video" {
				return "", fmt.Errorf("content[%d] video_url requires role reference_video", i)
			}
			if err := validateMediaURL(item.VideoURL.URL, "video", 50<<20); err != nil {
				return "", fmt.Errorf("content[%d]: %w", i, err)
			}
			referenceVideos++
		case "audio_url":
			if item.AudioURL == nil || item.Role != "reference_audio" {
				return "", fmt.Errorf("content[%d] audio_url requires role reference_audio", i)
			}
			if err := validateMediaURL(item.AudioURL.URL, "audio", 15<<20); err != nil {
				return "", fmt.Errorf("content[%d]: %w", i, err)
			}
			referenceAudios++
		default:
			return "", fmt.Errorf("content[%d] has unsupported type %q", i, item.Type)
		}
	}
	if textCount == 0 {
		return "", fmt.Errorf("content requires at least one non-empty text item")
	}
	if firstCount > 1 || lastCount > 1 {
		return "", fmt.Errorf("content supports at most one first frame and one last frame")
	}
	if lastCount > 0 && firstCount == 0 {
		return "", fmt.Errorf("last_frame requires first_frame")
	}
	if referenceImages > 9 || referenceVideos > 3 || referenceAudios > 3 {
		return "", fmt.Errorf("reference media count exceeds SiftQ limits")
	}
	if imageCount > 11 {
		return "", fmt.Errorf("image count exceeds SiftQ limits")
	}
	hasFrames := firstCount+lastCount > 0
	hasReferences := referenceImages+referenceVideos+referenceAudios > 0
	if hasFrames && hasReferences {
		return "", fmt.Errorf("first/last frames cannot be combined with reference media")
	}
	if hasFrames {
		return "frame", nil
	}
	if hasReferences {
		return "reference", nil
	}
	return "text", nil
}

func validateMediaURL(value, mediaType string, maxBytes int) error {
	value = strings.TrimSpace(value)
	if value == "" {
		return fmt.Errorf("%s URL is required", mediaType)
	}
	if strings.HasPrefix(value, "mm_file://") {
		if strings.TrimPrefix(value, "mm_file://") == "" {
			return fmt.Errorf("invalid mm_file reference")
		}
		return nil
	}
	if strings.HasPrefix(value, "data:") {
		parts := strings.SplitN(value, ",", 2)
		if len(parts) != 2 || !strings.HasSuffix(parts[0], ";base64") {
			return fmt.Errorf("invalid base64 data URI")
		}
		mime := strings.TrimSuffix(strings.TrimPrefix(parts[0], "data:"), ";base64")
		if !validMediaMIME(mediaType, mime) {
			return fmt.Errorf("unsupported %s MIME type %q", mediaType, mime)
		}
		if _, err := base64.StdEncoding.DecodeString(parts[1]); err != nil {
			return fmt.Errorf("invalid base64 data URI")
		}
		if base64.StdEncoding.DecodedLen(len(parts[1])) > maxBytes {
			return fmt.Errorf("%s exceeds size limit", mediaType)
		}
		return nil
	}
	parsed, err := url.ParseRequestURI(value)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return fmt.Errorf("%s must use http, https, mm_file, or a supported data URI", mediaType)
	}
	return nil
}

func validMediaMIME(mediaType, mime string) bool {
	allowed := map[string]map[string]struct{}{
		"image": {"image/jpg": {}, "image/jpeg": {}, "image/png": {}, "image/webp": {}, "image/heic": {}, "image/heif": {}},
		"video": {"video/mp4": {}, "video/quicktime": {}},
		"audio": {"audio/wav": {}, "audio/x-wav": {}, "audio/mpeg": {}, "audio/mp3": {}},
	}
	_, ok := allowed[mediaType][mime]
	return ok
}

func normalizedImages(req relaycommon.TaskSubmitReq) []string {
	images := make([]string, 0, len(req.Images)+1)
	if image := strings.TrimSpace(req.Image); image != "" {
		images = append(images, image)
	}
	for _, image := range req.Images {
		if image = strings.TrimSpace(image); image != "" && (len(images) == 0 || images[len(images)-1] != image) {
			images = append(images, image)
		}
	}
	if len(images) == 0 {
		if image := strings.TrimSpace(req.InputReference); image != "" {
			images = append(images, image)
		}
	}
	return images
}

func containsText(content []contentItem) bool {
	for _, item := range content {
		if item.Type == "text" && strings.TrimSpace(item.Text) != "" {
			return true
		}
	}
	return false
}

func joinURL(baseURL, path string) string {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = DefaultBaseURL
	}
	return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(path, "/")
}
