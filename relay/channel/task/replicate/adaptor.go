package replicate

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
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
)

// ============================
// Request / Response structures
// ============================

// requestPayload represents the Replicate prediction request body
type requestPayload struct {
	Input map[string]any `json:"input"`
}

// predictionResponse represents the Replicate prediction response
type predictionResponse struct {
	ID          string `json:"id"`
	Status      string `json:"status"`
	Error       string `json:"error,omitempty"`
	Output      any    `json:"output,omitempty"` // Can be string or []string
	CreatedAt   string `json:"created_at,omitempty"`
	CompletedAt string `json:"completed_at,omitempty"`
	Logs        string `json:"logs,omitempty"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	if a.baseURL == "" {
		a.baseURL = constant.ChannelBaseURLs[constant.ChannelTypeReplicate]
	}
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	// Use standard validation for TaskSubmitReq
	if err := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionTextGenerate); err != nil {
		return err
	}
	// For Replicate, we only support text-to-video for now
	info.Action = constant.TaskActionTextGenerate
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	modelName := info.UpstreamModelName
	if modelName == "" {
		modelName = ModelList[0] // Default to first model
	}
	// POST https://api.replicate.com/v1/models/{model}/predictions
	return fmt.Sprintf("%s/v1/models/%s/predictions", a.baseURL, modelName), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	// Replicate uses "Token" prefix for API key
	req.Header.Set("Authorization", "Token "+info.ApiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	v, exists := c.Get("task_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}
	req := v.(relaycommon.TaskSubmitReq)

	// Build input payload
	input := make(map[string]any)
	input["prompt"] = req.Prompt

	// Map common fields to Replicate input format
	if req.Size != "" {
		input["aspect_ratio"] = mapSizeToAspectRatio(req.Size)
	}
	if req.Duration > 0 {
		input["duration"] = req.Duration
	}

	// Copy any additional metadata fields to input
	if req.Metadata != nil {
		for k, v := range req.Metadata {
			// Skip fields already handled
			if k == "prompt" || k == "aspect_ratio" || k == "duration" {
				continue
			}
			input[k] = v
		}
	}

	body := requestPayload{Input: input}

	data, err := common.Marshal(body)
	if err != nil {
		return nil, errors.Wrap(err, "marshal request body failed")
	}
	return bytes.NewReader(data), nil
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

	var prediction predictionResponse
	err = common.Unmarshal(responseBody, &prediction)
	if err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrap(err, fmt.Sprintf("%s", responseBody)), "unmarshal_response_failed", http.StatusInternalServerError)
		return
	}

	// Check for error in response
	if prediction.Error != "" {
		taskErr = service.TaskErrorWrapperLocal(fmt.Errorf("replicate error: %s", prediction.Error), "task_failed", http.StatusBadRequest)
		return
	}

	// Check if task already failed
	if prediction.Status == "failed" || prediction.Status == "canceled" {
		errMsg := prediction.Error
		if errMsg == "" {
			errMsg = fmt.Sprintf("task status: %s", prediction.Status)
		}
		taskErr = service.TaskErrorWrapperLocal(fmt.Errorf(errMsg), "task_failed", http.StatusBadRequest)
		return
	}

	// Return success response to client
	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)

	// Return upstream task ID and response body
	return prediction.ID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	// GET https://api.replicate.com/v1/predictions/{id}
	url := fmt.Sprintf("%s/v1/predictions/%s", baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Token "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	taskInfo := &relaycommon.TaskInfo{}

	var prediction predictionResponse
	err := common.Unmarshal(respBody, &prediction)
	if err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal response body")
	}

	// Map Replicate status to internal status
	// Replicate statuses: starting, processing, succeeded, failed, canceled
	switch prediction.Status {
	case "starting", "processing":
		taskInfo.Status = model.TaskStatusInProgress
		taskInfo.Progress = "50%"
	case "succeeded":
		taskInfo.Status = model.TaskStatusSuccess
		taskInfo.Progress = "100%"
		// Extract output URL
		outputURL := extractOutputURL(prediction.Output)
		if outputURL != "" {
			taskInfo.Url = outputURL
		}
	case "failed", "canceled":
		taskInfo.Status = model.TaskStatusFailure
		taskInfo.Progress = "100%"
		if prediction.Error != "" {
			taskInfo.Reason = prediction.Error
		} else {
			taskInfo.Reason = fmt.Sprintf("task %s", prediction.Status)
		}
	default:
		// Unknown status, treat as in progress
		taskInfo.Status = model.TaskStatusInProgress
		taskInfo.Progress = "30%"
	}

	return taskInfo, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var prediction predictionResponse
	if err := common.Unmarshal(originTask.Data, &prediction); err != nil {
		return nil, errors.Wrap(err, "unmarshal replicate task data failed")
	}

	openAIVideo := dto.NewOpenAIVideo()
	openAIVideo.ID = originTask.TaskID
	openAIVideo.Model = originTask.Properties.OriginModelName
	openAIVideo.Status = originTask.Status.ToVideoStatus()
	openAIVideo.SetProgressStr(originTask.Progress)
	openAIVideo.CreatedAt = originTask.CreatedAt
	if originTask.FinishTime > 0 {
		openAIVideo.CompletedAt = originTask.FinishTime
	} else if originTask.UpdatedAt > 0 {
		openAIVideo.CompletedAt = originTask.UpdatedAt
	}

	// Extract output URL and set in metadata
	outputURL := extractOutputURL(prediction.Output)
	if outputURL != "" {
		openAIVideo.SetMetadata("url", outputURL)
	}

	// Set error info if failed
	if prediction.Status == "failed" && prediction.Error != "" {
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: prediction.Error,
			Code:    "replicate_error",
		}
	}

	return common.Marshal(openAIVideo)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

// ============================
// helpers
// ============================

// extractOutputURL extracts the video URL from Replicate output
// Output can be either a string or an array of strings
func extractOutputURL(output any) string {
	if output == nil {
		return ""
	}

	// Try string first
	if str, ok := output.(string); ok {
		return str
	}

	// Try array of strings
	if arr, ok := output.([]any); ok && len(arr) > 0 {
		if str, ok := arr[0].(string); ok {
			return str
		}
	}

	// Try array of interface (from JSON unmarshal)
	if arr, ok := output.([]interface{}); ok && len(arr) > 0 {
		if str, ok := arr[0].(string); ok {
			return str
		}
	}

	return ""
}

// mapSizeToAspectRatio converts OpenAI-style size (e.g., "1920x1080") to aspect ratio (e.g., "16:9")
func mapSizeToAspectRatio(size string) string {
	// Common mappings
	sizeMap := map[string]string{
		"1920x1080": "16:9",
		"1080x1920": "9:16",
		"1080x1080": "1:1",
		"1280x720":  "16:9",
		"720x1280":  "9:16",
		"1024x1024": "1:1",
		"16:9":      "16:9",
		"9:16":      "9:16",
		"1:1":       "1:1",
		"4:3":       "4:3",
		"3:4":       "3:4",
	}

	if ratio, ok := sizeMap[size]; ok {
		return ratio
	}
	// If not found, return as-is (might already be in ratio format)
	return size
}
