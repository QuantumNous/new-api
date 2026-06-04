package service

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type AffiliateDashboardSummaryInput struct {
	Scope               AffiliateScope
	StartTimestamp      int64
	EndTimestamp        int64
	TrendStartTimestamp int64
	TrendEndTimestamp   int64
	QuotaPerUnit        float64
	USDExchangeRate     float64
}

type AffiliateDashboardSummary struct {
	TeamUserCount          int                            `json:"team_user_count"`
	EffectiveNewUserCount  int                            `json:"effective_new_user_count"`
	NetConsumptionQuota    int64                          `json:"net_consumption_quota"`
	NetConsumptionRMB      float64                        `json:"net_consumption_rmb"`
	EstimatedCommissionRMB float64                        `json:"estimated_commission_rmb"`
	HeadFeeRMB             float64                        `json:"head_fee_rmb"`
	PendingSettlementRMB   float64                        `json:"pending_settlement_rmb"`
	KPITierName            string                         `json:"kpi_tier_name"`
	RuleStatus             string                         `json:"rule_status"`
	DailyTrends            []AffiliateDashboardTrendPoint `json:"daily_trends"`
}

type AffiliateDashboardTrendPoint struct {
	PeriodStart            int64   `json:"period_start"`
	PeriodEnd              int64   `json:"period_end"`
	EffectiveNewUserCount  int     `json:"effective_new_user_count"`
	NetConsumptionQuota    int64   `json:"net_consumption_quota"`
	NetConsumptionRMB      float64 `json:"net_consumption_rmb"`
	EstimatedCommissionRMB float64 `json:"estimated_commission_rmb"`
	HeadFeeRMB             float64 `json:"head_fee_rmb"`
	PendingSettlementRMB   float64 `json:"pending_settlement_rmb"`
}

func BuildAffiliateDashboardSummary(db *gorm.DB, logDB *gorm.DB, input AffiliateDashboardSummaryInput) (AffiliateDashboardSummary, error) {
	if db == nil {
		return AffiliateDashboardSummary{}, errors.New("nil db")
	}
	if logDB == nil {
		return AffiliateDashboardSummary{}, errors.New("nil log db")
	}

	visible, err := ListAffiliateVisibleUserIds(db, input.Scope)
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}

	if visible.Global {
		return buildGlobalAffiliateDashboardSummary(db, input)
	}

	summary := AffiliateDashboardSummary{
		KPITierName: "待配置",
		RuleStatus:  "pending_rules",
	}

	summary.TeamUserCount = len(visible.UserIds)

	ruleSet, hasPublishedRules, err := findAffiliateSummaryRuleSet(db, input)
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}
	if hasPublishedRules {
		metrics, err := buildAffiliateKPIMetrics(db, logDB, visible.UserIds, ruleSet.Id, input.Scope.AffiliateLevel, AffiliateKPIBuildInput{
			RuleSetId:       ruleSet.Id,
			PeriodStart:     input.StartTimestamp,
			PeriodEnd:       input.EndTimestamp,
			QuotaPerUnit:    input.QuotaPerUnit,
			USDExchangeRate: input.USDExchangeRate,
		})
		if err != nil {
			return AffiliateDashboardSummary{}, err
		}
		tier, err := selectAffiliateKPITier(db, ruleSet.Id, input.Scope.AffiliateLevel, metrics)
		if err != nil {
			return AffiliateDashboardSummary{}, err
		}
		summary.EffectiveNewUserCount = metrics.EffectiveNewUserCount
		summary.NetConsumptionQuota = metrics.PaidConsumptionRawQuota
		summary.RuleStatus = "published_rules"
		if tier.Name != "" {
			summary.KPITierName = tier.Name
		} else if tier.Code != "" {
			summary.KPITierName = tier.Code
		} else {
			summary.KPITierName = "未达标"
		}
	} else {
		summary.EffectiveNewUserCount, err = countAffiliateEffectiveNewUsers(db, logDB, visible, input)
		if err != nil {
			return AffiliateDashboardSummary{}, err
		}

		summary.NetConsumptionQuota, err = sumAffiliateNetConsumptionQuota(db, logDB, visible, input)
		if err != nil {
			return AffiliateDashboardSummary{}, err
		}
	}
	summary.NetConsumptionRMB = quotaToRMB(summary.NetConsumptionQuota, input.QuotaPerUnit, input.USDExchangeRate)
	summary.DailyTrends, err = buildAffiliateDashboardDailyTrends(db, logDB, visible, input)
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}

	return summary, nil
}

