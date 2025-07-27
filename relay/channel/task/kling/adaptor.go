package kling

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/samber/lo"
	"io"
	"net/http"
	"one-api/model"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt"
	"github.com/pkg/errors"

	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	"one-api/relay/channel"
	relaycommon "one-api/relay/common"
	"one-api/service"
)

// ============================
// Request / Response structures
// ============================

type SubmitReq struct {
	Prompt   string                 `json:"prompt"`
	Model    string                 `json:"model,omitempty"`
	Mode     string                 `json:"mode,omitempty"`
	Image    string                 `json:"image,omitempty"`
	Size     string                 `json:"size,omitempty"`
	Duration int                    `json:"duration,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

type requestPayload struct {
	Prompt      string  `json:"prompt,omitempty"`
	Image       string  `json:"image,omitempty"`
	Mode        string  `json:"mode,omitempty"`
	Duration    string  `json:"duration,omitempty"`
	AspectRatio string  `json:"aspect_ratio,omitempty"`
	ModelName   string  `json:"model_name,omitempty"`
	Model       string  `json:"model,omitempty"` // Compatible with upstreams that only recognize "model"
	CfgScale    float64 `json:"cfg_scale,omitempty"`
}

type responsePayload struct {
	Code      int    `json:"code"`
	Message   string `json:"message"`
	TaskId    string `json:"task_id"`
	RequestId string `json:"request_id"`
	Data      struct {
		TaskId        string `json:"task_id"`
		TaskStatus    string `json:"task_status"`
		TaskStatusMsg string `json:"task_status_msg"`
		TaskResult    struct {
			Videos []struct {
				Id       string `json:"id"`
				Url      string `json:"url"`
				Duration string `json:"duration"`
			} `json:"videos"`
		} `json:"task_result"`
		CreatedAt int64 `json:"created_at"`
		UpdatedAt int64 `json:"updated_at"`
	} `json:"data"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.TaskRelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.BaseUrl
	a.apiKey = info.ApiKey

	// apiKey format: "access_key|secret_key"
}

// ValidateRequestAndSetAction parses body, validates fields and sets default action.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.TaskRelayInfo) (taskErr *dto.TaskError) {
	// Accept only POST /v1/video/generations as "generate" action.
	action := constant.TaskActionGenerate
	info.Action = action

	var req SubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		taskErr = service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Prompt) == "" {
		taskErr = service.TaskErrorWrapperLocal(fmt.Errorf("prompt is required"), "invalid_request", http.StatusBadRequest)
		return
	}

	// Store into context for later usage
	c.Set("task_request", req)
	return nil
}

// BuildRequestURL constructs the upstream URL.
func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.TaskRelayInfo) (string, error) {
	path := lo.Ternary(info.Action == constant.TaskActionGenerate, "/v1/videos/image2video", "/v1/videos/text2video")
	return fmt.Sprintf("%s%s", a.baseURL, path), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.TaskRelayInfo) error {
	token, err := a.createJWTToken()
	if err != nil {
		return fmt.Errorf("failed to create JWT token: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", "kling-sdk/1.0")
	return nil
}

// BuildRequestBody converts request into Kling specific format.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.TaskRelayInfo) (io.Reader, error) {
	v, exists := c.Get("task_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}
	req := v.(SubmitReq)

	body, err := a.convertToRequestPayload(&req)
	if err != nil {
		return nil, err
	}
	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

// DoRequest delegates to common helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.TaskRelayInfo, requestBody io.Reader) (*http.Response, error) {
	if action := c.GetString("action"); action != "" {
		info.Action = action
	}
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response, returns taskID etc.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.TaskRelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}

	var kResp responsePayload
	err = json.Unmarshal(responseBody, &kResp)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "unmarshal_response_failed", http.StatusInternalServerError)
		return
	}
	if kResp.Code != 0 {
		taskErr = service.TaskErrorWrapperLocal(fmt.Errorf(kResp.Message), "task_failed", http.StatusBadRequest)
		return
	}
	kResp.TaskId = kResp.Data.TaskId
	c.JSON(http.StatusOK, kResp)
	return kResp.Data.TaskId, responseBody, nil
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}
	action, ok := body["action"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid action")
	}
	path := lo.Ternary(action == constant.TaskActionGenerate, "/v1/videos/image2video", "/v1/videos/text2video")
	url := fmt.Sprintf("%s%s/%s", baseUrl, path, taskID)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	token, err := a.createJWTTokenWithKey(key)
	if err != nil {
		token = key
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", "kling-sdk/1.0")

	return service.GetHttpClient().Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	return []string{"kling-v1", "kling-v1-6", "kling-v2-master"}
}

