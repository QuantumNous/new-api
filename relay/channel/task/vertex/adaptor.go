package vertex

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	geminitask "github.com/QuantumNous/new-api/relay/channel/task/gemini"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	vertexcore "github.com/QuantumNous/new-api/relay/channel/vertex"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
)

// ============================
// Request / Response structures
// ============================

type fetchOperationPayload struct {
	OperationName string `json:"operationName"`
}

type submitResponse struct {
	Name string `json:"name"`
}

type operationVideo struct {
	MimeType           string `json:"mimeType"`
	BytesBase64Encoded string `json:"bytesBase64Encoded"`
	Encoding           string `json:"encoding"`
	// GcsUri：用户经 metadata.storageUri 注入（已被旁路剥离收口，存量任务仍可能存在）时，
	// 上游把结果直写用户 bucket、查询响应变为 gcsUri 形态——此时 base64 重取必然失败，
	// GCS 转存按失败处理、不得盲等（gcs-video-transfer-design.md 4.2）。
	GcsUri string `json:"gcsUri"`
}

type operationResponse struct {
	Name     string `json:"name"`
	Done     bool   `json:"done"`
	Response struct {
		Type                  string           `json:"@type"`
		RaiMediaFilteredCount int              `json:"raiMediaFilteredCount"`
		Videos                []operationVideo `json:"videos"`
		BytesBase64Encoded    string           `json:"bytesBase64Encoded"`
		Encoding              string           `json:"encoding"`
		Video                 string           `json:"video"`
		GcsUri                string           `json:"gcsUri"`
	} `json:"response"`
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
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
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

// ValidateRequestAndSetAction parses body, validates fields and sets default action.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	// Use the standard validation method for TaskSubmitReq
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionTextGenerate)
}

// BuildRequestURL constructs the upstream URL.
func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	adc := &vertexcore.Credentials{}
	if err := common.Unmarshal([]byte(a.apiKey), adc); err != nil {
		return "", fmt.Errorf("failed to decode credentials: %w", err)
	}
	modelName := info.UpstreamModelName
	if modelName == "" {
		modelName = "veo-3.0-generate-001"
	}

	region := vertexcore.GetModelRegion(info.ApiVersion, modelName)
	if strings.TrimSpace(region) == "" {
		region = "global"
	}
	return vertexcore.BuildGoogleModelURL(a.baseURL, vertexcore.DefaultAPIVersion, adc.ProjectID, region, modelName, "predictLongRunning"), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	adc := &vertexcore.Credentials{}
	if err := common.Unmarshal([]byte(a.apiKey), adc); err != nil {
		return fmt.Errorf("failed to decode credentials: %w", err)
	}

	proxy := ""
	if info != nil {
		proxy = info.ChannelSetting.Proxy
	}
	token, err := vertexcore.AcquireAccessToken(*adc, proxy)
	if err != nil {
		return fmt.Errorf("failed to acquire access token: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("x-goog-user-project", adc.ProjectID)
	return nil
}

// EstimateBilling returns OtherRatios based on durationSeconds and resolution.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	v, ok := c.Get("task_request")
	if !ok {
		return nil
	}
	req := v.(relaycommon.TaskSubmitReq)

	seconds := geminitask.ResolveVeoDuration(req.Metadata, req.Duration, req.Seconds)
	resolution := geminitask.ResolveVeoResolution(req.Metadata, req.Size)
	resRatio := geminitask.VeoResolutionRatio(info.UpstreamModelName, resolution)

	return map[string]float64{
		"seconds":    float64(seconds),
		"resolution": resRatio,
	}
}