func buildGlobalAffiliateDashboardSummary(db *gorm.DB, input AffiliateDashboardSummaryInput) (AffiliateDashboardSummary, error) {
	summary := AffiliateDashboardSummary{
		KPITierName: "全局汇总",
		RuleStatus:  "published_rules",
	}

	var err error
	summary.TeamUserCount, err = countGlobalAffiliateTeamUsers(db)
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}

	aggregate, err := sumAffiliateKPISnapshotAggregate(db, input.Scope, input.StartTimestamp, input.EndTimestamp)
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}
	summary.EffectiveNewUserCount = aggregate.EffectiveNewUserCount
	summary.NetConsumptionQuota = aggregate.PaidConsumptionRawQuota
	summary.NetConsumptionRMB = quotaToRMB(summary.NetConsumptionQuota, input.QuotaPerUnit, input.USDExchangeRate)

	commissionCents, err := sumAffiliateTrendCommissionCents(db, input.Scope, input.StartTimestamp, input.EndTimestamp)
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}
	headFeeCents, err := sumAffiliateTrendHeadFeeCents(db, input.Scope, input.StartTimestamp, input.EndTimestamp)
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}
	pendingSettlementCents, err := sumAffiliateTrendPendingSettlementCents(db, input.Scope, input.StartTimestamp, input.EndTimestamp)
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}
	summary.EstimatedCommissionRMB = centsToRMB(commissionCents)
	summary.HeadFeeRMB = centsToRMB(headFeeCents)
	summary.PendingSettlementRMB = centsToRMB(pendingSettlementCents)

	summary.DailyTrends, err = buildGlobalAffiliateDashboardDailyTrends(db, input)
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}
	return summary, nil
}

type affiliateKPISnapshotAggregate struct {
	EffectiveNewUserCount   int
	PaidConsumptionRawQuota int64
}

func sumAffiliateKPISnapshotAggregate(db *gorm.DB, scope AffiliateScope, periodStart int64, periodEnd int64) (affiliateKPISnapshotAggregate, error) {
	tx := db.Model(&model.AffiliateKPISnapshot{})
	tx = applyAffiliateSummarySnapshotPeriodRange(tx, periodStart, periodEnd)
	tx = applyAffiliateSummaryFinanceScope(tx, scope)

	aggregate := affiliateKPISnapshotAggregate{}
	err := tx.Select(
		"COALESCE(SUM(effective_new_user_count), 0) AS effective_new_user_count, COALESCE(SUM(paid_consumption_raw_quota), 0) AS paid_consumption_raw_quota",
	).Scan(&aggregate).Error
	return aggregate, err
}

func buildGlobalAffiliateDashboardDailyTrends(db *gorm.DB, input AffiliateDashboardSummaryInput) ([]AffiliateDashboardTrendPoint, error) {
	if input.TrendStartTimestamp <= 0 || input.TrendEndTimestamp < input.TrendStartTimestamp {
		return []AffiliateDashboardTrendPoint{}, nil
	}

	points := []AffiliateDashboardTrendPoint{}
	for periodStart := input.TrendStartTimestamp; periodStart <= input.TrendEndTimestamp; periodStart += affiliateSecondsPerDay {
		periodEnd := periodStart + affiliateSecondsPerDay - 1
		if periodEnd > input.TrendEndTimestamp {
			periodEnd = input.TrendEndTimestamp
		}

		aggregate, err := sumAffiliateKPISnapshotAggregate(db, input.Scope, periodStart, periodEnd)
		if err != nil {
			return nil, err
		}
		commissionCents, err := sumAffiliateTrendCommissionCents(db, input.Scope, periodStart, periodEnd)
		if err != nil {
			return nil, err
		}
		headFeeCents, err := sumAffiliateTrendHeadFeeCents(db, input.Scope, periodStart, periodEnd)
		if err != nil {
			return nil, err
		}
		pendingSettlementCents, err := sumAffiliateTrendPendingSettlementCents(db, input.Scope, periodStart, periodEnd)
		if err != nil {
			return nil, err
		}

		points = append(points, AffiliateDashboardTrendPoint{
			PeriodStart:            periodStart,
			PeriodEnd:              periodEnd,
			EffectiveNewUserCount:  aggregate.EffectiveNewUserCount,
			NetConsumptionQuota:    aggregate.PaidConsumptionRawQuota,
			NetConsumptionRMB:      quotaToRMB(aggregate.PaidConsumptionRawQuota, input.QuotaPerUnit, input.USDExchangeRate),
			EstimatedCommissionRMB: centsToRMB(commissionCents),
			HeadFeeRMB:             centsToRMB(headFeeCents),
			PendingSettlementRMB:   centsToRMB(pendingSettlementCents),
		})
	}
	return points, nil
}

