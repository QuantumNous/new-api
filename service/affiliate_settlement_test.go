package service

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func TestGenerateAffiliateSettlementsCreatesDraftAndLinksEvents(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "settlement-draft-links-events")
	seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, 1000, 1000, 2000)
	seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, -200, 1000, 2000)
	seedAffiliateSettlementHeadFeeEvent(t, db, ruleSet.Id, 100, 500, 1000, 2000)

	settlements, err := GenerateAffiliateSettlements(db, AffiliateSettlementBuildInput{
		RuleSetId:   ruleSet.Id,
		PeriodStart: 1000,
		PeriodEnd:   2000,
		FreezeDays:  7,
	})
	if err != nil {
		t.Fatalf("GenerateAffiliateSettlements returned error: %v", err)
	}
	if len(settlements) != 1 {
		t.Fatalf("expected one settlement, got %+v", settlements)
	}

	settlement := settlements[0]
	if settlement.AffiliateUserId != 100 || settlement.RuleSetId != ruleSet.Id || settlement.PeriodStart != 1000 || settlement.PeriodEnd != 2000 {
		t.Fatalf("unexpected settlement identity: %+v", settlement)
	}
	if settlement.Status != model.AffiliateSettlementStatusDraft || settlement.FrozenUntil != 2000+7*affiliateSecondsPerDay {
		t.Fatalf("unexpected settlement status/freeze window: %+v", settlement)
	}
	if settlement.CommissionCents != 800 || settlement.HeadFeeCents != 500 || settlement.DeductionCents != 0 || settlement.PayableCents != 1300 {
		t.Fatalf("unexpected settlement amounts: %+v", settlement)
	}
	if !strings.Contains(settlement.Snapshot, `"rule_set_version":"settlement-draft-links-events"`) {
		t.Fatalf("expected settlement snapshot to record rule set version, got %q", settlement.Snapshot)
	}
	if !strings.Contains(settlement.Snapshot, `"commission_event_count":2`) || !strings.Contains(settlement.Snapshot, `"head_fee_event_count":1`) {
		t.Fatalf("expected settlement snapshot to record event counts, got %q", settlement.Snapshot)
	}

	var commissionEvents []model.AffiliateCommissionEvent
	if err := db.Where("affiliate_user_id = ?", 100).Order("id asc").Find(&commissionEvents).Error; err != nil {
		t.Fatalf("load commission events: %v", err)
	}
	for _, event := range commissionEvents {
		if event.SettlementId != settlement.Id || event.Status != model.AffiliateEventStatusReady {
			t.Fatalf("expected commission event to be linked and ready, got %+v", event)
		}
	}
	var headFeeEvents []model.AffiliateHeadFeeEvent
	if err := db.Where("affiliate_user_id = ?", 100).Find(&headFeeEvents).Error; err != nil {
		t.Fatalf("load head fee events: %v", err)
	}
	for _, event := range headFeeEvents {
		if event.SettlementId != settlement.Id || event.Status != model.AffiliateEventStatusReady {
			t.Fatalf("expected head fee event to be linked and ready, got %+v", event)
		}
	}
}

