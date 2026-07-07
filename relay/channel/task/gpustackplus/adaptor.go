// Package gpustackplus 实现「GPUStackPlus」任务渠道:对接二次开发 GPUStack 的
// LightX2V 内置后端异步门面(/v1/videos,2026-07-06 上线,见 gpustack 仓
// docs/lightx2v-backend-design.md §6.0 与 docs/lightx2v-m4-m5-handover.md)。
//
// 门面契约(GPUStack server,非直连引擎):
//
//	POST {base}/v1/videos        body: {model(必填), task_type, prompt, user_id,
//	                                    image(URL 或 base64/data-uri), ...引擎可选参数}
//	                             → {task_id, status, model, task_type, nfs_path, error, error_type}
//	GET  {base}/v1/videos/{id}   → 同上;status ∈ queued/assigned/running/done/failed/canceled;
//	                               done 时 nfs_path 为成品在共享 SFS 上的绝对路径
//
// 关键约定:
//   - save_result_path / image_path 等引擎原生路径字段是门面的 engine-owned 字段,
//     外部传入会被剥掉——路径由门面统一 dictates 并自建父目录,new-api 不再拼路径
//     也不再 mkdir,完成后从状态响应读 nfs_path 交给落盘钩子搬 OBS;
//   - 图片输入走 "image" 字段(URL 直透 / base64 由门面持久化到 SFS inputs/ 再喂引擎);
//   - 除保留字段外的请求参数(negative_prompt/seed/target_video_length 等)原样透传,
//     门面转交引擎,校验归上游(new-api 侧 metadata 即此通道)。
package gpustackplus

