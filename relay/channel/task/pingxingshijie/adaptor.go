package pingxingshijie

import (
	"bytes"
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
	"github.com/samber/lo"
)

// ============================
// Request / Response structures (video — Ark-compatible body forwarded to /v2/video/generations)
// ============================

// DraftTaskRef is the nested object for content items with type "draft_task" (Seedance draft-to-video).
type DraftTaskRef struct {
	ID string `json:"id"`
}

type ContentItem struct {
	Type      string        `json:"type,omitempty"`
	Text      string        `json:"text,omitempty"`
	ImageURL  *MediaURL     `json:"image_url,omitempty"`
	VideoURL  *MediaURL     `json:"video_url,omitempty"`
	AudioURL  *MediaURL     `json:"audio_url,omitempty"`
	Role      string        `json:"role,omitempty"`
	DraftTask *DraftTaskRef `json:"draft_task,omitempty"`
}

type MediaURL struct {
	URL string `json:"url,omitempty"`
}

type requestPayload struct {
	Model                 string         `json:"model"`
	Content               []ContentItem  `json:"content,omitempty"`
	CallbackURL           string         `json:"callback_url,omitempty"`
	ReturnLastFrame       *dto.BoolValue `json:"return_last_frame,omitempty"`
	ServiceTier           string         `json:"service_tier,omitempty"`
	ExecutionExpiresAfter *dto.IntValue  `json:"execution_expires_after,omitempty"`
	GenerateAudio         *dto.BoolValue `json:"generate_audio,omitempty"`
	Draft                 *dto.BoolValue `json:"draft,omitempty"`
	Tools                 []struct {
		Type string `json:"type,omitempty"`
	} `json:"tools,omitempty"`
	Resolution  string         `json:"resolution,omitempty"`
	Ratio       string         `json:"ratio,omitempty"`
	Duration    *dto.IntValue  `json:"duration,omitempty"`
	Frames      *dto.IntValue  `json:"frames,omitempty"`
	Seed        *dto.IntValue  `json:"seed,omitempty"`
	CameraFixed *dto.BoolValue `json:"camera_fixed,omitempty"`
	Watermark   *dto.BoolValue `json:"watermark,omitempty"`
}

type responsePayload struct {
	ID string `json:"id"`
}

type responseTask struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Status  string `json:"status"`
	Content struct {
		VideoURL string `json:"video_url"`
	} `json:"content"`
	Seed            int    `json:"seed"`
	Resolution      string `json:"resolution"`
	Duration        int    `json:"duration"`
	Ratio           string `json:"ratio"`
	FramesPerSecond int    `json:"framespersecond"`
	ServiceTier     string `json:"service_tier"`
	Tools           []struct {
		Type string `json:"type"`
	} `json:"tools"`
	Usage struct {
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
		ToolUsage        struct {
			WebSearch int `json:"web_search"`
		} `json:"tool_usage"`
	} `json:"usage"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
	CreatedAt int64 `json:"created_at"`
	UpdatedAt int64 `json:"updated_at"`
}

// imageResponseTask mirrors upstream image task polling (fields may vary; use loose parsing where needed).
// Seedream-style responses use status "done" and put URLs in data[].url instead of content.image_url.
type imageResponseTask struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Status  string `json:"status"`
	Content struct {
		ImageURL string `json:"image_url"`
	} `json:"content"`
	// Data holds generated image entries (PingXingShiJie / Volc Seedream shape).
	Data []struct {
		Size string `json:"size"`
		URL  string `json:"url"`
	} `json:"data"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (img *imageResponseTask) resultImageURL() string {
	if img == nil {
		return ""
	}
	if img.Content.ImageURL != "" {
		return img.Content.ImageURL
	}
	for _, d := range img.Data {
		if strings.TrimSpace(d.URL) != "" {
			return d.URL
		}
	}
	return ""
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

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = strings.TrimRight(info.ChannelBaseUrl, "/")
	a.apiKey = info.ApiKey
}

