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

type affiliateLogQuotaAttribution struct {
	PaidRawQuota          int64
	GiftRawQuota          int64
	TrialRawQuota         int64
	LegacyUnknownRawQuota int64
}

type AffiliateCommissionBuildInput struct {
	RuleSetId       int
	PeriodStart     int64
	PeriodEnd       int64
	QuotaPerUnit    float64
	USDExchangeRate float64
	JobRunId        int
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

	sourceLogs, err := listAffiliateCommissionSourceLogs(db, logDB, input)
	if err != nil {
		return nil, err
	}
	if len(sourceLogs) == 0 {
		return []model.AffiliateCommissionEvent{}, nil
	}

	cumulative, err := loadAffiliatePriorPaidCentsByUser(db, logDB, sourceLogs, input)
	if err != nil {
		return nil, err
	}

	created := make([]model.AffiliateCommissionEvent, 0)
	for _, sourceLog := range sourceLogs {
		var savedForLog []model.AffiliateCommissionEvent
		err = db.Transaction(func(tx *gorm.DB) error {
			attribution, err := resolveAffiliateLogQuotaAttribution(tx, sourceLog)
			if err != nil {
				return err
			}
			if attribution.PaidRawQuota == 0 {
				return nil
			}

			netPaidCents := affiliateRawQuotaToCents(attribution.PaidRawQuota, input)
			if netPaidCents == 0 {
				return nil
			}
			rawQuota := attribution.PaidRawQuota
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
				if rule == nil {
					continue
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
				savedForLog = append(savedForLog, saved)
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
		if len(savedForLog) == 0 {
			continue
		}
		created = append(created, savedForLog...)
		if err := updateAffiliateJobRunCommissionProgress(db, input.JobRunId, len(created)); err != nil {
			return nil, err
		}
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

func resolveAffiliateLogQuotaAttribution(db *gorm.DB, log model.Log) (affiliateLogQuotaAttribution, error) {
	source := ResolveAffiliateLogQuotaSource(log)
	if source != "" {
		return affiliateLogQuotaAttributionForSource(source, signedAffiliateLogQuota(log)), nil
	}
	if db == nil {
		return affiliateLogQuotaAttribution{}, nil
	}
	return loadAffiliateQuotaSourceSidecarAttribution(db, log)
}

func affiliateLogQuotaAttributionForSource(source string, rawQuota int64) affiliateLogQuotaAttribution {
	switch source {
	case AffiliateQuotaSourcePaid:
		return affiliateLogQuotaAttribution{PaidRawQuota: rawQuota}
	case AffiliateQuotaSourceGift:
		return affiliateLogQuotaAttribution{GiftRawQuota: rawQuota}
	case AffiliateQuotaSourceTrial:
		return affiliateLogQuotaAttribution{TrialRawQuota: rawQuota}
	default:
		return affiliateLogQuotaAttribution{LegacyUnknownRawQuota: rawQuota}
	}
}

func loadAffiliateQuotaSourceSidecarAttribution(db *gorm.DB, log model.Log) (affiliateLogQuotaAttribution, error) {
	eventType := ""
	switch log.Type {
	case model.LogTypeConsume:
		eventType = model.QuotaSourceEventDebit
	case model.LogTypeRefund:
		eventType = model.QuotaSourceEventRefund
	default:
		return affiliateLogQuotaAttribution{}, nil
	}

	if log.Id > 0 {
		events, err := listAffiliateQuotaSourceSidecarEvents(db, log, eventType, "(source_log_id = ? OR (related_type = ? AND related_id = ?))", log.Id, "log", fmt.Sprint(log.Id))
		if err != nil {
			return affiliateLogQuotaAttribution{}, err
		}
		if len(events) > 0 {
			return affiliateQuotaSourceEventsToAttribution(events, eventType), nil
		}
	}
	requestId := strings.TrimSpace(log.RequestId)
	if requestId == "" {
		return affiliateLogQuotaAttribution{}, nil
	}
	events, err := listAffiliateQuotaSourceSidecarEvents(db, log, eventType, "request_id = ?", requestId)
	if err != nil {
		return affiliateLogQuotaAttribution{}, err
	}
	return affiliateQuotaSourceEventsToAttribution(events, eventType), nil
}

func listAffiliateQuotaSourceSidecarEvents(db *gorm.DB, log model.Log, eventType string, matchSql string, matchArgs ...interface{}) ([]model.UserQuotaSourceEvent, error) {
	var events []model.UserQuotaSourceEvent
	err := db.
		Where("user_id = ? AND source IN ? AND event_type = ?", log.UserId, []string{
			AffiliateQuotaSourcePaid,
			AffiliateQuotaSourceGift,
			AffiliateQuotaSourceTrial,
			model.QuotaSourceLegacyUnknown,
		}, eventType).
		Where(matchSql, matchArgs...).
		Order("id asc").
		Find(&events).Error
	return events, err
}

func affiliateQuotaSourceEventsToAttribution(events []model.UserQuotaSourceEvent, eventType string) affiliateLogQuotaAttribution {
	attribution := affiliateLogQuotaAttribution{}
	for _, event := range events {
		rawQuota := event.Amount
		if rawQuota < 0 {
			rawQuota = -rawQuota
		}
		if eventType == model.QuotaSourceEventRefund {
			rawQuota = -rawQuota
		}
		switch event.Source {
		case AffiliateQuotaSourcePaid:
			attribution.PaidRawQuota += rawQuota
		case AffiliateQuotaSourceGift:
			attribution.GiftRawQuota += rawQuota
		case AffiliateQuotaSourceTrial:
			attribution.TrialRawQuota += rawQuota
		default:
			attribution.LegacyUnknownRawQuota += rawQuota
		}
	}
	return attribution
}

func listAffiliateCommissionSourceLogs(db *gorm.DB, logDB *gorm.DB, input AffiliateCommissionBuildInput) ([]model.Log, error) {
	tx := logDB.
		Where("type IN ?", []int{model.LogTypeConsume, model.LogTypeRefund})
	if input.PeriodStart != 0 {
		tx = tx.Where("created_at >= ?", input.PeriodStart)
	}
	if input.PeriodEnd != 0 {
		tx = tx.Where("created_at <= ?", input.PeriodEnd)
	}

	var logs []model.Log
	if err := scanAffiliateLogsByCreatedAtCursor(tx, func(batch []model.Log) error {
		logs = append(logs, batch...)
		return updateAffiliateJobRunLogCursor(db, input.JobRunId, affiliateJobRunStageCommission, batch)
	}); err != nil {
		return nil, err
	}
	return logs, nil
}

func loadAffiliatePriorPaidCentsByUser(db *gorm.DB, logDB *gorm.DB, sourceLogs []model.Log, input AffiliateCommissionBuildInput) (map[int]int64, error) {
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

	priorTx := logDB.
		Where("user_id IN ? AND type IN ? AND created_at < ?", userIds, []int{model.LogTypeConsume, model.LogTypeRefund}, input.PeriodStart)
	if err := scanAffiliateLogsByCreatedAtCursor(priorTx, func(priorLogs []model.Log) error {
		for _, log := range priorLogs {
			attribution, err := resolveAffiliateLogQuotaAttribution(db, log)
			if err != nil {
				return err
			}
			if attribution.PaidRawQuota == 0 {
				continue
			}
			cumulative[log.UserId] += affiliateRawQuotaToCents(attribution.PaidRawQuota, input)
		}
		return nil
	}); err != nil {
		return nil, err
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
	if err != nil {
		return nil, err
	}

	legacyRelations, err := listLegacyActiveAffiliateRelationsForLog(db, log)
	if err != nil {
		return nil, err
	}
	return mergeAffiliateCommissionRelations(relations, legacyRelations), nil
}

func listLegacyActiveAffiliateRelationsForLog(db *gorm.DB, log model.Log) ([]model.AffiliateRelation, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if log.UserId <= 0 {
		return []model.AffiliateRelation{}, nil
	}

	var user model.User
	err := db.Select("id", "inviter_id").Where("id = ?", log.UserId).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return []model.AffiliateRelation{}, nil
	}
	if err != nil {
		return nil, err
	}
	if user.InviterId <= 0 {
		return []model.AffiliateRelation{}, nil
	}

	relations := make([]model.AffiliateRelation, 0, 2)
	directInviterId := user.InviterId
	ancestorUserId := directInviterId
	for depth := 1; depth <= 2 && ancestorUserId > 0; depth++ {
		profile, err := getActiveAffiliateProfileForCommission(db, ancestorUserId)
		if err != nil {
			return nil, err
		}
		if profile != nil && (profile.Level == 1 || profile.Level == 2) {
			relations = append(relations, model.AffiliateRelation{
				AncestorUserId:   ancestorUserId,
				DescendantUserId: log.UserId,
				Depth:            depth,
				DirectInviterId:  directInviterId,
				Status:           model.AffiliateProfileStatusActive,
				Source:           "legacy_inviter",
			})
		}

		var ancestor model.User
		err = db.Select("id", "inviter_id").Where("id = ?", ancestorUserId).First(&ancestor).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			break
		}
		if err != nil {
			return nil, err
		}
		ancestorUserId = ancestor.InviterId
	}
	return relations, nil
}

func mergeAffiliateCommissionRelations(primary []model.AffiliateRelation, fallback []model.AffiliateRelation) []model.AffiliateRelation {
	merged := make([]model.AffiliateRelation, 0, len(primary)+len(fallback))
	seen := make(map[int]bool, len(primary)+len(fallback))
	for _, relation := range append(primary, fallback...) {
		if relation.AncestorUserId <= 0 || relation.DescendantUserId <= 0 || seen[relation.AncestorUserId] {
			continue
		}
		seen[relation.AncestorUserId] = true
		merged = append(merged, relation)
	}
	return merged
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

func getAffiliateCommissionRuleAndTier(db *gorm.DB, ruleSetId int, affiliateLevel int, cumulativeCents int64) (*model.AffiliateCommissionRule, *model.AffiliateCommissionTier, error) {
	var rule model.AffiliateCommissionRule
	err := db.
		Where("rule_set_id = ? AND affiliate_level = ? AND status = ?", ruleSetId, affiliateLevel, model.AffiliateProfileStatusActive).
		First(&rule).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}

	var tiers []model.AffiliateCommissionTier
	if err := db.
		Where("rule_set_id = ? AND affiliate_level = ?", ruleSetId, affiliateLevel).
		Order("sort_order asc, min_net_paid_amount_cents asc, id asc").
		Find(&tiers).Error; err != nil {
		return nil, nil, err
	}
	for _, tier := range tiers {
		if cumulativeCents < tier.MinNetPaidAmountCents {
			continue
		}
		if tier.MaxNetPaidAmountCents > 0 && cumulativeCents > tier.MaxNetPaidAmountCents {
			continue
		}
		selected := tier
		return &rule, &selected, nil
	}
	return &rule, nil, nil
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
	return affiliateRawQuotaToCents(signedAffiliateLogQuota(log), input)
}

func affiliateRawQuotaToCents(rawQuota int64, input AffiliateCommissionBuildInput) int64 {
	quotaPerUnit := input.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = common.QuotaPerUnit
	}
	usdExchangeRate := input.USDExchangeRate
	if usdExchangeRate <= 0 {
		usdExchangeRate = 1
	}
	cents := float64(rawQuota) / quotaPerUnit * usdExchangeRate * 100
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
