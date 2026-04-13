package aigc

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	"github.com/tidwall/sjson"
)

// ============================
// Request / Response structures
// ============================

type responseTask struct {
	ID        string `json:"id"`
	Object    string `json:"object"`
	Model     string `json:"model"`
	Status    string `json:"status"`
	Progress  int    `json:"progress"`
	CreatedAt int64  `json:"created_at"`
	Size      string `json:"size,omitempty"`
}

type fetchResponseTask struct {
	ID          string `json:"id"`
	Status      string `json:"status"`
	Progress    int    `json:"progress"`
	VideoURL    string `json:"video_url"`
	CompletedAt int64  `json:"completed_at"`
	Error       *struct {
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
	baseURL     string
	subAppId    string
	secretId    string
	secretKey   string
	region      string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	parts := strings.Split(info.ApiKey, "|")
	if len(parts) >= 3 {
		a.subAppId = parts[0]
		a.secretId = parts[1]
		a.secretKey = parts[2]
	}
	if len(parts) >= 4 {
		a.region = parts[3]
	}
}

func validateRemixRequest(c *gin.Context) *dto.TaskError {
	var req relaycommon.TaskSubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("field prompt is required"), "invalid_request", http.StatusBadRequest)
	}
	c.Set("task_request", req)
	return nil
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	if info.Action == constant.TaskActionRemix {
		return validateRemixRequest(c)
	}
	return relaycommon.ValidateMultipartDirect(c, info)
}

// EstimateBilling extracts seconds and size ratios from the user request for billing.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
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
	// Check metadata for seconds/duration if not found at top level
	if seconds <= 0 && req.Metadata != nil {
		if v, ok := req.Metadata["seconds"]; ok {
			switch val := v.(type) {
			case float64:
				seconds = int(val)
			case string:
				seconds, _ = strconv.Atoi(val)
			}
		}
		if seconds <= 0 {
			if v, ok := req.Metadata["duration"]; ok {
				switch val := v.(type) {
				case float64:
					seconds = int(val)
				case string:
					seconds, _ = strconv.Atoi(val)
				}
			}
		}
	}
	if seconds <= 0 {
		seconds = 5
	}

	size := req.Size
	if size == "" {
		size = "720x1280"
	}

	ratios := map[string]float64{
		"seconds": float64(seconds),
		"size":    1,
	}
	if size == "1792x1024" || size == "1024x1792" || size == "1080P" {
		ratios["size"] = 1.666667
	}
	return ratios
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.Action == constant.TaskActionRemix {
		return fmt.Sprintf("%s/v1/videos/%s/remix", a.baseURL, info.OriginTaskID), nil
	}
	return fmt.Sprintf("%s/v1/videos", a.baseURL), nil
}

// setSignatureHeaders sets HMAC-SHA256 authentication headers on the request.
func (a *TaskAdaptor) setSignatureHeaders(req *http.Request) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signStr := fmt.Sprintf("%s\n%s\n%s", a.secretId, timestamp, a.secretKey)
	h := hmac.New(sha256.New, []byte(a.secretKey))
	h.Write([]byte(signStr))
	signature := hex.EncodeToString(h.Sum(nil))

	req.Header.Set("X-SubAppId", a.subAppId)
	req.Header.Set("X-SecretId", a.secretId)
	req.Header.Set("X-Timestamp", timestamp)
	req.Header.Set("X-Signature", signature)
	if a.region != "" {
		req.Header.Set("X-Region", a.region)
	}
}

// BuildRequestHeader sets HMAC-SHA256 authentication headers.
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	a.setSignatureHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	return nil
}

// BuildRequestBody reads the cached body, replaces model with upstream name, and returns it.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_request_body_failed")
	}
	cachedBody, err := storage.Bytes()
	if err != nil {
		return nil, errors.Wrap(err, "read_body_bytes_failed")
	}
	var bodyMap map[string]interface{}
	if err := common.Unmarshal(cachedBody, &bodyMap); err == nil {
		bodyMap["model"] = info.UpstreamModelName
		if newBody, err := common.Marshal(bodyMap); err == nil {
			return bytes.NewReader(newBody), nil
		}
	}
	return bytes.NewReader(cachedBody), nil
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
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	// Return public task ID to client
	dResp.ID = info.PublicTaskID
	c.JSON(http.StatusOK, dResp)
	return upstreamID, responseBody, nil
}

// FetchTask fetches task status from the upstream AIGC gateway.
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/v1/videos/%s", baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	// Parse pipe-separated key and set auth headers
	parts := strings.Split(key, "|")
	if len(parts) >= 3 {
		subAppId := parts[0]
		secretId := parts[1]
		secretKey := parts[2]

		timestamp := strconv.FormatInt(time.Now().Unix(), 10)
		signStr := fmt.Sprintf("%s\n%s\n%s", secretId, timestamp, secretKey)
		h := hmac.New(sha256.New, []byte(secretKey))
		h.Write([]byte(signStr))
		signature := hex.EncodeToString(h.Sum(nil))

		req.Header.Set("X-SubAppId", subAppId)
		req.Header.Set("X-SecretId", secretId)
		req.Header.Set("X-Timestamp", timestamp)
		req.Header.Set("X-Signature", signature)
		if len(parts) >= 4 && parts[3] != "" {
			req.Header.Set("X-Region", parts[3])
		}
	}

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

// ParseTaskResult parses the upstream response into a unified TaskInfo.
func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var resTask fetchResponseTask
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
		if resTask.VideoURL != "" {
			taskResult.Url = resTask.VideoURL
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
		taskResult.Progress = fmt.Sprintf("%d%%", resTask.Progress)
	}

	return &taskResult, nil
}

// ConvertToOpenAIVideo implements the OpenAIVideoConverter interface.
// The upstream AIGC gateway already returns OpenAI-compatible format; we only replace the ID.
func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	data := task.Data
	var err error
	if data, err = sjson.SetBytes(data, "id", task.TaskID); err != nil {
		return nil, errors.Wrap(err, "set id failed")
	}
	return data, nil
}
