package service

import (
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// LogTaskConsumption 记录任务消费日志和统计信息（仅记录，不涉及实际扣费）。
// 实际扣费已由 BillingSession（PreConsumeBilling + SettleBilling）完成。
func LogTaskConsumption(c *gin.Context, info *relaycommon.RelayInfo) {
	tokenName := c.GetString("token_name")
	logContent := fmt.Sprintf("操作 %s", info.Action)
	// 支持任务仅按次计费
	if common.StringsContains(constant.TaskPricePatches, info.OriginModelName) {
		logContent = fmt.Sprintf("%s，按次计费", logContent)
	} else {
		if len(info.PriceData.OtherRatios) > 0 {
			var contents []string
			for key, ra := range info.PriceData.OtherRatios {
				if 1.0 != ra {
					contents = append(contents, fmt.Sprintf("%s: %.2f", key, ra))
				}
			}
			if len(contents) > 0 {
				logContent = fmt.Sprintf("%s, 计算参数：%s", logContent, strings.Join(contents, ", "))
			}
		}
	}
	other := make(map[string]interface{})
	other["is_task"] = true
	other["request_path"] = c.Request.URL.Path
	other["model_price"] = info.PriceData.ModelPrice
	if info.PriceData.ModelRatio > 0 {
		other["model_ratio"] = info.PriceData.ModelRatio
	}
	other["group_ratio"] = info.PriceData.GroupRatioInfo.GroupRatio
	if info.PriceData.GroupRatioInfo.HasSpecialRatio {
		other["user_group_ratio"] = info.PriceData.GroupRatioInfo.GroupSpecialRatio
	}
	AppendGroupRatioSource(other, info.PriceData.GroupRatioInfo)
	if info.IsModelMapped {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = info.UpstreamModelName
	}
	model.RecordConsumeLog(c, info.UserId, model.RecordConsumeLogParams{
		ChannelId:   info.ChannelId,
		ChannelType: info.ChannelType,
		ModelName:   info.OriginModelName,
		TokenName:   tokenName,
		Quota:       info.PriceData.Quota,
		Content:     logContent,
		TokenId:     info.TokenId,
		Group:       info.UsingGroup,
		Other:       other,
	})
	model.UpdateUserUsedQuotaAndRequestCount(info.UserId, info.PriceData.Quota)
	model.UpdateChannelUsedQuota(info.ChannelId, info.PriceData.Quota)
}

// ---------------------------------------------------------------------------
// 异步任务计费辅助函数
// ---------------------------------------------------------------------------

// resolveTokenKey 通过 TokenId 运行时获取令牌 Key（用于 Redis 缓存操作）。
// 如果令牌已被删除或查询失败，返回空字符串。
func resolveTokenKey(ctx context.Context, tokenId int, taskID string) string {
	token, err := model.GetTokenById(tokenId)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("获取令牌 key 失败 (tokenId=%d, task=%s): %s", tokenId, taskID, err.Error()))
		return ""
	}
	return token.Key
}

// taskIsSubscription 判断任务是否通过订阅计费。
func taskIsSubscription(task *model.Task) bool {
	return task.PrivateData.BillingSource == BillingSourceSubscription && task.PrivateData.SubscriptionId > 0
}

// taskSubscriptionWeighted 把 list 等值额度换算为订阅池扣量（与
// SubscriptionFunding.weighted 同语义：向上取整、负数对称）。任务提交时
// 快照的权重存在 BillingContext.SubscriptionWeight；0 视为 1.0（旧数据）。
func taskSubscriptionWeighted(task *model.Task, n int64) int64 {
	w := 1.0
	if bc := task.PrivateData.BillingContext; bc != nil && bc.SubscriptionWeight > 0 {
		w = bc.SubscriptionWeight
	}
	if n == 0 || w == 1 {
		return n
	}
	if n >= 0 {
		return int64(math.Ceil(float64(n) * w))
	}
	return -int64(math.Ceil(float64(-n) * w))
}

