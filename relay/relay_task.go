package relay

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

type TaskSubmitResult struct {
	UpstreamTaskID string
	TaskData       []byte
	Platform       constant.TaskPlatform
	Quota          int
	//PerCallPrice   types.PriceData
}

// ResolveOriginTask 处理基于已有任务的提交（remix / continuation）：
// 查找原始任务、从中提取模型名称、将渠道锁定到原始任务的渠道
// （通过 info.LockedChannel，重试时复用同一渠道并轮换 key），
// 以及提取 OtherRatios（时长、分辨率）。
// 该函数在控制器的重试循环之前调用一次，其结果通过 info 字段和上下文持久化。
func ResolveOriginTask(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	// 检测 remix action
	path := c.Request.URL.Path
	if strings.Contains(path, "/v1/videos/") && strings.HasSuffix(path, "/remix") {
		info.Action = constant.TaskActionRemix
	}

	// 提取 remix 任务的 video_id
	if info.Action == constant.TaskActionRemix {
		videoID := c.Param("video_id")
		if strings.TrimSpace(videoID) == "" {
			return service.TaskErrorWrapperLocal(fmt.Errorf("video_id is required"), "invalid_request", http.StatusBadRequest)
		}
		info.OriginTaskID = videoID
	}

	if info.OriginTaskID == "" {
		return nil
	}

	// 查找原始任务
	originTask, exist, err := model.GetByTaskId(info.UserId, info.OriginTaskID)
	if err != nil {
		return service.TaskErrorWrapper(err, "get_origin_task_failed", http.StatusInternalServerError)
	}
	if !exist {
		return service.TaskErrorWrapperLocal(errors.New("task_origin_not_exist"), "task_not_exist", http.StatusBadRequest)
	}

	// 从原始任务推导模型名称
	if info.OriginModelName == "" {
		if originTask.Properties.OriginModelName != "" {
			info.OriginModelName = originTask.Properties.OriginModelName
		} else if originTask.Properties.UpstreamModelName != "" {
			info.OriginModelName = originTask.Properties.UpstreamModelName
		} else {
			var taskData map[string]interface{}
			_ = common.Unmarshal(originTask.Data, &taskData)
			if m, ok := taskData["model"].(string); ok && m != "" {
				info.OriginModelName = m
			}
		}
	}

	// 锁定到原始任务的渠道（重试时复用同一渠道，轮换 key）
	ch, err := model.GetChannelById(originTask.ChannelId, true)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "channel_not_found", http.StatusBadRequest)
	}
	if ch.Status != common.ChannelStatusEnabled {
		return service.TaskErrorWrapperLocal(errors.New("the channel of the origin task is disabled"), "task_channel_disable", http.StatusBadRequest)
	}
	info.LockedChannel = ch

	if originTask.ChannelId != info.ChannelId {
		key, _, newAPIError := ch.GetNextEnabledKey()
		if newAPIError != nil {
			return service.TaskErrorWrapper(newAPIError, "channel_no_available_key", newAPIError.StatusCode)
		}
		common.SetContextKey(c, constant.ContextKeyChannelKey, key)
		common.SetContextKey(c, constant.ContextKeyChannelType, ch.Type)
		common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, ch.GetBaseURL())
		common.SetContextKey(c, constant.ContextKeyChannelId, originTask.ChannelId)

		info.ChannelBaseUrl = ch.GetBaseURL()
		info.ChannelId = originTask.ChannelId
		info.ChannelType = ch.Type
		info.ApiKey = key
	}

	// 提取 remix 参数（时长、分辨率 → OtherRatios）
	if info.Action == constant.TaskActionRemix {
		if originTask.PrivateData.BillingContext != nil {
			// 新的 remix 逻辑：直接从原始任务的 BillingContext 中提取 OtherRatios（如果存在）
			for s, f := range originTask.PrivateData.BillingContext.OtherRatios {
				info.PriceData.AddOtherRatio(s, f)
			}
		} else {
			// 旧的 remix 逻辑：直接从 task data 解析 seconds 和 size（如果存在）
			var taskData map[string]interface{}
			_ = common.Unmarshal(originTask.Data, &taskData)
			secondsStr, _ := taskData["seconds"].(string)
			seconds, _ := strconv.Atoi(secondsStr)
			if seconds <= 0 {
				seconds = 4
			}
			sizeStr, _ := taskData["size"].(string)
			if info.PriceData.OtherRatios == nil {
				info.PriceData.OtherRatios = map[string]float64{}
			}
			info.PriceData.OtherRatios["seconds"] = float64(seconds)
			info.PriceData.OtherRatios["size"] = 1
			if sizeStr == "1792x1024" || sizeStr == "1024x1792" {
				info.PriceData.OtherRatios["size"] = 1.666667
			}
		}
	}

	return nil
}