import (
	"bytes"
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
	"github.com/QuantumNous/new-api/relay/channel/gpustackplus/nfsinput"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/mediastore"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// new-api 侧当前支持的 task_type。门面 _VALID_TASK_TYPES 还含 s2v(音频驱动),但
// new-api 尚未接线音频输入物化(音频只能从 metadata 来,会被 legacyInputKeys 剥掉),
// 故此处不含 s2v —— 显式 400,避免静默丢音频(§N1 复审)。接 s2v 时:在 materialize
// 里把音频落 input_refs.audio,再把 s2v 加回本表。
var validTaskTypes = map[string]bool{
	"t2i": true, "i2i": true, "t2v": true, "i2v": true, "flf2v": true,
}

// legacyInputKeys 旧的原始输入 / 引擎原生路径字段:输入统一走 input_refs,这些键
// 若从 metadata 混进 body,门面会因"检测到原始输入字段"整单 400,故播种后剥掉。
// 与门面 _INPUT_FIELDS + _ENGINE_OWNED_FIELDS 对齐。
var legacyInputKeys = map[string]bool{
	"image": true, "last_frame": true, "image_mask": true, "audio": true,
	"image_path": true, "last_frame_path": true, "image_mask_path": true,
	"audio_path": true, "video_path": true, "save_result_path": true,
}

// localBadRequest 构造本地 400 skip-retry 错误:BuildRequestBody 里的输入校验 /
// 物化失败(URL 下不到、非法 task_type 等)属客户端问题,不应触发跨渠道重试。
// relay_task.go 识别 *types.NewAPIError 并转成 LocalError 的 TaskError。
func localBadRequest(err error) *types.NewAPIError {
	return types.NewErrorWithStatusCode(
		err, types.ErrorCodeInvalidRequest, http.StatusBadRequest,
		types.ErrOptionWithSkipRetry(),
	)
}

// submitResponse 门面提交接口返回(_public 形态,提交时 nfs_path 恒为 null)。
type submitResponse struct {
	TaskID string `json:"task_id"`
	Status string `json:"status"`
}

// statusResponse 门面状态接口返回(_public 形态)。
type statusResponse struct {
	TaskID    string `json:"task_id"`
	Status    string `json:"status"`
	NFSPath   string `json:"nfs_path"`
	Error     string `json:"error"`
	ErrorType string `json:"error_type"`
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
	// 成品只落 SFS(nfs_path),必须经 OBS 才能对外提供 URL——存储关闭时提前拒绝,
	// 不占用 GPU 渲染一个交付不出去的成品。
	if !mediastore.Enabled() {
		return service.TaskErrorWrapper(
			fmt.Errorf("媒体存储(OBS)未启用,gpustackplus 渠道无法对外提供成品 URL,请先在系统设置启用"),
			"media_storage_disabled", http.StatusServiceUnavailable)
	}
	if taskErr := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate); taskErr != nil {
		return taskErr
	}
	// 若超管为该模型配置了尺寸/时长白名单(系统设置→视频模型配置),按配置校验;
	// 未配置则不加限制。此处早于模型映射,用请求里的公开 model 名做 key。参数错误
	// 归为本地 400(不重试、不误标渠道故障)。
	// 配置按公开模型名键控(体验区用选中的公开名读它),映射不改 OriginModelName;
	// 故只用公开名做 key,与映射时机无关。
	if req, err := relaycommon.GetTaskRequest(c); err == nil {
		if verr := common.ValidateVideoParamsForModel(req.Size, req.Duration, req.Seconds,
			req.Model, info.OriginModelName); verr != nil {
			return service.TaskErrorWrapperLocal(verr, "invalid_request", http.StatusBadRequest)
		}
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	// 视频经任务子系统走异步门面;图片走同步 relay,另行接入。
	return fmt.Sprintf("%s/v1/videos", a.baseURL), nil
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

	modelName := firstNonEmpty(info.UpstreamModelName, req.Model, info.OriginModelName)
	if modelName == "" {
		return nil, fmt.Errorf("model is required (渠道模型映射与请求 model 均为空)")
	}

	// OpenAI /v1/videos 风格用 input_reference 传条件图;公共校验只归一化了
	// image→Images,这里补上,否则合法的 i2v 请求会被下方防呆误拒。
	if !req.HasImage() && strings.TrimSpace(req.InputReference) != "" {
		req.Images = []string{req.InputReference}
	}

	// 引擎可识别的可选参数(negative_prompt / seed / target_video_length /
	// aspect_ratio 等)经 metadata 整体透传;门面会剥掉 engine-owned 字段,
	// 下面的保留字段随后覆盖同名键,防止篡改核心语义。
	//
	// 白名单加固:若该模型配了尺寸/时长白名单,剔除 metadata 里对应维度的引擎原生
	// 别名键(如 target_video_length / aspect_ratio),否则客户端可绕过顶层 size/
	// duration 的校验,用 metadata 直接注入被禁值。被锁维度只允许走(已校验的)顶层字段。
	allowedSizes, allowedDurations, _ := common.VideoParamsAllowedForModel(req.Model, info.OriginModelName)
	sizeLocked := len(allowedSizes) > 0
	durationLocked := len(allowedDurations) > 0
	body := make(map[string]any, len(req.Metadata)+8)
	for k, v := range req.Metadata {
		lk := strings.ToLower(strings.TrimSpace(k))
		if durationLocked && durationOverrideKeys[lk] {
			continue
		}
		if sizeLocked && sizeOverrideKeys[lk] {
			continue
		}
		body[k] = v
	}
	// 剥掉遗留输入 / 引擎路径字段(§N4):输入统一走 input_refs,残留会被门面整单拒。
	for k := range body {
		if legacyInputKeys[strings.ToLower(strings.TrimSpace(k))] {
			delete(body, k)
		}
	}
	body["model"] = modelName
	body["prompt"] = req.Prompt
	// user_id 用字符串:与 NFS 输入路径的 <user_id> 段一致,门面校验 parent_dir_name == user_id。
	body["user_id"] = fmt.Sprintf("%d", info.UserId)
	if _, ok := body["task_type"]; !ok {
		body["task_type"] = inferTaskType(modelName)
	}
	// 转发已校验的顶层 size:同时给 size 与由它换算的 aspect_ratio,兼容不同引擎读法。
	// size 被锁定时上面已剔除 metadata 的同类别名,这里的规范值即唯一来源(不退化、不绕过)。
	if s := strings.TrimSpace(req.Size); s != "" {
		body["size"] = s
		if ar := common.AspectRatioFromSize(s); ar != "" {
			body["aspect_ratio"] = ar
		}
	}
	taskType, _ := body["task_type"].(string)
	// task_type 白名单校验(§N2):它可能来自 metadata,非法值既会让 NFS 写盘路径异常,
	// 也会被门面拒;就地本地 400,不进后续物化 / 提交。
	if !validTaskTypes[taskType] {
		return nil, localBadRequest(fmt.Errorf("不支持的 task_type: %q(允许:t2i/i2i/t2v/i2v/flf2v;s2v 音频驱动暂未接线)", taskType))
	}
	// 输入兼容性防呆必须在物化之前(§N2 复审):否则 t2v/t2i 带图、flf2v 只给 1 张等非法
	// 组合会先把图写到 NFS 再被拒,留下孤儿输入文件。这些检查只依赖 taskType / req,不需物化。
	if imageRequiredTaskTypes[taskType] && !req.HasImage() {
		return nil, localBadRequest(fmt.Errorf("模型 %s 的任务类型 %s 需要图片输入,必须提供 image/input_reference", modelName, taskType))
	}
	if textOnlyTaskTypes[taskType] && req.HasImage() {
		return nil, localBadRequest(fmt.Errorf("模型 %s 的任务类型 %s 不接受图片输入;图生视频请改用 i2v 模型(如 wan2.2-i2v)", modelName, taskType))
	}
	if taskType == "flf2v" && len(req.Images) < 2 {
		return nil, localBadRequest(fmt.Errorf("模型 %s 的任务类型 flf2v(首尾帧)需要首帧和尾帧两张图:请提供 images=[首帧,尾帧]", modelName))
	}
	if req.HasImage() {
		// 输入图统一物化落 NFS,发 input_refs 相对路径(不再发 base64/URL 给门面,方案见
		// gpustack 仓 docs/lightx2v-nfs-input-design.md)。物化顺序:先写全部输入 → 再提交。
		// 首尾帧(flf2v):images[0]=首帧→image,images[1]=尾帧→last_frame;其余(i2v/s2v)只取首帧。
		refs, err := materializeVideoInputs(c, info, taskType, modelName, req)
		if err != nil {
			// URL 下不到 / SSRF 拒 / 写盘失败:本地 400 skip-retry,不触发跨渠道重试(§N3)。
			return nil, localBadRequest(err)
		}
		body["input_refs"] = refs
	}
	// OpenAI 风格 duration/seconds → wan 帧数约定(4n+1,16fps:5s → 81 帧)。
	durationSec := req.Duration
	if durationSec == 0 && strings.TrimSpace(req.Seconds) != "" {
		if v, convErr := strconv.Atoi(strings.TrimSpace(req.Seconds)); convErr == nil {
			durationSec = v
		}
	}
	if durationSec > 0 {
		if _, ok := body["target_video_length"]; !ok {
			body["target_video_length"] = durationSec*16 + 1
		}
	}

	data, err := common.Marshal(body)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_request_body_failed")
	}
	return bytes.NewReader(data), nil
}

