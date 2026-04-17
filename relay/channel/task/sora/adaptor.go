package sora

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
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
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// ============================
// Request / Response structures
// ============================

type ContentItem struct {
	Type     string    `json:"type"`                // "text" or "image_url"
	Text     string    `json:"text,omitempty"`      // for text type
	ImageURL *ImageURL `json:"image_url,omitempty"` // for image_url type
}

type ImageURL struct {
	URL string `json:"url"`
}

type responseTask struct {
	ID                 string  `json:"id"`
	TaskID             string  `json:"task_id,omitempty"`
	Object             string  `json:"object"`
	Model              string  `json:"model"`
	Status             string  `json:"status"`
	URL                string  `json:"url,omitempty"`
	VideoURL           string  `json:"video_url,omitempty"`
	Progress           float64 `json:"progress"`
	Created            int64   `json:"created,omitempty"`
	CreatedAt          int64   `json:"created_at"`
	CompletedAt        int64   `json:"completed_at,omitempty"`
	ExpiresAt          int64   `json:"expires_at,omitempty"`
	Seconds            string  `json:"seconds,omitempty"`
	Size               string  `json:"size,omitempty"`
	RemixedFromVideoID string  `json:"remixed_from_video_id,omitempty"`
	Error              *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

const videoGenerationsTaskPath = "/v1/video/generations"

func trimTaskPathQuery(path string) string {
	path = strings.TrimSpace(path)
	if idx := strings.Index(path, "?"); idx >= 0 {
		path = path[:idx]
	}
	return path
}

func usesVideoGenerationsTaskPath(path string) bool {
	path = trimTaskPathQuery(path)
	return path == videoGenerationsTaskPath || strings.HasPrefix(path, videoGenerationsTaskPath+"/")
}

func isVideoGenerationsTaskModel(model string) bool {
	model = strings.ToLower(strings.TrimSpace(model))
	return strings.HasPrefix(model, "veo") ||
		strings.Contains(model, "/veo") ||
		strings.HasPrefix(model, "sora-2") ||
		strings.HasPrefix(model, "sora2")
}

func usesVideoGenerationsTaskEndpoint(path string, modelNames ...string) bool {
	if !usesVideoGenerationsTaskPath(path) {
		return false
	}
	for _, modelName := range modelNames {
		if isVideoGenerationsTaskModel(modelName) {
			return true
		}
	}
	return false
}

func taskFetchRequestPath(body map[string]any) string {
	if body == nil {
		return ""
	}
	if requestPath, ok := body["request_path"].(string); ok {
		return requestPath
	}
	return ""
}

func taskFetchModel(body map[string]any, key string) string {
	if body == nil {
		return ""
	}
	if model, ok := body[key].(string); ok {
		return model
	}
	return ""
}

func relayInfoUpstreamModelName(info *relaycommon.RelayInfo) string {
	if info == nil || info.ChannelMeta == nil {
		return ""
	}
	return info.UpstreamModelName
}

func buildTaskFetchURL(baseURL string, body map[string]any) (string, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return "", fmt.Errorf("invalid task_id")
	}
	if usesVideoGenerationsTaskEndpoint(
		taskFetchRequestPath(body),
		taskFetchModel(body, "model"),
		taskFetchModel(body, "origin_model"),
	) {
		return fmt.Sprintf("%s%s/%s", baseURL, videoGenerationsTaskPath, taskID), nil
	}
	return fmt.Sprintf("%s/v1/videos/%s", baseURL, taskID), nil
}

func formatTaskProgress(progress float64) string {
	if progress == float64(int64(progress)) {
		return fmt.Sprintf("%d%%", int64(progress))
	}
	return fmt.Sprintf("%.1f%%", progress)
}

func stringifyBodyValue(value any) string {
	if value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func normalizeGrokVideoQuality(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "720p":
		return "high"
	case "480p":
		return "standard"
	case "high", "standard":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return strings.TrimSpace(value)
	}
}

func resolutionNameFromQuality(value string) string {
	switch normalizeGrokVideoQuality(value) {
	case "high":
		return "720p"
	case "standard":
		return "480p"
	default:
		return ""
	}
}

func qualityFromResolutionName(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "720p":
		return "high"
	case "480p":
		return "standard"
	default:
		return ""
	}
}

func appendGrokVideoImageReference(target []interface{}, value interface{}) []interface{} {
	if value == nil {
		return target
	}
	switch v := value.(type) {
	case string:
		if trimmed := strings.TrimSpace(v); trimmed != "" {
			target = append(target, trimmed)
		}
	case []string:
		for _, item := range v {
			target = appendGrokVideoImageReference(target, item)
		}
	case []interface{}:
		for _, item := range v {
			target = appendGrokVideoImageReference(target, item)
		}
	case map[string]interface{}:
		target = append(target, v)
	}
	return target
}