// taskAdjustFunding 调整任务的资金来源（钱包或订阅），delta > 0 表示扣费，delta < 0 表示退还。
// 订阅来源按「加权后总量之差」换算池扣量——对 delta 单独 ceil 会累计舍入
// （如 weight=1.5、预扣 1 已计 2，实际 2 应总计 3，按增量 ceil 会补 2 变 4）；
// 以 task.Quota（调整前的未加权总量）为基准做差杜绝该误差。
func taskAdjustFunding(task *model.Task, delta int) error {
	if taskIsSubscription(task) {
		currentQuota := int64(task.Quota)
		targetQuota := currentQuota + int64(delta)
		if targetQuota < 0 {
			targetQuota = 0
		}
		weightedDelta := taskSubscriptionWeighted(task, targetQuota) - taskSubscriptionWeighted(task, currentQuota)
		if weightedDelta == 0 {
			return nil
		}
		if err := model.PostConsumeUserSubscriptionDelta(task.PrivateData.SubscriptionId, weightedDelta); err != nil {
			return err
		}
		return nil
	}
	if delta > 0 {
		return model.DecreaseUserQuota(task.UserId, delta, false)
	}
	return model.IncreaseUserQuota(task.UserId, -delta, false)
}

// taskAdjustTokenQuota 调整任务的令牌额度，delta > 0 表示扣费，delta < 0 表示退还。
// 需要通过 resolveTokenKey 运行时获取 key（不从 PrivateData 中读取）。
func taskAdjustTokenQuota(ctx context.Context, task *model.Task, delta int) {
	if task.PrivateData.TokenId <= 0 || delta == 0 {
		return
	}
	tokenKey := resolveTokenKey(ctx, task.PrivateData.TokenId, task.TaskID)
	if tokenKey == "" {
		return
	}
	var err error
	if delta > 0 {
		err = model.DecreaseTokenQuota(task.PrivateData.TokenId, tokenKey, delta)
	} else {
		err = model.IncreaseTokenQuota(task.PrivateData.TokenId, tokenKey, -delta)
	}
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("调整令牌额度失败 (delta=%d, task=%s): %s", delta, task.TaskID, err.Error()))
	}
}

// taskBillingOther 从 task 的 BillingContext 构建日志 Other 字段。
func taskBillingOther(task *model.Task) map[string]interface{} {
	other := make(map[string]interface{})
	if bc := task.PrivateData.BillingContext; bc != nil {
		other["model_price"] = bc.ModelPrice
		if bc.ModelRatio > 0 {
			other["model_ratio"] = bc.ModelRatio
		}
		other["group_ratio"] = bc.GroupRatio
		AppendGroupRatioSource(other, groupRatioInfoFromTaskBillingContext(bc))
		if len(bc.OtherRatios) > 0 {
			for k, v := range bc.OtherRatios {
				other[k] = v
			}
		}
	}
	props := task.Properties
	if props.UpstreamModelName != "" && props.UpstreamModelName != props.OriginModelName {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = props.UpstreamModelName
	}
	return other
}

func groupRatioInfoFromTaskBillingContext(bc *model.TaskBillingContext) types.GroupRatioInfo {
	if bc == nil {
		return types.GroupRatioInfo{}
	}
	info := types.GroupRatioInfo{
		GroupRatio:           bc.GroupRatio,
		GroupModelRatio:      bc.GroupModelRatio,
		GroupModelRatioGroup: bc.GroupModelRatioGroup,
		GroupModelRatioModel: bc.GroupModelRatioModel,
		HasGroupModelRatio:   bc.GroupModelRatioGroup != "" || bc.GroupModelRatioModel != "",
		GroupSpecialRatio:    -1,
	}
	return info
}

// taskModelName 从 BillingContext 或 Properties 中获取模型名称。
func taskModelName(task *model.Task) string {
	if bc := task.PrivateData.BillingContext; bc != nil && bc.OriginModelName != "" {
		return bc.OriginModelName
	}
	return task.Properties.OriginModelName
}

