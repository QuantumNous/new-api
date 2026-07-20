package th12345ai

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/tidwall/gjson"
)

// TaskAdaptor implements th12345ai (TH API / sd.12345ai.net) async video API.
// Create: POST /api/tasks ; Query: GET /api/tasks/{id}
type TaskAdaptor struct {
	taskcommon.BaseBilling
	baseURL string
	apiKey  string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = apiOrigin(info.ChannelBaseUrl)
	a.apiKey = info.ApiKey
}

func apiOrigin(raw string) string {
	b := strings.TrimRight(strings.TrimSpace(raw), "/")
	for _, suf := range []string{createPath, "/api/tasks", "/api"} {
		b = trimSuffixFold(b, suf)
	}
	return strings.TrimRight(b, "/")
}

func trimSuffixFold(s, suf string) string {
	if len(s) < len(suf) {
		return s
	}
	tail := s[len(s)-len(suf):]
	if strings.EqualFold(tail, suf) {
		return strings.TrimRight(s[:len(s)-len(suf)], "/")
	}
	return s
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + createPath, nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
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
	body, err := a.convertCreatePayload(c, &req, info)
	if err != nil {
		return nil, errors.Wrap(err, "convert create payload failed")
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) convertCreatePayload(c *gin.Context, req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (map[string]interface{}, error) {
	modelName := strings.TrimSpace(info.UpstreamModelName)
	if modelName == "" {
		modelName = strings.TrimSpace(info.OriginModelName)
	}
	modelName = resolveUpstreamModel(modelName)
	if modelName == "" {
		return nil, fmt.Errorf("upstream model is empty; use one of: %s", strings.Join(ModelList, ", "))
	}

	payload := map[string]interface{}{
		"kind":   "video",
		"model":  modelName,
		"prompt": strings.TrimSpace(req.Prompt),
	}
	if ratio := ratioFromRequest(req); ratio != "" {
		payload["ratio"] = ratio
	}
	if res := strings.TrimSpace(req.Resolution); res != "" {
		payload["resolution"] = normalizeResolution(res)
	}
	if d := durationFromRequest(req); d > 0 {
		payload["duration"] = d
	}
	if images := collectImageURLs(c, req); len(images) > 0 {
		payload["referenceImages"] = images
	}
	applyRawCreateFields(c, payload)

	if err := taskcommon.UnmarshalMetadata(req.Metadata, &payload); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	normalizeCreatePayload(payload)
	payload["kind"] = "video"
	payload["model"] = modelName
	if strings.TrimSpace(req.Prompt) != "" {
		payload["prompt"] = strings.TrimSpace(req.Prompt)
	}
	return payload, nil
}

func ratioFromRequest(req *relaycommon.TaskSubmitReq) string {
	if ratio := strings.TrimSpace(req.AspectRatio); ratio != "" && strings.Contains(ratio, ":") {
		return ratio
	}
	if ratio := strings.TrimSpace(req.Ratio); ratio != "" && strings.Contains(ratio, ":") {
		return ratio
	}
	size := strings.TrimSpace(req.Size)
	if size != "" && strings.Contains(size, ":") {
		return size
	}
	return ""
}

func durationFromRequest(req *relaycommon.TaskSubmitReq) int {
	if req.Duration > 0 {
		return req.Duration
	}
	if sec, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil && sec > 0 {
		return sec
	}
	return 0
}

func normalizeResolution(res string) string {
	res = strings.TrimSpace(res)
	if res == "" {
		return ""
	}
	lower := strings.ToLower(res)
	// Upstream expects lowercase like "720p".
	if strings.HasSuffix(lower, "p") && !strings.Contains(lower, ":") {
		return lower
	}
	return res
}

func applyRawCreateFields(c *gin.Context, payload map[string]interface{}) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return
	}
	raw, err := storage.Bytes()
	if err != nil {
		return
	}
	if _, ok := payload["resolution"]; !ok {
		if res := strings.TrimSpace(gjson.GetBytes(raw, "resolution").String()); res != "" {
			payload["resolution"] = normalizeResolution(res)
		}
	}
	if _, ok := payload["ratio"]; !ok {
		if ratio := strings.TrimSpace(gjson.GetBytes(raw, "ratio").String()); ratio != "" {
			payload["ratio"] = ratio
		} else if ratio := strings.TrimSpace(gjson.GetBytes(raw, "aspect_ratio").String()); ratio != "" {
			payload["ratio"] = ratio
		}
	}
	if _, ok := payload["referenceImages"]; !ok {
		if imgs := parseStringURLsFromRaw(raw, []string{"referenceImages", "reference_images", "images", "image_urls", "image", "image_url"}); len(imgs) > 0 {
			payload["referenceImages"] = imgs
		}
	}
	if _, ok := payload["referenceVideos"]; !ok {
		if vids := parseStringURLsFromRaw(raw, []string{"referenceVideos", "reference_videos", "videos", "video_urls"}); len(vids) > 0 {
			payload["referenceVideos"] = vids
		}
	}
	if _, ok := payload["referenceAudios"]; !ok {
		if auds := parseStringURLsFromRaw(raw, []string{"referenceAudios", "reference_audios", "audios", "audio_urls"}); len(auds) > 0 {
			payload["referenceAudios"] = auds
		}
	}
	if gjson.GetBytes(raw, "duration").Exists() {
		if _, ok := payload["duration"]; !ok {
			if d := int(gjson.GetBytes(raw, "duration").Int()); d > 0 {
				payload["duration"] = d
			}
		}
	}
}

