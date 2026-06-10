package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"

	"github.com/samber/lo"
)

// TaskPollingAdaptor 定义轮询所需的最小适配器接口，避免 service -> relay 的循环依赖
type TaskPollingAdaptor interface {
	Init(info *relaycommon.RelayInfo)
	FetchTask(baseURL string, key string, body map[string]any, proxy string) (*http.Response, error)
	ParseTaskResult(body []byte) (*relaycommon.TaskInfo, error)
	// AdjustBillingOnComplete 在任务到达终态（成功/失败）时由轮询循环调用。
	// 返回正数触发差额结算（补扣/退还），返回 0 保持预扣费金额不变。
	//
	// 接口契约（GCS 转存模式，gcs-video-transfer-design.md 4.4）：转存 worker 结算时
	// 传入的 taskResult 由 PrivateData.SettleTokens 合成，仅保证 TotalTokens 有效。
	// 实现不得读取 taskResult 的其他字段，否则需先扩展 SettleTokens 的持久化集。
	AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int

	// ── GCS 转存钩子（gcs-video-transfer-design.md 4.2，定义见 relay/channel/adapter.go） ──

	// ExtractUpstreamAssets 在"上游成功"时由轮询循环调用，基于脱敏前的原始响应
	// 枚举全部结果资产；error 或空清单 = 本轮不进入转存阶段，下一轮重试。
	ExtractUpstreamAssets(task *model.Task, taskResult *relaycommon.TaskInfo, rawRespBody []byte) ([]taskcommon.UpstreamAsset, error)
	// FetchResultContent 返回单个资产的内容流（转存 worker 调用，超时经 ctx 强制；
	// 取流凭证 PrivateData.Key 优先、ch.Key 兜底）。
	FetchResultContent(ctx context.Context, task *model.Task, ch *model.Channel, asset taskcommon.UpstreamAsset) (io.ReadCloser, string, error)
}

// GetTaskAdaptorFunc 由 main 包注入，用于获取指定平台的任务适配器。
// 打破 service -> relay -> relay/channel -> service 的循环依赖。
var GetTaskAdaptorFunc func(platform constant.TaskPlatform) TaskPollingAdaptor

// sweepTimedOutTasks 在主轮询之前独立清理超时任务。
// 每次最多处理 100 条，剩余的下个周期继续处理。
// 使用 per-task CAS (UpdateWithStatus) 防止覆盖被正常轮询已推进的任务。
func sweepTimedOutTasks(ctx context.Context) {
	if constant.TaskTimeoutMinutes <= 0 {
		return
	}
	cutoff := time.Now().Unix() - int64(constant.TaskTimeoutMinutes)*60
	tasks := model.GetTimedOutUnfinishedTasks(cutoff, 100)
	if len(tasks) == 0 {
		return
	}

	const legacyTaskCutoff int64 = 1740182400 // 2026-02-22 00:00:00 UTC
	reason := fmt.Sprintf("任务超时（%d分钟）", constant.TaskTimeoutMinutes)
	legacyReason := "任务超时（旧系统遗留任务，不进行退款，请联系管理员）"
	now := time.Now().Unix()
	timedOutCount := 0

	for _, task := range tasks {
		isLegacy := task.SubmitTime > 0 && task.SubmitTime < legacyTaskCutoff

		oldStatus := task.Status
		task.Status = model.TaskStatusFailure
		task.Progress = "100%"
		task.FinishTime = now
		if isLegacy {
			task.FailReason = legacyReason
		} else {
			task.FailReason = reason
		}

		won, err := task.UpdateWithStatus(oldStatus)
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("sweepTimedOutTasks CAS update error for task %s: %v", task.TaskID, err))
			continue
		}
		if !won {
			logger.LogInfo(ctx, fmt.Sprintf("sweepTimedOutTasks: task %s already transitioned, skip", task.TaskID))
			continue
		}
		timedOutCount++
		if !isLegacy && task.Quota != 0 {
			RefundTaskQuota(ctx, task, reason)
		}
	}

	if timedOutCount > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("sweepTimedOutTasks: timed out %d tasks", timedOutCount))
	}
}