// RelayTaskSubmit 完成 task 提交的全部流程（每次尝试调用一次）：
// 刷新渠道元数据 → 确定 platform/adaptor → 验证请求 →
// 估算计费(EstimateBilling) → 计算价格 → 预扣费（仅首次）→
// 构建/发送/解析上游请求 → 提交后计费调整(AdjustBillingOnSubmit)。
// 控制器负责 defer Refund 和成功后 Settle。
func RelayTaskSubmit(c *gin.Context, info *relaycommon.RelayInfo) (*TaskSubmitResult, *dto.TaskError) {
	info.InitChannelMeta(c)

	// 1. 确定 platform → 创建适配器 → 验证请求
	platform := constant.TaskPlatform(c.GetString("platform"))
	if platform == "" {
		platform = GetTaskPlatform(c)
	}
	adaptor := GetTaskAdaptor(platform)
	if adaptor == nil {
		return nil, service.TaskErrorWrapperLocal(fmt.Errorf("invalid api platform: %s", platform), "invalid_api_platform", http.StatusBadRequest)
	}
	adaptor.Init(info)
	if taskErr := adaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
		return nil, taskErr
	}

	// 2. 确定模型名称
	modelName := info.OriginModelName
	if modelName == "" {
		modelName = service.CoverTaskActionToModelName(platform, info.Action)
	}

	// 2.5 应用渠道的模型映射（与同步任务对齐）
	info.OriginModelName = modelName
	info.UpstreamModelName = modelName
	if err := helper.ModelMappedHelper(c, info, nil); err != nil {
		return nil, service.TaskErrorWrapperLocal(err, "model_mapping_failed", http.StatusBadRequest)
	}

	// 3. 预生成公开 task ID（仅首次）
	if info.PublicTaskID == "" {
		info.PublicTaskID = model.GenerateTaskID()
	}

	// 4. 价格计算：基础模型价格
	info.OriginModelName = modelName
	priceData, err := helper.ModelPriceHelperPerCall(c, info)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "model_price_error", http.StatusBadRequest)
	}
	info.PriceData = priceData

	// 5. 计费估算：让适配器根据用户请求提供 OtherRatios（时长、分辨率等）
	//    必须在 ModelPriceHelperPerCall 之后调用（它会重建 PriceData）。
	//    ResolveOriginTask 可能已在 remix 路径中预设了 OtherRatios，此处合并。
	if estimatedRatios := adaptor.EstimateBilling(c, info); len(estimatedRatios) > 0 {
		for k, v := range estimatedRatios {
			info.PriceData.AddOtherRatio(k, v)
		}
	}

	// 6. 将 OtherRatios 应用到基础额度
	if !common.StringsContains(constant.TaskPricePatches, modelName) {
		for _, ra := range info.PriceData.OtherRatios {
			if ra != 1.0 {
				info.PriceData.Quota = int(float64(info.PriceData.Quota) * ra)
			}
		}
	}

	// 7. 预扣费（仅首次 — 重试时 info.Billing 已存在，跳过）
	if info.Billing == nil && !info.PriceData.FreeModel {
		info.ForcePreConsume = true
		if apiErr := service.PreConsumeBilling(c, info.PriceData.Quota, info); apiErr != nil {
			return nil, service.TaskErrorFromAPIError(apiErr)
		}
	}

	// 8. 构建请求体
	requestBody, err := adaptor.BuildRequestBody(c, info)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "build_request_failed", http.StatusInternalServerError)
	}

	// 9. 发送请求
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "do_request_failed", http.StatusInternalServerError)
	}
	if resp != nil && resp.StatusCode != http.StatusOK {
		responseBody, _ := io.ReadAll(resp.Body)
		return nil, service.TaskErrorWrapper(fmt.Errorf("%s", string(responseBody)), "fail_to_fetch_task", resp.StatusCode)
	}

	// 10. 返回 OtherRatios 给下游（header 必须在 DoResponse 写 body 之前设置）
	otherRatios := info.PriceData.OtherRatios
	if otherRatios == nil {
		otherRatios = map[string]float64{}
	}
	ratiosJSON, _ := common.Marshal(otherRatios)
	c.Header("X-New-Api-Other-Ratios", string(ratiosJSON))

	// 11. 解析响应
	upstreamTaskID, taskData, taskErr := adaptor.DoResponse(c, resp, info)
	if taskErr != nil {
		return nil, taskErr
	}

	// 11. 提交后计费调整：让适配器根据上游实际返回调整 OtherRatios
	finalQuota := info.PriceData.Quota
	if adjustedRatios := adaptor.AdjustBillingOnSubmit(info, taskData); len(adjustedRatios) > 0 {
		// 基于调整后的 ratios 重新计算 quota
		finalQuota = recalcQuotaFromRatios(info, adjustedRatios)
		info.PriceData.OtherRatios = adjustedRatios
		info.PriceData.Quota = finalQuota
	}

	return &TaskSubmitResult{
		UpstreamTaskID: upstreamTaskID,
		TaskData:       taskData,
		Platform:       platform,
		Quota:          finalQuota,
	}, nil
}