// RefundTaskQuota 统一的任务失败退款逻辑。
// 当异步任务失败时，将预扣的 quota 退还给用户（支持钱包和订阅），并退还令牌额度。
func RefundTaskQuota(ctx context.Context, task *model.Task, reason string) {
	quota := task.Quota
	if quota == 0 {
		return
	}

	// 1. 退还资金来源（钱包或订阅）
	if err := taskAdjustFunding(task, -quota); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("退还资金来源失败 task %s: %s", task.TaskID, err.Error()))
		return
	}

	// 2. 退还令牌额度
	taskAdjustTokenQuota(ctx, task, -quota)

	// 3. 记录日志
	other := taskBillingOther(task)
	other["task_id"] = task.TaskID
	other["reason"] = reason
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   model.LogTypeRefund,
		Content:   "",
		ChannelId: task.ChannelId,
		ModelName: taskModelName(task),
		Quota:     quota,
		TokenId:   task.PrivateData.TokenId,
		Group:     task.Group,
		Other:     other,
	})
}

func SettlePreparedTaskQuota(ctx context.Context, task *model.Task, actualQuota int) error {
	if task == nil {
		return nil
	}
	quotaDelta := actualQuota - task.Quota
	if quotaDelta == 0 {
		task.Quota = actualQuota
		return nil
	}
	if err := taskAdjustFunding(task, quotaDelta); err != nil {
		return err
	}
	taskAdjustTokenQuota(ctx, task, quotaDelta)
	task.Quota = actualQuota
	return nil
}

func SettleAcceptedTaskFundingOnce(ctx context.Context, task *model.Task, actualQuota int) error {
	if task == nil {
		return nil
	}
	if actualQuota <= 0 {
		actualQuota = task.AcceptedAccountingActualQuota
	}
	reservedQuota := task.AcceptedAccountingReservedQuota
	if reservedQuota == 0 {
		reservedQuota = task.Quota
	}
	delta := actualQuota - reservedQuota
	return runAcceptedAccountingStepOnce(task.TaskID, model.TaskAcceptedAccountingStepFunding, func(tx *gorm.DB) error {
		if delta == 0 {
			return nil
		}
		if taskIsSubscription(task) {
			weightedDelta := taskSubscriptionWeighted(task, int64(actualQuota)) - taskSubscriptionWeighted(task, int64(reservedQuota))
			if weightedDelta != 0 {
				if err := adjustSubscriptionFundingTx(tx, task.TaskID, task.PrivateData.SubscriptionId, weightedDelta); err != nil {
					return err
				}
			}
		} else {
			if err := adjustWalletFundingTx(tx, task.TaskID, task.UserId, delta); err != nil {
				return err
			}
		}
		if err := adjustTokenQuotaTx(tx, task.PrivateData.TokenId, delta); err != nil {
			return err
		}
		return nil
	})
}

var acceptedAccountingAfterLogForTest func(taskID string) error

func SetAcceptedAccountingAfterLogForTest(hook func(taskID string) error) func() {
	old := acceptedAccountingAfterLogForTest
	acceptedAccountingAfterLogForTest = hook
	return func() { acceptedAccountingAfterLogForTest = old }
}