// 门面 task_type 的输入约束(与 gpustack routes/videos.py 的 _VALID_TASK_TYPES 对应)。
var imageRequiredTaskTypes = map[string]bool{"i2v": true, "flf2v": true, "i2i": true}
var textOnlyTaskTypes = map[string]bool{"t2v": true, "t2i": true}

// 被白名单锁定的维度对应的引擎原生别名键——metadata 里这些键会绕过顶层 size/
// duration 校验,锁定时需从透传体里剔除(小写匹配)。
var durationOverrideKeys = map[string]bool{
	"target_video_length": true, "video_length": true, "num_frames": true, "frames": true,
}
var sizeOverrideKeys = map[string]bool{
	"aspect_ratio": true, "size": true, "resolution": true,
	"width": true, "height": true, "target_width": true, "target_height": true,
}

// inferTaskType 按模型名推断门面 task_type;显式 metadata.task_type 优先于此推断。
func inferTaskType(modelName string) string {
	m := strings.ToLower(modelName)
	switch {
	case strings.Contains(m, "flf2v"):
		return "flf2v"
	case strings.Contains(m, "i2v"):
		return "i2v"
	case strings.Contains(m, "edit") || strings.Contains(m, "i2i"):
		return "i2i"
	case strings.Contains(m, "t2i"):
		return "t2i"
	default:
		return "t2v"
	}
}