// BuildRequestBody converts request into Vertex specific format.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	v, ok := c.Get("task_request")
	if !ok {
		return nil, fmt.Errorf("request not found in context")
	}
	req := v.(relaycommon.TaskSubmitReq)

	instance := geminitask.VeoInstance{Prompt: req.Prompt}
	if img := geminitask.ExtractMultipartImage(c, info); img != nil {
		instance.Image = img
	} else if len(req.Images) > 0 {
		if parsed := geminitask.ParseImageInput(req.Images[0]); parsed != nil {
			instance.Image = parsed
			info.Action = constant.TaskActionGenerate
		}
	}

	params := &geminitask.VeoParameters{}
	if err := taskcommon.UnmarshalMetadata(req.Metadata, params); err != nil {
		return nil, fmt.Errorf("unmarshal metadata failed: %w", err)
	}
	if params.DurationSeconds == 0 && req.Duration > 0 {
		params.DurationSeconds = req.Duration
	}
	if params.Resolution == "" && req.Size != "" {
		params.Resolution = geminitask.SizeToVeoResolution(req.Size)
	}
	if params.AspectRatio == "" && req.Size != "" {
		params.AspectRatio = geminitask.SizeToVeoAspectRatio(req.Size)
	}
	params.Resolution = strings.ToLower(params.Resolution)
	params.SampleCount = 1

	body := geminitask.VeoRequestPayload{
		Instances:  []geminitask.VeoInstance{instance},
		Parameters: params,
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
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var s submitResponse
	if err := common.Unmarshal(responseBody, &s); err != nil {
		return "", nil, service.TaskErrorWrapper(err, "unmarshal_response_failed", http.StatusInternalServerError)
	}
	if strings.TrimSpace(s.Name) == "" {
		return "", nil, service.TaskErrorWrapper(fmt.Errorf("missing operation name"), "invalid_response", http.StatusInternalServerError)
	}
	localID := taskcommon.EncodeLocalTaskID(s.Name)
	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)
	return localID, responseBody, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return []string{
		"veo-3.0-generate-001",
		"veo-3.0-fast-generate-001",
		"veo-3.1-generate-preview",
		"veo-3.1-fast-generate-preview",
	}
}
func (a *TaskAdaptor) GetChannelName() string { return "vertex" }

func buildFetchOperationURL(baseURL, upstreamName string) (string, error) {
	region := extractRegionFromOperationName(upstreamName)
	if region == "" {
		region = "us-central1"
	}
	project := extractProjectFromOperationName(upstreamName)
	modelName := extractModelFromOperationName(upstreamName)
	if strings.TrimSpace(modelName) == "" {
		return "", fmt.Errorf("cannot extract model from operation name")
	}
	if strings.TrimSpace(project) == "" {
		return "", fmt.Errorf("cannot extract project from operation name")
	}
	return vertexcore.BuildGoogleModelURL(baseURL, vertexcore.DefaultAPIVersion, project, region, modelName, "fetchPredictOperation"), nil
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}
	upstreamName, err := taskcommon.DecodeLocalTaskID(taskID)
	if err != nil {
		return nil, fmt.Errorf("decode task_id failed: %w", err)
	}
	url, err := buildFetchOperationURL(baseUrl, upstreamName)
	if err != nil {
		return nil, err
	}
	payload := fetchOperationPayload{OperationName: upstreamName}
	data, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	adc := &vertexcore.Credentials{}
	if err := common.Unmarshal([]byte(key), adc); err != nil {
		return nil, fmt.Errorf("failed to decode credentials: %w", err)
	}
	token, err := vertexcore.AcquireAccessToken(*adc, proxy)
	if err != nil {
		return nil, fmt.Errorf("failed to acquire access token: %w", err)
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("x-goog-user-project", adc.ProjectID)
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var op operationResponse
	if err := common.Unmarshal(respBody, &op); err != nil {
		return nil, fmt.Errorf("unmarshal operation response failed: %w", err)
	}
	ti := &relaycommon.TaskInfo{}
	if op.Error.Message != "" {
		ti.Status = model.TaskStatusFailure
		ti.Reason = op.Error.Message
		ti.Progress = "100%"
		return ti, nil
	}
	if !op.Done {
		ti.Status = model.TaskStatusInProgress
		ti.Progress = "50%"
		return ti, nil
	}
	ti.Status = model.TaskStatusSuccess
	ti.Progress = "100%"
	if len(op.Response.Videos) > 0 {
		v0 := op.Response.Videos[0]
		if v0.BytesBase64Encoded != "" {
			mime := strings.TrimSpace(v0.MimeType)
			if mime == "" {
				enc := strings.TrimSpace(v0.Encoding)
				if enc == "" {
					enc = "mp4"
				}
				if strings.Contains(enc, "/") {
					mime = enc
				} else {
					mime = "video/" + enc
				}
			}
			ti.Url = "data:" + mime + ";base64," + v0.BytesBase64Encoded
			return ti, nil
		}
	}
	if op.Response.BytesBase64Encoded != "" {
		enc := strings.TrimSpace(op.Response.Encoding)
		if enc == "" {
			enc = "mp4"
		}
		mime := enc
		if !strings.Contains(enc, "/") {
			mime = "video/" + enc
		}
		ti.Url = "data:" + mime + ";base64," + op.Response.BytesBase64Encoded
		return ti, nil
	}
	if op.Response.Video != "" { // some variants use `video` as base64
		enc := strings.TrimSpace(op.Response.Encoding)
		if enc == "" {
			enc = "mp4"
		}
		mime := enc
		if !strings.Contains(enc, "/") {
			mime = "video/" + enc
		}
		ti.Url = "data:" + mime + ";base64," + op.Response.Video
		return ti, nil
	}
	return ti, nil
}

