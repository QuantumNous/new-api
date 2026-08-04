package apimart

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

const (
	ChannelName       = "apimart"
	createPath        = "/v1/videos/generations"
	queryPathPrefix   = "/v1/tasks/"
	upstreamOKCode    = 200
	defaultQueryLang  = "zh"
)

// TaskAdaptor implements ApiMart async video API
// (grok-imagine-1.0-video-apimart, MiniMax-H3 / Hailuo, etc.).
// Base URL may be https://api.apimart.ai or domestic https://api.apib.ai.
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
	for _, suf := range []string{createPath, "/v1/videos", "/v1/tasks"} {
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
		return nil, fmt.Errorf("upstream model is empty; configure model mapping on the channel")
	}

	var (
		payload map[string]interface{}
		err     error
	)
	if isMiniMaxModel(modelName) {
		payload, err = convertMiniMaxCreatePayload(c, req, modelName)
	} else {
		payload, err = convertGrokCreatePayload(c, req, modelName)
	}
	if err != nil {
		return nil, err
	}
	return payload, nil
}

func isMiniMaxModel(modelName string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(modelName)), "minimax")
}

// convertGrokCreatePayload keeps legacy size/quality/image_urls mapping for grok-imagine etc.
func convertGrokCreatePayload(c *gin.Context, req *relaycommon.TaskSubmitReq, modelName string) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"model":  modelName,
		"prompt": req.Prompt,
	}

	if size := apimartSizeFromRequest(req); size != "" {
		payload["size"] = size
	}
	if quality := apimartQualityFromRequest(req); quality != "" {
		payload["quality"] = quality
	}
	if d := apimartDurationFromRequest(req); d > 0 {
		payload["duration"] = d
	}
	if images := collectImageURLs(c, req); len(images) > 0 {
		payload["image_urls"] = images
	}
	applyGrokRawCreateFields(c, payload)

	normalizeGrokCreatePayload(payload)

	if err := taskcommon.UnmarshalMetadata(req.Metadata, &payload); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	payload["model"] = modelName
	if strings.TrimSpace(req.Prompt) != "" {
		payload["prompt"] = req.Prompt
	}
	normalizeGrokCreatePayload(payload)
	return payload, nil
}

// convertMiniMaxCreatePayload maps MiniMax-H3 / Hailuo fields per ApiMart docs
// (resolution, aspect_ratio, image_with_roles, video_urls, audio_urls, …).
func convertMiniMaxCreatePayload(c *gin.Context, req *relaycommon.TaskSubmitReq, modelName string) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"model":  modelName,
		"prompt": req.Prompt,
	}

	if d := apimartDurationFromRequest(req); d > 0 {
		payload["duration"] = d
	}
	if ar := apimartSizeFromRequest(req); ar != "" {
		payload["aspect_ratio"] = ar
	}
	if res := apimartResolutionFromRequest(req); res != "" {
		payload["resolution"] = res
	}

	// Avoid mixing I2V role fields with plain image_urls (upstream returns 400).
	if !rawHasI2VFields(c) {
		if images := collectImageURLs(c, req); len(images) > 0 {
			payload["image_urls"] = images
		}
	}
	applyMiniMaxRawCreateFields(c, payload)
	normalizeMiniMaxCreatePayload(payload)

	if err := taskcommon.UnmarshalMetadata(req.Metadata, &payload); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	payload["model"] = modelName
	if strings.TrimSpace(req.Prompt) != "" {
		payload["prompt"] = req.Prompt
	}
	normalizeMiniMaxCreatePayload(payload)
	return payload, nil
}