func LogAcceptedTaskConsumptionOnce(ctx context.Context, task *model.Task) error {
	if task == nil {
		return nil
	}
	actualQuota := task.AcceptedAccountingActualQuota
	if actualQuota == 0 {
		actualQuota = task.Quota
	}
	if err := writeAcceptedTaskLogOnce(task, actualQuota); err != nil {
		return err
	}
	if acceptedAccountingAfterLogForTest != nil {
		if err := acceptedAccountingAfterLogForTest(task.TaskID); err != nil {
			return err
		}
	}
	return runAcceptedAccountingStepOnce(task.TaskID, model.TaskAcceptedAccountingStepLogStats, func(tx *gorm.DB) error {
		if err := tx.Model(&model.User{}).Where("id = ?", task.UserId).Updates(map[string]any{
			"used_quota":    gorm.Expr("used_quota + ?", actualQuota),
			"request_count": gorm.Expr("request_count + ?", 1),
		}).Error; err != nil {
			return err
		}
		if task.ChannelId > 0 {
			if err := tx.Model(&model.Channel{}).Where("id = ?", task.ChannelId).Update("used_quota", gorm.Expr("used_quota + ?", actualQuota)).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func writeAcceptedTaskLogOnce(task *model.Task, actualQuota int) error {
	if !common.LogConsumeEnabled {
		return nil
	}
	return model.LOG_DB.Transaction(func(tx *gorm.DB) error {
		now := common.GetTimestamp()
		ledger := &model.TaskAcceptedAccountingLogLedger{
			TaskID:    task.TaskID,
			Step:      model.TaskAcceptedAccountingStepLogStats,
			CreatedAt: now,
			UpdatedAt: now,
		}
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(ledger)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return nil
		}
		tokenName := ""
		if task.PrivateData.TokenId > 0 {
			var token model.Token
			if err := model.DB.Select("name").Where("id = ?", task.PrivateData.TokenId).First(&token).Error; err == nil {
				tokenName = token.Name
			}
		}
		other := taskBillingOther(task)
		other["is_task"] = true
		other["task_id"] = task.TaskID
		other["pre_consumed_quota"] = task.AcceptedAccountingReservedQuota
		other["actual_quota"] = actualQuota
		otherStr := ""
		if b, err := common.Marshal(other); err == nil {
			otherStr = string(b)
		}
		return tx.Create(&model.Log{
			UserId:    task.UserId,
			CreatedAt: now,
			Type:      model.LogTypeConsume,
			Content:   fmt.Sprintf("操作 %s", task.Action),
			TokenName: tokenName,
			ModelName: taskModelName(task),
			Quota:     actualQuota,
			ChannelId: task.ChannelId,
			TokenId:   task.PrivateData.TokenId,
			Group:     task.Group,
			RequestId: acceptedAccountingRequestID(task.TaskID),
			Other:     otherStr,
		}).Error
	})
}

func RecordAcceptedTaskTemporarySpendOnce(ctx context.Context, task *model.Task) error {
	if task == nil {
		return nil
	}
	actualQuota := task.AcceptedAccountingActualQuota
	if actualQuota == 0 {
		actualQuota = task.Quota
	}
	modelName := taskModelName(task)
	threshold := operation_setting.GetMonitorSetting().TemporaryChannelSpendThresholdUSD
	shouldAccumulate := actualQuota > 0 && modelName != "" && threshold > 0 && isTemporaryChannel(task.ChannelId)

	now := common.GetTimestamp()
	var total int64
	var accumulated bool
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		ledger := &model.TaskAcceptedAccountingLedger{
			TaskID:    task.TaskID,
			Step:      model.TaskAcceptedAccountingStepTemporarySpend,
			CreatedAt: now,
			UpdatedAt: now,
		}
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(ledger)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return nil
		}
		if !shouldAccumulate {
			return nil
		}
		var e error
		total, e = model.AddTemporaryChannelModelSpendTx(tx, modelName, int64(actualQuota), now)
		if e != nil {
			return e
		}
		accumulated = true
		return nil
	})
	if err != nil {
		return err
	}
	if !accumulated {
		return nil
	}
	thresholdQuota := int64(threshold * common.QuotaPerUnit)
	if total < thresholdQuota {
		return nil
	}
	cooldownMinutes := operation_setting.GetMonitorSetting().DingTalkAlertCooldownMinutes
	if cooldownMinutes <= 0 {
		cooldownMinutes = 60
	}
	claimed, err := model.TryClaimTemporaryChannelSpendAlert(modelName, int64(cooldownMinutes*60), now)
	if err != nil {
		common.SysError("failed to claim temporary channel spend alert for " + modelName + ": " + err.Error())
		return nil
	}
	if claimed {
		notifyTemporaryChannelSpend(modelName, float64(total)/common.QuotaPerUnit)
	}
	return nil
}

func SyncAcceptedTaskTokenCacheOnce(ctx context.Context, task *model.Task) error {
	if task == nil || task.PrivateData.TokenId <= 0 {
		return nil
	}
	if err := model.InvalidateTokenCacheById(task.PrivateData.TokenId); err != nil {
		return err
	}
	_, err := markAcceptedAccountingStepDone(task.TaskID, model.TaskAcceptedAccountingStepTokenCache)
	return err
}

func ApplyAcceptedTaskSubscriptionWindowOnce(ctx context.Context, task *model.Task) error {
	if task == nil || !taskIsSubscription(task) {
		return nil
	}
	_, err := markAcceptedAccountingStepDone(task.TaskID, model.TaskAcceptedAccountingStepSubscriptionWindow)
	return err
}