// recalcQuotaFromRatios 根据 adjustedRatios 重新计算 quota。
// 公式: baseQuota × ∏(ratio) — 其中 baseQuota 是不含 OtherRatios 的基础额度。
func recalcQuotaFromRatios(info *relaycommon.RelayInfo, ratios map[string]float64) int {
	// 从 PriceData 获取不含 OtherRatios 的基础价格
	baseQuota := info.PriceData.Quota
	// 先除掉原有的 OtherRatios 恢复基础额度
	for _, ra := range info.PriceData.OtherRatios {
		if ra != 1.0 && ra > 0 {
			baseQuota = int(float64(baseQuota) / ra)
		}
	}
	// 应用新的 ratios
	result := float64(baseQuota)
	for _, ra := range ratios {
		if ra != 1.0 {
			result *= ra
		}
	}
	return int(result)
}

var fetchRespBuilders = map[int]func(c *gin.Context) (respBody []byte, taskResp *dto.TaskError){
	relayconstant.RelayModeSunoFetchByID:  sunoFetchByIDRespBodyBuilder,
	relayconstant.RelayModeSunoFetch:      sunoFetchRespBodyBuilder,
	relayconstant.RelayModeVideoFetchByID: videoFetchByIDRespBodyBuilder,
}

func RelayTaskFetch(c *gin.Context, relayMode int) (taskResp *dto.TaskError) {
	respBuilder, ok := fetchRespBuilders[relayMode]
	if !ok {
		taskResp = service.TaskErrorWrapperLocal(errors.New("invalid_relay_mode"), "invalid_relay_mode", http.StatusBadRequest)
	}

	respBody, taskErr := respBuilder(c)
	if taskErr != nil {
		return taskErr
	}
	if len(respBody) == 0 {
		respBody = []byte("{\"code\":\"success\",\"data\":null}")
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	_, err := io.Copy(c.Writer, bytes.NewBuffer(respBody))
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "copy_response_body_failed", http.StatusInternalServerError)
		return
	}
	return
}

func sunoFetchRespBodyBuilder(c *gin.Context) (respBody []byte, taskResp *dto.TaskError) {
	userId := c.GetInt("id")
	var condition = struct {
		IDs    []any  `json:"ids"`
		Action string `json:"action"`
	}{}
	err := c.BindJSON(&condition)
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "invalid_request", http.StatusBadRequest)
		return
	}
	var tasks []any
	if len(condition.IDs) > 0 {
		taskModels, err := model.GetByTaskIds(userId, condition.IDs)
		if err != nil {
			taskResp = service.TaskErrorWrapper(err, "get_tasks_failed", http.StatusInternalServerError)
			return
		}
		for _, task := range taskModels {
			tasks = append(tasks, TaskModel2Dto(task))
		}
	} else {
		tasks = make([]any, 0)
	}
	respBody, err = common.Marshal(dto.TaskResponse[[]any]{
		Code: "success",
		Data: tasks,
	})
	return
}

func sunoFetchByIDRespBodyBuilder(c *gin.Context) (respBody []byte, taskResp *dto.TaskError) {
	taskId := c.Param("id")
	userId := c.GetInt("id")

	originTask, exist, err := model.GetByTaskId(userId, taskId)
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "get_task_failed", http.StatusInternalServerError)
		return
	}
	if !exist {
		taskResp = service.TaskErrorWrapperLocal(errors.New("task_not_exist"), "task_not_exist", http.StatusBadRequest)
		return
	}

	respBody, err = common.Marshal(dto.TaskResponse[any]{
		Code: "success",
		Data: TaskModel2Dto(originTask),
	})
	return
}

