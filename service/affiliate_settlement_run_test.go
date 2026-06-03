package service

import (
	"strings"
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

func TestRunAffiliateSettlementPipelineIsIdempotentForSamePeriod(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-idempotent-period"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateCommissionRelation(t, db, 100, 300, 2)
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200, 300})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, CreatedAt: 1300, Type: model.LogTypeConsume, Quota: 3000, Other: `{"quota_source":"paid"}`})

	input := AffiliateSettlementRunInput{
		RuleSetId:       ruleSet.Id,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		FreezeDays:      7,
		Now:             1100 + 21*affiliateSecondsPerDay,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
		ActorUserId:     9,
		Reason:          "monthly settlement run",
	}
	first, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("first RunAffiliateSettlementPipeline returned error: %v", err)
	}
	second, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("second RunAffiliateSettlementPipeline returned error: %v", err)
	}
	if len(first.Settlements) != 1 || len(second.Settlements) != 1 {
		t.Fatalf("expected one settlement from both runs, first=%+v second=%+v", first, second)
	}
	if first.Settlements[0].Id != second.Settlements[0].Id || first.Settlements[0].PayableCents != second.Settlements[0].PayableCents {
		t.Fatalf("expected repeat run to return the same draft settlement, first=%+v second=%+v", first.Settlements[0], second.Settlements[0])
	}
	if first.IdempotencyKey == "" || first.IdempotencyKey != second.IdempotencyKey {
		t.Fatalf("expected repeat runs to share idempotency key, first=%q second=%q", first.IdempotencyKey, second.IdempotencyKey)
	}

	var snapshotCount int64
	if err := db.Model(&model.AffiliateKPISnapshot{}).
		Where("affiliate_user_id = ? AND rule_set_id = ? AND period_start = ? AND period_end = ?", 100, ruleSet.Id, 1000, 2000).
		Count(&snapshotCount).Error; err != nil {
		t.Fatalf("count kpi snapshots: %v", err)
	}
	if snapshotCount != 1 {
		t.Fatalf("expected one KPI snapshot after repeat run, got %d", snapshotCount)
	}
	var commissionCount int64
	if err := db.Model(&model.AffiliateCommissionEvent{}).
		Where("rule_set_id = ? AND period_start = ? AND period_end = ?", ruleSet.Id, 1000, 2000).
		Count(&commissionCount).Error; err != nil {
		t.Fatalf("count commission events: %v", err)
	}
	if commissionCount != 3 {
		t.Fatalf("expected three commission events after repeat run, got %d", commissionCount)
	}
	var headFeeCount int64
	if err := db.Model(&model.AffiliateHeadFeeEvent{}).
		Where("rule_set_id = ?", ruleSet.Id).
		Count(&headFeeCount).Error; err != nil {
		t.Fatalf("count head fee events: %v", err)
	}
	if headFeeCount != 2 {
		t.Fatalf("expected two head fee events after repeat run, got %d", headFeeCount)
	}
	var settlementCount int64
	if err := db.Model(&model.AffiliateSettlement{}).
		Where("affiliate_user_id = ? AND rule_set_id = ? AND period_start = ? AND period_end = ?", 100, ruleSet.Id, 1000, 2000).
		Count(&settlementCount).Error; err != nil {
		t.Fatalf("count settlements: %v", err)
	}
	if settlementCount != 1 {
		t.Fatalf("expected one settlement after repeat run, got %d", settlementCount)
	}
	var succeededRunCount int64
	if err := db.Model(&model.AffiliateJobRun{}).
		Where("idempotency_key = ? AND status = ?", first.IdempotencyKey, model.AffiliateJobRunStatusSucceeded).
		Count(&succeededRunCount).Error; err != nil {
		t.Fatalf("count job runs: %v", err)
	}
	if succeededRunCount != 2 {
		t.Fatalf("expected both executions to be audited as successful job runs, got %d", succeededRunCount)
	}
}

func TestRunAffiliateSettlementPipelineRecordsJobRunSuccess(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-job-success"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})

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
	if result.JobRunId <= 0 || result.JobRunStatus != model.AffiliateJobRunStatusSucceeded || result.IdempotencyKey == "" {
		t.Fatalf("expected result to expose succeeded job run identity, got %+v", result)
	}

	var jobRun model.AffiliateJobRun
	if err := db.First(&jobRun, result.JobRunId).Error; err != nil {
		t.Fatalf("load affiliate job run: %v", err)
	}
	if jobRun.JobType != model.AffiliateJobRunTypeSettlementPipeline || jobRun.Status != model.AffiliateJobRunStatusSucceeded {
		t.Fatalf("unexpected job run type/status: %+v", jobRun)
	}
	if jobRun.IdempotencyKey != result.IdempotencyKey || jobRun.RuleSetId != ruleSet.Id || jobRun.PeriodStart != 1000 || jobRun.PeriodEnd != 2000 {
		t.Fatalf("unexpected job run identity: %+v", jobRun)
	}
	if jobRun.ActorUserId != 9 || jobRun.StartedAt <= 0 || jobRun.FinishedAt <= 0 || jobRun.CurrentStage != "complete" {
		t.Fatalf("unexpected job run execution metadata: %+v", jobRun)
	}
	if jobRun.KPISnapshotCount != result.KPISnapshotCount || jobRun.CommissionEventCount != result.CommissionEventCount || jobRun.HeadFeeEventCount != result.HeadFeeEventCount || jobRun.SettlementCount != result.SettlementCount {
		t.Fatalf("job run counts do not match result: run=%+v result=%+v", jobRun, result)
	}
	if jobRun.InputSnapshot == "" || jobRun.ResultSnapshot == "" || jobRun.ErrorMessage != "" {
		t.Fatalf("expected sanitized input/result snapshots and no error, got %+v", jobRun)
	}
	if jobRun.LastCursorCreatedAt != 1100 || jobRun.LastCursorId <= 0 {
		t.Fatalf("expected job run to retain last scanned log cursor, got %+v", jobRun)
	}
}

func TestRunAffiliateSettlementPipelineRecordsJobRunFailure(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)

	_, err := RunAffiliateSettlementPipeline(db, db, AffiliateSettlementRunInput{
		RuleSetId:       999,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		Now:             3000,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
		ActorUserId:     9,
		Reason:          "do not leak password=secret-token",
	})
	if err == nil {
		t.Fatal("expected settlement pipeline to fail without a published rule set")
	}

	var jobRun model.AffiliateJobRun
	if err := db.Where("job_type = ?", model.AffiliateJobRunTypeSettlementPipeline).First(&jobRun).Error; err != nil {
		t.Fatalf("load failed affiliate job run: %v", err)
	}
	if jobRun.Status != model.AffiliateJobRunStatusFailed || jobRun.CurrentStage != "kpi" || jobRun.FinishedAt != 3000 {
		t.Fatalf("unexpected failed job run status: %+v", jobRun)
	}
	if jobRun.ErrorMessage == "" || !strings.Contains(jobRun.ErrorMessage, "no published affiliate rule set") {
		t.Fatalf("expected sanitized failure message, got %+v", jobRun)
	}
	serialized := jobRun.InputSnapshot + jobRun.ResultSnapshot + jobRun.ErrorMessage
	if strings.Contains(serialized, "secret-token") || strings.Contains(serialized, "password=") {
		t.Fatalf("job run leaked sensitive reason text: %+v", jobRun)
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
