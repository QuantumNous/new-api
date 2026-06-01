package blockrunvideo

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
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// Request / Response structures
// ============================

// requestPayload 是发往 api2 (BlockRun proxy) 创建接口的请求体。
// 仅包含 proxy 真正会读取并转发的字段(见对接文档):
// model / prompt / seconds / resolution / ratio / image_url。
// watermark、seed、generateAudio 等参数 proxy 不转发,故不发送。
type requestPayload struct {
	Model      string `json:"model"`
	Prompt     string `json:"prompt,omitempty"`
	Seconds    string `json:"seconds,omitempty"`
	Resolution string `json:"resolution,omitempty"`
	Ratio      string `json:"ratio,omitempty"`
	ImageURL   string `json:"image_url,omitempty"`
}

// responseTask 是创建/查询接口的响应体。
// 注意:api2 失败时 error 是【字符串】而非对象,故此处用 string。
type responseTask struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	Progress int    `json:"progress"`
	URL      string `json:"url"`
	Data     []struct {
		URL string `json:"url"`
	} `json:"data"`
	Error     string `json:"error"`
	CreatedAt int64  `json:"created_at"`
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
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

// BuildRequestURL 创建任务: POST {baseURL}/v1/video/generations
func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/video/generations", a.baseURL), nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	body, err := a.convertToRequestPayload(&req)
	if err != nil {
		return nil, errors.Wrap(err, "convert request payload failed")
	}
	if info.IsModelMapped {
		body.Model = info.UpstreamModelName
	} else {
		info.UpstreamModelName = body.Model
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq) (*requestPayload, error) {
	r := requestPayload{
		Model:      req.Model,
		Prompt:     req.Prompt,
		Resolution: req.Resolution,
		Ratio:      req.Ratio,
	}

	// 时长(秒):取顶层 duration。
	if req.Duration > 0 {
		r.Seconds = strconv.Itoa(req.Duration)
	}

	// 图生视频:取第一张输入图。
	if req.HasImage() {
		r.ImageURL = req.Images[0]
	}

	return &r, nil
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

	var dResp responseTask
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	// 创建成功必须拿到 id;若上游同时回了 error/failed(如即时校验拒绝),
	// 也视为创建失败,避免白白进入轮询并占用预扣额。
	if dResp.ID == "" || dResp.Error != "" || dResp.Status == "failed" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("create task failed, body=%s", responseBody), "invalid_response", http.StatusBadGateway)
		return
	}

	// 用公开 task_xxxx ID 返回给客户端,不暴露上游 video_xxx。
	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return dResp.ID, responseBody, nil
}

// FetchTask 查询任务: GET {baseURL}/v1/video/generations/{id}
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/v1/video/generations/%s", baseUrl, taskID)
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

// ExtractUpstreamVideoURL 从持久化在 task.Data 的上游响应里解析真实视频地址
// (顶层 url,回退 data[0].url)。白标场景下客户拿到的是代理地址,真实地址只在
// 服务端由 controller.VideoProxy 用此函数取回。无法解析时返回 ""。
func ExtractUpstreamVideoURL(taskData []byte) string {
	if len(taskData) == 0 {
		return ""
	}
	var rt responseTask
	if err := common.Unmarshal(taskData, &rt); err != nil {
		return ""
	}
	return resultURL(rt)
}

// resultURL 返回上游响应里的视频地址:优先顶层 url,回退 data[0].url,无则 ""。
func resultURL(rt responseTask) string {
	if rt.URL != "" {
		return rt.URL
	}
	if len(rt.Data) > 0 {
		return rt.Data[0].URL
	}
	return ""
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var rt responseTask
	if err := common.Unmarshal(respBody, &rt); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	info := &relaycommon.TaskInfo{Code: 0}
	switch rt.Status {
	case "queued", "pending":
		info.Status = model.TaskStatusQueued
		info.Progress = "10%"
	case "in_progress", "processing", "running":
		info.Status = model.TaskStatusInProgress
		if rt.Progress > 0 && rt.Progress < 100 {
			info.Progress = fmt.Sprintf("%d%%", rt.Progress)
		} else {
			info.Progress = "50%"
		}
	case "completed", "succeeded":
		info.Status = model.TaskStatusSuccess
		info.Progress = "100%"
		info.Url = resultURL(rt)
	case "failed", "cancelled":
		info.Status = model.TaskStatusFailure
		info.Progress = "100%"
		info.Reason = rt.Error
	default:
		// 无可识别状态:若带 error(如 "task not found"),视为失败以触发结算/退款;
		// 否则保持进行中,等待下一轮轮询(api2 在 ~300s 内必达终态)。
		if rt.Error != "" {
			info.Status = model.TaskStatusFailure
			info.Progress = "100%"
			info.Reason = rt.Error
		} else {
			info.Status = model.TaskStatusInProgress
			info.Progress = "30%"
		}
	}
	return info, nil
}

// ConvertToOpenAIVideo 构造返回给客户端的视频对象。
// 白标:成功时 metadata.url 用代理地址(originTask.GetResultURL,已在轮询成功时
// 被设为 /v1/videos/{task_id}/content),绝不返回上游 blockrun.ai 真实地址;
// 失败时错误信息经 ScrubBrandedText 脱敏。
func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	ov := dto.NewOpenAIVideo()
	ov.ID = originTask.TaskID
	ov.TaskID = originTask.TaskID
	ov.Status = originTask.Status.ToVideoStatus()
	ov.SetProgressStr(originTask.Progress)
	ov.CreatedAt = originTask.CreatedAt
	ov.CompletedAt = originTask.UpdatedAt
	ov.Model = originTask.Properties.OriginModelName

	if originTask.Status == model.TaskStatusSuccess {
		ov.SetMetadata("url", originTask.GetResultURL())
	}
	if originTask.Status == model.TaskStatusFailure {
		ov.Error = &dto.OpenAIVideoError{
			Message: taskcommon.ScrubBrandedText(originTask.FailReason),
		}
	}

	return common.Marshal(ov)
}
