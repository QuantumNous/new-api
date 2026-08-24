package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/samber/lo"
)

// TaskPollingAdaptor 定义轮询所需的最小适配器接口，避免 service -> relay 的循环依赖
type TaskPollingAdaptor interface {
	Init(info *relaycommon.RelayInfo)
	FetchTask(baseURL string, key string, body map[string]any, proxy string) (*http.Response, error)
	ParseTaskResult(body []byte) (*relaycommon.TaskInfo, error)
	// AdjustBillingOnComplete 在任务到达终态（成功/失败）时由轮询循环调用。
	// 返回正数触发差额结算（补扣/退还），返回 0 保持预扣费金额不变。
	AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int
}

type contextTaskPollingAdaptor interface {
	FetchTaskWithContext(ctx context.Context, baseURL string, key string, body map[string]any, proxy string) (*http.Response, error)
}

func FetchTaskWithContext(ctx context.Context, adaptor TaskPollingAdaptor, baseURL string, key string, body map[string]any, proxy string) (*http.Response, error) {
	if contextAdaptor, ok := adaptor.(contextTaskPollingAdaptor); ok {
		return contextAdaptor.FetchTaskWithContext(ctx, baseURL, key, body, proxy)
	}
	return adaptor.FetchTask(baseURL, key, body, proxy)
}

type perCallTaskBillingAdjuster interface {
	AdjustPerCallBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int
}

// GetTaskAdaptorFunc 由 main 包注入，用于获取指定平台的任务适配器。
// 打破 service -> relay -> relay/channel -> service 的循环依赖。
var GetTaskAdaptorFunc func(platform constant.TaskPlatform) TaskPollingAdaptor

var archiveVideoResultForChannel = ArchiveVideoResultForChannel
var archiveTechMobiVideoResult = ArchiveVideoResult
var archiveModelAPIVideoResult = func(ctx context.Context, publicTaskID, upstreamURL, proxy string) (*model.VideoResult, error) {
	return archiveVideoResultForChannel(ctx, "modelapi", publicTaskID, upstreamURL, proxy)
}

var taskVideoResultArchiveLeaseHeartbeatInterval time.Duration

const (
	modelAPIPollingRequestTimeout                   = 30 * time.Second
	modelAPIPollingResponseMaxBytes                 = 1 << 20
	taskVideoResultArchiveLeaseMinHeartbeatInterval = 5 * time.Second
)

var archivedVideoLogURLPattern = regexp.MustCompile(`https?://[^\s"'<>]+`)

var errTaskVideoResultArchiveLeaseLost = errors.New("video_result_archive_lease_lost")

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
		pollUnfinishedTasksOnce(ctx)
		common.SysLog("任务进度轮询完成")
	}
}

func pollUnfinishedTasksOnce(ctx context.Context) {
	sweepTimedOutTasks(ctx)
	allTasks := model.GetAllUnFinishSyncTasks(constant.TaskQueryLimit)
	platformTask := make(map[constant.TaskPlatform][]*model.Task)
	for _, t := range allTasks {
		platformTask[t.Platform] = append(platformTask[t.Platform], t)
	}
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
	resp, err := FetchTaskWithContext(ctx, adaptor, *ch.BaseURL, ch.Key, map[string]any{
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
			logger.LogError(ctx, fmt.Sprintf("Failed to update video async tasks: %s", err.Error()))
		}
	}
	return nil
}

func updateVideoTasks(ctx context.Context, platform constant.TaskPlatform, channelId int, taskIds []string, taskM map[string]*model.Task) error {
	logger.LogInfo(ctx, fmt.Sprintf("Pending video tasks: %d", len(taskIds)))
	if len(taskIds) == 0 {
		return nil
	}
	cacheGetChannel, err := model.CacheGetChannel(channelId)
	if err != nil {
		// Collect DB primary key IDs for bulk update (taskIds are upstream IDs, not task_id column values)
		var failedIDs []int64
		for _, upstreamID := range taskIds {
			if t, ok := taskM[upstreamID]; ok {
				failedIDs = append(failedIDs, t.ID)
			}
		}
		errUpdate := model.TaskBulkUpdateByID(failedIDs, map[string]any{
			"fail_reason": fmt.Sprintf("Failed to get channel info, channel ID: %d", channelId),
			"status":      "FAILURE",
			"progress":    "100%",
		})
		if errUpdate != nil {
			common.SysLog(fmt.Sprintf("UpdateVideoTask error: %v", errUpdate))
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
			logger.LogError(ctx, fmt.Sprintf("Failed to update video task: %s", err.Error()))
		}
		// sleep 1 second between each task to avoid hitting rate limits of upstream platforms
		time.Sleep(1 * time.Second)
	}
	return nil
}

