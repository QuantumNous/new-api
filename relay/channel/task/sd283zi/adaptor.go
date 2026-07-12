package sd283zi

import (
	"bytes"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"path"
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

type imageURLEntry struct {
	URL         string `json:"url"`
	FileName    string `json:"file_name"`
	ContentType string `json:"content_type"`
}

// TaskAdaptor implements 83zi SD2 async video API (https://sd2.83zi.com).
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
	for _, suf := range []string{createPath, "/api/generate-video", "/api/task", "/api/video"} {
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
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-License-Key", a.apiKey)
	if ct := c.Request.Header.Get("Content-Type"); strings.Contains(ct, "multipart/form-data") {
		req.Header.Set("Content-Type", ct)
	} else {
		req.Header.Set("Content-Type", "application/json")
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	contentType := c.GetHeader("Content-Type")
	if strings.Contains(contentType, "multipart/form-data") {
		return a.buildMultipartRequestBody(c, info)
	}

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

func (a *TaskAdaptor) buildMultipartRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	formData, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return nil, errors.Wrap(err, "parse multipart form failed")
	}

	modelName := strings.TrimSpace(info.UpstreamModelName)
	if modelName == "" {
		modelName = strings.TrimSpace(info.OriginModelName)
	}
	if vals := formData.Value["model"]; len(vals) > 0 {
		if clientModel := strings.TrimSpace(vals[0]); clientModel != "" {
			modelName = clientModel
		}
	}
	modelName = resolveUpstreamModel(modelName)
	if modelName == "" {
		return nil, fmt.Errorf("upstream model is empty; use sd2fast, sd2, or mingiz-sd2")
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	_ = writer.WriteField("model", modelName)

	taskReq, _ := relaycommon.GetTaskRequest(c)
	written := map[string]bool{"model": true}
	writeField := func(key, value string) {
		value = strings.TrimSpace(value)
		if value == "" || written[key] {
			return
		}
		_ = writer.WriteField(key, value)
		written[key] = true
	}

	for key, vals := range formData.Value {
		if key == "model" || written[key] {
			continue
		}
		for _, v := range vals {
			_ = writer.WriteField(key, v)
		}
		written[key] = true
	}

	writeField("prompt", taskReq.Prompt)
	if d := durationFromRequest(&taskReq); d > 0 {
		writeField("duration", strconv.Itoa(d))
	}
	if ratio := ratioFromRequest(&taskReq); ratio != "" {
		writeField("ratio", ratio)
	}
	if res := strings.TrimSpace(taskReq.Resolution); res != "" {
		writeField("resolution", strings.ToLower(res))
	}
	if info.PublicTaskID != "" {
		writeField("client_task_id", info.PublicTaskID)
	}
	if !written["ratio"] {
		for _, key := range []string{"aspect_ratio", "size"} {
			if vals := formData.Value[key]; len(vals) > 0 {
				if v := strings.TrimSpace(vals[0]); v != "" && strings.Contains(v, ":") {
					writeField("ratio", v)
					break
				}
			}
		}
		if ratio := ratioFromRequest(&taskReq); ratio != "" {
			writeField("ratio", ratio)
		}
	}

	for fieldName, fileHeaders := range formData.File {
		if isTextMultipartField(fieldName) {
			continue
		}
		targetName := upstreamFileFieldName(fieldName)
		for _, fh := range fileHeaders {
			if err := writeMultipartFile(writer, targetName, fh); err != nil {
				return nil, err
			}
		}
	}

	if err := writer.Close(); err != nil {
		return nil, err
	}
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return &buf, nil
}

func isTextMultipartField(fieldName string) bool {
	switch strings.ToLower(strings.TrimSpace(fieldName)) {
	case "prompt", "model", "mode", "size", "seconds", "duration", "aspect_ratio", "resolution", "image", "protect_stripe":
		return true
	default:
		return false
	}
}

func upstreamFileFieldName(fieldName string) string {
	switch strings.ToLower(strings.TrimSpace(fieldName)) {
	case "files", "file", "image", "images", "reference_image", "reference_images", "input_reference":
		return "files"
	default:
		return fieldName
	}
}

func writeMultipartFile(writer *multipart.Writer, fieldName string, fh *multipart.FileHeader) error {
	f, err := fh.Open()
	if err != nil {
		return err
	}

	ct := fh.Header.Get("Content-Type")
	if ct == "" || ct == "application/octet-stream" {
		buf512 := make([]byte, 512)
		n, _ := io.ReadFull(f, buf512)
		ct = http.DetectContentType(buf512[:n])
		f.Close()
		f, err = fh.Open()
		if err != nil {
			return err
		}
	}
	defer f.Close()

	filename := fh.Filename
	if strings.TrimSpace(filename) == "" {
		filename = "file.bin"
	}

	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, filename))
	h.Set("Content-Type", ct)
	part, err := writer.CreatePart(h)
	if err != nil {
		return err
	}
	_, err = io.Copy(part, f)
	return err
}