// TaskPollingLoop 主轮询循环，每 15 秒检查一次未完成的任务
func TaskPollingLoop() {
	for {
		time.Sleep(time.Duration(15) * time.Second)
		common.SysLog("任务进度轮询开始")
		ctx := context.TODO()
		sweepTimedOutTasks(ctx)
		allTasks := model.GetAllUnFinishSyncTasks(constant.TaskQueryLimit)
		platformTask := make(map[constant.TaskPlatform][]*model.Task)
		transferBacklog := int64(0)
		for _, t := range allTasks {
			platformTask[t.Platform] = append(platformTask[t.Platform], t)
			if t.PrivateData.UpstreamDoneAt != 0 {
				transferBacklog++
			}
		}
		// 转存积压量 gauge（4.8）：本轮轮询集合中转存阶段任务数（受 TASK_QUERY_LIMIT 截断，
		// DB 全量积压由 gcs-metrics sentinel 的 CountTransferStageTasks 补充）
		gcsMetrics.pollBacklog.Store(transferBacklog)
		for platform, tasks := range platformTask {
			if len(tasks) == 0 {
				continue
			}
			taskChannelM := make(map[int][]string)
			taskM := make(map[string]*model.Task)
			nullTaskIds := make([]int64, 0)
			for _, task := range tasks {
				upstreamID := task.GetUpstreamTaskID()
				if upstreamID == "" {
					// 统计失败的未完成任务
					nullTaskIds = append(nullTaskIds, task.ID)
					continue
				}
				taskM[upstreamID] = task
				taskChannelM[task.ChannelId] = append(taskChannelM[task.ChannelId], upstreamID)
			}
			if len(nullTaskIds) > 0 {
				err := model.TaskBulkUpdateByID(nullTaskIds, map[string]any{
					"status":   "FAILURE",
					"progress": "100%",
				})
				if err != nil {
					logger.LogError(ctx, fmt.Sprintf("Fix null task_id task error: %v", err))
				} else {
					logger.LogInfo(ctx, fmt.Sprintf("Fix null task_id task success: %v", nullTaskIds))
				}
			}
			if len(taskChannelM) == 0 {
				continue
			}

			DispatchPlatformUpdate(platform, taskChannelM, taskM)
		}
		common.SysLog("任务进度轮询完成")
	}
}

// DispatchPlatformUpdate 按平台分发轮询更新
func DispatchPlatformUpdate(platform constant.TaskPlatform, taskChannelM map[int][]string, taskM map[string]*model.Task) {
	switch platform {
	case constant.TaskPlatformMidjourney:
		// MJ 轮询由其自身处理，这里预留入口
	case constant.TaskPlatformSuno:
		_ = UpdateSunoTasks(context.Background(), taskChannelM, taskM)
	default:
		if err := UpdateVideoTasks(context.Background(), platform, taskChannelM, taskM); err != nil {
			common.SysLog(fmt.Sprintf("UpdateVideoTasks fail: %s", err))
		}
	}
}

// UpdateSunoTasks 按渠道更新所有 Suno 任务
func UpdateSunoTasks(ctx context.Context, taskChannelM map[int][]string, taskM map[string]*model.Task) error {
	for channelId, taskIds := range taskChannelM {
		err := updateSunoTasks(ctx, channelId, taskIds, taskM)
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("渠道 #%d 更新异步任务失败: %s", channelId, err.Error()))
		}
	}
	return nil
}

