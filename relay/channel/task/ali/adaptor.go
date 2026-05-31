package ali

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// Request / Response structures
// ============================

// AliVideoRequest 阿里通义万相视频生成请求
type AliVideoRequest struct {
	Model      string              `json:"model"`
	Input      AliVideoInput       `json:"input"`
	Parameters *AliVideoParameters `json:"parameters,omitempty"`
}

// AliVideoInput 视频输入参数
type AliVideoInput struct {
	Prompt         string `json:"prompt,omitempty"`          // 文本提示词
	ImgURL         string `json:"img_url,omitempty"`         // 首帧图像URL或Base64（图生视频）
	FirstFrameURL  string `json:"first_frame_url,omitempty"` // 首帧图片URL（首尾帧生视频）
	LastFrameURL   string `json:"last_frame_url,omitempty"`  // 尾帧图片URL（首尾帧生视频）
	AudioURL       string `json:"audio_url,omitempty"`       // 音频URL（wan2.5支持）
	NegativePrompt string `json:"negative_prompt,omitempty"` // 反向提示词
	Template       string `json:"template,omitempty"`        // 视频特效模板
}

// AliVideoParameters 视频参数
type AliVideoParameters struct {
	Resolution   string `json:"resolution,omitempty"`    // 分辨率: 480P/720P/1080P（图生视频、首尾帧生视频）
	Size         string `json:"size,omitempty"`          // 尺寸: 如 "832*480"（文生视频）
	Duration     int    `json:"duration,omitempty"`      // 时长: 3-10秒
	PromptExtend bool   `json:"prompt_extend,omitempty"` // 是否开启prompt智能改写
	Watermark    bool   `json:"watermark,omitempty"`     // 是否添加水印
	Audio        *bool  `json:"audio,omitempty"`         // 是否添加音频（wan2.5）
	Seed         int    `json:"seed,omitempty"`          // 随机数种子
}

// AliVideoResponse 阿里通义万相响应
type AliVideoResponse struct {
	Output    AliVideoOutput `json:"output"`
	RequestID string         `json:"request_id"`
	Code      string         `json:"code,omitempty"`
	Message   string         `json:"message,omitempty"`
	Usage     *AliUsage      `json:"usage,omitempty"`
}

// AliVideoOutput 输出信息
type AliVideoOutput struct {
	TaskID        string `json:"task_id"`
	TaskStatus    string `json:"task_status"`
	SubmitTime    string `json:"submit_time,omitempty"`
	ScheduledTime string `json:"scheduled_time,omitempty"`
	EndTime       string `json:"end_time,omitempty"`
	OrigPrompt    string `json:"orig_prompt,omitempty"`
	ActualPrompt  string `json:"actual_prompt,omitempty"`
	VideoURL      string `json:"video_url,omitempty"`
	Code          string `json:"code,omitempty"`
	Message       string `json:"message,omitempty"`
}

// AliUsage 使用统计
type AliUsage struct {
	Duration   dto.IntValue `json:"duration,omitempty"`
	VideoCount dto.IntValue `json:"video_count,omitempty"`
	SR         dto.IntValue `json:"SR,omitempty"`
}

type AliMetadata struct {
	// Input 相关
	AudioURL       string `json:"audio_url,omitempty"`       // 音频URL
	ImgURL         string `json:"img_url,omitempty"`         // 图片URL（图生视频）
	FirstFrameURL  string `json:"first_frame_url,omitempty"` // 首帧图片URL（首尾帧生视频）
	LastFrameURL   string `json:"last_frame_url,omitempty"`  // 尾帧图片URL（首尾帧生视频）
	NegativePrompt string `json:"negative_prompt,omitempty"` // 反向提示词
	Template       string `json:"template,omitempty"`        // 视频特效模板

	// Parameters 相关
	Resolution   *string `json:"resolution,omitempty"`    // 分辨率: 480P/720P/1080P
	Size         *string `json:"size,omitempty"`          // 尺寸: 如 "832*480"
	Duration     *int    `json:"duration,omitempty"`      // 时长
	PromptExtend *bool   `json:"prompt_extend,omitempty"` // 是否开启prompt智能改写
	Watermark    *bool   `json:"watermark,omitempty"`     // 是否添加水印
	Audio        *bool   `json:"audio,omitempty"`         // 是否添加音频
	Seed         *int    `json:"seed,omitempty"`          // 随机数种子
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

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	// ValidateMultipartDirect 负责解析并将原始 TaskSubmitReq 存入 context
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/api/v1/services/aigc/video-generation/video-synthesis", a.baseURL), nil
}