func runAcceptedAccountingStepOnce(taskID string, step string, apply func(tx *gorm.DB) error) error {
	if taskID == "" || step == "" {
		return nil
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var existing int64
		if err := tx.Model(&model.TaskAcceptedAccountingLedger{}).Where("task_id = ? AND step = ?", taskID, step).Count(&existing).Error; err != nil {
			return err
		}
		if existing > 0 {
			return nil
		}
		now := common.GetTimestamp()
		ledger := &model.TaskAcceptedAccountingLedger{
			TaskID:    taskID,
			Step:      step,
			CreatedAt: now,
			UpdatedAt: now,
		}
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(ledger)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return nil
		}
		return apply(tx)
	})
}

func markAcceptedAccountingStepDone(taskID string, step string) (bool, error) {
	if taskID == "" || step == "" {
		return false, nil
	}
	now := common.GetTimestamp()
	ledger := &model.TaskAcceptedAccountingLedger{
		TaskID:    taskID,
		Step:      step,
		CreatedAt: now,
		UpdatedAt: now,
	}
	result := model.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(ledger)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func adjustWalletFundingTx(tx *gorm.DB, taskID string, userID int, delta int) error {
	if delta == 0 {
		return nil
	}
	if userID <= 0 {
		return fmt.Errorf("invalid user id")
	}
	_, err := model.ApplyLifecycleQuotaMutation(tx, model.LifecycleQuotaMutation{
		UserID:    userID,
		ScopeType: model.QuotaLifecycleScopeWallet,
		ScopeID:   int64(userID),
		Delta:     -int64(delta),
		Cause:     "task_accepted_accounting",
		SourceRef: acceptedAccountingLifecycleSourceRef(taskID),
	})
	return err
}

func adjustSubscriptionFundingTx(tx *gorm.DB, taskID string, subscriptionID int, weightedDelta int64) error {
	if subscriptionID <= 0 {
		return fmt.Errorf("invalid subscription id")
	}
	if weightedDelta == 0 {
		return nil
	}
	var sub model.UserSubscription
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", subscriptionID).First(&sub).Error; err != nil {
		return err
	}
	_, err := model.ApplyLifecycleQuotaMutation(tx, model.LifecycleQuotaMutation{
		UserID:    sub.UserId,
		ScopeType: model.QuotaLifecycleScopeSubscription,
		ScopeID:   int64(subscriptionID),
		Delta:     -weightedDelta,
		Cause:     "task_accepted_accounting",
		SourceRef: acceptedAccountingLifecycleSourceRef(taskID),
	})
	return err
}

func adjustTokenQuotaTx(tx *gorm.DB, tokenID int, delta int) error {
	if tokenID <= 0 || delta == 0 {
		return nil
	}
	updates := map[string]any{
		"accessed_time": common.GetTimestamp(),
	}
	if delta > 0 {
		updates["remain_quota"] = gorm.Expr("remain_quota - ?", delta)
		updates["used_quota"] = gorm.Expr("used_quota + ?", delta)
	} else {
		updates["remain_quota"] = gorm.Expr("remain_quota + ?", -delta)
		updates["used_quota"] = gorm.Expr("used_quota - ?", -delta)
	}
	result := tx.Model(&model.Token{}).Where("id = ?", tokenID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return fmt.Errorf("token %d not found for accepted accounting", tokenID)
	}
	return nil
}

func acceptedAccountingRequestID(taskID string) string {
	const prefix = "accepted-accounting:"
	if len(prefix)+len(taskID) <= 64 {
		return prefix + taskID
	}
	return prefix + taskID[len(taskID)-(64-len(prefix)):]
}

func acceptedAccountingLifecycleSourceRef(taskID string) string {
	if taskID == "" {
		return "accepted-accounting"
	}
	return acceptedAccountingRequestID(taskID)
}

func acceptedAccountingRedisStepKey(taskID string, step string) string {
	return "task:accepted-accounting:" + taskID + ":" + step
}

