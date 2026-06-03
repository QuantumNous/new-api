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

func TestRunAffiliateSettlementPipelineResumesFailedJobRunForSameIdempotencyKey(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	input := AffiliateSettlementRunInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		FreezeDays:      7,
		Now:             3000,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
		ActorUserId:     9,
		Reason:          "first run fails before rules are published",
	}

	first, err := RunAffiliateSettlementPipeline(db, db, input)
	if err == nil {
		t.Fatalf("expected first run to fail without a published rule set, got %+v", first)
	}
	var failedRun model.AffiliateJobRun
	if err := db.First(&failedRun, first.JobRunId).Error; err != nil {
		t.Fatalf("load failed job run: %v", err)
	}
	if failedRun.Status != model.AffiliateJobRunStatusFailed || failedRun.ErrorMessage == "" {
		t.Fatalf("expected failed job run with error context, got %+v", failedRun)
	}

	savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-resume-failed"))
	input.Now = 4000
	input.Reason = "retry same settlement run"
	second, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("retry RunAffiliateSettlementPipeline returned error: %v", err)
	}
	if second.JobRunId != failedRun.Id || second.IdempotencyKey != failedRun.IdempotencyKey {
		t.Fatalf("expected retry to resume failed job run, first=%+v second=%+v", failedRun, second)
	}

	var resumedRun model.AffiliateJobRun
	if err := db.First(&resumedRun, failedRun.Id).Error; err != nil {
		t.Fatalf("load resumed job run: %v", err)
	}
	if resumedRun.Status != model.AffiliateJobRunStatusSucceeded || resumedRun.CurrentStage != affiliateJobRunStageComplete {
		t.Fatalf("expected resumed job run to succeed, got %+v", resumedRun)
	}
	if resumedRun.StartedAt != 4000 || resumedRun.FinishedAt != 4000 || resumedRun.ErrorMessage != "" {
		t.Fatalf("expected resumed job run metadata to be refreshed, got %+v", resumedRun)
	}
	var runCount int64
	if err := db.Model(&model.AffiliateJobRun{}).
		Where("idempotency_key = ?", failedRun.IdempotencyKey).
		Count(&runCount).Error; err != nil {
		t.Fatalf("count job runs: %v", err)
	}
	if runCount != 1 {
		t.Fatalf("expected failed run to be resumed in place, got %d job runs", runCount)
	}
}

func TestRunAffiliateSettlementPipelineRejectsActiveRunningJobRunForSameIdempotencyKey(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-active-running"))
	input := AffiliateSettlementRunInput{
		RuleSetId:       ruleSet.Id,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		FreezeDays:      7,
		Now:             5000,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
		ActorUserId:     9,
		Reason:          "duplicate click while the first run is still active",
	}
	activeRun := model.AffiliateJobRun{
		JobType:        model.AffiliateJobRunTypeSettlementPipeline,
		Status:         model.AffiliateJobRunStatusRunning,
		IdempotencyKey: affiliateSettlementRunIdempotencyKey(input),
		RuleSetId:      ruleSet.Id,
		PeriodStart:    input.PeriodStart,
		PeriodEnd:      input.PeriodEnd,
		ActorUserId:    8,
		CurrentStage:   affiliateJobRunStageCommission,
		InputSnapshot:  `{"status":"running"}`,
		StartedAt:      input.Now - 60,
		CreatedAt:      input.Now - 60,
		UpdatedAt:      input.Now - 60,
	}
	if err := db.Create(&activeRun).Error; err != nil {
		t.Fatalf("seed active job run: %v", err)
	}

	result, err := RunAffiliateSettlementPipeline(db, db, input)
	if err == nil {
		t.Fatalf("expected active running job run to block duplicate execution, got %+v", result)
	}
	if !strings.Contains(err.Error(), "already running") {
		t.Fatalf("expected already running error, got %v", err)
	}

	var runCount int64
	if err := db.Model(&model.AffiliateJobRun{}).
		Where("idempotency_key = ?", activeRun.IdempotencyKey).
		Count(&runCount).Error; err != nil {
		t.Fatalf("count job runs: %v", err)
	}
	if runCount != 1 {
		t.Fatalf("expected duplicate active run to be rejected without creating another job run, got %d", runCount)
	}
	var saved model.AffiliateJobRun
	if err := db.First(&saved, activeRun.Id).Error; err != nil {
		t.Fatalf("load active job run: %v", err)
	}
	if saved.Status != model.AffiliateJobRunStatusRunning || saved.StartedAt != activeRun.StartedAt || saved.ActorUserId != activeRun.ActorUserId {
		t.Fatalf("expected active job run to remain untouched, got %+v", saved)
	}
}