func videoFetchByIDRespBodyBuilder(c *gin.Context) (respBody []byte, taskResp *dto.TaskError) {
	taskId := c.Param("task_id")
	if taskId == "" {
		taskId = c.GetString("task_id")
	}
	userId := c.GetInt("id")

	originTask, exist, err := model.GetByTaskId(userId, taskId)
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "get_task_failed", http.StatusInternalServerError)
		return
	}
	if !exist {
		taskResp = service.TaskErrorWrapperLocal(errors.New("task_not_exist"), "task_not_exist", http.StatusBadRequest)
		return
	}

	isOpenAIVideoAPI := strings.HasPrefix(c.Request.RequestURI, "/v1/videos/")

	// Gemini/Vertex 支持实时查询：用户 fetch 时直接从上游拉取最新状态
	if realtimeResp := tryRealtimeFetch(originTask, isOpenAIVideoAPI); len(realtimeResp) > 0 {
		respBody = realtimeResp
		return
	}

	// OpenAI Video API 格式: 走各 adaptor 的 ConvertToOpenAIVideo
	if isOpenAIVideoAPI {
		adaptor := GetTaskAdaptor(originTask.Platform)
		if adaptor == nil {
			taskResp = service.TaskErrorWrapperLocal(fmt.Errorf("invalid channel id: %d", originTask.ChannelId), "invalid_channel_id", http.StatusBadRequest)
			return
		}
		if converter, ok := adaptor.(channel.OpenAIVideoConverter); ok {
			openAIVideoData, err := converter.ConvertToOpenAIVideo(originTask)
			if err != nil {
				taskResp = service.TaskErrorWrapper(err, "convert_to_openai_video_failed", http.StatusInternalServerError)
				return
			}
			// GCS 转存读取侧收口（设计 4.5 出口 1/2）：框架层统一覆写各渠道
			// ConvertToOpenAIVideo 的输出，metadata.url 换为现签 URL（sora 的原始
			// Data 透传与 hailuo 经 model.ToOpenAIVideo 的 GetResultURL 同样被收口）
			respBody = overrideOpenAIVideoGCSResult(c.Request.Context(), originTask, openAIVideoData)
			return
		}
		taskResp = service.TaskErrorWrapperLocal(fmt.Errorf("not_implemented:%s", originTask.Platform), "not_implemented", http.StatusNotImplemented)
		return
	}

	// 通用 TaskDto 格式
	respBody, err = common.Marshal(dto.TaskResponse[any]{
		Code: "success",
		Data: TaskModel2Dto(originTask),
	})
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "marshal_response_failed", http.StatusInternalServerError)
	}
	return
}

