package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
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
	if info.IsModelMapped {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = info.UpstreamModelName
	}
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

// taskAdjustFunding 调整任务的资金来源（钱包或订阅），delta > 0 表示扣费，delta < 0 表示退还。
func taskAdjustFunding(task *model.Task, delta int) error {
	if taskIsSubscription(task) {
		return model.PostConsumeUserSubscriptionDelta(task.PrivateData.SubscriptionId, int64(delta))
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

// taskModelName 从 BillingContext 或 Properties 中获取模型名称。
func taskModelName(task *model.Task) string {
	if bc := task.PrivateData.BillingContext; bc != nil && bc.OriginModelName != "" {
		return bc.OriginModelName
	}
	return task.Properties.OriginModelName
}

// taskAdjustQuotaData 同步调整 quota_data 统计（/api/data/ 数据来源）。
// quotaDelta / tokenDelta 均为有符号增量：
//   - 失败退款：quotaDelta=-quota, tokenDelta=0（原始记录 token 就是 0，对称回退即可）
//   - 补扣 / 部分退款 + 真实 token：quotaDelta=±delta, tokenDelta=+totalTokens
//     （token 之所以 *永远是 +*：原始 LogTaskConsumption 写入的 token 都是 0，
//     现在要补到 totalTokens，所以是单向增量，不随 quota 取号）
func taskAdjustQuotaData(task *model.Task, quotaDelta, tokenDelta int) {
	if !common.DataExportEnabled {
		return
	}
	if quotaDelta == 0 && tokenDelta == 0 {
		return
	}
	username, _ := model.GetUsernameById(task.UserId, false)
	model.LogQuotaDataAdjust(task.UserId, username, taskModelName(task), quotaDelta, common.GetTimestamp(), tokenDelta)
}

// RefundTaskQuota 统一的任务失败退款逻辑。
// 当异步任务失败时，将预扣的 quota 退还给用户（支持钱包和订阅），并退还令牌额度。
//
// 守恒保证：
//   - 用户表「总额度」(Quota + UsedQuota) 不变 — Quota +quota / UsedQuota -quota；
//   - 令牌「剩余额度」回退（IncreaseTokenQuota 内部自动 RemainQuota+ / UsedQuota-）；
//   - 渠道用量同步回退；
//   - quota_data 统计同步反向回退（token 字段保持 0 — 失败任务无实际 token 消耗）。
func RefundTaskQuota(ctx context.Context, task *model.Task, reason string) {
	quota := task.Quota
	if quota == 0 {
		return
	}

	// 1. 退还资金来源（钱包或订阅）：影响 User.Quota
	if err := taskAdjustFunding(task, -quota); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("退还资金来源失败 task %s: %s", task.TaskID, err.Error()))
		return
	}

	// 2. 退还令牌额度：影响 Token.RemainQuota / Token.UsedQuota
	taskAdjustTokenQuota(ctx, task, -quota)

	// 3. 回退用户「已用额度」与渠道用量，使总额度守恒
	model.UpdateUserUsedQuotaDelta(task.UserId, -quota)
	if task.ChannelId > 0 {
		model.UpdateChannelUsedQuota(task.ChannelId, -quota)
	}

	// 4. 反向调整 /api/data/ 数据看板统计（quota -quota、tokens 不动）
	taskAdjustQuotaData(task, -quota, 0)

	// 5. 记录退款日志
	other := taskBillingOther(task)
	other["task_id"] = task.TaskID
	other["reason"] = reason
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:           task.UserId,
		LogType:          model.LogTypeRefund,
		Content:          "",
		ChannelId:        task.ChannelId,
		ModelName:        taskModelName(task),
		Quota:            quota,
		PromptTokens:     0,
		CompletionTokens: 0,
		TokenId:          task.PrivateData.TokenId,
		Group:            task.Group,
		Other:            other,
	})
}

