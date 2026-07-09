package ali

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/samber/lo"
)

type AliMediaItem struct {
	Type              string  `json:"type"`
	URL               string  `json:"url"`
	KeepOriginalSound *string `json:"keep_original_sound,omitempty"`
}

type AliMultiPromptItem struct {
	Index    int    `json:"index"`
	Prompt   string `json:"prompt"`
	Duration int    `json:"duration"`
}

type AliElementItem struct {
	ElementID int `json:"element_id"`
}

type AliVideoRequest struct {
	Model      string              `json:"model"`
	Input      AliVideoInput       `json:"input"`
	Parameters *AliVideoParameters `json:"parameters,omitempty"`
}

type AliVideoInput struct {
	Prompt         string               `json:"prompt,omitempty"`
	ImgURL         string               `json:"img_url,omitempty"`
	FirstFrameURL  string               `json:"first_frame_url,omitempty"`
	LastFrameURL   string               `json:"last_frame_url,omitempty"`
	AudioURL       string               `json:"audio_url,omitempty"`
	NegativePrompt string               `json:"negative_prompt,omitempty"`
	Template       string               `json:"template,omitempty"`
	Media          []AliMediaItem       `json:"media,omitempty"`
	MultiShot      *bool                `json:"multi_shot,omitempty"`
	ShotType       *string              `json:"shot_type,omitempty"`
	MultiPrompt    []AliMultiPromptItem `json:"multi_prompt,omitempty"`
	ElementList    []AliElementItem     `json:"element_list,omitempty"`
}

type AliVideoParameters struct {
	Resolution   string  `json:"resolution,omitempty"`
	Size         string  `json:"size,omitempty"`
	Duration     int     `json:"duration,omitempty"`
	Ratio        *string `json:"ratio,omitempty"`
	Mode         *string `json:"mode,omitempty"`
	AspectRatio  *string `json:"aspect_ratio,omitempty"`
	AudioSetting *string `json:"audio_setting,omitempty"`
	PromptExtend bool    `json:"prompt_extend,omitempty"`
	Watermark    *bool   `json:"watermark,omitempty"`
	Audio        *bool   `json:"audio,omitempty"`
	Seed         int     `json:"seed,omitempty"`
}

type AliVideoResponse struct {
	Output    AliVideoOutput `json:"output"`
	RequestID string         `json:"request_id"`
	Code      string         `json:"code,omitempty"`
	Message   string         `json:"message,omitempty"`
	Usage     *AliUsage      `json:"usage,omitempty"`
}

type AliVideoOutput struct {
	TaskID        string `json:"task_id"`
	TaskStatus    string `json:"task_status"`
	SubmitTime    string `json:"submit_time,omitempty"`
	ScheduledTime string `json:"scheduled_time,omitempty"`
	EndTime       string `json:"end_time,omitempty"`
	OrigPrompt    string `json:"orig_prompt,omitempty"`
	ActualPrompt  string `json:"actual_prompt,omitempty"`
	VideoURL      string `json:"video_url,omitempty"`
	WatermarkURL  string `json:"watermark_video_url,omitempty"`
	Code          string `json:"code,omitempty"`
	Message       string `json:"message,omitempty"`
}

type AliUsage struct {
	Duration            any    `json:"duration,omitempty"`
	InputVideoDuration  any    `json:"input_video_duration,omitempty"`
	OutputVideoDuration any    `json:"output_video_duration,omitempty"`
	VideoCount          any    `json:"video_count,omitempty"`
	SR                  any    `json:"SR,omitempty"`
	Ratio               string `json:"ratio,omitempty"`
	Size                string `json:"size,omitempty"`
	FPS                 any    `json:"fps,omitempty"`
	Audio               any    `json:"audio,omitempty"`
}