// materializeVideoInputs 把视频链路的输入图统一物化落 NFS,返回 input_refs(field → 相对路径数组)。
// 视频链路为 JSON-only:req.Images 里是 URL 或 base64/data-uri 字符串。
// flf2v:images[0]=首帧(image)、images[1]=尾帧(last_frame);i2v/s2v 只取首帧(image)。
// 用 info.PublicTaskID 作 input-group id,info.UserId 作 <user_id> 段(与门面 user_id 一致)。
func materializeVideoInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) (map[string][]string, error) {
	if len(req.Images) == 0 {
		return nil, fmt.Errorf("缺少图片输入")
	}
	gid := info.PublicTaskID
	if strings.TrimSpace(gid) == "" {
		gid = common.GetUUID()
	}
	m := nfsinput.NewMaterializer(taskType, modelName, fmt.Sprintf("%d", info.UserId), gid)
	ctx := c.Request.Context()

	// 首帧(image),单值。多输入中途失败时回滚已写文件,避免孤儿(§N2 复审)。
	if err := m.AddString(ctx, nfsinput.FieldImage, 0, false, req.Images[0]); err != nil {
		m.Cleanup()
		return nil, err
	}
	// flf2v 尾帧(last_frame),单值。
	if taskType == "flf2v" {
		if len(req.Images) < 2 {
			m.Cleanup()
			return nil, fmt.Errorf("模型 %s 的任务类型 flf2v(首尾帧)需要首帧和尾帧两张图", modelName)
		}
		if err := m.AddString(ctx, nfsinput.FieldLastFrame, 0, false, req.Images[1]); err != nil {
			m.Cleanup()
			return nil, err
		}
	}
	return m.Refs(), nil
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

	// 返回给客户端 OpenAI 兼容 video 对象(用公开 task_xxxx ID)。
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
	uri := fmt.Sprintf("%s/v1/videos/%s", strings.TrimRight(baseUrl, "/"), taskID)
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

	// 门面状态机:queued(排队/等重派)→ assigned(已派发实例)→ running → done;
	// failed/canceled 终态。旧引擎态(pending/processing/completed)保留兼容。
	switch strings.ToLower(strings.TrimSpace(sr.Status)) {
	case "queued", "assigned", "pending", "submitted":
		ti.Status = model.TaskStatusQueued
	case "running", "processing", "in_progress":
		ti.Status = model.TaskStatusInProgress
	case "done", "completed", "succeed", "success":
		ti.Status = model.TaskStatusSuccess
		// 关键:把成品在 SFS 上的绝对路径交给落盘钩子(显式 nfs_path,非启发式)。
		ti.NFSPath = sr.NFSPath
	case "failed", "cancelled", "canceled", "error":
		ti.Status = model.TaskStatusFailure
		ti.Reason = firstNonEmpty(sr.Error, sr.ErrorType, "task failed")
	default:
		// 未知/空状态:保持排队,交后续轮询与超时兜底,避免误杀刚提交的任务。
		if strings.TrimSpace(sr.Status) != "" {
			common.SysLog(fmt.Sprintf("[gpustackplus] unrecognized task status %q, body: %s", sr.Status, string(respBody)))
		}
		ti.Status = model.TaskStatusQueued
	}
	return ti, nil
}

// ConvertToOpenAIVideo 供 /v1/videos/:id 查询走 OpenAI 兼容格式;url metadata 里的
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

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