// tryRealtimeFetch 尝试从上游实时拉取 Gemini/Vertex 任务状态。
// 仅当渠道类型为 Gemini 或 Vertex 时触发；其他渠道或出错时返回 nil。
// 当非 OpenAI Video API 时，还会构建自定义格式的响应体。
//
// GCS 转存模式下本函数对视频任务完全只读（单写者模型，gcs-video-transfer-design.md 4.4）：
// 不落库、不触发转存；发现上游成功也只对外返回处理中——本函数的读-写窗口横跨一次
// 上游 HTTP 调用，且运行在任意实例上，任何写入都会与 master 轮询循环的陈旧内存副本
// 互相整行覆盖（lost update）。首次暂存与转存触发完全由 master 轮询驱动，
// 代价是 Gemini/Vertex 任务的对外成功最多延迟一个轮询周期（≤15s+）。
func tryRealtimeFetch(task *model.Task, isOpenAIVideoAPI bool) []byte {
	readOnly := setting.GCSTransferEnabled
	if readOnly && isOpenAIVideoAPI {
		// OpenAI 格式响应由调用方基于 DB 状态组装；只读模式下该路径无任何副作用可做，
		// 直接跳过上游往返
		return nil
	}

	channelModel, err := model.GetChannelById(task.ChannelId, true)
	if err != nil {
		return nil
	}
	if channelModel.Type != constant.ChannelTypeVertexAi && channelModel.Type != constant.ChannelTypeGemini {
		return nil
	}

	baseURL := constant.ChannelBaseURLs[channelModel.Type]
	if channelModel.GetBaseURL() != "" {
		baseURL = channelModel.GetBaseURL()
	}
	proxy := channelModel.GetSetting().Proxy
	adaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(channelModel.Type)))
	if adaptor == nil {
		return nil
	}

	resp, err := adaptor.FetchTask(baseURL, channelModel.Key, map[string]any{
		"task_id": task.GetUpstreamTaskID(),
		"action":  task.Action,
	}, proxy)
	if err != nil || resp == nil {
		return nil
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	ti, err := adaptor.ParseTaskResult(body)
	if err != nil || ti == nil {
		return nil
	}

	if readOnly {
		// 只读展示：不修改 task、不落库、不触发转存。上游的非终态进度可以前瞻展示；
		// 终态（成功/失败）必须等 master 轮询落库后才对外呈现——succeeded 只能由
		// 转存完成产生，且响应 url 只取 DB 值，上游 ti.Url 绝不进响应。
		displayStatus := task.Status
		if ti.Status != "" {
			if s := model.TaskStatus(ti.Status); s != model.TaskStatusSuccess && s != model.TaskStatusFailure {
				displayStatus = s
			} else if task.Status != model.TaskStatusSuccess && task.Status != model.TaskStatusFailure {
				displayStatus = model.TaskStatusInProgress
			}
		}
		// 读取侧收口（设计 4.5 出口 3）：gs:// 换现签 URL，签名失败/过期降级代理 URL，
		// 绝不返回裸 gs://（红线 12）
		displayURL, expiresAt := service.GetTaskDisplayResultURL(context.Background(), task)
		out := map[string]any{
			"error":    nil,
			"format":   detectVideoFormat(body),
			"metadata": nil,
			"status":   mapTaskStatusToSimple(displayStatus),
			"task_id":  task.TaskID,
			"url":      displayURL,
		}
		if expiresAt > 0 {
			out["expires_at"] = expiresAt
		}
		respBody, _ := common.Marshal(dto.TaskResponse[any]{
			Code: "success",
			Data: out,
		})
		return respBody
	}

	snap := task.Snapshot()

	// 将上游最新状态更新到 task
	if ti.Status != "" {
		task.Status = model.TaskStatus(ti.Status)
	}
	if ti.Progress != "" {
		task.Progress = ti.Progress
	}
	if strings.HasPrefix(ti.Url, "data:") {
		// data: URI — kept in Data, not ResultURL
	} else if ti.Url != "" {
		task.PrivateData.ResultURL = ti.Url
	} else if task.Status == model.TaskStatusSuccess {
		// No URL from adaptor — construct proxy URL using public task ID
		task.PrivateData.ResultURL = taskcommon.BuildProxyURL(task.TaskID)
	}

	if !snap.Equal(task.Snapshot()) {
		_, _ = task.UpdateWithStatus(snap.Status)
	}

	// OpenAI Video API 由调用者的 ConvertToOpenAIVideo 分支处理
	if isOpenAIVideoAPI {
		return nil
	}

	// 非 OpenAI Video API: 构建自定义格式响应
	// 读取侧收口（设计 4.5 出口 3）：转存模式关闭后存量 gs:// 任务同样换签/降级，绝不裸出
	format := detectVideoFormat(body)
	displayURL, expiresAt := service.GetTaskDisplayResultURL(context.Background(), task)
	out := map[string]any{
		"error":    nil,
		"format":   format,
		"metadata": nil,
		"status":   mapTaskStatusToSimple(task.Status),
		"task_id":  task.TaskID,
		"url":      displayURL,
	}
	if expiresAt > 0 {
		out["expires_at"] = expiresAt
	}
	respBody, _ := common.Marshal(dto.TaskResponse[any]{
		Code: "success",
		Data: out,
	})
	return respBody
}

// detectVideoFormat 从 Gemini/Vertex 原始响应中探测视频格式
func detectVideoFormat(rawBody []byte) string {
	var raw map[string]any
	if err := common.Unmarshal(rawBody, &raw); err != nil {
		return "mp4"
	}
	respObj, ok := raw["response"].(map[string]any)
	if !ok {
		return "mp4"
	}
	vids, ok := respObj["videos"].([]any)
	if !ok || len(vids) == 0 {
		return "mp4"
	}
	v0, ok := vids[0].(map[string]any)
	if !ok {
		return "mp4"
	}
	mt, ok := v0["mimeType"].(string)
	if !ok || mt == "" || strings.Contains(mt, "mp4") {
		return "mp4"
	}
	return mt
}