type AliMetadata struct {
	AudioURL       string `json:"audio_url,omitempty"`
	ImgURL         string `json:"img_url,omitempty"`
	FirstFrameURL  string `json:"first_frame_url,omitempty"`
	LastFrameURL   string `json:"last_frame_url,omitempty"`
	NegativePrompt string `json:"negative_prompt,omitempty"`
	Template       string `json:"template,omitempty"`

	Resolution   *string `json:"resolution,omitempty"`
	Size         *string `json:"size,omitempty"`
	Duration     *int    `json:"duration,omitempty"`
	PromptExtend *bool   `json:"prompt_extend,omitempty"`
	Watermark    *bool   `json:"watermark,omitempty"`
	Audio        *bool   `json:"audio,omitempty"`
	Seed         *int    `json:"seed,omitempty"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	req, err := parseAliTaskRequest(c)
	if err != nil {
		return newAliTaskError(err, "invalid_json", http.StatusBadRequest)
	}
	if info.TaskRelayInfo == nil {
		info.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	}
	if strings.TrimSpace(req.Model) == "" {
		return newAliTaskError(fmt.Errorf("model field is required"), "missing_model", http.StatusBadRequest)
	}
	if req.InputReference != "" && len(req.Images) == 0 {
		req.Images = []string{req.InputReference}
	}
	action, err := validateAndInferAliAction(req)
	if err != nil {
		return newAliTaskError(err, "invalid_request", http.StatusBadRequest)
	}
	info.Action = action
	c.Set("task_request", req)
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/api/v1/services/aigc/video-generation/video-synthesis", a.baseURL), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DashScope-Async", "enable")
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_task_request_failed")
	}

	aliReq, err := a.convertToAliRequest(info, taskReq)
	if err != nil {
		return nil, errors.Wrap(err, "convert_to_ali_request_failed")
	}
	logger.LogJson(c, "ali video request body", aliReq)

	bodyBytes, err := common.Marshal(aliReq)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_ali_request_failed")
	}
	return bytes.NewReader(bodyBytes), nil
}

var (
	size480p  = []string{"832*480", "480*832", "624*624"}
	size720p  = []string{"1280*720", "720*1280", "960*960", "1088*832", "832*1088"}
	size1080p = []string{"1920*1080", "1080*1920", "1440*1440", "1632*1248", "1248*1632"}
)

func sizeToResolution(size string) (string, error) {
	if lo.Contains(size480p, size) {
		return "480P", nil
	}
	if lo.Contains(size720p, size) {
		return "720P", nil
	}
	if lo.Contains(size1080p, size) {
		return "1080P", nil
	}
	return "", fmt.Errorf("invalid size: %s", size)
}

func ProcessAliOtherRatios(aliReq *AliVideoRequest) (map[string]float64, error) {
	otherRatios := make(map[string]float64)
	aliRatios := map[string]map[string]float64{
		"wan2.6-i2v":         {"720P": 1, "1080P": 1 / 0.6},
		"wan2.5-t2v-preview": {"480P": 1, "720P": 2, "1080P": 1 / 0.3},
		"wan2.2-t2v-plus":    {"480P": 1, "1080P": 0.7 / 0.14},
		"wan2.5-i2v-preview": {"480P": 1, "720P": 2, "1080P": 1 / 0.3},
		"wan2.2-i2v-plus":    {"480P": 1, "1080P": 0.7 / 0.14},
		"wan2.2-kf2v-flash":  {"480P": 1, "720P": 2, "1080P": 4.8},
		"wan2.2-i2v-flash":   {"480P": 1, "720P": 2},
		"wan2.2-s2v":         {"480P": 1, "720P": 0.9 / 0.5},
	}
	if aliReq.Parameters == nil {
		return otherRatios, nil
	}
	resolution := aliReq.Parameters.Resolution
	if aliReq.Parameters.Size != "" {
		var err error
		resolution, err = sizeToResolution(aliReq.Parameters.Size)
		if err != nil {
			return nil, err
		}
	} else if resolution != "" && !strings.HasSuffix(strings.ToUpper(resolution), "P") {
		resolution = strings.ToUpper(resolution) + "P"
	}
	if otherRatio, ok := aliRatios[aliReq.Model]; ok {
		if ratio, ok := otherRatio[strings.ToUpper(resolution)]; ok {
			otherRatios[fmt.Sprintf("resolution-%s", strings.ToUpper(resolution))] = ratio
		}
	}
	return otherRatios, nil
}

func (a *TaskAdaptor) convertToAliRequest(info *relaycommon.RelayInfo, req relaycommon.TaskSubmitReq) (*AliVideoRequest, error) {
	upstreamModel := req.Model
	if info != nil && info.ChannelMeta != nil && info.IsModelMapped {
		upstreamModel = info.UpstreamModelName
	}
	switch {
	case isHappyHorseModel(upstreamModel):
		return a.buildHappyHorseRequest(upstreamModel, req), nil
	case isBailianKlingModel(upstreamModel):
		return a.buildKlingRequest(upstreamModel, req)
	}

	aliReq := &AliVideoRequest{
		Model: upstreamModel,
		Input: AliVideoInput{
			Prompt: req.Prompt,
			ImgURL: req.InputReference,
		},
		Parameters: &AliVideoParameters{
			PromptExtend: true,
			Watermark:    lo.ToPtr(false),
		},
	}

	if req.Size != "" {
		if strings.Contains(req.Model, "t2v") && !strings.Contains(req.Size, "*") {
			return nil, fmt.Errorf("invalid size: %s, example: 1920*1080", req.Size)
		}
		if strings.Contains(req.Size, "*") {
			aliReq.Parameters.Size = req.Size
		} else {
			aliReq.Parameters.Resolution = defaultAliResolution(req.Size, "")
		}
	} else {
		if strings.Contains(req.Model, "t2v") {
			if strings.HasPrefix(req.Model, "wan2.5") || strings.HasPrefix(req.Model, "wan2.2") {
				aliReq.Parameters.Size = "1920*1080"
			} else {
				aliReq.Parameters.Size = "1280*720"
			}
		} else {
			switch {
			case strings.HasPrefix(req.Model, "wan2.6"), strings.HasPrefix(req.Model, "wan2.5"), strings.HasPrefix(req.Model, "wan2.2-i2v-plus"):
				aliReq.Parameters.Resolution = "1080P"
			case strings.HasPrefix(req.Model, "wan2.2-i2v-flash"):
				aliReq.Parameters.Resolution = "720P"
			default:
				aliReq.Parameters.Resolution = "720P"
			}
		}
	}

	aliReq.Parameters.Duration = resolveTaskDuration(req, 5)

	if req.Metadata != nil {
		if metadataBytes, err := common.Marshal(req.Metadata); err == nil {
			if err := common.Unmarshal(metadataBytes, aliReq); err != nil {
				return nil, errors.Wrap(err, "unmarshal metadata failed")
			}
		} else {
			return nil, errors.Wrap(err, "marshal metadata failed")
		}
	}

	if aliReq.Model != upstreamModel {
		return nil, errors.New("can't change model with metadata")
	}

	return aliReq, nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}

	aliReq, err := a.convertToAliRequest(info, taskReq)
	if err != nil || aliReq.Parameters == nil {
		return nil
	}

	otherRatios := map[string]float64{
		"seconds": float64(aliReq.Parameters.Duration),
	}
	ratios, err := ProcessAliOtherRatios(aliReq)
	if err != nil {
		return otherRatios
	}
	for k, v := range ratios {
		otherRatios[k] = v
	}
	return otherRatios
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

	var aliResp AliVideoResponse
	if err := common.Unmarshal(responseBody, &aliResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if aliResp.Code != "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("%s: %s", aliResp.Code, aliResp.Message), "ali_api_error", resp.StatusCode)
		return
	}
	if aliResp.Output.TaskID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = info.PublicTaskID
	openAIResp.TaskID = info.PublicTaskID
	openAIResp.Model = c.GetString("model")
	if openAIResp.Model == "" && info != nil {
		openAIResp.Model = info.OriginModelName
	}
	openAIResp.Status = convertAliStatus(aliResp.Output.TaskStatus)
	openAIResp.CreatedAt = common.GetTimestamp()
	c.JSON(http.StatusOK, openAIResp)

	return aliResp.Output.TaskID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/api/v1/tasks/%s", baseUrl, taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
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

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var aliResp AliVideoResponse
	if err := common.Unmarshal(respBody, &aliResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{Code: 0}
	switch aliResp.Output.TaskStatus {
	case "PENDING":
		taskResult.Status = model.TaskStatusQueued
	case "RUNNING":
		taskResult.Status = model.TaskStatusInProgress
	case "SUCCEEDED":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Url = aliResp.Output.VideoURL
	case "FAILED", "CANCELED", "UNKNOWN":
		taskResult.Status = model.TaskStatusFailure
		if aliResp.Message != "" {
			taskResult.Reason = aliResp.Message
		} else if aliResp.Output.Message != "" {
			taskResult.Reason = fmt.Sprintf("task failed, code: %s , message: %s", aliResp.Output.Code, aliResp.Output.Message)
		} else {
			taskResult.Reason = "task failed"
		}
	default:
		taskResult.Status = model.TaskStatusQueued
	}
	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	var aliResp AliVideoResponse
	if err := common.Unmarshal(task.Data, &aliResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal ali response failed")
	}

	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = task.TaskID
	openAIResp.Status = convertAliStatus(aliResp.Output.TaskStatus)
	openAIResp.Model = task.Properties.OriginModelName
	openAIResp.SetProgressStr(task.Progress)
	openAIResp.CreatedAt = task.CreatedAt
	openAIResp.CompletedAt = task.UpdatedAt
	openAIResp.SetMetadata("url", aliResp.Output.VideoURL)
	if aliResp.Output.WatermarkURL != "" {
		openAIResp.SetMetadata("watermark_url", aliResp.Output.WatermarkURL)
	}

	if aliResp.Code != "" {
		openAIResp.Error = &dto.OpenAIVideoError{Code: aliResp.Code, Message: aliResp.Message}
	} else if aliResp.Output.Code != "" {
		openAIResp.Error = &dto.OpenAIVideoError{Code: aliResp.Output.Code, Message: aliResp.Output.Message}
	}
	return common.Marshal(openAIResp)
}

func convertAliStatus(aliStatus string) string {
	switch aliStatus {
	case "PENDING":
		return dto.VideoStatusQueued
	case "RUNNING":
		return dto.VideoStatusInProgress
	case "SUCCEEDED":
		return dto.VideoStatusCompleted
	case "FAILED", "CANCELED", "UNKNOWN":
		return dto.VideoStatusFailed
	default:
		return dto.VideoStatusUnknown
	}
}

func newAliTaskError(err error, code string, statusCode int) *dto.TaskError {
	return &dto.TaskError{
		Code:       code,
		Message:    err.Error(),
		StatusCode: statusCode,
		LocalError: true,
		Error:      err,
	}
}

func parseAliTaskRequest(c *gin.Context) (relaycommon.TaskSubmitReq, error) {
	var req relaycommon.TaskSubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return req, err
	}
	if len(req.Images) == 0 && strings.TrimSpace(req.Image) != "" {
		req.Images = []string{req.Image}
	}
	return req, nil
}

func validateAndInferAliAction(req relaycommon.TaskSubmitReq) (string, error) {
	switch {
	case isHappyHorseModel(req.Model):
		return inferHappyHorseAction(req)
	case isBailianKlingModel(req.Model):
		return inferBailianKlingAction(req)
	default:
		if strings.TrimSpace(req.Prompt) == "" {
			return "", fmt.Errorf("prompt is required")
		}
		if req.HasImage() {
			return constant.TaskActionGenerate, nil
		}
		return constant.TaskActionTextGenerate, nil
	}
}

func inferHappyHorseAction(req relaycommon.TaskSubmitReq) (string, error) {
	modelName := strings.ToLower(strings.TrimSpace(req.Model))
	switch {
	case strings.Contains(modelName, "-t2v"):
		if strings.TrimSpace(req.Prompt) == "" {
			return "", fmt.Errorf("prompt is required")
		}
		return constant.TaskActionTextGenerate, nil
	case strings.Contains(modelName, "-i2v"):
		if len(req.Images) != 1 {
			return "", fmt.Errorf("happyhorse i2v requires exactly 1 first-frame image, got %d", len(req.Images))
		}
		return constant.TaskActionGenerate, nil
	case strings.Contains(modelName, "-r2v"):
		if strings.TrimSpace(req.Prompt) == "" {
			return "", fmt.Errorf("prompt is required")
		}
		if len(req.Images) < 1 || len(req.Images) > 9 {
			return "", fmt.Errorf("happyhorse r2v requires 1-9 reference images, got %d", len(req.Images))
		}
		return constant.TaskActionReferenceGenerate, nil
	case strings.Contains(modelName, "-video-edit"):
		if strings.TrimSpace(req.Prompt) == "" {
			return "", fmt.Errorf("prompt is required")
		}
		if len(req.Videos) != 1 {
			return "", fmt.Errorf("happyhorse video-edit requires exactly 1 video, got %d", len(req.Videos))
		}
		if len(req.Images) > 5 {
			return "", fmt.Errorf("happyhorse video-edit supports at most 5 reference images, got %d", len(req.Images))
		}
		return constant.TaskActionRemix, nil
	default:
		return "", fmt.Errorf("unsupported happyhorse model: %s", req.Model)
	}
}

func inferBailianKlingAction(req relaycommon.TaskSubmitReq) (string, error) {
	var media []AliMediaItem
	var multiShot bool
	var shotType string
	var multiPrompt []AliMultiPromptItem
	if req.Metadata != nil {
		if mediaValue, ok := req.Metadata["media"]; ok {
			if err := decodeMetadataInto(mediaValue, &media); err != nil {
				return "", errors.Wrap(err, "decode kling media failed")
			}
		}
		if value, ok := getBoolMetadata(req.Metadata, "multi_shot"); ok {
			multiShot = value
		}
		if value, ok := getStringMetadata(req.Metadata, "shot_type"); ok {
			shotType = value
		}
		if value, ok := req.Metadata["multi_prompt"]; ok {
			if err := decodeMetadataInto(value, &multiPrompt); err != nil {
				return "", errors.Wrap(err, "decode kling multi_prompt failed")
			}
		}
	}
	if strings.TrimSpace(req.Prompt) == "" && !(multiShot && shotType == "customize" && len(multiPrompt) > 0) {
		return "", fmt.Errorf("prompt is required")
	}
	if len(media) == 0 {
		switch {
		case len(req.Videos) > 0:
			media = append(media, AliMediaItem{Type: "base", URL: req.Videos[0]})
			for _, url := range req.Images {
				media = append(media, AliMediaItem{Type: "refer", URL: url})
			}
		case len(req.Images) == 1:
			media = []AliMediaItem{{Type: "first_frame", URL: req.Images[0]}}
		case len(req.Images) >= 2:
			media = []AliMediaItem{{Type: "first_frame", URL: req.Images[0]}, {Type: "last_frame", URL: req.Images[1]}}
		}
	}

	if len(media) == 0 {
		return constant.TaskActionTextGenerate, nil
	}
	if containsMediaType(media, "base") {
		return constant.TaskActionRemix, nil
	}
	if containsMediaType(media, "feature") || containsMediaType(media, "refer") {
		return constant.TaskActionReferenceGenerate, nil
	}
	if containsMediaType(media, "last_frame") {
		return constant.TaskActionFirstTailGenerate, nil
	}
	return constant.TaskActionGenerate, nil
}

func decodeMetadataInto(value any, out any) error {
	raw, err := common.Marshal(value)
	if err != nil {
		return err
	}
	return common.Unmarshal(raw, out)
}

func getStringMetadata(metadata map[string]any, key string) (string, bool) {
	value, ok := metadata[key]
	if !ok {
		return "", false
	}
	str, ok := value.(string)
	if !ok || strings.TrimSpace(str) == "" {
		return "", false
	}
	return str, true
}

func getBoolMetadata(metadata map[string]any, key string) (bool, bool) {
	value, ok := metadata[key]
	if !ok {
		return false, false
	}
	boolValue, ok := value.(bool)
	return boolValue, ok
}

func getIntMetadata(metadata map[string]any, key string) (int, bool) {
	value, ok := metadata[key]
	if !ok {
		return 0, false
	}
	switch typed := value.(type) {
	case int:
		return typed, true
	case int32:
		return int(typed), true
	case int64:
		return int(typed), true
	case float64:
		return int(typed), true
	default:
		return 0, false
	}
}

func resolveTaskDuration(req relaycommon.TaskSubmitReq, fallback int) int {
	if req.Duration > 0 {
		return req.Duration
	}
	if req.Seconds != "" {
		if seconds, err := strconv.Atoi(req.Seconds); err == nil && seconds > 0 {
			return seconds
		}
	}
	return fallback
}

func defaultAliResolution(size string, fallback string) string {
	if strings.TrimSpace(size) == "" {
		return fallback
	}
	resolution := strings.ToUpper(strings.TrimSpace(size))
	if strings.Contains(resolution, "*") {
		if converted, err := sizeToResolution(resolution); err == nil {
			return converted
		}
		return fallback
	}
	if !strings.HasSuffix(resolution, "P") {
		resolution += "P"
	}
	return resolution
}

func isHappyHorseModel(modelName string) bool {
	normalized := strings.ToLower(strings.TrimSpace(modelName))
	return strings.HasPrefix(normalized, "happyhorse-1.0") || strings.HasPrefix(normalized, "happyhorse-1.1")
}

func isBailianKlingModel(modelName string) bool {
	normalized := strings.ToLower(strings.TrimSpace(modelName))
	return strings.HasPrefix(normalized, "kling/kling-v3-")
}

func modeFromSize(size string) string {
	switch strings.ToUpper(strings.TrimSpace(size)) {
	case "720P":
		return "std"
	default:
		return "pro"
	}
}

func containsMediaType(media []AliMediaItem, target string) bool {
	for _, item := range media {
		if item.Type == target {
			return true
		}
	}
	return false
}

func countMediaType(media []AliMediaItem, target string) int {
	count := 0
	for _, item := range media {
		if item.Type == target {
			count++
		}
	}
	return count
}

func validateBailianKlingPayload(modelName string, req *AliVideoRequest) error {
	isOmni := strings.Contains(strings.ToLower(modelName), "omni")
	media := req.Input.Media

	if req.Input.MultiShot != nil && *req.Input.MultiShot {
		if req.Input.ShotType == nil || strings.TrimSpace(*req.Input.ShotType) == "" {
			return fmt.Errorf("kling multi_shot requires shot_type")
		}
		if *req.Input.ShotType == "customize" && len(req.Input.MultiPrompt) == 0 {
			return fmt.Errorf("kling shot_type customize requires multi_prompt")
		}
	}

	for _, item := range media {
		switch item.Type {
		case "first_frame", "last_frame":
		case "refer", "base", "feature":
			if !isOmni {
				return fmt.Errorf("kling v3 standard model does not support media type %q", item.Type)
			}
		default:
			return fmt.Errorf("unsupported kling media type %q", item.Type)
		}
	}

	hasRefer := countMediaType(media, "refer") > 0
	hasBase := countMediaType(media, "base") > 0
	hasFeature := countMediaType(media, "feature") > 0
	hasFirstFrame := countMediaType(media, "first_frame") > 0
	elementCount := len(req.Input.ElementList)
	if elementCount > 0 {
		switch {
		case hasRefer && (hasBase || hasFeature):
			if countMediaType(media, "refer")+elementCount > 4 {
				return fmt.Errorf("kling refer images and element_list total must be <= 4 when combined with base or feature")
			}
		case hasRefer:
			if countMediaType(media, "refer")+elementCount > 7 {
				return fmt.Errorf("kling refer images and element_list total must be <= 7")
			}
		case hasFirstFrame:
			if elementCount > 3 {
				return fmt.Errorf("kling first-frame generation supports at most 3 elements")
			}
		}
	}
	if req.Parameters != nil && req.Parameters.Audio != nil && *req.Parameters.Audio && (hasBase || hasFeature) {
		return fmt.Errorf("kling audio must be false when media includes base or feature video")
	}

	if !isOmni {
		switch {
		case len(media) == 0:
			return nil
		case countMediaType(media, "first_frame") == 1 && len(media) == 1:
			return nil
		case countMediaType(media, "first_frame") == 1 && countMediaType(media, "last_frame") == 1 && len(media) == 2:
			return nil
		default:
			return fmt.Errorf("kling v3 standard model only supports text, first_frame, or first_frame+last_frame")
		}
	}

	switch {
	case len(media) == 0:
		return nil
	case countMediaType(media, "first_frame") == 1 && len(media) == 1:
		return nil
	case countMediaType(media, "first_frame") == 1 && countMediaType(media, "last_frame") == 1 && len(media) == 2:
		return nil
	case countMediaType(media, "refer") == len(media):
		return nil
	case countMediaType(media, "feature") == 1 && len(media) == 1:
		return nil
	case countMediaType(media, "feature") == 1 && countMediaType(media, "refer")+countMediaType(media, "feature") == len(media):
		return nil
	case countMediaType(media, "feature") == 1 && countMediaType(media, "first_frame") == 1 && len(media) == 2:
		return nil
	case countMediaType(media, "base") == 1 && len(media) == 1:
		return nil
	case countMediaType(media, "base") == 1 && countMediaType(media, "refer")+countMediaType(media, "base") == len(media):
		return nil
	default:
		return fmt.Errorf("unsupported kling omni media combination")
	}
}
