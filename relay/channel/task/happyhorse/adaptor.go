package happyhorse

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// Request / Response structures
// ============================

// HappyHorseRequest 百炼乘风视频生成请求
type HappyHorseRequest struct {
	Model      string                `json:"model"`
	Input      HappyHorseInput       `json:"input"`
	Parameters *HappyHorseParameters `json:"parameters,omitempty"`
}

// HappyHorseInput 视频输入参数（使用 media[] 数组）
type HappyHorseInput struct {
	Prompt string      `json:"prompt,omitempty"`
	Media  []MediaItem `json:"media,omitempty"`
}

// MediaItem 媒体素材
type MediaItem struct {
	Type     string    `json:"type"`
	ImageURL *MediaURL `json:"image_url,omitempty"`
	VideoURL *MediaURL `json:"video_url,omitempty"`
}

// MediaURL 媒体地址
type MediaURL struct {
	URL string `json:"url"`
}

// HappyHorseParameters 视频生成参数
type HappyHorseParameters struct {
	Resolution   string `json:"resolution,omitempty"`     // 分辨率: 480P/720P/1080P
	Duration     *int   `json:"duration,omitempty"`       // 时长: 3-10秒
	PromptExtend *bool  `json:"prompt_extend,omitempty"`  // 是否开启prompt智能改写
}

// HappyHorseResponse 百炼乘风响应
type HappyHorseResponse struct {
	Output    HappyHorseOutput `json:"output"`
	RequestID string           `json:"request_id"`
	Code      string           `json:"code,omitempty"`
	Message   string           `json:"message,omitempty"`
}