// mapTaskStatusToSimple 将内部 TaskStatus 映射为简化状态字符串
func mapTaskStatusToSimple(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusSuccess:
		return "succeeded"
	case model.TaskStatusFailure:
		return "failed"
	case model.TaskStatusQueued, model.TaskStatusSubmitted:
		return "queued"
	default:
		return "processing"
	}
}

// overrideOpenAIVideoGCSResult GCS 转存读取侧的框架层统一覆写（设计 4.5 出口 1/2，红线 12）：
// 任务 SUCCESS 且 ResultURL 为 gs:// 时，强制把 metadata.url 覆写为读时现签的 V4 URL，
// 多文件按 UpstreamAssets 的 Index 升序重组（index=0 写 metadata.url，全部资产按序
// 写 metadata.urls，Pollo 付 N 拿 N），并附真实 expires_at。各渠道 ConvertToOpenAIVideo
// 从（已脱敏的）task.Data 抽出的 URL 一律被覆盖；sora 的原始 Data 透传分支与 hailuo 经
// model.ToOpenAIVideo 的输出同样收口。
//   - 超保留期：返回明确的 result_expired 错误对象，不签必 404 的死链；
//   - 签名失败：metadata.url 降级为 video_proxy 代理 URL（访问时 503 可重试 / 410 过期），
//     绝不返回裸 gs://。
//
// 转存阶段（UpstreamDoneAt != 0 且对外仍 IN_PROGRESS）同样在此收口：部分渠道的
// ConvertToOpenAIVideo 从 task.Data 抽上游状态（ali 的 aliResp.Output.TaskStatus、
// sora 的原始 Data 透传），上游已 succeeded 会先于转存完成泄露给用户——强制把
// status/progress 覆写回 DB 值（in_progress / 95%），「转存完成才返回成功」。
//
// 非转存任务（直链/旧数据/紧急开关降级完成）原样放行。
func overrideOpenAIVideoGCSResult(ctx context.Context, task *model.Task, body []byte) []byte {
	if task.PrivateData.UpstreamDoneAt != 0 &&
		(task.Status == model.TaskStatusInProgress || task.Status == model.TaskStatusFailure) {
		// 转存阶段（in_progress 95%）与转存超截止判 FAILURE（已退款）的任务：
		// 状态必须以 DB 为准，Data 中的上游 succeeded 不得泄露为 completed
		return forceTaskStatusOpenAIVideo(ctx, task, body)
	}
	if task.Status != model.TaskStatusSuccess || !service.IsGCSResultURL(strings.TrimSpace(task.GetResultURL())) {
		return body
	}

	var m map[string]any
	if err := common.Unmarshal(body, &m); err != nil || m == nil {
		// 不可解析时绝不放行可能含 gs:// 的原始体，重建最小响应结构
		m = map[string]any{
			"id":         task.TaskID,
			"object":     "video",
			"model":      task.Properties.OriginModelName,
			"status":     task.Status.ToVideoStatus(),
			"created_at": task.CreatedAt,
		}
	}
	metadata, _ := m["metadata"].(map[string]any)
	if metadata == nil {
		metadata = map[string]any{}
	}

	signedAssets, err := service.GetTaskSignedAssets(task)
	switch {
	case err == nil:
		metadata["url"] = signedAssets[0].SignedURL
		if len(signedAssets) > 1 {
			urls := make([]string, 0, len(signedAssets))
			for _, sa := range signedAssets {
				urls = append(urls, sa.SignedURL)
			}
			metadata["urls"] = urls
		} else {
			delete(metadata, "urls")
		}
		m["expires_at"] = signedAssets[0].ExpiresAt
	case errors.Is(err, service.ErrGCSResultExpired):
		// 保留期是对外 API 契约（设计 4.5 规则 1）：明确报过期，不返回任何 URL
		delete(metadata, "url")
		delete(metadata, "urls")
		delete(m, "expires_at")
		m["error"] = map[string]any{
			"message": fmt.Sprintf("video result has expired (results are retained for %d days)", setting.GCSResultRetentionDays),
			"code":    "result_expired",
		}
	default:
		// 签名失败降级（设计 4.5 规则 2）：JSON 出口无错误通道，降级为网关代理 URL
		logger.LogError(ctx, fmt.Sprintf("gcs sign-fail task=%s, degrade openai video url to proxy url: %s", task.TaskID, err.Error()))
		metadata["url"] = taskcommon.BuildProxyURL(task.TaskID)
		delete(metadata, "urls")
		delete(m, "expires_at")
	}
	m["metadata"] = metadata

	b, mErr := common.Marshal(m)
	if mErr != nil {
		// 理论不可达（map[string]any 全为可序列化值）；兜底输出不含 gs:// 的最小结构
		logger.LogError(ctx, fmt.Sprintf("marshal overridden openai video failed for task %s: %s", task.TaskID, mErr.Error()))
		return []byte(fmt.Sprintf(`{"id":%q,"object":"video","status":%q,"metadata":{"url":%q}}`,
			task.TaskID, task.Status.ToVideoStatus(), taskcommon.BuildProxyURL(task.TaskID)))
	}
	return b
}