func normalizeGrokVideoRequest(bodyMap map[string]interface{}, upstreamModel string) {
	if upstreamModel != "grok-imagine-1.0-video" {
		return
	}

	quality := normalizeGrokVideoQuality(stringifyBodyValue(bodyMap["quality"]))
	resolutionName := stringifyBodyValue(bodyMap["resolution_name"])
	preset := stringifyBodyValue(bodyMap["preset"])
	seconds := stringifyBodyValue(bodyMap["seconds"])
	duration := stringifyBodyValue(bodyMap["duration"])

	if videoConfig, ok := bodyMap["video_config"].(map[string]interface{}); ok {
		if resolutionName == "" {
			resolutionName = stringifyBodyValue(videoConfig["resolution_name"])
		}
		if preset == "" {
			preset = stringifyBodyValue(videoConfig["preset"])
		}
	}

	if quality == "" {
		quality = qualityFromResolutionName(resolutionName)
	}
	if resolutionName == "" {
		resolutionName = resolutionNameFromQuality(quality)
	}

	if quality != "" {
		bodyMap["quality"] = quality
	}
	if seconds == "" && duration != "" {
		bodyMap["seconds"] = duration
	}
	imageReferences := make([]interface{}, 0)
	imageReferences = appendGrokVideoImageReference(imageReferences, bodyMap["image_reference"])
	imageReferences = appendGrokVideoImageReference(imageReferences, bodyMap["image"])
	imageReferences = appendGrokVideoImageReference(imageReferences, bodyMap["images"])
	if len(imageReferences) > 0 {
		bodyMap["image_reference"] = imageReferences
	}
	delete(bodyMap, "image")
	delete(bodyMap, "images")
	if resolutionName != "" {
		bodyMap["resolution_name"] = resolutionName
	}
	if preset != "" {
		bodyMap["preset"] = preset
	}
	if resolutionName != "" || preset != "" {
		videoConfig := map[string]interface{}{}
		if resolutionName != "" {
			videoConfig["resolution_name"] = resolutionName
		}
		if preset != "" {
			videoConfig["preset"] = preset
		}
		bodyMap["video_config"] = videoConfig
	}
}

func isSoraVideoModel(upstreamModel string) bool {
	upstreamModel = strings.ToLower(strings.TrimSpace(upstreamModel))
	return strings.HasPrefix(upstreamModel, "sora-2") || strings.HasPrefix(upstreamModel, "sora2")
}

func soraSizeFromAspectRatio(value string) string {
	switch strings.TrimSpace(value) {
	case "16:9":
		return "1280x720"
	case "9:16":
		return "720x1280"
	default:
		return ""
	}
}

func soraAspectRatioFromSize(value string) string {
	switch strings.TrimSpace(value) {
	case "1280x720", "1792x1024":
		return "16:9"
	case "720x1280", "1024x1792":
		return "9:16"
	default:
		return ""
	}
}

func soraDurationBodyValue(value string) interface{} {
	if duration, err := strconv.Atoi(strings.TrimSpace(value)); err == nil {
		return duration
	}
	return strings.TrimSpace(value)
}

func normalizeSoraVideoRequest(bodyMap map[string]interface{}, upstreamModel string) {
	if !isSoraVideoModel(upstreamModel) {
		return
	}

	duration := stringifyBodyValue(bodyMap["duration"])
	aspectRatio := stringifyBodyValue(bodyMap["aspect_ratio"])
	seconds := stringifyBodyValue(bodyMap["seconds"])
	size := stringifyBodyValue(bodyMap["size"])
	imageURL := stringifyBodyValue(bodyMap["image_url"])
	inputReference := stringifyBodyValue(bodyMap["input_reference"])
	image := stringifyBodyValue(bodyMap["image"])

	if duration == "" {
		if seconds != "" {
			duration = seconds
		} else {
			duration = "4"
		}
	}
	if aspectRatio == "" {
		if mapped := soraAspectRatioFromSize(size); mapped != "" {
			aspectRatio = mapped
		} else {
			aspectRatio = "9:16"
		}
	}

	bodyMap["duration"] = soraDurationBodyValue(duration)
	bodyMap["aspect_ratio"] = aspectRatio
	bodyMap["async"] = true
	delete(bodyMap, "seconds")
	delete(bodyMap, "size")

	if imageURL == "" {
		switch {
		case inputReference != "":
			imageURL = inputReference
		case image != "":
			imageURL = image
		default:
			if images, ok := bodyMap["images"].([]interface{}); ok && len(images) > 0 {
				imageURL = stringifyBodyValue(images[0])
			}
		}
	}
	if imageURL != "" {
		bodyMap["image_url"] = imageURL
	}
	delete(bodyMap, "input_reference")
	delete(bodyMap, "image")
	delete(bodyMap, "images")
}