func requestPathFromRelay(info *relaycommon.RelayInfo) string {
	if info == nil || info.RequestURLPath == "" {
		return ""
	}
	u, err := url.Parse(info.RequestURLPath)
	if err != nil || u.Path == "" {
		return info.RequestURLPath
	}
	return u.Path
}

// ValidateRequestAndSetAction parses body, validates fields and sets default action.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	path := requestPathFromRelay(info)
	if path == "" {
		path = c.Request.URL.Path
	}
	switch UpstreamKindFromPath(path) {
	case UpstreamKindAsset:
		var req relaycommon.TaskSubmitReq
		if err := common.UnmarshalBodyReusable(c, &req); err != nil {
			return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
		}
		if err := ValidateAssetUploadModel(req.Model); err != nil {
			return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
		}
		if strings.TrimSpace(req.Prompt) == "" {
			req.Prompt = "asset-upload"
		}
		info.Action = constant.TaskActionAssetUpload
		c.Set("task_request", req)
		return nil
	case UpstreamKindImage:
		return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
	default:
		return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
	}
}

// BuildRequestURL constructs the upstream URL.
func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	path := requestPathFromRelay(info)
	switch UpstreamKindFromPath(path) {
	case UpstreamKindAsset:
		return fmt.Sprintf("%s/v2/asset/upload", a.baseURL), nil
	case UpstreamKindImage:
		return fmt.Sprintf("%s/v2/image/generations", a.baseURL), nil
	default:
		return fmt.Sprintf("%s/v2/video/generations", a.baseURL), nil
	}
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

// EstimateBilling detects Seedance 2.0 resolution pricing and video-input discounts.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	path := requestPathFromRelay(info)
	if UpstreamKindFromPath(path) != UpstreamKindVideo {
		return nil
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	ratioMap := make(map[string]float64)
	resolution := requestResolution(req)
	if ratio, ok := GetResolutionRatio(info.OriginModelName, resolution); ok {
		ratioMap["resolution"] = ratio
	}
	if hasVideoInMetadata(req.Metadata) {
		if ratio, ok := GetVideoInputRatioForResolution(info.OriginModelName, resolution); ok {
			ratioMap["video_input"] = ratio
		}
	}
	if len(ratioMap) == 0 {
		return nil
	}
	return ratioMap
}

func requestResolution(req relaycommon.TaskSubmitReq) string {
	if req.Resolution != "" {
		return strings.ToLower(strings.TrimSpace(req.Resolution))
	}
	if req.Metadata == nil {
		return ""
	}
	resolution, ok := req.Metadata["resolution"].(string)
	if !ok {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(resolution))
}

func hasVideoInMetadata(metadata map[string]interface{}) bool {
	if metadata == nil {
		return false
	}
	contentRaw, ok := metadata["content"]
	if !ok {
		return false
	}
	contentSlice, ok := contentRaw.([]interface{})
	if !ok {
		return false
	}
	for _, item := range contentSlice {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if itemMap["type"] == "video_url" {
			return true
		}
		if _, has := itemMap["video_url"]; has {
			return true
		}
	}
	return false
}

