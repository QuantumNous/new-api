package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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
		if otherRatios := info.PriceData.OtherRatios(); len(otherRatios) > 0 {
			var contents []string
			for key, ra := range otherRatios {
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
	if info.IsModelMapped {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = info.UpstreamModelName
	}
	attachQuotaSaturation(c, info, other)
	model.RecordConsumeLog(c, info.UserId, model.RecordConsumeLogParams{
		ChannelId: info.ChannelId,
		ModelName: info.OriginModelName,
		TokenName: tokenName,
		Quota:     info.PriceData.Quota,
		Content:   logContent,
		TokenId:   info.TokenId,
		Group:     info.UsingGroup,
		Other:     other,
	})
	model.UpdateUserUsedQuotaAndRequestCount(info.UserId, info.PriceData.Quota)
	model.UpdateChannelUsedQuota(info.ChannelId, info.PriceData.Quota)
}

// ---------------------------------------------------------------------------
// 异步任务计费辅助函数
// ---------------------------------------------------------------------------

// taskBillingAdjustmentSpecs records the funding and token legs together.
// usageDelta is positive for an additional charge and negative for a refund.
func taskBillingAdjustmentSpecs(task *model.Task, phase string, usageDelta int64) ([]model.BillingAdjustmentSpec, error) {
	if task == nil {
		return nil, errors.New("task is required")
	}
	if usageDelta == 0 {
		return nil, nil
	}
	if task.TaskID == "" && task.ID == 0 {
		return nil, errors.New("task billing identity is required")
	}
	requestID := "task-billing:" + common.Sha1([]byte(fmt.Sprintf("%d:%d:%s", task.ID, task.UserId, task.TaskID)))
	specs := make([]model.BillingAdjustmentSpec, 0, 2)
	if task.PrivateData.BillingSource == BillingSourceSubscription {
		if task.PrivateData.SubscriptionId <= 0 {
			return nil, errors.New("subscription id is missing")
		}
		specs = append(specs, model.BillingAdjustmentSpec{
			RequestID:      requestID,
			Phase:          phase,
			Leg:            model.BillingAdjustmentLegSubscription,
			UserID:         task.UserId,
			SubscriptionID: task.PrivateData.SubscriptionId,
			Delta:          usageDelta,
		})
	} else {
		specs = append(specs, model.BillingAdjustmentSpec{
			RequestID: requestID,
			Phase:     phase,
			Leg:       model.BillingAdjustmentLegWallet,
			UserID:    task.UserId,
			Delta:     -usageDelta,
		})
	}
	if task.PrivateData.TokenId > 0 {
		specs = append(specs, model.BillingAdjustmentSpec{
			RequestID: requestID,
			Phase:     phase,
			Leg:       model.BillingAdjustmentLegToken,
			UserID:    task.UserId,
			TokenID:   task.PrivateData.TokenId,
			Delta:     -usageDelta,
		})
	}
	return specs, nil
}

// commitTaskTransitionWithBilling makes the terminal task transition and its
// required billing legs durable in the same database transaction. Processing
// the rows is best-effort after commit; failed delivery remains owned by the
// billing adjustment drainer.
func commitTaskTransitionWithBilling(ctx context.Context, task *model.Task, fromStatus model.TaskStatus, phase string, usageDelta int64) (bool, error) {
	var specs []model.BillingAdjustmentSpec
	var err error
	if usageDelta != 0 {
		specs, err = taskBillingAdjustmentSpecs(task, phase, usageDelta)
		if err != nil {
			return false, err
		}
	}
	rows := make([]model.BillingAdjustmentOutbox, 0, len(specs))
	won := false
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(task).Where("status = ?", fromStatus).Select("*").Updates(task)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}
		won = true
		for _, spec := range specs {
			row, err := model.EnqueueBillingAdjustmentTx(tx, spec, false)
			if err != nil {
				return err
			}
			rows = append(rows, *row)
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	if !won {
		return false, nil
	}
	for i := range rows {
		if err := model.ProcessBillingAdjustmentOutbox(rows[i].Id); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf(
				"任务计费调整已排队重试 task=%s phase=%s leg=%s: %s",
				task.TaskID,
				rows[i].Phase,
				rows[i].Leg,
				err.Error(),
			))
		}
	}
	return true, nil
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
		if priceData := taskBillingContextPriceData(bc); priceData != nil {
			for k, v := range priceData.OtherRatios() {
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

func taskBillingContextPriceData(bc *model.TaskBillingContext) *types.PriceData {
	if bc == nil || len(bc.OtherRatios) == 0 {
		return nil
	}
	priceData := &types.PriceData{}
	if !priceData.ReplaceOtherRatios(bc.OtherRatios) {
		return nil
	}
	return priceData
}

// CalculateImageTaskQuota applies the same token and tiered-expression rules
// as the synchronous Responses billing path, using only the pricing snapshot
// captured when the async task was submitted.
func CalculateImageTaskQuota(task *model.Task, usage *dto.Usage) (int, *common.QuotaClamp, error) {
	return CalculateImageTaskQuotaWithCount(task, usage, 0)
}

// CalculateImageTaskQuotaWithCount reconciles fixed-price image tasks with the
// number of images the provider actually returned. A zero count preserves the
// submitted estimate for backward compatibility.
func CalculateImageTaskQuotaWithCount(task *model.Task, usage *dto.Usage, actualImageCount int) (int, *common.QuotaClamp, error) {
	if task == nil {
		return 0, nil, errors.New("task is required")
	}
	billing := task.PrivateData.BillingContext
	if billing == nil {
		return 0, nil, errors.New("task billing context is required")
	}
	if actualImageCount < 0 || actualImageCount > dto.MaxImageN {
		return 0, nil, fmt.Errorf("actual image count must be between 0 and %d", dto.MaxImageN)
	}
	if billing.PerCallBilling && !billing.UsePrice {
		return task.Quota, nil, nil
	}
	if billing.PerCallBilling && actualImageCount == 0 {
		return task.Quota, nil, nil
	}
	if billing.PerCallBilling {
		priceData := types.PriceData{
			ModelPrice: billing.ModelPrice,
			UsePrice:   true,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: billing.GroupRatio,
			},
		}
		priceData.ReplaceOtherRatios(billing.OtherRatios)
		priceData.AddOtherRatio("n", float64(actualImageCount))
		quota, clamp := common.QuotaFromFloatChecked(priceData.ApplyOtherRatiosToFloat(
			billing.ModelPrice * common.QuotaPerUnit * billing.GroupRatio,
		))
		if quota < 0 {
			return 0, clamp, errors.New("calculated task quota is negative")
		}
		return quota, clamp, nil
	}
	usage = NormalizeImageTaskUsage(usage)

	priceData := types.PriceData{
		ModelPrice:           billing.ModelPrice,
		ModelRatio:           billing.ModelRatio,
		CompletionRatio:      billing.CompletionRatio,
		CacheRatio:           billing.CacheRatio,
		CacheCreationRatio:   billing.CacheCreationRatio,
		CacheCreation5mRatio: billing.CacheCreation5mRatio,
		CacheCreation1hRatio: billing.CacheCreation1hRatio,
		ImageRatio:           billing.ImageRatio,
		UsePrice:             billing.UsePrice,
		GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio: billing.GroupRatio,
		},
	}
	priceData.ReplaceOtherRatios(billing.OtherRatios)
	billingRequestInput, err := billing.ResolveBillingRequestInput()
	if err != nil {
		return 0, nil, fmt.Errorf("decrypt task billing request input: %w", err)
	}
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName:       billing.OriginModelName,
		StartTime:             time.Now(),
		FinalPreConsumedQuota: task.Quota,
		PriceData:             priceData,
		TieredBillingSnapshot: billing.TieredBillingSnapshot,
		BillingRequestInput:   billingRequestInput,
	}
	billingUsage := effectiveBillingUsage(usage)
	summary := calculateTextQuotaSummary(&gin.Context{}, relayInfo, billingUsage)

	if snapshot := relayInfo.TieredBillingSnapshot; snapshot != nil {
		usedVariables := billingexpr.UsedVars(snapshot.ExprString)
		ok, quota, result := TryTieredSettle(
			relayInfo,
			BuildTieredTokenParams(billingUsage, summary.IsClaudeUsageSemantic, usedVariables),
		)
		if ok {
			summary.Quota = composeTieredTextQuota(relayInfo, summary, quota, result)
		}
	}
	if summary.Quota < 0 {
		return 0, relayInfo.QuotaClamp, errors.New("calculated task quota is negative")
	}
	return summary.Quota, relayInfo.QuotaClamp, nil
}