// BuildRequestHeader sets required headers for Ali API
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DashScope-Async", "enable") // 阿里异步任务必须设置
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_task_request_failed")
	}

	aliReq, err := a.convertToAliRequest(info, taskReq)
	if err != nil {
		return nil, errors.Wrap(err, "convert_to_ali_request_failed")
	}
	logger.LogJson(c, "ali video request body", aliReq)

	bodyBytes, err := common.Marshal(aliReq)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_ali_request_failed")
	}
	return bytes.NewReader(bodyBytes), nil
}

var (
	size480p = []string{
		"832*480",
		"480*832",
		"624*624",
	}
	size720p = []string{
		"1280*720",
		"720*1280",
		"960*960",
		"1088*832",
		"832*1088",
	}
	size1080p = []string{
		"1920*1080",
		"1080*1920",
		"1440*1440",
		"1632*1248",
		"1248*1632",
	}
)

func sizeToResolution(size string) (string, error) {
	if lo.Contains(size480p, size) {
		return "480P", nil
	} else if lo.Contains(size720p, size) {
		return "720P", nil
	} else if lo.Contains(size1080p, size) {
		return "1080P", nil
	}
	return "", fmt.Errorf("invalid size: %s", size)
}

func ProcessAliOtherRatios(aliReq *AliVideoRequest) (map[string]float64, error) {
	otherRatios := make(map[string]float64)
	aliRatios := map[string]map[string]float64{
		"wan2.6-i2v": {
			"720P":  1,
			"1080P": 1 / 0.6,
		},
		"wan2.5-t2v-preview": {
			"480P":  1,
			"720P":  2,
			"1080P": 1 / 0.3,
		},
		"wan2.2-t2v-plus": {
			"480P":  1,
			"1080P": 0.7 / 0.14,
		},
		"wan2.5-i2v-preview": {
			"480P":  1,
			"720P":  2,
			"1080P": 1 / 0.3,
		},
		"wan2.2-i2v-plus": {
			"480P":  1,
			"1080P": 0.7 / 0.14,
		},
		"wan2.2-kf2v-flash": {
			"480P":  1,
			"720P":  2,
			"1080P": 4.8,
		},
		"wan2.2-i2v-flash": {
			"480P": 1,
			"720P": 2,
		},
		"wan2.2-s2v": {
			"480P": 1,
			"720P": 0.9 / 0.5,
		},
	}
	var resolution string

	// size match
	if aliReq.Parameters.Size != "" {
		toResolution, err := sizeToResolution(aliReq.Parameters.Size)
		if err != nil {
			return nil, err
		}
		resolution = toResolution
	} else {
		resolution = strings.ToUpper(aliReq.Parameters.Resolution)
		if !strings.HasSuffix(resolution, "P") {
			resolution = resolution + "P"
		}
	}
	// 优先使用管理员配置的分辨率倍率，未配置时回退到内置硬编码
	if configRatios, ok := ratio_setting.GetVideoResolutionRatio(aliReq.Model); ok {
		if ratio, ok := configRatios[resolution]; ok {
			otherRatios[fmt.Sprintf("resolution-%s", resolution)] = ratio
		}
	} else if otherRatio, ok := aliRatios[aliReq.Model]; ok {
		if ratio, ok := otherRatio[resolution]; ok {
			otherRatios[fmt.Sprintf("resolution-%s", resolution)] = ratio
		}
	}
	return otherRatios, nil
}