// BuildRequestBody converts request into upstream JSON.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	path := requestPathFromRelay(info)
	kind := UpstreamKindFromPath(path)
	if kind == UpstreamKindAsset || kind == UpstreamKindImage {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return nil, err
		}
		raw, err := storage.Bytes()
		if err != nil {
			return nil, err
		}
		if kind == UpstreamKindAsset {
			var m map[string]any
			if err := common.Unmarshal(raw, &m); err != nil {
				return nil, errors.Wrap(err, "unmarshal asset request")
			}
			delete(m, "model")
			raw, err = common.Marshal(m)
			if err != nil {
				return nil, err
			}
		}
		if kind == UpstreamKindImage {
			var m map[string]any
			if err := common.Unmarshal(raw, &m); err != nil {
				return nil, errors.Wrap(err, "unmarshal image request")
			}
			m["model"] = info.UpstreamModelName
			raw, err = common.Marshal(m)
			if err != nil {
				return nil, err
			}
		}
		return bytes.NewReader(raw), nil
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	body, err := a.convertToRequestPayload(&req)
	if err != nil {
		return nil, errors.Wrap(err, "convert request payload failed")
	}
	if info.IsModelMapped {
		body.Model = info.UpstreamModelName
	} else {
		info.UpstreamModelName = body.Model
	}
	// Draft upscale (draft_task only): upstream shape omits generate_audio; sending default true can break create responses.
	if body.GenerateAudio == nil && !contentHasDraftTask(body.Content) {
		body.GenerateAudio = lo.ToPtr(dto.BoolValue(true))
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
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

	path := requestPathFromRelay(info)
	kind := UpstreamKindFromPath(path)

	inner, err := UnmarshalEnvelope(responseBody)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "invalid_response", http.StatusBadRequest)
		return
	}

	switch kind {
	case UpstreamKindImage:
		id := extractImageCreateTaskID(inner)
		if id == "" {
			taskErr = service.TaskErrorWrapper(fmt.Errorf("image task id is empty"), "invalid_response", http.StatusInternalServerError)
			return
		}
		taskData = append([]byte(nil), responseBody...)
		ov := dto.NewOpenAIVideo()
		ov.ID = info.PublicTaskID
		ov.TaskID = info.PublicTaskID
		ov.CreatedAt = time.Now().Unix()
		ov.Model = info.OriginModelName
		if ux := jsonAnyFromBytes(responseBody); ux != nil {
			ov.SetMetadata("upstream", ux)
		}
		c.JSON(http.StatusOK, ov)
		return id, taskData, nil

	case UpstreamKindAsset:
		id := extractAssetCreateID(inner)
		if id == "" {
			taskErr = service.TaskErrorWrapper(fmt.Errorf("asset id is empty"), "invalid_response", http.StatusInternalServerError)
			return
		}
		taskData = append([]byte(nil), responseBody...)
		resp := gin.H{
			"id":       info.PublicTaskID,
			"task_id":  info.PublicTaskID,
			"asset_id": id,
			"object":   "pingxingshijie.asset.upload",
		}
		if ux := jsonAnyFromBytes(responseBody); ux != nil {
			resp["upstream"] = ux
		}
		c.JSON(http.StatusOK, resp)
		return id, taskData, nil

	default:
		var dResp responsePayload
		if err := common.Unmarshal(inner, &dResp); err != nil {
			taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", string(inner)), "unmarshal_response_body_failed", http.StatusInternalServerError)
			return
		}
		upstreamID := strings.TrimSpace(dResp.ID)
		if upstreamID == "" {
			upstreamID = extractVideoCreateTaskID(inner)
		}
		if upstreamID == "" {
			upstreamID = extractVideoCreateTaskID(responseBody)
		}
		if upstreamID == "" {
			taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
			return
		}
		ov := dto.NewOpenAIVideo()
		ov.ID = info.PublicTaskID
		ov.TaskID = info.PublicTaskID
		ov.CreatedAt = time.Now().Unix()
		ov.Model = info.OriginModelName
		if ux := jsonAnyFromBytes(responseBody); ux != nil {
			ov.SetMetadata("upstream", ux)
		}
		c.JSON(http.StatusOK, ov)
		return upstreamID, append([]byte(nil), responseBody...), nil
	}
}

// extractVideoCreateTaskID resolves upstream task id from POST /v2/video/generations inner JSON,
// full envelope JSON, or variants where id is nested (Volc/Ark-style) or data is a string id.
func extractVideoCreateTaskID(inner []byte) string {
	inner = bytes.TrimSpace(inner)
	if len(inner) == 0 {
		return ""
	}
	// Inner "data" may be a JSON string task id
	if inner[0] == '"' {
		var s string
		if common.Unmarshal(inner, &s) == nil {
			if tid := strings.TrimSpace(s); isPlausibleUpstreamTaskID(tid) {
				return tid
			}
		}
		return ""
	}
	var raw any
	if common.Unmarshal(inner, &raw) != nil {
		return ""
	}
	if id := deepFindVideoTaskID(raw, 0); id != "" {
		return id
	}
	return ""
}