func TestGenerateAffiliateSettlementsWithJobRunRecordsSuccess(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "settlement-generate-job-success")
	seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, 1000, 1000, 2000)
	seedAffiliateSettlementHeadFeeEvent(t, db, ruleSet.Id, 100, 500, 1000, 2000)

	settlements, jobRun, err := GenerateAffiliateSettlementsWithJobRun(db, AffiliateSettlementBuildInput{
		RuleSetId:   ruleSet.Id,
		PeriodStart: 1000,
		PeriodEnd:   2000,
		FreezeDays:  7,
		ActorUserId: 9,
		Reason:      "monthly close secret=hidden",
		GeneratedAt: 3000,
	})
	if err != nil {
		t.Fatalf("GenerateAffiliateSettlementsWithJobRun returned error: %v", err)
	}
	if len(settlements) != 1 {
		t.Fatalf("expected one settlement, got %+v", settlements)
	}
	if jobRun.Id <= 0 || jobRun.Status != model.AffiliateJobRunStatusSucceeded {
		t.Fatalf("expected succeeded job run, got %+v", jobRun)
	}

	var saved model.AffiliateJobRun
	if err := db.First(&saved, jobRun.Id).Error; err != nil {
		t.Fatalf("load job run: %v", err)
	}
	if saved.JobType != model.AffiliateJobRunTypeSettlementGenerate || saved.CurrentStage != affiliateJobRunStageComplete {
		t.Fatalf("unexpected job run type/stage: %+v", saved)
	}
	if saved.RuleSetId != ruleSet.Id || saved.PeriodStart != 1000 || saved.PeriodEnd != 2000 || saved.ActorUserId != 9 {
		t.Fatalf("unexpected job run identity: %+v", saved)
	}
	if saved.StartedAt != 3000 || saved.FinishedAt != 3000 || saved.SettlementCount != 1 {
		t.Fatalf("unexpected job run timing/count: %+v", saved)
	}
	if saved.IdempotencyKey == "" || !strings.HasPrefix(saved.IdempotencyKey, model.AffiliateJobRunTypeSettlementGenerate+":") {
		t.Fatalf("unexpected idempotency key: %+v", saved)
	}
	if !strings.Contains(saved.InputSnapshot, `"has_reason":true`) || strings.Contains(saved.InputSnapshot, "secret=hidden") {
		t.Fatalf("expected input snapshot to redact reason content, got %q", saved.InputSnapshot)
	}
	if !strings.Contains(saved.ResultSnapshot, `"settlement_count":1`) || !strings.Contains(saved.ResultSnapshot, `"settlement_ids"`) {
		t.Fatalf("expected result snapshot to record settlement ids, got %q", saved.ResultSnapshot)
	}
}

func TestGenerateAffiliateSettlementsWithJobRunRecordsFailure(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)

	settlements, jobRun, err := GenerateAffiliateSettlementsWithJobRun(db, AffiliateSettlementBuildInput{
		PeriodStart: 1000,
		PeriodEnd:   2000,
		ActorUserId: 9,
		Reason:      "token=secret-value",
		GeneratedAt: 3000,
	})
	if err == nil {
		t.Fatalf("expected GenerateAffiliateSettlementsWithJobRun to fail without a published rule set, settlements=%+v jobRun=%+v", settlements, jobRun)
	}
	if jobRun.Id <= 0 || jobRun.Status != model.AffiliateJobRunStatusFailed {
		t.Fatalf("expected failed job run result, got %+v", jobRun)
	}

	var saved model.AffiliateJobRun
	if err := db.First(&saved, jobRun.Id).Error; err != nil {
		t.Fatalf("load failed job run: %v", err)
	}
	if saved.JobType != model.AffiliateJobRunTypeSettlementGenerate || saved.CurrentStage != affiliateJobRunStageSettlement {
		t.Fatalf("unexpected failed job run type/stage: %+v", saved)
	}
	if saved.ErrorMessage == "" || !strings.Contains(saved.ErrorMessage, "no published affiliate rule set") {
		t.Fatalf("expected sanitized failure error, got %+v", saved)
	}
	if strings.Contains(saved.InputSnapshot, "token=secret-value") || strings.Contains(saved.ErrorMessage, "secret-value") {
		t.Fatalf("job run should not leak raw reason or secrets: %+v", saved)
	}
}