func (a *TaskAdaptor) convertToAliRequest(info *relaycommon.RelayInfo, req relaycommon.TaskSubmitReq) (*AliVideoRequest, error) {
	upstreamModel := req.Model
	if info.IsModelMapped {
		upstreamModel = info.UpstreamModelName
	}
	aliReq := &AliVideoRequest{
		Model: upstreamModel,
		Input: AliVideoInput{
			Prompt: req.Prompt,
			ImgURL: req.InputReference,
		},
		Parameters: &AliVideoParameters{
			PromptExtend: true, // 默认开启智能改写
			Watermark:    false,
		},
	}

	// 处理分辨率映射
	if req.Size != "" {
		// text to video size must be contained *
		if strings.Contains(req.Model, "t2v") && !strings.Contains(req.Size, "*") {
			return nil, fmt.Errorf("invalid size: %s, example: %s", req.Size, "1920*1080")
		}
		if strings.Contains(req.Size, "*") {
			aliReq.Parameters.Size = req.Size
		} else {
			resolution := strings.ToUpper(req.Size)
			// 支持 480p, 720p, 1080p 或 480P, 720P, 1080P
			if !strings.HasSuffix(resolution, "P") {
				resolution = resolution + "P"
			}
			aliReq.Parameters.Resolution = resolution
		}
	} else {
		// 根据模型设置默认分辨率
		if strings.Contains(req.Model, "t2v") { // image to video
			if strings.HasPrefix(req.Model, "wan2.5") {
				aliReq.Parameters.Size = "1920*1080"
			} else if strings.HasPrefix(req.Model, "wan2.2") {
				aliReq.Parameters.Size = "1920*1080"
			} else {
				aliReq.Parameters.Size = "1280*720"
			}
		} else {
			if strings.HasPrefix(req.Model, "wan2.6") {
				aliReq.Parameters.Resolution = "1080P"
			} else if strings.HasPrefix(req.Model, "wan2.5") {
				aliReq.Parameters.Resolution = "1080P"
			} else if strings.HasPrefix(req.Model, "wan2.2-i2v-flash") {
				aliReq.Parameters.Resolution = "720P"
			} else if strings.HasPrefix(req.Model, "wan2.2-i2v-plus") {
				aliReq.Parameters.Resolution = "1080P"
			} else {
				aliReq.Parameters.Resolution = "720P"
			}
		}
	}

	// 处理时长
	if req.Duration > 0 {
		aliReq.Parameters.Duration = req.Duration
	} else if req.Seconds != "" {
		seconds, err := strconv.Atoi(req.Seconds)
		if err != nil {
			return nil, errors.Wrap(err, "convert seconds to int failed")
		} else {
			aliReq.Parameters.Duration = seconds
		}
	} else {
		aliReq.Parameters.Duration = 5 // 默认5秒
	}

	// 从 metadata 中提取额外参数
	if req.Metadata != nil {
		if metadataBytes, err := common.Marshal(req.Metadata); err == nil {
			err = common.Unmarshal(metadataBytes, aliReq)
			if err != nil {
				return nil, errors.Wrap(err, "unmarshal metadata failed")
			}
		} else {
			return nil, errors.Wrap(err, "marshal metadata failed")
		}
	}

	if aliReq.Model != upstreamModel {
		return nil, errors.New("can't change model with metadata")
	}

	return aliReq, nil
}