const maxVideoTaskIDDepth = 22

// isPlausibleUpstreamTaskID avoids treating human messages (e.g. msg text) as ids when walking JSON.
func isPlausibleUpstreamTaskID(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) < 8 {
		return false
	}
	if strings.HasPrefix(s, "cgt-") {
		return true
	}
	// Image-style ids from same platform
	if strings.HasPrefix(s, "I") && strings.Contains(s, "-") && len(s) >= 12 {
		return true
	}
	// Hyphenated opaque ids (avoid short tokens like "ok")
	if strings.Count(s, "-") >= 2 && len(s) >= 12 {
		return true
	}
	return false
}

// deepFindVideoTaskID walks nested maps/arrays to find a task id string.
func deepFindVideoTaskID(v any, depth int) string {
	if depth > maxVideoTaskIDDepth || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		s := strings.TrimSpace(t)
		if isPlausibleUpstreamTaskID(s) {
			return s
		}
		return ""
	case map[string]any:
		priority := []string{"id", "task_id", "taskId", "TaskId", "TaskID", "generation_id", "GenerationId"}
		for _, k := range priority {
			if s, ok := t[k].(string); ok {
				if tid := strings.TrimSpace(s); tid != "" {
					return tid
				}
			}
		}
		// Envelope or gateway: data may be the id string
		if ds, ok := t["data"].(string); ok {
			if tid := strings.TrimSpace(ds); isPlausibleUpstreamTaskID(tid) {
				return tid
			}
		}
		for _, k := range []string{"Result", "result", "data", "task", "Task", "output", "response", "Response"} {
			if sub, ok := t[k]; ok {
				if id := deepFindVideoTaskID(sub, depth+1); id != "" {
					return id
				}
			}
		}
		for _, sub := range t {
			if id := deepFindVideoTaskID(sub, depth+1); id != "" {
				return id
			}
		}
	case []any:
		for _, el := range t {
			if id := deepFindVideoTaskID(el, depth+1); id != "" {
				return id
			}
		}
	}
	return ""
}

func extractImageCreateTaskID(inner []byte) string {
	var m map[string]any
	if common.Unmarshal(inner, &m) != nil {
		return ""
	}
	if d, ok := m["data"].(map[string]any); ok {
		if d2, ok := d["data"].(map[string]any); ok {
			if id, ok := d2["id"].(string); ok {
				return id
			}
		}
		if id, ok := d["id"].(string); ok {
			return id
		}
	}
	if id, ok := m["id"].(string); ok {
		return id
	}
	return ""
}

func extractAssetCreateID(inner []byte) string {
	var m map[string]any
	if common.Unmarshal(inner, &m) != nil {
		return ""
	}
	for _, k := range []string{"asset_id", "id", "AssetId", "ID"} {
		if v, ok := m[k].(string); ok && v != "" {
			return v
		}
	}
	if d, ok := m["data"].(map[string]any); ok {
		for _, k := range []string{"asset_id", "id"} {
			if v, ok := d[k].(string); ok && v != "" {
				return v
			}
		}
	}
	for _, resultKey := range []string{"Result", "result"} {
		if res, ok := m[resultKey].(map[string]any); ok {
			for _, k := range []string{"Id", "id", "asset_id", "AssetId", "ID"} {
				if v, ok := res[k].(string); ok && v != "" {
					return v
				}
			}
		}
	}
	return ""
}

