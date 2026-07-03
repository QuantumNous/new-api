// Package gpustackplus 实现「GPUStackPlus」任务渠道：对接经二次改造的 GPUStack
// （自定义 LightX2V 引擎，增强图片/视频、后续可扩展音频）异步任务 API。
//
// 与原生 GPUStack 的区别：成品统一落共享 SFS（不返回临时外链），任务完成时上游
// 回传 save_result_path（成品在 SFS 上的绝对路径）。本渠道在提交时由 new-api 拼出
// 含 user_id 的 save_result_path（并 mkdir 建目录，new-api 对该 SFS 有写权限），
// 上游据此写文件；轮询完成后把该路径填入 TaskInfo.NFSPath，交由落盘钩子搬 OBS。
//
// 上游契约（LightX2V server）：
//
//	POST {base}/v1/tasks/video/          → {task_id, task_status, save_result_path}
//	GET  {base}/v1/tasks/{id}/status     → {task_id, status, error, error_type, save_result_path}
//	status ∈ pending / processing / completed / failed / cancelled
package gpustackplus

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
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
	"github.com/QuantumNous/new-api/service/mediastore"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// submitResponse LightX2V 提交接口返回。
type submitResponse struct {
	TaskID         string `json:"task_id"`
	TaskStatus     string `json:"task_status"`
	SaveResultPath string `json:"save_result_path"`
}

// statusResponse LightX2V 状态接口返回。
type statusResponse struct {
	TaskID         string `json:"task_id"`
	Status         string `json:"status"`
	Error          string `json:"error"`
	ErrorType      string `json:"error_type"`
	SaveResultPath string `json:"save_result_path"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = strings.TrimRight(info.ChannelBaseUrl, "/")
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	// 成品只落 SFS（nfs_path），必须经 OBS 才能对外提供 URL——存储关闭时提前拒绝，
	// 不占用 GPU 渲染一个交付不出去的成品。
	if !mediastore.Enabled() {
		return service.TaskErrorWrapper(
			fmt.Errorf("媒体存储（OBS）未启用，gpustackplus 渠道无法对外提供成品 URL，请先在系统设置启用"),
			"media_storage_disabled", http.StatusServiceUnavailable)
	}
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	// 目前经任务子系统进入的是视频路径（/v1/videos）。图片走同步 relay，另行接入。
	return fmt.Sprintf("%s/v1/tasks/video/", a.baseURL), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	if a.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_task_request_failed")
	}

	// 由 new-api 拼出含 user_id 的成品绝对路径（§4.2 路径约定），并建好父目录。
	// new-api 对该 SFS 有写权限（成品写仍归上游，new-api 仅建目录）。
	savePath, err := a.buildSaveResultPath(info, &req)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(savePath), 0o755); err != nil {
		return nil, errors.Wrapf(err, "mkdir save_result_path dir failed (new-api 是否已读写挂载 SFS?): %s", filepath.Dir(savePath))
	}

	body := map[string]any{
		"prompt":           req.Prompt,
		"save_result_path": savePath,
	}
	if req.HasImage() {
		body["image_path"] = req.Images[0]
	}
	// 透传上游引擎可识别的可选参数（负向提示词、种子等）放在 metadata 里。
	if neg, ok := req.Metadata["negative_prompt"].(string); ok && neg != "" {
		body["negative_prompt"] = neg
	}
	if seed, ok := req.Metadata["seed"]; ok {
		body["seed"] = seed
	}

	data, err := common.Marshal(body)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_request_body_failed")
	}
	return bytes.NewReader(data), nil
}

// buildSaveResultPath 拼 <root>/<功能>-<模型>/YYYY/MM/DD/<user_id>/<public_task_id>.mp4。
func (a *TaskAdaptor) buildSaveResultPath(info *relaycommon.RelayInfo, req *relaycommon.TaskSubmitReq) (string, error) {
	root := system_setting.GetMediaStorageSettings().NFSRoot()
	feature := "t2v"
	if req.HasImage() {
		feature = "i2v"
	}
	modelSeg := sanitizeSeg(firstNonEmpty(info.OriginModelName, info.UpstreamModelName, "model"))
	taskID := info.PublicTaskID
	if taskID == "" {
		return "", fmt.Errorf("public task id is empty")
	}
	now := time.Now().UTC()
	return filepath.Join(
		root,
		feature+"-"+modelSeg,
		fmt.Sprintf("%04d", now.Year()),
		fmt.Sprintf("%02d", int(now.Month())),
		fmt.Sprintf("%02d", now.Day()),
		fmt.Sprintf("%d", info.UserId),
		taskID+".mp4",
	), nil
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

	var sr submitResponse
	if err := common.Unmarshal(responseBody, &sr); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}
	if sr.TaskID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("upstream task_id is empty, body: %s", responseBody), "invalid_response", http.StatusInternalServerError)
		return
	}

	// 返回给客户端 OpenAI 兼容 video 对象（用公开 task_xxxx ID）。
	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.Model = info.OriginModelName
	ov.CreatedAt = time.Now().Unix()
	c.JSON(http.StatusOK, ov)

	return sr.TaskID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	uri := fmt.Sprintf("%s/v1/tasks/%s/status", strings.TrimRight(baseUrl, "/"), taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var sr statusResponse
	if err := common.Unmarshal(respBody, &sr); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}
	ti := &relaycommon.TaskInfo{Code: 0, TaskID: sr.TaskID}

	switch strings.ToLower(strings.TrimSpace(sr.Status)) {
	case "pending", "queued", "submitted":
		ti.Status = model.TaskStatusQueued
	case "processing", "running", "in_progress":
		ti.Status = model.TaskStatusInProgress
	case "completed", "succeed", "success":
		ti.Status = model.TaskStatusSuccess
		// 关键：把成品在 SFS 上的绝对路径交给落盘钩子（显式 nfs_path，非启发式）。
		ti.NFSPath = sr.SaveResultPath
	case "failed", "cancelled", "canceled", "error":
		ti.Status = model.TaskStatusFailure
		ti.Reason = firstNonEmpty(sr.Error, sr.ErrorType, "task failed")
	default:
		// 未知/空状态：保持排队，交后续轮询与超时兜底，避免误杀刚提交的任务。
		if strings.TrimSpace(sr.Status) != "" {
			common.SysLog(fmt.Sprintf("[gpustackplus] unrecognized task status %q, body: %s", sr.Status, string(respBody)))
		}
		ti.Status = model.TaskStatusQueued
	}
	return ti, nil
}

// ConvertToOpenAIVideo 供 /v1/videos/:id 查询走 OpenAI 兼容格式；url metadata 里的
// 结果链接由 model.Task.ToOpenAIVideo 经 ResolveResultURL 实时签成 OBS URL。
func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	ov := task.ToOpenAIVideo()
	data, err := common.Marshal(ov)
	if err != nil {
		return nil, errors.Wrap(err, "marshal openai video failed")
	}
	return data, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func sanitizeSeg(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	s = strings.ReplaceAll(s, " ", "_")
	if s == "" {
		return "model"
	}
	return s
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