func TestGenerateAffiliateSettlementsMergesNewPendingEventsIntoExistingDraft(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "settlement-merge-existing-draft")
	seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, 1000, 1000, 2000)

	first, err := GenerateAffiliateSettlements(db, AffiliateSettlementBuildInput{
		RuleSetId:   ruleSet.Id,
		PeriodStart: 1000,
		PeriodEnd:   2000,
	})
	if err != nil || len(first) != 1 {
		t.Fatalf("first GenerateAffiliateSettlements err=%v settlements=%+v", err, first)
	}

	seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, 500, 1000, 2000)
	second, err := GenerateAffiliateSettlements(db, AffiliateSettlementBuildInput{
		RuleSetId:   ruleSet.Id,
		PeriodStart: 1000,
		PeriodEnd:   2000,
	})
	if err != nil || len(second) != 1 {
		t.Fatalf("second GenerateAffiliateSettlements err=%v settlements=%+v", err, second)
	}
	if second[0].Id != first[0].Id {
		t.Fatalf("expected existing draft settlement to be updated, first=%+v second=%+v", first[0], second[0])
	}
	if second[0].CommissionCents != 1500 || second[0].PayableCents != 1500 {
		t.Fatalf("expected existing ready event and new pending event to both be included, got %+v", second[0])
	}

	var readyCount int64
	if err := db.Model(&model.AffiliateCommissionEvent{}).
		Where("settlement_id = ? AND status = ?", second[0].Id, model.AffiliateEventStatusReady).
		Count(&readyCount).Error; err != nil {
		t.Fatalf("count ready commission events: %v", err)
	}
	if readyCount != 2 {
		t.Fatalf("expected both commission events to be linked and ready, got %d", readyCount)
	}
}

func TestGenerateAffiliateSettlementsReturnsExistingDraftWhenNoNewPendingEvents(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "settlement-existing-draft-idempotent")
	seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, 1000, 1000, 2000)

	first, err := GenerateAffiliateSettlements(db, AffiliateSettlementBuildInput{
		RuleSetId:   ruleSet.Id,
		PeriodStart: 1000,
		PeriodEnd:   2000,
	})
	if err != nil || len(first) != 1 {
		t.Fatalf("first GenerateAffiliateSettlements err=%v settlements=%+v", err, first)
	}

	second, err := GenerateAffiliateSettlements(db, AffiliateSettlementBuildInput{
		RuleSetId:   ruleSet.Id,
		PeriodStart: 1000,
		PeriodEnd:   2000,
	})
	if err != nil || len(second) != 1 {
		t.Fatalf("expected existing draft to be returned, err=%v settlements=%+v", err, second)
	}
	if second[0].Id != first[0].Id || second[0].CommissionCents != 1000 || second[0].PayableCents != 1000 {
		t.Fatalf("unexpected existing draft settlement: first=%+v second=%+v", first[0], second[0])
	}
}

func TestGenerateAffiliateSettlementsCapsNegativePayableAtZero(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "settlement-negative-payable")
	seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, -1200, 1000, 2000)

	settlements, err := GenerateAffiliateSettlements(db, AffiliateSettlementBuildInput{
		RuleSetId:   ruleSet.Id,
		PeriodStart: 1000,
		PeriodEnd:   2000,
	})
	if err != nil {
		t.Fatalf("GenerateAffiliateSettlements returned error: %v", err)
	}
	if len(settlements) != 1 {
		t.Fatalf("expected one settlement, got %+v", settlements)
	}

	settlement := settlements[0]
	if settlement.CommissionCents != -1200 || settlement.HeadFeeCents != 0 || settlement.DeductionCents != 1200 || settlement.PayableCents != 0 {
		t.Fatalf("expected negative gross amount to become deduction and zero payable, got %+v", settlement)
	}
}

func TestGenerateAffiliateSettlementsScansEventsWithCursorLimit(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	restoreBatchSize := setAffiliateSettlementEventScanBatchSizeForTest(2)
	defer restoreBatchSize()
	removeQueryGuard := rejectUnboundedAffiliateSettlementEventQueries(t, db)
	defer removeQueryGuard()

	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "settlement-event-cursor-scan")
	for i := 0; i < 3; i++ {
		seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, int64(100+i), 1000, 2000)
		seedAffiliateSettlementHeadFeeEvent(t, db, ruleSet.Id, 100, int64(200+i), 1000, 2000)
	}

	settlements, err := GenerateAffiliateSettlements(db, AffiliateSettlementBuildInput{
		RuleSetId:   ruleSet.Id,
		PeriodStart: 1000,
		PeriodEnd:   2000,
	})
	if err != nil {
		t.Fatalf("GenerateAffiliateSettlements returned error: %v", err)
	}
	if len(settlements) != 1 {
		t.Fatalf("expected one settlement from cursor scan, got %+v", settlements)
	}
	if settlements[0].CommissionCents != 303 || settlements[0].HeadFeeCents != 603 || settlements[0].PayableCents != 906 {
		t.Fatalf("unexpected settlement amounts from cursor scan: %+v", settlements[0])
	}
}