func (a *TaskAdaptor) GetChannelName() string {
	return "kling"
}

// ============================
// helpers
// ============================

func (a *TaskAdaptor) convertToRequestPayload(req *SubmitReq) (*requestPayload, error) {
	r := requestPayload{
		Prompt:      req.Prompt,
		Image:       req.Image,
		Mode:        defaultString(req.Mode, "std"),
		Duration:    fmt.Sprintf("%d", defaultInt(req.Duration, 5)),
		AspectRatio: a.getAspectRatio(req.Size),
		ModelName:   req.Model,
		Model:       req.Model, // Keep consistent with model_name, double writing improves compatibility
		CfgScale:    0.5,
	}
	if r.ModelName == "" {
		r.ModelName = "kling-v1"
	}
	metadata := req.Metadata
	medaBytes, err := json.Marshal(metadata)
	if err != nil {
		return nil, errors.Wrap(err, "metadata marshal metadata failed")
	}
	err = json.Unmarshal(medaBytes, &r)
	if err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	return &r, nil
}

func (a *TaskAdaptor) getAspectRatio(size string) string {
	switch size {
	case "1024x1024", "512x512":
		return "1:1"
	case "1280x720", "1920x1080":
		return "16:9"
	case "720x1280", "1080x1920":
		return "9:16"
	default:
		return "1:1"
	}
}

func defaultString(s, def string) string {
	if strings.TrimSpace(s) == "" {
		return def
	}
	return s
}

func defaultInt(v int, def int) int {
	if v == 0 {
		return def
	}
	return v
}

// ============================
// JWT helpers
// ============================

func (a *TaskAdaptor) createJWTToken() (string, error) {
	return a.createJWTTokenWithKey(a.apiKey)
}

//func (a *TaskAdaptor) createJWTTokenWithKey(apiKey string) (string, error) {
//	parts := strings.Split(apiKey, "|")
//	if len(parts) != 2 {
//		return "", fmt.Errorf("invalid API key format, expected 'access_key,secret_key'")
//	}
//	return a.createJWTTokenWithKey(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
//}

func (a *TaskAdaptor) createJWTTokenWithKey(apiKey string) (string, error) {

	keyParts := strings.Split(apiKey, "|")
	accessKey := strings.TrimSpace(keyParts[0])
	if len(keyParts) == 1 {
		return accessKey, nil
	}
	secretKey := strings.TrimSpace(keyParts[1])
	now := time.Now().Unix()
	claims := jwt.MapClaims{
		"iss": accessKey,
		"exp": now + 1800, // 30 minutes
		"nbf": now - 5,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["typ"] = "JWT"
	return token.SignedString([]byte(secretKey))
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	taskInfo := &relaycommon.TaskInfo{}
	resPayload := responsePayload{}
	err := json.Unmarshal(respBody, &resPayload)
	if err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal response body")
	}
	taskInfo.Code = resPayload.Code
	taskInfo.TaskID = resPayload.Data.TaskId
	taskInfo.Reason = resPayload.Message
	//任务状态，枚举值：submitted（已提交）、processing（处理中）、succeed（成功）、failed（失败）
	status := resPayload.Data.TaskStatus
	switch status {
	case "submitted":
		taskInfo.Status = model.TaskStatusSubmitted
	case "processing":
		taskInfo.Status = model.TaskStatusInProgress
	case "succeed":
		taskInfo.Status = model.TaskStatusSuccess
	case "failed":
		taskInfo.Status = model.TaskStatusFailure
	default:
		return nil, fmt.Errorf("unknown task status: %s", status)
	}
	if videos := resPayload.Data.TaskResult.Videos; len(videos) > 0 {
		video := videos[0]
		taskInfo.Url = video.Url
	}
	return taskInfo, nil
}