func updateSunoTasks(ctx context.Context, channelId int, taskIds []string, taskM map[string]*model.Task) error {
	logger.LogInfo(ctx, fmt.Sprintf("渠道 #%d 未完成的任务有: %d", channelId, len(taskIds)))
	if len(taskIds) == 0 {
		return nil
	}
	ch, err := model.CacheGetChannel(channelId)
	if err != nil {
		common.SysLog(fmt.Sprintf("CacheGetChannel: %v", err))
		// Collect DB primary key IDs for bulk update (taskIds are upstream IDs, not task_id column values)
		var failedIDs []int64
		for _, upstreamID := range taskIds {
			if t, ok := taskM[upstreamID]; ok {
				failedIDs = append(failedIDs, t.ID)
			}
		}
		err = model.TaskBulkUpdateByID(failedIDs, map[string]any{
			"fail_reason": fmt.Sprintf("获取渠道信息失败，请联系管理员，渠道ID：%d", channelId),
			"status":      "FAILURE",
			"progress":    "100%",
		})
		if err != nil {
			common.SysLog(fmt.Sprintf("UpdateSunoTask error: %v", err))
		}
		return err
	}
	adaptor := GetTaskAdaptorFunc(constant.TaskPlatformSuno)
	if adaptor == nil {
		return errors.New("adaptor not found")
	}
	proxy := ch.GetSetting().Proxy
	resp, err := adaptor.FetchTask(*ch.BaseURL, ch.Key, map[string]any{
		"ids": taskIds,
	}, proxy)
	if err != nil {
		common.SysLog(fmt.Sprintf("Get Task Do req error: %v", err))
		return err
	}
	if resp.StatusCode != http.StatusOK {
		logger.LogError(ctx, fmt.Sprintf("Get Task status code: %d", resp.StatusCode))
		return fmt.Errorf("Get Task status code: %d", resp.StatusCode)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		common.SysLog(fmt.Sprintf("Get Suno Task parse body error: %v", err))
		return err
	}
	var responseItems dto.TaskResponse[[]dto.SunoDataResponse]
	err = common.Unmarshal(responseBody, &responseItems)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Get Suno Task parse body error2: %v, body: %s", err, string(responseBody)))
		return err
	}
	if !responseItems.IsSuccess() {
		common.SysLog(fmt.Sprintf("渠道 #%d 未完成的任务有: %d, 成功获取到任务数: %s", channelId, len(taskIds), string(responseBody)))
		return err
	}

	for _, responseItem := range responseItems.Data {
		task := taskM[responseItem.TaskID]
		if !taskNeedsUpdate(task, responseItem) {
			continue
		}

		task.Status = lo.If(model.TaskStatus(responseItem.Status) != "", model.TaskStatus(responseItem.Status)).Else(task.Status)
		task.FailReason = lo.If(responseItem.FailReason != "", responseItem.FailReason).Else(task.FailReason)
		task.SubmitTime = lo.If(responseItem.SubmitTime != 0, responseItem.SubmitTime).Else(task.SubmitTime)
		task.StartTime = lo.If(responseItem.StartTime != 0, responseItem.StartTime).Else(task.StartTime)
		task.FinishTime = lo.If(responseItem.FinishTime != 0, responseItem.FinishTime).Else(task.FinishTime)
		if responseItem.FailReason != "" || task.Status == model.TaskStatusFailure {
			logger.LogInfo(ctx, task.TaskID+" 构建失败，"+task.FailReason)
			task.Progress = "100%"
			RefundTaskQuota(ctx, task, task.FailReason)
		}
		if responseItem.Status == model.TaskStatusSuccess {
			task.Progress = "100%"
		}
		task.Data = responseItem.Data

		err = task.Update()
		if err != nil {
			common.SysLog("UpdateSunoTask task error: " + err.Error())
		}
	}
	return nil
}

// taskNeedsUpdate 检查 Suno 任务是否需要更新
func taskNeedsUpdate(oldTask *model.Task, newTask dto.SunoDataResponse) bool {
	if oldTask.SubmitTime != newTask.SubmitTime {
		return true
	}
	if oldTask.StartTime != newTask.StartTime {
		return true
	}
	if oldTask.FinishTime != newTask.FinishTime {
		return true
	}
	if string(oldTask.Status) != newTask.Status {
		return true
	}
	if oldTask.FailReason != newTask.FailReason {
		return true
	}

	if (oldTask.Status == model.TaskStatusFailure || oldTask.Status == model.TaskStatusSuccess) && oldTask.Progress != "100%" {
		return true
	}

	oldData, _ := common.Marshal(oldTask.Data)
	newData, _ := common.Marshal(newTask.Data)

	sort.Slice(oldData, func(i, j int) bool {
		return oldData[i] < oldData[j]
	})
	sort.Slice(newData, func(i, j int) bool {
		return newData[i] < newData[j]
	})

	if string(oldData) != string(newData) {
		return true
	}
	return false
}

// UpdateVideoTasks 按渠道更新所有视频任务
func UpdateVideoTasks(ctx context.Context, platform constant.TaskPlatform, taskChannelM map[int][]string, taskM map[string]*model.Task) error {
	for channelId, taskIds := range taskChannelM {
		if err := updateVideoTasks(ctx, platform, channelId, taskIds, taskM); err != nil {
			logger.LogError(ctx, fmt.Sprintf("Channel #%d failed to update video async tasks: %s", channelId, err.Error()))
		}
	}
	return nil
}