func extractVideoURL(respBody []byte) string {
	for _, path := range []string{
		"url",
		"video_url",
		"metadata.url",
		"data.url",
		"data.video_url",
		"data.0.url",
		"data.0.video_url",
		"output.video_url",
		"task_result.videos.0.url",
	} {
		if url := strings.TrimSpace(gjson.GetBytes(respBody, path).String()); url != "" {
			return url
		}
	}
	return ""
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func validateRemixRequest(c *gin.Context) *dto.TaskError {
	var req relaycommon.TaskSubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("field prompt is required"), "invalid_request", http.StatusBadRequest)
	}
	// 存储原始请求到 context，与 ValidateMultipartDirect 路径保持一致
	c.Set("task_request", req)
	return nil
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	if info.Action == constant.TaskActionRemix {
		return validateRemixRequest(c)
	}
	return relaycommon.ValidateMultipartDirect(c, info)
}

// EstimateBilling 根据用户请求的 seconds 计算 OtherRatios。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	// remix 路径的 OtherRatios 已在 ResolveOriginTask 中设置
	if info.Action == constant.TaskActionRemix {
		return nil
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}

	seconds, _ := strconv.Atoi(req.Seconds)
	if seconds == 0 {
		seconds = req.Duration
	}
	if seconds <= 0 {
		seconds = 4
	}

	return map[string]float64{
		"seconds": float64(seconds),
	}
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info != nil && info.TaskRelayInfo != nil && info.Action == constant.TaskActionRemix {
		return fmt.Sprintf("%s/v1/videos/%s/remix", a.baseURL, info.OriginTaskID), nil
	}
	if info != nil && usesVideoGenerationsTaskEndpoint(info.RequestURLPath, relayInfoUpstreamModelName(info), info.OriginModelName) {
		return fmt.Sprintf("%s%s", a.baseURL, videoGenerationsTaskPath), nil
	}
	return fmt.Sprintf("%s/v1/videos", a.baseURL), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_request_body_failed")
	}
	cachedBody, err := storage.Bytes()
	if err != nil {
		return nil, errors.Wrap(err, "read_body_bytes_failed")
	}
	contentType := c.GetHeader("Content-Type")

	if strings.HasPrefix(contentType, "application/json") {
		var bodyMap map[string]interface{}
		if err := common.Unmarshal(cachedBody, &bodyMap); err == nil {
			bodyMap["model"] = info.UpstreamModelName
			normalizeGrokVideoRequest(bodyMap, info.UpstreamModelName)
			normalizeSoraVideoRequest(bodyMap, info.UpstreamModelName)
			if newBody, err := common.Marshal(bodyMap); err == nil {
				c.Request.Header.Set("Content-Type", "application/json")
				return bytes.NewReader(newBody), nil
			}
		}
		return bytes.NewReader(cachedBody), nil
	}

	if strings.Contains(contentType, "multipart/form-data") {
		formData, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return bytes.NewReader(cachedBody), nil
		}
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		writer.WriteField("model", info.UpstreamModelName)
		hasSeconds := false
		hasDuration := false
		durationValue := ""
		hasSize := false
		sizeValue := ""
		hasAspectRatio := false
		aspectRatioValue := ""
		for key, values := range formData.Value {
			if key == "model" {
				continue
			}
			if key == "seconds" && len(values) > 0 && strings.TrimSpace(values[0]) != "" {
				hasSeconds = true
			}
			if key == "duration" && len(values) > 0 && strings.TrimSpace(values[0]) != "" {
				hasDuration = true
			}
			if key == "duration" && len(values) > 0 && durationValue == "" {
				durationValue = strings.TrimSpace(values[0])
			}
			if key == "size" && len(values) > 0 && strings.TrimSpace(values[0]) != "" {
				hasSize = true
				if sizeValue == "" {
					sizeValue = strings.TrimSpace(values[0])
				}
			}
			if key == "aspect_ratio" && len(values) > 0 && strings.TrimSpace(values[0]) != "" {
				hasAspectRatio = true
			}
			if key == "aspect_ratio" && len(values) > 0 && aspectRatioValue == "" {
				aspectRatioValue = strings.TrimSpace(values[0])
			}
			if isSoraVideoModel(info.UpstreamModelName) && (key == "seconds" || key == "size") {
				continue
			}
			for _, v := range values {
				writer.WriteField(key, v)
			}
		}
		if info.UpstreamModelName == "grok-imagine-1.0-video" && !hasSeconds && durationValue != "" {
			writer.WriteField("seconds", durationValue)
		}
		if isSoraVideoModel(info.UpstreamModelName) {
			if !hasDuration {
				if durationValue == "" {
					durationValue = "4"
				}
				writer.WriteField("duration", durationValue)
			}
			if !hasAspectRatio {
				if aspectRatioValue == "" && hasSize {
					aspectRatioValue = soraAspectRatioFromSize(sizeValue)
				}
				if aspectRatioValue == "" {
					aspectRatioValue = "9:16"
				}
				writer.WriteField("aspect_ratio", aspectRatioValue)
			}
			writer.WriteField("async", "true")
		}
		for fieldName, fileHeaders := range formData.File {
			for _, fh := range fileHeaders {
				f, err := fh.Open()
				if err != nil {
					continue
				}
				ct := fh.Header.Get("Content-Type")
				if ct == "" || ct == "application/octet-stream" {
					buf512 := make([]byte, 512)
					n, _ := io.ReadFull(f, buf512)
					ct = http.DetectContentType(buf512[:n])
					// Re-open after sniffing so the full content is copied below
					f.Close()
					f, err = fh.Open()
					if err != nil {
						continue
					}
				}
				h := make(textproto.MIMEHeader)
				h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, fh.Filename))
				h.Set("Content-Type", ct)
				part, err := writer.CreatePart(h)
				if err != nil {
					f.Close()
					continue
				}
				io.Copy(part, f)
				f.Close()
			}
		}
		writer.Close()
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		return &buf, nil
	}

	return common.ReaderOnly(storage), nil
}

