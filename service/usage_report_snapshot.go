package service

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

// GenerateUsageReport 生成用量报表快照主入口
// 按顺序生成: platform -> account -> token -> model -> anomaly
func GenerateUsageReport(periodType string) error {
	rp := BuildReportPeriod(periodType, time.Now())
	return GenerateUsageReportForPeriod(rp)
}

// GenerateUsageReportForPeriod 按指定周期生成用量报表快照。
func GenerateUsageReportForPeriod(rp ReportPeriod) error {
	if rp.PeriodType == "" {
		return fmt.Errorf("invalid period type: %s", rp.PeriodType)
	}

	common.SysLog(fmt.Sprintf("usage report: generating %s report for %s", rp.PeriodType, rp.PeriodLabel))

	// 先清除本周期旧快照（覆盖式重算）
	for _, scope := range []string{
		model.ReportScopePlatform,
		model.ReportScopeAccount,
		model.ReportScopeOrgDept,
		model.ReportScopeModel,
		model.ReportScopeAnomaly,
	} {
		if err := model.DeleteReportSnapshotsByPeriod(rp.PeriodType, rp.StartTimestamp, scope); err != nil {
			return fmt.Errorf("delete old %s snapshots: %w", scope, err)
		}
	}

	// 生成各维度快照
	if err := generatePlatformSnapshot(rp); err != nil {
		return fmt.Errorf("generate platform snapshot: %w", err)
	}
	if err := generateAccountSnapshots(rp); err != nil {
		return fmt.Errorf("generate account snapshots: %w", err)
	}
	if err := generateOrgSnapshots(rp); err != nil {
		return fmt.Errorf("generate org snapshots: %w", err)
	}
	if err := generateModelSnapshots(rp); err != nil {
		return fmt.Errorf("generate model snapshots: %w", err)
	}
	if err := generateAnomalySnapshots(rp); err != nil {
		return fmt.Errorf("generate anomaly snapshots: %w", err)
	}

	common.SysLog(fmt.Sprintf("usage report: completed %s report for %s", rp.PeriodType, rp.PeriodLabel))
	return nil
}

// --- 平台总览快照 ---

func generatePlatformSnapshot(rp ReportPeriod) error {
	// 用聚合查询拿总量
	curStat := queryAggregateStat(rp.StartTimestamp, rp.EndTimestamp)
	prevStat := queryAggregateStat(rp.PrevStartTimestamp, rp.PrevEndTimestamp)

	// 用户统计
	totalPersonal, activePersonal, newPersonal := queryUserStats(common.AccountTypePersonal, rp)
	totalOrg, activeOrg, newOrg := queryUserStats(common.AccountTypeOrganization, rp)
	boundFeishu := queryBoundFeishuCount(common.AccountTypePersonal)

	snap := &model.UsageReportSnapshot{
		PeriodType:             rp.PeriodType,
		PeriodStart:            rp.StartTimestamp,
		PeriodEnd:              rp.EndTimestamp,
		PeriodLabel:            rp.PeriodLabel,
		ScopeType:              model.ReportScopePlatform,
		AccountType:            nil,
		RequestCount:           curStat.count,
		TokenUsed:              curStat.tokenUsed,
		Quota:                  curStat.quota,
		QuotaUSD:               quotaToUSD(curStat.quota),
		QuotaCNY:               quotaToCNY(curStat.quota),
		PreviousRequestCount:   prevStat.count,
		PreviousTokenUsed:      prevStat.tokenUsed,
		PreviousQuota:          prevStat.quota,
		RequestCountGrowthRate: model.GrowthRate(curStat.count, prevStat.count),
		TokenGrowthRate:        model.GrowthRate(curStat.tokenUsed, prevStat.tokenUsed),
		QuotaGrowthRate:        model.GrowthRate(curStat.quota, prevStat.quota),
		TotalUsers:             totalPersonal,
		ActiveUsers:            activePersonal,
		InactiveUsers:          totalPersonal - activePersonal,
		NewUsers:               newPersonal,
		BoundFeishuUsers:       boundFeishu,
		UnboundFeishuUsers:     totalPersonal - boundFeishu,
		TotalOrgAccounts:       totalOrg,
		ActiveOrgAccounts:      activeOrg,
		NewOrgAccounts:         newOrg,
	}

	return model.DB.Create(snap).Error
}