func TestRunAffiliateSettlementPipelineResumesStaleRunningJobRunForSameIdempotencyKey(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-stale-running"))
	input := AffiliateSettlementRunInput{
		RuleSetId:       ruleSet.Id,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		FreezeDays:      7,
		Now:             1000 + affiliateJobRunStaleAfterSeconds + 10,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
		ActorUserId:     9,
		Reason:          "take over stale running settlement job",
	}
	staleRun := model.AffiliateJobRun{
		JobType:              model.AffiliateJobRunTypeSettlementPipeline,
		Status:               model.AffiliateJobRunStatusRunning,
		IdempotencyKey:       affiliateSettlementRunIdempotencyKey(input),
		RuleSetId:            ruleSet.Id,
		PeriodStart:          input.PeriodStart,
		PeriodEnd:            input.PeriodEnd,
		ActorUserId:          8,
		CurrentStage:         affiliateJobRunStageCommission,
		LastCursorCreatedAt:  1234,
		LastCursorId:         5678,
		KPISnapshotCount:     9,
		CommissionEventCount: 8,
		HeadFeeEventCount:    7,
		SettlementCount:      6,
		InputSnapshot:        `{"status":"stale"}`,
		ResultSnapshot:       `{"status":"running"}`,
		ErrorMessage:         "old in-flight job never finished",
		StartedAt:            1000,
		CreatedAt:            1000,
		UpdatedAt:            1000,
	}
	if err := db.Create(&staleRun).Error; err != nil {
		t.Fatalf("seed stale job run: %v", err)
	}

	result, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("stale running retry returned error: %v", err)
	}
	if result.JobRunId != staleRun.Id || result.IdempotencyKey != staleRun.IdempotencyKey {
		t.Fatalf("expected retry to reuse stale running job run, stale=%+v result=%+v", staleRun, result)
	}

	var resumedRun model.AffiliateJobRun
	if err := db.First(&resumedRun, staleRun.Id).Error; err != nil {
		t.Fatalf("load resumed stale job run: %v", err)
	}
	if resumedRun.Status != model.AffiliateJobRunStatusSucceeded || resumedRun.CurrentStage != affiliateJobRunStageComplete {
		t.Fatalf("expected stale running job run to finish successfully, got %+v", resumedRun)
	}
	if resumedRun.StartedAt != input.Now || resumedRun.FinishedAt != input.Now || resumedRun.ActorUserId != input.ActorUserId {
		t.Fatalf("expected resumed stale job run metadata to be refreshed, got %+v", resumedRun)
	}
	if resumedRun.ErrorMessage != "" || resumedRun.LastCursorCreatedAt != 0 || resumedRun.LastCursorId != 0 || resumedRun.SettlementCount != result.SettlementCount {
		t.Fatalf("expected stale job run state to be reset before rerun, got %+v", resumedRun)
	}
	var runCount int64
	if err := db.Model(&model.AffiliateJobRun{}).
		Where("idempotency_key = ?", staleRun.IdempotencyKey).
		Count(&runCount).Error; err != nil {
		t.Fatalf("count job runs: %v", err)
	}
	if runCount != 1 {
		t.Fatalf("expected stale running run to be resumed in place, got %d job runs", runCount)
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