func TestGenerateAffiliateSettlementsLinksEventsInBatches(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	restoreBatchSize := setAffiliateSettlementEventScanBatchSizeForTest(2)
	defer restoreBatchSize()
	removeUpdateGuard := rejectOversizedAffiliateSettlementEventLinkUpdates(t, db, 2)
	defer removeUpdateGuard()

	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "settlement-link-update-batches")
	for i := 0; i < 3; i++ {
		seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, int64(100+i), 1000, 2000)
		seedAffiliateSettlementHeadFeeEvent(t, db, ruleSet.Id, 100, int64(200+i), 1000, 2000)
	}

	settlements, err := GenerateAffiliateSettlements(db, AffiliateSettlementBuildInput{
		RuleSetId:   ruleSet.Id,
		PeriodStart: 1000,
		PeriodEnd:   2000,
	})
	if err != nil {
		t.Fatalf("GenerateAffiliateSettlements returned error: %v", err)
	}
	if len(settlements) != 1 {
		t.Fatalf("expected one settlement from batched link updates, got %+v", settlements)
	}

	var readyCommissionCount int64
	if err := db.Model(&model.AffiliateCommissionEvent{}).
		Where("settlement_id = ? AND status = ?", settlements[0].Id, model.AffiliateEventStatusReady).
		Count(&readyCommissionCount).Error; err != nil {
		t.Fatalf("count ready commission events: %v", err)
	}
	if readyCommissionCount != 3 {
		t.Fatalf("expected three commission events linked in batches, got %d", readyCommissionCount)
	}
	var readyHeadFeeCount int64
	if err := db.Model(&model.AffiliateHeadFeeEvent{}).
		Where("settlement_id = ? AND status = ?", settlements[0].Id, model.AffiliateEventStatusReady).
		Count(&readyHeadFeeCount).Error; err != nil {
		t.Fatalf("count ready head fee events: %v", err)
	}
	if readyHeadFeeCount != 3 {
		t.Fatalf("expected three head fee events linked in batches, got %d", readyHeadFeeCount)
	}
}

func TestAffiliateSettlementStatusTransitions(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "settlement-status-transitions")
	seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, 1000, 1000, 2000)
	settlements, err := GenerateAffiliateSettlements(db, AffiliateSettlementBuildInput{
		RuleSetId:   ruleSet.Id,
		PeriodStart: 1000,
		PeriodEnd:   2000,
	})
	if err != nil || len(settlements) != 1 {
		t.Fatalf("GenerateAffiliateSettlements err=%v settlements=%+v", err, settlements)
	}

	if _, err := MarkAffiliateSettlementPaid(db, settlements[0].Id, AffiliateSettlementPaidInput{
		ActorUserId:      9,
		PaidAt:           3000,
		PaymentReference: "pay-ref-draft",
	}); err == nil {
		t.Fatal("expected paying a draft settlement to be rejected")
	}

	frozen, err := FreezeAffiliateSettlement(db, settlements[0].Id, AffiliateSettlementStatusInput{
		ActorUserId: 9,
		Reason:      "freeze for audit",
	})
	if err != nil {
		t.Fatalf("FreezeAffiliateSettlement returned error: %v", err)
	}
	if frozen.Status != model.AffiliateSettlementStatusFrozen {
		t.Fatalf("expected frozen settlement, got %+v", frozen)
	}

	paid, err := MarkAffiliateSettlementPaid(db, frozen.Id, AffiliateSettlementPaidInput{
		ActorUserId:      9,
		PaidAt:           3000,
		PaymentReference: "pay-ref-001",
	})
	if err != nil {
		t.Fatalf("MarkAffiliateSettlementPaid returned error: %v", err)
	}
	if paid.Status != model.AffiliateSettlementStatusPaid || paid.PaidByUserId != 9 || paid.PaidAt != 3000 || paid.PaymentReference != "pay-ref-001" {
		t.Fatalf("unexpected paid settlement: %+v", paid)
	}

	var event model.AffiliateCommissionEvent
	if err := db.Where("settlement_id = ?", paid.Id).First(&event).Error; err != nil {
		t.Fatalf("load paid settlement event: %v", err)
	}
	if event.Status != model.AffiliateEventStatusSettled {
		t.Fatalf("expected linked commission event to be settled, got %+v", event)
	}
}

