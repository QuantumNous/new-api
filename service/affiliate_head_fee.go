package service

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const affiliateSecondsPerDay int64 = 24 * 60 * 60

type AffiliateHeadFeeBuildInput struct {
	RuleSetId       int
	PeriodStart     int64
	PeriodEnd       int64
	Now             int64
	QuotaPerUnit    float64
	USDExchangeRate float64
	JobRunId        int
}

type affiliateHeadFeePaidStats struct {
	FirstRechargeCents int64
	NetPaidCents       int64
}

func BuildAffiliatePendingHeadFeeEvents(db *gorm.DB, logDB *gorm.DB, input AffiliateHeadFeeBuildInput) ([]model.AffiliateHeadFeeEvent, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if logDB == nil {
		return nil, errors.New("nil log db")
	}
	if input.PeriodStart > 0 && input.PeriodEnd > 0 && input.PeriodEnd < input.PeriodStart {
		return nil, errors.New("invalid head fee period")
	}
	if input.Now == 0 {
		input.Now = common.GetTimestamp()
	}

	ruleSet, err := findAffiliateHeadFeeRuleSet(db, input)
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

	created := make([]model.AffiliateHeadFeeEvent, 0)
	for _, profile := range profiles {
		scope := ResolveAffiliateAccessScope(AffiliateScopeInput{
			UserId:        profile.UserId,
			ProfileStatus: profile.Status,
			ProfileLevel:  profile.Level,
		})
		if scope.Kind != AffiliateScopeAffiliate {
			continue
		}

		kpiSnapshot, err := getAffiliateHeadFeeKPISnapshot(db, profile.UserId, ruleSet.Id, input)
		if err != nil {
			return nil, err
		}
		if kpiSnapshot == nil || kpiSnapshot.TierCode == "" {
			continue
		}

		rule, err := getAffiliateHeadFeeRule(db, ruleSet.Id, profile.Level, kpiSnapshot.TierCode)
		if err != nil {
			return nil, err
		}
		if rule == nil || rule.AmountCents <= 0 {
			continue
		}

		relations, err := listAffiliateHeadFeeRelations(db, scope)
		if err != nil {
			return nil, err
		}
		for _, relation := range relations {
			var savedForRelation *model.AffiliateHeadFeeEvent
			err = db.Transaction(func(tx *gorm.DB) error {
				inviteEvent, err := getAffiliateHeadFeeInviteEvent(tx, relation.DescendantUserId)
				if err != nil {
					return err
				}
				if inviteEvent == nil {
					return nil
				}
				if !affiliateHeadFeeDelaySatisfied(*inviteEvent, *rule, input.Now) {
					return nil
				}

				stats, err := buildAffiliateHeadFeePaidStats(tx, logDB, relation.DescendantUserId, inviteEvent.CreatedAt, input)
				if err != nil {
					return err
				}
				if stats.FirstRechargeCents < rule.FirstRechargeMinCents || stats.NetPaidCents < rule.PeriodNetPaidMinCents {
					return nil
				}

				event := model.AffiliateHeadFeeEvent{
					AffiliateUserId:    profile.UserId,
					DownstreamUserId:   relation.DescendantUserId,
					InviteEventId:      inviteEvent.Id,
					RuleSetId:          ruleSet.Id,
					KPISnapshotId:      kpiSnapshot.Id,
					Status:             model.AffiliateEventStatusPending,
					AmountCents:        rule.AmountCents,
					FirstRechargeCents: stats.FirstRechargeCents,
					NetPaidCents:       stats.NetPaidCents,
					QualificationDays:  rule.QualificationDays,
					SyntheticMarker:    affiliateHeadFeeSyntheticMarker(ruleSet.Id, profile.UserId, relation.DescendantUserId, input),
					Metadata: common.GetJsonString(map[string]interface{}{
						"rule_set_version": ruleSet.Version,
						"kpi_tier_code":    kpiSnapshot.TierCode,
						"quota_source":     AffiliateQuotaSourcePaid,
						"unlock_after":     inviteEvent.CreatedAt + int64(rule.QualificationDays+rule.UnlockDelayDays)*affiliateSecondsPerDay,
					}),
				}
				saved, err := createAffiliateHeadFeeEventIfMissing(tx, event)
				if err != nil {
					return err
				}
				savedForRelation = &saved
				return nil
			})
			if err != nil {
				return nil, err
			}
			if savedForRelation == nil {
				continue
			}
			created = append(created, *savedForRelation)
			if err := updateAffiliateJobRunHeadFeeProgress(db, input.JobRunId, len(created)); err != nil {
				return nil, err
			}
		}
	}
	return created, nil
}

func findAffiliateHeadFeeRuleSet(db *gorm.DB, input AffiliateHeadFeeBuildInput) (model.AffiliateRuleSet, error) {
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
		return model.AffiliateRuleSet{}, errors.New("no published affiliate rule set for head fee")
	}
	return ruleSet, err
}