func apimartSizeFromRequest(req *relaycommon.TaskSubmitReq) string {
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

func apimartQualityFromRequest(req *relaycommon.TaskSubmitReq) string {
	if res := strings.TrimSpace(req.Resolution); res != "" {
		return normalizeQuality(res)
	}
	size := strings.TrimSpace(req.Size)
	if size != "" && !strings.Contains(size, ":") {
		return normalizeQuality(size)
	}
	return ""
}

func apimartResolutionFromRequest(req *relaycommon.TaskSubmitReq) string {
	if res := strings.TrimSpace(req.Resolution); res != "" {
		return normalizeMiniMaxResolution(res)
	}
	size := strings.TrimSpace(req.Size)
	if size != "" && !strings.Contains(size, ":") {
		return normalizeMiniMaxResolution(size)
	}
	return ""
}

func normalizeQuality(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	lower := strings.ToLower(s)
	if strings.HasSuffix(lower, "p") && !strings.Contains(lower, ":") {
		return lower
	}
	return s
}

// normalizeMiniMaxResolution keeps ApiMart MiniMax values: 2K / 768P.
func normalizeMiniMaxResolution(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	upper := strings.ToUpper(s)
	switch upper {
	case "2K":
		return "2K"
	case "768P", "768":
		return "768P"
	}
	return s
}

func apimartDurationFromRequest(req *relaycommon.TaskSubmitReq) int {
	if req.Duration > 0 {
		return req.Duration
	}
	if sec, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil && sec > 0 {
		return sec
	}
	return 0
}

func rawBodyBytes(c *gin.Context) []byte {
	if c == nil {
		return nil
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil
	}
	raw, err := storage.Bytes()
	if err != nil {
		return nil
	}
	return raw
}

func rawHasI2VFields(c *gin.Context) bool {
	raw := rawBodyBytes(c)
	if len(raw) == 0 {
		return false
	}
	if strings.TrimSpace(gjson.GetBytes(raw, "first_frame_image").String()) != "" {
		return true
	}
	if strings.TrimSpace(gjson.GetBytes(raw, "last_frame_image").String()) != "" {
		return true
	}
	arr := gjson.GetBytes(raw, "image_with_roles")
	if !arr.IsArray() {
		return false
	}
	for _, item := range arr.Array() {
		role := strings.ToLower(strings.TrimSpace(item.Get("role").String()))
		switch role {
		case "first_frame", "first", "last_frame", "last":
			return true
		}
	}
	return false
}

// applyGrokRawCreateFields copies grok-style keys from the client JSON.
func applyGrokRawCreateFields(c *gin.Context, payload map[string]interface{}) {
	raw := rawBodyBytes(c)
	if len(raw) == 0 {
		return
	}
	if _, ok := payload["quality"]; !ok {
		if q := strings.TrimSpace(gjson.GetBytes(raw, "quality").String()); q != "" {
			payload["quality"] = normalizeQuality(q)
		}
	}
	if _, ok := payload["size"]; !ok {
		if s := strings.TrimSpace(gjson.GetBytes(raw, "size").String()); s != "" {
			payload["size"] = s
		}
	}
	if gjson.GetBytes(raw, "actual_image_count").Exists() {
		payload["actual_image_count"] = gjson.GetBytes(raw, "actual_image_count").Value()
	}
}

// applyMiniMaxRawCreateFields copies MiniMax-H3 / Hailuo fields from client JSON.
func applyMiniMaxRawCreateFields(c *gin.Context, payload map[string]interface{}) {
	raw := rawBodyBytes(c)
	if len(raw) == 0 {
		return
	}
	if _, ok := payload["resolution"]; !ok {
		if res := strings.TrimSpace(gjson.GetBytes(raw, "resolution").String()); res != "" {
			payload["resolution"] = normalizeMiniMaxResolution(res)
		} else if q := strings.TrimSpace(gjson.GetBytes(raw, "quality").String()); q != "" {
			payload["resolution"] = normalizeMiniMaxResolution(q)
		}
	}
	if _, ok := payload["aspect_ratio"]; !ok {
		if ar := strings.TrimSpace(gjson.GetBytes(raw, "aspect_ratio").String()); ar != "" {
			payload["aspect_ratio"] = ar
		} else if ar := strings.TrimSpace(gjson.GetBytes(raw, "ratio").String()); ar != "" {
			payload["aspect_ratio"] = ar
		} else if s := strings.TrimSpace(gjson.GetBytes(raw, "size").String()); s != "" && strings.Contains(s, ":") {
			payload["aspect_ratio"] = s
		}
	}
	setRawStringIfAbsent(payload, raw, "first_frame_image")
	setRawStringIfAbsent(payload, raw, "last_frame_image")
	setRawValueIfAbsent(payload, raw, "image_with_roles")
	setRawValueIfAbsent(payload, raw, "image_urls")
	setRawValueIfAbsent(payload, raw, "video_urls")
	setRawValueIfAbsent(payload, raw, "audio_urls")
	if gjson.GetBytes(raw, "watermark").Exists() {
		payload["watermark"] = gjson.GetBytes(raw, "watermark").Value()
	} else if gjson.GetBytes(raw, "aigc_watermark").Exists() {
		payload["aigc_watermark"] = gjson.GetBytes(raw, "aigc_watermark").Value()
	}
	setRawStringIfAbsent(payload, raw, "webhook")
}

func setRawStringIfAbsent(payload map[string]interface{}, raw []byte, key string) {
	if _, ok := payload[key]; ok {
		return
	}
	if v := strings.TrimSpace(gjson.GetBytes(raw, key).String()); v != "" {
		payload[key] = v
	}
}

func setRawValueIfAbsent(payload map[string]interface{}, raw []byte, key string) {
	if _, ok := payload[key]; ok {
		return
	}
	v := gjson.GetBytes(raw, key)
	if !v.Exists() {
		return
	}
	payload[key] = v.Value()
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
	// 兜底：body 里 images 为 URL 字符串数组（与 VectorEngine 一致）
	if len(out) == 0 {
		if raw := rawBodyBytes(c); len(raw) > 0 {
			arr := gjson.GetBytes(raw, "images")
			if arr.IsArray() {
				for _, item := range arr.Array() {
					if item.Type == gjson.String {
						if u := strings.TrimSpace(item.String()); u != "" {
							out = append(out, u)
						}
					}
				}
			}
		}
	}
	return out
}

// normalizeGrokCreatePayload: images[] -> image_urls[]；aspect_ratio / 720P 字段映射。
func normalizeGrokCreatePayload(payload map[string]interface{}) {
	normalizeSharedImages(payload)

	if ar, ok := payload["aspect_ratio"].(string); ok {
		ar = strings.TrimSpace(ar)
		if ar != "" && strings.Contains(ar, ":") {
			if size, _ := payload["size"].(string); !strings.Contains(strings.TrimSpace(size), ":") {
				payload["size"] = ar
			}
		}
		delete(payload, "aspect_ratio")
	}

	if size, ok := payload["size"].(string); ok {
		size = strings.TrimSpace(size)
		if size != "" && !strings.Contains(size, ":") {
			if _, hasQuality := payload["quality"]; !hasQuality {
				payload["quality"] = normalizeQuality(size)
			}
			delete(payload, "size")
		}
	}
}

// normalizeMiniMaxCreatePayload keeps resolution/aspect_ratio; maps aliases from size/quality/images.
func normalizeMiniMaxCreatePayload(payload map[string]interface{}) {
	normalizeSharedImages(payload)

	if ar, ok := payload["aspect_ratio"].(string); ok {
		ar = strings.TrimSpace(ar)
		if ar == "" {
			delete(payload, "aspect_ratio")
		} else {
			payload["aspect_ratio"] = ar
		}
	}
	if ratio, ok := payload["ratio"].(string); ok {
		ratio = strings.TrimSpace(ratio)
		if ratio != "" {
			if cur, _ := payload["aspect_ratio"].(string); strings.TrimSpace(cur) == "" {
				payload["aspect_ratio"] = ratio
			}
		}
		delete(payload, "ratio")
	}

	if size, ok := payload["size"].(string); ok {
		size = strings.TrimSpace(size)
		if size != "" {
			if strings.Contains(size, ":") {
				if cur, _ := payload["aspect_ratio"].(string); strings.TrimSpace(cur) == "" {
					payload["aspect_ratio"] = size
				}
			} else if _, hasRes := payload["resolution"]; !hasRes {
				payload["resolution"] = normalizeMiniMaxResolution(size)
			}
		}
		delete(payload, "size")
	}

	if q, ok := payload["quality"].(string); ok {
		q = strings.TrimSpace(q)
		if q != "" {
			if _, hasRes := payload["resolution"]; !hasRes {
				payload["resolution"] = normalizeMiniMaxResolution(q)
			}
		}
		delete(payload, "quality")
	}

	if res, ok := payload["resolution"].(string); ok {
		if n := normalizeMiniMaxResolution(res); n != "" {
			payload["resolution"] = n
		} else {
			delete(payload, "resolution")
		}
	}
}

func normalizeSharedImages(payload map[string]interface{}) {
	if _, ok := payload["image_urls"]; !ok {
		if imgs, ok := payload["images"].([]string); ok && len(imgs) > 0 {
			payload["image_urls"] = imgs
		} else if imgs := gjsonParseStringArray(payload["images"]); len(imgs) > 0 {
			payload["image_urls"] = imgs
		}
	}
	delete(payload, "images")
	delete(payload, "image")
}

// normalizeApimartCreatePayload is kept for tests / callers expecting the grok normalizer name.
func normalizeApimartCreatePayload(payload map[string]interface{}) {
	normalizeGrokCreatePayload(payload)
}

func gjsonParseStringArray(v any) []string {
	if v == nil {
		return nil
	}
	raw, err := common.Marshal(v)
	if err != nil {
		return nil
	}
	arr := gjson.GetBytes(raw, "@this")
	if !arr.IsArray() {
		return nil
	}
	out := make([]string, 0, len(arr.Array()))
	for _, item := range arr.Array() {
		if item.Type == gjson.String {
			if u := strings.TrimSpace(item.String()); u != "" {
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
	if code := gjson.Get(raw, "code"); code.Exists() && code.Int() != upstreamOKCode {
		msg := strings.TrimSpace(gjson.Get(raw, "message").String())
		if msg == "" {
			msg = strings.TrimSpace(gjson.Get(raw, "msg").String())
		}
		if msg == "" {
			msg = "upstream create task failed"
		}
		return "", fmt.Errorf("%s", msg)
	}
	for _, path := range []string{"data.id", "data.task_id", "id"} {
		if id := strings.TrimSpace(gjson.Get(raw, path).String()); id != "" {
			return id, nil
		}
	}
	// Multi-image create may return data as an array: {"data":[{"task_id":"...","status":"submitted"}]}
	if data := gjson.Get(raw, "data"); data.IsArray() {
		for _, item := range data.Array() {
			if id := strings.TrimSpace(item.Get("task_id").String()); id != "" {
				return id, nil
			}
			if id := strings.TrimSpace(item.Get("id").String()); id != "" {
				return id, nil
			}
		}
	}
	return "", fmt.Errorf("task id not found in create response")
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
	u, err := url.Parse(apiOrigin(baseUrl) + queryPathPrefix + url.PathEscape(taskID))
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("language", defaultQueryLang)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	raw := string(respBody)
	if code := gjson.Get(raw, "code"); code.Exists() && code.Int() != upstreamOKCode {
		ti := relaycommon.TaskInfo{
			Code:     int(code.Int()),
			Status:   model.TaskStatusFailure,
			Progress: "100%",
			Reason:   extractErrorMessage(raw),
		}
		return &ti, nil
	}

	status := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "data.status").String()))
	taskResult := relaycommon.TaskInfo{Code: 0}

	switch status {
	case "completed", "success", "succeeded":
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
	case "failed", "failure", "error", "cancelled", "canceled":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = extractErrorMessage(raw)
		if taskResult.Reason == "" {
			taskResult.Reason = "task failed"
		}
		return &taskResult, nil
	case "submitted", "pending", "queued", "processing", "in_progress", "running":
		taskResult.Status = model.TaskStatusInProgress
		if p := gjson.Get(raw, "data.progress").Int(); p > 0 && p < 100 {
			taskResult.Progress = fmt.Sprintf("%d%%", p)
		} else {
			taskResult.Progress = "30%"
		}
		return &taskResult, nil
	default:
		if u := extractVideoURL(raw); u != "" {
			taskResult.Status = model.TaskStatusSuccess
			taskResult.Progress = "100%"
			taskResult.Url = u
			return &taskResult, nil
		}
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
		return &taskResult, nil
	}
}

func extractVideoURL(raw string) string {
	for _, path := range []string{
		"data.result.videos.0.url.0",
		"data.result.videos.0.url",
		"data.video_url",
		"data.url",
	} {
		val := gjson.Get(raw, path)
		if !val.Exists() {
			continue
		}
		if val.IsArray() {
			if len(val.Array()) > 0 {
				if u := strings.TrimSpace(val.Array()[0].String()); u != "" {
					return u
				}
			}
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
		"message",
		"msg",
		"data.message",
		"data.error.message",
		"error.message",
	} {
		if msg := strings.TrimSpace(gjson.Get(raw, path).String()); msg != "" {
			return msg
		}
	}
	return ""
}

// EstimateBilling uses video duration for pre-consume scaling (model fixed price × seconds).
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	sec := apimartDurationFromRequest(&req)
	if sec <= 0 {
		sec = 6
	}
	return map[string]float64{"seconds": float64(sec)}
}

// AdjustBillingOnComplete settles by upstream USD cost in query response (data.cost).
func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	if task == nil || taskResult == nil || taskResult.Status != model.TaskStatusSuccess {
		return 0
	}
	cost := taskcommon.ExtractUSDFromJSON(task.Data)
	if cost <= 0 {
		return 0
	}
	groupRatio := 1.0
	costMultiplier := 1.0
	modelName := ""
	if bc := task.PrivateData.BillingContext; bc != nil {
		if bc.GroupRatio > 0 {
			groupRatio = bc.GroupRatio
		}
		if bc.UpstreamCostMultiplier > 0 {
			costMultiplier = bc.UpstreamCostMultiplier
		}
		modelName = bc.OriginModelName
	}
	if modelName == "" {
		modelName = task.Properties.OriginModelName
	}
	if costMultiplier <= 0 {
		costMultiplier = billing_setting.ResolveUpstreamCostMultiplier(modelName)
	}
	return taskcommon.QuotaFromUSDCost(cost, groupRatio, costMultiplier)
}

func (a *TaskAdaptor) GetModelList() []string {
	return []string{
		"grok-imagine-1.0-video-apimart",
		"MiniMax-H3",
	}
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
		}
	}
	return common.Marshal(openAIVideo)
}