func TestVoidAffiliateSettlementMarksLinkedEventsVoid(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "settlement-void-events")
	seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, 1000, 1000, 2000)
	seedAffiliateSettlementHeadFeeEvent(t, db, ruleSet.Id, 100, 300, 1000, 2000)
	settlements, err := GenerateAffiliateSettlements(db, AffiliateSettlementBuildInput{
		RuleSetId:   ruleSet.Id,
		PeriodStart: 1000,
		PeriodEnd:   2000,
	})
	if err != nil || len(settlements) != 1 {
		t.Fatalf("GenerateAffiliateSettlements err=%v settlements=%+v", err, settlements)
	}

	voided, err := VoidAffiliateSettlement(db, settlements[0].Id, AffiliateSettlementStatusInput{
		ActorUserId: 9,
		Reason:      "invalid period",
	})
	if err != nil {
		t.Fatalf("VoidAffiliateSettlement returned error: %v", err)
	}
	if voided.Status != model.AffiliateSettlementStatusVoid {
		t.Fatalf("expected void settlement, got %+v", voided)
	}

	var commissionEvent model.AffiliateCommissionEvent
	if err := db.Where("settlement_id = ?", voided.Id).First(&commissionEvent).Error; err != nil {
		t.Fatalf("load void commission event: %v", err)
	}
	if commissionEvent.Status != model.AffiliateEventStatusVoid {
		t.Fatalf("expected linked commission event to be void, got %+v", commissionEvent)
	}
	var headFeeEvent model.AffiliateHeadFeeEvent
	if err := db.Where("settlement_id = ?", voided.Id).First(&headFeeEvent).Error; err != nil {
		t.Fatalf("load void head fee event: %v", err)
	}
	if headFeeEvent.Status != model.AffiliateEventStatusVoid {
		t.Fatalf("expected linked head fee event to be void, got %+v", headFeeEvent)
	}
}

func seedAffiliateSettlementCommissionEvent(t *testing.T, db *gorm.DB, ruleSetId int, affiliateUserId int, commissionCents int64, periodStart int64, periodEnd int64) model.AffiliateCommissionEvent {
	t.Helper()
	event := model.AffiliateCommissionEvent{
		AffiliateUserId:         affiliateUserId,
		DownstreamUserId:        affiliateUserId + 1000,
		Kind:                    AffiliateCommissionEventKindAccrual,
		Status:                  model.AffiliateEventStatusPending,
		RuleSetId:               ruleSetId,
		PeriodStart:             periodStart,
		PeriodEnd:               periodEnd,
		CommissionCents:         commissionCents,
		NetPaidConsumptionCents: commissionCents * 10,
		SyntheticMarker:         fmt.Sprintf("commission-settlement-test:%d:%d:%d:%d", affiliateUserId, commissionCents, periodStart, periodEnd),
	}
	if commissionCents < 0 {
		event.Kind = AffiliateCommissionEventKindClawback
		event.NetPaidConsumptionCents = commissionCents * 10
	}
	if err := db.Create(&event).Error; err != nil {
		t.Fatalf("seed commission event: %v", err)
	}
	return event
}

