package vyroseedance

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"path/filepath"
	"strings"
	"time"

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

type responseTask struct {
	ID       string `json:"id"`
	TaskID   string `json:"task_id,omitempty"`
	Object   string `json:"object"`
	Model    string `json:"model"`
	Status   string `json:"status"`
	Progress int    `json:"progress,omitempty"`
	// vyro may return url at top level, or video_url, or under metadata
	URL      string `json:"url,omitempty"`
	VideoURL string `json:"video_url,omitempty"`
	Metadata *struct {
		URL string `json:"url,omitempty"`
	} `json:"metadata,omitempty"`
	CreatedAt int64 `json:"created_at,omitempty"`
	Error     *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey  string
	baseURL string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = apiOrigin(info.ChannelBaseUrl)
	a.apiKey = info.ApiKey
}

func apiOrigin(raw string) string {
	b := strings.TrimRight(strings.TrimSpace(raw), "/")
	// Only trim video-specific suffixes to avoid accidentally stripping /v1 when the provider base includes version prefix (e.g. https://www.uu-comic.com/v1)
	for _, suf := range []string{"/v1/videos", "/videos"} {
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

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	// 返回 nil 表示不使用 seconds 等额外倍率，只按你在后台设置的“模型价格”计费（例如 3.5/次）。
	// 如果你想改成按秒计费，可以把模型价格设成“每秒多少钱”，然后把下面改回返回 {"seconds": ...}
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	url := a.baseURL + "/videos"
	common.SysLog(fmt.Sprintf("[VYRO-DEBUG] BuildRequestURL for upstream: %s (baseURL from channel: %s)", url, a.baseURL))
	return url, nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Accept", "application/json")

	// Critical for multipart: the Content-Type (with boundary) must be set on the *outgoing* request.
	// BuildRequestBody sets it on c.Request.Header, we must copy it here.
	if ct := c.Request.Header.Get("Content-Type"); ct != "" {
		req.Header.Set("Content-Type", ct)
	}

	common.SysLog(fmt.Sprintf("[VYRO-DEBUG] sending to upstream: %s , Authorization: Bearer %s (masked), Content-Type: %s", req.URL.String(), maskKey(a.apiKey), req.Header.Get("Content-Type")))
	return nil
}

func maskKey(k string) string {
	if len(k) <= 8 {
		return "***"
	}
	return k[:4] + "..." + k[len(k)-4:]
}

// BuildRequestBody constructs the exact multipart/form-data that Vyro Seedance expects.
// Supports two input styles:
//   - Incoming multipart with actual reference_images file parts (drama sends pre-downloaded files) → forward them.
//   - JSON or form with reference_image_urls / images → download inside relay and attach as files.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	modelName := strings.TrimSpace(info.UpstreamModelName)
	contentType := c.GetHeader("Content-Type")

	common.SysLog(fmt.Sprintf("[VYRO-DEBUG] BuildRequestBody ENTRY: Origin=%q Upstream=%q contentType=%s", info.OriginModelName, info.UpstreamModelName, contentType))

	// Robust fallback for model name (very important for direct curl / multipart tests):
	// 1. Prefer UpstreamModelName from channel model mapping
	// 2. Try OriginModelName
	// 3. Read directly from incoming multipart form (the -F "model=..." the client actually sent)
	// 4. Read from parsed TaskSubmitReq
	// 5. Default
	if modelName == "" {
		modelName = strings.TrimSpace(info.OriginModelName)
	}

	if modelName == "" && strings.Contains(contentType, "multipart/form-data") {
		// Force parse the multipart so form values are available
		if _, perr := c.MultipartForm(); perr == nil {
			if v := strings.TrimSpace(c.PostForm("model")); v != "" {
				modelName = v
			}
		}
		// Also try the reusable parser
		if modelName == "" {
			if fd, _ := common.ParseMultipartFormReusable(c); fd != nil {
				if vals := fd.Value["model"]; len(vals) > 0 {
					if v := strings.TrimSpace(vals[0]); v != "" {
						modelName = v
					}
				}
			}
		}
	}

	if modelName == "" {
		if req, _ := relaycommon.GetTaskRequest(c); strings.TrimSpace(req.Model) != "" {
			modelName = strings.TrimSpace(req.Model)
		}
	}

	if modelName == "" {
		modelName = "vyro-seedance-2-fast"
	}

	common.SysLog(fmt.Sprintf("[VYRO-DEBUG] final modelName chosen for upstream: %q", modelName))

	// If client already sent multipart (with binary reference_images), rebuild/forward it.
	if strings.Contains(contentType, "multipart/form-data") {
		formData, err := common.ParseMultipartFormReusable(c)
		if err == nil && formData != nil {
			var buf bytes.Buffer
			writer := multipart.NewWriter(&buf)

			// Prefer the exact "model" value the client sent in this multipart request.
			// This makes direct curl testing reliable, even if channel mapping didn't set UpstreamModelName.
			clientModel := ""
			if vals := formData.Value["model"]; len(vals) > 0 {
				clientModel = strings.TrimSpace(vals[0])
			}
			common.SysLog(fmt.Sprintf("[VYRO-DEBUG] multipart parsed: client sent model=%q , current modelName=%q , form keys count=%d", clientModel, modelName, len(formData.Value)))

			if clientModel != "" {
				modelName = clientModel
			}
			if modelName == "" {
				modelName = "vyro-seedance-2-fast"
			}

			common.SysLog(fmt.Sprintf("[VYRO-DEBUG] about to write model=%q as first field", modelName))

			// write/override key fields (always force the resolved modelName as the very first field)
			_ = writer.WriteField("model", modelName)

			writtenFields := []string{"model"}

			hasRefFiles := len(formData.File["reference_images"]) > 0 || len(formData.File["reference_image"]) > 0 || len(formData.File["images"]) > 0

			// copy other text fields, skip model (we overrode), compute mode if not present
			modeFromForm := ""
			for key, vals := range formData.Value {
				if key == "model" {
					continue
				}
				for _, v := range vals {
					if key == "mode" {
						modeFromForm = v
					}
					_ = writer.WriteField(key, v)
					writtenFields = append(writtenFields, key)
				}
			}

			common.SysLog(fmt.Sprintf("[VYRO-DEBUG] text fields written to upstream form: %v", writtenFields))

			// ensure prompt if present via TaskSubmitReq
			if req, _ := relaycommon.GetTaskRequest(c); strings.TrimSpace(req.Prompt) != "" {
				// only set if not already provided
				if len(formData.Value["prompt"]) == 0 {
					_ = writer.WriteField("prompt", strings.TrimSpace(req.Prompt))
				}
			}

			// ensure mode
			if modeFromForm == "" {
				if hasRefFiles {
					_ = writer.WriteField("mode", "reference_to_video")
				} else {
					_ = writer.WriteField("mode", "text_to_video")
				}
			}

			// copy file parts, renaming to reference_images when necessary
			for fieldName, fhs := range formData.File {
				targetName := fieldName
				if fieldName == "image" || fieldName == "images" || fieldName == "reference_image" {
					targetName = "reference_images"
				}
				for _, fh := range fhs {
					f, err := fh.Open()
					if err != nil {
						continue
					}
					ct := fh.Header.Get("Content-Type")
					if ct == "" || ct == "application/octet-stream" {
						buf512 := make([]byte, 512)
						n, _ := io.ReadFull(f, buf512)
						ct = http.DetectContentType(buf512[:n])
						f.Close()
						f, _ = fh.Open()
					}
					h := make(textproto.MIMEHeader)
					h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, targetName, fh.Filename))
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

			// Note: model was already written at the top. Do not write it again to avoid duplicate keys
			// (duplicate "model" turns into array on form parse, causing "cannot unmarshal array into ... string" on some servers).

			writer.Close()
			c.Request.Header.Set("Content-Type", writer.FormDataContentType())

			common.SysLog(fmt.Sprintf("[VYRO-DEBUG] multipart body built successfully. body size=%d bytes, content-type=%s", buf.Len(), writer.FormDataContentType()))

			// Debug: re-parse the body we just built and list all part names
			if debugParts, err := debugListMultipartParts(&buf, writer.FormDataContentType()); err == nil {
				common.SysLog("[VYRO-DEBUG] parts in body we will send: " + debugParts)
				// Quick check for duplicate model
				if strings.Count(debugParts, "model") > 1 {
					common.SysLog("[VYRO-DEBUG] WARNING: multiple 'model' parts detected in body!")
				}
			} else {
				common.SysLog("[VYRO-DEBUG] failed to reparse built body for debug: " + err.Error())
			}

			common.SysLog("[VYRO-DEBUG] multipart body built successfully, model field written. Returning to DoRequest.")
			return &buf, nil
		}
		// if parse failed, fallthrough to URL path
	}

	// Fallback: treat as URL-based (drama or other clients passed reference_image_urls or images as urls)
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		storage, _ := common.GetBodyStorage(c)
		if storage != nil {
			if b, _ := storage.Bytes(); len(b) > 0 {
				// last resort raw passthrough (will likely fail upstream but prevents total crash)
				return bytes.NewReader(b), nil
			}
		}
		return nil, err
	}

	prompt := strings.TrimSpace(req.Prompt)
	imageURLs := collectReferenceImageURLs(c, &req)

	aspectRatio := getStringField(c, "aspect_ratio", "aspectRatio", "ratio")
	duration := getIntField(c, "duration", "seconds")
	resolution := getStringField(c, "resolution", "res")
	generateAudio := getBoolField(c, "generate_audio", "generateAudio", "audio")

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	_ = writer.WriteField("model", modelName)
	if prompt != "" {
		_ = writer.WriteField("prompt", prompt)
	}
	if aspectRatio != "" {
		_ = writer.WriteField("aspect_ratio", aspectRatio)
	}
	if duration > 0 {
		_ = writer.WriteField("duration", fmt.Sprintf("%d", duration))
	}
	if resolution != "" {
		_ = writer.WriteField("resolution", resolution)
	}

	mode := "text_to_video"
	if len(imageURLs) > 0 {
		mode = "reference_to_video"
	}
	_ = writer.WriteField("mode", mode)

	if generateAudio != "" {
		_ = writer.WriteField("generate_audio", generateAudio)
	}

	forwardExtraFields(c, writer)

	proxy := getProxyForDownload(c)
	for i, u := range imageURLs {
		u = strings.TrimSpace(u)
		if u == "" {
			continue
		}
		bufData, mimeType, filename, dlErr := downloadImageAsBufferWithProxy(u, proxy)
		if dlErr != nil {
			continue
		}
		if filename == "" {
			filename = fmt.Sprintf("ref_%d.%s", i, guessExt(mimeType))
		}
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="reference_images"; filename="%s"`, filename))
		h.Set("Content-Type", mimeType)
		part, err := writer.CreatePart(h)
		if err != nil {
			continue
		}
		_, _ = part.Write(bufData)
	}

	if err := writer.Close(); err != nil {
		return nil, err
	}

	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return &buf, nil
}

func collectReferenceImageURLs(c *gin.Context, req *relaycommon.TaskSubmitReq) []string {
	out := make([]string, 0, len(req.Images)+4)

	// from normalized TaskSubmitReq
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

	// from raw body (drama client uses reference_image_urls)
	if storage, err := common.GetBodyStorage(c); err == nil {
		if raw, err := storage.Bytes(); err == nil {
			// common keys used by drama and others
			for _, key := range []string{"reference_image_urls", "reference_images", "referenceImageUrls", "refs", "images"} {
				arr := gjson.GetBytes(raw, key)
				if arr.IsArray() {
					for _, it := range arr.Array() {
						if it.Type == gjson.String {
							if s := strings.TrimSpace(it.String()); s != "" {
								out = append(out, s)
							}
						}
					}
				}
			}
			// single reference_image_url
			if s := gjson.GetBytes(raw, "reference_image_url").String(); strings.TrimSpace(s) != "" {
				out = append(out, strings.TrimSpace(s))
			}
		}
	}

	// dedupe
	return dedupeStrings(out)
}

func dedupeStrings(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}

func forwardExtraFields(c *gin.Context, writer *multipart.Writer) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return
	}
	raw, err := storage.Bytes()
	if err != nil {
		return
	}
	// forward some known optional fields if present and not already written
	for _, key := range []string{"seed", "watermark", "callback_url", "negative_prompt"} {
		if v := gjson.GetBytes(raw, key); v.Exists() {
			switch v.Type {
			case gjson.String:
				_ = writer.WriteField(key, v.String())
			case gjson.Number:
				_ = writer.WriteField(key, v.Raw)
			case gjson.True, gjson.False:
				if v.Bool() {
					_ = writer.WriteField(key, "1")
				} else {
					_ = writer.WriteField(key, "0")
				}
			}
		}
	}
}

func getStringField(c *gin.Context, keys ...string) string {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return ""
	}
	raw, err := storage.Bytes()
	if err != nil {
		return ""
	}
	for _, k := range keys {
		if v := gjson.GetBytes(raw, k).String(); strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func getIntField(c *gin.Context, keys ...string) int {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return 0
	}
	raw, err := storage.Bytes()
	if err != nil {
		return 0
	}
	for _, k := range keys {
		if v := gjson.GetBytes(raw, k); v.Exists() {
			if i := v.Int(); i > 0 {
				return int(i)
			}
		}
	}
	return 0
}

func getBoolField(c *gin.Context, keys ...string) string {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return ""
	}
	raw, err := storage.Bytes()
	if err != nil {
		return ""
	}
	for _, k := range keys {
		if v := gjson.GetBytes(raw, k); v.Exists() {
			if v.Bool() {
				return "1"
			}
			return "0"
		}
	}
	return ""
}

// downloadImageAsBuffer downloads a public (or proxied) image URL to bytes + mime + filename.
func downloadImageAsBuffer(rawURL string) ([]byte, string, string, error) {
	return downloadImageAsBufferWithProxy(rawURL, "")
}

func downloadImageAsBufferWithProxy(rawURL, proxy string) ([]byte, string, string, error) {
	u := strings.TrimSpace(rawURL)
	if u == "" {
		return nil, "", "", fmt.Errorf("empty url")
	}

	// support data: urls (rare here)
	if strings.HasPrefix(u, "data:") {
		if idx := strings.Index(u, ","); idx > 0 {
			meta := u[:idx]
			data := u[idx+1:]
			mime := "image/png"
			if strings.Contains(meta, "image/") {
				parts := strings.Split(meta, ";")
				if len(parts) > 0 && strings.Contains(parts[0], "image/") {
					mime = strings.TrimPrefix(parts[0], "data:")
				}
			}
			var b []byte
			var err error
			if strings.Contains(meta, "base64") {
				b, err = base64.StdEncoding.DecodeString(data)
			} else {
				b, err = io.ReadAll(strings.NewReader(data)) // unlikely
			}
			if err == nil && len(b) > 0 {
				return b, mime, "ref.png", nil
			}
		}
	}

	parsed, err := url.Parse(u)
	if err != nil {
		return nil, "", "", err
	}
	filename := filepath.Base(parsed.Path)
	if filename == "" || filename == "." || filename == "/" {
		filename = "reference.png"
	}

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil || client == nil {
		client = &http.Client{Timeout: 60 * time.Second}
	}
	resp, err := client.Get(u)
	if err != nil {
		return nil, "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", "", fmt.Errorf("download status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", "", err
	}

	mime := resp.Header.Get("Content-Type")
	if mime == "" {
		mime = http.DetectContentType(data)
	}
	return data, mime, filename, nil
}

func guessExt(mime string) string {
	mime = strings.ToLower(mime)
	switch {
	case strings.Contains(mime, "jpeg"), strings.Contains(mime, "jpg"):
		return "jpg"
	case strings.Contains(mime, "png"):
		return "png"
	case strings.Contains(mime, "webp"):
		return "webp"
	case strings.Contains(mime, "gif"):
		return "gif"
	default:
		return "png"
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

	var dResp responseTask
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	upstreamID := dResp.ID
	if upstreamID == "" {
		upstreamID = dResp.TaskID
	}
	if upstreamID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	dResp.ID = info.PublicTaskID
	dResp.TaskID = info.PublicTaskID
	c.JSON(http.StatusOK, dResp)
	return upstreamID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	base := apiOrigin(baseUrl)
	uri := fmt.Sprintf("%s/videos/%s", base, taskID)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Accept", "application/json")

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
	raw := string(respBody)
	var resTask responseTask
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{Code: 0}
	status := strings.ToLower(strings.TrimSpace(resTask.Status))

	switch status {
	case "queued", "pending", "submitted", "processing", "in_progress", "running":
		if status == "queued" || status == "pending" || status == "submitted" {
			taskResult.Status = model.TaskStatusQueued
		} else {
			taskResult.Status = model.TaskStatusInProgress
		}
	case "completed", "success", "succeeded":
		taskResult.Status = model.TaskStatusSuccess
		if u := extractVideoURL(raw, &resTask); u != "" {
			taskResult.Url = u
		}
	case "failed", "failure", "error", "cancelled", "canceled":
		taskResult.Status = model.TaskStatusFailure
		if resTask.Error != nil && resTask.Error.Message != "" {
			taskResult.Reason = resTask.Error.Message
		} else {
			// try to find reason in raw
			if r := gjson.Get(raw, "error.message").String(); r != "" {
				taskResult.Reason = r
			} else if r := gjson.Get(raw, "fail_reason").String(); r != "" {
				taskResult.Reason = r
			}
		}
	default:
		taskResult.Status = model.TaskStatusInProgress
	}

	return &taskResult, nil
}

func extractVideoURL(raw string, res *responseTask) string {
	if res == nil {
		return ""
	}
	candidates := []string{
		res.URL,
		res.VideoURL,
	}
	if res.Metadata != nil && res.Metadata.URL != "" {
		candidates = append(candidates, res.Metadata.URL)
	}
	// also search in raw json common keys
	for _, k := range []string{"url", "video_url", "result.url", "data.url", "output.url", "video.url"} {
		if v := gjson.Get(raw, k).String(); strings.TrimSpace(v) != "" {
			candidates = append(candidates, v)
		}
	}
	for _, c := range candidates {
		if u := strings.TrimSpace(c); u != "" {
			return u
		}
	}
	return ""
}

// Adjust* billing hooks - use defaults (nil/0) for now
func (a *TaskAdaptor) AdjustBillingOnSubmit(info *relaycommon.RelayInfo, taskData []byte) map[string]float64 {
	return nil
}

func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	return 0
}

// ConvertToOpenAIVideo makes vyroseedance tasks queryable via the OpenAI-compatible /v1/videos/{id} path.
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

// getProxyForDownload tries to obtain a proxy string from the current request context / selected channel.
func getProxyForDownload(c *gin.Context) string {
	if c == nil {
		return ""
	}
	// common places new-api stores selected channel
	if chIface, ok := c.Get("channel"); ok && chIface != nil {
		if ch, ok := chIface.(*model.Channel); ok && ch != nil {
			setting := ch.GetSetting()
			return setting.Proxy
		}
	}
	if chIface, ok := c.Get("origin_channel"); ok && chIface != nil {
		if ch, ok := chIface.(*model.Channel); ok && ch != nil {
			setting := ch.GetSetting()
			return setting.Proxy
		}
	}
	// fallback to explicit proxy key if some middleware sets it
	if p := c.GetString("proxy"); p != "" {
		return p
	}
	return ""
}

// debugListMultipartParts is a helper for debugging: it re-reads a multipart body
// and returns a summary of all part names (field names + filenames for files).
// It does not consume the original body for the real request (we use a copy in the debug call).
func debugListMultipartParts(buf *bytes.Buffer, contentType string) (string, error) {
	// We need the boundary from the content type we set
	boundary, err := parseBoundaryFromCT(contentType)
	if err != nil {
		return "", err
	}

	// Make a copy so we don't disturb the original buf position if needed
	data := append([]byte(nil), buf.Bytes()...)
	reader := multipart.NewReader(bytes.NewReader(data), boundary)

	var parts []string
	for {
		p, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}
		name := p.FormName()
		filename := p.FileName()
		if filename != "" {
			parts = append(parts, fmt.Sprintf("%s(filename=%s)", name, filename))
		} else {
			parts = append(parts, name)
		}
		p.Close()
	}
	return strings.Join(parts, ", "), nil
}

func parseBoundaryFromCT(ct string) (string, error) {
	_, params, err := mime.ParseMediaType(ct)
	if err != nil {
		return "", err
	}
	b, ok := params["boundary"]
	if !ok || b == "" {
		return "", fmt.Errorf("no boundary")
	}
	return b, nil
}