func updateVideoTasks(ctx context.Context, platform constant.TaskPlatform, channelId int, taskIds []string, taskM map[string]*model.Task) error {
	logger.LogInfo(ctx, fmt.Sprintf("Channel #%d pending video tasks: %d", channelId, len(taskIds)))
	if len(taskIds) == 0 {
		return nil
	}

	// GCS 转存阶段分流（gcs-video-transfer-design.md 4.4，分流位置硬约束）：
	// UpstreamDoneAt != 0 的任务必须在 CacheGetChannel/adaptor 构建之前处理——
	// deadline 检查与 Submit 均不依赖渠道存在（直链类转存无需渠道；带鉴权取流由
	// worker 自行 CacheGetChannel），渠道被删后转存中任务仍需驱动与兜底，
	// 也绝不能落入下方渠道获取失败的 FAILURE 路径被误杀。
	pending := make([]string, 0, len(taskIds))
	for _, taskId := range taskIds {
		if t, ok := taskM[taskId]; ok && t != nil && t.PrivateData.UpstreamDoneAt != 0 {
			handleTransferStageTask(ctx, t)
			continue
		}
		pending = append(pending, taskId)
	}
	taskIds = pending
	if len(taskIds) == 0 {
		return nil
	}

	cacheGetChannel, err := model.CacheGetChannel(channelId)
	if err != nil {
		// 渠道获取失败：逐条 CAS + 赢者退款（gcs-video-transfer-design.md 4.4 / 实现清单项 8）。
		// 原 TaskBulkUpdateByID 整批判死无 CAS、不退款，会绕过状态机覆盖并发推进的任务
		// （model/task.go 注释明确警告其禁止用于计费流转）。转存阶段任务已在上方分流，
		// 不会到达本分支。
		failReason := fmt.Sprintf("Failed to get channel info, channel ID: %d", channelId)
		now := time.Now().Unix()
		for _, upstreamID := range taskIds {
			t, ok := taskM[upstreamID]
			if !ok || t == nil {
				continue
			}
			oldStatus := t.Status
			t.Status = model.TaskStatusFailure
			t.Progress = taskcommon.ProgressComplete
			if t.FinishTime == 0 {
				t.FinishTime = now
			}
			t.FailReason = failReason
			won, uerr := t.UpdateWithStatus(oldStatus)
			if uerr != nil {
				logger.LogError(ctx, fmt.Sprintf("channel-missing FAILURE CAS update error for task %s: %v", t.TaskID, uerr))
				continue
			}
			if !won {
				logger.LogInfo(ctx, fmt.Sprintf("channel-missing FAILURE: task %s already transitioned, skip", t.TaskID))
				continue
			}
			if t.Quota != 0 {
				RefundTaskQuota(ctx, t, failReason)
			}
		}
		return fmt.Errorf("CacheGetChannel failed: %w", err)
	}
	adaptor := GetTaskAdaptorFunc(platform)
	if adaptor == nil {
		return fmt.Errorf("video adaptor not found")
	}
	info := &relaycommon.RelayInfo{}
	info.ChannelMeta = &relaycommon.ChannelMeta{
		ChannelBaseUrl: cacheGetChannel.GetBaseURL(),
	}
	info.ApiKey = cacheGetChannel.Key
	adaptor.Init(info)
	for _, taskId := range taskIds {
		if err := updateVideoSingleTask(ctx, adaptor, cacheGetChannel, taskId, taskM); err != nil {
			logger.LogError(ctx, fmt.Sprintf("Failed to update video task %s: %s", taskId, err.Error()))
		}
		// sleep 1 second between each task to avoid hitting rate limits of upstream platforms
		time.Sleep(1 * time.Second)
	}
	return nil
}