func startTaskVideoResultArchiveLeaseHeartbeat(ctx context.Context, cancel context.CancelFunc, taskID string, fromStatus model.TaskStatus, owner string, initialLeaseExpiresAt int64, leaseTTL time.Duration) func() (int64, error) {
	interval := effectiveTaskVideoResultArchiveLeaseHeartbeatInterval(leaseTTL)
	stop := make(chan struct{})
	done := make(chan error, 1)
	var lost atomic.Bool
	var latestExpiry atomic.Int64
	latestExpiry.Store(initialLeaseExpiresAt)

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				done <- nil
				return
			case <-ctx.Done():
				done <- ctx.Err()
				return
			case <-ticker.C:
				now, err := model.GetDBTimestampWithContext(ctx)
				if err != nil {
					lost.Store(true)
					cancel()
					done <- errTaskVideoResultArchiveLeaseLost
					return
				}
				expected := latestExpiry.Load()
				nextExpiry := now + int64(leaseTTL.Seconds())
				won, err := model.RenewTaskVideoResultArchiveLease(taskID, fromStatus, owner, expected, now, nextExpiry)
				if err != nil || !won {
					lost.Store(true)
					cancel()
					done <- errTaskVideoResultArchiveLeaseLost
					return
				}
				latestExpiry.Store(nextExpiry)
			}
		}
	}()

	return func() (int64, error) {
		if lost.Load() {
			return latestExpiry.Load(), <-done
		}
		close(stop)
		err := <-done
		if errors.Is(err, context.Canceled) {
			return latestExpiry.Load(), nil
		}
		return latestExpiry.Load(), err
	}
}

func effectiveTaskVideoResultArchiveLeaseHeartbeatInterval(leaseTTL time.Duration) time.Duration {
	if taskVideoResultArchiveLeaseHeartbeatInterval > 0 {
		return taskVideoResultArchiveLeaseHeartbeatInterval
	}
	interval := leaseTTL / 3
	if interval > time.Minute {
		interval = time.Minute
	}
	if interval < taskVideoResultArchiveLeaseMinHeartbeatInterval {
		interval = taskVideoResultArchiveLeaseMinHeartbeatInterval
	}
	if leaseTTL > 0 && interval >= leaseTTL {
		interval = leaseTTL / 2
	}
	if interval <= 0 {
		interval = time.Second
	}
	return interval
}

