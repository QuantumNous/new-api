package service

import (
	"context"
	"encoding/base64"
	"fmt"
	"maps"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// LogTaskConsumption records task consumption logs and statistical information (only records, not actual deductions).
// The actual deduction has been completed by BillingSession (PreConsumeBilling + SettleBilling).
func LogTaskConsumption(c *gin.Context, info *relaycommon.RelayInfo, task *model.Task) {
	tokenName := c.GetString("token_name")
	logContent := []*common.Message{common.NewMessage("Action {{action}}", map[string]any{"action": info.Action})}
	// Support tasks are pay-per-use only
	if common.StringsContains(constant.TaskPricePatches, info.OriginModelName) {
		logContent = append(logContent, common.NewMessage("Billed per request"))
	} else {
		var contents []string
		if otherRatios := info.PriceData.OtherRatios(); len(otherRatios) > 0 {
			for key, ra := range otherRatios {
				if 1.0 != ra {
					contents = append(contents, fmt.Sprintf("%s: %.2f", key, ra))
				}
			}
		}
		if snap := info.TieredBillingSnapshot; snap != nil {
			for key, value := range snap.UsageFacts {
				contents = append(contents, fmt.Sprintf("%s: %v", key, value))
			}
		}
		if len(contents) > 0 {
			logContent = append(logContent, common.NewMessage("Billing parameters: {{params}}", map[string]any{"params": strings.Join(contents, ", ")}))
		}
	}
	other := model.NewLogOther()
	other.SetPublic("is_task", true)
	other.SetPublic("request_path", c.Request.URL.Path)
	if taskDeliveredInline(c, task) {
		other.SetPublic("task_sync", true)
	}
	other.SetPublic("model_price", info.PriceData.ModelPrice)
	if info.PriceData.ModelRatio > 0 {
		other.SetPublic("model_ratio", info.PriceData.ModelRatio)
	}
	other.SetPublic("group_ratio", info.PriceData.GroupRatioInfo.GroupRatio)
	if info.PriceData.GroupRatioInfo.HasSpecialRatio {
		other.SetPublic("user_group_ratio", info.PriceData.GroupRatioInfo.GroupSpecialRatio)
	}
	if info.IsModelMapped {
		other.SetPublic("is_model_mapped", true)
		other.SetPublic("upstream_model_name", info.UpstreamModelName)
	}
	if snap := info.TieredBillingSnapshot; snap != nil {
		other.SetPublic("billing_mode", "tiered_expr")
		other.SetPublic("expr_b64", base64.StdEncoding.EncodeToString([]byte(snap.ExprString)))
		other.SetPublic("matched_tier", snap.EstimatedTier)
		if len(snap.UsageFacts) > 0 {
			other.SetPublic("usage_facts", snap.UsageFacts)
		}
		setTaskImageCount(other, snap.UsageFacts["image_count"])
	} else {
		setTaskImageCount(other, info.PriceData.OtherRatios()["image_count"])
	}
	appendTaskLogInfo(task, other)
	attachQuotaSaturation(c, info, other)
	if len(info.RequestPluginSteps) > 0 {
		other.SetAdmin("request_plugins", info.RequestPluginSteps)
	}
	appendRequestPluginRecord(info, other)
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
// Asynchronous task billing helper function
// ---------------------------------------------------------------------------

// resolveTokenKey Gets the token Key by TokenId at runtime (used for Redis cache operations).
// If the token has been deleted or the query failed, an empty string is returned.
func resolveTokenKey(ctx context.Context, tokenId int, taskID string) string {
	token, err := model.GetTokenById(tokenId)
	if err != nil {
		logger.LogWarn(ctx, common.LogText("failed to get token key (tokenId=%d, task=%s): %s", tokenId, taskID, err.Error()))
		return ""
	}
	return token.Key
}

// taskIsSubscription determines whether the task is billed through subscription.
func taskIsSubscription(task *model.Task) bool {
	return task.PrivateData.BillingSource == BillingSourceSubscription && task.PrivateData.SubscriptionId > 0
}

// taskAdjustFunding adjusts the funding source (wallet or subscription) of the task, delta > 0 means deduction, delta < 0 means refund.
func taskAdjustFunding(task *model.Task, delta int) error {
	if taskIsSubscription(task) {
		return model.PostConsumeUserSubscriptionDelta(task.PrivateData.SubscriptionId, int64(delta))
	}
	if delta > 0 {
		return model.DecreaseUserQuota(task.UserId, delta, false)
	}
	return model.IncreaseUserQuota(task.UserId, -delta, false)
}

// taskAdjustTokenQuota adjusts the token quota of the task. delta > 0 means deduction, delta < 0 means refund.
// The key needs to be obtained at runtime through resolveTokenKey (not read from PrivateData).
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
		logger.LogWarn(ctx, common.LogText("failed to adjust token quota (delta=%d, task=%s): %s", delta, task.TaskID, err.Error()))
	}
}