func (a *TaskAdaptor) convertCreatePayload(c *gin.Context, req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (map[string]interface{}, error) {
	modelName := strings.TrimSpace(info.UpstreamModelName)
	if modelName == "" {
		modelName = strings.TrimSpace(info.OriginModelName)
	}
	modelName = resolveUpstreamModel(modelName)
	if modelName == "" {
		return nil, fmt.Errorf("upstream model is empty; use sd2fast, sd2, or mingiz-sd2")
	}

	// VolcEngine official content[] → 83zi / mingiz-sd2 fields (all 83zi models).
	volcNorm := detectAndNormalizeVolcOfficial(c, req)

	payload := map[string]interface{}{
		"model":  modelName,
		"prompt": strings.TrimSpace(req.Prompt),
	}
	if isSD2UpstreamModel(modelName) {
		payload["remote_media_source"] = "cos"
	}
	if info.PublicTaskID != "" {
		payload["client_task_id"] = info.PublicTaskID
	}
	if ratio := ratioFromRequest(req); ratio != "" {
		payload["ratio"] = ratio
	}
	if res := strings.TrimSpace(req.Resolution); res != "" {
		payload["resolution"] = strings.ToLower(res)
	}
	if d := durationFromRequest(req); d > 0 {
		payload["duration"] = d
	}
	if images := collectImageEntries(c, req); len(images) > 0 {
		payload["image_urls"] = images
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
	applyVolcNormalized(payload, volcNorm)
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
			payload["resolution"] = strings.ToLower(res)
		}
	}
	if _, ok := payload["ratio"]; !ok {
		if ratio := strings.TrimSpace(gjson.GetBytes(raw, "ratio").String()); ratio != "" {
			payload["ratio"] = ratio
		} else if ratio := strings.TrimSpace(gjson.GetBytes(raw, "aspect_ratio").String()); ratio != "" {
			payload["ratio"] = ratio
		}
	}
	if _, ok := payload["remote_media_source"]; !ok {
		if src := strings.TrimSpace(gjson.GetBytes(raw, "remote_media_source").String()); src != "" {
			payload["remote_media_source"] = src
		}
	}
	if _, ok := payload["image_urls"]; !ok {
		if entries := parseImageURLsFromRaw(raw); len(entries) > 0 {
			payload["image_urls"] = entries
		}
	}
	if _, ok := payload["reference_video_urls"]; !ok {
		if arr := gjson.GetBytes(raw, "reference_video_urls"); arr.Exists() {
			payload["reference_video_urls"] = arr.Value()
		}
	}
	if _, ok := payload["audio_urls"]; !ok {
		if arr := gjson.GetBytes(raw, "audio_urls"); arr.Exists() {
			payload["audio_urls"] = arr.Value()
		}
	}
}

func normalizeCreatePayload(payload map[string]interface{}) {
	if _, ok := payload["reference_video_urls"]; !ok {
		payload["reference_video_urls"] = []any{}
	}
	if _, ok := payload["audio_urls"]; !ok {
		payload["audio_urls"] = []any{}
	}
	if ar, ok := payload["aspect_ratio"].(string); ok {
		ar = strings.TrimSpace(ar)
		if ar != "" {
			if ratio, _ := payload["ratio"].(string); strings.TrimSpace(ratio) == "" {
				payload["ratio"] = ar
			}
		}
		delete(payload, "aspect_ratio")
	}
}

func collectImageEntries(c *gin.Context, req *relaycommon.TaskSubmitReq) []imageURLEntry {
	urls := make([]string, 0, len(req.Images)+2)
	for _, u := range req.Images {
		if u = strings.TrimSpace(u); u != "" {
			urls = append(urls, u)
		}
	}
	if u := strings.TrimSpace(req.Image); u != "" {
		urls = append(urls, u)
	}
	if u := strings.TrimSpace(req.InputReference); u != "" {
		urls = append(urls, u)
	}
	if len(urls) == 0 {
		if storage, err := common.GetBodyStorage(c); err == nil {
			if raw, err := storage.Bytes(); err == nil {
				urls = append(urls, parseStringURLsFromRaw(raw)...)
			}
		}
	}
	out := make([]imageURLEntry, 0, len(urls))
	for _, u := range urls {
		out = append(out, toImageURLEntry(u))
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
		}
	}
	return out
}

