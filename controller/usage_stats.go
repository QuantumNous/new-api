package controller

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const usageStatsUnlimitedUSD = 100000000

// usageStatsLogSummary
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：承载消费日志在接口展示周期内的聚合结果。
type usageStatsLogSummary struct {
	Calls  int64
	Quota  int64
	Tokens int64
}

// usageStatsSubscriptionSummary
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：承载活跃套餐的总额、已用额度和时间范围聚合结果。
type usageStatsSubscriptionSummary struct {
	Total int64
	Used  int64
	Start int64
	End   int64
	Found bool
}

// GetUsageStats
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：为 CodexZH 浏览器插件提供 query-key 方式的套餐余量查询接口。
// 参数：c 为 Gin 请求上下文，读取 key 查询参数并写入 JSON 响应。
func GetUsageStats(c *gin.Context) {
	token, err := resolveUsageStatsToken(c.Query("key"))
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	if err := ensureUsageStatsUserEnabled(token.UserId); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	now := time.Now()
	todayStart := startOfLocalDay(now)
	weekStart := startOfLocalWeek(now)

	todayStats, err := queryUsageStatsLogs(token.UserId, token.Id, todayStart.Unix(), now.Unix())
	if err != nil {
		common.ApiErrorMsg(c, "failed to query today usage stats")
		return
	}
	weekStats, err := queryUsageStatsLogs(token.UserId, token.Id, weekStart.Unix(), now.Unix())
	if err != nil {
		common.ApiErrorMsg(c, "failed to query week usage stats")
		return
	}
	totalStats, err := queryUsageStatsLogs(token.UserId, token.Id, 0, now.Unix())
	if err != nil {
		common.ApiErrorMsg(c, "failed to query total usage stats")
		return
	}

	subscription, err := queryUsageStatsActiveSubscriptions(token.UserId, now.Unix())
	if err != nil {
		common.ApiErrorMsg(c, "failed to query subscription stats")
		return
	}

	hasSubscription := subscription.Found
	quotaMode := "wallet"
	var totalQuota int64
	var usedQuota int64
	var remainQuota int64
	subscriptionStart := "-"
	subscriptionEnd := "-"
	if subscription.Found {
		quotaMode = "subscription"
		totalQuota = subscription.Total
		usedQuota = subscription.Used
		remainQuota = subscription.Total - subscription.Used
		if subscription.Total == 0 {
			totalQuota = usageStatsUnlimitedQuotaUnits()
			remainQuota = usageStatsUnlimitedQuotaUnits()
		}
		if remainQuota < 0 {
			remainQuota = 0
		}
		subscriptionStart = formatUsageStatsTime(subscription.Start)
		subscriptionEnd = formatUsageStatsTime(subscription.End)
	} else {
		accountQuota, accountUsedQuota, err := queryUsageStatsAccountBalance(token.UserId)
		if err != nil {
			common.ApiErrorMsg(c, "failed to query account balance")
			return
		}
		totalQuota = int64(accountQuota + accountUsedQuota)
		usedQuota = int64(accountUsedQuota)
		remainQuota = int64(accountQuota)
	}

	totalUSD := quotaToUSD(totalQuota)
	usedUSD := quotaToUSD(usedQuota)
	remainUSD := quotaToUSD(remainQuota)
	todayUsedUSD := quotaToUSD(todayStats.Quota)
	todayRemainingUSD := totalUSD - todayUsedUSD
	if todayRemainingUSD < 0 {
		todayRemainingUSD = 0
	}

	payload := gin.H{
		"quotaMode":                   quotaMode,
		"hasSubscription":             hasSubscription,
		"remainQuota":                 remainUSD,
		"todayUsed":                   todayUsedUSD,
		"todayUsedFormatted":          formatUSD(todayUsedUSD),
		"todayCalls":                  todayStats.Calls,
		"todayTokens":                 todayStats.Tokens,
		"weekUsed":                    usedUSD,
		"weekUsedFormatted":           formatUSD(usedUSD),
		"weekCalls":                   weekStats.Calls,
		"weekTokens":                  weekStats.Tokens,
		"totalUsed":                   usedUSD,
		"totalUsedFormatted":          formatUSD(usedUSD),
		"analyticsTotalUsed":          usedUSD,
		"analyticsTotalUsedFormatted": formatUSD(usedUSD),
		"totalCalls":                  totalStats.Calls,
		"totalRequests":               totalStats.Calls,
		"totalTokens":                 totalStats.Tokens,
		"rpm":                         0,
		"tpm":                         0,
		"subscriptionStart":           subscriptionStart,
		"subscriptionEnd":             subscriptionEnd,
	}
	if hasSubscription {
		payload["dailyBudget"] = totalUSD
		payload["dailyQuota"] = totalQuota
		payload["weeklyBudget"] = totalUSD
		payload["weeklyQuota"] = totalQuota
		payload["todayRemaining"] = todayRemainingUSD
	}

	common.ApiSuccess(c, payload)
}

// resolveUsageStatsToken
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：按插件 query key 解析并读取本地 API Token。
// 参数：rawKey 为 query 参数中传入的原始 API Key。
// 返回值：返回匹配的 Token；若 key 缺失或无效则返回错误。
func resolveUsageStatsToken(rawKey string) (*model.Token, error) {
	key := strings.TrimSpace(rawKey)
	if key == "" {
		return nil, errors.New("key is required")
	}
	if strings.HasPrefix(strings.ToLower(key), "bearer ") {
		key = strings.TrimSpace(key[7:])
	}
	key = strings.TrimPrefix(key, "sk-")
	parts := strings.Split(key, "-")
	key = strings.TrimSpace(parts[0])
	if key == "" {
		return nil, errors.New("key is required")
	}
	token, err := model.GetTokenByKey(key, false)
	if err != nil {
		return nil, errors.New("invalid key")
	}
	return token, nil
}

