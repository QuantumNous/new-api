package service

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type AffiliateDashboardSummaryInput struct {
	Scope           AffiliateScope
	StartTimestamp  int64
	EndTimestamp    int64
	QuotaPerUnit    float64
	USDExchangeRate float64
}

type AffiliateDashboardSummary struct {
	TeamUserCount          int     `json:"team_user_count"`
	EffectiveNewUserCount  int     `json:"effective_new_user_count"`
	NetConsumptionQuota    int64   `json:"net_consumption_quota"`
	NetConsumptionRMB      float64 `json:"net_consumption_rmb"`
	EstimatedCommissionRMB float64 `json:"estimated_commission_rmb"`
	HeadFeeRMB             float64 `json:"head_fee_rmb"`
	PendingSettlementRMB   float64 `json:"pending_settlement_rmb"`
	KPITierName            string  `json:"kpi_tier_name"`
	RuleStatus             string  `json:"rule_status"`
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

	summary := AffiliateDashboardSummary{
		KPITierName: "待配置",
		RuleStatus:  "pending_rules",
	}

	if visible.Global {
		summary.TeamUserCount, err = countGlobalAffiliateTeamUsers(db)
	} else {
		summary.TeamUserCount = len(visible.UserIds)
	}
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}

	summary.EffectiveNewUserCount, err = countAffiliateEffectiveNewUsers(db, visible, input)
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}

	summary.NetConsumptionQuota, err = sumAffiliateNetConsumptionQuota(logDB, visible, input)
	if err != nil {
		return AffiliateDashboardSummary{}, err
	}
	summary.NetConsumptionRMB = quotaToRMB(summary.NetConsumptionQuota, input.QuotaPerUnit, input.USDExchangeRate)

	return summary, nil
}

func countGlobalAffiliateTeamUsers(db *gorm.DB) (int, error) {
	var count int64
	err := db.Model(&model.AffiliateRelation{}).
		Where("status = ?", model.AffiliateProfileStatusActive).
		Distinct("descendant_user_id").
		Count(&count).Error
	return int(count), err
}

func countAffiliateEffectiveNewUsers(db *gorm.DB, visible AffiliateVisibleUserIds, input AffiliateDashboardSummaryInput) (int, error) {
	if !visible.Global && len(visible.UserIds) == 0 {
		return 0, nil
	}

	tx := db.Model(&model.AffiliateInviteEvent{}).
		Where("invite_source = ?", AffiliateInviteSourceAffiliate)
	tx = applyAffiliateSummaryTimeRange(tx, input)
	if !visible.Global {
		tx = tx.Where("invitee_user_id IN ?", visible.UserIds)
	}

	var count int64
	if err := tx.Distinct("invitee_user_id").Count(&count).Error; err != nil {
		return 0, err
	}
	return int(count), nil
}

func sumAffiliateNetConsumptionQuota(logDB *gorm.DB, visible AffiliateVisibleUserIds, input AffiliateDashboardSummaryInput) (int64, error) {
	if !visible.Global && len(visible.UserIds) == 0 {
		return 0, nil
	}

	tx := logDB.Model(&model.Log{}).
		Select("COALESCE(SUM(CASE WHEN type = ? THEN quota WHEN type = ? THEN -quota ELSE 0 END), 0)", model.LogTypeConsume, model.LogTypeRefund).
		Where("type IN ?", []int{model.LogTypeConsume, model.LogTypeRefund})
	tx = applyAffiliateSummaryTimeRange(tx, input)
	if !visible.Global {
		tx = tx.Where("user_id IN ?", visible.UserIds)
	}

	var quota int64
	if err := tx.Scan(&quota).Error; err != nil {
		return 0, err
	}
	return quota, nil
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
