package megabyai

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
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

type responseTask struct {
	ID                 string `json:"id"`
	TaskID             string `json:"task_id,omitempty"` //兼容旧接口
	Object             string `json:"object"`
	Model              string `json:"model"`
	Status             string `json:"status"`
	Progress           int    `json:"progress"`
	CreatedAt          int64  `json:"created_at"`
	CompletedAt        int64  `json:"completed_at,omitempty"`
	ExpiresAt          int64  `json:"expires_at,omitempty"`
	Seconds            string `json:"seconds,omitempty"`
	Size               string `json:"size,omitempty"`
	RemixedFromVideoID string `json:"remixed_from_video_id,omitempty"`
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
	facePass    bool
	proxy       string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = strings.TrimRight(strings.TrimSpace(info.ChannelBaseUrl), "/")
	a.apiKey = info.ApiKey
	a.facePass = megabyaiFacePassEnabled(info.ChannelOtherSettings)
	a.proxy = strings.TrimSpace(info.ChannelSetting.Proxy)
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	if info.Action == constant.TaskActionRemix {
		return service.TaskErrorWrapperLocal(fmt.Errorf("remix is not supported for MegaByAI video"), "not_supported", http.StatusBadRequest)
	}
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/videos", a.baseURL), nil
}

// BuildRequestHeader sets required headers. Upstream always receives JSON after BuildRequestBody.
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
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
		if err := common.Unmarshal(cachedBody, &bodyMap); err != nil {
			return nil, errors.Wrap(err, "unmarshal_request_body_failed")
		}
		bodyMap["model"] = info.UpstreamModelName
		if err := rejectUnsupportedFrames(bodyMap); err != nil {
			return nil, err
		}
		if a.facePass {
			if err := applyFacePass(bodyMap, nil, a.proxy); err != nil {
				return nil, errors.Wrap(err, "megabyai_face_pass_failed")
			}
		}
		normalizeCreateBody(bodyMap)
		newBody, err := common.Marshal(bodyMap)
		if err != nil {
			return nil, errors.Wrap(err, "marshal_request_body_failed")
		}
		return bytes.NewReader(newBody), nil
	}

	if strings.Contains(contentType, "multipart/form-data") {
		formData, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, errors.Wrap(err, "parse_multipart_failed")
		}
		bodyMap := multipartFormToBodyMap(formData)
		bodyMap["model"] = info.UpstreamModelName
		if err := rejectUnsupportedFrames(bodyMap); err != nil {
			return nil, err
		}
		if a.facePass {
			blobs, err := collectMultipartImageBlobs(formData)
			if err != nil {
				return nil, errors.Wrap(err, "read_multipart_images_failed")
			}
			if err := applyFacePass(bodyMap, blobs, a.proxy); err != nil {
				return nil, errors.Wrap(err, "megabyai_face_pass_failed")
			}
		}
		normalizeCreateBody(bodyMap)
		newBody, err := common.Marshal(bodyMap)
		if err != nil {
			return nil, errors.Wrap(err, "marshal_request_body_failed")
		}
		c.Request.Header.Set("Content-Type", "application/json")
		return bytes.NewReader(newBody), nil
	}

	return common.ReaderOnly(storage), nil
}

// multipartFormToBodyMap extracts MegaByAI-relevant scalar and URL list fields from multipart form.
func multipartFormToBodyMap(formData *multipart.Form) map[string]interface{} {
	body := make(map[string]interface{})
	if formData == nil {
		return body
	}

	for _, key := range []string{
		"prompt", "seconds", "duration", "size", "ratio", "resolution", "aspect_ratio",
		"first_image", "last_image",
	} {
		if vals := formData.Value[key]; len(vals) > 0 {
			if v := strings.TrimSpace(vals[0]); v != "" {
				body[key] = v
			}
		}
	}

	for _, key := range []string{
		"images", "image", "input_reference",
		"videos", "audios",
		"referenceImages", "referenceVideos", "referenceAudios",
	} {
		vals := formData.Value[key]
		if len(vals) == 0 {
			continue
		}
		urls := make([]string, 0, len(vals))
		for _, v := range vals {
			if u := strings.TrimSpace(v); u != "" {
				urls = append(urls, u)
			}
		}
		if len(urls) == 0 {
			continue
		}
		if len(urls) == 1 && (key == "image" || key == "input_reference") {
			body[key] = urls[0]
		} else {
			body[key] = urls
		}
	}
	return body
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

	// 使用公开 task_xxxx ID 返回给客户端
	dResp.ID = info.PublicTaskID
	dResp.TaskID = info.PublicTaskID
	c.JSON(http.StatusOK, dResp)
	return upstreamID, responseBody, nil
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	baseUrl = strings.TrimRight(strings.TrimSpace(baseUrl), "/")
	uri := fmt.Sprintf("%s/v1/videos/%s", baseUrl, taskID)

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

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	switch resTask.Status {
	case "queued", "pending":
		taskResult.Status = model.TaskStatusQueued
	case "processing", "in_progress":
		taskResult.Status = model.TaskStatusInProgress
	case "completed":
		taskResult.Status = model.TaskStatusSuccess
		// Url intentionally left empty — the caller constructs the proxy URL using the public task ID
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
		taskResult.Progress = fmt.Sprintf("%d%%", resTask.Progress)
	}

	return &taskResult, nil
}

// authGatedVideoContentURLPaths are response fields that may carry upstream
// /v1/videos/{id}/content URLs requiring the upstream Bearer key.
var authGatedVideoContentURLPaths = []string{
	"url",
	"video_url",
	"content_url",
	"metadata.url",
	"metadata.video_url",
	"metadata.content_url",
}

// isAuthGatedVideoContentURL reports whether u looks like an OpenAI-style
// authenticated content endpoint (.../v1/videos/{id}/content), not a CDN/mp4 link.
func isAuthGatedVideoContentURL(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" || !strings.HasPrefix(raw, "http") {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return false
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	for i := 0; i+3 < len(parts); i++ {
		if parts[i] == "v1" && parts[i+1] == "videos" && parts[i+3] == "content" {
			return true
		}
	}
	return false
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

	proxyURL := taskcommon.BuildProxyURL(task.TaskID)
	for _, path := range authGatedVideoContentURLPaths {
		u := strings.TrimSpace(gjson.GetBytes(data, path).String())
		if !isAuthGatedVideoContentURL(u) {
			continue
		}
		if data, err = sjson.SetBytes(data, path, proxyURL); err != nil {
			return nil, errors.Wrapf(err, "rewrite %s failed", path)
		}
	}
	return data, nil
}
