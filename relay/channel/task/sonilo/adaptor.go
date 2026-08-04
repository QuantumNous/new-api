package sonilo

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"mime/multipart"
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
)

const requestContextKey = "sonilo_video_to_music_request"

type submitRequest struct {
	Model           string
	VideoURL        string
	Video           *multipart.FileHeader
	Prompt          string
	Segments        string
	OutputFormat    string
	PreserveSpeech  *bool
	Ducking         *bool
	VariantsNum     int
	DurationSeconds float64
}

type upstreamTask struct {
	TaskID          string          `json:"task_id"`
	Status          string          `json:"status"`
	Type            string          `json:"type,omitempty"`
	Title           string          `json:"title,omitempty"`
	DurationSeconds float64         `json:"duration_seconds,omitempty"`
	Audio           []upstreamAudio `json:"audio,omitempty"`
	Error           any             `json:"error,omitempty"`
}

type upstreamAudio struct {
	URL           string `json:"url"`
	ContentType   string `json:"content_type,omitempty"`
	FileSizeBytes int64  `json:"file_size_bytes,omitempty"`
	StreamIndex   int    `json:"stream_index,omitempty"`
}

type publicAudio struct {
	URL           string `json:"url"`
	ContentType   string `json:"content_type,omitempty"`
	FileSizeBytes int64  `json:"file_size_bytes,omitempty"`
	StreamIndex   int    `json:"stream_index,omitempty"`
}

type publicResponse struct {
	ID              string        `json:"id"`
	TaskID          string        `json:"task_id"`
	Status          string        `json:"status"`
	Model           string        `json:"model"`
	CreatedAt       int64         `json:"created_at,omitempty"`
	DurationSeconds float64       `json:"duration_seconds,omitempty"`
	Audio           []publicAudio `json:"audio,omitempty"`
	Error           *publicError  `json:"error,omitempty"`
}