// RecalculateTaskQuota 通用的异步差额结算。
// actualQuota 是任务完成后的实际应扣额度，与预扣额度 (task.Quota) 做差额结算。
// totalTokens 为本次任务实际消耗的 token 数（视频生成模型 input=0，故全部计入 CompletionTokens）；
//
//	若上游未返回 token 用量则传 0，不会污染统计。
//
// reason 用于日志记录（例如 "token重算" 或 "adaptor调整"）。
//
// 守恒保证（与 RefundTaskQuota 对称）：
//   - 补扣 (delta>0)：User.Quota -delta / User.UsedQuota +delta；Channel.UsedQuota +delta；
//   - 退还 (delta<0)：User.Quota +|delta| / User.UsedQuota -|delta|；Channel.UsedQuota -|delta|；
//   - 不增 request_count（这只是结算，不是新请求）；
//   - quota_data 统计 quota 跟随 delta 同向变化，token_used 单向 +totalTokens
//     （原始 LogTaskConsumption 时 token 永远是 0，需要在终态补到 totalTokens）。
func RecalculateTaskQuota(ctx context.Context, task *model.Task, actualQuota int, totalTokens int, reason string) {
	if actualQuota <= 0 {
		return
	}
	preConsumedQuota := task.Quota
	quotaDelta := actualQuota - preConsumedQuota

	if quotaDelta == 0 {
		logger.LogInfo(ctx, fmt.Sprintf("任务 %s 预扣费准确（%s，%s）",
			task.TaskID, logger.LogQuota(actualQuota), reason))
		// 钱不动也要把 token 用量补到统计里：原始 LogTaskConsumption 时 token 一律是 0，
		// 现在拿到了上游真实 totalTokens，补一行统计调整即可。
		if totalTokens > 0 {
			taskAdjustQuotaData(task, 0, totalTokens)
		}
		return
	}

	logger.LogInfo(ctx, fmt.Sprintf("任务 %s 差额结算：delta=%s（实际：%s，预扣：%s，%s）",
		task.TaskID,
		logger.LogQuota(quotaDelta),
		logger.LogQuota(actualQuota),
		logger.LogQuota(preConsumedQuota),
		reason,
	))

	// 调整资金来源（钱包 or 订阅）：影响 User.Quota
	if err := taskAdjustFunding(task, quotaDelta); err != nil {
		logger.LogError(ctx, fmt.Sprintf("差额结算资金调整失败 task %s: %s", task.TaskID, err.Error()))
		return
	}

	// 调整令牌额度：Token.RemainQuota / Token.UsedQuota 内部已对称
	taskAdjustTokenQuota(ctx, task, quotaDelta)

	// User.UsedQuota 与 Channel.UsedQuota 跟随 delta 同向变化（不动 request_count）
	model.UpdateUserUsedQuotaDelta(task.UserId, quotaDelta)
	if task.ChannelId > 0 {
		model.UpdateChannelUsedQuota(task.ChannelId, quotaDelta)
	}

	// /api/data/ 统计：quota 同向变化、token_used 单向 +totalTokens
	taskAdjustQuotaData(task, quotaDelta, totalTokens)

	task.Quota = actualQuota

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
	other["task_id"] = task.TaskID
	other["pre_consumed_quota"] = preConsumedQuota
	other["actual_quota"] = actualQuota
	if totalTokens > 0 {
		other["total_tokens"] = totalTokens
	}
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   logType,
		Content:   reason,
		ChannelId: task.ChannelId,
		ModelName: taskModelName(task),
		Quota:     logQuota,
		// 视频/图像类异步任务上游不区分 input/output token：input=0，output=total
		// （参见 doubao seedance 文档：total_tokens = completion_tokens）
		PromptTokens:     0,
		CompletionTokens: totalTokens,
		TokenId:          task.PrivateData.TokenId,
		Group:            task.Group,
		Other:            other,
	})
}

// RecalculateTaskQuotaByTokens 根据实际 token 消耗重新计费（异步差额结算）。
// 当任务成功且返回了 totalTokens 时，根据模型倍率和分组倍率重新计算实际扣费额度，
// 与预扣费的差额进行补扣或退还。支持钱包和订阅计费来源。
func RecalculateTaskQuotaByTokens(ctx context.Context, task *model.Task, totalTokens int) {
	if totalTokens <= 0 {
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
	RecalculateTaskQuota(ctx, task, actualQuota, totalTokens, reason)
}