// EstimateBilling 根据用户请求参数计算 OtherRatios（时长、分辨率等）。
// 在 ValidateRequestAndSetAction 之后、价格计算之前调用。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}

	aliReq, err := a.convertToAliRequest(info, taskReq)
	if err != nil {
		return nil
	}

	otherRatios := map[string]float64{
		"seconds": float64(aliReq.Parameters.Duration),
	}
	ratios, err := ProcessAliOtherRatios(aliReq)
	if err != nil {
		return otherRatios
	}
	for k, v := range ratios {
		otherRatios[k] = v
	}
	return otherRatios
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

	// 解析阿里响应
	var aliResp AliVideoResponse
	if err := common.Unmarshal(responseBody, &aliResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	// 检查错误
	if aliResp.Code != "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("%s: %s", aliResp.Code, aliResp.Message), "ali_api_error", resp.StatusCode)
		return
	}

	if aliResp.Output.TaskID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	// 转换为 OpenAI 格式响应
	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = info.PublicTaskID
	openAIResp.TaskID = info.PublicTaskID
	openAIResp.Model = c.GetString("model")
	if openAIResp.Model == "" && info != nil {
		openAIResp.Model = info.OriginModelName
	}
	openAIResp.Status = convertAliStatus(aliResp.Output.TaskStatus)
	openAIResp.CreatedAt = common.GetTimestamp()

	// 返回 OpenAI 格式
	c.JSON(http.StatusOK, openAIResp)

	return aliResp.Output.TaskID, responseBody, nil
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
	var aliResp AliVideoResponse
	if err := common.Unmarshal(respBody, &aliResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	// 状态映射
	switch aliResp.Output.TaskStatus {
	case "PENDING":
		taskResult.Status = model.TaskStatusQueued
	case "RUNNING":
		taskResult.Status = model.TaskStatusInProgress
	case "SUCCEEDED":
		taskResult.Status = model.TaskStatusSuccess
		// 阿里直接返回视频URL，不需要额外的代理端点
		taskResult.Url = aliResp.Output.VideoURL
	case "FAILED", "CANCELED", "UNKNOWN":
		taskResult.Status = model.TaskStatusFailure
		if aliResp.Message != "" {
			taskResult.Reason = aliResp.Message
		} else if aliResp.Output.Message != "" {
			taskResult.Reason = fmt.Sprintf("task failed, code: %s , message: %s", aliResp.Output.Code, aliResp.Output.Message)
		} else {
			taskResult.Reason = "task failed"
		}
	default:
		taskResult.Status = model.TaskStatusQueued
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	var aliResp AliVideoResponse
	if err := common.Unmarshal(task.Data, &aliResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal ali response failed")
	}

	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = task.TaskID
	openAIResp.Status = convertAliStatus(aliResp.Output.TaskStatus)
	openAIResp.Model = task.Properties.OriginModelName
	openAIResp.SetProgressStr(task.Progress)
	openAIResp.CreatedAt = task.CreatedAt
	openAIResp.CompletedAt = task.UpdatedAt

	// 设置视频URL（核心字段）
	openAIResp.SetMetadata("url", aliResp.Output.VideoURL)

	// 错误处理
	if aliResp.Code != "" {
		openAIResp.Error = &dto.OpenAIVideoError{
			Code:    aliResp.Code,
			Message: aliResp.Message,
		}
	} else if aliResp.Output.Code != "" {
		openAIResp.Error = &dto.OpenAIVideoError{
			Code:    aliResp.Output.Code,
			Message: aliResp.Output.Message,
		}
	}

	return common.Marshal(openAIResp)
}

func convertAliStatus(aliStatus string) string {
	switch aliStatus {
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

// AdjustBillingOnComplete 根据阿里返回的 usage 调整计费
// 阿里视频计费公式：费用 = 分辨率价格 × 视频时长(秒) × 分组倍率
// 实际生成的视频时长可能与请求时长不同，需要根据 usage.duration 调整
func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	// 只处理成功状态的任务
	if taskResult.Status != model.TaskStatusSuccess {
		return 0
	}

	// 解析阿里响应获取 usage
	var aliResp AliVideoResponse
	if err := common.Unmarshal(task.Data, &aliResp); err != nil {
		logger.LogError(context.TODO(), fmt.Sprintf("解析阿里视频响应失败: %v", err))
		return 0
	}

	// 如果没有 usage 信息，保持预扣费不变
	if aliResp.Usage == nil {
		return 0
	}

	actualDuration := int(aliResp.Usage.Duration)
	if actualDuration <= 0 {
		return 0
	}

	// 获取预扣费时的请求时长
	requestedDuration := 5 // 默认5秒
	if task.PrivateData.BillingContext != nil && task.PrivateData.BillingContext.OtherRatios != nil {
		if seconds, ok := task.PrivateData.BillingContext.OtherRatios["seconds"]; ok && seconds > 0 {
			requestedDuration = int(seconds)
		}
	}

	// 如果实际时长与请求时长相同，无需调整
	if actualDuration == requestedDuration {
		logger.LogInfo(context.TODO(), fmt.Sprintf(
			"任务 %s 视频时长与预估一致: %d秒，无需调整计费",
			task.TaskID, actualDuration,
		))
		return 0
	}

	// 计算实际应扣额度
	// 公式：实际额度 = 预扣额度 × (实际时长 / 请求时长)
	preConsumedQuota := task.Quota
	actualQuota := int(float64(preConsumedQuota) * float64(actualDuration) / float64(requestedDuration))

	if actualDuration < requestedDuration {
		logger.LogInfo(context.TODO(), fmt.Sprintf(
			"任务 %s 视频时长缩短: %d秒 → %d秒，应退还: %s",
			task.TaskID, requestedDuration, actualDuration,
			logger.FormatQuota(preConsumedQuota-actualQuota),
		))
	} else {
		logger.LogInfo(context.TODO(), fmt.Sprintf(
			"任务 %s 视频时长增加: %d秒 → %d秒，应补扣: %s",
			task.TaskID, requestedDuration, actualDuration,
			logger.FormatQuota(actualQuota-preConsumedQuota),
		))
	}

	return actualQuota
}