type publicError struct {
	Message string `json:"message"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey      string
	baseURL     string
	contentType string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.apiKey = info.ApiKey
	a.baseURL = strings.TrimRight(info.ChannelBaseUrl, "/")
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if !strings.HasPrefix(strings.ToLower(c.GetHeader("Content-Type")), "multipart/form-data") {
		return localTaskError("content type must be multipart/form-data", "invalid_content_type")
	}
	if _, err := c.MultipartForm(); err != nil {
		return localTaskError("invalid multipart form", "invalid_multipart_form")
	}

	modelName := strings.TrimSpace(c.PostForm("model"))
	if modelName == "" {
		return localTaskError("model is required", "missing_model")
	}
	if modelName != ModelVideoToMusic {
		return localTaskError("unsupported model", "unsupported_model")
	}

	videoURL := strings.TrimSpace(c.PostForm("video_url"))
	video, fileErr := c.FormFile("video")
	hasVideo := fileErr == nil && video != nil
	if (videoURL == "") == !hasVideo {
		return localTaskError("exactly one of video or video_url is required", "invalid_video_source")
	}
	if videoURL != "" {
		if err := taskcommon.ValidateRemoteMediaURL(videoURL); err != nil {
			return localTaskError(err.Error(), "invalid_video_url")
		}
	}

	duration, err := strconv.ParseFloat(strings.TrimSpace(c.PostForm("duration_seconds")), 64)
	if err != nil || duration <= 0 || math.IsNaN(duration) || math.IsInf(duration, 0) {
		return localTaskError("duration_seconds must be a positive number", "invalid_duration_seconds")
	}
	if duration > 3600 {
		return localTaskError("duration_seconds must not exceed 3600", "invalid_duration_seconds")
	}

	outputFormat := strings.ToLower(strings.TrimSpace(c.PostForm("output_format")))
	if outputFormat == "" {
		outputFormat = "mp3"
	}
	if outputFormat != "mp3" && outputFormat != "m4a" && outputFormat != "wav" {
		return localTaskError("output_format must be one of mp3, m4a, or wav", "invalid_output_format")
	}

	variants := 1
	if raw := strings.TrimSpace(c.PostForm("variants_num")); raw != "" {
		variants, err = strconv.Atoi(raw)
		if err != nil || variants < 1 || variants > 10 {
			return localTaskError("variants_num must be an integer from 1 to 10", "invalid_variants_num")
		}
	}
	preserveSpeech, err := optionalBool(c.PostForm("preserve_speech"))
	if err != nil {
		return localTaskError("preserve_speech must be true or false", "invalid_preserve_speech")
	}
	ducking, err := optionalBool(c.PostForm("ducking"))
	if err != nil {
		return localTaskError("ducking must be true or false", "invalid_ducking")
	}

	req := submitRequest{
		Model:           modelName,
		VideoURL:        videoURL,
		Video:           video,
		Prompt:          c.PostForm("prompt"),
		Segments:        c.PostForm("segments"),
		OutputFormat:    outputFormat,
		PreserveSpeech:  preserveSpeech,
		Ducking:         ducking,
		VariantsNum:     variants,
		DurationSeconds: duration,
	}
	c.Set(requestContextKey, req)
	relaycommon.StoreTaskRequest(c, info, constant.TaskActionGenerate, relaycommon.TaskSubmitReq{Model: modelName})
	return nil
}

func optionalBool(raw string) (*bool, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	v, err := strconv.ParseBool(strings.TrimSpace(raw))
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func requestFromContext(c *gin.Context) (submitRequest, error) {
	v, ok := c.Get(requestContextKey)
	if !ok {
		return submitRequest{}, fmt.Errorf("validated request not found")
	}
	req, ok := v.(submitRequest)
	if !ok {
		return submitRequest{}, fmt.Errorf("invalid validated request")
	}
	return req, nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, _ *relaycommon.RelayInfo) map[string]float64 {
	req, err := requestFromContext(c)
	if err != nil {
		return nil
	}
	return map[string]float64{
		"seconds":  math.Max(req.DurationSeconds, 10),
		"variants": float64(req.VariantsNum),
	}
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	if a.baseURL == "" {
		a.baseURL = "https://api.sonilo.com"
	}
	return a.baseURL + "/v1/video-to-music", nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, _ *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := requestFromContext(c)
	if err != nil {
		return nil, err
	}
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	writeField := func(name, value string) error {
		if value == "" {
			return nil
		}
		return w.WriteField(name, value)
	}
	if req.Video != nil {
		file, err := req.Video.Open()
		if err != nil {
			return nil, fmt.Errorf("open video: %w", err)
		}
		defer file.Close()
		part, err := w.CreateFormFile("video", req.Video.Filename)
		if err != nil {
			return nil, err
		}
		if _, err := io.Copy(part, file); err != nil {
			return nil, err
		}
	} else if err := writeField("video_url", req.VideoURL); err != nil {
		return nil, err
	}
	for _, field := range [][2]string{
		{"prompt", req.Prompt},
		{"segments", req.Segments},
		{"output_format", req.OutputFormat},
		{"variants_num", strconv.Itoa(req.VariantsNum)},
		{"mode", "async"},
	} {
		if err := writeField(field[0], field[1]); err != nil {
			return nil, err
		}
	}
	if req.PreserveSpeech != nil {
		_ = w.WriteField("preserve_speech", strconv.FormatBool(*req.PreserveSpeech))
	}
	if req.Ducking != nil {
		_ = w.WriteField("ducking", strconv.FormatBool(*req.Ducking))
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	a.contentType = w.FormDataContentType()
	return bytes.NewReader(body.Bytes()), nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", a.contentType)
	return nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, body io.Reader) (*http.Response, error) {
	resp, err := channel.DoTaskApiRequest(a, c, info, body)
	normalizeAcceptedResponse(resp)
	return resp, err
}

func normalizeAcceptedResponse(resp *http.Response) {
	if resp != nil && resp.StatusCode == http.StatusAccepted {
		resp.StatusCode = http.StatusOK
	}
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *dto.TaskError) {
	if resp == nil || resp.Body == nil {
		return "", nil, service.TaskErrorWrapperLocal(fmt.Errorf("empty upstream response"), "invalid_response", http.StatusBadGateway)
	}
	body, err := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if err != nil {
		return "", nil, service.TaskErrorWrapperLocal(err, "read_response_body_failed", http.StatusBadGateway)
	}
	var result upstreamTask
	if err := common.Unmarshal(body, &result); err != nil || strings.TrimSpace(result.TaskID) == "" {
		return "", nil, service.TaskErrorWrapperLocal(fmt.Errorf("invalid upstream response"), "invalid_response", http.StatusBadGateway)
	}
	public := publicResponse{
		ID:        info.PublicTaskID,
		TaskID:    info.PublicTaskID,
		Status:    "processing",
		Model:     info.OriginModelName,
		CreatedAt: time.Now().Unix(),
	}
	c.JSON(http.StatusOK, public)
	return result.TaskID, body, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, _ := body["task_id"].(string)
	if strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	uri := strings.TrimRight(baseURL, "/") + "/v1/tasks/" + url.PathEscape(taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Accept", "application/json")
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, err
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(body []byte) (*relaycommon.TaskInfo, error) {
	var result upstreamTask
	if err := common.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("invalid task response: %w", err)
	}
	info := &relaycommon.TaskInfo{Code: 0, TaskID: result.TaskID}
	switch strings.ToLower(result.Status) {
	case "queued", "pending":
		info.Status = model.TaskStatusQueued
		info.Progress = taskcommon.ProgressQueued
	case "processing", "running", "in_progress":
		info.Status = model.TaskStatusInProgress
		info.Progress = taskcommon.ProgressInProgress
	case "succeeded", "completed", "success":
		info.Status = model.TaskStatusSuccess
		info.Progress = taskcommon.ProgressComplete
		if len(result.Audio) > 0 {
			info.Url = result.Audio[0].URL
		}
	case "failed", "failure", "cancelled", "canceled":
		info.Status = model.TaskStatusFailure
		info.Progress = taskcommon.ProgressComplete
		info.Reason = taskcommon.ScrubBrandedText(upstreamErrorMessage(result.Error))
		if info.Reason == "" {
			info.Reason = "task failed at upstream provider"
		}
	default:
		return nil, fmt.Errorf("unknown upstream task status")
	}
	return info, nil
}

func upstreamErrorMessage(v any) string {
	switch value := v.(type) {
	case string:
		return value
	case map[string]any:
		if message, ok := value["message"].(string); ok {
			return message
		}
	}
	return ""
}

func (a *TaskAdaptor) AdjustPerCallBillingOnComplete(task *model.Task, _ *relaycommon.TaskInfo) int {
	if task == nil || task.Quota <= 0 || task.PrivateData.BillingContext == nil {
		return 0
	}
	reserved := task.PrivateData.BillingContext.OtherRatios["seconds"]
	if reserved <= 0 || math.IsNaN(reserved) || math.IsInf(reserved, 0) {
		return 0
	}
	var result upstreamTask
	if err := common.Unmarshal(task.Data, &result); err != nil || result.DurationSeconds <= 0 {
		return 0
	}
	actual := math.Max(result.DurationSeconds, 10)
	quota := math.Round(float64(task.Quota) * actual / reserved)
	if quota <= 0 || quota > float64(math.MaxInt) {
		return 0
	}
	return int(quota)
}

func (a *TaskAdaptor) GetModelList() []string { return ModelList }
func (a *TaskAdaptor) GetChannelName() string { return ChannelName }

func (a *TaskAdaptor) ConvertToVideoToMusic(task *model.Task) ([]byte, error) {
	response := publicResponse{
		ID:        task.TaskID,
		TaskID:    task.TaskID,
		Status:    publicStatus(task.Status),
		Model:     task.Properties.OriginModelName,
		CreatedAt: task.CreatedAt,
	}
	if task.Status == model.TaskStatusSuccess {
		var result upstreamTask
		if err := common.Unmarshal(task.Data, &result); err != nil {
			return nil, err
		}
		response.DurationSeconds = result.DurationSeconds
		response.Audio = make([]publicAudio, 0, len(result.Audio))
		for i, audio := range result.Audio {
			response.Audio = append(response.Audio, publicAudio{
				URL:           buildAudioProxyURL(task.TaskID, i),
				ContentType:   audio.ContentType,
				FileSizeBytes: audio.FileSizeBytes,
				StreamIndex:   audio.StreamIndex,
			})
		}
	}
	if task.Status == model.TaskStatusFailure {
		response.Error = &publicError{Message: taskcommon.ScrubBrandedText(task.FailReason)}
	}
	return common.Marshal(response)
}

func publicStatus(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusSuccess:
		return "succeeded"
	case model.TaskStatusFailure:
		return "failed"
	default:
		return "processing"
	}
}

func buildAudioProxyURL(taskID string, variant int) string {
	base := strings.TrimRight(taskcommon.BuildProxyURL(taskID), "/")
	base = strings.Replace(base, "/v1/videos/", "/v1/video-to-music/", 1)
	return base + "?variant=" + strconv.Itoa(variant)
}

func ExtractUpstreamAudioURL(taskData []byte, variant int) string {
	var result upstreamTask
	if variant < 0 || common.Unmarshal(taskData, &result) != nil || variant >= len(result.Audio) {
		return ""
	}
	return strings.TrimSpace(result.Audio[variant].URL)
}

func localTaskError(message, code string) *dto.TaskError {
	return service.TaskErrorWrapperLocal(fmt.Errorf("%s", message), code, http.StatusBadRequest)
}