func seedAffiliateSettlementHeadFeeEvent(t *testing.T, db *gorm.DB, ruleSetId int, affiliateUserId int, amountCents int64, periodStart int64, periodEnd int64) model.AffiliateHeadFeeEvent {
	t.Helper()
	event := model.AffiliateHeadFeeEvent{
		AffiliateUserId:  affiliateUserId,
		DownstreamUserId: affiliateUserId + 2000,
		RuleSetId:        ruleSetId,
		Status:           model.AffiliateEventStatusPending,
		AmountCents:      amountCents,
		SyntheticMarker:  fmt.Sprintf("rule:%d:affiliate:%d:downstream:%d:period:%d-%d", ruleSetId, affiliateUserId, affiliateUserId+2000, periodStart, periodEnd),
	}
	if err := db.Create(&event).Error; err != nil {
		t.Fatalf("seed head fee event: %v", err)
	}
	return event
}

func setAffiliateSettlementEventScanBatchSizeForTest(size int) func() {
	original := affiliateSettlementEventScanBatchSize
	affiliateSettlementEventScanBatchSize = size
	return func() {
		affiliateSettlementEventScanBatchSize = original
	}
}

func rejectUnboundedAffiliateSettlementEventQueries(t *testing.T, db *gorm.DB) func() {
	t.Helper()
	callbackName := "reject_unbounded_affiliate_settlement_event_queries_" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	if err := db.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil {
			return
		}
		table := tx.Statement.Schema.Table
		if table != "affiliate_commission_events" && table != "affiliate_head_fee_events" {
			return
		}
		if _, ok := tx.Statement.Clauses["LIMIT"]; !ok {
			tx.AddError(errors.New("unbounded affiliate settlement event query without LIMIT"))
		}
	}); err != nil {
		t.Fatalf("register unbounded settlement event query guard: %v", err)
	}
	return func() {
		_ = db.Callback().Query().Remove(callbackName)
	}
}

func rejectOversizedAffiliateSettlementEventLinkUpdates(t *testing.T, db *gorm.DB, maxIDs int) func() {
	t.Helper()
	callbackName := "reject_oversized_affiliate_settlement_event_link_updates_" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	if err := db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil {
			return
		}
		table := tx.Statement.Schema.Table
		if table != "affiliate_commission_events" && table != "affiliate_head_fee_events" {
			return
		}
		where, ok := tx.Statement.Clauses["WHERE"]
		if !ok {
			return
		}
		if ids := maxSliceLenInClauseExpression(where.Expression); ids > maxIDs {
			tx.AddError(fmt.Errorf("affiliate settlement link update used %d ids, want <= %d", ids, maxIDs))
		}
	}); err != nil {
		t.Fatalf("register oversized settlement event link update guard: %v", err)
	}
	return func() {
		_ = db.Callback().Update().Remove(callbackName)
	}
}

func maxSliceLenInClauseExpression(expression clause.Expression) int {
	maxLen := 0
	var inspect func(clause.Expression)
	inspect = func(expr clause.Expression) {
		switch typed := expr.(type) {
		case clause.Where:
			for _, nested := range typed.Exprs {
				inspect(nested)
			}
		case clause.AndConditions:
			for _, nested := range typed.Exprs {
				inspect(nested)
			}
		case clause.OrConditions:
			for _, nested := range typed.Exprs {
				inspect(nested)
			}
		case clause.Expr:
			for _, value := range typed.Vars {
				if length := sliceLen(value); length > maxLen {
					maxLen = length
				}
			}
		case clause.IN:
			if len(typed.Values) > maxLen {
				maxLen = len(typed.Values)
			}
		}
	}
	inspect(expression)
	return maxLen
}

func sliceLen(value interface{}) int {
	reflected := reflect.ValueOf(value)
	if !reflected.IsValid() {
		return 0
	}
	switch reflected.Kind() {
	case reflect.Array, reflect.Slice:
		return reflected.Len()
	default:
		return 0
	}
}
