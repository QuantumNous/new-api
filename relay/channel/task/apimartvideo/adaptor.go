package apimartvideo

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
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

type submitPayload struct {
	Model       string   `json:"model"`
	Prompt      string   `json:"prompt"`
	Duration    int      `json:"duration,omitempty"`
	Resolution  string   `json:"resolution,omitempty"`
	AspectRatio string   `json:"aspect_ratio,omitempty"`
	ImageURLs   []string `json:"image_urls,omitempty"`
}

type motionControlPayload struct {
	Model                string                 `json:"model"`
	Prompt               string                 `json:"prompt,omitempty"`
	ImageURL             string                 `json:"image_url"`
	VideoURL             string                 `json:"video_url"`
	KeepOriginalSound    string                 `json:"keep_original_sound,omitempty"`
	CharacterOrientation string                 `json:"character_orientation"`
	Mode                 string                 `json:"mode"`
	WatermarkInfo        map[string]interface{} `json:"watermark_info,omitempty"`
	Duration             int                    `json:"duration,omitempty"`
}

type submitEnvelope struct {
	Code int `json:"code"`
	Data []struct {
		Status string `json:"status"`
		TaskID string `json:"task_id"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type taskEnvelope struct {
	Code int `json:"code"`
	Data struct {
		ID       string  `json:"id"`
		Status   string  `json:"status"`
		Progress int     `json:"progress"`
		Result   *result `json:"result"`
		Error    *struct {
			Message string `json:"message"`
		} `json:"error"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type result struct {
	Videos []struct {
		URL []string `json:"url"`
	} `json:"videos"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = strings.TrimRight(info.ChannelBaseUrl, "/")
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if strings.Contains(c.Request.URL.Path, "/videos/generations") {
		return a.validateApimartJSON(c, info)
	}
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) validateApimartJSON(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_json", http.StatusBadRequest)
	}
	raw, err := storage.Bytes()
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_json", http.StatusBadRequest)
	}

	var modelProbe struct {
		Model string `json:"model"`
	}
	_ = common.Unmarshal(raw, &modelProbe)
	modelName := normalizeModel(modelProbe.Model)
	if IsMotionControlModel(modelName) {
		return a.validateMotionControlJSON(c, info, raw, modelName)
	}

	var body submitPayload
	if err := common.Unmarshal(raw, &body); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_json", http.StatusBadRequest)
	}
	if strings.TrimSpace(body.Model) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("model is required"), "missing_model", http.StatusBadRequest)
	}
	if strings.TrimSpace(body.Prompt) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("prompt is required"), "invalid_request", http.StatusBadRequest)
	}
	body.Model = normalizeModel(body.Model)
	if !IsVideoModel(body.Model) {
		return service.TaskErrorWrapperLocal(fmt.Errorf("unsupported model %q", body.Model), "invalid_model", http.StatusBadRequest)
	}
	if body.Duration <= 0 {
		body.Duration = 4
	}
	if body.Resolution == "" {
		body.Resolution = "720p"
	}
	if body.AspectRatio == "" {
		body.AspectRatio = "16:9"
	}
	action := constant.TaskActionTextGenerate
	if len(body.ImageURLs) > 0 {
		action = constant.TaskActionGenerate
	}
	store := relaycommon.TaskSubmitReq{
		Prompt:   body.Prompt,
		Model:    body.Model,
		Duration: body.Duration,
		Images:   body.ImageURLs,
		Metadata: map[string]interface{}{
			"resolution":   body.Resolution,
			"aspect_ratio": body.AspectRatio,
		},
	}
	c.Set("task_request", store)
	info.Action = action
	return nil
}

func (a *TaskAdaptor) validateMotionControlJSON(c *gin.Context, info *relaycommon.RelayInfo, raw []byte, modelName string) *dto.TaskError {
	var body motionControlPayload
	if err := common.Unmarshal(raw, &body); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_json", http.StatusBadRequest)
	}
	body.Model = modelName
	if strings.TrimSpace(body.ImageURL) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("image_url is required"), "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(body.VideoURL) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("video_url is required"), "invalid_request", http.StatusBadRequest)
	}
	orientation := strings.TrimSpace(body.CharacterOrientation)
	if orientation != "image" && orientation != "video" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("character_orientation must be image or video"), "invalid_request", http.StatusBadRequest)
	}
	mode := strings.TrimSpace(body.Mode)
	if mode != "std" && mode != "pro" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("mode must be std or pro"), "invalid_request", http.StatusBadRequest)
	}
	if body.KeepOriginalSound == "" {
		body.KeepOriginalSound = "yes"
	}
	seconds := body.Duration
	if seconds <= 0 {
		seconds = defaultBillableSeconds(orientation)
	}
	store := relaycommon.TaskSubmitReq{
		Prompt:   strings.TrimSpace(body.Prompt),
		Model:    body.Model,
		Duration: seconds,
		Metadata: map[string]interface{}{
			"image_url":             strings.TrimSpace(body.ImageURL),
			"video_url":             strings.TrimSpace(body.VideoURL),
			"keep_original_sound":   body.KeepOriginalSound,
			"character_orientation": orientation,
			"mode":                  mode,
		},
	}
	c.Set("task_request", store)
	info.Action = constant.TaskActionReferenceGenerate
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	if IsMotionControlModel(req.Model) {
		seconds := req.Duration
		if seconds <= 0 {
			orientation := ""
			if req.Metadata != nil {
				if v, ok := req.Metadata["character_orientation"].(string); ok {
					orientation = v
				}
			}
			seconds = defaultBillableSeconds(orientation)
		}
		mode := "std"
		if req.Metadata != nil {
			if v, ok := req.Metadata["mode"].(string); ok && strings.TrimSpace(v) != "" {
				mode = v
			}
		}
		return map[string]float64{
			"seconds": float64(seconds),
			"mode":    modeBillingRatio(mode),
		}
	}
	seconds := req.Duration
	if seconds <= 0 {
		if s, _ := strconv.Atoi(req.Seconds); s > 0 {
			seconds = s
		}
	}
	if seconds <= 0 {
		seconds = 4
	}
	resolution := "720p"
	if req.Metadata != nil {
		if v, ok := req.Metadata["resolution"].(string); ok && v != "" {
			resolution = v
		}
	}
	ratio := taskcommon.VideoResolutionSizeRatio(resolution)
	return map[string]float64{
		"seconds": float64(seconds),
		"size":    ratio,
	}
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/videos/generations", a.baseURL), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	if strings.Contains(c.Request.URL.Path, "/videos/generations") {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return nil, err
		}
		raw, err := storage.Bytes()
		if err != nil {
			return nil, err
		}
		var modelProbe struct {
			Model string `json:"model"`
		}
		if err := common.Unmarshal(raw, &modelProbe); err != nil {
			return nil, err
		}
		modelName := normalizeModel(modelProbe.Model)
		if IsMotionControlModel(modelName) {
			var body motionControlPayload
			if err := common.Unmarshal(raw, &body); err != nil {
				return nil, err
			}
			body.Model = modelName
			if body.KeepOriginalSound == "" {
				body.KeepOriginalSound = "yes"
			}
			out, err := common.Marshal(body)
			if err != nil {
				return nil, err
			}
			return bytes.NewReader(out), nil
		}

		var body submitPayload
		if err := common.Unmarshal(raw, &body); err != nil {
			return nil, err
		}
		body.Model = normalizeModel(body.Model)
		if body.Duration <= 0 {
			body.Duration = 4
		}
		if body.Resolution == "" {
			body.Resolution = "720p"
		}
		if body.AspectRatio == "" {
			body.AspectRatio = "16:9"
		}
		out, err := common.Marshal(body)
		if err != nil {
			return nil, err
		}
		return bytes.NewReader(out), nil
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}
	payload := openAIToApimart(req, info.UpstreamModelName)
	out, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(out), nil
}

func openAIToApimart(req relaycommon.TaskSubmitReq, upstreamModel string) submitPayload {
	model := normalizeModel(upstreamModel)
	if model == "" {
		model = normalizeModel(req.Model)
	}
	duration := req.Duration
	if duration <= 0 {
		duration, _ = strconv.Atoi(req.Seconds)
	}
	if duration <= 0 {
		duration = 4
	}
	resolution, aspect := sizeToApimart(req.Size)
	if req.Metadata != nil {
		if v, ok := req.Metadata["resolution"].(string); ok && v != "" {
			resolution = v
		}
		if v, ok := req.Metadata["aspect_ratio"].(string); ok && v != "" {
			aspect = v
		}
	}
	imageURLs := append([]string{}, req.Images...)
	if req.InputReference != "" {
		imageURLs = append(imageURLs, req.InputReference)
	}
	return submitPayload{
		Model:       model,
		Prompt:      req.Prompt,
		Duration:    duration,
		Resolution:  resolution,
		AspectRatio: aspect,
		ImageURLs:   imageURLs,
	}
}

func sizeToApimart(size string) (resolution, aspect string) {
	resolution = "720p"
	aspect = "16:9"
	switch size {
	case "720x1280", "9:16", "portrait":
		aspect = "9:16"
	case "1280x720", "16:9", "landscape":
		aspect = "16:9"
	case "1792x1024":
		resolution = "1024p"
		aspect = "16:9"
	case "1024x1792":
		resolution = "1024p"
		aspect = "9:16"
	}
	return resolution, aspect
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

	var env submitEnvelope
	if err := common.Unmarshal(responseBody, &env); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}
	if env.Code != 0 && env.Code != http.StatusOK {
		msg := fmt.Sprintf("upstream code %d", env.Code)
		if env.Error != nil && env.Error.Message != "" {
			msg = env.Error.Message
		}
		taskErr = service.TaskErrorWrapper(errors.New(msg), "upstream_error", http.StatusBadGateway)
		return
	}
	if len(env.Data) == 0 || strings.TrimSpace(env.Data[0].TaskID) == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}
	upstreamID := env.Data[0].TaskID

	if strings.Contains(c.Request.URL.Path, "/videos/generations") {
		env.Data[0].TaskID = info.PublicTaskID
		out, err := common.Marshal(env)
		if err != nil {
			taskErr = service.TaskErrorWrapper(err, "marshal_response_failed", http.StatusInternalServerError)
			return
		}
		c.Data(http.StatusOK, "application/json; charset=utf-8", out)
		taskData = out
		return upstreamID, taskData, nil
	}

	type openAIResp struct {
		ID     string `json:"id"`
		Object string `json:"object"`
		Model  string `json:"model"`
		Status string `json:"status"`
	}
	c.JSON(http.StatusOK, openAIResp{
		ID:     info.PublicTaskID,
		Object: "video",
		Model:  info.UpstreamModelName,
		Status: "queued",
	})
	taskData = responseBody
	return upstreamID, taskData, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	uri := fmt.Sprintf("%s/v1/tasks/%s", strings.TrimRight(baseUrl, "/"), taskID)
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

func (a *TaskAdaptor) GetModelList() []string { return ModelList }

func (a *TaskAdaptor) GetChannelName() string { return ChannelName }

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var env taskEnvelope
	if err := common.Unmarshal(respBody, &env); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}
	if env.Error != nil && env.Error.Message != "" {
		return &relaycommon.TaskInfo{
			Status: model.TaskStatusFailure,
			Reason: env.Error.Message,
		}, nil
	}
	status := strings.ToLower(strings.TrimSpace(env.Data.Status))
	info := &relaycommon.TaskInfo{}
	switch status {
	case "pending", "queued", "submitted":
		info.Status = model.TaskStatusQueued
	case "processing", "in_progress", "running":
		info.Status = model.TaskStatusInProgress
	case "completed", "success", "succeeded":
		info.Status = model.TaskStatusSuccess
		info.Url = extractVideoURL(&env)
	case "failed", "failure", "error", "cancelled":
		info.Status = model.TaskStatusFailure
		if env.Data.Error != nil && env.Data.Error.Message != "" {
			info.Reason = env.Data.Error.Message
		} else {
			info.Reason = "task failed"
		}
	default:
		if env.Data.Progress > 0 && env.Data.Progress < 100 {
			info.Status = model.TaskStatusInProgress
		}
	}
	if env.Data.Progress > 0 && env.Data.Progress < 100 {
		info.Progress = fmt.Sprintf("%d%%", env.Data.Progress)
	}
	return info, nil
}

func extractVideoURL(env *taskEnvelope) string {
	if env == nil || env.Data.Result == nil {
		return ""
	}
	for _, v := range env.Data.Result.Videos {
		for _, u := range v.URL {
			u = strings.TrimSpace(u)
			if u != "" {
				return u
			}
		}
	}
	return ""
}

func failureMessageFromTask(task *model.Task) string {
	if msg := strings.TrimSpace(task.FailReason); msg != "" {
		return msg
	}
	var env taskEnvelope
	if err := common.Unmarshal(task.Data, &env); err != nil {
		return ""
	}
	if env.Data.Error != nil && strings.TrimSpace(env.Data.Error.Message) != "" {
		return strings.TrimSpace(env.Data.Error.Message)
	}
	if env.Error != nil && strings.TrimSpace(env.Error.Message) != "" {
		return strings.TrimSpace(env.Error.Message)
	}
	return ""
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	out := map[string]any{
		"id":     task.TaskID,
		"object": "video",
		"model":  task.Properties.OriginModelName,
		"status": task.Status.ToVideoStatus(),
	}
	if task.Progress != "" {
		out["progress"] = task.Progress
	}
	if task.Status == model.TaskStatusSuccess {
		out["url"] = task.GetResultURL()
	}
	if task.Status == model.TaskStatusFailure {
		if msg := failureMessageFromTask(task); msg != "" {
			out["error"] = map[string]string{
				"code":    "task_failed",
				"message": msg,
			}
		}
	}
	return common.Marshal(out)
}
