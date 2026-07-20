package controller

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const (
	channelMonitorSmartScheduleTaskType        = "channel_smart_schedule"
	channelMonitorSmartScheduleMinWeight       = 10
	channelMonitorSmartScheduleMaxWeight       = 100
	channelMonitorSmartScheduleWeightStep      = 5
	channelMonitorSmartScheduleMinWeightChange = 10
	channelMonitorSmartScheduleMaxWeightChange = 20
	maxChannelSmartScheduleTaskFailureDetails  = 100
)

type channelSmartScheduleTaskHandler struct{}

type channelSmartScheduleTaskPayload struct {
	ForceReset bool `json:"force_reset,omitempty"`
}

type channelSmartSchedulePerformance struct {
	FirstTokenSampleCount int
	TPSSampleCount        int
	FirstTokenTotalMs     float64
	TPSTotal              float64
	AverageFirstTokenMs   *float64
	AverageTPS            *float64
	StabilitySuccessCount int64
	StabilityFailureCount int64
	StabilitySampleCount  int64
	Stability             *float64
}

type channelSmartScheduleCandidate struct {
	ChannelId             int
	CurrentPriority       int64
	CurrentWeight         uint
	Ratio                 *float64
	FirstTokenMs          *float64
	TPS                   *float64
	FirstTokenSampleCount int
	TPSSampleCount        int
	StabilitySampleCount  int64
	Stability             *float64
	StabilityAvailable    bool
}

type channelSmartSchedulePlanItem struct {
	ChannelId       int
	Score           float64
	CurrentPriority int64
	CurrentWeight   uint
	TargetPriority  int64
	TargetWeight    uint
}

type channelSmartSchedulePlan struct {
	Items   []channelSmartSchedulePlanItem
	Skipped map[int]string
}

type channelSmartScheduleTaskFailure struct {
	ChannelId   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	Error       string `json:"error"`
}

type channelSmartScheduleTaskResult struct {
	Strategy                string                            `json:"strategy"`
	StabilityEnabled        bool                              `json:"stability_enabled"`
	ForceReset              bool                              `json:"force_reset"`
	ApplyMode               string                            `json:"apply_mode"`
	Model                   string                            `json:"model"`
	PerformanceMinutes      int                               `json:"performance_minutes"`
	MinSamples              int                               `json:"min_samples"`
	Total                   int                               `json:"total"`
	Planned                 int                               `json:"planned"`
	Updated                 int                               `json:"updated"`
	Unchanged               int                               `json:"unchanged"`
	Skipped                 int                               `json:"skipped"`
	Failed                  int                               `json:"failed"`
	Failures                []channelSmartScheduleTaskFailure `json:"failures,omitempty"`
	FailureDetailsTruncated bool                              `json:"failure_details_truncated,omitempty"`
}

func init() {
	service.RegisterSystemTaskHandler(channelSmartScheduleTaskHandler{})
}

func (channelSmartScheduleTaskHandler) Type() string {
	return channelMonitorSmartScheduleTaskType
}

func (channelSmartScheduleTaskHandler) Enabled() bool {
	return getChannelMonitorSettings().SmartScheduleEnabled
}

func (channelSmartScheduleTaskHandler) Interval() time.Duration {
	minutes := getChannelMonitorSettings().SmartScheduleIntervalMinutes
	if minutes <= 0 {
		minutes = defaultChannelMonitorSmartScheduleInterval
	}
	return time.Duration(minutes) * time.Minute
}

func (channelSmartScheduleTaskHandler) NewPayload() any { return nil }

func (channelSmartScheduleTaskHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	payload := channelSmartScheduleTaskPayload{}
	if err := task.DecodePayload(&payload); err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, channelSmartScheduleTaskResult{}, err)
		return
	}
	summary, err := runChannelSmartScheduleOnce(
		ctx,
		service.NewSystemTaskProgressReporter(task, runnerID),
		payload.ForceReset,
	)
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, summary, err)
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}

func RunChannelMonitorSmartSchedule(c *gin.Context) {
	task, created, err := service.EnqueueSystemTask(channelMonitorSmartScheduleTaskType, nil)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_smart_schedule_run", map[string]interface{}{
		"created": created,
		"task_id": task.TaskID,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"created": created,
			"task":    task.ToResponse(),
		},
	})
}