func normalizeCreatePayload(payload map[string]interface{}) {
	if ar, ok := payload["aspect_ratio"].(string); ok {
		ar = strings.TrimSpace(ar)
		if ar != "" {
			if ratio, _ := payload["ratio"].(string); strings.TrimSpace(ratio) == "" {
				payload["ratio"] = ar
			}
		}
		delete(payload, "aspect_ratio")
	}
	if size, ok := payload["size"].(string); ok {
		size = strings.TrimSpace(size)
		if size != "" {
			if strings.Contains(size, ":") {
				if ratio, _ := payload["ratio"].(string); strings.TrimSpace(ratio) == "" {
					payload["ratio"] = size
				}
			} else if _, hasRes := payload["resolution"]; !hasRes {
				payload["resolution"] = normalizeResolution(size)
			}
		}
		delete(payload, "size")
	}
	// Remap common aliases from metadata / raw body into upstream field names.
	remapStringSliceField(payload, "images", "referenceImages")
	remapStringSliceField(payload, "image_urls", "referenceImages")
	remapStringSliceField(payload, "reference_images", "referenceImages")
	remapStringSliceField(payload, "videos", "referenceVideos")
	remapStringSliceField(payload, "video_urls", "referenceVideos")
	remapStringSliceField(payload, "reference_videos", "referenceVideos")
	remapStringSliceField(payload, "audios", "referenceAudios")
	remapStringSliceField(payload, "audio_urls", "referenceAudios")
	remapStringSliceField(payload, "reference_audios", "referenceAudios")
	if res, ok := payload["resolution"].(string); ok {
		payload["resolution"] = normalizeResolution(res)
	}
}

func remapStringSliceField(payload map[string]interface{}, from, to string) {
	if _, exists := payload[to]; exists {
		delete(payload, from)
		return
	}
	v, ok := payload[from]
	if !ok {
		return
	}
	delete(payload, from)
	switch t := v.(type) {
	case []string:
		if len(t) > 0 {
			payload[to] = t
		}
	case []interface{}:
		out := make([]string, 0, len(t))
		for _, item := range t {
			if s, ok := item.(string); ok {
				if u := strings.TrimSpace(s); u != "" {
					out = append(out, u)
				}
			}
		}
		if len(out) > 0 {
			payload[to] = out
		}
	case string:
		if u := strings.TrimSpace(t); u != "" {
			payload[to] = []string{u}
		}
	}
}

func collectImageURLs(c *gin.Context, req *relaycommon.TaskSubmitReq) []string {
	out := make([]string, 0, len(req.Images)+2)
	for _, u := range req.Images {
		if u = strings.TrimSpace(u); u != "" {
			out = append(out, u)
		}
	}
	if u := strings.TrimSpace(req.Image); u != "" {
		out = append(out, u)
	}
	if u := strings.TrimSpace(req.InputReference); u != "" {
		out = append(out, u)
	}
	if len(out) == 0 {
		if storage, err := common.GetBodyStorage(c); err == nil {
			if raw, err := storage.Bytes(); err == nil {
				out = append(out, parseStringURLsFromRaw(raw, []string{"referenceImages", "reference_images", "images", "image_urls", "image", "image_url"})...)
			}
		}
	}
	return out
}

func parseStringURLsFromRaw(raw []byte, paths []string) []string {
	out := make([]string, 0, 4)
	for _, path := range paths {
		arr := gjson.GetBytes(raw, path)
		if !arr.Exists() {
			continue
		}
		if arr.IsArray() {
			for _, item := range arr.Array() {
				if item.Type == gjson.String {
					if u := strings.TrimSpace(item.String()); u != "" {
						out = append(out, u)
					}
					continue
				}
				if u := strings.TrimSpace(item.Get("url").String()); u != "" {
					out = append(out, u)
				}
			}
		} else if arr.Type == gjson.String {
			if u := strings.TrimSpace(arr.String()); u != "" {
				out = append(out, u)
			}
		}
	}
	return out
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

	upstreamID, err := parseCreateTaskID(responseBody)
	if err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "invalid_response", http.StatusInternalServerError)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.Model = info.OriginModelName
	ov.Status = dto.VideoStatusQueued
	c.JSON(http.StatusOK, ov)
	return upstreamID, responseBody, nil
}

func parseCreateTaskID(respBody []byte) (string, error) {
	raw := string(respBody)
	if msg := extractErrorMessage(raw); msg != "" && isUpstreamError(raw) {
		return "", fmt.Errorf("%s", msg)
	}
	for _, path := range []string{"id", "task_id", "data.id", "data.task_id"} {
		if id := strings.TrimSpace(gjson.Get(raw, path).String()); id != "" {
			return id, nil
		}
	}
	return "", fmt.Errorf("task id not found in create response")
}