// handleTransferStageTask 处理转存阶段（UpstreamDoneAt != 0）的任务：直接跳过 FetchTask——
// 结算输入已持久化（SettleTokens/UpstreamAssets），上游状态不再重要，终态决定权完全归
// 转存流程（gcs-video-transfer-design.md 4.4 轮询循环改造）。
//
// 单写者模型：本函数运行在 master 轮询循环（单线程），独占转存阶段字段与超截止 FAILURE
// 的写权；worker 只做 IN_PROGRESS → SUCCESS 的终态 CAS。所有终态翻转 CAS 赢了才计费。
func handleTransferStageTask(ctx context.Context, task *model.Task) {
	now := time.Now().Unix()

	// 紧急开关已关闭（GCS 故障止血）：存量转存中任务用上游直链降级完成，
	// 禁止走 transferDeadline 退款分支——止血开关绝不能造成批量误退款（设计 4.6 / 红线 11）。
	if !setting.GCSTransferEnabled {
		degradeTransferStageTask(ctx, task, now)
		return
	}

	// 墙钟超截止（红线 13）：CAS 翻 FAILURE，CAS 赢才退款。
	// 已知损耗：恰在截止边界 worker 仍在上传时会被误杀退款（worker 随后 CAS 输、不结算），窗口极窄。
	if deadline := int64(setting.GCSTransferDeadline / time.Second); deadline > 0 && now-task.PrivateData.UpstreamDoneAt > deadline {
		task.Status = model.TaskStatusFailure
		task.Progress = taskcommon.ProgressComplete
		if task.FinishTime == 0 {
			task.FinishTime = now
		}
		task.FailReason = "GCS 转存超时（deadline-exhausted），任务失败"
		won, err := task.UpdateWithStatus(model.TaskStatusInProgress)
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("gcs-transfer deadline-exhausted CAS update error for task %s: %v", task.TaskID, err))
			return
		}
		if !won {
			logger.LogInfo(ctx, fmt.Sprintf("gcs-transfer deadline-exhausted: task %s already transitioned, skip refund", task.TaskID))
			return
		}
		GCSTransfer.Forget(task.TaskID)
		// 资损路径：上游已成功生成却退款（4.8 超截止退款 quota 指标），必须 error 级可观测
		gcsMetrics.deadlineExhausted.Add(1)
		gcsMetrics.deadlineRefundQuota.Add(int64(task.Quota))
		logger.LogError(ctx, fmt.Sprintf("gcs-transfer deadline-exhausted task=%s platform=%s quota=%d, refunding", task.TaskID, task.Platform, task.Quota))
		if task.Quota != 0 {
			RefundTaskQuota(ctx, task, task.FailReason)
		}
		return
	}

	// 转存中：re-Submit 驱动重试（inflight 去重 + 内存退避，立即返回，不阻塞轮询循环）
	GCSTransfer.Submit(task.TaskID)
}

// degradeTransferStageTask 紧急开关关闭后的存量转存中任务降级完成（设计 4.6）：
// 用 UpstreamAssets 主文件直链按旧逻辑完成（写直链、CAS SUCCESS、赢者结算）；
// 无直链渠道（Sora/Vertex）回退为现状的代理 URL（BuildProxyURL）。
// 降级结算同样遵守计费互斥：IN_PROGRESS → SUCCESS 的终态 CAS 单赢家保证
// 不与可能仍在途的 worker 重复结算。
func degradeTransferStageTask(ctx context.Context, task *model.Task, now int64) {
	mainURL := ""
	if assets, err := taskcommon.UnmarshalUpstreamAssets(task.PrivateData.UpstreamAssets); err == nil {
		sort.Slice(assets, func(i, j int) bool { return assets[i].Index < assets[j].Index })
		if len(assets) > 0 {
			mainURL = strings.TrimSpace(assets[0].URL)
		}
	}
	if mainURL == "" {
		mainURL = taskcommon.BuildProxyURL(task.TaskID)
	}

	task.Status = model.TaskStatusSuccess
	task.Progress = taskcommon.ProgressComplete
	if task.FinishTime == 0 {
		task.FinishTime = now
	}
	task.PrivateData.ResultURL = mainURL
	won, err := task.UpdateWithStatus(model.TaskStatusInProgress)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("gcs-transfer degrade CAS update error for task %s: %v", task.TaskID, err))
		return
	}
	if !won {
		logger.LogInfo(ctx, fmt.Sprintf("gcs-transfer degrade: task %s already transitioned, skip settlement", task.TaskID))
		return
	}
	GCSTransfer.Forget(task.TaskID)
	gcsMetrics.degradeComplete.Add(1)
	logger.LogInfo(ctx, fmt.Sprintf("gcs-transfer degrade-complete task=%s platform=%s url=%s (transfer disabled)", task.TaskID, task.Platform, mainURL))

	// CAS 赢才结算；结算输入用持久化的 SettleTokens 合成（仅 TotalTokens 有效的接口契约）。
	// adaptor 不可得时跳过差额结算、保持预扣额度（保守路径，计入计费失败日志）。
	var adaptor TaskPollingAdaptor
	if GetTaskAdaptorFunc != nil {
		adaptor = GetTaskAdaptorFunc(task.Platform)
	}
	if adaptor == nil {
		logger.LogError(ctx, fmt.Sprintf("gcs-transfer degrade: adaptor not found for platform %s, task %s keeps pre-charged quota", task.Platform, task.TaskID))
		return
	}
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}})
	settleTaskBillingOnComplete(ctx, adaptor, task, &relaycommon.TaskInfo{
		TotalTokens: int(task.PrivateData.SettleTokens),
	})
}

