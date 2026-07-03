package task7tai

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
	"github.com/QuantumNous/new-api/setting/billing_setting"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/tidwall/gjson"
)

// TaskAdaptor implements 7tai (炳火 API) async video API (https://api.7tai.cc/v1).
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
	for _, suf := range []string{createPath, "/video/generations", "/v1/video/generations"} {
		b = trimSuffixFold(b, suf)
	}
	if strings.HasSuffix(strings.ToLower(b), "/v1") {
		return strings.TrimRight(b, "/")
	}
	return strings.TrimRight(b, "/") + "/v1"
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
		payload["images"] = images
	}
	applyRawCreateFields(c, payload)

	if err := taskcommon.UnmarshalMetadata(req.Metadata, &payload); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	payload["model"] = modelName
	if strings.TrimSpace(req.Prompt) != "" {
		payload["prompt"] = strings.TrimSpace(req.Prompt)
	}
	normalizeCreatePayload(payload)
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
	if strings.HasSuffix(lower, "p") && !strings.Contains(lower, ":") {
		return strings.ToUpper(lower[:len(lower)-1]) + "P"
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
	if _, ok := payload["images"]; !ok {
		if imgs := parseStringURLsFromRaw(raw); len(imgs) > 0 {
			payload["images"] = imgs
		}
	}
	if gjson.GetBytes(raw, "generate_audio").Exists() {
		payload["generate_audio"] = gjson.GetBytes(raw, "generate_audio").Bool()
	}
	if arr := gjson.GetBytes(raw, "videos"); arr.Exists() {
		payload["videos"] = arr.Value()
	}
	if arr := gjson.GetBytes(raw, "audios"); arr.Exists() {
		payload["audios"] = arr.Value()
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
				out = append(out, parseStringURLsFromRaw(raw)...)
			}
		}
	}
	return out
}

func parseStringURLsFromRaw(raw []byte) []string {
	out := make([]string, 0, 4)
	for _, path := range []string{"images", "image_urls", "image", "image_url"} {
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
	for _, path := range []string{"task_id", "data.task_id", "id", "data.id"} {
		if id := strings.TrimSpace(gjson.Get(raw, path).String()); id != "" {
			return id, nil
		}
	}
	return "", fmt.Errorf("task_id not found in create response")
}

func isUpstreamError(raw string) bool {
	if code := gjson.Get(raw, "code"); code.Exists() {
		s := strings.ToLower(strings.TrimSpace(code.String()))
		if s != "" && s != "success" && s != "0" && s != "200" {
			return true
		}
		if code.Type == gjson.Number && code.Int() != 0 && code.Int() != 200 {
			return true
		}
	}
	status := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "status").String()))
	return status == "failed" || status == "error" || status == "failure"
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
		taskResult.Progress = formatProgress(raw)
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
	taskResult.Progress = formatProgress(raw)
	return &taskResult, nil
}

func resolveUpstreamStatus(raw string) string {
	for _, path := range []string{
		"data.status",
		"data.data.status",
		"status",
	} {
		s := strings.ToLower(strings.TrimSpace(gjson.Get(raw, path).String()))
		if s == "" {
			continue
		}
		return s
	}
	return ""
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
	case "pending", "polling", "queued", "processing", "running", "in_progress", "submitted":
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

func formatProgress(raw string) string {
	for _, path := range []string{"data.progress", "data.data.progress", "progress"} {
		val := gjson.Get(raw, path)
		if !val.Exists() {
			continue
		}
		if val.Type == gjson.String {
			if p := strings.TrimSpace(val.String()); p != "" {
				return p
			}
		}
		if p := val.Int(); p > 0 && p < 100 {
			return fmt.Sprintf("%d%%", p)
		}
	}
	return "30%"
}

func extractVideoURL(raw string) string {
	for _, path := range []string{
		"data.result_url",
		"data.data.video_url",
		"data.data.data.0.url",
		"data.video_url",
		"result_url",
		"video_url",
		"url",
		"data.url",
	} {
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
		"data.fail_reason",
		"data.data.fail_reason",
		"fail_reason",
		"message",
		"msg",
		"error.message",
	} {
		if msg := strings.TrimSpace(gjson.Get(raw, path).String()); msg != "" {
			return msg
		}
	}
	return ""
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if !billing_setting.IsPerSecondModel(info.OriginModelName) && !isPerSecondModel(info.OriginModelName) {
		return nil
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	sec := durationFromRequest(&req)
	if sec <= 0 {
		sec = 5
	}
	return map[string]float64{"seconds": float64(sec)}
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
