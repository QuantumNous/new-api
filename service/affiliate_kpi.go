package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type AffiliateKPIBuildInput struct {
	RuleSetId       int
	PeriodStart     int64
	PeriodEnd       int64
	QuotaPerUnit    float64
	USDExchangeRate float64
}

type affiliateKPIMetrics struct {
	TeamUserCount           int
	EffectiveNewUserCount   int
	NetPaidConsumptionCents int64
	PaidConsumptionRawQuota int64
	GiftOnlyUserCount       int
	AbnormalUserCount       int
	GiftOnlyRatioBps        int
	AbnormalRatioBps        int
	SecondPaymentRatioBps   int
	SecondPaymentUserCount  int
}

type affiliateKPIUserStats struct {
	HasPaid              bool
	PaidConsumeCount     int
	HasSecondPaymentFlag bool
	HasGiftOrTrial       bool
	Abnormal             bool
}

func BuildAffiliateKPISnapshots(db *gorm.DB, logDB *gorm.DB, input AffiliateKPIBuildInput) ([]model.AffiliateKPISnapshot, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if logDB == nil {
		return nil, errors.New("nil log db")
	}
	if input.PeriodStart > 0 && input.PeriodEnd > 0 && input.PeriodEnd < input.PeriodStart {
		return nil, errors.New("invalid kpi period")
	}

	ruleSet, err := findAffiliateKPIRuleSet(db, input)
	if err != nil {
		return nil, err
	}

	var profiles []model.AffiliateProfile
	if err := db.
		Where("status = ? AND level IN ?", model.AffiliateProfileStatusActive, []int{1, 2}).
		Order("user_id asc").
		Find(&profiles).Error; err != nil {
		return nil, err
	}

	snapshots := make([]model.AffiliateKPISnapshot, 0, len(profiles))
	err = db.Transaction(func(tx *gorm.DB) error {
		for _, profile := range profiles {
			scope := ResolveAffiliateAccessScope(AffiliateScopeInput{
				UserId:        profile.UserId,
				ProfileStatus: profile.Status,
				ProfileLevel:  profile.Level,
			})
			if scope.Kind != AffiliateScopeAffiliate {
				continue
			}

			visible, err := ListAffiliateVisibleUserIds(tx, scope)
			if err != nil {
				return err
			}
			metrics, err := buildAffiliateKPIMetrics(tx, logDB, visible.UserIds, input)
			if err != nil {
				return err
			}
			tier, err := selectAffiliateKPITier(tx, ruleSet.Id, profile.Level, metrics)
			if err != nil {
				return err
			}

			snapshot := model.AffiliateKPISnapshot{
				AffiliateUserId:         profile.UserId,
				RuleSetId:               ruleSet.Id,
				PeriodStart:             input.PeriodStart,
				PeriodEnd:               input.PeriodEnd,
				EffectiveNewUserCount:   metrics.EffectiveNewUserCount,
				NetPaidConsumptionCents: metrics.NetPaidConsumptionCents,
				PaidConsumptionRawQuota: metrics.PaidConsumptionRawQuota,
				GiftOnlyUserCount:       metrics.GiftOnlyUserCount,
				AbnormalUserCount:       metrics.AbnormalUserCount,
				GiftOnlyRatioBps:        metrics.GiftOnlyRatioBps,
				AbnormalRatioBps:        metrics.AbnormalRatioBps,
				SecondPaymentRatioBps:   metrics.SecondPaymentRatioBps,
				TierCode:                tier.Code,
				CoefficientBps:          tier.CoefficientBps,
				SyntheticMarker:         affiliateKPISnapshotSyntheticMarker(ruleSet.Id, profile.UserId, input),
				Snapshot: common.GetJsonString(map[string]interface{}{
					"rule_set_version":          ruleSet.Version,
					"team_user_count":           metrics.TeamUserCount,
					"second_payment_user_count": metrics.SecondPaymentUserCount,
					"kpi_tier_name":             tier.Name,
				}),
			}
			saved, err := saveAffiliateKPISnapshot(tx, snapshot)
			if err != nil {
				return err
			}
			snapshots = append(snapshots, saved)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return snapshots, nil
}

func findAffiliateKPIRuleSet(db *gorm.DB, input AffiliateKPIBuildInput) (model.AffiliateRuleSet, error) {
	var ruleSet model.AffiliateRuleSet
	tx := db.Where("status = ?", model.AffiliateRuleSetStatusPublished)
	if input.RuleSetId > 0 {
		tx = tx.Where("id = ?", input.RuleSetId)
	}
	if input.PeriodEnd > 0 {
		tx = tx.Where("(effective_start = 0 OR effective_start <= ?) AND (effective_end = 0 OR effective_end >= ?)", input.PeriodEnd, input.PeriodStart)
	}
	err := tx.Order("effective_start desc, published_at desc, id desc").First(&ruleSet).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AffiliateRuleSet{}, errors.New("no published affiliate rule set for kpi snapshot")
	}
	return ruleSet, err
}

func buildAffiliateKPIMetrics(db *gorm.DB, logDB *gorm.DB, visibleUserIds []int, input AffiliateKPIBuildInput) (affiliateKPIMetrics, error) {
	metrics := affiliateKPIMetrics{TeamUserCount: len(visibleUserIds)}
	if len(visibleUserIds) == 0 {
		return metrics, nil
	}

	effectiveCount, err := countAffiliateKPIEffectiveNewUsers(db, visibleUserIds, input)
	if err != nil {
		return affiliateKPIMetrics{}, err
	}
	metrics.EffectiveNewUserCount = effectiveCount

	var logs []model.Log
	tx := logDB.
		Where("user_id IN ? AND type IN ?", visibleUserIds, []int{model.LogTypeConsume, model.LogTypeRefund}).
		Order("created_at asc, id asc")
	tx = applyAffiliateKPITimeRange(tx, input)
	if err := tx.Find(&logs).Error; err != nil {
		return affiliateKPIMetrics{}, err
	}

	stats := map[int]*affiliateKPIUserStats{}
	for _, userId := range visibleUserIds {
		stats[userId] = &affiliateKPIUserStats{}
	}
	for _, log := range logs {
		userStats := stats[log.UserId]
		if userStats == nil {
			continue
		}
		if affiliateLogBoolFlag(log, "affiliate_abnormal") || affiliateLogBoolFlag(log, "abnormal") {
			userStats.Abnormal = true
		}
		if affiliateLogBoolFlag(log, "affiliate_second_payment") || affiliateLogBoolFlag(log, "second_payment") {
			userStats.HasSecondPaymentFlag = true
		}

		source := ResolveAffiliateLogQuotaSource(log)
		switch source {
		case AffiliateQuotaSourcePaid:
			userStats.HasPaid = true
			if log.Type == model.LogTypeConsume {
				userStats.PaidConsumeCount++
			}
			metrics.PaidConsumptionRawQuota += signedAffiliateLogQuota(log)
			metrics.NetPaidConsumptionCents += affiliateLogQuotaToCents(log, AffiliateCommissionBuildInput(input))
		case AffiliateQuotaSourceGift, AffiliateQuotaSourceTrial:
			userStats.HasGiftOrTrial = true
		}
	}

	for _, userStats := range stats {
		if userStats.HasGiftOrTrial && !userStats.HasPaid {
			metrics.GiftOnlyUserCount++
		}
		if userStats.Abnormal {
			metrics.AbnormalUserCount++
		}
		if userStats.PaidConsumeCount >= 2 || userStats.HasSecondPaymentFlag {
			metrics.SecondPaymentUserCount++
		}
	}
	metrics.GiftOnlyRatioBps = affiliateRatioBps(metrics.GiftOnlyUserCount, metrics.EffectiveNewUserCount)
	metrics.AbnormalRatioBps = affiliateRatioBps(metrics.AbnormalUserCount, metrics.EffectiveNewUserCount)
	metrics.SecondPaymentRatioBps = affiliateRatioBps(metrics.SecondPaymentUserCount, metrics.EffectiveNewUserCount)
	return metrics, nil
}

func countAffiliateKPIEffectiveNewUsers(db *gorm.DB, visibleUserIds []int, input AffiliateKPIBuildInput) (int, error) {
	tx := db.Model(&model.AffiliateInviteEvent{}).
		Where("invite_source = ? AND invitee_user_id IN ?", AffiliateInviteSourceAffiliate, visibleUserIds)
	if input.PeriodStart != 0 {
		tx = tx.Where("created_at >= ?", input.PeriodStart)
	}
	if input.PeriodEnd != 0 {
		tx = tx.Where("created_at <= ?", input.PeriodEnd)
	}

	var count int64
	if err := tx.Distinct("invitee_user_id").Count(&count).Error; err != nil {
		return 0, err
	}
	return int(count), nil
}

func selectAffiliateKPITier(db *gorm.DB, ruleSetId int, affiliateLevel int, metrics affiliateKPIMetrics) (model.AffiliateKPITier, error) {
	var tiers []model.AffiliateKPITier
	if err := db.
		Where("rule_set_id = ? AND affiliate_level = ?", ruleSetId, affiliateLevel).
		Order("sort_order desc, min_effective_new_users desc, min_net_paid_amount_cents desc, id desc").
		Find(&tiers).Error; err != nil {
		return model.AffiliateKPITier{}, err
	}
	for _, tier := range tiers {
		if metrics.EffectiveNewUserCount < tier.MinEffectiveNewUsers {
			continue
		}
		if metrics.NetPaidConsumptionCents < tier.MinNetPaidAmountCents {
			continue
		}
		if tier.MaxGiftOnlyRatioBps > 0 && metrics.GiftOnlyRatioBps > tier.MaxGiftOnlyRatioBps {
			continue
		}
		if tier.MaxAbnormalRatioBps > 0 && metrics.AbnormalRatioBps > tier.MaxAbnormalRatioBps {
			continue
		}
		if metrics.SecondPaymentRatioBps < tier.MinSecondPaymentRatioBps {
			continue
		}
		return tier, nil
	}
	return model.AffiliateKPITier{
		AffiliateLevel: affiliateLevel,
		Code:           "",
		Name:           "",
		CoefficientBps: affiliateBpsBase,
	}, nil
}

func saveAffiliateKPISnapshot(db *gorm.DB, snapshot model.AffiliateKPISnapshot) (model.AffiliateKPISnapshot, error) {
	var existing model.AffiliateKPISnapshot
	err := db.
		Where("affiliate_user_id = ? AND rule_set_id = ? AND period_start = ? AND period_end = ?", snapshot.AffiliateUserId, snapshot.RuleSetId, snapshot.PeriodStart, snapshot.PeriodEnd).
		First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AffiliateKPISnapshot{}, err
	}
	if err == nil {
		snapshot.Id = existing.Id
		if err := db.Save(&snapshot).Error; err != nil {
			return model.AffiliateKPISnapshot{}, err
		}
		return snapshot, nil
	}
	if err := db.Create(&snapshot).Error; err != nil {
		return model.AffiliateKPISnapshot{}, err
	}
	return snapshot, nil
}

func applyAffiliateKPITimeRange(tx *gorm.DB, input AffiliateKPIBuildInput) *gorm.DB {
	if input.PeriodStart != 0 {
		tx = tx.Where("created_at >= ?", input.PeriodStart)
	}
	if input.PeriodEnd != 0 {
		tx = tx.Where("created_at <= ?", input.PeriodEnd)
	}
	return tx
}

func affiliateRatioBps(numerator int, denominator int) int {
	if numerator <= 0 || denominator <= 0 {
		return 0
	}
	return numerator * affiliateBpsBase / denominator
}

func affiliateLogBoolFlag(log model.Log, key string) bool {
	otherMap, _ := common.StrToMap(log.Other)
	value, ok := otherMap[key]
	if !ok {
		return false
	}
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		return strings.EqualFold(strings.TrimSpace(typed), "true") || strings.TrimSpace(typed) == "1"
	case float64:
		return typed != 0
	case int:
		return typed != 0
	default:
		return false
	}
}

func affiliateKPISnapshotSyntheticMarker(ruleSetId int, affiliateUserId int, input AffiliateKPIBuildInput) string {
	return fmt.Sprintf("rule:%d:affiliate:%d:period:%d-%d", ruleSetId, affiliateUserId, input.PeriodStart, input.PeriodEnd)
}