// HappyHorseOutput 输出信息
type HappyHorseOutput struct {
	TaskID     string `json:"task_id"`
	TaskStatus string `json:"task_status"`
	VideoURL   string `json:"video_url,omitempty"`
	Code       string `json:"code,omitempty"`
	Message    string `json:"message,omitempty"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey  string
	baseURL string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/api/v1/services/aigc/video-generation/video-synthesis", a.baseURL), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DashScope-Async", "enable")
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_task_request_failed")
	}

	hhReq, err := convertToHappyHorseRequest(info, taskReq)
	if err != nil {
		return nil, errors.Wrap(err, "convert_to_happyhorse_request_failed")
	}
	logger.LogJson(c, "happyhorse video request body", hhReq)

	bodyBytes, err := common.Marshal(hhReq)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_happyhorse_request_failed")
	}
	return bytes.NewReader(bodyBytes), nil
}

func convertToHappyHorseRequest(info *relaycommon.RelayInfo, req relaycommon.TaskSubmitReq) (*HappyHorseRequest, error) {
	upstreamModel := req.Model
	if info.IsModelMapped {
		upstreamModel = info.UpstreamModelName
	}

	// 默认参数
	defaultDuration := 5
	promptExtend := true
	hhReq := &HappyHorseRequest{
		Model: upstreamModel,
		Input: HappyHorseInput{
			Prompt: req.Prompt,
		},
		Parameters: &HappyHorseParameters{
			Resolution:   "720P",
			Duration:     &defaultDuration,
			PromptExtend: &promptExtend,
		},
	}

	// 处理分辨率
	if req.Size != "" {
		resolution := strings.ToUpper(req.Size)
		if !strings.HasSuffix(resolution, "P") {
			resolution = resolution + "P"
		}
		hhReq.Parameters.Resolution = resolution
	}

	// 处理时长
	if req.Duration > 0 {
		d := req.Duration
		hhReq.Parameters.Duration = &d
	}

	// 构建 media 数组
	isVideoEdit := strings.Contains(upstreamModel, "video-edit")

	if isVideoEdit {
		// video-edit 模型：使用 video_url 类型
		if req.InputReference != "" {
			hhReq.Input.Media = []MediaItem{
				{
					Type:     "video_url",
					VideoURL: &MediaURL{URL: req.InputReference},
				},
			}
		}
		// 支持多图（编辑场景可能有参考图）
		for _, img := range req.Images {
			if img != "" {
				hhReq.Input.Media = append(hhReq.Input.Media, MediaItem{
					Type:     "image_url",
					ImageURL: &MediaURL{URL: img},
				})
			}
		}
	} else {
		// i2v / r2v 模型：使用 image_url 类型
		// 优先用 InputReference (单图)
		if req.InputReference != "" {
			hhReq.Input.Media = append(hhReq.Input.Media, MediaItem{
				Type:     "image_url",
				ImageURL: &MediaURL{URL: req.InputReference},
			})
		}
		// 再追加 Images 多图（r2v 首尾帧场景）
		for _, img := range req.Images {
			if img != "" {
				hhReq.Input.Media = append(hhReq.Input.Media, MediaItem{
					Type:     "image_url",
					ImageURL: &MediaURL{URL: img},
				})
			}
		}
	}

	return hhReq, nil
}

// EstimateBilling 按时长计算预消费倍率
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	duration := 5
	if taskReq.Duration > 0 {
		duration = taskReq.Duration
	}
	return map[string]float64{
		"seconds": float64(duration),
	}
}

// DoRequest delegates to common helper
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var hhResp HappyHorseResponse
	if err := common.Unmarshal(responseBody, &hhResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if hhResp.Code != "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("%s: %s", hhResp.Code, hhResp.Message), "happyhorse_api_error", resp.StatusCode)
		return
	}

	if hhResp.Output.TaskID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = info.PublicTaskID
	openAIResp.TaskID = info.PublicTaskID
	openAIResp.Model = c.GetString("model")
	if openAIResp.Model == "" && info != nil {
		openAIResp.Model = info.OriginModelName
	}
	openAIResp.Status = convertHappyHorseStatus(hhResp.Output.TaskStatus)
	openAIResp.CreatedAt = common.GetTimestamp()

	c.JSON(http.StatusOK, openAIResp)

	return hhResp.Output.TaskID, responseBody, nil
}

// FetchTask 查询任务状态
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/api/v1/tasks/%s", baseUrl, taskID)

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

// ParseTaskResult 解析任务结果
func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var hhResp HappyHorseResponse
	if err := common.Unmarshal(respBody, &hhResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	switch hhResp.Output.TaskStatus {
	case "PENDING":
		taskResult.Status = model.TaskStatusQueued
	case "RUNNING":
		taskResult.Status = model.TaskStatusInProgress
	case "SUCCEEDED":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Url = hhResp.Output.VideoURL
	case "FAILED", "CANCELED", "UNKNOWN":
		taskResult.Status = model.TaskStatusFailure
		if hhResp.Message != "" {
			taskResult.Reason = hhResp.Message
		} else if hhResp.Output.Message != "" {
			taskResult.Reason = fmt.Sprintf("task failed, code: %s, message: %s", hhResp.Output.Code, hhResp.Output.Message)
		} else {
			taskResult.Reason = "task failed"
		}
	default:
		taskResult.Status = model.TaskStatusQueued
	}

	return &taskResult, nil
}

// ConvertToOpenAIVideo 将存储的任务数据转换为 OpenAI 视频格式
func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	var hhResp HappyHorseResponse
	if err := common.Unmarshal(task.Data, &hhResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal happyhorse response failed")
	}

	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = task.TaskID
	openAIResp.Status = convertHappyHorseStatus(hhResp.Output.TaskStatus)
	openAIResp.Model = task.Properties.OriginModelName
	openAIResp.SetProgressStr(task.Progress)
	openAIResp.CreatedAt = task.CreatedAt
	openAIResp.CompletedAt = task.UpdatedAt

	openAIResp.SetMetadata("url", hhResp.Output.VideoURL)

	if hhResp.Code != "" {
		openAIResp.Error = &dto.OpenAIVideoError{
			Code:    hhResp.Code,
			Message: hhResp.Message,
		}
	} else if hhResp.Output.Code != "" {
		openAIResp.Error = &dto.OpenAIVideoError{
			Code:    hhResp.Output.Code,
			Message: hhResp.Output.Message,
		}
	}

	return common.Marshal(openAIResp)
}

func convertHappyHorseStatus(status string) string {
	switch status {
	case "PENDING":
		return dto.VideoStatusQueued
	case "RUNNING":
		return dto.VideoStatusInProgress
	case "SUCCEEDED":
		return dto.VideoStatusCompleted
	case "FAILED", "CANCELED", "UNKNOWN":
		return dto.VideoStatusFailed
	default:
		return dto.VideoStatusUnknown
	}
}