type aggregateStat struct {
	count     int
	tokenUsed int
	quota     int
}

func queryAggregateStat(startTs, endTs int64) aggregateStat {
	var result struct {
		Count     int `gorm:"column:count"`
		TokenUsed int `gorm:"column:token_used"`
		Quota     int `gorm:"column:quota"`
	}
	model.DB.Table("quota_data").
		Select("COALESCE(sum(count), 0) as count, COALESCE(sum(token_used), 0) as token_used, COALESCE(sum(quota), 0) as quota").
		Where("created_at >= ? AND created_at <= ?", startTs, endTs).
		Scan(&result)
	return aggregateStat{count: result.Count, tokenUsed: result.TokenUsed, quota: result.Quota}
}

func queryUserStats(accountType int, rp ReportPeriod) (total, active, newCount int) {
	var totalCnt, activeCnt, newCnt int64
	model.DB.Model(&model.User{}).
		Where("account_type = ? AND deleted_at IS NULL", accountType).
		Count(&totalCnt)
	total = int(totalCnt)

	var activeIds []int
	model.DB.Table("quota_data").
		Distinct("user_id").
		Where("created_at >= ? AND created_at <= ?", rp.StartTimestamp, rp.EndTimestamp).
		Pluck("user_id", &activeIds)
	if len(activeIds) > 0 {
		model.DB.Model(&model.User{}).
			Where("account_type = ? AND deleted_at IS NULL AND id IN ?", accountType, activeIds).
			Count(&activeCnt)
		active = int(activeCnt)
	}

	model.DB.Model(&model.User{}).
		Where("account_type = ? AND deleted_at IS NULL AND created_at >= ? AND created_at <= ?", accountType, rp.StartTimestamp, rp.EndTimestamp).
		Count(&newCnt)
	newCount = int(newCnt)
	return
}

func queryBoundFeishuCount(accountType int) int {
	var count int64
	model.DB.Model(&model.User{}).
		Where("account_type = ? AND deleted_at IS NULL AND feishu_id != ''", accountType).
		Count(&count)
	return int(count)
}

// --- 账号快照 ---

func generateAccountSnapshots(rp ReportPeriod) error {
	// 只查周期内有用量的用户（不区分 account_type，个人和组织都查）
	items, _, err := model.GetUserModelStatsByUser(rp.StartTimestamp, rp.EndTimestamp, nil, nil, "", nil, 1, 10000)
	if err != nil {
		return err
	}

	// 上期数据（用于环比）
	prevItems, _, _ := model.GetUserModelStatsByUser(rp.PrevStartTimestamp, rp.PrevEndTimestamp, nil, nil, "", nil, 1, 10000)
	prevMap := make(map[int]*model.UserStatItem, len(prevItems))
	for _, it := range prevItems {
		prevMap[it.UserID] = it
	}

	// 查用户详情（飞书身份、组织信息、账号类型）
	userIds := make([]int, 0, len(items))
	for _, it := range items {
		userIds = append(userIds, it.UserID)
	}
	userMap := queryUsersByIds(userIds)

	settings := system_setting.GetFeishuSettings()
	var snapshots []*model.UsageReportSnapshot
	for _, it := range items {
		if it.Count == 0 && it.TokenUsed == 0 && it.Quota == 0 {
			continue
		}

		user, ok := userMap[it.UserID]
		if !ok {
			continue
		}

		prev := prevMap[it.UserID]
		snap := buildAccountSnapshot(rp, it, user, prev)
		checkAccountAnomaly(snap, prev, settings, rp)
		snapshots = append(snapshots, snap)
	}

	return model.BatchCreateReportSnapshots(snapshots)
}

// --- 组织用量快照（从 account 快照按一级/二级组织聚合） ---

type orgAgg struct {
	OrgLevel1Name string
	OrgLevel2Name string
	OrgPath       string
	UserCount     int
	RequestCount  int
	TokenUsed     int
	Quota         int
}

