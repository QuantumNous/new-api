package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestRunAffiliateSettlementPipelineBuildsKPICommissionHeadFeeAndSettlement(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-full-pipeline"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateCommissionRelation(t, db, 100, 300, 2)
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200, 300})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, CreatedAt: 1300, Type: model.LogTypeConsume, Quota: 3000, Other: `{"quota_source":"paid"}`})

	result, err := RunAffiliateSettlementPipeline(db, db, AffiliateSettlementRunInput{
		RuleSetId:       ruleSet.Id,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		FreezeDays:      7,
		Now:             1100 + 21*affiliateSecondsPerDay,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
		ActorUserId:     9,
		Reason:          "monthly settlement run",
	})
	if err != nil {
		t.Fatalf("RunAffiliateSettlementPipeline returned error: %v", err)
	}
	if result.KPISnapshotCount != 1 || result.CommissionEventCount != 3 || result.HeadFeeEventCount != 2 || len(result.Settlements) != 1 {
		t.Fatalf("unexpected pipeline counts: %+v", result)
	}

	settlement := result.Settlements[0]
	if settlement.AffiliateUserId != 100 || settlement.RuleSetId != ruleSet.Id || settlement.PeriodStart != 1000 || settlement.PeriodEnd != 2000 {
		t.Fatalf("unexpected settlement identity: %+v", settlement)
	}
	if settlement.Status != model.AffiliateSettlementStatusDraft || settlement.FrozenUntil != 2000+7*affiliateSecondsPerDay {
		t.Fatalf("unexpected settlement status: %+v", settlement)
	}
	if settlement.CommissionCents != 900 || settlement.HeadFeeCents != 5000 || settlement.PayableCents != 5900 {
		t.Fatalf("unexpected settlement amounts: %+v", settlement)
	}

	var snapshot model.AffiliateKPISnapshot
	if err := db.Where("affiliate_user_id = ? AND rule_set_id = ?", 100, ruleSet.Id).First(&snapshot).Error; err != nil {
		t.Fatalf("load kpi snapshot: %v", err)
	}
	if snapshot.TierCode != "growth" || snapshot.CoefficientBps != 15000 {
		t.Fatalf("expected growth KPI snapshot to drive boosted commissions and head fee, got %+v", snapshot)
	}

	var readyCommissionCount int64
	if err := db.Model(&model.AffiliateCommissionEvent{}).
		Where("settlement_id = ? AND status = ?", settlement.Id, model.AffiliateEventStatusReady).
		Count(&readyCommissionCount).Error; err != nil {
		t.Fatalf("count ready commission events: %v", err)
	}
	if readyCommissionCount != 3 {
		t.Fatalf("expected three commission events linked to settlement, got %d", readyCommissionCount)
	}
	var readyHeadFeeCount int64
	if err := db.Model(&model.AffiliateHeadFeeEvent{}).
		Where("settlement_id = ? AND status = ?", settlement.Id, model.AffiliateEventStatusReady).
		Count(&readyHeadFeeCount).Error; err != nil {
		t.Fatalf("count ready head fee events: %v", err)
	}
	if readyHeadFeeCount != 2 {
		t.Fatalf("expected two head fee events linked to settlement, got %d", readyHeadFeeCount)
	}
}

func TestRunAffiliateSettlementPipelineRejectsInvalidPeriod(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	if _, err := RunAffiliateSettlementPipeline(db, db, AffiliateSettlementRunInput{
		PeriodStart: 2000,
		PeriodEnd:   1000,
	}); err == nil {
		t.Fatal("expected invalid period to be rejected")
	}
}