// FetchTask fetches task status (GET for video/image, POST JSON for asset).
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	kind, _ := body["upstream_kind"].(string)
	if kind == "" {
		kind = UpstreamKindVideo
	}
	baseUrl = strings.TrimRight(baseUrl, "/")

	var req *http.Request
	var err error
	switch kind {
	case UpstreamKindAsset:
		payload := map[string]any{"asset_id": taskID}
		raw, mErr := common.Marshal(payload)
		if mErr != nil {
			return nil, mErr
		}
		req, err = http.NewRequest(http.MethodPost, baseUrl+"/v2/asset/status", bytes.NewReader(raw))
	default:
		var uri string
		if kind == UpstreamKindImage {
			uri = fmt.Sprintf("%s/v2/image/generations/tasks/%s", baseUrl, url.PathEscape(taskID))
		} else {
			uri = fmt.Sprintf("%s/v2/video/generations/tasks/%s", baseUrl, url.PathEscape(taskID))
		}
		req, err = http.NewRequest(http.MethodGet, uri, nil)
	}
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

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq) (*requestPayload, error) {
	r := requestPayload{
		Model:   req.Model,
		Content: []ContentItem{},
	}

	if req.HasImage() {
		for _, imgURL := range req.Images {
			r.Content = append(r.Content, ContentItem{
				Type: "image_url",
				ImageURL: &MediaURL{
					URL: imgURL,
				},
			})
		}
	}

	metadata := req.Metadata
	if err := taskcommon.UnmarshalMetadata(metadata, &r); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	if r.Resolution == "" {
		r.Resolution = req.Resolution
	}

	// Draft ID upscale (draft_task): upstream body is content + resolution (+ optional flags like watermark).
	// No top-level seconds -> duration merge here. If client ever sets metadata "draft" (bool), clear it —
	// draft_task reference is unrelated to that field; typical clients omit metadata.draft entirely.
	if contentHasDraftTask(r.Content) {
		r.Content = lo.Reject(r.Content, func(c ContentItem, _ int) bool { return c.Type == "text" })
		r.Resolution = normalizeSeedance15DraftUpscaleResolution(r.Model, r.Resolution)
		r.Draft = nil
		return &r, nil
	}

	if sec, _ := strconv.Atoi(req.Seconds); sec > 0 {
		r.Duration = lo.ToPtr(dto.IntValue(sec))
	} else if req.Duration > 0 && r.Duration == nil {
		r.Duration = lo.ToPtr(dto.IntValue(req.Duration))
	}

	if !contentHasText(r.Content) {
		r.Content = append(r.Content, ContentItem{
			Type: "text",
			Text: req.Prompt,
		})
	}

	return &r, nil
}

func contentHasDraftTask(items []ContentItem) bool {
	for _, c := range items {
		if c.Type == "draft_task" {
			return true
		}
	}
	return false
}

func contentHasText(items []ContentItem) bool {
	for _, c := range items {
		if c.Type == "text" {
			return true
		}
	}
	return false
}

// normalizeSeedance15DraftUpscaleResolution maps draft-ID upscale to allowed outputs only (720p / 1080p).
// Downstream may send 480p from the draft preview tier; upstream rejects or returns empty id without this.
func normalizeSeedance15DraftUpscaleResolution(model, resolution string) string {
	if !strings.Contains(strings.ToLower(model), "seedance-1-5-pro") {
		return resolution
	}
	low := strings.ToLower(strings.TrimSpace(resolution))
	switch low {
	case "1080p":
		return "1080p"
	case "720p":
		return "720p"
	default:
		// 480p and any other value -> 720p (minimum supported upscale target per upstream rules)
		return "720p"
	}
}