// taskBillingOther Constructs the log Other field from the task's BillingContext.
func taskBillingOther(task *model.Task) *model.LogOther {
	other := model.NewLogOther()
	// The front-end list selects the task gear rendering branch according to is_task. If it is missing, the difference/refund log will be misjudged as ordinary relay dynamic billing.
	other.SetPublic("is_task", true)
	if bc := task.PrivateData.BillingContext; bc != nil {
		other.SetPublic("model_price", bc.ModelPrice)
		if bc.ModelRatio > 0 {
			other.SetPublic("model_ratio", bc.ModelRatio)
		}
		other.SetPublic("group_ratio", bc.GroupRatio)
		if priceData := taskBillingContextPriceData(bc); priceData != nil {
			for k, v := range priceData.OtherRatios() {
				if !other.SetPublic(k, v) {
					common.SysError(common.LogText("task billing other ratio key rejected: %s", k))
				}
			}
		}
		if snap := bc.TieredSnapshot; snap != nil {
			other.SetPublic("billing_mode", "tiered_expr")
			other.SetPublic("expr_b64", base64.StdEncoding.EncodeToString([]byte(snap.ExprString)))
			other.SetPublic("matched_tier", snap.EstimatedTier)
			if len(snap.UsageFacts) > 0 {
				other.SetPublic("usage_facts", snap.UsageFacts)
			}
			setTaskImageCount(other, snap.UsageFacts["image_count"])
		} else if priceData := taskBillingContextPriceData(bc); priceData != nil {
			setTaskImageCount(other, priceData.OtherRatios()["image_count"])
		}
	}
	props := task.Properties
	if props.UpstreamModelName != "" && props.UpstreamModelName != props.OriginModelName {
		other.SetPublic("is_model_mapped", true)
		other.SetPublic("upstream_model_name", props.UpstreamModelName)
	}
	appendTaskLogInfo(task, other)
	return other
}

// setTaskImageCount publishes the billed image quantity of an image task as
// other.image_count, the same field the HTTP image relay writes, so the log
// detail shows one "billable image count" regardless of the serving path. The
// value is a host-validated count fact (at most dto.MaxImageN), never a quota.
func setTaskImageCount(other *model.LogOther, value any) {
	count, ok := value.(float64)
	if !ok || count < 0 || count > float64(dto.MaxImageN) {
		return
	}
	other.SetPublic("image_count", common.QuotaRound(count))
}

// taskDeliveredInline reports whether the submitting HTTP request itself
// returns the task deliverable: the upstream completed immediately, or the
// request came through the synchronous OpenAI Images protocol, where the host
// waits for an asynchronous upstream task before answering. The usage log
// presents such requests as synchronous instead of as asynchronous jobs.
func taskDeliveredInline(c *gin.Context, task *model.Task) bool {
	if task != nil && (task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure) {
		return true
	}
	pinnedValue, exists := c.Get(jsplugin.ContextKeyPinnedEndpoint)
	if !exists {
		return false
	}
	pinned, ok := pinnedValue.(jsplugin.PinnedEndpoint)
	return ok && pinned.Protocol == jsplugin.ProtocolOpenAIImage
}

