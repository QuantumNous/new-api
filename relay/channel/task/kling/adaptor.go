package kling

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt"
	"github.com/pkg/errors"

	"one-api/common"
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
	Model       string  `json:"model,omitempty"`
	ModelName   string  `json:"model_name,omitempty"`
	CfgScale    float64 `json:"cfg_scale,omitempty"`
}

type responsePayload struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		TaskID string `json:"task_id"`
	} `json:"data"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	ChannelType int
	accessKey   string
	secretKey   string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.TaskRelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.BaseUrl

	// apiKey format: "access_key|secret_key"
	keyParts := strings.Split(info.ApiKey, "|")
	if len(keyParts) == 2 {
		a.accessKey = strings.TrimSpace(keyParts[0])
		a.secretKey = strings.TrimSpace(keyParts[1])
	}
}

// ValidateRequestAndSetAction parses body, validates fields and sets default action.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.TaskRelayInfo) (taskErr *dto.TaskError) {
	// Accept only POST /v1/video/generations as "generate" action.
	action := "generate"
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
	c.Set("kling_request", req)
	return nil
}

// BuildRequestURL constructs the upstream URL.
func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.TaskRelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/videos/image2video", a.baseURL), nil
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
	v, exists := c.Get("kling_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}
	req := v.(SubmitReq)

	body := a.convertToRequestPayload(&req)
	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

// DoRequest delegates to common helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.TaskRelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response, returns taskID etc.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.TaskRelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}

	// Attempt Kling response parse first.
	var kResp responsePayload
	if err := json.Unmarshal(responseBody, &kResp); err == nil && kResp.Code == 0 {
		c.JSON(http.StatusOK, gin.H{"task_id": kResp.Data.TaskID})
		return kResp.Data.TaskID, responseBody, nil
	}

	// Fallback generic task response.
	var generic dto.TaskResponse[string]
	if err := json.Unmarshal(responseBody, &generic); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if !generic.IsSuccess() {
		taskErr = service.TaskErrorWrapper(fmt.Errorf(generic.Message), generic.Code, http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, gin.H{"task_id": generic.Data})
	return generic.Data, responseBody, nil
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}
	url := fmt.Sprintf("%s/v1/videos/image2video/%s", baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	token, err := a.createJWTTokenWithKey(key)
	if err != nil {
		token = key
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	req = req.WithContext(ctx)
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

func (a *TaskAdaptor) convertToRequestPayload(req *SubmitReq) *requestPayload {
	r := &requestPayload{
		Prompt:      req.Prompt,
		Image:       req.Image,
		Mode:        defaultString(req.Mode, "std"),
		Duration:    fmt.Sprintf("%d", defaultInt(req.Duration, 5)),
		AspectRatio: a.getAspectRatio(req.Size),
		Model:       req.Model,
		ModelName:   req.Model,
		CfgScale:    0.5,
	}
	if r.Model == "" {
		r.Model = "kling-v1"
		r.ModelName = "kling-v1"
	}
	return r
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
	return a.createJWTTokenWithKeys(a.accessKey, a.secretKey)
}

func (a *TaskAdaptor) createJWTTokenWithKey(apiKey string) (string, error) {
	parts := strings.Split(apiKey, "|")
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid API key format, expected 'access_key,secret_key'")
	}
	return a.createJWTTokenWithKeys(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
}

func (a *TaskAdaptor) createJWTTokenWithKeys(accessKey, secretKey string) (string, error) {
	if accessKey == "" || secretKey == "" {
		return "", fmt.Errorf("access key and secret key are required")
	}
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

// ParseResultUrl 提取视频任务结果的 url
func (a *TaskAdaptor) ParseResultUrl(resp map[string]any) (string, error) {
	data, ok := resp["data"].(map[string]any)
	if !ok {
		return "", fmt.Errorf("data field not found or invalid")
	}
	taskResult, ok := data["task_result"].(map[string]any)
	if !ok {
		return "", fmt.Errorf("task_result field not found or invalid")
	}
	videos, ok := taskResult["videos"].([]interface{})
	if !ok || len(videos) == 0 {
		return "", fmt.Errorf("videos field not found or empty")
	}
	video, ok := videos[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("video item invalid")
	}
	url, ok := video["url"].(string)
	if !ok || url == "" {
		return "", fmt.Errorf("url field not found or invalid")
	}
	return url, nil
}