func isUpstreamError(raw string) bool {
	status := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "status").String()))
	if status == "failed" || status == "error" || status == "failure" {
		return true
	}
	if errMsg := strings.TrimSpace(gjson.Get(raw, "errorMessage").String()); errMsg != "" && (status == "" || status == "failed") {
		return true
	}
	if msg := strings.TrimSpace(gjson.Get(raw, "message").String()); msg != "" {
		if code := gjson.Get(raw, "statusCode"); code.Exists() && code.Int() >= 400 {
			return true
		}
		if errType := strings.TrimSpace(gjson.Get(raw, "error").String()); errType != "" {
			return true
		}
	}
	return false
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	queryURL, err := buildQueryURL(baseUrl, taskID)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodGet, queryURL, nil)
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

func buildQueryURL(baseUrl, taskID string) (string, error) {
	u, err := url.Parse(apiOrigin(baseUrl) + queryPathFmt + url.PathEscape(taskID))
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	raw := string(respBody)
	if isUpstreamError(raw) {
		ti := relaycommon.TaskInfo{
			Status:   model.TaskStatusFailure,
			Progress: "100%",
			Reason:   extractErrorMessage(raw),
		}
		if ti.Reason == "" {
			ti.Reason = "task failed"
		}
		return &ti, nil
	}

	status := resolveUpstreamStatus(raw)
	taskResult := relaycommon.TaskInfo{Code: 0}

	if isFailureUpstreamStatus(status) {
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = extractErrorMessage(raw)
		if taskResult.Reason == "" {
			taskResult.Reason = "task failed"
		}
		return &taskResult, nil
	}

	if u := extractVideoURL(raw); u != "" && isSuccessLikeUpstreamStatus(status) {
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = u
		return &taskResult, nil
	}

	if isInProgressUpstreamStatus(status) {
		taskResult.Status = model.TaskStatusInProgress
		if status == "queued" {
			taskResult.Status = model.TaskStatusQueued
		}
		taskResult.Progress = formatProgress(status)
		return &taskResult, nil
	}

	if isSuccessLikeUpstreamStatus(status) {
		if u := extractVideoURL(raw); u != "" {
			taskResult.Status = model.TaskStatusSuccess
			taskResult.Progress = "100%"
			taskResult.Url = u
			return &taskResult, nil
		}
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = "completed but video url is empty"
		return &taskResult, nil
	}

	if u := extractVideoURL(raw); u != "" {
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = u
		return &taskResult, nil
	}

	taskResult.Status = model.TaskStatusInProgress
	taskResult.Progress = formatProgress(status)
	return &taskResult, nil
}

func resolveUpstreamStatus(raw string) string {
	return strings.ToLower(strings.TrimSpace(gjson.Get(raw, "status").String()))
}

func isFailureUpstreamStatus(status string) bool {
	switch status {
	case "failed", "failure", "error", "cancelled", "canceled":
		return true
	default:
		return false
	}
}

func isInProgressUpstreamStatus(status string) bool {
	switch status {
	case "pending", "queued", "processing", "running", "in_progress", "submitted":
		return true
	default:
		return false
	}
}

func isSuccessLikeUpstreamStatus(status string) bool {
	switch status {
	case "success", "completed", "succeeded":
		return true
	default:
		return false
	}
}

func formatProgress(status string) string {
	switch status {
	case "queued", "pending", "submitted":
		return "10%"
	case "processing", "running", "in_progress":
		return "50%"
	default:
		return "30%"
	}
}

func extractVideoURL(raw string) string {
	for _, path := range []string{"video_url", "result_url", "url", "data.video_url"} {
		val := gjson.Get(raw, path)
		if !val.Exists() {
			continue
		}
		if u := strings.TrimSpace(val.String()); u != "" && strings.HasPrefix(u, "http") {
			return u
		}
	}
	return ""
}

func extractErrorMessage(raw string) string {
	for _, path := range []string{
		"errorMessage",
		"error.message",
		"message",
		"msg",
		"fail_reason",
	} {
		if msg := strings.TrimSpace(gjson.Get(raw, path).String()); msg != "" {
			return msg
		}
	}
	return ""
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	openAIVideo := originTask.ToOpenAIVideo()
	if ti, err := a.ParseTaskResult(originTask.Data); err == nil && ti != nil {
		switch ti.Status {
		case model.TaskStatusSuccess:
			openAIVideo.Status = dto.VideoStatusCompleted
			if ti.Url != "" {
				openAIVideo.SetMetadata("url", ti.Url)
			}
		case model.TaskStatusFailure:
			openAIVideo.Status = dto.VideoStatusFailed
			openAIVideo.Error = &dto.OpenAIVideoError{Message: ti.Reason}
		case model.TaskStatusInProgress, model.TaskStatusQueued, model.TaskStatusSubmitted:
			openAIVideo.Status = dto.VideoStatusInProgress
			if ti.Progress != "" {
				openAIVideo.SetProgressStr(ti.Progress)
			}
		}
	}
	return common.Marshal(openAIVideo)
}
