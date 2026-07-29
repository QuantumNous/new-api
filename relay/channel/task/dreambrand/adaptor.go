package dreambrand

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

type requestPayload struct {
	Prompt        string            `json:"prompt"`
	Model         string            `json:"model"`
	Content       []json.RawMessage `json:"content,omitempty"`
	Size          *string           `json:"size,omitempty"`
	Resolution    *string           `json:"resolution,omitempty"`
	Duration      *string           `json:"duration,omitempty"`
	AspectRatio   *string           `json:"aspectRatio,omitempty"`
	Ratio         *string           `json:"ratio,omitempty"`
	Pic           *string           `json:"pic,omitempty"`
	Pic2          *string           `json:"pic2,omitempty"`
	Pics          []string          `json:"pics,omitempty"`
	Audio         *bool             `json:"audio,omitempty"`
	GenerateAudio *bool             `json:"generate_audio,omitempty"`
	VideoType     *string           `json:"videoType,omitempty"`
	Watermark     *bool             `json:"watermark,omitempty"`
}

type createResponse struct {
	ID      string          `json:"id"`
	TaskID  string          `json:"task_id"`
	Status  string          `json:"status"`
	Created int64           `json:"created"`
	Code    json.RawMessage `json:"code"`
	Message string          `json:"message"`
	Msg     string          `json:"msg"`
	Error   json.RawMessage `json:"error"`
}

type createResponseEnvelope struct {
	Data createResponse `json:"data"`
}

type taskResponse struct {
	ID      string          `json:"id"`
	TaskID  string          `json:"task_id"`
	Status  string          `json:"status"`
	URL     string          `json:"url"`
	Created int64           `json:"created"`
	Message string          `json:"message"`
	Msg     string          `json:"msg"`
	Reason  string          `json:"reason"`
	Error   json.RawMessage `json:"error"`
	Code    json.RawMessage `json:"code"`
}

type taskResponseEnvelope struct {
	Data taskResponse `json:"data"`
}

type videoMetadata struct {
	Content       []json.RawMessage `json:"content,omitempty"`
	Resolution    *string           `json:"resolution,omitempty"`
	Ratio         *string           `json:"ratio,omitempty"`
	GenerateAudio *bool             `json:"generate_audio,omitempty"`
	Watermark     *bool             `json:"watermark,omitempty"`
}

type contentItem struct {
	Type     string    `json:"type,omitempty"`
	Text     string    `json:"text,omitempty"`
	ImageURL *mediaURL `json:"image_url,omitempty"`
	VideoURL *mediaURL `json:"video_url,omitempty"`
	AudioURL *mediaURL `json:"audio_url,omitempty"`
	Role     string    `json:"role,omitempty"`
}