func generateOrgSnapshots(rp ReportPeriod) error {
	// 读取本期 account 快照
	accountItems, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeAccount)
	if err != nil {
		return err
	}

	// 按 (一级组织, 二级组织) 聚合
	orgMap := make(map[string]*orgAgg)
	for _, it := range accountItems {
		if it.OrgLevel1Name == "" && it.OrgLevel2Name == "" {
			continue
		}
		key := it.OrgLevel1Name + "|" + it.OrgLevel2Name
		agg, ok := orgMap[key]
		if !ok {
			agg = &orgAgg{
				OrgLevel1Name: it.OrgLevel1Name,
				OrgLevel2Name: it.OrgLevel2Name,
				OrgPath:       it.OrgPath,
			}
			orgMap[key] = agg
		}
		agg.UserCount++
		agg.RequestCount += it.RequestCount
		agg.TokenUsed += it.TokenUsed
		agg.Quota += it.Quota
	}

	// 上期组织 token：优先取上期快照，没有时 fallback 到 quota_data 实时查
	prevOrgTokenMap := make(map[string]int)
	prevItems, _ := model.GetReportSnapshots(rp.PeriodType, rp.PrevPeriodStart.Unix(), model.ReportScopeAccount)
	for _, it := range prevItems {
		if it.OrgLevel1Name == "" && it.OrgLevel2Name == "" {
			continue
		}
		key := it.OrgLevel1Name + "|" + it.OrgLevel2Name
		prevOrgTokenMap[key] += it.TokenUsed
	}
	// 上期快照为空时，fallback 到 quota_data 实时查
	if len(prevItems) == 0 {
		prevOrgTokenMap = queryOrgPrevPeriodTokens(rp)
	}

	var snapshots []*model.UsageReportSnapshot
	for key, agg := range orgMap {
		prevTokenUsed := prevOrgTokenMap[key]
		snap := &model.UsageReportSnapshot{
			PeriodType:        rp.PeriodType,
			PeriodStart:       rp.StartTimestamp,
			PeriodEnd:         rp.EndTimestamp,
			PeriodLabel:       rp.PeriodLabel,
			ScopeType:         model.ReportScopeOrgDept,
			OrgLevel1Name:     agg.OrgLevel1Name,
			OrgLevel2Name:     agg.OrgLevel2Name,
			OrgPath:           agg.OrgPath,
			TotalUsers:        agg.UserCount,
			RequestCount:      agg.RequestCount,
			TokenUsed:         agg.TokenUsed,
			Quota:             agg.Quota,
			QuotaUSD:          quotaToUSD(agg.Quota),
			QuotaCNY:          quotaToCNY(agg.Quota),
			PreviousTokenUsed: prevTokenUsed,
			TokenGrowthRate:   model.GrowthRate(agg.TokenUsed, prevTokenUsed),
		}
		snapshots = append(snapshots, snap)
	}

	return model.BatchCreateReportSnapshots(snapshots)
}

func buildAccountSnapshot(rp ReportPeriod, it *model.UserStatItem, user *model.User, prev *model.UserStatItem) *model.UsageReportSnapshot {
	prevCount, prevToken, prevQuota := 0, 0, 0
	if prev != nil {
		prevCount = prev.Count
		prevToken = prev.TokenUsed
		prevQuota = prev.Quota
	}

	accountType := user.AccountType
	snap := &model.UsageReportSnapshot{
		PeriodType:             rp.PeriodType,
		PeriodStart:            rp.StartTimestamp,
		PeriodEnd:              rp.EndTimestamp,
		PeriodLabel:            rp.PeriodLabel,
		ScopeType:              model.ReportScopeAccount,
		AccountType:            &accountType,
		UserId:                 user.Id,
		Username:               user.Username,
		DisplayName:            user.DisplayName,
		UserGroup:              it.UserGroup,
		RequestCount:           it.Count,
		TokenUsed:              it.TokenUsed,
		Quota:                  it.Quota,
		QuotaUSD:               quotaToUSD(it.Quota),
		QuotaCNY:               quotaToCNY(it.Quota),
		PreviousRequestCount:   prevCount,
		PreviousTokenUsed:      prevToken,
		PreviousQuota:          prevQuota,
		RequestCountGrowthRate: model.GrowthRate(it.Count, prevCount),
		TokenGrowthRate:        model.GrowthRate(it.TokenUsed, prevToken),
		QuotaGrowthRate:        model.GrowthRate(it.Quota, prevQuota),
		OrgLevel1Name:          user.OrgLevel1Name,
		OrgLevel2Name:          user.OrgLevel2Name,
		OrgPath:                user.OrgPath,
	}

	// 设置接收人信息
	if accountType == common.AccountTypePersonal {
		snap.ReceiverType = model.ReceiverTypePersonalUser
		snap.ReceiverName = user.DisplayName
		if snap.ReceiverName == "" {
			snap.ReceiverName = user.Username
		}
		snap.ReceiverFeishuOpenId = user.FeishuId
		snap.ReceiverFeishuUserId = user.FeishuUserId
		snap.ReceiverDepartmentId = user.FeishuDepartmentId
		snap.ReceiverDepartmentName = user.FeishuDepartmentName
	} else if accountType == common.AccountTypeOrganization {
		snap.ReceiverType = model.ReceiverTypeAgentOwner
		snap.ReceiverName = user.AgentOwnerName
		snap.ReceiverFeishuOpenId = user.AgentOwnerFeishuOpenId
		snap.ReceiverFeishuUserId = user.AgentOwnerFeishuUserId
		snap.ReceiverDepartmentId = user.AgentOwnerDepartmentId
		snap.ReceiverDepartmentName = user.AgentOwnerDepartmentName
	}

	return snap
}