// DoRequest delegates to common helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response, returns taskID etc.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	// Parse Sora response
	var dResp responseTask
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	upstreamID := dResp.TaskID
	if upstreamID == "" {
		upstreamID = dResp.ID
	}
	if upstreamID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}
	if dResp.URL == "" {
		dResp.URL = extractVideoURL(responseBody)
	}
	if dResp.VideoURL == "" {
		dResp.VideoURL = dResp.URL
	}
	if dResp.URL == "" {
		dResp.URL = dResp.VideoURL
	}

	// 使用公开 task_xxxx ID 返回给客户端
	dResp.ID = info.PublicTaskID
	dResp.TaskID = info.PublicTaskID
	c.JSON(http.StatusOK, dResp)
	return upstreamID, responseBody, nil
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	uri, err := buildTaskFetchURL(baseUrl, body)
	if err != nil {
		return nil, err
	}

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
	resTask := responseTask{}
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}
	if resTask.URL == "" {
		resTask.URL = extractVideoURL(respBody)
	}
	if resTask.VideoURL == "" {
		resTask.VideoURL = resTask.URL
	}
	if resTask.URL == "" {
		resTask.URL = resTask.VideoURL
	}
	createdAt := resTask.CreatedAt
	if createdAt == 0 {
		createdAt = resTask.Created
	}

	taskResult := relaycommon.TaskInfo{
		Code:        0,
		CreatedAt:   createdAt,
		CompletedAt: resTask.CompletedAt,
	}

	switch strings.ToLower(strings.TrimSpace(resTask.Status)) {
	case "queued", "pending":
		taskResult.Status = model.TaskStatusQueued
	case "processing", "in_progress", "running":
		taskResult.Status = model.TaskStatusInProgress
	case "completed":
		if resTask.URL == "" {
			taskResult.Status = model.TaskStatusFailure
			taskResult.Reason = "video result url is empty"
		} else {
			taskResult.Status = model.TaskStatusSuccess
			taskResult.Url = resTask.URL
		}
	case "failed", "cancelled":
		taskResult.Status = model.TaskStatusFailure
		if resTask.Error != nil {
			taskResult.Reason = resTask.Error.Message
		} else {
			taskResult.Reason = "task failed"
		}
	default:
	}
	if resTask.Progress > 0 && resTask.Progress < 100 {
		taskResult.Progress = formatTaskProgress(resTask.Progress)
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	data := task.Data
	var err error
	if data, err = sjson.SetBytes(data, "id", task.TaskID); err != nil {
		return nil, errors.Wrap(err, "set id failed")
	}
	if gjson.GetBytes(data, "task_id").Exists() {
		if data, err = sjson.SetBytes(data, "task_id", task.TaskID); err != nil {
			return nil, errors.Wrap(err, "set task_id failed")
		}
	}
	return data, nil
}
