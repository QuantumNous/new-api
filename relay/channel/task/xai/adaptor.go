package xai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const (
	defaultDuration = 4
	maxDuration     = 15
)

type videoCreateRequest struct {
	Model           string          `json:"model"`
	Prompt          string          `json:"prompt"`
	Duration        json.RawMessage `json:"duration,omitempty"`
	Seconds         json.RawMessage `json:"seconds,omitempty"`
	Size            string          `json:"size,omitempty"`
	AspectRatio     string          `json:"aspect_ratio,omitempty"`
	Resolution      string          `json:"resolution,omitempty"`
	Image           json.RawMessage `json:"image,omitempty"`
	InputReference  json.RawMessage `json:"input_reference,omitempty"`
	ReferenceImages json.RawMessage `json:"reference_images,omitempty"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey  string
	baseURL string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func requestPath(info *relaycommon.RelayInfo) string {
	if info == nil {
		return ""
	}
	path := info.RequestURLPath
	if idx := strings.IndexByte(path, '?'); idx >= 0 {
		path = path[:idx]
	}
	return path
}

func isOpenAICompatiblePath(path string) bool {
	return strings.HasPrefix(path, "/openai/v1/videos")
}

func parseDuration(raw json.RawMessage, fallback int) (int, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return fallback, nil
	}

	var duration int
	if err := common.Unmarshal(raw, &duration); err == nil {
		return duration, nil
	}

	var value string
	if err := common.Unmarshal(raw, &value); err != nil {
		return 0, fmt.Errorf("duration must be an integer")
	}
	duration, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return 0, fmt.Errorf("duration must be an integer")
	}
	return duration, nil
}

func validateDuration(duration int) *taskdto.TaskError {
	if duration < 1 || duration > maxDuration {
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("duration must be between 1 and %d", maxDuration),
			"invalid_duration",
			http.StatusBadRequest,
		)
	}
	return nil
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	var req videoCreateRequest
	contentType := strings.ToLower(c.ContentType())
	if contentType == "multipart/form-data" {
		if !isOpenAICompatiblePath(requestPath(info)) {
			return service.TaskErrorWrapperLocal(
				fmt.Errorf("xAI native video endpoints require application/json"),
				"invalid_request",
				http.StatusBadRequest,
			)
		}
		form, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
		}
		firstValue := func(key string) string {
			values := form.Value[key]
			if len(values) == 0 {
				return ""
			}
			return strings.TrimSpace(values[0])
		}
		req.Model = firstValue("model")
		req.Prompt = firstValue("prompt")
		req.Size = firstValue("size")
		if seconds := firstValue("seconds"); seconds != "" {
			req.Seconds = json.RawMessage(strconv.Quote(seconds))
		}
		if _, ok := form.File["input_reference"]; ok {
			req.InputReference = json.RawMessage(`true`)
		}
	} else if contentType == "application/x-www-form-urlencoded" {
		if !isOpenAICompatiblePath(requestPath(info)) {
			return service.TaskErrorWrapperLocal(
				fmt.Errorf("xAI native video endpoints require application/json"),
				"invalid_request",
				http.StatusBadRequest,
			)
		}
		if err := common.UnmarshalBodyReusable(c, &req); err != nil {
			return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
		}
	} else if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_json", http.StatusBadRequest)
	}

	if req.Model == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("model field is required"), "missing_model", http.StatusBadRequest)
	}
	if isOpenAICompatiblePath(requestPath(info)) && req.Prompt == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("prompt is required"), "invalid_request", http.StatusBadRequest)
	}

	durationRaw := req.Duration
	if isOpenAICompatiblePath(requestPath(info)) {
		durationRaw = req.Seconds
	}
	duration, err := parseDuration(durationRaw, defaultDuration)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_duration", http.StatusBadRequest)
	}
	if taskErr := validateDuration(duration); taskErr != nil {
		return taskErr
	}

	hasImage := len(req.Image) > 0 || len(req.InputReference) > 0 || len(req.ReferenceImages) > 0
	action := constant.TaskActionTextGenerate
	if hasImage {
		action = constant.TaskActionGenerate
	}
	info.Action = action
	c.Set("task_request", relaycommon.TaskSubmitReq{
		Model:    req.Model,
		Prompt:   req.Prompt,
		Size:     req.Size,
		Duration: duration,
	})
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, _ *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	duration := req.Duration
	if duration <= 0 {
		duration = defaultDuration
	}
	if duration > maxDuration {
		duration = maxDuration
	}
	return map[string]float64{"seconds": float64(duration)}
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	path := requestPath(info)
	if isOpenAICompatiblePath(path) {
		return a.baseURL + "/openai/v1/videos", nil
	}

	switch path {
	case "/v1/videos", "/v1/videos/generations", "/v1/videos/edits", "/v1/videos/extensions":
		return a.baseURL + path, nil
	default:
		return "", fmt.Errorf("unsupported xAI video endpoint: %s", path)
	}
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", c.GetHeader("Content-Type"))
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, fmt.Errorf("get request body: %w", err)
	}
	body, err := storage.Bytes()
	if err != nil {
		return nil, fmt.Errorf("read request body: %w", err)
	}

	contentType := strings.ToLower(c.ContentType())
	if contentType != "multipart/form-data" && contentType != "application/x-www-form-urlencoded" {
		var payload map[string]any
		if err := common.Unmarshal(body, &payload); err != nil {
			return nil, fmt.Errorf("decode xAI video request: %w", err)
		}
		payload["model"] = info.UpstreamModelName
		mappedBody, err := common.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("encode xAI video request: %w", err)
		}
		return bytes.NewReader(mappedBody), nil
	}
	if contentType == "application/x-www-form-urlencoded" {
		values, err := url.ParseQuery(string(body))
		if err != nil {
			return nil, fmt.Errorf("parse video form: %w", err)
		}
		values.Set("model", info.UpstreamModelName)
		return strings.NewReader(values.Encode()), nil
	}

	form, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return nil, fmt.Errorf("parse video form: %w", err)
	}
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	if err := writer.WriteField("model", info.UpstreamModelName); err != nil {
		return nil, fmt.Errorf("write model field: %w", err)
	}
	for key, values := range form.Value {
		if key == "model" {
			continue
		}
		for _, value := range values {
			if err := writer.WriteField(key, value); err != nil {
				return nil, fmt.Errorf("write %s field: %w", key, err)
			}
		}
	}
	for fieldName, fileHeaders := range form.File {
		for _, fileHeader := range fileHeaders {
			file, err := fileHeader.Open()
			if err != nil {
				return nil, fmt.Errorf("open %s: %w", fileHeader.Filename, err)
			}
			header := make(textproto.MIMEHeader)
			header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, fileHeader.Filename))
			header.Set("Content-Type", fileHeader.Header.Get("Content-Type"))
			part, err := writer.CreatePart(header)
			if err == nil {
				_, err = io.Copy(part, file)
			}
			closeErr := file.Close()
			if err != nil {
				return nil, fmt.Errorf("copy %s: %w", fileHeader.Filename, err)
			}
			if closeErr != nil {
				return nil, fmt.Errorf("close %s: %w", fileHeader.Filename, closeErr)
			}
		}
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("finish video form: %w", err)
	}
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return &buf, nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, body io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, body)
}

func responseID(payload map[string]any) string {
	if value, ok := payload["request_id"].(string); ok && strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	if value, ok := payload["id"].(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *taskdto.TaskError) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	if err := resp.Body.Close(); err != nil {
		return "", nil, service.TaskErrorWrapper(err, "close_response_body_failed", http.StatusInternalServerError)
	}

	var payload map[string]any
	if err := common.Unmarshal(body, &payload); err != nil {
		return "", nil, service.TaskErrorWrapper(err, "unmarshal_response_body_failed", http.StatusBadGateway)
	}
	upstreamID := responseID(payload)
	if upstreamID == "" {
		return "", nil, service.TaskErrorWrapper(fmt.Errorf("xAI video response did not include request_id"), "invalid_response", http.StatusBadGateway)
	}

	if isOpenAICompatiblePath(requestPath(info)) {
		payload["id"] = info.PublicTaskID
		delete(payload, "request_id")
	} else {
		payload["request_id"] = info.PublicTaskID
		delete(payload, "id")
	}
	publicBody, err := common.Marshal(payload)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "marshal_response_body_failed", http.StatusInternalServerError)
	}
	c.Data(http.StatusOK, "application/json", publicBody)
	return upstreamID, body, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/v1/videos/%s", baseURL, taskID), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client: %w", err)
	}
	return client.Do(req)
}

func errorMessage(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case map[string]any:
		if message, ok := typed["message"].(string); ok {
			return message
		}
	}
	return ""
}

func (a *TaskAdaptor) ParseTaskResult(body []byte) (*relaycommon.TaskInfo, error) {
	var payload struct {
		Status   string `json:"status"`
		Progress int    `json:"progress"`
		Video    struct {
			URL string `json:"url"`
		} `json:"video"`
		Error any `json:"error"`
	}
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode xAI video response: %w", err)
	}

	result := &relaycommon.TaskInfo{Url: strings.TrimSpace(payload.Video.URL)}
	switch strings.ToLower(strings.TrimSpace(payload.Status)) {
	case "queued", "pending":
		result.Status = model.TaskStatusQueued
	case "in_progress", "processing", "running":
		result.Status = model.TaskStatusInProgress
	case "completed", "done", "succeeded", "success":
		result.Status = model.TaskStatusSuccess
	case "failed", "error", "expired", "cancelled", "canceled":
		result.Status = model.TaskStatusFailure
		result.Reason = errorMessage(payload.Error)
	}
	if payload.Progress > 0 {
		result.Progress = fmt.Sprintf("%d%%", payload.Progress)
	}
	return result, nil
}

func (a *TaskAdaptor) ConvertToNativeVideo(task *model.Task) ([]byte, error) {
	payload := make(map[string]any)
	if len(task.Data) > 0 {
		if err := common.Unmarshal(task.Data, &payload); err != nil {
			return nil, fmt.Errorf("decode xAI video task: %w", err)
		}
	}
	payload["request_id"] = task.TaskID
	delete(payload, "id")
	delete(payload, "object")
	if task.Status == model.TaskStatusSuccess && task.GetResultURL() != "" {
		video, _ := payload["video"].(map[string]any)
		if video == nil {
			video = make(map[string]any)
			payload["video"] = video
		}
		video["url"] = taskcommon.BuildProxyURL(task.TaskID)
	}
	return common.Marshal(payload)
}

func progressValue(progress string) int {
	progress = strings.TrimSuffix(strings.TrimSpace(progress), "%")
	value, _ := strconv.Atoi(progress)
	return value
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	var source map[string]any
	if len(task.Data) > 0 {
		if err := common.Unmarshal(task.Data, &source); err != nil {
			return nil, fmt.Errorf("decode xAI video task: %w", err)
		}
	}

	responseModel := task.Properties.OriginModelName
	if upstreamModel, ok := source["model"].(string); ok && strings.TrimSpace(upstreamModel) != "" {
		responseModel = upstreamModel
	}
	out := map[string]any{
		"id":         task.TaskID,
		"object":     "video",
		"model":      responseModel,
		"status":     task.Status.ToVideoStatus(),
		"progress":   progressValue(task.Progress),
		"created_at": task.CreatedAt,
	}
	for _, field := range []string{"prompt", "seconds", "size", "remixed_from_video_id", "expires_at"} {
		if value, ok := source[field]; ok {
			out[field] = value
		}
	}
	if _, ok := out["seconds"]; !ok {
		if video, ok := source["video"].(map[string]any); ok && video["duration"] != nil {
			out["seconds"] = fmt.Sprint(video["duration"])
		}
	}
	if task.Status == model.TaskStatusSuccess {
		out["completed_at"] = task.FinishTime
		if task.GetResultURL() != "" {
			out["video_url"] = taskcommon.BuildProxyURL(task.TaskID)
		}
	}
	if task.Status == model.TaskStatusFailure {
		message := strings.TrimSpace(task.FailReason)
		if message == "" {
			message = errorMessage(source["error"])
		}
		out["error"] = map[string]any{
			"code":    "video_generation_failed",
			"message": message,
		}
	}
	return common.Marshal(out)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}