// --- Token 快照 ---

// --- 模型趋势快照 ---

func generateModelSnapshots(rp ReportPeriod) error {
	items, _, err := model.GetUserModelStatsByModel(rp.StartTimestamp, rp.EndTimestamp, nil, nil, "", nil, 1, 10000)
	if err != nil {
		return err
	}

	prevItems, _, _ := model.GetUserModelStatsByModel(rp.PrevStartTimestamp, rp.PrevEndTimestamp, nil, nil, "", nil, 1, 10000)
	prevMap := make(map[string]*model.ModelStatItem, len(prevItems))
	for _, it := range prevItems {
		prevMap[it.ModelName] = it
	}

	// 平台总 quota（算占比）
	platformStat := queryAggregateStat(rp.StartTimestamp, rp.EndTimestamp)
	totalQuota := platformStat.quota
	if totalQuota <= 0 {
		return nil
	}

	settings := system_setting.GetFeishuSettings()
	var snapshots []*model.UsageReportSnapshot
	for rank, it := range items {
		if it.Count == 0 && it.TokenUsed == 0 && it.Quota == 0 {
			continue
		}
		prev := prevMap[it.ModelName]
		prevQuota := 0
		prevToken := 0
		if prev != nil {
			prevQuota = prev.Quota
			prevToken = prev.TokenUsed
		}

		usageShare := 0.0
		if totalQuota > 0 {
			usageShare = float64(it.Quota) / float64(totalQuota) * 100
		}

		// 近7日/30日均值
		rolling7d := queryModelRollingAvg(it.ModelName, 7)
		rolling30d := queryModelRollingAvg(it.ModelName, 30)

		snap := &model.UsageReportSnapshot{
			PeriodType:         rp.PeriodType,
			PeriodStart:        rp.StartTimestamp,
			PeriodEnd:          rp.EndTimestamp,
			PeriodLabel:        rp.PeriodLabel,
			ScopeType:          model.ReportScopeModel,
			ModelName:          it.ModelName,
			RequestCount:       it.Count,
			TokenUsed:          it.TokenUsed,
			Quota:              it.Quota,
			QuotaUSD:           quotaToUSD(it.Quota),
			QuotaCNY:           quotaToCNY(it.Quota),
			PreviousQuota:      prevQuota,
			QuotaGrowthRate:    model.GrowthRate(it.Quota, prevQuota),
			PreviousTokenUsed:  prevToken,
			TokenGrowthRate:    model.GrowthRate(it.TokenUsed, prevToken),
			UsageShare:         usageShare,
			RankNo:             rank + 1,
			Rolling7dAvgQuota:  rolling7d,
			Rolling30dAvgQuota: rolling30d,
		}

		// 采购预警
		checkModelPurchaseWarning(snap, settings, rp)

		snapshots = append(snapshots, snap)
	}

	return model.BatchCreateReportSnapshots(snapshots)
}