func getAffiliateHeadFeeKPISnapshot(db *gorm.DB, affiliateUserId int, ruleSetId int, input AffiliateHeadFeeBuildInput) (*model.AffiliateKPISnapshot, error) {
	var snapshot model.AffiliateKPISnapshot
	err := db.
		Where("affiliate_user_id = ? AND rule_set_id = ? AND period_start = ? AND period_end = ?", affiliateUserId, ruleSetId, input.PeriodStart, input.PeriodEnd).
		First(&snapshot).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &snapshot, nil
}

func getAffiliateHeadFeeRule(db *gorm.DB, ruleSetId int, affiliateLevel int, kpiTierCode string) (*model.AffiliateHeadFeeRule, error) {
	var rule model.AffiliateHeadFeeRule
	err := db.
		Where("rule_set_id = ? AND affiliate_level = ? AND kpi_tier_code = ? AND status = ?", ruleSetId, affiliateLevel, kpiTierCode, model.AffiliateProfileStatusActive).
		First(&rule).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func listAffiliateHeadFeeRelations(db *gorm.DB, scope AffiliateScope) ([]model.AffiliateRelation, error) {
	var relations []model.AffiliateRelation
	err := db.
		Where(
			"ancestor_user_id = ? AND status = ? AND depth >= ? AND depth <= ?",
			scope.UserId,
			model.AffiliateProfileStatusActive,
			1,
			scope.MaxDepth,
		).
		Order("depth asc, descendant_user_id asc").
		Find(&relations).Error
	return relations, err
}

func getAffiliateHeadFeeInviteEvent(db *gorm.DB, inviteeUserId int) (*model.AffiliateInviteEvent, error) {
	var inviteEvent model.AffiliateInviteEvent
	err := db.
		Where("invitee_user_id = ? AND invite_source = ?", inviteeUserId, AffiliateInviteSourceAffiliate).
		Order("created_at asc, id asc").
		First(&inviteEvent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &inviteEvent, nil
}

func affiliateHeadFeeDelaySatisfied(inviteEvent model.AffiliateInviteEvent, rule model.AffiliateHeadFeeRule, now int64) bool {
	unlockAt := inviteEvent.CreatedAt + int64(rule.QualificationDays+rule.UnlockDelayDays)*affiliateSecondsPerDay
	return now >= unlockAt
}

func buildAffiliateHeadFeePaidStats(db *gorm.DB, logDB *gorm.DB, userId int, inviteCreatedAt int64, input AffiliateHeadFeeBuildInput) (affiliateHeadFeePaidStats, error) {
	tx := logDB.
		Where("user_id = ? AND type IN ?", userId, []int{model.LogTypeConsume, model.LogTypeRefund})
	if inviteCreatedAt != 0 {
		tx = tx.Where("created_at >= ?", inviteCreatedAt)
	}
	if input.PeriodEnd != 0 {
		tx = tx.Where("created_at <= ?", input.PeriodEnd)
	}

	stats := affiliateHeadFeePaidStats{}
	if err := scanAffiliateLogsByCreatedAtCursor(tx, func(logs []model.Log) error {
		for _, log := range logs {
			attribution, err := resolveAffiliateLogQuotaAttribution(db, log)
			if err != nil {
				return err
			}
			if attribution.PaidRawQuota == 0 {
				continue
			}
			cents := affiliateRawQuotaToCents(attribution.PaidRawQuota, AffiliateCommissionBuildInput{
				RuleSetId:       input.RuleSetId,
				PeriodStart:     input.PeriodStart,
				PeriodEnd:       input.PeriodEnd,
				QuotaPerUnit:    input.QuotaPerUnit,
				USDExchangeRate: input.USDExchangeRate,
			})
			if log.Type == model.LogTypeConsume && cents > 0 && stats.FirstRechargeCents == 0 {
				stats.FirstRechargeCents = cents
			}
			if input.PeriodStart != 0 && log.CreatedAt < input.PeriodStart {
				continue
			}
			stats.NetPaidCents += cents
		}
		return updateAffiliateJobRunLogCursor(db, input.JobRunId, affiliateJobRunStageHeadFee, logs)
	}); err != nil {
		return affiliateHeadFeePaidStats{}, err
	}
	return stats, nil
}

func createAffiliateHeadFeeEventIfMissing(db *gorm.DB, event model.AffiliateHeadFeeEvent) (model.AffiliateHeadFeeEvent, error) {
	var existing model.AffiliateHeadFeeEvent
	err := db.Where("synthetic_marker = ?", event.SyntheticMarker).First(&existing).Error
	if err == nil {
		return existing, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AffiliateHeadFeeEvent{}, err
	}
	if err := db.Create(&event).Error; err != nil {
		return model.AffiliateHeadFeeEvent{}, err
	}
	return event, nil
}

func affiliateHeadFeeSyntheticMarker(ruleSetId int, affiliateUserId int, downstreamUserId int, input AffiliateHeadFeeBuildInput) string {
	return fmt.Sprintf("rule:%d:affiliate:%d:downstream:%d:period:%d-%d", ruleSetId, affiliateUserId, downstreamUserId, input.PeriodStart, input.PeriodEnd)
}