func (result *channelSmartScheduleTaskResult) recordFailure(channelId int, channelName string, failure error) {
	result.Failed++
	if len(result.Failures) >= maxChannelSmartScheduleTaskFailureDetails {
		result.FailureDetailsTruncated = true
		return
	}
	message := "智能调度更新失败"
	if failure != nil && failure.Error() != "" {
		message = failure.Error()
	}
	messageRunes := []rune(message)
	if len(messageRunes) > 255 {
		message = string(messageRunes[:255])
	}
	nameRunes := []rune(channelName)
	if len(nameRunes) > 128 {
		channelName = string(nameRunes[:128])
	}
	result.Failures = append(result.Failures, channelSmartScheduleTaskFailure{
		ChannelId:   channelId,
		ChannelName: channelName,
		Error:       message,
	})
}

func runChannelSmartScheduleOnce(ctx context.Context, reportProgress func(processed, total int), forceReset bool) (channelSmartScheduleTaskResult, error) {
	if reportProgress == nil {
		reportProgress = func(int, int) {}
	}
	settings := getChannelMonitorSettings()
	result := channelSmartScheduleTaskResult{
		Strategy:           settings.SmartScheduleStrategy,
		StabilityEnabled:   settings.SmartScheduleStabilityEnabled,
		ForceReset:         forceReset,
		ApplyMode:          settings.SmartScheduleApplyMode,
		Model:              settings.SmartScheduleModel,
		PerformanceMinutes: settings.SmartSchedulePerformanceMinutes,
		MinSamples:         settings.SmartScheduleMinSamples,
	}

	channels, err := model.GetAllChannelsForMonitor()
	if err != nil {
		return result, err
	}
	result.Total = len(channels)
	monitors, err := model.GetChannelRatioMonitors()
	if err != nil {
		return result, err
	}
	monitorByChannel := make(map[int]model.ChannelRatioMonitor, len(monitors))
	for _, monitor := range monitors {
		monitorByChannel[monitor.ChannelId] = monitor
	}
	channelCacheDirty := false
	defer func() {
		if channelCacheDirty {
			model.InitChannelCache()
		}
	}()
	if forceReset {
		channelIds := make([]int, 0, len(channels))
		for _, channel := range channels {
			if channel.Status != common.ChannelStatusEnabled || monitorByChannel[channel.Id].SmartScheduleExcluded {
				continue
			}
			channelIds = append(channelIds, channel.Id)
		}
		if err := model.ResetChannelSmartSchedulePriorityWeight(channelIds, channelMonitorSmartScheduleMinWeight); err != nil {
			return result, err
		}
		channelCacheDirty = len(channelIds) > 0
	}
	needsPerformance := settings.SmartScheduleStrategy == channelMonitorSmartScheduleStrategyFirstToken ||
		settings.SmartScheduleStrategy == channelMonitorSmartScheduleStrategyTPS ||
		settings.SmartScheduleStrategy == channelMonitorSmartScheduleStrategySmart
	needsRatio := settings.SmartScheduleStrategy == channelMonitorSmartScheduleStrategyRatio ||
		settings.SmartScheduleStrategy == channelMonitorSmartScheduleStrategySmart
	needsStability := settings.SmartScheduleStabilityEnabled
	var metrics []model.ChannelMonitorPerformanceMetric
	if needsPerformance {
		metrics, err = model.GetChannelMonitorPerformanceMetrics(
			ctx,
			time.Now().Unix()-int64(settings.SmartSchedulePerformanceMinutes*60),
		)
		if err != nil {
			return result, err
		}
	}
	stabilityAvailable := common.LogConsumeEnabled && constant.ErrorLogEnabled
	var stabilityMetrics []model.ChannelMonitorStabilityMetric
	if needsStability && stabilityAvailable {
		stabilityMetrics, err = model.GetChannelMonitorStabilityMetrics(
			ctx,
			time.Now().Unix()-int64(settings.SmartSchedulePerformanceMinutes*60),
		)
		if err != nil {
			return result, err
		}
	}

	performanceByChannel := make(map[int]*channelSmartSchedulePerformance)
	for _, metric := range metrics {
		if settings.SmartScheduleModel != "" && metric.ModelName != settings.SmartScheduleModel {
			continue
		}
		performance := performanceByChannel[metric.ChannelId]
		if performance == nil {
			performance = &channelSmartSchedulePerformance{}
			performanceByChannel[metric.ChannelId] = performance
		}
		if metric.AverageFirstTokenMs != nil && metric.FirstTokenSampleCount > 0 {
			performance.FirstTokenSampleCount += metric.FirstTokenSampleCount
			performance.FirstTokenTotalMs += *metric.AverageFirstTokenMs * float64(metric.FirstTokenSampleCount)
		}
		if metric.AverageTPS != nil && metric.TPSSampleCount > 0 {
			performance.TPSSampleCount += metric.TPSSampleCount
			performance.TPSTotal += *metric.AverageTPS * float64(metric.TPSSampleCount)
		}
	}
	for _, metric := range stabilityMetrics {
		if settings.SmartScheduleModel != "" && metric.ModelName != settings.SmartScheduleModel {
			continue
		}
		performance := performanceByChannel[metric.ChannelId]
		if performance == nil {
			performance = &channelSmartSchedulePerformance{}
			performanceByChannel[metric.ChannelId] = performance
		}
		performance.StabilitySuccessCount += metric.SuccessCount
		performance.StabilityFailureCount += metric.FailureCount
	}
	for _, performance := range performanceByChannel {
		if performance.FirstTokenSampleCount > 0 {
			value := performance.FirstTokenTotalMs / float64(performance.FirstTokenSampleCount)
			performance.AverageFirstTokenMs = &value
		}
		if performance.TPSSampleCount > 0 {
			value := performance.TPSTotal / float64(performance.TPSSampleCount)
			performance.AverageTPS = &value
		}
		performance.StabilitySampleCount = performance.StabilitySuccessCount + performance.StabilityFailureCount
		if performance.StabilitySampleCount > 0 {
			value := float64(performance.StabilitySuccessCount) / float64(performance.StabilitySampleCount)
			performance.Stability = &value
		}
	}

	now := common.GetTimestamp()
	candidates := make([]channelSmartScheduleCandidate, 0, len(channels))
	statusUpdates := make([]model.ChannelSmartScheduleResultUpdate, 0, len(channels))
	channelById := make(map[int]*model.Channel, len(channels))
	for _, channel := range channels {
		channelById[channel.Id] = channel
		monitor := monitorByChannel[channel.Id]
		currentPriority := channel.GetPriority()
		currentWeight := uint(channel.GetWeight())
		if forceReset && channel.Status == common.ChannelStatusEnabled && !monitor.SmartScheduleExcluded {
			currentPriority = 0
			currentWeight = channelMonitorSmartScheduleMinWeight
		}
		if channel.Status != common.ChannelStatusEnabled {
			statusUpdates = append(statusUpdates, channelSmartScheduleStatusUpdate(
				channel.Id,
				model.ChannelSmartScheduleStatusSkipped,
				"渠道未启用",
				nil,
				currentPriority,
				currentWeight,
				now,
			))
			result.Skipped++
			continue
		}

		if monitor.SmartScheduleExcluded {
			statusUpdates = append(statusUpdates, channelSmartScheduleStatusUpdate(
				channel.Id,
				model.ChannelSmartScheduleStatusSkipped,
				"已设为不参与智能调度",
				nil,
				currentPriority,
				currentWeight,
				now,
			))
			result.Skipped++
			continue
		}

		var ratio *float64
		if monitor.UpdatedTime > 0 && validateChannelMonitorRatio(&monitor.Ratio) {
			value, _, conversionErr := channelMonitorCostRatioFromModel(monitor, monitor.Ratio)
			if conversionErr != nil && needsRatio {
				statusUpdates = append(statusUpdates, channelSmartScheduleStatusUpdate(
					channel.Id,
					model.ChannelSmartScheduleStatusSkipped,
					"成本倍率换算失败："+conversionErr.Error(),
					nil,
					currentPriority,
					currentWeight,
					now,
				))
				result.Skipped++
				continue
			}
			if conversionErr == nil {
				ratio = &value
			}
		}
		performance := performanceByChannel[channel.Id]
		candidate := channelSmartScheduleCandidate{
			ChannelId:          channel.Id,
			CurrentPriority:    currentPriority,
			CurrentWeight:      currentWeight,
			Ratio:              ratio,
			StabilityAvailable: stabilityAvailable,
		}
		if performance != nil {
			candidate.FirstTokenMs = performance.AverageFirstTokenMs
			candidate.TPS = performance.AverageTPS
			candidate.FirstTokenSampleCount = performance.FirstTokenSampleCount
			candidate.TPSSampleCount = performance.TPSSampleCount
			candidate.Stability = performance.Stability
			candidate.StabilitySampleCount = performance.StabilitySampleCount
		}
		candidates = append(candidates, candidate)
	}

	plan := planChannelSmartSchedule(
		candidates,
		settings.SmartScheduleStrategy,
		settings.SmartScheduleStabilityEnabled,
		settings.SmartScheduleApplyMode,
		settings.SmartScheduleMinSamples,
		forceReset,
	)
	result.Planned = len(plan.Items)
	for _, candidate := range candidates {
		reason, skipped := plan.Skipped[candidate.ChannelId]
		if !skipped {
			continue
		}
		statusUpdates = append(statusUpdates, channelSmartScheduleStatusUpdate(
			candidate.ChannelId,
			model.ChannelSmartScheduleStatusSkipped,
			reason,
			nil,
			candidate.CurrentPriority,
			candidate.CurrentWeight,
			now,
		))
		result.Skipped++
	}

	processed := result.Skipped
	for _, item := range plan.Items {
		select {
		case <-ctx.Done():
			return result, ctx.Err()
		default:
		}

		var priority *int64
		if item.TargetPriority != item.CurrentPriority {
			value := item.TargetPriority
			priority = &value
		}
		var weight *uint
		if item.TargetWeight != item.CurrentWeight {
			value := item.TargetWeight
			weight = &value
		}
		if priority == nil && weight == nil {
			result.Unchanged++
			score := item.Score
			statusUpdates = append(statusUpdates, channelSmartScheduleStatusUpdate(
				item.ChannelId,
				model.ChannelSmartScheduleStatusSucceeded,
				"",
				&score,
				item.TargetPriority,
				item.TargetWeight,
				now,
			))
			processed++
			reportProgress(processed, result.Total)
			continue
		}

		if err := model.UpdateChannelSmartSchedulePriorityWeight(item.ChannelId, priority, weight); err != nil {
			channelName := ""
			if channel := channelById[item.ChannelId]; channel != nil {
				channelName = channel.Name
			}
			result.recordFailure(item.ChannelId, channelName, err)
			statusUpdates = append(statusUpdates, channelSmartScheduleStatusUpdate(
				item.ChannelId,
				model.ChannelSmartScheduleStatusFailed,
				err.Error(),
				nil,
				item.CurrentPriority,
				item.CurrentWeight,
				now,
			))
		} else {
			result.Updated++
			channelCacheDirty = true
			score := item.Score
			statusUpdates = append(statusUpdates, channelSmartScheduleStatusUpdate(
				item.ChannelId,
				model.ChannelSmartScheduleStatusSucceeded,
				"",
				&score,
				item.TargetPriority,
				item.TargetWeight,
				now,
			))
		}
		processed++
		reportProgress(processed, result.Total)
	}

	if err := model.SaveChannelSmartScheduleResults(statusUpdates); err != nil {
		return result, err
	}
	reportProgress(result.Total, result.Total)
	return result, nil
}