// reportPeriodDays 返回周期天数
func reportPeriodDays(periodType string) int {
	switch periodType {
	case model.ReportPeriodDaily:
		return 1
	case model.ReportPeriodWeekly:
		return 7
	case model.ReportPeriodMonthly:
		return 30
	}
	return 1
}

// queryOrgPrevPeriodTokens 从 quota_data 实时查询上期各组织 token 总量
func queryOrgPrevPeriodTokens(rp ReportPeriod) map[string]int {
	type orgTokenRow struct {
		OrgLevel1Name string `gorm:"column:org_level1_name"`
		OrgLevel2Name string `gorm:"column:org_level2_name"`
		TotalToken    int    `gorm:"column:total_token"`
	}
	var rows []orgTokenRow
	model.DB.Table("quota_data q").
		Select("u.org_level1_name as org_level1_name, u.org_level2_name as org_level2_name, COALESCE(SUM(q.token_used), 0) as total_token").
		Joins("JOIN users u ON q.user_id = u.id").
		Where("q.created_at >= ? AND q.created_at <= ?", rp.PrevStartTimestamp, rp.PrevEndTimestamp).
		Where("u.status = 1 AND u.deleted_at IS NULL").
		Group("u.org_level1_name, u.org_level2_name").
		Scan(&rows)

	result := make(map[string]int)
	for _, r := range rows {
		if r.OrgLevel1Name == "" && r.OrgLevel2Name == "" {
			continue
		}
		key := r.OrgLevel1Name + "|" + r.OrgLevel2Name
		result[key] = r.TotalToken
	}
	return result
}

// queryModelRollingTokenAvg 查模型近N日 token 日均
func queryModelRollingTokenAvg(modelName string, days int) float64 {
	now := time.Now()
	start := now.AddDate(0, 0, -days)
	var result struct {
		Total int `gorm:"column:total"`
	}
	model.DB.Table("quota_data").
		Select("COALESCE(sum(token_used), 0) as total").
		Where("model_name = ? AND created_at >= ? AND created_at <= ?", modelName, start.Unix(), now.Unix()).
		Scan(&result)
	if days <= 0 {
		return 0
	}
	return float64(result.Total) / float64(days)
}

func queryModelRollingAvg(modelName string, days int) float64 {
	now := time.Now()
	end := now
	start := now.AddDate(0, 0, -days)
	var result struct {
		Total int `gorm:"column:total"`
	}
	model.DB.Table("quota_data").
		Select("COALESCE(sum(quota), 0) as total").
		Where("model_name = ? AND created_at >= ? AND created_at <= ?", modelName, start.Unix(), end.Unix()).
		Scan(&result)
	if days <= 0 {
		return 0
	}
	return float64(result.Total) / float64(days)
}

// --- 异常预警快照 ---

func generateAnomalySnapshots(rp ReportPeriod) error {
	// 从 account 快照中筛 is_anomaly=true 的
	accountSnaps, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeAccount)
	if err != nil {
		return err
	}

	var snapshots []*model.UsageReportSnapshot
	for _, s := range accountSnaps {
		if !s.IsAnomaly {
			continue
		}
		snap := *s // 复制
		snap.Id = 0
		snap.ScopeType = model.ReportScopeAnomaly
		snapshots = append(snapshots, &snap)
	}

	// 模型异常也加入
	modelSnaps, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeModel)
	if err != nil {
		return err
	}
	for _, s := range modelSnaps {
		if !s.IsAnomaly && !s.IsPurchaseWarning {
			continue
		}
		snap := *s
		snap.Id = 0
		snap.ScopeType = model.ReportScopeAnomaly
		if s.IsPurchaseWarning {
			snap.AnomalyType = "model_purchase_warning"
		} else {
			snap.AnomalyType = "model_anomaly"
		}
		snapshots = append(snapshots, &snap)
	}

	return model.BatchCreateReportSnapshots(snapshots)
}

// --- 异常检测 ---

// 异常检测的最低 token 基数门槛，避免小基数用户的微小波动被误报
const (
	accountAnomalyMinTokens = 10_000_000  // 用户：千万 token 以上
	modelAnomalyMinTokens   = 100_000_000 // 模型：一亿 token 以上
)