func parseImageURLsFromRaw(raw []byte) []imageURLEntry {
	urls := parseStringURLsFromRaw(raw)
	if len(urls) == 0 {
		return nil
	}
	out := make([]imageURLEntry, 0, len(urls))
	for _, u := range urls {
		out = append(out, toImageURLEntry(u))
	}
	return out
}

func toImageURLEntry(imageURL string) imageURLEntry {
	imageURL = strings.TrimSpace(imageURL)
	fileName := path.Base(strings.Split(imageURL, "?")[0])
	if fileName == "" || fileName == "." || fileName == "/" {
		fileName = "image.jpg"
	}
	contentType := mime.TypeByExtension(path.Ext(fileName))
	if contentType == "" {
		contentType = "image/jpeg"
	}
	return imageURLEntry{
		URL:         imageURL,
		FileName:    fileName,
		ContentType: contentType,
	}
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
	if msg := extractErrorMessage(raw); msg != "" {
		status := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "status").String()))
		if status == "error" || status == "failed" || status == "failure" {
			return "", fmt.Errorf("%s", msg)
		}
	}
	for _, path := range []string{"task_id", "task.task_id", "data.task_id", "id"} {
		if id := strings.TrimSpace(gjson.Get(raw, path).String()); id != "" {
			return id, nil
		}
	}
	return "", fmt.Errorf("task_id not found in create response")
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	resp, err := a.fetchTaskHTTP(baseUrl, key, taskID, proxy)
	if err != nil {
		return nil, err
	}
	pollBody, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return nil, err
	}

	origin := apiOrigin(baseUrl)
	enhanced, err := a.maybeEnhancePollBody(origin, key, taskID, pollBody, proxy)
	if err != nil {
		return nil, err
	}

	resp.Body = io.NopCloser(bytes.NewReader(enhanced))
	resp.ContentLength = int64(len(enhanced))
	resp.Header.Set("Content-Type", "application/json")
	return resp, nil
}

func (a *TaskAdaptor) fetchTaskHTTP(baseUrl, key, taskID, proxy string) (*http.Response, error) {
	queryURL, err := buildQueryURL(baseUrl, taskID)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodGet, queryURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-License-Key", key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) maybeEnhancePollBody(baseURL, key, taskID string, pollBody []byte, proxy string) ([]byte, error) {
	raw := string(pollBody)
	if extractVideoURL(raw) != "" {
		return pollBody, nil
	}
	if !shouldFetchVideoLink(raw) {
		return pollBody, nil
	}
	if u := absolutizeUpstreamMediaURL(baseURL, extractRelativeVideoURL(raw)); u != "" {
		return mergeVideoURL(pollBody, u)
	}

	linkBody, err := a.fetchVideoLinkHTTP(baseURL, key, taskID, proxy)
	if err != nil {
		return pollBody, nil
	}
	if u := extractVideoURL(string(linkBody)); u != "" {
		return mergeVideoURL(pollBody, u)
	}
	if u := buildLicenseVideoURL(baseURL, taskID, key); u != "" {
		return mergeVideoURL(pollBody, u)
	}
	return pollBody, nil
}

