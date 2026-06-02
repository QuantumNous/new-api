package service

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const (
	AffiliateQuotaSourcePaid  = "paid"
	AffiliateQuotaSourceGift  = "gift"
	AffiliateQuotaSourceTrial = "trial"

	AffiliateCommissionEventKindAccrual          = "accrual"
	AffiliateCommissionEventKindClawback         = "clawback"
	AffiliateCommissionEventKindManualAdjustment = "manual_adjustment"
)

type AffiliateCommissionBuildInput struct {
	RuleSetId       int
	PeriodStart     int64
	PeriodEnd       int64
	QuotaPerUnit    float64
	USDExchangeRate float64
}

func BuildAffiliatePendingCommissionEvents(db *gorm.DB, logDB *gorm.DB, input AffiliateCommissionBuildInput) ([]model.AffiliateCommissionEvent, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if logDB == nil {
		return nil, errors.New("nil log db")
	}
	if input.PeriodStart > 0 && input.PeriodEnd > 0 && input.PeriodEnd < input.PeriodStart {
		return nil, errors.New("invalid commission period")
	}

	sourceLogs, err := listAffiliateCommissionSourceLogs(logDB, input)
	if err != nil {
		return nil, err
	}
	if len(sourceLogs) == 0 {
		return []model.AffiliateCommissionEvent{}, nil
	}

	cumulative, err := loadAffiliatePriorPaidCentsByUser(logDB, sourceLogs, input)
	if err != nil {
		return nil, err
	}

	created := make([]model.AffiliateCommissionEvent, 0)
	err = db.Transaction(func(tx *gorm.DB) error {
		for _, sourceLog := range sourceLogs {
			if ResolveAffiliateLogQuotaSource(sourceLog) != AffiliateQuotaSourcePaid {
				continue
			}

			netPaidCents := affiliateLogQuotaToCents(sourceLog, input)
			if netPaidCents == 0 {
				continue
			}
			rawQuota := signedAffiliateLogQuota(sourceLog)
			beforeCents := cumulative[sourceLog.UserId]
			afterCents := beforeCents + netPaidCents
			cumulative[sourceLog.UserId] = afterCents

			ruleSet, err := findAffiliateCommissionRuleSetForLog(tx, sourceLog, input)
			if err != nil {
				return err
			}
			relations, err := listActiveAffiliateRelationsForLog(tx, sourceLog)
			if err != nil {
				return err
			}
			for _, relation := range relations {
				profile, err := getActiveAffiliateProfileForCommission(tx, relation.AncestorUserId)
				if err != nil {
					return err
				}
				if profile == nil || (profile.Level != 1 && profile.Level != 2) {
					continue
				}

				rule, tier, err := getAffiliateCommissionRuleAndTier(tx, ruleSet.Id, profile.Level, tierCumulativeCents(sourceLog, beforeCents, afterCents))
				if err != nil {
					return err
				}
				kpiSnapshotId, coefficientBps, err := getAffiliateCommissionKPICoefficient(tx, relation.AncestorUserId, ruleSet.Id, input)
				if err != nil {
					return err
				}
				baseRateBps := rule.DefaultRateBps
				capRateBps := rule.DefaultCapRateBps
				if tier != nil {
					baseRateBps = tier.BaseRateBps
					capRateBps = tier.CapRateBps
				}
				finalRateBps := applyAffiliateKPICoefficient(baseRateBps, capRateBps, coefficientBps)
				event := model.AffiliateCommissionEvent{
					AffiliateUserId:                  relation.AncestorUserId,
					DownstreamUserId:                 sourceLog.UserId,
					SourceLogId:                      sourceLog.Id,
					Kind:                             affiliateCommissionKindForLog(sourceLog),
					Status:                           model.AffiliateEventStatusPending,
					RuleSetId:                        ruleSet.Id,
					KPISnapshotId:                    kpiSnapshotId,
					PeriodStart:                      input.PeriodStart,
					PeriodEnd:                        input.PeriodEnd,
					NetPaidConsumptionCents:          netPaidCents,
					RawQuota:                         rawQuota,
					UserCumulativeNetPaidBeforeCents: beforeCents,
					UserCumulativeNetPaidAfterCents:  afterCents,
					BaseRateBps:                      baseRateBps,
					CapRateBps:                       capRateBps,
					KPICoefficientBps:                coefficientBps,
					FinalRateBps:                     finalRateBps,
					CommissionCents:                  calculateAffiliateCommissionCents(netPaidCents, finalRateBps),
					SyntheticMarker:                  affiliateCommissionSyntheticMarker(ruleSet.Id, sourceLog.Id, relation.AncestorUserId),
					Metadata: common.GetJsonString(map[string]interface{}{
						"quota_source":     AffiliateQuotaSourcePaid,
						"rule_set_version": ruleSet.Version,
						"log_type":         sourceLog.Type,
					}),
				}

				saved, err := createAffiliateCommissionEventIfMissing(tx, event)
				if err != nil {
					return err
				}
				created = append(created, saved)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

func ResolveAffiliateLogQuotaSource(log model.Log) string {
	otherMap, _ := common.StrToMap(log.Other)
	for _, key := range []string{"quota_source", "affiliate_quota_source", "billing_source"} {
		if value, ok := otherMap[key]; ok {
			source := strings.ToLower(strings.TrimSpace(fmt.Sprint(value)))
			switch source {
			case AffiliateQuotaSourcePaid, AffiliateQuotaSourceGift, AffiliateQuotaSourceTrial:
				return source
			}
		}
	}
	return ""
}

func listAffiliateCommissionSourceLogs(logDB *gorm.DB, input AffiliateCommissionBuildInput) ([]model.Log, error) {
	tx := logDB.
		Where("type IN ?", []int{model.LogTypeConsume, model.LogTypeRefund}).
		Order("created_at asc, id asc")
	if input.PeriodStart != 0 {
		tx = tx.Where("created_at >= ?", input.PeriodStart)
	}
	if input.PeriodEnd != 0 {
		tx = tx.Where("created_at <= ?", input.PeriodEnd)
	}

	var logs []model.Log
	if err := tx.Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}

func loadAffiliatePriorPaidCentsByUser(logDB *gorm.DB, sourceLogs []model.Log, input AffiliateCommissionBuildInput) (map[int]int64, error) {
	cumulative := make(map[int]int64)
	if input.PeriodStart == 0 {
		return cumulative, nil
	}

	userIds := make([]int, 0)
	seen := map[int]bool{}
	for _, log := range sourceLogs {
		if log.UserId <= 0 || seen[log.UserId] {
			continue
		}
		seen[log.UserId] = true
		userIds = append(userIds, log.UserId)
	}
	if len(userIds) == 0 {
		return cumulative, nil
	}

	var priorLogs []model.Log
	if err := logDB.
		Where("user_id IN ? AND type IN ? AND created_at < ?", userIds, []int{model.LogTypeConsume, model.LogTypeRefund}, input.PeriodStart).
		Order("created_at asc, id asc").
		Find(&priorLogs).Error; err != nil {
		return nil, err
	}
	for _, log := range priorLogs {
		if ResolveAffiliateLogQuotaSource(log) != AffiliateQuotaSourcePaid {
			continue
		}
		cumulative[log.UserId] += affiliateLogQuotaToCents(log, input)
	}
	return cumulative, nil
}

func findAffiliateCommissionRuleSetForLog(db *gorm.DB, log model.Log, input AffiliateCommissionBuildInput) (model.AffiliateRuleSet, error) {
	var ruleSet model.AffiliateRuleSet
	tx := db.Where("status = ?", model.AffiliateRuleSetStatusPublished)
	if input.RuleSetId > 0 {
		tx = tx.Where("id = ?", input.RuleSetId)
	}
	tx = tx.Where("(effective_start = 0 OR effective_start <= ?) AND (effective_end = 0 OR effective_end >= ?)", log.CreatedAt, log.CreatedAt)
	err := tx.Order("effective_start desc, published_at desc, id desc").First(&ruleSet).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AffiliateRuleSet{}, errors.New("no published affiliate rule set for commission log")
	}
	return ruleSet, err
}

func listActiveAffiliateRelationsForLog(db *gorm.DB, log model.Log) ([]model.AffiliateRelation, error) {
	var relations []model.AffiliateRelation
	err := db.
		Where(
			"descendant_user_id = ? AND status = ? AND (effective_at = 0 OR effective_at <= ?) AND (ended_at = 0 OR ended_at >= ?)",
			log.UserId,
			model.AffiliateProfileStatusActive,
			log.CreatedAt,
			log.CreatedAt,
		).
		Order("depth asc, ancestor_user_id asc").
		Find(&relations).Error
	return relations, err
}

func getActiveAffiliateProfileForCommission(db *gorm.DB, userId int) (*model.AffiliateProfile, error) {
	var profile model.AffiliateProfile
	err := db.
		Where("user_id = ? AND status = ?", userId, model.AffiliateProfileStatusActive).
		First(&profile).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func getAffiliateCommissionRuleAndTier(db *gorm.DB, ruleSetId int, affiliateLevel int, cumulativeCents int64) (model.AffiliateCommissionRule, *model.AffiliateCommissionTier, error) {
	var rule model.AffiliateCommissionRule
	if err := db.
		Where("rule_set_id = ? AND affiliate_level = ? AND status = ?", ruleSetId, affiliateLevel, model.AffiliateProfileStatusActive).
		First(&rule).Error; err != nil {
		return model.AffiliateCommissionRule{}, nil, err
	}

	var tiers []model.AffiliateCommissionTier
	if err := db.
		Where("rule_set_id = ? AND affiliate_level = ?", ruleSetId, affiliateLevel).
		Order("sort_order asc, min_net_paid_amount_cents asc, id asc").
		Find(&tiers).Error; err != nil {
		return model.AffiliateCommissionRule{}, nil, err
	}
	for _, tier := range tiers {
		if cumulativeCents < tier.MinNetPaidAmountCents {
			continue
		}
		if tier.MaxNetPaidAmountCents > 0 && cumulativeCents > tier.MaxNetPaidAmountCents {
			continue
		}
		selected := tier
		return rule, &selected, nil
	}
	return rule, nil, nil
}

func getAffiliateCommissionKPICoefficient(db *gorm.DB, affiliateUserId int, ruleSetId int, input AffiliateCommissionBuildInput) (int, int, error) {
	var snapshot model.AffiliateKPISnapshot
	err := db.
		Where("affiliate_user_id = ? AND rule_set_id = ? AND period_start = ? AND period_end = ?", affiliateUserId, ruleSetId, input.PeriodStart, input.PeriodEnd).
		First(&snapshot).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, affiliateBpsBase, nil
	}
	if err != nil {
		return 0, 0, err
	}
	coefficient := snapshot.CoefficientBps
	if coefficient < affiliateBpsBase {
		coefficient = affiliateBpsBase
	}
	return snapshot.Id, coefficient, nil
}

func createAffiliateCommissionEventIfMissing(db *gorm.DB, event model.AffiliateCommissionEvent) (model.AffiliateCommissionEvent, error) {
	var existing model.AffiliateCommissionEvent
	err := db.Where("synthetic_marker = ?", event.SyntheticMarker).First(&existing).Error
	if err == nil {
		return existing, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AffiliateCommissionEvent{}, err
	}
	if err := db.Create(&event).Error; err != nil {
		return model.AffiliateCommissionEvent{}, err
	}
	return event, nil
}

func signedAffiliateLogQuota(log model.Log) int64 {
	quota := int64(log.Quota)
	if quota < 0 {
		quota = -quota
	}
	if log.Type == model.LogTypeRefund {
		return -quota
	}
	return quota
}

func affiliateLogQuotaToCents(log model.Log, input AffiliateCommissionBuildInput) int64 {
	quotaPerUnit := input.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = common.QuotaPerUnit
	}
	usdExchangeRate := input.USDExchangeRate
	if usdExchangeRate <= 0 {
		usdExchangeRate = 1
	}
	cents := float64(signedAffiliateLogQuota(log)) / quotaPerUnit * usdExchangeRate * 100
	return int64(math.Round(cents))
}

func affiliateCommissionKindForLog(log model.Log) string {
	if log.Type == model.LogTypeRefund {
		return AffiliateCommissionEventKindClawback
	}
	return AffiliateCommissionEventKindAccrual
}

func tierCumulativeCents(log model.Log, beforeCents int64, afterCents int64) int64 {
	if log.Type == model.LogTypeRefund {
		return beforeCents
	}
	return afterCents
}

func applyAffiliateKPICoefficient(baseRateBps int, capRateBps int, coefficientBps int) int {
	if coefficientBps < affiliateBpsBase {
		coefficientBps = affiliateBpsBase
	}
	finalRate := int(math.Round(float64(baseRateBps) * float64(coefficientBps) / float64(affiliateBpsBase)))
	if capRateBps > 0 && finalRate > capRateBps {
		return capRateBps
	}
	return finalRate
}

func calculateAffiliateCommissionCents(netPaidCents int64, finalRateBps int) int64 {
	return int64(math.Round(float64(netPaidCents) * float64(finalRateBps) / float64(affiliateBpsBase)))
}

func affiliateCommissionSyntheticMarker(ruleSetId int, sourceLogId int, affiliateUserId int) string {
	return fmt.Sprintf("rule:%d:log:%d:affiliate:%d", ruleSetId, sourceLogId, affiliateUserId)
}