func updateVideoSingleTask(ctx context.Context, adaptor TaskPollingAdaptor, ch *model.Channel, taskId string, taskM map[string]*model.Task) error {
	baseURL := constant.ChannelBaseURLs[ch.Type]
	if ch.GetBaseURL() != "" {
		baseURL = ch.GetBaseURL()
	}
	proxy := ch.GetSetting().Proxy

	task := taskM[taskId]
	if task == nil {
		logger.LogError(ctx, fmt.Sprintf("Task %s not found in taskM", taskId))
		return fmt.Errorf("task %s not found", taskId)
	}
	// 防御：转存阶段任务已在 updateVideoTasks 的 CacheGetChannel 之前分流，
	// 不应到达此处；到达即跳过 FetchTask（终态决定权完全归转存流程）。
	if task.PrivateData.UpstreamDoneAt != 0 {
		handleTransferStageTask(ctx, task)
		return nil
	}
	key := ch.Key

	privateData := task.PrivateData
	if privateData.Key != "" {
		key = privateData.Key
	}
	resp, err := adaptor.FetchTask(baseURL, key, map[string]any{
		"task_id": task.GetUpstreamTaskID(),
		"action":  task.Action,
	}, proxy)
	if err != nil {
		return fmt.Errorf("fetchTask failed for task %s: %w", taskId, err)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("readAll failed for task %s: %w", taskId, err)
	}

	logger.LogDebug(ctx, "updateVideoSingleTask response: %s", responseBody)

	snap := task.Snapshot()

	taskResult := &relaycommon.TaskInfo{}
	// try parse as New API response format
	// 级联（new api → new api）分支本期排除 GCS 转存，维持现状透传
	//（取流链路与转存设计假设不符，见 gcs-video-transfer-design.md 2.1）
	isCascade := false
	var responseItems dto.TaskResponse[model.Task]
	if err = common.Unmarshal(responseBody, &responseItems); err == nil && responseItems.IsSuccess() {
		logger.LogDebug(ctx, "updateVideoSingleTask parsed as new api response format: %+v", responseItems)
		isCascade = true
		t := responseItems.Data
		taskResult.TaskID = t.TaskID
		taskResult.Status = string(t.Status)
		taskResult.Url = t.GetResultURL()
		taskResult.Progress = t.Progress
		taskResult.Reason = t.FailReason
		task.Data = t.Data
	} else if taskResult, err = adaptor.ParseTaskResult(responseBody); err != nil {
		return fmt.Errorf("parseTaskResult failed for task %s: %w", taskId, err)
	}

	task.Data = redactVideoResponseBody(responseBody)

	logger.LogDebug(ctx, "updateVideoSingleTask taskResult: %+v", taskResult)

	now := time.Now().Unix()
	if taskResult.Status == "" {
		//taskResult = relaycommon.FailTaskInfo("upstream returned empty status")
		errorResult := &dto.GeneralErrorResponse{}
		if err = common.Unmarshal(responseBody, &errorResult); err == nil {
			openaiError := errorResult.TryToOpenAIError()
			if openaiError != nil {
				// 返回规范的 OpenAI 错误格式，提取错误信息，判断错误是否为任务失败
				if openaiError.Code == "429" {
					// 429 错误通常表示请求过多或速率限制，暂时不认为是任务失败，保持原状态等待下一轮轮询
					return nil
				}

				// 其他错误认为是任务失败，记录错误信息并更新任务状态
				taskResult = relaycommon.FailTaskInfo("upstream returned error")
			} else {
				// unknown error format, log original response
				logger.LogError(ctx, fmt.Sprintf("Task %s returned empty status with unrecognized error format, response: %s", taskId, string(responseBody)))
				taskResult = relaycommon.FailTaskInfo("upstream returned unrecognized message")
			}
		}
	}

	shouldRefund := false
	shouldSettle := false
	enterTransferStage := false
	quota := task.Quota

	task.Status = model.TaskStatus(taskResult.Status)
	switch taskResult.Status {
	case model.TaskStatusSubmitted:
		task.Progress = taskcommon.ProgressSubmitted
	case model.TaskStatusQueued:
		task.Progress = taskcommon.ProgressQueued
	case model.TaskStatusInProgress:
		task.Progress = taskcommon.ProgressInProgress
		if task.StartTime == 0 {
			task.StartTime = now
		}
	case model.TaskStatusSuccess:
		// GCS 转存模式：上游成功 ≠ 对外成功，转存完成才置 SUCCESS（gcs-video-transfer-design.md 4.1/4.4）。
		// 级联分支本期排除，维持现状透传。
		if setting.GCSTransferEnabled && !isCascade {
			// 硬顺序（红线 10）：先基于脱敏前的原始响应 Extract 暂存，后脱敏，再落库。
			// responseBody 是原始字节、未被 redactVideoResponseBody 修改（它返回新切片）。
			assets, exErr := adaptor.ExtractUpstreamAssets(task, taskResult, responseBody)
			var assetsJSON string
			if exErr == nil && len(assets) > 0 {
				assetsJSON, exErr = taskcommon.MarshalUpstreamAssets(assets)
			} else if exErr == nil {
				exErr = fmt.Errorf("empty asset list")
			}
			if exErr != nil {
				// 本轮不落库、不写 UpstreamDoneAt：恢复内存副本后留待下一轮 FetchTask 重试
				//（上游偶发 success 但 URL 未就绪时自然获得补全机会；extract-fail 指标），
				// 持续失败由 TASK_TIMEOUT_MINUTES sweep 兜底退款。
				gcsMetrics.extractFail.Add(1)
				logger.LogWarn(ctx, fmt.Sprintf("gcs-transfer extract-fail task=%s platform=%s err=%s", task.TaskID, task.Platform, exErr.Error()))
				task.Status = snap.Status
				task.Progress = snap.Progress
				task.FinishTime = snap.FinishTime
				task.Data = snap.Data
				task.PrivateData.ResultURL = snap.ResultURL
				return nil
			}
			// 进入转存阶段：对外保持 IN_PROGRESS、progress 钉死 95%（红线 1：绝不 100%，
			// 否则任务同时退出轮询与超时清扫集合，永久卡死、资金悬置）。
			// FinishTime 不在此处写——其语义为转存完成时刻，由 worker 随终态 CAS 写入。
			task.Status = model.TaskStatusInProgress
			task.Progress = taskcommon.ProgressTransferring
			task.PrivateData.UpstreamDoneAt = now
			task.PrivateData.UpstreamAssets = assetsJSON
			task.PrivateData.SettleTokens = int64(taskResult.TotalTokens)
			enterTransferStage = true
			break
		}
		task.Progress = taskcommon.ProgressComplete
		if task.FinishTime == 0 {
			task.FinishTime = now
		}
		if strings.HasPrefix(taskResult.Url, "data:") {
			// data: URI (e.g. Vertex base64 encoded video) — keep in Data, not in ResultURL
			task.PrivateData.ResultURL = taskcommon.BuildProxyURL(task.TaskID)
		} else if taskResult.Url != "" {
			// Direct upstream URL (e.g. Kling, Ali, Doubao, etc.)
			task.PrivateData.ResultURL = taskResult.Url
		} else {
			// No URL from adaptor — construct proxy URL using public task ID
			task.PrivateData.ResultURL = taskcommon.BuildProxyURL(task.TaskID)
		}
		shouldSettle = true
	case model.TaskStatusFailure:
		logger.LogJson(ctx, fmt.Sprintf("Task %s failed", taskId), task)
		task.Status = model.TaskStatusFailure
		task.Progress = taskcommon.ProgressComplete
		if task.FinishTime == 0 {
			task.FinishTime = now
		}
		task.FailReason = taskResult.Reason
		logger.LogInfo(ctx, fmt.Sprintf("Task %s failed: %s", task.TaskID, task.FailReason))
		taskResult.Progress = taskcommon.ProgressComplete
		if quota != 0 {
			shouldRefund = true
		}
	default:
		return fmt.Errorf("unknown task status %s for task %s", taskResult.Status, task.TaskID)
	}
	// 转存阶段 progress 钉死 95%：禁止被 taskResult.Progress（可能为 100%）覆盖——
	// 「status=IN_PROGRESS 且 progress=100%」会永久卡死、资金悬置（红线 1）
	if taskResult.Progress != "" && task.PrivateData.UpstreamDoneAt == 0 {
		task.Progress = taskResult.Progress
	}

	isDone := task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure
	if isDone && snap.Status != task.Status {
		won, err := task.UpdateWithStatus(snap.Status)
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("UpdateWithStatus failed for task %s: %s", task.TaskID, err.Error()))
			shouldRefund = false
			shouldSettle = false
		} else if !won {
			logger.LogWarn(ctx, fmt.Sprintf("Task %s already transitioned by another process, skip billing", task.TaskID))
			shouldRefund = false
			shouldSettle = false
		}
	} else if !snap.Equal(task.Snapshot()) {
		won, err := task.UpdateWithStatus(snap.Status)
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("Failed to update task %s: %s", task.TaskID, err.Error()))
		} else if enterTransferStage {
			if won {
				// 首次进入转存阶段：落库赢了才触发异步转存
				GCSTransfer.Submit(task.TaskID)
			} else {
				// CAS 输 = 任务已被其他路径推进（如 worker 翻终态），不再 Submit——
				// 否则会对已 SUCCESS 的任务重复入队、白做一次下载+上传（设计 4.4）
				logger.LogWarn(ctx, fmt.Sprintf("gcs-transfer enter-stage CAS lost for task %s, skip submit", task.TaskID))
			}
		}
	} else {
		// No changes, skip update
		logger.LogDebug(ctx, "No update needed for task %s", task.TaskID)
	}

	if shouldSettle {
		settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)
	}
	if shouldRefund {
		RefundTaskQuota(ctx, task, task.FailReason)
	}

	return nil
}