func checkAccountAnomaly(snap *model.UsageReportSnapshot, prev *model.UserStatItem, settings *system_setting.FeishuSettings, rp ReportPeriod) {
	if snap.Quota <= 0 {
		return
	}

	// 基数门槛：用户日 token 量需达到千万级才参与异常检测
	if snap.TokenUsed < accountAnomalyMinTokens {
		return
	}

	// 规则1: 绝对阈值
	if settings.AccountDailyQuotaThreshold > 0 {
		if quotaToUSD(snap.Quota) >= settings.AccountDailyQuotaThreshold {
			snap.IsAnomaly = true
			snap.AnomalyType = "absolute_threshold"
			snap.AnomalyReason = fmt.Sprintf("单周期额度 %.2f USD 超过阈值 %.2f USD", quotaToUSD(snap.Quota), settings.AccountDailyQuotaThreshold)
			snap.WarningLevel = "warning"
			return
		}
	}

	// 规则2: 滚动均值倍数检测（比环比更稳定，避免单日波动误报）
	if settings.AccountGrowthRateThreshold > 0 {
		days := reportPeriodDays(rp.PeriodType)
		if days <= 0 {
			days = 1
		}
		currentAvg := float64(snap.TokenUsed) / float64(days)

		// vs 近7日日均
		rolling7d := queryAccountRollingTokenAvg(snap.UserId, 7)
		if rolling7d > 0 {
			growthVs7d := (currentAvg - rolling7d) / rolling7d * 100
			if growthVs7d >= settings.AccountGrowthRateThreshold {
				snap.IsAnomaly = true
				snap.AnomalyType = "rolling_avg_spike"
				snap.AnomalyReason = fmt.Sprintf("日均Token为近7日均值 %.0fM 的 %.1f%% 增长，超过阈值 %.1f%%", rolling7d/1e6, growthVs7d, settings.AccountGrowthRateThreshold)
				snap.WarningLevel = "warning"
				return
			}
		}

		// vs 近30日日均
		rolling30d := queryAccountRollingTokenAvg(snap.UserId, 30)
		if rolling30d > 0 {
			growthVs30d := (currentAvg - rolling30d) / rolling30d * 100
			if growthVs30d >= settings.AccountGrowthRateThreshold {
				snap.IsAnomaly = true
				snap.AnomalyType = "rolling_avg_spike"
				snap.AnomalyReason = fmt.Sprintf("日均Token为近30日均值 %.0fM 的 %.1f%% 增长，超过阈值 %.1f%%", rolling30d/1e6, growthVs30d, settings.AccountGrowthRateThreshold)
				snap.WarningLevel = "warning"
				return
			}
		}
	}
}

// queryAccountRollingTokenAvg 查用户近N日 token 日均
func queryAccountRollingTokenAvg(userId, days int) float64 {
	now := time.Now()
	start := now.AddDate(0, 0, -days)
	var result struct {
		Total int `gorm:"column:total"`
	}
	model.DB.Table("quota_data").
		Select("COALESCE(sum(token_used), 0) as total").
		Where("user_id = ? AND created_at >= ? AND created_at <= ?", userId, start.Unix(), now.Unix()).
		Scan(&result)
	if days <= 0 {
		return 0
	}
	return float64(result.Total) / float64(days)
}

func queryAccountRollingAvgQuota(userId, days int) float64 {
	now := time.Now()
	end := now
	start := now.AddDate(0, 0, -days)
	var result struct {
		Total int `gorm:"column:total"`
	}
	model.DB.Table("quota_data").
		Select("COALESCE(sum(quota), 0) as total").
		Where("user_id = ? AND created_at >= ? AND created_at <= ?", userId, start.Unix(), end.Unix()).
		Scan(&result)
	if days <= 0 {
		return 0
	}
	return float64(result.Total) / float64(days)
}

