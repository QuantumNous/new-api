package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestCreateAffiliateManualCommissionAdjustmentCreatesPendingEvent(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "commission-manual-adjustment")

	event, err := CreateAffiliateManualCommissionAdjustment(db, AffiliateManualCommissionAdjustmentInput{
		AffiliateUserId:  100,
		DownstreamUserId: 200,
		RuleSetId:        ruleSet.Id,
		PeriodStart:      1000,
		PeriodEnd:        2000,
		CommissionCents:  -350,
		ActorUserId:      9,
		Reason:           "manual clawback after support review",
	})
	if err != nil {
		t.Fatalf("CreateAffiliateManualCommissionAdjustment returned error: %v", err)
	}
	if event.AffiliateUserId != 100 || event.DownstreamUserId != 200 || event.RuleSetId != ruleSet.Id {
		t.Fatalf("unexpected event identity: %+v", event)
	}
	if event.Kind != AffiliateCommissionEventKindManualAdjustment || event.Status != model.AffiliateEventStatusPending {
		t.Fatalf("expected pending manual adjustment, got %+v", event)
	}
	if event.CommissionCents != -350 || event.SourceLogId != 0 || event.SourceTopUpId != 0 || event.SettlementId != 0 {
		t.Fatalf("unexpected manual adjustment amounts/source fields: %+v", event)
	}
	if !strings.Contains(event.Metadata, `"reason":"manual clawback after support review"`) ||
		!strings.Contains(event.Metadata, `"actor_user_id":9`) ||
		!strings.Contains(event.Metadata, `"rule_set_version":"commission-manual-adjustment"`) {
		t.Fatalf("expected metadata to record actor, reason and rule version, got %q", event.Metadata)
	}
	if event.SyntheticMarker == "" {
		t.Fatalf("expected manual adjustment synthetic marker, got %+v", event)
	}
}

func TestCreateAffiliateManualCommissionAdjustmentRejectsZeroAmount(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	savePublishedAffiliateCommissionRuleSet(t, db, "commission-manual-zero")
	if _, err := CreateAffiliateManualCommissionAdjustment(db, AffiliateManualCommissionAdjustmentInput{
		AffiliateUserId: 100,
		RuleSetId:       1,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		ActorUserId:     9,
		Reason:          "zero should fail",
	}); err == nil {
		t.Fatal("expected zero manual adjustment to be rejected")
	}
}

func TestVoidAffiliateCommissionEventRejectsSettledAndVoidsPending(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "commission-void")
	pending := seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, 1200, 1000, 2000)
	settled := seedAffiliateSettlementCommissionEvent(t, db, ruleSet.Id, 100, 300, 1000, 2000)
	if err := db.Model(&model.AffiliateCommissionEvent{}).
		Where("id = ?", settled.Id).
		Updates(map[string]interface{}{"status": model.AffiliateEventStatusSettled}).Error; err != nil {
		t.Fatalf("mark settled event: %v", err)
	}

	voided, err := VoidAffiliateCommissionEvent(db, pending.Id, AffiliateCommissionEventVoidInput{
		ActorUserId: 9,
		Reason:      "duplicate pending event",
	})
	if err != nil {
		t.Fatalf("VoidAffiliateCommissionEvent returned error: %v", err)
	}
	if voided.Status != model.AffiliateEventStatusVoid {
		t.Fatalf("expected pending event voided, got %+v", voided)
	}
	if !strings.Contains(voided.Metadata, `"void_reason":"duplicate pending event"`) {
		t.Fatalf("expected void metadata to record reason, got %q", voided.Metadata)
	}

	if _, err := VoidAffiliateCommissionEvent(db, settled.Id, AffiliateCommissionEventVoidInput{
		ActorUserId: 9,
		Reason:      "settled should fail",
	}); err == nil {
		t.Fatal("expected settled commission event void to be rejected")
	}
}

func TestRecomputeAffiliatePendingCommissionEventsVoidsGeneratedPendingEventsOnly(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "commission-recompute")
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 300, 1)
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	manual, err := CreateAffiliateManualCommissionAdjustment(db, AffiliateManualCommissionAdjustmentInput{
		AffiliateUserId:  100,
		DownstreamUserId: 300,
		RuleSetId:        ruleSet.Id,
		PeriodStart:      1000,
		PeriodEnd:        2000,
		CommissionCents:  250,
		ActorUserId:      9,
		Reason:           "manual bonus kept across recompute",
	})
	if err != nil {
		t.Fatalf("seed manual adjustment: %v", err)
	}
	first, err := BuildAffiliatePendingCommissionEvents(db, db, AffiliateCommissionBuildInput{
		RuleSetId:       ruleSet.Id,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		QuotaPerUnit:    1000,
		USDExchangeRate: 7,
	})
	if err != nil || len(first) != 1 {
		t.Fatalf("seed generated commission err=%v events=%+v", err, first)
	}

	result, err := RecomputeAffiliatePendingCommissionEvents(db, db, AffiliateCommissionRecomputeInput{
		RuleSetId:       ruleSet.Id,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		QuotaPerUnit:    1000,
		USDExchangeRate: 7,
		ActorUserId:     9,
		Reason:          "rerun paid log attribution",
	})
	if err != nil {
		t.Fatalf("RecomputeAffiliatePendingCommissionEvents returned error: %v", err)
	}
	if result.VoidedEventCount != 1 || result.CreatedEventCount != 1 || len(result.CreatedEvents) != 1 {
		t.Fatalf("unexpected recompute result: %+v", result)
	}

	var oldGenerated model.AffiliateCommissionEvent
	if err := db.First(&oldGenerated, first[0].Id).Error; err != nil {
		t.Fatalf("load old generated event: %v", err)
	}
	if oldGenerated.Status != model.AffiliateEventStatusVoid {
		t.Fatalf("expected old generated event voided, got %+v", oldGenerated)
	}
	if oldGenerated.SyntheticMarker == first[0].SyntheticMarker {
		t.Fatalf("expected old synthetic marker to be released, got %q", oldGenerated.SyntheticMarker)
	}

	var keptManual model.AffiliateCommissionEvent
	if err := db.First(&keptManual, manual.Id).Error; err != nil {
		t.Fatalf("load manual event: %v", err)
	}
	if keptManual.Status != model.AffiliateEventStatusPending || keptManual.Kind != AffiliateCommissionEventKindManualAdjustment {
		t.Fatalf("expected manual adjustment to survive recompute, got %+v", keptManual)
	}
	if result.CreatedEvents[0].Status != model.AffiliateEventStatusPending || result.CreatedEvents[0].SyntheticMarker != first[0].SyntheticMarker {
		t.Fatalf("expected regenerated pending event with original marker, got %+v", result.CreatedEvents[0])
	}
}
