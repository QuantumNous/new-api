package happyhorse

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
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

// TaskAdaptor HappyHorse 视频生成适配器
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

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s%s", a.baseURL, TextToVideoEndpoint), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	upstreamModel := taskReq.Model
	if info.IsModelMapped {
		upstreamModel = info.UpstreamModelName
	}

	videoReq := VideoRequest{
		Model:  upstreamModel,
		Prompt: taskReq.Prompt,
	}

	// 从 metadata 中提取额外参数
	if taskReq.Metadata != nil {
		if v, ok := taskReq.Metadata["resolution"].(string); ok {
			videoReq.Resolution = v
		}
		if v, ok := taskReq.Metadata["ratio"].(string); ok {
			videoReq.Ratio = v
		}
	}

	// duration
	if taskReq.Duration > 0 {
		videoReq.Duration = taskReq.Duration
	} else if sec, _ := strconv.Atoi(taskReq.Seconds); sec > 0 {
		videoReq.Duration = sec
	} else {
		videoReq.Duration = DefaultDuration
	}

	// 默认值
	if videoReq.Resolution == "" {
		videoReq.Resolution = Resolution720P
	}
	if videoReq.Ratio == "" {
		videoReq.Ratio = "16:9"
	}

	// 图片 → media 数组 (I2V)
	if taskReq.HasImage() {
		for _, imgURL := range taskReq.Images {
			videoReq.Media = append(videoReq.Media, MediaItem{
				Type: "first_frame",
				URL:  imgURL,
			})
		}
	}

	// 从 metadata 中读取 media（支持 R2V 的 reference_image）
	if taskReq.Metadata != nil {
		if mediaRaw, ok := taskReq.Metadata["media"]; ok {
			if mediaSlice, ok := mediaRaw.([]interface{}); ok {
				for _, m := range mediaSlice {
					if mMap, ok := m.(map[string]interface{}); ok {
						item := MediaItem{}
						if t, ok := mMap["type"].(string); ok {
							item.Type = t
						}
						if u, ok := mMap["url"].(string); ok {
							item.URL = u
						}
						if item.URL != "" {
							videoReq.Media = append(videoReq.Media, item)
						}
					}
				}
			}
		}
	}

	data, err := common.Marshal(videoReq)
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
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var sResp VideoResponse
	if err := common.Unmarshal(responseBody, &sResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if sResp.Data == nil || sResp.Data.TaskID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty, body: %s", responseBody), "invalid_response", http.StatusInternalServerError)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	ov.Status = "pending"

	c.JSON(http.StatusOK, ov)
	return sResp.Data.TaskID, responseBody, nil
}

// EstimateBilling 根据用户请求参数计算 OtherRatios（时长、分辨率）。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}

	seconds := taskReq.Duration
	if seconds <= 0 {
		seconds = DefaultDuration
	}

	otherRatios := map[string]float64{
		"seconds": float64(seconds),
	}

	return otherRatios
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	modelName, _ := body["model"].(string)
	uri := fmt.Sprintf("%s%s/%s", baseUrl, QueryTaskEndpoint, taskID)
	if modelName != "" {
		uri = fmt.Sprintf("%s?model=%s", uri, modelName)
	}

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

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var resp QueryTaskResponse
	if err := common.Unmarshal(respBody, &resp); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	switch resp.Status {
	case TaskStatusPending:
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = "10%"
	case TaskStatusRunning:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "50%"
	case TaskStatusSucceeded:
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		if len(resp.Data) > 0 {
			var dataItem struct {
				URL string `json:"url"`
			}
			if err := common.Unmarshal(resp.Data[0], &dataItem); err == nil && dataItem.URL != "" {
				taskResult.Url = dataItem.URL
			}
		}
	case TaskStatusFailed:
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		if resp.Error != nil {
			taskResult.Reason = resp.Error.Message
		} else {
			taskResult.Reason = "task failed"
		}
	default:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var resp QueryTaskResponse
	if err := common.Unmarshal(originTask.Data, &resp); err != nil {
		ov := dto.NewOpenAIVideo()
		ov.ID = originTask.TaskID
		ov.TaskID = originTask.TaskID
		ov.Status = originTask.Status.ToVideoStatus()
		ov.Model = originTask.Properties.OriginModelName
		return common.Marshal(ov)
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = originTask.TaskID
	ov.TaskID = originTask.TaskID
	ov.Status = originTask.Status.ToVideoStatus()
	ov.Model = originTask.Properties.OriginModelName

	if resp.Status == TaskStatusSucceeded && len(resp.Data) > 0 {
		var dataItem struct {
			URL string `json:"url"`
		}
		if err := common.Unmarshal(resp.Data[0], &dataItem); err == nil && dataItem.URL != "" {
			ov.SetMetadata("url", dataItem.URL)
		}
	}

	if resp.Status == TaskStatusFailed && resp.Error != nil {
		ov.Error = &dto.OpenAIVideoError{
			Message: resp.Error.Message,
			Code:    resp.Error.Code,
		}
	}

	return common.Marshal(ov)
}