func checkModelPurchaseWarning(snap *model.UsageReportSnapshot, settings *system_setting.FeishuSettings, rp ReportPeriod) {
	// 基数门槛：模型 token 量需达到一亿级才参与异常检测和采购预警
	if snap.TokenUsed < modelAnomalyMinTokens {
		return
	}

	// 采购预警: 占比
	if settings.PurchaseWarningUsageShareThreshold > 0 && snap.UsageShare >= settings.PurchaseWarningUsageShareThreshold {
		snap.IsPurchaseWarning = true
		snap.PurchaseWarningReason = fmt.Sprintf("模型额度占比 %.1f%% 超过阈值 %.1f%%", snap.UsageShare, settings.PurchaseWarningUsageShareThreshold)
	}
	// 采购预警: 绝对消耗
	if settings.PurchaseWarningDailyQuotaThreshold > 0 && snap.QuotaUSD >= settings.PurchaseWarningDailyQuotaThreshold {
		snap.IsPurchaseWarning = true
		if snap.PurchaseWarningReason != "" {
			snap.PurchaseWarningReason += "; "
		}
		snap.PurchaseWarningReason += fmt.Sprintf("周期额度 %.2f USD 超过阈值 %.2f USD", snap.QuotaUSD, settings.PurchaseWarningDailyQuotaThreshold)
	}

	// 模型异常: 滚动均值倍数检测（比环比更稳定）
	if settings.ModelGrowthRateThreshold > 0 {
		days := reportPeriodDays(rp.PeriodType)
		if days <= 0 {
			days = 1
		}
		currentAvg := float64(snap.TokenUsed) / float64(days)

		// vs 近7日日均
		rolling7d := queryModelRollingTokenAvg(snap.ModelName, 7)
		if rolling7d > 0 {
			growthVs7d := (currentAvg - rolling7d) / rolling7d * 100
			if growthVs7d >= settings.ModelGrowthRateThreshold {
				snap.IsAnomaly = true
				snap.AnomalyType = "model_rolling_spike"
				snap.AnomalyReason = fmt.Sprintf("模型日均Token为近7日均值 %.0fM 的 %.1f%% 增长，超过阈值 %.1f%%", rolling7d/1e6, growthVs7d, settings.ModelGrowthRateThreshold)
			}
		}

		// vs 近30日日均（更严格）
		if !snap.IsAnomaly {
			rolling30d := queryModelRollingTokenAvg(snap.ModelName, 30)
			if rolling30d > 0 {
				growthVs30d := (currentAvg - rolling30d) / rolling30d * 100
				if growthVs30d >= settings.ModelGrowthRateThreshold {
					snap.IsAnomaly = true
					snap.AnomalyType = "model_rolling_spike"
					snap.AnomalyReason = fmt.Sprintf("模型日均Token为近30日均值 %.0fM 的 %.1f%% 增长，超过阈值 %.1f%%", rolling30d/1e6, growthVs30d, settings.ModelGrowthRateThreshold)
				}
			}
		}
	}
}

// --- 工具 ---

func queryUsersByIds(ids []int) map[int]*model.User {
	if len(ids) == 0 {
		return map[int]*model.User{}
	}
	var users []*model.User
	model.DB.Where("id IN ? AND status = ? AND deleted_at IS NULL", ids, common.UserStatusEnabled).Find(&users)
	m := make(map[int]*model.User, len(users))
	for _, u := range users {
		m[u.Id] = u
	}
	return m
}

// RunUsageReportPeriod 在 goroutine 中执行报表生成
func RunUsageReportPeriod(periodType string) {
	gopool.Go(func() {
		if err := GenerateUsageReport(periodType); err != nil {
			common.SysError(fmt.Sprintf("usage report: generate %s failed: %s", periodType, err))
		}
	})
}

type UsageReportRunResult struct {
	PeriodType     string         `json:"period_type"`
	PeriodLabel    string         `json:"period_label"`
	PeriodStart    int64          `json:"period_start"`
	PeriodEnd      int64          `json:"period_end"`
	SnapshotCount  int            `json:"snapshot_count"`
	SyncBase       bool           `json:"sync_base"`
	AdminPushTask  bool           `json:"admin_push_task"`
	Status         string         `json:"status"`
	SyncMessages   []string       `json:"sync_messages,omitempty"`
	ConfigDiagnose map[string]any `json:"config_diagnose,omitempty"`
}