// unwrapInnerForTaskData returns the inner JSON from a PingXingShiJie envelope, or the original
// body if not wrapped. If the envelope has code==0 but an empty/missing "data" field, returns raw
// so callers never pass an empty slice to json.Unmarshal (which yields "unexpected end of JSON input").
func unwrapInnerForTaskData(raw []byte) ([]byte, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, fmt.Errorf("empty task data")
	}
	inner, err := UnmarshalEnvelope(raw)
	if err != nil {
		return raw, nil
	}
	if len(bytes.TrimSpace(inner)) == 0 {
		return raw, nil
	}
	return inner, nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	inner, err := unwrapInnerForTaskData(respBody)
	if err != nil {
		return nil, err
	}

	// Asset status: Result.Status
	if ti, ok := parseAssetStatus(inner); ok {
		return ti, nil
	}

	// Video-style
	var vid responseTask
	if common.Unmarshal(inner, &vid) == nil && (vid.Content.VideoURL != "" || vid.Status != "" || vid.ID != "") {
		return mapVideoTaskResult(&vid)
	}

	// Image-style
	var img imageResponseTask
	if common.Unmarshal(inner, &img) == nil && (img.resultImageURL() != "" || img.Status != "" || img.ID != "") {
		return mapImageTaskResult(&img)
	}

	// Fallback: try video struct without strict match
	var v2 responseTask
	if err := common.Unmarshal(inner, &v2); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}
	return mapVideoTaskResult(&v2)
}

func parseAssetStatus(inner []byte) (*relaycommon.TaskInfo, bool) {
	var m map[string]any
	if common.Unmarshal(inner, &m) != nil {
		return nil, false
	}
	var res map[string]any
	if r, ok := m["Result"].(map[string]any); ok {
		res = r
	} else if r, ok := m["result"].(map[string]any); ok {
		res = r
	}
	if res == nil {
		return nil, false
	}
	status := ""
	if s, ok := res["Status"].(string); ok {
		status = s
	} else if s, ok := res["status"].(string); ok {
		status = s
	}
	st := strings.ToLower(strings.TrimSpace(status))
	tr := &relaycommon.TaskInfo{Code: 0}
	switch st {
	case "processing", "pending", "queued", "running":
		tr.Status = model.TaskStatusInProgress
		tr.Progress = "50%"
	case "active", "succeeded", "success", "completed":
		tr.Status = model.TaskStatusSuccess
		tr.Progress = "100%"
		if u := extractStringFromMap(m, "url", "asset_url", "AssetUrl"); u != "" {
			tr.Url = u
		}
	case "failed", "failure":
		tr.Status = model.TaskStatusFailure
		tr.Progress = "100%"
		tr.Reason = extractStringFromMap(res, "Message", "message", "reason")
	default:
		if st == "" {
			return nil, false
		}
		tr.Status = model.TaskStatusInProgress
		tr.Progress = "30%"
	}
	return tr, true
}

func extractStringFromMap(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k].(string); ok && v != "" {
			return v
		}
	}
	return ""
}

func mapVideoTaskResult(resTask *responseTask) (*relaycommon.TaskInfo, error) {
	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}
	switch strings.ToLower(resTask.Status) {
	case "pending", "queued":
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = "10%"
	case "processing", "running":
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "50%"
	case "succeeded", "success", "completed", "done":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = resTask.Content.VideoURL
		taskResult.CompletionTokens = resTask.Usage.CompletionTokens
		taskResult.TotalTokens = resTask.Usage.TotalTokens
	case "failed", "failure":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = resTask.Error.Message
	default:
		if resTask.Status == "" {
			taskResult.Status = model.TaskStatusInProgress
			taskResult.Progress = "30%"
		} else {
			taskResult.Status = model.TaskStatusInProgress
			taskResult.Progress = "30%"
		}
	}
	return &taskResult, nil
}