func countGlobalAffiliateTeamUsers(db *gorm.DB) (int, error) {
	var count int64
	err := db.Model(&model.AffiliateRelation{}).
		Where("status = ?", model.AffiliateProfileStatusActive).
		Distinct("descendant_user_id").
		Count(&count).Error
	return int(count), err
}

func countAffiliateEffectiveNewUsers(db *gorm.DB, logDB *gorm.DB, visible AffiliateVisibleUserIds, input AffiliateDashboardSummaryInput) (int, error) {
	if !visible.Global && len(visible.UserIds) == 0 {
		return 0, nil
	}

	criteria, ok, err := loadAffiliateSummaryEffectiveUserCriteria(db, input)
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, nil
	}

	tx := db.Model(&model.AffiliateInviteEvent{}).
		Where("invite_source = ?", AffiliateInviteSourceAffiliate)
	tx = applyAffiliateSummaryTimeRange(tx, input)
	if !visible.Global {
		tx = tx.Where("invitee_user_id IN ?", visible.UserIds)
	}

	var events []model.AffiliateInviteEvent
	if err := tx.Order("created_at asc, id asc").Find(&events).Error; err != nil {
		return 0, err
	}

	count := 0
	seen := map[int]struct{}{}
	for _, event := range events {
		if _, ok := seen[event.InviteeUserId]; ok {
			continue
		}
		seen[event.InviteeUserId] = struct{}{}
		qualified, err := affiliateInviteeMeetsEffectiveCriteria(db, logDB, event, criteria, affiliateEffectiveUserWindow{
			StartTimestamp:  input.StartTimestamp,
			EndTimestamp:    input.EndTimestamp,
			QuotaPerUnit:    input.QuotaPerUnit,
			USDExchangeRate: input.USDExchangeRate,
		})
		if err != nil {
			return 0, err
		}
		if qualified {
			count++
		}
	}
	return count, nil
}

func findAffiliateSummaryRuleSet(db *gorm.DB, input AffiliateDashboardSummaryInput) (model.AffiliateRuleSet, bool, error) {
	var ruleSet model.AffiliateRuleSet
	tx := db.Where("status = ?", model.AffiliateRuleSetStatusPublished)
	if input.EndTimestamp > 0 {
		tx = tx.Where("(effective_start = 0 OR effective_start <= ?) AND (effective_end = 0 OR effective_end >= ?)", input.EndTimestamp, input.StartTimestamp)
	}
	err := tx.Order("effective_start desc, published_at desc, id desc").First(&ruleSet).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AffiliateRuleSet{}, false, nil
	}
	if err != nil {
		return model.AffiliateRuleSet{}, false, err
	}
	return ruleSet, true, nil
}

type affiliateEffectiveUserCriteria struct {
	FirstRechargeMinCents int64
	PeriodNetPaidMinCents int64
	QualificationDays     int
}

type affiliateEffectiveUserWindow struct {
	StartTimestamp  int64
	EndTimestamp    int64
	QuotaPerUnit    float64
	USDExchangeRate float64
}