func channelSmartScheduleStatusUpdate(channelId int, status string, message string, score *float64, priority int64, weight uint, updatedTime int64) model.ChannelSmartScheduleResultUpdate {
	return model.ChannelSmartScheduleResultUpdate{
		ChannelId: channelId,
		Status:    status,
		Error:     message,
		Score:     score,
		Priority:  priority,
		Weight:    weight,
		Time:      updatedTime,
	}
}

func planChannelSmartSchedule(candidates []channelSmartScheduleCandidate, strategy string, stabilityEnabled bool, applyMode string, minSamples int, forceReset bool) channelSmartSchedulePlan {
	plan := channelSmartSchedulePlan{
		Skipped: make(map[int]string),
	}
	if minSamples <= 0 {
		minSamples = defaultChannelMonitorSmartScheduleSamples
	}

	type cohort struct {
		Candidates []channelSmartScheduleCandidate
	}
	cohorts := make(map[int64]*cohort)
	for _, candidate := range candidates {
		if reason := channelSmartScheduleCandidateSkipReason(candidate, strategy, stabilityEnabled, minSamples); reason != "" {
			plan.Skipped[candidate.ChannelId] = reason
			continue
		}
		var key int64
		if applyMode == channelMonitorSmartScheduleApplyWeight && !forceReset {
			key = candidate.CurrentPriority
		}
		scheduleCohort := cohorts[key]
		if scheduleCohort == nil {
			scheduleCohort = &cohort{}
			cohorts[key] = scheduleCohort
		}
		scheduleCohort.Candidates = append(scheduleCohort.Candidates, candidate)
	}

	for _, scheduleCohort := range cohorts {
		if len(scheduleCohort.Candidates) < 2 {
			reason := "可调渠道不足 2 个"
			if applyMode == channelMonitorSmartScheduleApplyWeight && !forceReset {
				reason = "同优先级可调渠道不足 2 个"
			}
			for _, candidate := range scheduleCohort.Candidates {
				plan.Skipped[candidate.ChannelId] = reason
			}
			continue
		}
		ratioMin, ratioMax := math.Inf(1), math.Inf(-1)
		firstTokenMin, firstTokenMax := math.Inf(1), math.Inf(-1)
		tpsMin, tpsMax := math.Inf(1), math.Inf(-1)
		for _, candidate := range scheduleCohort.Candidates {
			if candidate.Ratio != nil {
				ratioMin = math.Min(ratioMin, *candidate.Ratio)
				ratioMax = math.Max(ratioMax, *candidate.Ratio)
			}
			if candidate.FirstTokenMs != nil {
				firstTokenMin = math.Min(firstTokenMin, *candidate.FirstTokenMs)
				firstTokenMax = math.Max(firstTokenMax, *candidate.FirstTokenMs)
			}
			if candidate.TPS != nil {
				tpsMin = math.Min(tpsMin, *candidate.TPS)
				tpsMax = math.Max(tpsMax, *candidate.TPS)
			}
		}

		items := make([]channelSmartSchedulePlanItem, 0, len(scheduleCohort.Candidates))
		for _, candidate := range scheduleCohort.Candidates {
			ratioScore := 0.0
			if candidate.Ratio != nil {
				ratioScore = channelSmartScheduleLowerIsBetterScore(*candidate.Ratio, ratioMin, ratioMax)
			}
			firstTokenScore := 0.0
			if candidate.FirstTokenMs != nil {
				firstTokenScore = channelSmartScheduleLowerIsBetterScore(*candidate.FirstTokenMs, firstTokenMin, firstTokenMax)
			}
			tpsScore := 0.0
			if candidate.TPS != nil {
				tpsScore = channelSmartScheduleHigherIsBetterScore(*candidate.TPS, tpsMin, tpsMax)
			}
			stabilityScore := 0.0
			if candidate.Stability != nil {
				stabilityScore = channelSmartScheduleHigherIsBetterScore(*candidate.Stability, 0, 1)
			}

			scoreTotal := 0.0
			scoreCount := 0
			switch strategy {
			case channelMonitorSmartScheduleStrategyRatio:
				scoreTotal = ratioScore
				scoreCount = 1
			case channelMonitorSmartScheduleStrategyFirstToken:
				scoreTotal = firstTokenScore
				scoreCount = 1
			case channelMonitorSmartScheduleStrategyTPS:
				scoreTotal = tpsScore
				scoreCount = 1
			case channelMonitorSmartScheduleStrategySmart:
				scoreTotal = ratioScore + firstTokenScore + tpsScore
				scoreCount = 3
			default:
				continue
			}
			if stabilityEnabled {
				scoreTotal += stabilityScore
				scoreCount++
			}
			score := scoreTotal / float64(scoreCount)
			targetWeight := uint(math.Round((channelMonitorSmartScheduleMinWeight+score*(channelMonitorSmartScheduleMaxWeight-channelMonitorSmartScheduleMinWeight))/channelMonitorSmartScheduleWeightStep) * channelMonitorSmartScheduleWeightStep)
			if targetWeight < channelMonitorSmartScheduleMinWeight {
				targetWeight = channelMonitorSmartScheduleMinWeight
			} else if targetWeight > channelMonitorSmartScheduleMaxWeight {
				targetWeight = channelMonitorSmartScheduleMaxWeight
			}
			if !forceReset {
				targetWeight = channelSmartScheduleDampedWeight(candidate.CurrentWeight, targetWeight)
			}
			targetPriority := candidate.CurrentPriority
			if forceReset && applyMode == channelMonitorSmartScheduleApplyWeight {
				targetPriority = 0
			}
			items = append(items, channelSmartSchedulePlanItem{
				ChannelId:       candidate.ChannelId,
				Score:           score,
				CurrentPriority: candidate.CurrentPriority,
				CurrentWeight:   candidate.CurrentWeight,
				TargetPriority:  targetPriority,
				TargetWeight:    targetWeight,
			})
		}

		sort.Slice(items, func(i int, j int) bool {
			if math.Abs(items[i].Score-items[j].Score) > channelMonitorRatioEpsilon {
				return items[i].Score > items[j].Score
			}
			return items[i].ChannelId < items[j].ChannelId
		})
		if applyMode == channelMonitorSmartScheduleApplyPriorityWeight {
			priorities := []int64{100, 90, 80}
			for index := range items {
				tier := index * len(priorities) / len(items)
				if tier >= len(priorities) {
					tier = len(priorities) - 1
				}
				items[index].TargetPriority = priorities[tier]
			}
		}
		plan.Items = append(plan.Items, items...)
	}

	sort.Slice(plan.Items, func(i int, j int) bool {
		return plan.Items[i].ChannelId < plan.Items[j].ChannelId
	})
	return plan
}