type mediaURL struct {
	URL string `json:"url,omitempty"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	baseURL string
	apiKey  string
}

func buildURL(baseURL, path string) string {
	return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(path, "/")
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if taskErr := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate); taskErr != nil {
		return taskErr
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return localTaskError(err)
	}
	options, optionErr := resolveVideoMetadata(req)
	if optionErr != nil {
		return localTaskError(optionErr)
	}
	if len(referenceImages(req))+len(options.imageURLs) > 9 {
		return localTaskError(errors.New("DreamBrand Seedance 2.0 supports at most 9 reference images"))
	}
	resolution := req.Size
	if options.resolution != "" {
		resolution = options.resolution
	}
	if ResolveModelName(req.Model) == "seedance-2.0-fast" && resolution != "" && resolution != "720p" {
		return localTaskError(errors.New("seedance-2.0-fast supports resolutions up to 720p"))
	}
	if duration, ok := resolveDuration(req); ok {
		seconds, parseErr := strconv.Atoi(duration)
		if parseErr != nil || seconds < 4 || seconds > 15 {
			return localTaskError(errors.New("DreamBrand video duration must be between 4 and 15 seconds"))
		}
	}
	return nil
}

func localTaskError(err error) *dto.TaskError {
	return &dto.TaskError{Code: "invalid_request", Message: err.Error(), StatusCode: http.StatusBadRequest, LocalError: true, Error: err}
}

func upstreamModelName(info *relaycommon.RelayInfo) string {
	if info == nil || info.ChannelMeta == nil {
		return ""
	}
	return info.UpstreamModelName
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return buildURL(a.baseURL, VideoCreatePath), nil
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

	payload := requestPayload{
		Prompt: req.Prompt,
	}
	modelName := upstreamModelName(info)
	if modelName == "" {
		modelName = req.Model
	}
	payload.Model = ResolveModelName(modelName)
	if info.ChannelMeta != nil {
		info.UpstreamModelName = payload.Model
	}
	options, err := resolveVideoMetadata(req)
	if err != nil {
		return nil, err
	}
	resolution := req.Size
	if options.resolution != "" {
		resolution = options.resolution
	}
	if resolution != "" {
		payload.Size = stringPointer(resolution)
		payload.Resolution = stringPointer(resolution)
	}
	if options.ratio != "" {
		payload.AspectRatio = stringPointer(options.ratio)
		payload.Ratio = stringPointer(options.ratio)
	}
	payload.Content = options.content
	payload.Audio = options.generateAudio
	payload.GenerateAudio = options.generateAudio
	payload.Watermark = options.watermark
	references := append(referenceImages(req), options.imageURLs...)
	if len(references) > 0 {
		payload.Pic = stringPointer(references[0])
	}
	if duration, ok := resolveDuration(req); ok {
		payload.Duration = stringPointer(duration)
	}
	if len(references) > 1 {
		payload.Pic2 = stringPointer(references[1])
	}
	if len(references) > 2 {
		payload.Pics = references[2:]
	}
	if len(references) > 2 || options.referenceMode || options.hasVideoOrAudio {
		payload.VideoType = stringPointer("1")
	} else if len(references) == 2 {
		payload.VideoType = stringPointer("0")
	}

	data, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func stringPointer(value string) *string {
	return &value
}

func resolveDuration(req relaycommon.TaskSubmitReq) (string, bool) {
	seconds := strings.TrimSpace(req.Seconds)
	if seconds != "" {
		return seconds, true
	}
	if req.DurationSet || req.Duration != 0 {
		return strconv.Itoa(req.Duration), true
	}
	return "", false
}

type resolvedVideoMetadata struct {
	content         []json.RawMessage
	imageURLs       []string
	resolution      string
	ratio           string
	generateAudio   *bool
	watermark       *bool
	referenceMode   bool
	hasVideoOrAudio bool
}

func resolveVideoMetadata(req relaycommon.TaskSubmitReq) (resolvedVideoMetadata, error) {
	var metadata videoMetadata
	if err := req.UnmarshalMetadata(&metadata); err != nil {
		return resolvedVideoMetadata{}, err
	}
	result := resolvedVideoMetadata{
		generateAudio: metadata.GenerateAudio,
		watermark:     metadata.Watermark,
	}
	if metadata.Resolution != nil {
		result.resolution = strings.TrimSpace(*metadata.Resolution)
	}
	if metadata.Ratio != nil {
		result.ratio = strings.TrimSpace(*metadata.Ratio)
	}

	videoCount := 0
	audioCount := 0
	for _, raw := range metadata.Content {
		var item contentItem
		if err := common.Unmarshal(raw, &item); err != nil {
			return resolvedVideoMetadata{}, fmt.Errorf("metadata.content contains an invalid item: %w", err)
		}
		itemType := strings.TrimSpace(item.Type)
		if itemType == "text" {
			continue
		}
		switch itemType {
		case "image_url":
			if item.ImageURL == nil || strings.TrimSpace(item.ImageURL.URL) == "" {
				return resolvedVideoMetadata{}, errors.New("metadata.content image_url item requires image_url.url")
			}
			result.imageURLs = append(result.imageURLs, strings.TrimSpace(item.ImageURL.URL))
			if item.Role == "reference_image" {
				result.referenceMode = true
			}
		case "video_url":
			if item.VideoURL == nil || strings.TrimSpace(item.VideoURL.URL) == "" {
				return resolvedVideoMetadata{}, errors.New("metadata.content video_url item requires video_url.url")
			}
			videoCount++
			result.hasVideoOrAudio = true
		case "audio_url":
			if item.AudioURL == nil || strings.TrimSpace(item.AudioURL.URL) == "" {
				return resolvedVideoMetadata{}, errors.New("metadata.content audio_url item requires audio_url.url")
			}
			audioCount++
			result.hasVideoOrAudio = true
		default:
			return resolvedVideoMetadata{}, fmt.Errorf("unsupported metadata.content type: %s", itemType)
		}
		result.content = append(result.content, raw)
	}
	if videoCount > 3 {
		return resolvedVideoMetadata{}, errors.New("Seedance 2.0 supports at most 3 reference videos")
	}
	if audioCount > 3 {
		return resolvedVideoMetadata{}, errors.New("Seedance 2.0 supports at most 3 reference audio files")
	}
	if audioCount > 0 && videoCount == 0 && len(result.imageURLs)+len(referenceImages(req)) == 0 {
		return resolvedVideoMetadata{}, errors.New("reference audio requires at least one reference image or video")
	}
	textContent, err := common.Marshal(contentItem{Type: "text", Text: req.Prompt})
	if err != nil {
		return resolvedVideoMetadata{}, err
	}
	result.content = append(result.content, textContent)
	return result, nil
}

func referenceImages(req relaycommon.TaskSubmitReq) []string {
	standard := make([]string, 0, len(req.Images)+2)
	for _, image := range req.Images {
		if image = strings.TrimSpace(image); image != "" {
			standard = append(standard, image)
		}
	}
	if len(standard) == 0 {
		for _, image := range []string{req.Image, req.InputReference} {
			if image = strings.TrimSpace(image); image != "" {
				standard = append(standard, image)
				break
			}
		}
	}
	return standard
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	created, err := parseCreateResponse(responseBody)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
	}
	taskID = created.ID
	if taskID == "" {
		taskID = created.TaskID
	}
	if taskID == "" {
		code, message := parseUpstreamError(responseBody)
		if message != "" {
			if code == "" {
				code = "upstream_error"
			}
			return "", nil, service.TaskErrorWrapper(errors.New(message), code, http.StatusBadRequest)
		}
		return "", nil, service.TaskErrorWrapper(errors.New("task_id is empty"), "invalid_response", http.StatusInternalServerError)
	}

	video := dto.NewOpenAIVideo()
	video.ID = info.PublicTaskID
	video.TaskID = info.PublicTaskID
	video.CreatedAt = time.Now().Unix()
	video.Model = info.OriginModelName
	if req, getErr := relaycommon.GetTaskRequest(c); getErr == nil {
		video.Size = req.Size
		if duration, ok := resolveDuration(req); ok {
			video.Seconds = duration
		}
	}
	c.JSON(http.StatusOK, video)

	return taskID, responseBody, nil
}

func parseUpstreamError(body []byte) (string, string) {
	var response struct {
		Code    json.RawMessage `json:"code"`
		Message string          `json:"message"`
		Msg     string          `json:"msg"`
		Error   json.RawMessage `json:"error"`
		Data    json.RawMessage `json:"data"`
	}
	if err := common.Unmarshal(body, &response); err != nil {
		return "", ""
	}
	code := strings.Trim(string(response.Code), `"`)
	message := strings.TrimSpace(response.Message)
	if message == "" {
		message = strings.TrimSpace(response.Msg)
	}
	if message == "" && len(response.Error) > 0 && string(response.Error) != "null" {
		var errorText string
		if err := common.Unmarshal(response.Error, &errorText); err == nil {
			message = errorText
		} else {
			var errorObject struct {
				Code    json.RawMessage `json:"code"`
				Message string          `json:"message"`
				Msg     string          `json:"msg"`
			}
			if err := common.Unmarshal(response.Error, &errorObject); err == nil {
				message = strings.TrimSpace(errorObject.Message)
				if message == "" {
					message = strings.TrimSpace(errorObject.Msg)
				}
				if code == "" {
					code = strings.Trim(string(errorObject.Code), `"`)
				}
			}
		}
	}
	if message == "" && len(response.Data) > 0 && string(response.Data) != "null" {
		dataCode, dataMessage := parseUpstreamError(response.Data)
		if code == "" {
			code = dataCode
		}
		message = dataMessage
	}
	return code, message
}

