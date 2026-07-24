package xai

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
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
)

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
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionTextGenerate)
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/videos/generations", a.baseURL), nil
}

// EstimateBilling returns OtherRatios based on duration seconds.
// xAI video currently reuses the per-call model price as the per-second price.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, _ *relaycommon.RelayInfo) map[string]float64 {
	v, ok := c.Get("task_request")
	if !ok {
		return nil
	}
	req, ok := v.(relaycommon.TaskSubmitReq)
	if !ok {
		return nil
	}

	// 1.获取视频时长
	actualSeconds := ResolveDurationSeconds(req.Metadata, req.Duration, req.Seconds)
	if actualSeconds <= 0 {
		actualSeconds = 1
	}
	// 2. 获取分辨率
	resolution := ResolveResolution(req.Metadata, req.Size)

	// 3. 决定分辨率倍率
	resMultiplier := 1.0 // 默认倍率
	if strings.Contains(resolution, "480") {
		resMultiplier = 0.5 // 0.1 * 0.5 = 0.05
	} else if strings.Contains(resolution, "720") {
		resMultiplier = 0.7 // 0.1 * 0.7 = 0.07
	} else if strings.Contains(resolution, "1080") {
		// 假设你以后想加 1080p 是 $0.1/秒
		resMultiplier = 1.0
	}
	// 4. 统计图片数量并计算图片计费单位
	// 统计普通请求里的图片
	imageCount := len(req.Images)

	// 如果有文件上传形式的图片，也算一张
	// (参考你代码里的 ExtractMultipartImageURL 逻辑)
	if imageURL := ExtractMultipartImageURL(c, nil); imageURL != "" {
		imageCount++
	}

	// 每张图 $0.002，基准 $0.1，所以每张图合 0.02 个单位
	imageBillingUnits := float64(imageCount) * 0.02

	// 计算总倍率 计费价格是每秒
	totalUnits := (float64(actualSeconds) * resMultiplier) + imageBillingUnits

	return map[string]float64{
		"total_units": totalUnits,
	}
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	v, ok := c.Get("task_request")
	if !ok {
		return nil, fmt.Errorf("request not found in context")
	}
	req, ok := v.(relaycommon.TaskSubmitReq)
	if !ok {
		return nil, fmt.Errorf("unexpected task_request type")
	}

	meta := &requestMetadata{}
	if err := taskcommon.UnmarshalMetadata(req.Metadata, meta); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}

	duration := ResolveDurationSeconds(req.Metadata, req.Duration, req.Seconds)
	if meta.Duration != nil && *meta.Duration > 0 {
		duration = *meta.Duration
	}

	aspectRatio := ResolveAspectRatio(req.Metadata, req.Size)
	if strings.TrimSpace(meta.AspectRatio) != "" {
		aspectRatio = strings.TrimSpace(meta.AspectRatio)
	}

	resolution := ResolveResolution(req.Metadata, req.Size)
	if strings.TrimSpace(meta.Resolution) != "" {
		resolution = strings.ToLower(strings.TrimSpace(meta.Resolution))
	}

	var imageURL string
	if u := ExtractMultipartImageURL(c, info); u != "" {
		imageURL = u
	} else if len(req.Images) > 0 {
		if u := ParseImageURL(req.Images[0]); u != "" {
			imageURL = u
			info.Action = constant.TaskActionGenerate
		}
	}

	body := VideoGenerationRequest{
		Model:       info.UpstreamModelName,
		Prompt:      req.Prompt,
		Duration:    duration,
		AspectRatio: aspectRatio,
		Resolution:  resolution,
		Seed:        meta.Seed,
	}
	if strings.TrimSpace(imageURL) != "" {
		body.Image = &VideoInputImageURL{URL: imageURL}
	}

	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

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
	if strings.TrimSpace(s.RequestID) == "" {
		return "", nil, service.TaskErrorWrapper(fmt.Errorf("missing request_id"), "invalid_response", http.StatusInternalServerError)
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)

	return s.RequestID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/v1/videos/%s", baseUrl, taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var sr statusResponse
	if err := common.Unmarshal(respBody, &sr); err != nil {
		return nil, fmt.Errorf("unmarshal status response failed: %w", err)
	}

	ti := &relaycommon.TaskInfo{}
	status := strings.ToLower(strings.TrimSpace(sr.Status))
	switch status {
	case "pending", "queued":
		ti.Status = model.TaskStatusQueued
		ti.Progress = taskcommon.ProgressQueued
	case "processing", "in_progress", "generating":
		ti.Status = model.TaskStatusInProgress
		ti.Progress = taskcommon.ProgressInProgress
	case "done", "completed", "success":
		ti.Status = model.TaskStatusSuccess
		ti.Progress = taskcommon.ProgressComplete
		if sr.Video != nil && strings.TrimSpace(sr.Video.URL) != "" {
			ti.Url = strings.TrimSpace(sr.Video.URL)
		}
	case "expired":
		ti.Status = model.TaskStatusFailure
		ti.Progress = taskcommon.ProgressComplete
		ti.Reason = "task expired"
	case "failed", "error":
		ti.Status = model.TaskStatusFailure
		ti.Progress = taskcommon.ProgressComplete
		if sr.Error != nil && strings.TrimSpace(sr.Error.Message) != "" {
			ti.Reason = strings.TrimSpace(sr.Error.Message)
		} else {
			ti.Reason = "task failed"
		}
	default:
		// Unknown status — let caller decide how to handle it
	}
	return ti, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	video := dto.NewOpenAIVideo()
	video.ID = task.TaskID
	video.TaskID = task.TaskID
	video.Model = task.Properties.OriginModelName
	video.Status = task.Status.ToVideoStatus()
	video.SetProgressStr(task.Progress)
	video.CreatedAt = task.CreatedAt
	if task.FinishTime > 0 {
		video.CompletedAt = task.FinishTime
	} else if task.UpdatedAt > 0 {
		video.CompletedAt = task.UpdatedAt
	}
	if task.Status == model.TaskStatusFailure && strings.TrimSpace(task.FailReason) != "" {
		video.Error = &dto.OpenAIVideoError{
			Message: task.FailReason,
			Code:    "task_failed",
		}
	}
	return common.Marshal(video)
}

func (a *TaskAdaptor) GetModelList() []string {
	return []string{"grok-imagine-video"}
}

func (a *TaskAdaptor) GetChannelName() string {
	return "xai"
}