// NormalizeImageTaskUsage mirrors the synchronous image billing fallback: a
// successful upstream response without usage is billed as one prompt token.
func NormalizeImageTaskUsage(usage *dto.Usage) *dto.Usage {
	normalized := &dto.Usage{}
	if usage != nil {
		*normalized = *usage
		if usage.InputTokensDetails != nil {
			details := *usage.InputTokensDetails
			normalized.InputTokensDetails = &details
		}
		if usage.OutputTokensDetails != nil {
			details := *usage.OutputTokensDetails
			normalized.OutputTokensDetails = &details
		}
	}
	if normalized.TotalTokens == 0 {
		normalized.TotalTokens = 1
	}
	if normalized.PromptTokens == 0 {
		normalized.PromptTokens = 1
	}
	return normalized
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
	if task == nil {
		return
	}
	quota := task.Quota
	if quota == 0 {
		return
	}
	if quota < 0 || quota > common.MaxQuota {
		logger.LogError(ctx, fmt.Sprintf("任务退款额度越界 task %s: %d", task.TaskID, quota))
		return
	}
	specs, err := taskBillingAdjustmentSpecs(task, model.BillingAdjustmentPhaseTaskRefund, -int64(quota))
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("构建任务退款失败 task %s: %s", task.TaskID, err.Error()))
		return
	}
	if err := enqueueBillingAdjustments(specs); err != nil {
		logger.LogError(ctx, fmt.Sprintf("持久化任务退款失败 task %s: %s", task.TaskID, err.Error()))
		return
	}
	recordTaskQuotaRefund(task, reason)
}