func parseCreateResponse(body []byte) (createResponse, error) {
	var direct createResponse
	if err := common.Unmarshal(body, &direct); err != nil {
		return createResponse{}, err
	}
	if direct.ID != "" || direct.TaskID != "" {
		return direct, nil
	}

	var envelope createResponseEnvelope
	if err := common.Unmarshal(body, &envelope); err != nil {
		return createResponse{}, err
	}
	return envelope.Data, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, errors.New("invalid task_id")
	}

	response, err := fetchTaskURL(baseURL, key, proxy, fmt.Sprintf(VideoQueryPath, url.PathEscape(taskID)))
	if err != nil || response == nil || response.StatusCode != http.StatusNotFound {
		return response, err
	}
	_ = response.Body.Close()
	return fetchTaskURL(baseURL, key, proxy, fmt.Sprintf(LegacyVideoQueryPath, url.PathEscape(taskID)))
}

func fetchTaskURL(baseURL, key, proxy, path string) (*http.Response, error) {
	uri := buildURL(baseURL, path)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func parseTaskResponse(body []byte) (taskResponse, error) {
	var direct taskResponse
	if err := common.Unmarshal(body, &direct); err != nil {
		return taskResponse{}, err
	}
	if direct.ID != "" || direct.TaskID != "" || direct.Status != "" || direct.URL != "" ||
		direct.Message != "" || direct.Msg != "" || direct.Reason != "" || len(direct.Error) > 0 || len(direct.Code) > 0 {
		return direct, nil
	}

	var envelope taskResponseEnvelope
	if err := common.Unmarshal(body, &envelope); err != nil {
		return taskResponse{}, err
	}
	return envelope.Data, nil
}

func normalizeStatus(status string) model.TaskStatus {
	normalized := strings.ToLower(strings.TrimSpace(status))
	normalized = strings.NewReplacer("-", "_", " ", "_").Replace(normalized)
	switch normalized {
	case "submitted", "created", "not_start", "not_started":
		return model.TaskStatusSubmitted
	case "queued", "queue", "pending", "waiting":
		return model.TaskStatusQueued
	case "processing", "in_progress", "running", "generating":
		return model.TaskStatusInProgress
	case "success", "succeeded", "completed", "complete", "done":
		return model.TaskStatusSuccess
	case "failed", "failure", "error", "cancelled", "canceled", "expired":
		return model.TaskStatusFailure
	default:
		return model.TaskStatusInProgress
	}
}

func errorReason(response taskResponse) string {
	for _, value := range []string{response.Message, response.Msg, response.Reason} {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	if len(response.Error) == 0 || string(response.Error) == "null" {
		return strings.Trim(string(response.Code), `"`)
	}
	var message string
	if err := common.Unmarshal(response.Error, &message); err == nil {
		return message
	}
	var object struct {
		Message string `json:"message"`
		Msg     string `json:"msg"`
		Code    string `json:"code"`
	}
	if err := common.Unmarshal(response.Error, &object); err == nil {
		for _, value := range []string{object.Message, object.Msg, object.Code} {
			if strings.TrimSpace(value) != "" {
				return value
			}
		}
	}
	return string(response.Error)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	response, err := parseTaskResponse(respBody)
	if err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}
	status := normalizeStatus(response.Status)
	reason := errorReason(response)
	if reason == "" {
		_, reason = parseUpstreamError(respBody)
	}
	if strings.TrimSpace(response.Status) == "" && reason != "" {
		status = model.TaskStatusFailure
	}
	result := &relaycommon.TaskInfo{
		TaskID: response.ID,
		Status: string(status),
		Url:    response.URL,
		Reason: reason,
	}
	if result.TaskID == "" {
		result.TaskID = response.TaskID
	}
	switch status {
	case model.TaskStatusSubmitted:
		result.Progress = taskcommon.ProgressSubmitted
	case model.TaskStatusQueued:
		result.Progress = taskcommon.ProgressQueued
	case model.TaskStatusInProgress:
		result.Progress = taskcommon.ProgressInProgress
	case model.TaskStatusSuccess, model.TaskStatusFailure:
		result.Progress = taskcommon.ProgressComplete
	}
	return result, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	response, err := parseTaskResponse(originTask.Data)
	if err != nil {
		return nil, errors.Wrap(err, "unmarshal dreambrand task data failed")
	}

	video := dto.NewOpenAIVideo()
	video.ID = originTask.TaskID
	video.TaskID = originTask.TaskID
	video.Status = originTask.Status.ToVideoStatus()
	video.SetProgressStr(originTask.Progress)
	video.CreatedAt = originTask.CreatedAt
	if response.Created > 0 {
		video.CreatedAt = response.Created
	}
	video.CompletedAt = originTask.UpdatedAt
	video.Model = originTask.Properties.OriginModelName
	resultURL := response.URL
	if resultURL == "" {
		resultURL = originTask.GetResultURL()
	}
	if resultURL != "" {
		video.SetMetadata("url", resultURL)
	}
	if originTask.Status == model.TaskStatusFailure {
		message := errorReason(response)
		if message == "" {
			message = originTask.FailReason
		}
		code := strings.ToLower(strings.TrimSpace(response.Status))
		if code == "" {
			code = "failed"
		}
		video.Error = &dto.OpenAIVideoError{
			Message: message,
			Code:    code,
		}
	}
	return common.Marshal(video)
}

func (a *TaskAdaptor) GetModelList() []string {
	return VideoModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}
