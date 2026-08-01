package hailuov2

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const (
	ModelName                = "MiniMax-H3"
	defaultBaseURL           = "https://api.minimaxi.com"
	legacyBaseURL            = "https://api.minimax.chat"
	extraImagePrice          = 0.04
	freeInputImages          = 5
	minVideoDuration         = 4
	maxVideoDuration         = 15
	maxReferenceInputSeconds = 15
)

type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey  string
	baseURL string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.apiKey = info.ApiKey
	a.baseURL = normalizeBaseURL(info.ChannelBaseUrl)
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	var req VideoRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if code, err := validateVideoRequest(&req); err != nil {
		return service.TaskErrorWrapperLocal(err, code, http.StatusBadRequest)
	}

	req.Model = info.UpstreamModelName
	info.Action = constant.TaskActionGenerate
	c.Set("task_request", req)
	return nil
}

func validateVideoRequest(req *VideoRequest) (string, error) {
	maxAllowedDuration := min(maxVideoDuration, relaycommon.MaxTaskDurationSeconds)
	if req.Duration < minVideoDuration || req.Duration > maxAllowedDuration {
		return "invalid_duration", fmt.Errorf("duration must be between 4 and 15")
	}
	if req.Resolution != "2K" {
		return "invalid_resolution", fmt.Errorf("resolution must be 2K")
	}
	validRatios := map[string]bool{
		"adaptive": true, "21:9": true, "16:9": true, "4:3": true,
		"1:1": true, "3:4": true, "9:16": true,
	}
	ratio := ""
	if req.Ratio != nil {
		ratio = *req.Ratio
	}
	if ratio != "" && !validRatios[ratio] {
		return "invalid_ratio", fmt.Errorf("unsupported ratio")
	}

	hasPrompt := false
	hasFrame := false
	hasReferenceImage := false
	hasReferenceVideo := false
	hasReferenceAudio := false
	firstFrames := 0
	lastFrames := 0
	referenceImages := 0
	referenceVideos := 0
	referenceAudios := 0

	for _, item := range req.Content {
		role := ""
		if item.Role != nil {
			role = *item.Role
		}
		switch item.Type {
		case "text":
			if item.Text == nil || strings.TrimSpace(*item.Text) == "" {
				continue
			}
			if utf8.RuneCountInString(*item.Text) > 7000 {
				return "invalid_content", fmt.Errorf("text content exceeds 7000 characters")
			}
			hasPrompt = true
		case "image_url":
			if item.ImageURL == nil || strings.TrimSpace(item.ImageURL.URL) == "" {
				return "invalid_content", fmt.Errorf("image_url is required")
			}
			switch role {
			case "", "first_frame":
				hasFrame = true
				firstFrames++
			case "last_frame":
				hasFrame = true
				lastFrames++
			case "reference_image":
				hasReferenceImage = true
				referenceImages++
			default:
				return "invalid_content", fmt.Errorf("invalid image role")
			}
		case "video_url":
			if item.VideoURL == nil || strings.TrimSpace(item.VideoURL.URL) == "" || role != "reference_video" {
				return "invalid_content", fmt.Errorf("invalid reference video")
			}
			hasReferenceVideo = true
			referenceVideos++
		case "audio_url":
			if item.AudioURL == nil || strings.TrimSpace(item.AudioURL.URL) == "" || role != "reference_audio" {
				return "invalid_content", fmt.Errorf("invalid reference audio")
			}
			hasReferenceAudio = true
			referenceAudios++
		default:
			return "invalid_content", fmt.Errorf("unsupported content type")
		}
	}

	if !hasPrompt {
		return "invalid_content", fmt.Errorf("content must include a non-empty text item")
	}
	if firstFrames > 1 || lastFrames > 1 || referenceImages > 9 || referenceVideos > 3 || referenceAudios > 3 || referenceImages+referenceVideos+referenceAudios > 12 {
		return "invalid_content", fmt.Errorf("content exceeds media count limits")
	}
	hasReference := hasReferenceImage || hasReferenceVideo || hasReferenceAudio
	if hasFrame && hasReference {
		return "invalid_content", fmt.Errorf("frame and reference inputs are mutually exclusive")
	}
	if hasReferenceAudio && !hasReferenceImage && !hasReferenceVideo {
		return "invalid_content", fmt.Errorf("reference audio requires a reference image or video")
	}
	if !hasFrame && !hasReference && (ratio == "" || ratio == "adaptive") {
		return "invalid_ratio", fmt.Errorf("text generation requires a non-adaptive ratio")
	}
	if hasFrame || (hasReference && ratio == "") {
		req.Ratio = common.GetPointer("adaptive")
	}
	return "", nil
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + "/v2/video_generation", nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, _ *relaycommon.RelayInfo) (io.Reader, error) {
	value, ok := c.Get("task_request")
	if !ok {
		return nil, fmt.Errorf("request not found in context")
	}
	req, ok := value.(VideoRequest)
	if !ok {
		return nil, fmt.Errorf("invalid request type in context")
	}
	data, err := common.Marshal(req)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *taskdto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var createResponse CreateResponse
	if err := common.Unmarshal(responseBody, &createResponse); err != nil {
		return "", nil, service.TaskErrorWrapper(err, "unmarshal_response_body_failed", http.StatusInternalServerError)
	}
	if createResponse.TaskID == "" {
		return "", nil, service.TaskErrorWrapperLocal(fmt.Errorf("upstream task_id is empty"), "invalid_response", http.StatusBadGateway)
	}

	video := dto.NewOpenAIVideo()
	video.ID = info.PublicTaskID
	video.TaskID = info.PublicTaskID
	video.CreatedAt = time.Now().Unix()
	video.Model = info.OriginModelName
	c.JSON(http.StatusOK, video)
	return createResponse.TaskID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	requestURL := normalizeBaseURL(baseURL) + "/v2/query/video_generation/" + url.PathEscape(taskID)
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

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var response QueryResponse
	if err := common.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("unmarshal task result failed: %w", err)
	}
	if response.Task.Status == "" {
		var errorResponse ErrorResponse
		if err := common.Unmarshal(respBody, &errorResponse); err == nil && errorResponse.Error.Message != "" {
			return nil, fmt.Errorf("minimax query failed (%s): %s", errorResponse.Error.HTTPCode, errorResponse.Error.Message)
		}
		return nil, fmt.Errorf("minimax query returned empty task status")
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
		result.Status = model.TaskStatusSuccess
		result.Progress = taskcommon.ProgressComplete
		result.Url = response.Task.Content.URL
	case "failed", "cancelled", "expired":
		result.Status = model.TaskStatusFailure
		result.Progress = taskcommon.ProgressComplete
		result.Reason = response.Task.Status
		if response.Task.Error != nil {
			result.Code, _ = strconv.Atoi(response.Task.Error.Code)
			result.Reason = response.Task.Error.Message
		}
	}
	return result, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return []string{ModelName}
}