// ensureUsageStatsUserEnabled
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：确认 Token 所属用户仍处于启用状态，避免已禁用用户读取额度。
// 参数：userId 为 Token 归属用户 ID。
// 返回值：用户可用时返回 nil，否则返回错误。
func ensureUsageStatsUserEnabled(userId int) error {
	user, err := model.GetUserCache(userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("invalid key")
		}
		return err
	}
	if user.Status != common.UserStatusEnabled {
		return errors.New("user is disabled")
	}
	return nil
}

// queryUsageStatsLogs
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：按 Token 聚合指定时间范围内的消费日志。
// 参数：userId 为用户 ID，tokenId 为 Token ID，start/end 为 Unix 秒时间边界。
// 返回值：返回调用次数、额度和 Token 总数聚合。
func queryUsageStatsLogs(userId int, tokenId int, start int64, end int64) (usageStatsLogSummary, error) {
	var summary usageStatsLogSummary
	query := model.LOG_DB.Model(&model.Log{}).
		Select("COUNT(*) as calls, COALESCE(SUM(quota), 0) as quota, COALESCE(SUM(prompt_tokens + completion_tokens), 0) as tokens").
		Where("user_id = ? AND token_id = ? AND type = ?", userId, tokenId, model.LogTypeConsume)
	if start > 0 {
		query = query.Where("created_at >= ?", start)
	}
	if end > 0 {
		query = query.Where("created_at <= ?", end)
	}
	err := query.Scan(&summary).Error
	return summary, err
}

// queryUsageStatsActiveSubscriptions
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：汇总用户当前所有活跃订阅，作为套餐总额/已用/剩余的事实来源。
// 参数：userId 为用户 ID，now 为当前 Unix 秒时间。
// 返回值：返回订阅聚合结果；没有活跃订阅时 Found 为 false。
func queryUsageStatsActiveSubscriptions(userId int, now int64) (usageStatsSubscriptionSummary, error) {
	var subs []model.UserSubscription
	if err := model.DB.Where("user_id = ? AND status = ? AND end_time > ?", userId, "active", now).
		Order("end_time asc, id asc").
		Find(&subs).Error; err != nil {
		return usageStatsSubscriptionSummary{}, err
	}
	if len(subs) == 0 {
		return usageStatsSubscriptionSummary{}, nil
	}
	summary := usageStatsSubscriptionSummary{Found: true}
	for i, sub := range subs {
		summary.Total += sub.AmountTotal
		summary.Used += sub.AmountUsed
		if i == 0 || sub.StartTime < summary.Start {
			summary.Start = sub.StartTime
		}
		if sub.EndTime > summary.End {
			summary.End = sub.EndTime
		}
	}
	return summary, nil
}

// queryUsageStatsAccountBalance
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：读取无订阅用户的钱包账户余额和历史消耗。
// 参数：userId 为用户 ID。
// 返回值：返回当前余额 quota、历史消耗 quota 和查询错误。
func queryUsageStatsAccountBalance(userId int) (int, int, error) {
	quota, err := model.GetUserQuota(userId, false)
	if err != nil {
		return 0, 0, err
	}
	usedQuota, err := model.GetUserUsedQuota(userId)
	if err != nil {
		return 0, 0, err
	}
	return quota, usedQuota, nil
}

// startOfLocalDay
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：计算本地时区当天零点。
// 参数：now 为当前时间。
// 返回值：返回当天起始时间。
func startOfLocalDay(now time.Time) time.Time {
	local := now.In(time.Local)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, local.Location())
}

// startOfLocalWeek
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：计算本地时区自然周起点，周一为每周第一天。
// 参数：now 为当前时间。
// 返回值：返回本周周一零点。
func startOfLocalWeek(now time.Time) time.Time {
	dayStart := startOfLocalDay(now)
	offset := (int(dayStart.Weekday()) + 6) % 7
	return dayStart.AddDate(0, 0, -offset)
}

// quotaToUSD
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：将 new-api quota 单位转换为插件展示所需美元数值。
// 参数：quota 为内部额度单位。
// 返回值：返回四舍五入到 2 位小数的 USD 数值。
func quotaToUSD(quota int64) float64 {
	return float64(int64((float64(quota)/common.QuotaPerUnit)*100+0.5)) / 100
}

// usageStatsUnlimitedQuotaUnits
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：复用现有 billing 接口的无限额度展示哨兵值。
// 返回值：返回可换算为 100000000 USD 的内部 quota 单位。
func usageStatsUnlimitedQuotaUnits() int64 {
	return int64(float64(usageStatsUnlimitedUSD) * common.QuotaPerUnit)
}

// formatUSD
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：生成插件可直接展示的美元金额字符串。
// 参数：value 为 USD 数值。
// 返回值：返回形如 $12.34 的字符串。
func formatUSD(value float64) string {
	return fmt.Sprintf("$%.2f", value)
}

// formatUsageStatsTime
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：按插件当前界面格式输出订阅起止时间。
// 参数：unixSeconds 为 Unix 秒时间戳。
// 返回值：返回本地时区格式化时间；无效时间返回 "-"。
func formatUsageStatsTime(unixSeconds int64) string {
	if unixSeconds <= 0 {
		return "-"
	}
	return time.Unix(unixSeconds, 0).In(time.Local).Format("2006-01-02 15:04:05")
}