func recordTaskQuotaRefund(task *model.Task, reason string) {
	other := taskBillingOther(task)
	other["task_id"] = task.TaskID
	other["reason"] = reason
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   model.LogTypeRefund,
		Content:   "",
		ChannelId: task.ChannelId,
		ModelName: taskModelName(task),
		Quota:     task.Quota,
		TokenId:   task.PrivateData.TokenId,
		Group:     task.Group,
		Other:     other,
	})
}

// RecalculateTaskQuota 通用的异步差额结算。
// actualQuota 是任务完成后的实际应扣额度，与预扣额度 (task.Quota) 做差额结算。
// reason 用于日志记录（例如 "token重算" 或 "adaptor调整"）。
// clamps 可选：若计算 actualQuota 时发生额度饱和，将其记入日志 admin_info（仅管理员可见）。
func RecalculateTaskQuota(ctx context.Context, task *model.Task, actualQuota int, reason string, clamps ...*common.QuotaClamp) {
	if task == nil || actualQuota <= 0 {
		return
	}
	preConsumedQuota := task.Quota
	if actualQuota > common.MaxQuota || preConsumedQuota < 0 || preConsumedQuota > common.MaxQuota {
		logger.LogError(ctx, fmt.Sprintf("任务差额结算额度越界 task %s: actual=%d pre_consumed=%d", task.TaskID, actualQuota, preConsumedQuota))
		return
	}
	quotaDelta64 := int64(actualQuota) - int64(preConsumedQuota)

	if quotaDelta64 == 0 {
		logger.LogInfo(ctx, fmt.Sprintf("任务 %s 预扣费准确（%s，%s）",
			task.TaskID, logger.LogQuota(actualQuota), reason))
		return
	}

	logger.LogInfo(ctx, fmt.Sprintf("任务 %s 差额结算：delta=%s（实际：%s，预扣：%s，%s）",
		task.TaskID,
		logger.LogQuota(int(quotaDelta64)),
		logger.LogQuota(actualQuota),
		logger.LogQuota(preConsumedQuota),
		reason,
	))

	specs, err := taskBillingAdjustmentSpecs(task, model.BillingAdjustmentPhaseTaskRecalculate, quotaDelta64)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("构建任务差额结算失败 task %s: %s", task.TaskID, err.Error()))
		return
	}
	if err := enqueueBillingAdjustments(specs); err != nil {
		logger.LogError(ctx, fmt.Sprintf("持久化任务差额结算失败 task %s: %s", task.TaskID, err.Error()))
		return
	}

	task.Quota = actualQuota
	if task.ID != 0 {
		if err := task.UpdateQuota(); err != nil {
			logger.LogError(ctx, fmt.Sprintf("差额结算回写 quota 失败 task %s: %s", task.TaskID, err.Error()))
		}
	}
	recordTaskQuotaRecalculation(ctx, task, preConsumedQuota, reason, clamps...)
}

func recordTaskQuotaRecalculation(ctx context.Context, task *model.Task, preConsumedQuota int, reason string, clamps ...*common.QuotaClamp) {
	quotaDelta := task.Quota - preConsumedQuota
	if quotaDelta == 0 {
		return
	}
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
	other["actual_quota"] = task.Quota
	for _, clamp := range clamps {
		attachQuotaSaturationToOther(other, clamp)
	}
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
		NodeName:  task.PrivateData.NodeName,
	})
}