func (a *TaskAdaptor) GetChannelName() string {
	return "minimax-video-v2"
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	video := task.ToOpenAIVideo()
	var response QueryResponse
	if err := common.Unmarshal(task.Data, &response); err != nil {
		return nil, fmt.Errorf("unmarshal task data failed: %w", err)
	}
	if response.Task.Error != nil {
		video.Error = &dto.OpenAIVideoError{
			Code:    response.Task.Error.Code,
			Message: response.Task.Error.Message,
		}
	}
	return common.Marshal(video)
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	value, ok := c.Get("task_request")
	if !ok {
		return nil
	}
	req, ok := value.(VideoRequest)
	if !ok || info.PriceData.ModelPrice <= 0 {
		return nil
	}

	inputImages := 0
	hasReferenceVideo := false
	for _, item := range req.Content {
		if item.Type == "image_url" {
			inputImages++
		}
		if item.Type == "video_url" && item.Role != nil && *item.Role == "reference_video" {
			hasReferenceVideo = true
		}
	}
	billableSeconds := req.Duration
	if hasReferenceVideo {
		billableSeconds += maxReferenceInputSeconds
	}
	estimatedCost := info.PriceData.ModelPrice * float64(billableSeconds)
	if inputImages > freeInputImages {
		estimatedCost += extraImagePrice * float64(inputImages-freeInputImages)
	}
	return map[string]float64{"billable_units": estimatedCost / info.PriceData.ModelPrice}
}

func (a *TaskAdaptor) AdjustBillingOnCompleteChecked(task *model.Task, _ *relaycommon.TaskInfo) (int, *common.QuotaClamp) {
	if task == nil || task.PrivateData.BillingContext == nil {
		return 0, nil
	}
	var response QueryResponse
	if err := common.Unmarshal(task.Data, &response); err != nil || response.Task.Usage.TotalSeconds <= 0 {
		return 0, nil
	}

	billing := task.PrivateData.BillingContext
	if billing.ModelPrice <= 0 || billing.GroupRatio <= 0 {
		return 0, nil
	}
	cost := billing.ModelPrice * float64(response.Task.Usage.TotalSeconds)
	if response.Task.Usage.InputImageCount > freeInputImages {
		cost += extraImagePrice * float64(response.Task.Usage.InputImageCount-freeInputImages)
	}
	return common.QuotaFromFloatChecked(cost * common.QuotaPerUnit * billing.GroupRatio)
}

func (a *TaskAdaptor) UseCompletionBilling() {}

func normalizeBaseURL(baseURL string) string {
	baseURL = strings.TrimRight(baseURL, "/")
	if baseURL == "" || baseURL == legacyBaseURL {
		return defaultBaseURL
	}
	return baseURL
}