// ExtractUpstreamAssets：Vertex 的 base64 视频仅存在于查询响应（task.Data 中已被 redact
// 删除）且不宜整段暂存进 PrivateData，因此资产 URL 留空、ext 按响应 mime 在暂存时定死，
// 转存时由 FetchResultContent 重新 fetchPredictOperation 解码（gcs-video-transfer-design.md 4.2）。
// gcsUri 形态（storageUri 注入未被剥离的存量任务）在此直接报错，不进入转存阶段。
func (a *TaskAdaptor) ExtractUpstreamAssets(_ *model.Task, _ *relaycommon.TaskInfo, rawRespBody []byte) ([]taskcommon.UpstreamAsset, error) {
	var op operationResponse
	if err := common.Unmarshal(rawRespBody, &op); err != nil {
		return nil, fmt.Errorf("unmarshal vertex operation response failed: %w", err)
	}
	if op.Error.Message != "" {
		return nil, fmt.Errorf("vertex operation carries error: %s", op.Error.Message)
	}
	if !op.Done {
		return nil, fmt.Errorf("vertex operation not done yet")
	}
	if gcsUri := vertexResultGcsUri(&op); gcsUri != "" {
		return nil, fmt.Errorf("vertex result was routed to user storageUri (%s), cannot transfer", gcsUri)
	}
	b64, mime := vertexResultBase64(&op)
	if b64 == "" {
		return nil, fmt.Errorf("vertex operation done but no base64 video content in response")
	}
	return []taskcommon.UpstreamAsset{{Index: 0, Ext: vertexMimeToExt(mime)}}, nil
}