func loadAffiliateSummaryEffectiveUserCriteria(db *gorm.DB, input AffiliateDashboardSummaryInput) (affiliateEffectiveUserCriteria, bool, error) {
	ruleSet, ok, err := findAffiliateSummaryRuleSet(db, input)
	if err != nil || !ok {
		return affiliateEffectiveUserCriteria{}, false, err
	}

	return loadAffiliateEffectiveUserCriteriaForRuleSet(db, ruleSet.Id, input.Scope.AffiliateLevel)
}

func loadAffiliateEffectiveUserCriteriaForRuleSet(db *gorm.DB, ruleSetId int, affiliateLevel int) (affiliateEffectiveUserCriteria, bool, error) {
	if ruleSetId <= 0 {
		return affiliateEffectiveUserCriteria{}, false, nil
	}

	ruleTx := db.Where("rule_set_id = ?", ruleSetId)
	if affiliateLevel > 0 {
		ruleTx = ruleTx.Where("affiliate_level = ?", affiliateLevel)
	}
	var rules []model.AffiliateHeadFeeRule
	if err := ruleTx.Order("affiliate_level asc, id asc").Find(&rules).Error; err != nil {
		return affiliateEffectiveUserCriteria{}, false, err
	}
	if len(rules) == 0 {
		return affiliateEffectiveUserCriteria{}, false, nil
	}

	criteria := affiliateEffectiveUserCriteria{
		FirstRechargeMinCents: rules[0].FirstRechargeMinCents,
		PeriodNetPaidMinCents: rules[0].PeriodNetPaidMinCents,
		QualificationDays:     rules[0].QualificationDays,
	}
	for _, rule := range rules[1:] {
		if rule.FirstRechargeMinCents < criteria.FirstRechargeMinCents {
			criteria.FirstRechargeMinCents = rule.FirstRechargeMinCents
		}
		if rule.PeriodNetPaidMinCents < criteria.PeriodNetPaidMinCents {
			criteria.PeriodNetPaidMinCents = rule.PeriodNetPaidMinCents
		}
		if rule.QualificationDays < criteria.QualificationDays {
			criteria.QualificationDays = rule.QualificationDays
		}
	}
	return criteria, true, nil
}

func affiliateInviteeMeetsEffectiveCriteria(db *gorm.DB, logDB *gorm.DB, event model.AffiliateInviteEvent, criteria affiliateEffectiveUserCriteria, window affiliateEffectiveUserWindow) (bool, error) {
	qualificationEnd := window.EndTimestamp
	if criteria.QualificationDays > 0 {
		qualificationEnd = event.CreatedAt + int64(criteria.QualificationDays)*affiliateSecondsPerDay
		if window.EndTimestamp > 0 && window.EndTimestamp < qualificationEnd {
			qualificationEnd = window.EndTimestamp
		}
	}
	tx := logDB.Where("user_id = ? AND type IN ?", event.InviteeUserId, []int{model.LogTypeConsume, model.LogTypeRefund}).
		Where("created_at >= ?", event.CreatedAt)
	if qualificationEnd > 0 {
		tx = tx.Where("created_at <= ?", qualificationEnd)
	}

	stats := affiliateSummaryEffectiveUserStats{}
	if err := scanAffiliateLogsByCreatedAtCursor(tx, func(logs []model.Log) error {
		for _, log := range logs {
			if affiliateLogBoolFlag(log, "affiliate_abnormal") || affiliateLogBoolFlag(log, "abnormal") {
				stats.Abnormal = true
				continue
			}
			attribution, err := resolveAffiliateLogQuotaAttribution(db, log)
			if err != nil {
				return err
			}
			if attribution.PaidRawQuota == 0 {
				continue
			}
			cents := affiliateRawQuotaToCents(attribution.PaidRawQuota, AffiliateCommissionBuildInput{
				PeriodStart:     window.StartTimestamp,
				PeriodEnd:       window.EndTimestamp,
				QuotaPerUnit:    window.QuotaPerUnit,
				USDExchangeRate: window.USDExchangeRate,
			})
			if log.Type == model.LogTypeRefund && cents < 0 {
				stats.HasPaidRefund = true
			}
			if log.Type == model.LogTypeConsume && cents > 0 && stats.FirstRechargeCents == 0 {
				stats.FirstRechargeCents = cents
			}
			stats.NetPaidCents += cents
		}
		return nil
	}); err != nil {
		return false, err
	}
	return !stats.Abnormal &&
		!stats.HasPaidRefund &&
		stats.FirstRechargeCents >= criteria.FirstRechargeMinCents &&
		stats.NetPaidCents >= criteria.PeriodNetPaidMinCents, nil
}