func channelSmartScheduleCandidateSkipReason(candidate channelSmartScheduleCandidate, strategy string, stabilityEnabled bool, minSamples int) string {
	if stabilityEnabled && !candidate.StabilityAvailable {
		return "稳定性统计不可用，请开启消费日志和 ERROR_LOG_ENABLED"
	}
	if strategy == channelMonitorSmartScheduleStrategyRatio || strategy == channelMonitorSmartScheduleStrategySmart {
		if candidate.Ratio == nil {
			return "未记录成本倍率"
		}
	}
	if strategy == channelMonitorSmartScheduleStrategyFirstToken || strategy == channelMonitorSmartScheduleStrategySmart {
		if candidate.FirstTokenMs == nil || candidate.FirstTokenSampleCount < minSamples {
			return fmt.Sprintf("首字样本不足（%d/%d）", candidate.FirstTokenSampleCount, minSamples)
		}
	}
	if strategy == channelMonitorSmartScheduleStrategyTPS || strategy == channelMonitorSmartScheduleStrategySmart {
		if candidate.TPS == nil || candidate.TPSSampleCount < minSamples {
			return fmt.Sprintf("TPS 样本不足（%d/%d）", candidate.TPSSampleCount, minSamples)
		}
	}
	if stabilityEnabled {
		if candidate.Stability == nil || candidate.StabilitySampleCount < int64(minSamples) {
			return fmt.Sprintf("稳定性样本不足（%d/%d）", candidate.StabilitySampleCount, minSamples)
		}
	}
	return ""
}

func channelSmartScheduleLowerIsBetterScore(value float64, minimum float64, maximum float64) float64 {
	if maximum-minimum <= channelMonitorRatioEpsilon {
		return 1
	}
	return (maximum - value) / (maximum - minimum)
}

func channelSmartScheduleHigherIsBetterScore(value float64, minimum float64, maximum float64) float64 {
	if maximum-minimum <= channelMonitorRatioEpsilon {
		return 1
	}
	return (value - minimum) / (maximum - minimum)
}

func channelSmartScheduleDampedWeight(current uint, target uint) uint {
	if current == 0 {
		return target
	}
	if current > target {
		difference := current - target
		if difference < channelMonitorSmartScheduleMinWeightChange {
			return current
		}
		if difference > channelMonitorSmartScheduleMaxWeightChange {
			return current - channelMonitorSmartScheduleMaxWeightChange
		}
		return target
	}
	difference := target - current
	if difference < channelMonitorSmartScheduleMinWeightChange {
		return current
	}
	if difference > channelMonitorSmartScheduleMaxWeightChange {
		return current + channelMonitorSmartScheduleMaxWeightChange
	}
	return target
}