func mapImageTaskResult(resTask *imageResponseTask) (*relaycommon.TaskInfo, error) {
	taskResult := relaycommon.TaskInfo{Code: 0}
	switch strings.ToLower(resTask.Status) {
	case "pending", "queued":
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = "10%"
	case "processing", "running":
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "50%"
	case "succeeded", "success", "completed", "done":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = resTask.resultImageURL()
	case "failed", "failure":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = resTask.Error.Message
	default:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
	}
	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var dResp responseTask
	if len(bytes.TrimSpace(originTask.Data)) > 0 {
		inner, err := unwrapInnerForTaskData(originTask.Data)
		if err != nil {
			return nil, err
		}
		if err := common.Unmarshal(inner, &dResp); err != nil {
			return nil, errors.Wrap(err, "unmarshal pingxingshijie task data failed")
		}
	}

	videoURL := strings.TrimSpace(dResp.Content.VideoURL)
	if videoURL == "" {
		videoURL = strings.TrimSpace(originTask.GetResultURL())
	}

	openAIVideo := dto.NewOpenAIVideo()
	openAIVideo.ID = originTask.TaskID
	openAIVideo.TaskID = originTask.TaskID
	openAIVideo.Status = originTask.Status.ToVideoStatus()
	openAIVideo.SetProgressStr(originTask.Progress)
	openAIVideo.SetMetadata("url", videoURL)
	openAIVideo.CreatedAt = originTask.CreatedAt
	openAIVideo.CompletedAt = originTask.UpdatedAt
	openAIVideo.Model = originTask.Properties.OriginModelName
	if ux := jsonAnyFromBytes(originTask.Data); ux != nil {
		openAIVideo.SetMetadata("upstream", ux)
	}

	if strings.EqualFold(dResp.Status, "failed") || strings.EqualFold(dResp.Status, "failure") {
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: dResp.Error.Message,
			Code:    dResp.Error.Code,
		}
	}

	return common.Marshal(openAIVideo)
}

// ConvertToOpenAIAsyncImage implements channel.OpenAIAsyncImageConverter.
func (a *TaskAdaptor) ConvertToOpenAIAsyncImage(originTask *model.Task) ([]byte, error) {
	inner, err := unwrapInnerForTaskData(originTask.Data)
	if err != nil {
		return nil, err
	}
	out := map[string]any{
		"object":     "pingxingshijie.image.generation.task",
		"id":         originTask.TaskID,
		"task_id":    originTask.TaskID,
		"status":     originTask.Status.ToVideoStatus(),
		"progress":   originTask.Progress,
		"model":      originTask.Properties.OriginModelName,
		"created_at": originTask.CreatedAt,
		"updated_at": originTask.UpdatedAt,
	}
	if ux := jsonAnyFromBytes(originTask.Data); ux != nil {
		out["upstream"] = ux
	}

	var img imageResponseTask
	if err := common.Unmarshal(inner, &img); err != nil {
		if upstreamID := extractImageCreateTaskID(inner); upstreamID != "" {
			out["upstream_task_id"] = upstreamID
			return common.Marshal(out)
		}
		return nil, errors.Wrap(err, "unmarshal image task data failed")
	}
	if u := img.resultImageURL(); u != "" {
		out["url"] = u
	}
	if strings.EqualFold(img.Status, "failed") || strings.EqualFold(img.Status, "failure") {
		out["error"] = map[string]any{"message": img.Error.Message, "code": img.Error.Code}
	}
	return common.Marshal(out)
}

// ConvertToOpenAIAssetTask implements channel.OpenAIAssetTaskConverter.
func (a *TaskAdaptor) ConvertToOpenAIAssetTask(originTask *model.Task) ([]byte, error) {
	inner, err := unwrapInnerForTaskData(originTask.Data)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := common.Unmarshal(inner, &m); err != nil {
		return nil, err
	}
	out := map[string]any{
		"object":     "pingxingshijie.asset.task",
		"id":         originTask.TaskID,
		"task_id":    originTask.TaskID,
		"status":     string(originTask.Status),
		"progress":   originTask.Progress,
		"created_at": originTask.CreatedAt,
		"updated_at": originTask.UpdatedAt,
		"data":       m,
	}
	if ux := jsonAnyFromBytes(originTask.Data); ux != nil {
		out["upstream"] = ux
	}
	if originTask.FailReason != "" {
		out["fail_reason"] = originTask.FailReason
	}
	return common.Marshal(out)
}