type affiliateSummaryEffectiveUserStats struct {
	FirstRechargeCents int64
	NetPaidCents       int64
	HasPaidRefund      bool
	Abnormal           bool
}

func sumAffiliateNetConsumptionQuota(db *gorm.DB, logDB *gorm.DB, visible AffiliateVisibleUserIds, input AffiliateDashboardSummaryInput) (int64, error) {
	if !visible.Global && len(visible.UserIds) == 0 {
		return 0, nil
	}

	tx := logDB.Where("type IN ?", []int{model.LogTypeConsume, model.LogTypeRefund})
	tx = applyAffiliateSummaryTimeRange(tx, input)
	if !visible.Global {
		tx = tx.Where("user_id IN ?", visible.UserIds)
	}

	var quota int64
	if err := scanAffiliateLogsByCreatedAtCursor(tx, func(logs []model.Log) error {
		for _, log := range logs {
			if affiliateLogBoolFlag(log, "affiliate_abnormal") || affiliateLogBoolFlag(log, "abnormal") {
				continue
			}
			attribution, err := resolveAffiliateLogQuotaAttribution(db, log)
			if err != nil {
				return err
			}
			quota += attribution.PaidRawQuota
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return quota, nil
}

func buildAffiliateDashboardDailyTrends(db *gorm.DB, logDB *gorm.DB, visible AffiliateVisibleUserIds, input AffiliateDashboardSummaryInput) ([]AffiliateDashboardTrendPoint, error) {
	if input.TrendStartTimestamp <= 0 || input.TrendEndTimestamp < input.TrendStartTimestamp {
		return []AffiliateDashboardTrendPoint{}, nil
	}

	points := []AffiliateDashboardTrendPoint{}
	for periodStart := input.TrendStartTimestamp; periodStart <= input.TrendEndTimestamp; periodStart += affiliateSecondsPerDay {
		periodEnd := periodStart + affiliateSecondsPerDay - 1
		if periodEnd > input.TrendEndTimestamp {
			periodEnd = input.TrendEndTimestamp
		}
		bucketInput := input
		bucketInput.StartTimestamp = periodStart
		bucketInput.EndTimestamp = periodEnd

		netQuota, err := sumAffiliateNetConsumptionQuota(db, logDB, visible, bucketInput)
		if err != nil {
			return nil, err
		}
		effectiveUsers, err := countAffiliateEffectiveNewUsers(db, logDB, visible, bucketInput)
		if err != nil {
			return nil, err
		}
		commissionCents, err := sumAffiliateTrendCommissionCents(db, input.Scope, periodStart, periodEnd)
		if err != nil {
			return nil, err
		}
		headFeeCents, err := sumAffiliateTrendHeadFeeCents(db, input.Scope, periodStart, periodEnd)
		if err != nil {
			return nil, err
		}
		pendingSettlementCents, err := sumAffiliateTrendPendingSettlementCents(db, input.Scope, periodStart, periodEnd)
		if err != nil {
			return nil, err
		}

		points = append(points, AffiliateDashboardTrendPoint{
			PeriodStart:            periodStart,
			PeriodEnd:              periodEnd,
			EffectiveNewUserCount:  effectiveUsers,
			NetConsumptionQuota:    netQuota,
			NetConsumptionRMB:      quotaToRMB(netQuota, input.QuotaPerUnit, input.USDExchangeRate),
			EstimatedCommissionRMB: centsToRMB(commissionCents),
			HeadFeeRMB:             centsToRMB(headFeeCents),
			PendingSettlementRMB:   centsToRMB(pendingSettlementCents),
		})
	}
	return points, nil
}

func sumAffiliateTrendCommissionCents(db *gorm.DB, scope AffiliateScope, periodStart int64, periodEnd int64) (int64, error) {
	tx := db.Model(&model.AffiliateCommissionEvent{}).
		Where("status IN ?", []string{model.AffiliateEventStatusPending, model.AffiliateEventStatusReady})
	tx = applyAffiliateSummaryCreatedAtRange(tx, periodStart, periodEnd)
	tx = applyAffiliateSummaryFinanceScope(tx, scope)
	var cents int64
	if err := tx.Select("COALESCE(SUM(commission_cents), 0)").Scan(&cents).Error; err != nil {
		return 0, err
	}
	return cents, nil
}

func sumAffiliateTrendHeadFeeCents(db *gorm.DB, scope AffiliateScope, periodStart int64, periodEnd int64) (int64, error) {
	tx := db.Model(&model.AffiliateHeadFeeEvent{}).
		Where("status IN ?", []string{model.AffiliateEventStatusPending, model.AffiliateEventStatusReady})
	tx = applyAffiliateSummaryCreatedAtRange(tx, periodStart, periodEnd)
	tx = applyAffiliateSummaryFinanceScope(tx, scope)
	var cents int64
	if err := tx.Select("COALESCE(SUM(amount_cents), 0)").Scan(&cents).Error; err != nil {
		return 0, err
	}
	return cents, nil
}

func sumAffiliateTrendPendingSettlementCents(db *gorm.DB, scope AffiliateScope, periodStart int64, periodEnd int64) (int64, error) {
	tx := db.Model(&model.AffiliateSettlement{}).
		Where("status IN ?", []string{model.AffiliateSettlementStatusDraft, model.AffiliateSettlementStatusFrozen})
	tx = applyAffiliateSummaryCreatedAtRange(tx, periodStart, periodEnd)
	tx = applyAffiliateSummaryFinanceScope(tx, scope)
	var cents int64
	if err := tx.Select("COALESCE(SUM(payable_cents), 0)").Scan(&cents).Error; err != nil {
		return 0, err
	}
	return cents, nil
}

func applyAffiliateSummaryFinanceScope(tx *gorm.DB, scope AffiliateScope) *gorm.DB {
	if scope.Kind == AffiliateScopeGlobal {
		return tx
	}
	if scope.UserId > 0 {
		return tx.Where("affiliate_user_id = ?", scope.UserId)
	}
	return tx.Where("affiliate_user_id = ?", -1)
}

func applyAffiliateSummaryCreatedAtRange(tx *gorm.DB, periodStart int64, periodEnd int64) *gorm.DB {
	tx = tx.Where("created_at >= ?", periodStart)
	if periodEnd > 0 {
		tx = tx.Where("created_at <= ?", periodEnd)
	}
	return tx
}

func applyAffiliateSummarySnapshotPeriodRange(tx *gorm.DB, periodStart int64, periodEnd int64) *gorm.DB {
	if periodStart > 0 {
		tx = tx.Where("period_start >= ?", periodStart)
	}
	if periodEnd > 0 {
		tx = tx.Where("period_start <= ?", periodEnd)
	}
	return tx
}

func applyAffiliateSummaryTimeRange(tx *gorm.DB, input AffiliateDashboardSummaryInput) *gorm.DB {
	if input.StartTimestamp != 0 {
		tx = tx.Where("created_at >= ?", input.StartTimestamp)
	}
	if input.EndTimestamp != 0 {
		tx = tx.Where("created_at <= ?", input.EndTimestamp)
	}
	return tx
}

func quotaToRMB(quota int64, quotaPerUnit float64, usdExchangeRate float64) float64 {
	if quota == 0 {
		return 0
	}
	if quotaPerUnit <= 0 {
		quotaPerUnit = common.QuotaPerUnit
	}
	if usdExchangeRate <= 0 {
		usdExchangeRate = 1
	}
	return float64(quota) / quotaPerUnit * usdExchangeRate
}

func centsToRMB(cents int64) float64 {
	if cents == 0 {
		return 0
	}
	return float64(cents) / 100
}