func appendTaskLogInfo(task *model.Task, other *model.LogOther) {
	if task == nil || other == nil {
		return
	}
	if task.TaskID != "" {
		other.SetPublic("task_id", task.TaskID)
	}
	if task.PrivateData.ResultDiscarded {
		// The result was delivered inline and the upstream snapshot was not
		// persisted, so no artifact can be retrieved for this task.
		other.SetPublic("result_discarded", true)
	}
	if task.PrivateData.Execution != nil {
		AppendTaskPluginAuditInfo(other, task.PrivateData.Execution.TaskPlugin)
	}
	if task.PrivateData.UpstreamTaskID == "" && task.PrivateData.NodeName == "" {
		return
	}
	if task.PrivateData.UpstreamTaskID != "" {
		other.SetRoot("upstream_task_id", task.PrivateData.UpstreamTaskID)
	}
	if task.PrivateData.NodeName != "" {
		other.SetRoot("node_name", task.PrivateData.NodeName)
	}
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

// taskModelName Gets the model name from BillingContext or Properties.
func taskModelName(task *model.Task) string {
	if bc := task.PrivateData.BillingContext; bc != nil && bc.OriginModelName != "" {
		return bc.OriginModelName
	}
	return task.Properties.OriginModelName
}

// RefundTaskQuota Unified refund logic for task failure.
// When an asynchronous task fails, funds and tokens will be refunded, and user and channel usage will be reduced.
// Returns whether the funding source has been successfully refunded; in case of failure, the quota is retained for explicit retry or manual reconciliation.
func RefundTaskQuota(ctx context.Context, task *model.Task, reason string) bool {
	quota := task.Quota
	if quota == 0 {
		return true
	}

	// 1. Return funding source (wallet or subscription)
	if err := taskAdjustFunding(task, -quota); err != nil {
		logger.LogWarn(ctx, common.LogText("failed to refund the funding source, task %s: %s", task.TaskID, err.Error()))
		return false
	}

	// 2. Refund the token amount
	taskAdjustTokenQuota(ctx, task, -quota)

	// 3. The accumulated user and channel usage during withholding will be reduced, and the number of requests remains unchanged.
	model.UpdateUserUsedQuota(task.UserId, -quota)
	model.UpdateChannelUsedQuota(task.ChannelId, -quota)

	// 4. Keep logs
	other := taskBillingOther(task)
	other.SetPublic("task_id", task.TaskID)
	other.SetPublic("reason", reason)
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   model.LogTypeRefund,
		ChannelId: task.ChannelId,
		ModelName: taskModelName(task),
		Quota:     quota,
		TokenId:   task.PrivateData.TokenId,
		Group:     task.Group,
		Other:     other,
	})

	// 5. Clear the persistence mark after the fund refund is completed.
	// An explicit warning must be given when writeback fails to avoid missing potential duplicate refund risks.
	task.Quota = 0
	if err := task.UpdateQuota(); err != nil {
		logger.LogError(ctx, common.LogText("refund succeeded but clearing the task quota failed, task %s: %s", task.TaskID, err.Error()))
	}
	return true
}

// RecalculateTaskQuota Generic asynchronous balance settlement.
// actualQuota is the actual deduction amount after the task is completed, and the difference is settled with the withholding amount (task.Quota).
// reason writes log content (such as recalculation by token or adapter adjustment).
// clamps Optional: If quota saturation occurs when calculating actualQuota, record it in the log admin_info (visible only to administrators).
func RecalculateTaskQuota(ctx context.Context, task *model.Task, actualQuota int, reason *common.Message, clamps ...*common.QuotaClamp) {
	if actualQuota < 0 {
		return
	}
	preConsumedQuota := task.Quota
	quotaDelta := actualQuota - preConsumedQuota

	if quotaDelta == 0 {
		logger.LogInfo(ctx, common.LogText("task %s pre-consumed quota matches the actual quota (%s, %s)",
			task.TaskID, logger.LogQuota(actualQuota), reason.Error()))
		return
	}

	logger.LogInfo(ctx, common.LogText("task %s settles the difference: delta=%s (actual %s, pre-consumed %s, %s)",
		task.TaskID,
		logger.LogQuota(quotaDelta),
		logger.LogQuota(actualQuota),
		logger.LogQuota(preConsumedQuota),
		reason.Error(),
	))

	// Adjust funding sources
	if err := taskAdjustFunding(task, quotaDelta); err != nil {
		logger.LogError(ctx, common.LogText("failed to adjust funding for the difference, task %s: %s", task.TaskID, err.Error()))
		return
	}

	// Adjust token amount
	taskAdjustTokenQuota(ctx, task, quotaDelta)

	task.Quota = actualQuota
	if err := task.UpdateQuota(); err != nil {
		logger.LogError(ctx, common.LogText("failed to write back the settled task quota, task %s: %s", task.TaskID, err.Error()))
	}

	// One request has been accumulated during the submission phase; only the final usage is adjusted during the settlement phase.
	model.UpdateUserUsedQuota(task.UserId, quotaDelta)
	model.UpdateChannelUsedQuota(task.ChannelId, quotaDelta)

	var logType int
	var logQuota int
	if quotaDelta > 0 {
		logType = model.LogTypeConsume
		logQuota = quotaDelta
	} else {
		logType = model.LogTypeRefund
		logQuota = -quotaDelta
	}
	other := taskBillingOther(task)
	other.SetPublic("task_id", task.TaskID)
	other.SetPublic("pre_consumed_quota", preConsumedQuota)
	other.SetPublic("actual_quota", actualQuota)
	for _, clamp := range clamps {
		attachQuotaSaturationToOther(other, clamp)
	}
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   logType,
		Content:   []*common.Message{reason},
		ChannelId: task.ChannelId,
		ModelName: taskModelName(task),
		Quota:     logQuota,
		TokenId:   task.PrivateData.TokenId,
		Group:     task.Group,
		Other:     other,
		NodeName:  task.PrivateData.NodeName,
	})
}

