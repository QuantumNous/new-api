package service

import (
	"errors"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type AffiliateSettlementBuildInput struct {
	RuleSetId   int
	PeriodStart int64
	PeriodEnd   int64
	FreezeDays  int
	AutoRun     bool
	ActorUserId int
	Reason      string
	GeneratedAt int64
	JobRunId    int
}

type AffiliateSettlementStatusInput struct {
	ActorUserId int
	Reason      string
	Now         int64
}

type AffiliateSettlementPaidInput struct {
	ActorUserId      int
	PaidAt           int64
	PaymentReference string
	Reason           string
}

type AffiliateSettlementEventTotals struct {
	SettlementId    int
	CommissionCents int64
	HeadFeeCents    int64
	GrossCents      int64
	DeductionCents  int64
	PayableCents    int64
}

type affiliateSettlementEventGroup struct {
	AffiliateUserId    int
	CommissionCents    int64
	HeadFeeCents       int64
	CommissionEventIds []int
	HeadFeeEventIds    []int
}

const affiliateDefaultSettlementEventScanBatchSize = 500

var affiliateSettlementEventScanBatchSize = affiliateDefaultSettlementEventScanBatchSize

func GenerateAffiliateSettlements(db *gorm.DB, input AffiliateSettlementBuildInput) ([]model.AffiliateSettlement, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if input.PeriodStart > 0 && input.PeriodEnd > 0 && input.PeriodEnd < input.PeriodStart {
		return nil, errors.New("invalid settlement period")
	}
	if input.GeneratedAt == 0 {
		input.GeneratedAt = common.GetTimestamp()
	}

	ruleSet, err := findAffiliateSettlementRuleSet(db, input)
	if err != nil {
		return nil, err
	}
	if input.AutoRun && !affiliateRuleSetAutoSettlementEnabled(ruleSet) {
		return nil, errors.New("automatic affiliate settlement is disabled")
	}
	groups, err := buildAffiliateSettlementEventGroups(db, ruleSet.Id, input)
	if err != nil {
		return nil, err
	}
	if len(groups) == 0 {
		return []model.AffiliateSettlement{}, nil
	}

	userIds := make([]int, 0, len(groups))
	for userId := range groups {
		userIds = append(userIds, userId)
	}
	sort.Ints(userIds)

	var settlements []model.AffiliateSettlement
	for _, userId := range userIds {
		group := groups[userId]
		var settlement model.AffiliateSettlement
		err = db.Transaction(func(tx *gorm.DB) error {
			var err error
			settlement, err = upsertAffiliateSettlementDraft(tx, ruleSet, input, group)
			if err != nil {
				return err
			}
			if err := linkAffiliateSettlementEvents(tx, settlement.Id, group); err != nil {
				return err
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
		settlements = append(settlements, settlement)
		if err := updateAffiliateJobRunSettlementProgress(db, input.JobRunId, settlements); err != nil {
			return nil, err
		}
	}
	return settlements, nil
}

func AuditAffiliateSettlementEventTotals(db *gorm.DB, settlementId int) (AffiliateSettlementEventTotals, error) {
	if db == nil {
		return AffiliateSettlementEventTotals{}, errors.New("nil db")
	}
	if settlementId <= 0 {
		return AffiliateSettlementEventTotals{}, errors.New("invalid settlement id")
	}

	var settlement model.AffiliateSettlement
	if err := db.Where("id = ?", settlementId).First(&settlement).Error; err != nil {
		return AffiliateSettlementEventTotals{}, err
	}

	var commissionCents int64
	if err := db.Model(&model.AffiliateCommissionEvent{}).
		Where("settlement_id = ?", settlement.Id).
		Select("COALESCE(SUM(commission_cents), 0)").
		Scan(&commissionCents).Error; err != nil {
		return AffiliateSettlementEventTotals{}, err
	}
	var headFeeCents int64
	if err := db.Model(&model.AffiliateHeadFeeEvent{}).
		Where("settlement_id = ?", settlement.Id).
		Select("COALESCE(SUM(amount_cents), 0)").
		Scan(&headFeeCents).Error; err != nil {
		return AffiliateSettlementEventTotals{}, err
	}

	deductionCents, payableCents := calculateAffiliateSettlementPayable(commissionCents, headFeeCents)
	return AffiliateSettlementEventTotals{
		SettlementId:    settlement.Id,
		CommissionCents: commissionCents,
		HeadFeeCents:    headFeeCents,
		GrossCents:      commissionCents + headFeeCents,
		DeductionCents:  deductionCents,
		PayableCents:    payableCents,
	}, nil
}

func FreezeAffiliateSettlement(db *gorm.DB, settlementId int, input AffiliateSettlementStatusInput) (*model.AffiliateSettlement, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if settlementId <= 0 {
		return nil, errors.New("invalid settlement id")
	}
	if input.Now == 0 {
		input.Now = common.GetTimestamp()
	}

	var settlement model.AffiliateSettlement
	err := db.Transaction(func(tx *gorm.DB) error {
		loaded, err := getAffiliateSettlementForUpdate(tx, settlementId)
		if err != nil {
			return err
		}
		if loaded.Status != model.AffiliateSettlementStatusDraft {
			return errors.New("only draft affiliate settlements can be frozen")
		}
		if err := tx.Model(&model.AffiliateSettlement{}).
			Where("id = ?", settlementId).
			Updates(map[string]interface{}{
				"status": model.AffiliateSettlementStatusFrozen,
			}).Error; err != nil {
			return err
		}
		settlement, err = getAffiliateSettlementForUpdate(tx, settlementId)
		return err
	})
	if err != nil {
		return nil, err
	}
	return &settlement, nil
}

func VoidAffiliateSettlement(db *gorm.DB, settlementId int, input AffiliateSettlementStatusInput) (*model.AffiliateSettlement, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if settlementId <= 0 {
		return nil, errors.New("invalid settlement id")
	}
	if input.Now == 0 {
		input.Now = common.GetTimestamp()
	}

	var settlement model.AffiliateSettlement
	err := db.Transaction(func(tx *gorm.DB) error {
		loaded, err := getAffiliateSettlementForUpdate(tx, settlementId)
		if err != nil {
			return err
		}
		if loaded.Status == model.AffiliateSettlementStatusPaid {
			return errors.New("paid affiliate settlements cannot be voided")
		}
		if loaded.Status == model.AffiliateSettlementStatusVoid {
			settlement = loaded
			return nil
		}
		if err := tx.Model(&model.AffiliateSettlement{}).
			Where("id = ?", settlementId).
			Updates(map[string]interface{}{
				"status": model.AffiliateSettlementStatusVoid,
			}).Error; err != nil {
			return err
		}
		if err := updateAffiliateSettlementEventStatus(tx, settlementId, model.AffiliateEventStatusVoid); err != nil {
			return err
		}
		settlement, err = getAffiliateSettlementForUpdate(tx, settlementId)
		return err
	})
	if err != nil {
		return nil, err
	}
	return &settlement, nil
}

func MarkAffiliateSettlementPaid(db *gorm.DB, settlementId int, input AffiliateSettlementPaidInput) (*model.AffiliateSettlement, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if settlementId <= 0 {
		return nil, errors.New("invalid settlement id")
	}
	if input.PaidAt == 0 {
		input.PaidAt = common.GetTimestamp()
	}

	var settlement model.AffiliateSettlement
	err := db.Transaction(func(tx *gorm.DB) error {
		loaded, err := getAffiliateSettlementForUpdate(tx, settlementId)
		if err != nil {
			return err
		}
		if loaded.Status != model.AffiliateSettlementStatusFrozen {
			return errors.New("only frozen affiliate settlements can be marked paid")
		}
		if err := tx.Model(&model.AffiliateSettlement{}).
			Where("id = ?", settlementId).
			Updates(map[string]interface{}{
				"status":            model.AffiliateSettlementStatusPaid,
				"paid_at":           input.PaidAt,
				"paid_by_user_id":   input.ActorUserId,
				"payment_reference": input.PaymentReference,
			}).Error; err != nil {
			return err
		}
		if err := updateAffiliateSettlementEventStatus(tx, settlementId, model.AffiliateEventStatusSettled); err != nil {
			return err
		}
		settlement, err = getAffiliateSettlementForUpdate(tx, settlementId)
		return err
	})
	if err != nil {
		return nil, err
	}
	return &settlement, nil
}

func findAffiliateSettlementRuleSet(db *gorm.DB, input AffiliateSettlementBuildInput) (model.AffiliateRuleSet, error) {
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
		return model.AffiliateRuleSet{}, errors.New("no published affiliate rule set for settlement")
	}
	return ruleSet, err
}

func affiliateRuleSetAutoSettlementEnabled(ruleSet model.AffiliateRuleSet) bool {
	return extractAffiliateSettlementRuleConfig(ruleSet.ConfigSnapshot).AutoSettlementEnabled
}

func buildAffiliateSettlementEventGroups(db *gorm.DB, ruleSetId int, input AffiliateSettlementBuildInput) (map[int]affiliateSettlementEventGroup, error) {
	groups := map[int]affiliateSettlementEventGroup{}

	commissionEventTx := db.Where("rule_set_id = ? AND settlement_id = ? AND status = ?", ruleSetId, 0, model.AffiliateEventStatusPending)
	if input.PeriodStart != 0 {
		commissionEventTx = commissionEventTx.Where("period_start = ?", input.PeriodStart)
	}
	if input.PeriodEnd != 0 {
		commissionEventTx = commissionEventTx.Where("period_end = ?", input.PeriodEnd)
	}
	if err := scanAffiliateSettlementCommissionEventsByID(commissionEventTx, func(events []model.AffiliateCommissionEvent) error {
		for _, event := range events {
			group := groups[event.AffiliateUserId]
			group.AffiliateUserId = event.AffiliateUserId
			group.CommissionCents += event.CommissionCents
			group.CommissionEventIds = append(group.CommissionEventIds, event.Id)
			groups[event.AffiliateUserId] = group
		}
		return updateAffiliateJobRunIDCursor(db, input.JobRunId, affiliateJobRunStageSettlementCommissionEvents, events[len(events)-1].Id)
	}); err != nil {
		return nil, err
	}

	headFeeEventTx := db.Where("rule_set_id = ? AND settlement_id = ? AND status = ?", ruleSetId, 0, model.AffiliateEventStatusPending)
	if err := scanAffiliateSettlementHeadFeeEventsByID(headFeeEventTx, func(events []model.AffiliateHeadFeeEvent) error {
		for _, event := range events {
			if !affiliateHeadFeeEventMatchesSettlementPeriod(event, input) {
				continue
			}
			group := groups[event.AffiliateUserId]
			group.AffiliateUserId = event.AffiliateUserId
			group.HeadFeeCents += event.AmountCents
			group.HeadFeeEventIds = append(group.HeadFeeEventIds, event.Id)
			groups[event.AffiliateUserId] = group
		}
		return updateAffiliateJobRunIDCursor(db, input.JobRunId, affiliateJobRunStageSettlementHeadFeeEvents, events[len(events)-1].Id)
	}); err != nil {
		return nil, err
	}

	if err := mergeExistingAffiliateSettlementDraftEvents(db, ruleSetId, input, groups); err != nil {
		return nil, err
	}
	return groups, nil
}

func mergeExistingAffiliateSettlementDraftEvents(db *gorm.DB, ruleSetId int, input AffiliateSettlementBuildInput, groups map[int]affiliateSettlementEventGroup) error {
	var settlements []model.AffiliateSettlement
	if err := db.
		Where("rule_set_id = ? AND period_start = ? AND period_end = ? AND status = ?", ruleSetId, input.PeriodStart, input.PeriodEnd, model.AffiliateSettlementStatusDraft).
		Order("affiliate_user_id asc, id asc").
		Find(&settlements).Error; err != nil {
		return err
	}
	for _, settlement := range settlements {
		group := groups[settlement.AffiliateUserId]
		hasPendingEvents := group.AffiliateUserId != 0
		group.AffiliateUserId = settlement.AffiliateUserId
		if err := mergeExistingAffiliateSettlementCommissionEvents(db, settlement.Id, &group); err != nil {
			return err
		}
		if err := mergeExistingAffiliateSettlementHeadFeeEvents(db, settlement.Id, &group); err != nil {
			return err
		}
		if !hasPendingEvents && len(group.CommissionEventIds) == 0 && len(group.HeadFeeEventIds) == 0 {
			continue
		}
		groups[settlement.AffiliateUserId] = group
	}
	return nil
}

func mergeExistingAffiliateSettlementCommissionEvents(db *gorm.DB, settlementId int, group *affiliateSettlementEventGroup) error {
	return scanAffiliateSettlementCommissionEventsByID(
		db.Where("settlement_id = ? AND status = ?", settlementId, model.AffiliateEventStatusReady),
		func(events []model.AffiliateCommissionEvent) error {
			for _, event := range events {
				group.CommissionCents += event.CommissionCents
				group.CommissionEventIds = append(group.CommissionEventIds, event.Id)
			}
			return nil
		},
	)
}

func mergeExistingAffiliateSettlementHeadFeeEvents(db *gorm.DB, settlementId int, group *affiliateSettlementEventGroup) error {
	return scanAffiliateSettlementHeadFeeEventsByID(
		db.Where("settlement_id = ? AND status = ?", settlementId, model.AffiliateEventStatusReady),
		func(events []model.AffiliateHeadFeeEvent) error {
			for _, event := range events {
				group.HeadFeeCents += event.AmountCents
				group.HeadFeeEventIds = append(group.HeadFeeEventIds, event.Id)
			}
			return nil
		},
	)
}

func upsertAffiliateSettlementDraft(db *gorm.DB, ruleSet model.AffiliateRuleSet, input AffiliateSettlementBuildInput, group affiliateSettlementEventGroup) (model.AffiliateSettlement, error) {
	commissionCents := group.CommissionCents
	headFeeCents := group.HeadFeeCents
	deductionCents, payableCents := calculateAffiliateSettlementPayable(commissionCents, headFeeCents)
	frozenUntil := int64(0)
	if input.FreezeDays > 0 {
		freezeBase := input.PeriodEnd
		if freezeBase == 0 {
			freezeBase = input.GeneratedAt
		}
		frozenUntil = freezeBase + int64(input.FreezeDays)*affiliateSecondsPerDay
	}
	snapshot := affiliateSettlementSnapshot(ruleSet, input, group)

	var settlement model.AffiliateSettlement
	err := db.
		Where("affiliate_user_id = ? AND rule_set_id = ? AND period_start = ? AND period_end = ?", group.AffiliateUserId, ruleSet.Id, input.PeriodStart, input.PeriodEnd).
		First(&settlement).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		settlement = model.AffiliateSettlement{
			AffiliateUserId: group.AffiliateUserId,
			RuleSetId:       ruleSet.Id,
			PeriodStart:     input.PeriodStart,
			PeriodEnd:       input.PeriodEnd,
			Status:          model.AffiliateSettlementStatusDraft,
			CommissionCents: commissionCents,
			HeadFeeCents:    headFeeCents,
			DeductionCents:  deductionCents,
			PayableCents:    payableCents,
			FrozenUntil:     frozenUntil,
			Snapshot:        snapshot,
		}
		if err := db.Create(&settlement).Error; err != nil {
			return model.AffiliateSettlement{}, err
		}
		return settlement, nil
	}
	if err != nil {
		return model.AffiliateSettlement{}, err
	}
	if settlement.Status != model.AffiliateSettlementStatusDraft {
		return model.AffiliateSettlement{}, errors.New("existing affiliate settlement is not draft")
	}
	if err := db.Model(&model.AffiliateSettlement{}).
		Where("id = ?", settlement.Id).
		Updates(map[string]interface{}{
			"commission_cents": commissionCents,
			"head_fee_cents":   headFeeCents,
			"deduction_cents":  deductionCents,
			"payable_cents":    payableCents,
			"frozen_until":     frozenUntil,
			"snapshot":         snapshot,
		}).Error; err != nil {
		return model.AffiliateSettlement{}, err
	}
	if err := db.First(&settlement, settlement.Id).Error; err != nil {
		return model.AffiliateSettlement{}, err
	}
	return settlement, nil
}

func linkAffiliateSettlementEvents(db *gorm.DB, settlementId int, group affiliateSettlementEventGroup) error {
	if len(group.CommissionEventIds) > 0 {
		if err := linkAffiliateCommissionEventsInBatches(db, settlementId, group.CommissionEventIds); err != nil {
			return err
		}
	}
	if len(group.HeadFeeEventIds) > 0 {
		if err := linkAffiliateHeadFeeEventsInBatches(db, settlementId, group.HeadFeeEventIds); err != nil {
			return err
		}
	}
	return nil
}

func linkAffiliateCommissionEventsInBatches(db *gorm.DB, settlementId int, eventIDs []int) error {
	return forEachAffiliateSettlementEventIDBatch(eventIDs, func(batch []int) error {
		return db.Model(&model.AffiliateCommissionEvent{}).
			Where("id IN ?", batch).
			Updates(map[string]interface{}{
				"settlement_id": settlementId,
				"status":        model.AffiliateEventStatusReady,
			}).Error
	})
}

func linkAffiliateHeadFeeEventsInBatches(db *gorm.DB, settlementId int, eventIDs []int) error {
	return forEachAffiliateSettlementEventIDBatch(eventIDs, func(batch []int) error {
		return db.Model(&model.AffiliateHeadFeeEvent{}).
			Where("id IN ?", batch).
			Updates(map[string]interface{}{
				"settlement_id": settlementId,
				"status":        model.AffiliateEventStatusReady,
			}).Error
	})
}

func forEachAffiliateSettlementEventIDBatch(eventIDs []int, handle func([]int) error) error {
	batchSize := normalizedAffiliateSettlementEventScanBatchSize()
	for start := 0; start < len(eventIDs); start += batchSize {
		end := start + batchSize
		if end > len(eventIDs) {
			end = len(eventIDs)
		}
		if err := handle(eventIDs[start:end]); err != nil {
			return err
		}
	}
	return nil
}

func updateAffiliateSettlementEventStatus(db *gorm.DB, settlementId int, status string) error {
	if err := db.Model(&model.AffiliateCommissionEvent{}).
		Where("settlement_id = ?", settlementId).
		Update("status", status).Error; err != nil {
		return err
	}
	return db.Model(&model.AffiliateHeadFeeEvent{}).
		Where("settlement_id = ?", settlementId).
		Update("status", status).Error
}

func getAffiliateSettlementForUpdate(db *gorm.DB, settlementId int) (model.AffiliateSettlement, error) {
	var settlement model.AffiliateSettlement
	err := db.Where("id = ?", settlementId).First(&settlement).Error
	return settlement, err
}

func calculateAffiliateSettlementPayable(commissionCents int64, headFeeCents int64) (int64, int64) {
	gross := commissionCents + headFeeCents
	if gross < 0 {
		return -gross, 0
	}
	return 0, gross
}

func affiliateSettlementSnapshot(ruleSet model.AffiliateRuleSet, input AffiliateSettlementBuildInput, group affiliateSettlementEventGroup) string {
	return common.GetJsonString(map[string]interface{}{
		"rule_set_version":       ruleSet.Version,
		"generated_at":           input.GeneratedAt,
		"generated_by_user_id":   input.ActorUserId,
		"reason":                 input.Reason,
		"commission_event_count": len(group.CommissionEventIds),
		"head_fee_event_count":   len(group.HeadFeeEventIds),
		"commission_event_ids":   group.CommissionEventIds,
		"head_fee_event_ids":     group.HeadFeeEventIds,
	})
}

func affiliateHeadFeeEventMatchesSettlementPeriod(event model.AffiliateHeadFeeEvent, input AffiliateSettlementBuildInput) bool {
	if input.PeriodStart == 0 && input.PeriodEnd == 0 {
		return true
	}
	periodStart, periodEnd, ok := parseAffiliateHeadFeeEventPeriod(event.SyntheticMarker)
	if !ok {
		return false
	}
	if input.PeriodStart != 0 && periodStart != input.PeriodStart {
		return false
	}
	return input.PeriodEnd == 0 || periodEnd == input.PeriodEnd
}

func parseAffiliateHeadFeeEventPeriod(marker string) (int64, int64, bool) {
	periodIndex := strings.LastIndex(marker, ":period:")
	if periodIndex < 0 {
		return 0, 0, false
	}
	period := marker[periodIndex+len(":period:"):]
	parts := strings.SplitN(period, "-", 2)
	if len(parts) != 2 {
		return 0, 0, false
	}
	periodStart, startErr := strconv.ParseInt(parts[0], 10, 64)
	periodEnd, endErr := strconv.ParseInt(parts[1], 10, 64)
	if startErr != nil || endErr != nil {
		return 0, 0, false
	}
	return periodStart, periodEnd, true
}

func normalizedAffiliateSettlementEventScanBatchSize() int {
	if affiliateSettlementEventScanBatchSize <= 0 {
		return affiliateDefaultSettlementEventScanBatchSize
	}
	return affiliateSettlementEventScanBatchSize
}

func scanAffiliateSettlementCommissionEventsByID(base *gorm.DB, handle func([]model.AffiliateCommissionEvent) error) error {
	batchSize := normalizedAffiliateSettlementEventScanBatchSize()
	lastID := 0
	for {
		var events []model.AffiliateCommissionEvent
		if err := base.
			Session(&gorm.Session{}).
			Where("id > ?", lastID).
			Order("id asc").
			Limit(batchSize).
			Find(&events).Error; err != nil {
			return err
		}
		if len(events) == 0 {
			return nil
		}
		if err := handle(events); err != nil {
			return err
		}
		lastID = events[len(events)-1].Id
		if len(events) < batchSize {
			return nil
		}
	}
}

func scanAffiliateSettlementHeadFeeEventsByID(base *gorm.DB, handle func([]model.AffiliateHeadFeeEvent) error) error {
	batchSize := normalizedAffiliateSettlementEventScanBatchSize()
	lastID := 0
	for {
		var events []model.AffiliateHeadFeeEvent
		if err := base.
			Session(&gorm.Session{}).
			Where("id > ?", lastID).
			Order("id asc").
			Limit(batchSize).
			Find(&events).Error; err != nil {
			return err
		}
		if len(events) == 0 {
			return nil
		}
		if err := handle(events); err != nil {
			return err
		}
		lastID = events[len(events)-1].Id
		if len(events) < batchSize {
			return nil
		}
	}
}