func (a *TaskAdaptor) fetchVideoLinkHTTP(baseURL, key, taskID, proxy string) ([]byte, error) {
	linkURL := strings.TrimRight(baseURL, "/") + "/api/task/" + url.PathEscape(taskID) + "/video-link?refresh=1"
	req, err := http.NewRequest(http.MethodGet, linkURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-License-Key", key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("video-link status %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func shouldFetchVideoLink(raw string) bool {
	if isUpstreamGenerationComplete(raw) {
		return true
	}
	status := resolveUpstreamStatus(raw)
	if isSuccessLikeUpstreamStatus(status) && gjson.Get(raw, "progress").Int() >= 100 {
		return true
	}
	if strings.TrimSpace(gjson.Get(raw, "video_path").String()) != "" {
		return true
	}
	return false
}

func mergeVideoURL(pollBody []byte, videoURL string) ([]byte, error) {
	var payload map[string]interface{}
	if err := common.Unmarshal(pollBody, &payload); err != nil {
		return pollBody, nil
	}
	payload["video_url"] = videoURL
	out, err := common.Marshal(payload)
	if err != nil {
		return pollBody, nil
	}
	return out, nil
}

func buildLicenseVideoURL(baseURL, taskID, key string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	taskID = strings.TrimSpace(taskID)
	key = strings.TrimSpace(key)
	if baseURL == "" || taskID == "" || key == "" {
		return ""
	}
	u, err := url.Parse(baseURL + "/api/video/" + url.PathEscape(taskID))
	if err != nil {
		return ""
	}
	q := u.Query()
	q.Set("license_key", key)
	u.RawQuery = q.Encode()
	return u.String()
}

func extractRelativeVideoURL(raw string) string {
	for _, path := range []string{
		"stable_video_url",
		"video_path",
		"data.stable_video_url",
		"data.video_path",
	} {
		if u := strings.TrimSpace(gjson.Get(raw, path).String()); u != "" && strings.HasPrefix(u, "/") {
			return u
		}
	}
	return ""
}

func absolutizeUpstreamMediaURL(baseURL, mediaPath string) string {
	mediaPath = strings.TrimSpace(mediaPath)
	if mediaPath == "" {
		return ""
	}
	if strings.HasPrefix(mediaPath, "http") {
		return mediaPath
	}
	if strings.HasPrefix(mediaPath, "/") {
		return strings.TrimRight(strings.TrimSpace(baseURL), "/") + mediaPath
	}
	return ""
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
	taskResult := relaycommon.TaskInfo{Code: 0}

	status := resolveUpstreamStatus(raw)
	taskStatus := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "task_status").String()))

	if isFailureUpstreamStatus(status) || isFailureUpstreamStatus(taskStatus) {
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = extractErrorMessage(raw)
		if taskResult.Reason == "" {
			taskResult.Reason = "task failed"
		}
		return &taskResult, nil
	}

	if u := extractVideoURL(raw); u != "" {
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = u
		return &taskResult, nil
	}

	if isInProgressUpstreamStatus(status) || isInProgressUpstreamStatus(taskStatus) {
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = formatProgress(raw)
		return &taskResult, nil
	}

	if isSuccessLikeUpstreamStatus(status) || isSuccessLikeUpstreamStatus(taskStatus) {
		if isUpstreamGenerationComplete(raw) {
			taskResult.Status = model.TaskStatusFailure
			taskResult.Progress = "100%"
			taskResult.Reason = "completed but video url is empty"
			return &taskResult, nil
		}
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = formatProgress(raw)
		return &taskResult, nil
	}

	taskResult.Status = model.TaskStatusInProgress
	taskResult.Progress = formatProgress(raw)
	return &taskResult, nil
}

// resolveUpstreamStatus reads job status from poll/create payloads.
// Create ack uses status=success (API ok) + task_status=pending — must not treat as generation complete.
func resolveUpstreamStatus(raw string) string {
	for _, path := range []string{"data.status", "status", "task_status"} {
		s := strings.ToLower(strings.TrimSpace(gjson.Get(raw, path).String()))
		if s == "" {
			continue
		}
		if path == "status" && isSuccessLikeUpstreamStatus(s) {
			if ts := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "task_status").String())); ts != "" && isInProgressUpstreamStatus(ts) {
				return ts
			}
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
	case "pending", "polling", "queued", "processing", "running", "in_progress", "submitted", "reserved":
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

func isUpstreamGenerationComplete(raw string) bool {
	if p := gjson.Get(raw, "progress").Int(); p > 0 && p < 100 {
		return false
	}
	if completedAt := strings.TrimSpace(gjson.Get(raw, "completed_at").String()); completedAt == "" {
		return false
	}
	if videoPath := strings.TrimSpace(gjson.Get(raw, "video_path").String()); videoPath == "" {
		// completed_at set but still no playable url — treat as terminal failure
		return true
	}
	return false
}

func formatProgress(raw string) string {
	if p := gjson.Get(raw, "progress").Int(); p > 0 && p < 100 {
		return fmt.Sprintf("%d%%", p)
	}
	return "30%"
}

func extractVideoURL(raw string) string {
	for _, path := range []string{
		"video_url",
		"mp4_url",
		"official_video_url",
		"video_link",
		"url",
		"task.video_url",
		"data.video_url",
		"data.video_link",
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
		"error_message",
		"message",
		"msg",
		"status_text",
		"error.message",
	} {
		if msg := strings.TrimSpace(gjson.Get(raw, path).String()); msg != "" {
			return msg
		}
	}
	return ""
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	// 按次固定价格时不返回 seconds 倍率；仅在 billing_mode=per_second 时按秒计费。
	if !billing_setting.IsPerSecondModel(info.OriginModelName) {
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