// forceTaskStatusOpenAIVideo 转存链路的对外状态收口：
//   - 转存阶段（上游已成功、GCS 未就绪）：对外必须保持 in_progress（progress 95%）——
//     「转存完成才返回成功」是核心语义（设计 4.1/4.4）；
//   - 转存超截止判 FAILURE（已退款）：对外必须呈现 failed，不得显示 completed。
//
// 从 task.Status 取状态的渠道天然满足；从 task.Data 抽上游状态的渠道（ali、sora 原始
// 透传）会按上游 succeeded 泄露 completed，在此强制覆写回 DB 值。
// URL 类字段同样清掉（task.Data 已脱敏，此处为防御纵深）。
func forceTaskStatusOpenAIVideo(ctx context.Context, task *model.Task, body []byte) []byte {
	var m map[string]any
	if err := common.Unmarshal(body, &m); err != nil || m == nil {
		m = map[string]any{
			"id":         task.TaskID,
			"object":     "video",
			"model":      task.Properties.OriginModelName,
			"created_at": task.CreatedAt,
		}
	}
	m["status"] = task.Status.ToVideoStatus()
	progress, _ := strconv.Atoi(strings.TrimSuffix(strings.TrimSpace(task.Progress), "%"))
	m["progress"] = progress
	delete(m, "completed_at")
	delete(m, "expires_at")
	if metadata, _ := m["metadata"].(map[string]any); metadata != nil {
		delete(metadata, "url")
		delete(metadata, "urls")
	}
	if task.Status == model.TaskStatusFailure && task.FailReason != "" {
		if _, hasErr := m["error"].(map[string]any); !hasErr {
			m["error"] = map[string]any{"message": task.FailReason, "code": "task_failed"}
		}
	}
	b, mErr := common.Marshal(m)
	if mErr != nil {
		logger.LogError(ctx, fmt.Sprintf("marshal transfer-stage openai video failed for task %s: %s", task.TaskID, mErr.Error()))
		return []byte(fmt.Sprintf(`{"id":%q,"object":"video","status":%q,"progress":%d}`,
			task.TaskID, task.Status.ToVideoStatus(), progress))
	}
	return b
}

func TaskModel2Dto(task *model.Task) *dto.TaskDto {
	// 读取侧收口（设计 4.5 出口 4）：ResultURL 为 gs:// 时换现签 URL，签名失败/过期
	// 降级代理 URL，绝不返回裸 gs://（红线 12）；非 gs://（直链/旧数据/Suno）原样返回。
	// Data 字段的上游直链已在写库前经 redactVideoResponseBody 脱敏（service/task_polling.go）。
	displayURL, _ := service.GetTaskDisplayResultURL(context.Background(), task)
	return &dto.TaskDto{
		ID:         task.ID,
		CreatedAt:  task.CreatedAt,
		UpdatedAt:  task.UpdatedAt,
		TaskID:     task.TaskID,
		Platform:   string(task.Platform),
		UserId:     task.UserId,
		Group:      task.Group,
		ChannelId:  task.ChannelId,
		Quota:      task.Quota,
		Action:     task.Action,
		Status:     string(task.Status),
		FailReason: task.FailReason,
		ResultURL:  displayURL,
		SubmitTime: task.SubmitTime,
		StartTime:  task.StartTime,
		FinishTime: task.FinishTime,
		Progress:   task.Progress,
		Properties: task.Properties,
		Username:   task.Username,
		Data:       task.Data,
	}
}