func updateVideoSingleTask(ctx context.Context, adaptor TaskPollingAdaptor, ch *model.Channel, taskId string, taskM map[string]*model.Task) error {
	baseURL := constant.ChannelBaseURLs[ch.Type]
	if ch.GetBaseURL() != "" {
		baseURL = ch.GetBaseURL()
	}
	channelSetting := ch.GetSetting()
	proxy := channelSetting.Proxy
	returnSourceURL := ch.Type == constant.ChannelTypeTechMobiVideo && channelSetting.ReturnSourceURL
	isGrokSubscriptionTask := ch.Type == constant.ChannelTypeGrokSubscription

	task := taskM[taskId]
	if task == nil {
		logger.LogError(ctx, "Task not found in taskM")
		return errors.New("task not found")
	}
	if ch.Type == constant.ChannelTypeModelAPISeedance && strings.TrimSpace(proxy) != "" {
		return archivedVideoPollingPhaseError(task.TaskID, "fetch")
	}
	key := ch.Key

	privateData := task.PrivateData
	if privateData.Key != "" {
		key = privateData.Key
	}
	if ch.Type == constant.ChannelTypeGrokSubscription {
		key = ""
	}
	upstreamTaskID := task.GetUpstreamTaskID()
	pollingCtx := ctx
	var cancelPolling context.CancelFunc
	if ch.Type == constant.ChannelTypeModelAPISeedance {
		pollingCtx, cancelPolling = context.WithTimeout(ctx, modelAPIPollingRequestTimeout)
		defer cancelPolling()
	}
	resp, err := FetchTaskWithContext(pollingCtx, adaptor, baseURL, key, map[string]any{
		"task_id":    upstreamTaskID,
		"action":     task.Action,
		"channel_id": ch.Id,
	}, proxy)
	if err != nil {
		if VideoResultChannelLabel(ch.Type) != "" {
			return archivedVideoPollingPhaseError(task.TaskID, "fetch")
		}
		return fmt.Errorf("fetchTask failed for task %s: %w", task.TaskID, err)
	}
	defer resp.Body.Close()
	responseBody, err := readVideoPollingResponseBody(pollingCtx, ch.Type, resp.Body)
	if err != nil {
		if VideoResultChannelLabel(ch.Type) != "" {
			return archivedVideoPollingPhaseError(task.TaskID, "read")
		}
		return fmt.Errorf("readAll failed for task %s: %w", task.TaskID, err)
	}

	if VideoResultChannelLabel(ch.Type) != "" || isGrokSubscriptionTask {
		logger.LogDebug(ctx, "updateVideoSingleTask response received: task_id=%s phase=fetched bytes=%d", task.TaskID, len(responseBody))
	} else {
		logger.LogDebug(ctx, "updateVideoSingleTask response: %s", responseBody)
	}

	snap := task.Snapshot()

	taskResult := &relaycommon.TaskInfo{}
	// try parse as New API response format
	var responseItems dto.TaskResponse[model.Task]
	if ch.Type != constant.ChannelTypeModelAPISeedance && common.Unmarshal(responseBody, &responseItems) == nil && responseItems.IsSuccess() {
		if VideoResultChannelLabel(ch.Type) != "" || isGrokSubscriptionTask {
			logger.LogDebug(ctx, "updateVideoSingleTask parsed as new api response format: task_id=%s phase=parsed status=%s", task.TaskID, archivedVideoPollingStatus(string(responseItems.Data.Status)))
		} else {
			logger.LogDebug(ctx, "updateVideoSingleTask parsed as new api response format: %+v", responseItems)
		}
		t := responseItems.Data
		taskResult.TaskID = t.TaskID
		taskResult.Status = string(t.Status)
		taskResult.Url = t.GetResultURL()
		taskResult.Progress = t.Progress
		taskResult.Reason = t.FailReason
		task.Data = t.Data
	} else if taskResult, err = adaptor.ParseTaskResult(responseBody); err != nil {
		if VideoResultChannelLabel(ch.Type) != "" {
			return archivedVideoPollingPhaseError(task.TaskID, "parse")
		}
		return fmt.Errorf("parseTaskResult failed for task %s: %w", task.TaskID, err)
	}

	task.Data = redactVideoResponseForChannel(ch.Type, responseBody)

	if VideoResultChannelLabel(ch.Type) != "" || isGrokSubscriptionTask {
		logger.LogDebug(ctx, "updateVideoSingleTask task result parsed: task_id=%s phase=parsed status=%s", task.TaskID, archivedVideoPollingStatus(taskResult.Status))
	} else {
		logger.LogDebug(ctx, "updateVideoSingleTask taskResult: %+v", taskResult)
	}

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
				if VideoResultChannelLabel(ch.Type) != "" || isGrokSubscriptionTask {
					logger.LogError(ctx, fmt.Sprintf("Task %s returned empty status with unrecognized error format", task.TaskID))
				} else {
					logger.LogError(ctx, fmt.Sprintf("Task %s returned empty status with unrecognized error format, response: %s", task.TaskID, string(responseBody)))
				}
				taskResult = relaycommon.FailTaskInfo("upstream returned unrecognized message")
			}
		}
	}

	archiveChannelLabel := VideoResultChannelLabel(ch.Type)
	if (returnSourceURL || (archiveChannelLabel != "" && !returnSourceURL)) &&
		taskResult.Status == model.TaskStatusSuccess && snap.Status != model.TaskStatusSuccess && strings.TrimSpace(taskResult.Url) == "" {
		return fmt.Errorf("task %s missing source URL: phase=source status=%s", task.TaskID, archivedVideoPollingStatus(taskResult.Status))
	}

	var (
		archiveLeaseOwner         string
		archiveLeaseExpiresAt     int64
		archiveLeaseClaimed       bool
		stopArchiveLeaseHeartbeat func() (int64, error)
		cancelArchiveLeaseContext context.CancelFunc
	)
	releaseArchiveLease := func() {
		if !archiveLeaseClaimed {
			return
		}
		cleanupCtx, cancelCleanup := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancelCleanup()
		releaseNow, dbErr := model.GetDBTimestampWithContext(cleanupCtx)
		if dbErr != nil {
			logger.LogError(ctx, fmt.Sprintf("GetDBTimestampWithContext failed before archive lease release for task %s: %s", task.TaskID, dbErr.Error()))
			return
		}
		released, releaseErr := model.ReleaseTaskVideoResultArchiveLeaseWithContext(cleanupCtx, task.TaskID, snap.Status, archiveLeaseOwner, archiveLeaseExpiresAt, releaseNow)
		if releaseErr != nil {
			logger.LogError(ctx, fmt.Sprintf("ReleaseTaskVideoResultArchiveLease failed for task %s: %s", task.TaskID, releaseErr.Error()))
			return
		}
		if !released {
			logger.LogWarn(ctx, fmt.Sprintf("Task %s archive lease was already moved, skip release", task.TaskID))
		}
	}

	if archiveChannelLabel != "" && !returnSourceURL && taskResult.Status == model.TaskStatusSuccess && snap.Status != model.TaskStatusSuccess {
		if task.PrivateData.VideoResult == nil {
			var (
				videoResult *model.VideoResult
				archiveErr  error
			)
			archiveCtx := ctx
			if ch.Type == constant.ChannelTypeModelAPISeedance {
				dbNow, dbErr := model.GetDBTimestampWithContext(ctx)
				if dbErr != nil {
					logger.LogError(ctx, fmt.Sprintf("GetDBTimestampWithContext failed before archive lease for task %s: %s", task.TaskID, dbErr.Error()))
					return archivedVideoPollingPhaseError(task.TaskID, "archive")
				}
				archiveLeaseOwner = common.GetUUID()
				archiveLeaseTTL := CurrentVideoResultStorageConfig().FetchTimeout + time.Minute
				archiveLeaseExpiresAt = dbNow + int64(archiveLeaseTTL.Seconds())
				claimed, claimErr := model.ClaimTaskVideoResultArchiveLease(task.TaskID, snap.Status, archiveLeaseOwner, dbNow, archiveLeaseExpiresAt)
				if claimErr != nil {
					logger.LogError(ctx, fmt.Sprintf("ClaimTaskVideoResultArchiveLease failed for task %s: %s", task.TaskID, claimErr.Error()))
					return archivedVideoPollingPhaseError(task.TaskID, "archive")
				}
				if !claimed {
					logger.LogWarn(ctx, fmt.Sprintf("Task %s archive lease already claimed or finalized, skip archive", task.TaskID))
					return nil
				}
				archiveLeaseClaimed = true
				archiveCtx, cancelArchiveLeaseContext = context.WithCancel(ctx)
				stopArchiveLeaseHeartbeat = startTaskVideoResultArchiveLeaseHeartbeat(archiveCtx, cancelArchiveLeaseContext, task.TaskID, snap.Status, archiveLeaseOwner, archiveLeaseExpiresAt, archiveLeaseTTL)
			}
			switch ch.Type {
			case constant.ChannelTypeTechMobiVideo:
				videoResult, archiveErr = archiveTechMobiVideoResult(ctx, task.TaskID, taskResult.Url, proxy)
			case constant.ChannelTypeModelAPISeedance:
				videoResult, archiveErr = archiveModelAPIVideoResult(archiveCtx, task.TaskID, taskResult.Url, proxy)
			default:
				videoResult, archiveErr = archiveVideoResultForChannel(ctx, archiveChannelLabel, task.TaskID, taskResult.Url, proxy)
			}
			if stopArchiveLeaseHeartbeat != nil {
				latestExpiry, heartbeatErr := stopArchiveLeaseHeartbeat()
				archiveLeaseExpiresAt = latestExpiry
				if cancelArchiveLeaseContext != nil {
					cancelArchiveLeaseContext()
				}
				if heartbeatErr != nil && archiveErr == nil {
					archiveErr = heartbeatErr
				}
			}
			if archiveErr != nil {
				if archiveLeaseClaimed {
					releaseArchiveLease()
				}
				perfmetrics.RecordVideoResultArchiveRetry(archiveChannelLabel, "archive_failure")
				return fmt.Errorf("video archive failed for task %s: phase=archive status=%s: %s", task.TaskID, archivedVideoPollingStatus(taskResult.Status), sanitizeVideoResultArchiveError(archiveErr))
			}
			task.PrivateData.VideoResult = videoResult
		}
	}

	// Persist upstream token usage so both query formats can surface it.
	if taskResult.CompletionTokens > 0 || taskResult.TotalTokens > 0 {
		task.PrivateData.CompletionTokens = taskResult.CompletionTokens
		task.PrivateData.TotalTokens = taskResult.TotalTokens
	}

	shouldRefund := false
	shouldSettle := false
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
		task.Progress = taskcommon.ProgressComplete
		if task.FinishTime == 0 {
			task.FinishTime = now
		}
		if ch.Type == constant.ChannelTypeGrokSubscription {
			task.PrivateData.GrokVideoResult = &model.GrokSubscriptionVideoResult{
				URL:         strings.TrimSpace(taskResult.Url),
				Duration:    taskResult.Duration,
				Resolution:  strings.TrimSpace(taskResult.Resolution),
				RefreshedAt: now,
			}
			task.PrivateData.ResultURL = taskcommon.BuildProxyURL(task.TaskID)
		} else if strings.HasPrefix(taskResult.Url, "data:") {
			// data: URI (e.g. Vertex base64 encoded video) — keep in Data, not in ResultURL
			task.PrivateData.ResultURL = taskcommon.BuildProxyURL(task.TaskID)
		} else if returnSourceURL {
			task.PrivateData.ResultURL = strings.TrimSpace(taskResult.Url)
		} else if taskcommon.ShouldWhitelabelChannelType(ch.Type) {
			// Whitelabel channel: never expose upstream URL to customers. The
			// real URL stays in task.Data (used by controller.VideoProxy).
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
		if VideoResultChannelLabel(ch.Type) != "" || isGrokSubscriptionTask {
			logger.LogInfo(ctx, fmt.Sprintf("Archived video task failed: task_id=%s status=%s", task.TaskID, taskResult.Status))
		} else {
			logger.LogJson(ctx, fmt.Sprintf("Task %s failed", taskId), task)
		}
		task.Status = model.TaskStatusFailure
		task.Progress = taskcommon.ProgressComplete
		if task.FinishTime == 0 {
			task.FinishTime = now
		}
		task.FailReason = taskResult.Reason
		if VideoResultChannelLabel(ch.Type) != "" || isGrokSubscriptionTask {
			task.FailReason = sanitizeArchivedVideoLogText(ch.Type, task.FailReason)
			logger.LogInfo(ctx, fmt.Sprintf("Task %s failed: status=%s", task.TaskID, task.Status))
		} else {
			logger.LogInfo(ctx, fmt.Sprintf("Task %s failed: %s", task.TaskID, task.FailReason))
		}
		taskResult.Progress = taskcommon.ProgressComplete
		if quota != 0 {
			shouldRefund = true
		}
	default:
		if VideoResultChannelLabel(ch.Type) != "" || isGrokSubscriptionTask {
			return fmt.Errorf("unknown task status for task %s: phase=status status=%s", task.TaskID, archivedVideoPollingStatus(taskResult.Status))
		}
		return fmt.Errorf("unknown task status %s for task %s", taskResult.Status, task.TaskID)
	}
	if taskResult.Progress != "" {
		task.Progress = taskResult.Progress
	}

	isDone := task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure
	if isDone && snap.Status != task.Status {
		var won bool
		var err error
		if archiveLeaseClaimed {
			dbNow, dbErr := model.GetDBTimestampWithContext(ctx)
			if dbErr != nil {
				logger.LogError(ctx, fmt.Sprintf("GetDBTimestampWithContext failed before archive finalize for task %s: %s", task.TaskID, dbErr.Error()))
				releaseArchiveLease()
				shouldRefund = false
				shouldSettle = false
			} else {
				won, err = task.UpdateWithStatusAndVideoResultArchiveLease(snap.Status, archiveLeaseOwner, archiveLeaseExpiresAt, dbNow)
				if err != nil || !won {
					releaseArchiveLease()
				}
			}
		} else {
			won, err = task.UpdateWithStatus(snap.Status)
		}
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("UpdateWithStatus failed for task %s: %s", task.TaskID, err.Error()))
			shouldRefund = false
			shouldSettle = false
		} else if !won {
			logger.LogWarn(ctx, fmt.Sprintf("Task %s already transitioned by another process, skip billing", task.TaskID))
			shouldRefund = false
			shouldSettle = false
		}
	} else if isDone {
		shouldRefund = false
		shouldSettle = false
	} else if !snap.Equal(task.Snapshot()) {
		if _, err := task.UpdateWithStatus(snap.Status); err != nil {
			logger.LogError(ctx, fmt.Sprintf("Failed to update task %s: %s", task.TaskID, err.Error()))
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
	b, err := common.Marshal(m)
	if err != nil {
		return body
	}
	return b
}

func redactVideoResponseForChannel(channelType int, body []byte) []byte {
	redacted := redactVideoResponseBody(body)
	if channelType == constant.ChannelTypeTechMobiVideo {
		return redactArchivedVideoResponseBody(redacted, false)
	}
	if channelType == constant.ChannelTypeModelAPISeedance {
		return redactArchivedVideoResponseBody(redacted, true)
	}
	if channelType == constant.ChannelTypeGrokSubscription {
		return redactArchivedVideoResponseBody(redacted, true)
	}
	return redacted
}

func redactTechMobiVideoResponseBody(body []byte) []byte {
	return redactArchivedVideoResponseBody(body, false)
}

func redactArchivedVideoResponseBody(body []byte, scrubBrand bool) []byte {
	var value any
	if err := common.Unmarshal(body, &value); err != nil {
		return body
	}
	redacted := redactArchivedVideoValue(value, scrubBrand)
	b, err := common.Marshal(redacted)
	if err != nil {
		return body
	}
	return b
}

func redactArchivedVideoValue(v any, scrubBrand bool) any {
	switch value := v.(type) {
	case map[string]any:
		for key, child := range value {
			if scrubBrand && isArchivedVideoPrivateIdentifierKey(key) {
				delete(value, key)
				continue
			}
			if isArchivedVideoURLKey(key) {
				value[key] = redactArchivedVideoURLValue(child, scrubBrand)
				continue
			}
			value[key] = redactArchivedVideoValue(child, scrubBrand)
		}
		return value
	case []any:
		for i, child := range value {
			value[i] = redactArchivedVideoValue(child, scrubBrand)
		}
		return value
	case string:
		return sanitizeArchivedVideoString(value, scrubBrand)
	default:
		return value
	}
}

func isArchivedVideoPrivateIdentifierKey(key string) bool {
	normalized := strings.ToLower(strings.ReplaceAll(key, "_", ""))
	return normalized == "id" || normalized == "taskid"
}

func redactArchivedVideoURLValue(v any, scrubBrand bool) any {
	return redactArchivedVideoValue(v, scrubBrand)
}

func isTechMobiVideoURLKey(key string) bool {
	return isArchivedVideoURLKey(key)
}

func isArchivedVideoURLKey(key string) bool {
	normalized := strings.ToLower(strings.ReplaceAll(key, "_", ""))
	switch normalized {
	case "url", "videourl", "downloadurl", "fileurl", "objecturl", "remoteurl":
		return true
	default:
		return false
	}
}

func sanitizeVideoResultArchiveError(err error) string {
	if err == nil {
		return "unknown error"
	}
	if errors.Is(err, ErrVideoResultConfig) {
		return ErrVideoResultConfig.Error()
	}
	if errors.Is(err, ErrVideoResultInvalidTaskID) {
		return ErrVideoResultInvalidTaskID.Error()
	}
	if errors.Is(err, ErrVideoResultInvalidContent) {
		return ErrVideoResultInvalidContent.Error()
	}
	if errors.Is(err, ErrVideoResultTooLarge) {
		return ErrVideoResultTooLarge.Error()
	}
	if errors.Is(err, ErrVideoResultAlreadyExists) {
		return ErrVideoResultAlreadyExists.Error()
	}
	if errors.Is(err, ErrVideoResultUnavailable) {
		return ErrVideoResultUnavailable.Error()
	}
	return "archive unavailable"
}

func archivedVideoPollingPhaseError(taskID, phase string) error {
	return fmt.Errorf("task %s polling failed: phase=%s", taskID, phase)
}

func archivedVideoPollingStatus(status string) string {
	switch model.TaskStatus(status) {
	case model.TaskStatusSubmitted, model.TaskStatusQueued, model.TaskStatusInProgress, model.TaskStatusSuccess, model.TaskStatusFailure:
		return status
	default:
		return "unknown"
	}
}

func readVideoPollingResponseBody(ctx context.Context, channelType int, body io.Reader) ([]byte, error) {
	if channelType != constant.ChannelTypeModelAPISeedance {
		return io.ReadAll(body)
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	responseBody, err := io.ReadAll(io.LimitReader(body, modelAPIPollingResponseMaxBytes+1))
	if err != nil {
		return nil, err
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if len(responseBody) > modelAPIPollingResponseMaxBytes {
		return nil, errors.New("polling response too large")
	}
	return responseBody, nil
}

func sanitizeArchivedVideoLogText(channelType int, text string) string {
	if strings.TrimSpace(text) == "" {
		return ""
	}
	scrubBrand := channelType == constant.ChannelTypeModelAPISeedance
	return sanitizeArchivedVideoString(text, scrubBrand)
}

func sanitizeTechMobiLogText(text string) string {
	return sanitizeArchivedVideoLogText(constant.ChannelTypeTechMobiVideo, text)
}

func sanitizeArchivedVideoString(text string, scrubBrand bool) string {
	redacted := redactArchivedVideoURLs(text)
	if scrubBrand {
		return taskcommon.ScrubBrandedText(redacted)
	}
	return redacted
}

func redactTechMobiURLs(text string) string {
	return redactArchivedVideoURLs(text)
}

func redactArchivedVideoURLs(text string) string {
	return archivedVideoLogURLPattern.ReplaceAllStringFunc(text, func(match string) string {
		trimmed := strings.TrimRight(match, ",.;:)")
		return "[redacted]" + match[len(trimmed):]
	})
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
	// 0. 按次计费默认不做差额结算；仅显式实现可选接口的适配器可以调整。
	if bc := task.PrivateData.BillingContext; bc != nil && bc.PerCallBilling {
		if adjuster, ok := adaptor.(perCallTaskBillingAdjuster); ok {
			if actualQuota := adjuster.AdjustPerCallBillingOnComplete(task, taskResult); actualQuota > 0 {
				RecalculateTaskQuota(ctx, task, actualQuota, "adaptor计费调整")
			}
		}
		logger.LogInfo(ctx, fmt.Sprintf("任务 %s 按次计费，跳过 token 差额结算", task.TaskID))
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