// RecalculateTaskQuota 通用的异步差额结算。
// actualQuota 是任务完成后的实际应扣额度，与预扣额度 (task.Quota) 做差额结算。
// reason 用于日志记录（例如 "token重算" 或 "adaptor调整"）。
func RecalculateTaskQuota(ctx context.Context, task *model.Task, actualQuota int, reason string) {
	if actualQuota <= 0 {
		return
	}
	preConsumedQuota := task.Quota
	quotaDelta := actualQuota - preConsumedQuota

	if quotaDelta == 0 {
		logger.LogInfo(ctx, fmt.Sprintf("任务 %s 预扣费准确（%s，%s）",
			task.TaskID, logger.LogQuota(actualQuota), reason))
		return
	}

	logger.LogInfo(ctx, fmt.Sprintf("任务 %s 差额结算：delta=%s（实际：%s，预扣：%s，%s）",
		task.TaskID,
		logger.LogQuota(quotaDelta),
		logger.LogQuota(actualQuota),
		logger.LogQuota(preConsumedQuota),
		reason,
	))

	// 调整资金来源
	if err := taskAdjustFunding(task, quotaDelta); err != nil {
		logger.LogError(ctx, fmt.Sprintf("差额结算资金调整失败 task %s: %s", task.TaskID, err.Error()))
		return
	}

	// 调整令牌额度
	taskAdjustTokenQuota(ctx, task, quotaDelta)

	task.Quota = actualQuota

	var logType int
	var logQuota int
	if quotaDelta > 0 {
		logType = model.LogTypeConsume
		logQuota = quotaDelta
		model.UpdateUserUsedQuotaAndRequestCount(task.UserId, quotaDelta)
		model.UpdateChannelUsedQuota(task.ChannelId, quotaDelta)
	} else {
		logType = model.LogTypeRefund
		logQuota = -quotaDelta
	}
	other := taskBillingOther(task)
	other["task_id"] = task.TaskID
	other["pre_consumed_quota"] = preConsumedQuota
	other["actual_quota"] = actualQuota
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   logType,
		Content:   reason,
		ChannelId: task.ChannelId,
		ModelName: taskModelName(task),
		Quota:     logQuota,
		TokenId:   task.PrivateData.TokenId,
		Group:     task.Group,
		Other:     other,
	})
}

// RecalculateTaskQuotaByTokens 根据实际 token 消耗重新计费（异步差额结算）。
// 当任务成功且返回了 totalTokens 时，根据模型倍率和分组倍率重新计算实际扣费额度，
// 与预扣费的差额进行补扣或退还。支持钱包和订阅计费来源。
func RecalculateTaskQuotaByTokens(ctx context.Context, task *model.Task, totalTokens int) {
	if totalTokens <= 0 {
		return
	}
	if bc := task.PrivateData.BillingContext; bc != nil && bc.PerCallBilling {
		logger.LogInfo(ctx, fmt.Sprintf("任务 %s 按次计费，跳过 token 差额结算", task.TaskID))
		return
	}

	modelName := taskModelName(task)

	// 获取模型价格和倍率
	modelRatio, hasRatioSetting, _ := ratio_setting.GetModelRatio(modelName)
	// 只有配置了倍率(非固定价格)时才按 token 重新计费
	if !hasRatioSetting || modelRatio <= 0 {
		return
	}

	// 获取用户和组的倍率信息
	group := task.Group
	if group == "" {
		user, err := model.GetUserById(task.UserId, false)
		if err == nil {
			group = user.Group
		}
	}
	if group == "" {
		return
	}

	finalGroupRatio := 1.0
	if bc := task.PrivateData.BillingContext; bc != nil {
		finalGroupRatio = bc.GroupRatio
	} else {
		groupRatioInfo := ratio_setting.GetEffectiveGroupRatio(group, group, modelName)
		finalGroupRatio = groupRatioInfo.GroupRatio
	}

	// 计算 OtherRatios 乘积（视频折扣、时长等）
	otherMultiplier := 1.0
	if bc := task.PrivateData.BillingContext; bc != nil {
		for _, r := range bc.OtherRatios {
			if r != 1.0 && r > 0 {
				otherMultiplier *= r
			}
		}
	}

	// 计算实际应扣费额度: totalTokens * modelRatio * groupRatio * otherMultiplier
	actualQuota := int(float64(totalTokens) * modelRatio * finalGroupRatio * otherMultiplier)

	reason := fmt.Sprintf("token重算：tokens=%d, modelRatio=%.2f, groupRatio=%.2f, otherMultiplier=%.4f", totalTokens, modelRatio, finalGroupRatio, otherMultiplier)
	RecalculateTaskQuota(ctx, task, actualQuota, reason)
}