// redactVideoResponseBody 写库前对上游查询响应做脱敏，结果存入 task.Data。
// 契约：返回新切片、绝不修改入参 body——success 分支的 Extract 时序（红线 10：
// 先基于原始 responseBody Extract 暂存，后脱敏，再落库）依赖该契约。
func redactVideoResponseBody(body []byte) []byte {
	var m map[string]any
	if err := common.Unmarshal(body, &m); err != nil {
		return body
	}
	resp, _ := m["response"].(map[string]any)
	if resp != nil {
		delete(resp, "bytesBase64Encoded")
		if v, ok := resp["video"].(string); ok {
			resp["video"] = truncateBase64(v)
		}
		if vs, ok := resp["videos"].([]any); ok {
			for i := range vs {
				if vm, ok := vs[i].(map[string]any); ok {
					delete(vm, "bytesBase64Encoded")
				}
			}
		}
	}
	// GCS 转存模式下的 URL 脱敏（设计 4.5 出口 4）：task.Data 会经 TaskModel2Dto.Data /
	// 任务列表 / sora 原始透传原样对外返回，上游时效直链一律剥除——转存中的任务不得
	// 泄露上游直链。转存重试不受影响：重试的 URL 来源是 PrivateData.UpstreamAssets，
	// Extract 暂存先于本脱敏发生。开关关闭（直链透传模式）时不剥除，维持现状。
	if setting.GCSTransferEnabled {
		redactHTTPURLValues(m)
	}
	b, err := common.Marshal(m)
	if err != nil {
		return body
	}
	return b
}