// FetchResultContent 重新 fetchPredictOperation 取 bytesBase64Encoded 并解码
// （task.Data 中的 base64 已被 redact，不能依赖）。凭证按 PrivateData.Key 优先、
// ch.Key 兜底；请求经 ctx 强制超时（不复用 FetchTask——其内部请求不带 context）。
// 响应为 gcsUri 形态时按转存失败处理，不得盲等。
func (a *TaskAdaptor) FetchResultContent(ctx context.Context, task *model.Task, ch *model.Channel, _ taskcommon.UpstreamAsset) (io.ReadCloser, string, error) {
	if task == nil || ch == nil {
		return nil, "", fmt.Errorf("task or channel is nil")
	}
	key := taskcommon.ResolveTaskFetchKey(task, ch)
	if key == "" {
		return nil, "", fmt.Errorf("no credentials available for vertex operation fetch")
	}
	upstreamName, err := taskcommon.DecodeLocalTaskID(task.GetUpstreamTaskID())
	if err != nil {
		return nil, "", fmt.Errorf("decode task_id failed: %w", err)
	}

	baseURL := constant.ChannelBaseURLs[ch.Type]
	if ch.GetBaseURL() != "" {
		baseURL = ch.GetBaseURL()
	}
	fetchURL, err := buildFetchOperationURL(baseURL, upstreamName)
	if err != nil {
		return nil, "", err
	}
	payload, err := common.Marshal(fetchOperationPayload{OperationName: upstreamName})
	if err != nil {
		return nil, "", err
	}

	adc := &vertexcore.Credentials{}
	if err := common.Unmarshal([]byte(key), adc); err != nil {
		return nil, "", fmt.Errorf("failed to decode credentials: %w", err)
	}
	proxy := ch.GetSetting().Proxy
	token, err := vertexcore.AcquireAccessToken(*adc, proxy)
	if err != nil {
		return nil, "", fmt.Errorf("failed to acquire access token: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fetchURL, bytes.NewReader(payload))
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("x-goog-user-project", adc.ProjectID)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, "", fmt.Errorf("new proxy http client failed: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("fetch operation failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("read operation response failed: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("fetch operation returned status %d: %s", resp.StatusCode, truncateForError(respBody))
	}

	var op operationResponse
	if err := common.Unmarshal(respBody, &op); err != nil {
		return nil, "", fmt.Errorf("unmarshal operation response failed: %w", err)
	}
	if op.Error.Message != "" {
		return nil, "", fmt.Errorf("vertex operation carries error: %s", op.Error.Message)
	}
	if !op.Done {
		return nil, "", fmt.Errorf("vertex operation not done yet")
	}
	if gcsUri := vertexResultGcsUri(&op); gcsUri != "" {
		return nil, "", fmt.Errorf("vertex result was routed to user storageUri (%s), cannot transfer", gcsUri)
	}
	b64, mime := vertexResultBase64(&op)
	if b64 == "" {
		return nil, "", fmt.Errorf("vertex operation done but no base64 video content in response")
	}
	decoded, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		decoded, err = base64.RawStdEncoding.DecodeString(b64)
		if err != nil {
			return nil, "", fmt.Errorf("decode vertex video base64 failed: %w", err)
		}
	}
	return io.NopCloser(bytes.NewReader(decoded)), mime, nil
}

// vertexResultGcsUri 返回响应中的 gcsUri（storageUri 直写形态），无则空串。
func vertexResultGcsUri(op *operationResponse) string {
	if len(op.Response.Videos) > 0 && strings.TrimSpace(op.Response.Videos[0].GcsUri) != "" {
		return strings.TrimSpace(op.Response.Videos[0].GcsUri)
	}
	if u := strings.TrimSpace(op.Response.GcsUri); u != "" {
		return u
	}
	// 部分变体把 gs:// 路径放在 video 字段
	if v := strings.TrimSpace(op.Response.Video); strings.HasPrefix(v, "gs://") {
		return v
	}
	return ""
}

// vertexResultBase64 提取响应中的 base64 视频内容与 mime（与 ParseTaskResult 的取值顺序一致）。
func vertexResultBase64(op *operationResponse) (b64 string, mime string) {
	buildMime := func(mimeType, encoding string) string {
		m := strings.TrimSpace(mimeType)
		if m != "" {
			return m
		}
		enc := strings.TrimSpace(encoding)
		if enc == "" {
			enc = "mp4"
		}
		if strings.Contains(enc, "/") {
			return enc
		}
		return "video/" + enc
	}
	if len(op.Response.Videos) > 0 {
		v0 := op.Response.Videos[0]
		if v0.BytesBase64Encoded != "" {
			return v0.BytesBase64Encoded, buildMime(v0.MimeType, v0.Encoding)
		}
	}
	if op.Response.BytesBase64Encoded != "" {
		return op.Response.BytesBase64Encoded, buildMime("", op.Response.Encoding)
	}
	if v := op.Response.Video; v != "" && !strings.HasPrefix(v, "gs://") && !strings.HasPrefix(v, "http://") && !strings.HasPrefix(v, "https://") {
		return v, buildMime("", op.Response.Encoding)
	}
	return "", ""
}

// vertexMimeToExt 按 mime 静态映射对象扩展名（暂存时定死，不随重试漂移）。
func vertexMimeToExt(mime string) string {
	switch {
	case strings.Contains(mime, "webm"):
		return "webm"
	case strings.Contains(mime, "quicktime"), strings.Contains(mime, "mov"):
		return "mov"
	default:
		return taskcommon.AssetExtVideo
	}
}

func truncateForError(b []byte) string {
	const maxKeep = 512
	if len(b) <= maxKeep {
		return string(b)
	}
	return string(b[:maxKeep]) + "..."
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	// Use GetUpstreamTaskID() to get the real upstream operation name for model extraction.
	// task.TaskID is now a public task_xxxx ID, no longer a base64-encoded upstream name.
	upstreamTaskID := task.GetUpstreamTaskID()
	upstreamName, err := taskcommon.DecodeLocalTaskID(upstreamTaskID)
	if err != nil {
		upstreamName = ""
	}
	modelName := extractModelFromOperationName(upstreamName)
	if strings.TrimSpace(modelName) == "" {
		modelName = "veo-3.0-generate-001"
	}
	v := dto.NewOpenAIVideo()
	v.ID = task.TaskID
	v.Model = modelName
	v.Status = task.Status.ToVideoStatus()
	v.SetProgressStr(task.Progress)
	v.CreatedAt = task.CreatedAt
	v.CompletedAt = task.UpdatedAt
	if resultURL := task.GetResultURL(); strings.HasPrefix(resultURL, "data:") && len(resultURL) > 0 {
		v.SetMetadata("url", resultURL)
	}

	return common.Marshal(v)
}

// ============================
// helpers
// ============================

var regionRe = regexp.MustCompile(`locations/([a-z0-9-]+)/`)

func extractRegionFromOperationName(name string) string {
	m := regionRe.FindStringSubmatch(name)
	if len(m) == 2 {
		return m[1]
	}
	return ""
}

var modelRe = regexp.MustCompile(`models/([^/]+)/operations/`)

func extractModelFromOperationName(name string) string {
	m := modelRe.FindStringSubmatch(name)
	if len(m) == 2 {
		return m[1]
	}
	idx := strings.Index(name, "models/")
	if idx >= 0 {
		s := name[idx+len("models/"):]
		if p := strings.Index(s, "/operations/"); p > 0 {
			return s[:p]
		}
	}
	return ""
}

var projectRe = regexp.MustCompile(`projects/([^/]+)/locations/`)

func extractProjectFromOperationName(name string) string {
	m := projectRe.FindStringSubmatch(name)
	if len(m) == 2 {
		return m[1]
	}
	return ""
}