// RunUsageReportFullPipeline 执行完整链路：生成快照 -> 同步多维表格 -> 写入管理推送任务表。
func RunUsageReportFullPipeline(periodType string) {
	gopool.Go(func() {
		rp := BuildReportPeriod(periodType, time.Now())
		_, err := RunUsageReportFullPipelineForPeriod(rp, true, system_setting.GetFeishuSettings().UsageReportAdminGroupPushEnabled)
		if err != nil {
			common.SysError(fmt.Sprintf("usage report: run %s failed: %s", periodType, err))
		}
	})
}

var generateUsageReportForPeriod = GenerateUsageReportForPeriod
var syncUsageReportPeriodToBaseWithDiagnostics = SyncUsageReportPeriodToBaseWithDiagnostics
var pushUsageReportAdminTaskToBase = PushUsageReportAdminTaskToBase

// RunUsageReportFullPipelineForPeriod 同步执行指定周期报表链路，用于定时任务和运维补跑。
func RunUsageReportFullPipelineForPeriod(rp ReportPeriod, syncBase, adminPushTask bool) (*UsageReportRunResult, error) {
	if err := generateUsageReportForPeriod(rp); err != nil {
		return nil, err
	}
	settings := system_setting.GetFeishuSettings()

	var syncMessages []string

	if syncBase && settings.UsageReportBaseSyncEnabled {
		msgs, err := syncUsageReportPeriodToBaseWithDiagnostics(rp)
		syncMessages = append(syncMessages, msgs...)
		if err != nil {
			return nil, err
		}
	} else if syncBase && !settings.UsageReportBaseSyncEnabled {
		syncMessages = append(syncMessages, "base sync skipped: usage_report_base_sync_enabled=false")
	}

	if adminPushTask && settings.UsageReportAdminGroupPushEnabled {
		if err := pushUsageReportAdminTaskToBase(rp); err != nil {
			return nil, err
		}
	}

	count := countUsageReportSnapshots(rp)
	result := &UsageReportRunResult{
		PeriodType:    rp.PeriodType,
		PeriodLabel:   rp.PeriodLabel,
		PeriodStart:   rp.StartTimestamp,
		PeriodEnd:     rp.EndTimestamp,
		SnapshotCount: count,
		SyncBase:      syncBase,
		AdminPushTask: adminPushTask,
		Status:        "success",
		SyncMessages:  syncMessages,
	}

	// 配置诊断（帮助排查同步失败原因）
	result.ConfigDiagnose = map[string]any{
		"base_token_set":                 settings.StatsBaseToken != "",
		"app_id_set":                     settings.AppID != "",
		"app_secret_set":                 settings.AppSecret != "",
		"usage_report_enabled":           settings.UsageReportEnabled,
		"base_sync_enabled":              settings.UsageReportBaseSyncEnabled,
		"admin_push_enabled":             settings.UsageReportAdminGroupPushEnabled,
		"report_table_account_id_set":    settings.ReportTableAccountID != "",
		"report_table_org_id_set":        settings.ReportTableOrgID != "",
		"report_table_platform_id_set":   settings.ReportTablePlatformID != "",
		"report_table_model_id_set":      settings.ReportTableModelID != "",
		"report_table_anomaly_id_set":    settings.ReportTableAnomalyID != "",
		"report_table_admin_push_id_set": settings.ReportTableAdminPushID != "",
	}

	return result, nil
}

// ManualRunUsageReport 手动触发报表全链路（供 Controller 调用）
func ManualRunUsageReport(periodType string) (*UsageReportRunResult, error) {
	rp := BuildReportPeriod(periodType, time.Now())
	return RunUsageReportFullPipelineForPeriod(rp, true, system_setting.GetFeishuSettings().UsageReportAdminGroupPushEnabled)
}

func countUsageReportSnapshots(rp ReportPeriod) int {
	count := 0
	for _, scope := range []string{model.ReportScopePlatform, model.ReportScopeAccount, model.ReportScopeOrgDept, model.ReportScopeModel, model.ReportScopeAnomaly} {
		items, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, scope)
		if err == nil {
			count += len(items)
		}
	}
	return count
}

// IsUsageReportEnabled 新快照体系是否启用
func IsUsageReportEnabled() bool {
	return system_setting.GetFeishuSettings().UsageReportEnabled
}