// RecalculateTaskQuotaByTokens Recalculates based on actual token consumption (asynchronous difference settlement).
// When the task is successful and totalTokens is returned, the actual deduction amount is recalculated based on the model magnification and grouping magnification.
// The difference with the withholding fee will be deducted or refunded. Supports wallet and subscription billing sources.
func RecalculateTaskQuotaByTokens(ctx context.Context, task *model.Task, totalTokens int) bool {
	if totalTokens <= 0 {
		return false
	}

	modelName := taskModelName(task)

	// Get model price and magnification
	modelRatio, hasRatioSetting, _ := ratio_setting.GetModelRatio(modelName)
	// Only when the multiplier (non-fixed price) is configured, the fee will be recalculated according to the token.
	if !hasRatioSetting || modelRatio <= 0 {
		return false
	}

	// Get user and group magnification information
	group := task.Group
	if group == "" {
		user, err := model.GetUserById(task.UserId, false)
		if err == nil {
			group = user.Group
		}
	}
	if group == "" {
		return false
	}

	groupRatio := ratio_setting.GetGroupRatio(group)
	userGroupRatio, hasUserGroupRatio := ratio_setting.GetGroupGroupRatio(group, group)

	var finalGroupRatio float64
	if hasUserGroupRatio {
		finalGroupRatio = userGroupRatio
	} else {
		finalGroupRatio = groupRatio
	}

	// Calculate the product of OtherRatios (video discount, duration, etc.)
	otherMultiplier := 1.0
	if priceData := taskBillingContextPriceData(task.PrivateData.BillingContext); priceData != nil {
		otherMultiplier = priceData.OtherRatioMultiplier()
	}

	// Calculate the actual deduction amount: totalTokens * modelRatio * groupRatio * otherMultiplier (saturated conversion to prevent overflow into negative numbers)
	actualQuota, clamp := common.QuotaFromFloatChecked(float64(totalTokens) * modelRatio * finalGroupRatio * otherMultiplier)

	reason := common.NewMessage("Recalculated from tokens: tokens {{tokens}}, model ratio {{model_ratio}}, group ratio {{group_ratio}}, other multiplier {{other_multiplier}}", map[string]any{
		"tokens":           totalTokens,
		"model_ratio":      fmt.Sprintf("%.2f", modelRatio),
		"group_ratio":      fmt.Sprintf("%.2f", finalGroupRatio),
		"other_multiplier": fmt.Sprintf("%.4f", otherMultiplier),
	})
	RecalculateTaskQuota(ctx, task, actualQuota, reason, clamp)
	return true
}

// EvaluateTaskCompletionUsage evaluates actual facts against the frozen task
// expression. It neither mutates the snapshot nor moves funds: synchronous
// submission and polling have different persistence and settlement barriers.
func EvaluateTaskCompletionUsage(snap *billingexpr.BillingSnapshot, facts map[string]any) (billingexpr.TieredResult, map[string]any, error) {
	if snap == nil {
		return billingexpr.TieredResult{}, nil, fmt.Errorf("task billing snapshot is missing")
	}
	usage := make(map[string]any, len(snap.UsageFacts)+len(facts))
	maps.Copy(usage, snap.UsageFacts)
	maps.Copy(usage, facts)
	result, err := billingexpr.ComputeTieredQuotaWithRequest(snap, billingexpr.TokenParams{}, billingexpr.RequestInput{Usage: usage})
	if err == nil && (result.ActualQuotaBeforeGroup < 0 || math.IsNaN(result.ActualQuotaBeforeGroup)) {
		err = fmt.Errorf("task completion expression produced an invalid cost")
	}
	return result, usage, err
}