// redactHTTPURLValues 递归把 JSON 树中“值本身是 http(s) URL”的字符串替换为空串。
// 只匹配整值前缀（http:// 或 https://），不动嵌在长文本中间的 URL 片段。
func redactHTTPURLValues(node any) {
	switch n := node.(type) {
	case map[string]any:
		for k, v := range n {
			if s, ok := v.(string); ok {
				if isHTTPURLValue(s) {
					n[k] = ""
				}
				continue
			}
			redactHTTPURLValues(v)
		}
	case []any:
		for i, v := range n {
			if s, ok := v.(string); ok {
				if isHTTPURLValue(s) {
					n[i] = ""
				}
				continue
			}
			redactHTTPURLValues(v)
		}
	}
}

func isHTTPURLValue(s string) bool {
	s = strings.ToLower(strings.TrimSpace(s))
	return strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://")
}

func truncateBase64(s string) string {
	const maxKeep = 256
	if len(s) <= maxKeep {
		return s
	}
	return s[:maxKeep] + "..."
}

// settleTaskBillingOnComplete 任务完成时的统一计费调整。
// 优先级：1. adaptor.AdjustBillingOnComplete 返回正数 → 使用 adaptor 计算的额度
//
//  2. taskResult.TotalTokens > 0 → 按 token 重算
//  3. 都不满足 → 保持预扣额度不变
func settleTaskBillingOnComplete(ctx context.Context, adaptor TaskPollingAdaptor, task *model.Task, taskResult *relaycommon.TaskInfo) {
	// 0. 按次计费的任务不做差额结算
	if bc := task.PrivateData.BillingContext; bc != nil && bc.PerCallBilling {
		logger.LogInfo(ctx, fmt.Sprintf("任务 %s 按次计费，跳过差额结算", task.TaskID))
		return
	}
	// 1. 优先让 adaptor 决定最终额度
	if actualQuota := adaptor.AdjustBillingOnComplete(task, taskResult); actualQuota > 0 {
		RecalculateTaskQuota(ctx, task, actualQuota, "adaptor计费调整")
		return
	}
	// 2. 回退到 token 重算
	if taskResult.TotalTokens > 0 {
		RecalculateTaskQuotaByTokens(ctx, task, taskResult.TotalTokens)
		return
	}
	// 3. 无调整，保持预扣额度
}