// RecordFinalizedTaskBillingAdjustment records the delta already committed by
// the crash-safe image task finalizer. It must not mutate quota or usage again.
func RecordFinalizedTaskBillingAdjustment(ctx context.Context, task *model.Task, previousQuota int, reason string, clamps ...*common.QuotaClamp) {
	if task == nil {
		return
	}
	delta := task.Quota - previousQuota
	logType := model.LogTypeConsume
	logQuota := task.Quota
	if task.Status == model.TaskStatusFailure {
		if previousQuota == 0 {
			return
		}
		logType = model.LogTypeRefund
		logQuota = previousQuota
	}
	other := taskBillingOther(task)
	other["task_id"] = task.TaskID
	other["pre_consumed_quota"] = previousQuota
	other["actual_quota"] = task.Quota
	if reason != "" {
		other["reason"] = reason
	}
	for _, clamp := range clamps {
		attachQuotaSaturationToOther(other, clamp)
	}
	usage := &dto.Usage{}
	if task.Status == model.TaskStatusSuccess {
		var response struct {
			Usage *dto.Usage `json:"usage"`
		}
		if err := common.Unmarshal(task.Data, &response); err == nil {
			usage = NormalizeImageTaskUsage(response.Usage)
		} else {
			usage = NormalizeImageTaskUsage(nil)
		}
		other["input_tokens"] = usage.PromptTokens
		other["output_tokens"] = usage.CompletionTokens
		if usage.PromptTokensDetails.ImageTokens != 0 {
			other["image_input_tokens"] = usage.PromptTokensDetails.ImageTokens
		}
		if usage.CompletionTokenDetails.ImageTokens != 0 {
			other["image_output_tokens"] = usage.CompletionTokenDetails.ImageTokens
		}
	}
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:           task.UserId,
		LogType:          logType,
		Content:          reason,
		ChannelId:        task.ChannelId,
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
		ModelName:        taskModelName(task),
		Quota:            logQuota,
		TokenId:          task.PrivateData.TokenId,
		Group:            task.Group,
		Other:            other,
		NodeName:         task.PrivateData.NodeName,
	})
	logger.LogInfo(ctx, fmt.Sprintf("task %s finalized billing delta=%s actual=%s reserved=%s",
		task.TaskID,
		logger.LogQuota(delta),
		logger.LogQuota(task.Quota),
		logger.LogQuota(previousQuota),
	))
}

// RecalculateTaskQuotaByTokens 根据实际 token 消耗重新计费（异步差额结算）。
// 当任务成功且返回了 totalTokens 时，根据模型倍率和分组倍率重新计算实际扣费额度，
// 与预扣费的差额进行补扣或退还。支持钱包和订阅计费来源。
func RecalculateTaskQuotaByTokens(ctx context.Context, task *model.Task, totalTokens int) {
	actualQuota, reason, clamp, ok := calculateTaskQuotaByTokens(task, totalTokens)
	if !ok {
		return
	}
	RecalculateTaskQuota(ctx, task, actualQuota, reason, clamp)
}

func calculateTaskQuotaByTokens(task *model.Task, totalTokens int) (int, string, *common.QuotaClamp, bool) {
	if task == nil {
		return 0, "", nil, false
	}
	if totalTokens <= 0 {
		return 0, "", nil, false
	}

	modelName := taskModelName(task)

	// 获取模型价格和倍率
	modelRatio, hasRatioSetting, _ := ratio_setting.GetModelRatio(modelName)
	// 只有配置了倍率(非固定价格)时才按 token 重新计费
	if !hasRatioSetting || modelRatio <= 0 {
		return 0, "", nil, false
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
		return 0, "", nil, false
	}

	groupRatio := ratio_setting.GetGroupRatio(group)
	userGroupRatio, hasUserGroupRatio := ratio_setting.GetGroupGroupRatio(group, group)

	var finalGroupRatio float64
	if hasUserGroupRatio {
		finalGroupRatio = userGroupRatio
	} else {
		finalGroupRatio = groupRatio
	}

	// 计算 OtherRatios 乘积（视频折扣、时长等）
	otherMultiplier := 1.0
	if priceData := taskBillingContextPriceData(task.PrivateData.BillingContext); priceData != nil {
		otherMultiplier = priceData.OtherRatioMultiplier()
	}

	// 计算实际应扣费额度: totalTokens * modelRatio * groupRatio * otherMultiplier（饱和转换，防止溢出成负数）
	actualQuota, clamp := common.QuotaFromFloatChecked(float64(totalTokens) * modelRatio * finalGroupRatio * otherMultiplier)

	reason := fmt.Sprintf("token重算：tokens=%d, modelRatio=%.2f, groupRatio=%.2f, otherMultiplier=%.4f", totalTokens, modelRatio, finalGroupRatio, otherMultiplier)
	return actualQuota, reason, clamp, actualQuota > 0
}
