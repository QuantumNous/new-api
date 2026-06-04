package service

import (
	"errors"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

func TestSanitizeAffiliateJobRunErrorRedactsStructuredSecrets(t *testing.T) {
	sanitized := sanitizeAffiliateJobRunError(errors.New(`provider failed password=plain-secret callback=https://api.example.test/v1/send?api_key=query-secret&phone=demo-phone-secret payload={"api_key":"json-api-secret","secret":"json-secret","token":"json-token","safe":"kept"}`))

	for _, forbidden := range []string{
		"plain-secret",
		"api.example.test",
		"v1/send",
		"query-secret",
		"demo-phone-secret",
		"json-api-secret",
		"json-secret",
		"json-token",
	} {
		if strings.Contains(sanitized, forbidden) {
			t.Fatalf("sanitized job run error leaked %q: %s", forbidden, sanitized)
		}
	}
	if !strings.Contains(sanitized, `"safe":"kept"`) {
		t.Fatalf("sanitized job run error should preserve non-sensitive context, got %s", sanitized)
	}
}

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

func TestRunAffiliateSettlementPipelineDryRunBuildsPreviewWithoutPersisting(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-dry-run-preview"))
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
		Reason:          "dry-run monthly settlement run",
		DryRun:          true,
	}
	dryRun, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("dry-run RunAffiliateSettlementPipeline returned error: %v", err)
	}
	if !dryRun.DryRun || dryRun.JobRunId != 0 || dryRun.JobRunStatus != "dry_run" {
		t.Fatalf("expected dry-run result without persisted job run, got %+v", dryRun)
	}
	if dryRun.KPISnapshotCount != 1 || dryRun.CommissionEventCount != 3 || dryRun.HeadFeeEventCount != 2 || len(dryRun.Settlements) != 1 {
		t.Fatalf("unexpected dry-run counts: %+v", dryRun)
	}
	if dryRun.Settlements[0].PayableCents != 5900 {
		t.Fatalf("unexpected dry-run settlement amount: %+v", dryRun.Settlements[0])
	}
	assertAffiliatePipelineRows(t, db, 0, 0, 0, 0, 0)

	input.DryRun = false
	formal, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("formal RunAffiliateSettlementPipeline returned error: %v", err)
	}
	if formal.DryRun || formal.KPISnapshotCount != dryRun.KPISnapshotCount || formal.CommissionEventCount != dryRun.CommissionEventCount || formal.HeadFeeEventCount != dryRun.HeadFeeEventCount || len(formal.Settlements) != len(dryRun.Settlements) {
		t.Fatalf("expected formal run to match dry-run counts, dry=%+v formal=%+v", dryRun, formal)
	}
	if formal.Settlements[0].PayableCents != dryRun.Settlements[0].PayableCents {
		t.Fatalf("expected formal settlement amount to match dry-run, dry=%+v formal=%+v", dryRun.Settlements[0], formal.Settlements[0])
	}
	assertAffiliatePipelineRows(t, db, 1, 1, 3, 2, 1)
}

func TestRunAffiliateSettlementPipelineDoubleRunMatchesLinkedEventTotals(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-double-run-audit"))
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
		Reason:          "double-run settlement audit",
		DryRun:          true,
	}
	dryRun, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("dry-run RunAffiliateSettlementPipeline returned error: %v", err)
	}
	assertAffiliatePipelineRows(t, db, 0, 0, 0, 0, 0)

	input.DryRun = false
	formal, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("formal RunAffiliateSettlementPipeline returned error: %v", err)
	}
	repeated, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("repeat RunAffiliateSettlementPipeline returned error: %v", err)
	}
	if len(dryRun.Settlements) != 1 || len(formal.Settlements) != 1 || len(repeated.Settlements) != 1 {
		t.Fatalf("expected one settlement in every run, dry=%+v formal=%+v repeated=%+v", dryRun, formal, repeated)
	}
	if formal.Settlements[0].Id != repeated.Settlements[0].Id {
		t.Fatalf("expected repeat run to reuse the same draft settlement, formal=%+v repeated=%+v", formal.Settlements[0], repeated.Settlements[0])
	}
	if formal.Settlements[0].PayableCents != dryRun.Settlements[0].PayableCents || repeated.Settlements[0].PayableCents != formal.Settlements[0].PayableCents {
		t.Fatalf("expected dry-run, formal run, and repeat run payable amounts to match, dry=%+v formal=%+v repeated=%+v", dryRun.Settlements[0], formal.Settlements[0], repeated.Settlements[0])
	}

	totals, err := AuditAffiliateSettlementEventTotals(db, formal.Settlements[0].Id)
	if err != nil {
		t.Fatalf("AuditAffiliateSettlementEventTotals returned error: %v", err)
	}
	assertAffiliateSettlementMatchesEventTotals(t, formal.Settlements[0], totals)
	assertAffiliateSettlementMatchesEventTotals(t, repeated.Settlements[0], totals)
	assertAffiliatePipelineRows(t, db, 2, 1, 3, 2, 1)
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
	for _, key := range []string{
		`"kpi_log_id"`,
		`"commission_log_id"`,
		`"head_fee_log_id"`,
		`"settlement_commission_event_id"`,
		`"settlement_head_fee_event_id"`,
	} {
		if !strings.Contains(jobRun.ResultSnapshot, key) {
			t.Fatalf("expected successful job run result snapshot to retain scan cursor %s, got %q", key, jobRun.ResultSnapshot)
		}
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

func TestRunAffiliateSettlementPipelineRecordsPartialKPIProgressOnFailure(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateKPIRuleSetInput("settlement-run-partial-kpi-progress"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateCommissionProfileAndRelation(t, db, 101, 201, 1)
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200})
	seedAffiliateKPIInviteEvents(t, db, 101, []int{201})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 201, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})

	createdKPISnapshots := 0
	failSecondKPISnapshot := "fail_second_kpi_snapshot_" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	if err := db.Callback().Create().Before("gorm:create").Register(failSecondKPISnapshot, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Table != "affiliate_kpi_snapshots" {
			return
		}
		createdKPISnapshots++
		if createdKPISnapshots == 2 {
			tx.AddError(errors.New("forced second kpi snapshot failure"))
		}
	}); err != nil {
		t.Fatalf("register second kpi failure callback: %v", err)
	}

	result, err := RunAffiliateSettlementPipeline(db, db, AffiliateSettlementRunInput{
		RuleSetId:       ruleSet.Id,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		FreezeDays:      7,
		Now:             3000,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
		ActorUserId:     9,
		Reason:          "record partial kpi progress",
	})
	_ = db.Callback().Create().Remove(failSecondKPISnapshot)
	if err == nil {
		t.Fatalf("expected forced kpi snapshot failure, got %+v", result)
	}

	var persistedKPICount int64
	if err := db.Model(&model.AffiliateKPISnapshot{}).
		Where("rule_set_id = ? AND period_start = ? AND period_end = ?", ruleSet.Id, 1000, 2000).
		Count(&persistedKPICount).Error; err != nil {
		t.Fatalf("count persisted kpi snapshots: %v", err)
	}
	if persistedKPICount != 1 {
		t.Fatalf("expected first kpi snapshot to be durable before failure, got %d", persistedKPICount)
	}

	var jobRun model.AffiliateJobRun
	if err := db.First(&jobRun, result.JobRunId).Error; err != nil {
		t.Fatalf("load failed job run: %v", err)
	}
	if jobRun.Status != model.AffiliateJobRunStatusFailed || jobRun.CurrentStage != affiliateJobRunStageKPI {
		t.Fatalf("expected failed job run at kpi stage, got %+v", jobRun)
	}
	if jobRun.KPISnapshotCount != 1 {
		t.Fatalf("expected failed job run to retain partial kpi snapshot count, got %+v", jobRun)
	}
	if !strings.Contains(jobRun.ResultSnapshot, `"kpi_snapshot_count":1`) {
		t.Fatalf("expected failed result snapshot to retain partial kpi snapshot count, got %q", jobRun.ResultSnapshot)
	}
}

func TestRunAffiliateSettlementPipelineRecordsPartialCommissionProgressOnFailure(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "settlement-run-partial-commission-progress")
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})

	createdCommissionEvents := 0
	failSecondCommissionEvent := "fail_second_commission_event_" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	if err := db.Callback().Create().Before("gorm:create").Register(failSecondCommissionEvent, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Table != "affiliate_commission_events" {
			return
		}
		createdCommissionEvents++
		if createdCommissionEvents == 2 {
			tx.AddError(errors.New("forced second commission event failure"))
		}
	}); err != nil {
		t.Fatalf("register second commission failure callback: %v", err)
	}

	result, err := RunAffiliateSettlementPipeline(db, db, AffiliateSettlementRunInput{
		RuleSetId:       ruleSet.Id,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		FreezeDays:      7,
		Now:             3000,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
		ActorUserId:     9,
		Reason:          "record partial commission progress",
	})
	_ = db.Callback().Create().Remove(failSecondCommissionEvent)
	if err == nil {
		t.Fatalf("expected forced commission event failure, got %+v", result)
	}

	var persistedCommissionCount int64
	if err := db.Model(&model.AffiliateCommissionEvent{}).
		Where("rule_set_id = ? AND period_start = ? AND period_end = ?", ruleSet.Id, 1000, 2000).
		Count(&persistedCommissionCount).Error; err != nil {
		t.Fatalf("count persisted commission events: %v", err)
	}
	if persistedCommissionCount != 1 {
		t.Fatalf("expected first commission event to be durable before failure, got %d", persistedCommissionCount)
	}

	var jobRun model.AffiliateJobRun
	if err := db.First(&jobRun, result.JobRunId).Error; err != nil {
		t.Fatalf("load failed job run: %v", err)
	}
	if jobRun.Status != model.AffiliateJobRunStatusFailed || jobRun.CurrentStage != affiliateJobRunStageCommission {
		t.Fatalf("expected failed job run at commission stage, got %+v", jobRun)
	}
	if jobRun.CommissionEventCount != 1 {
		t.Fatalf("expected failed job run to retain partial commission event count, got %+v", jobRun)
	}
	if !strings.Contains(jobRun.ResultSnapshot, `"commission_event_count":1`) {
		t.Fatalf("expected failed result snapshot to retain partial commission event count, got %q", jobRun.ResultSnapshot)
	}
}

func TestRunAffiliateSettlementPipelineRecordsPartialHeadFeeProgressOnFailure(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-partial-head-fee-progress"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateCommissionRelation(t, db, 100, 300, 1)
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200, 300})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, CreatedAt: 1300, Type: model.LogTypeConsume, Quota: 3000, Other: `{"quota_source":"paid"}`})

	createdHeadFeeEvents := 0
	failSecondHeadFeeEvent := "fail_second_head_fee_event_" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	if err := db.Callback().Create().Before("gorm:create").Register(failSecondHeadFeeEvent, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Table != "affiliate_head_fee_events" {
			return
		}
		createdHeadFeeEvents++
		if createdHeadFeeEvents == 2 {
			tx.AddError(errors.New("forced second head fee event failure"))
		}
	}); err != nil {
		t.Fatalf("register second head fee failure callback: %v", err)
	}

	result, err := RunAffiliateSettlementPipeline(db, db, AffiliateSettlementRunInput{
		RuleSetId:       ruleSet.Id,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		FreezeDays:      7,
		Now:             1100 + 21*affiliateSecondsPerDay,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
		ActorUserId:     9,
		Reason:          "record partial head fee progress",
	})
	_ = db.Callback().Create().Remove(failSecondHeadFeeEvent)
	if err == nil {
		t.Fatalf("expected forced head fee event failure, got %+v", result)
	}

	var persistedHeadFeeCount int64
	if err := db.Model(&model.AffiliateHeadFeeEvent{}).
		Where("rule_set_id = ?", ruleSet.Id).
		Count(&persistedHeadFeeCount).Error; err != nil {
		t.Fatalf("count persisted head fee events: %v", err)
	}
	if persistedHeadFeeCount != 1 {
		t.Fatalf("expected first head fee event to be durable before failure, got %d", persistedHeadFeeCount)
	}

	var jobRun model.AffiliateJobRun
	if err := db.First(&jobRun, result.JobRunId).Error; err != nil {
		t.Fatalf("load failed job run: %v", err)
	}
	if jobRun.Status != model.AffiliateJobRunStatusFailed || jobRun.CurrentStage != affiliateJobRunStageHeadFee {
		t.Fatalf("expected failed job run at head fee stage, got %+v", jobRun)
	}
	if jobRun.HeadFeeEventCount != 1 {
		t.Fatalf("expected failed job run to retain partial head fee event count, got %+v", jobRun)
	}
	if !strings.Contains(jobRun.ResultSnapshot, `"head_fee_event_count":1`) {
		t.Fatalf("expected failed result snapshot to retain partial head fee event count, got %q", jobRun.ResultSnapshot)
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

func TestRunAffiliateSettlementPipelineResumesFailedSettlementStageWithoutRescanningLogs(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-resume-skip-completed-stages"))
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
		Reason:          "resume settlement stage without rescanning logs",
	}

	failSettlementQuery := "fail_settlement_query_" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	if err := db.Callback().Query().Before("gorm:query").Register(failSettlementQuery, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Table != "affiliate_settlements" {
			return
		}
		tx.AddError(errors.New("forced settlement stage failure"))
	}); err != nil {
		t.Fatalf("register settlement failure callback: %v", err)
	}
	first, err := RunAffiliateSettlementPipeline(db, db, input)
	_ = db.Callback().Query().Remove(failSettlementQuery)
	if err == nil {
		t.Fatalf("expected first settlement run to fail at settlement stage, got %+v", first)
	}

	var failedRun model.AffiliateJobRun
	if err := db.First(&failedRun, first.JobRunId).Error; err != nil {
		t.Fatalf("load failed job run: %v", err)
	}
	if failedRun.Status != model.AffiliateJobRunStatusFailed || failedRun.CurrentStage != affiliateJobRunStageSettlement {
		t.Fatalf("expected failed job run at settlement stage, got %+v", failedRun)
	}
	if failedRun.KPISnapshotCount != 1 || failedRun.CommissionEventCount != 3 || failedRun.HeadFeeEventCount != 2 {
		t.Fatalf("expected failed settlement-stage run to retain completed stage counts, got %+v", failedRun)
	}

	rejectLogQuery := "reject_log_rescan_" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	if err := db.Callback().Query().Before("gorm:query").Register(rejectLogQuery, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Table != "logs" {
			return
		}
		tx.AddError(errors.New("resume should not rescan usage logs after completed stages"))
	}); err != nil {
		t.Fatalf("register log rescan guard: %v", err)
	}
	defer func() {
		_ = db.Callback().Query().Remove(rejectLogQuery)
	}()

	second, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("retry should resume from settlement stage without rescanning logs: %v", err)
	}
	if second.JobRunId != failedRun.Id || second.KPISnapshotCount != 1 || second.CommissionEventCount != 3 || second.HeadFeeEventCount != 2 || len(second.Settlements) != 1 {
		t.Fatalf("unexpected resumed pipeline result: first=%+v second=%+v", failedRun, second)
	}
}

func TestRunAffiliateSettlementPipelineResumeRerunsWhenCompletedStageOutputsAreMissing(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-resume-validates-stage-outputs"))
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
		Reason:          "resume should validate completed stage outputs",
	}
	failedRun := model.AffiliateJobRun{
		JobType:              model.AffiliateJobRunTypeSettlementPipeline,
		Status:               model.AffiliateJobRunStatusFailed,
		IdempotencyKey:       affiliateSettlementRunIdempotencyKey(input),
		RuleSetId:            ruleSet.Id,
		PeriodStart:          input.PeriodStart,
		PeriodEnd:            input.PeriodEnd,
		ActorUserId:          8,
		CurrentStage:         affiliateJobRunStageSettlement,
		KPISnapshotCount:     1,
		CommissionEventCount: 3,
		HeadFeeEventCount:    2,
		ErrorMessage:         "previous settlement-stage attempt failed after counters were written",
		StartedAt:            input.Now - 60,
		CreatedAt:            input.Now - 60,
		UpdatedAt:            input.Now - 60,
	}
	if err := db.Create(&failedRun).Error; err != nil {
		t.Fatalf("seed inconsistent failed job run: %v", err)
	}

	result, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("resume should rerun missing completed stages, got error: %v", err)
	}
	if result.JobRunId != failedRun.Id || result.KPISnapshotCount != 1 || result.CommissionEventCount != 3 || result.HeadFeeEventCount != 2 || len(result.Settlements) != 1 {
		t.Fatalf("expected resume to rebuild missing persisted outputs before settlement, got %+v", result)
	}
}

func TestRunAffiliateSettlementPipelineResumeRerunsWhenCompletedStageCountsAreMissing(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("settlement-run-resume-missing-stage-counts"))
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
		Reason:          "resume should not trust missing stage counts",
	}
	failedRun := model.AffiliateJobRun{
		JobType:        model.AffiliateJobRunTypeSettlementPipeline,
		Status:         model.AffiliateJobRunStatusFailed,
		IdempotencyKey: affiliateSettlementRunIdempotencyKey(input),
		RuleSetId:      ruleSet.Id,
		PeriodStart:    input.PeriodStart,
		PeriodEnd:      input.PeriodEnd,
		ActorUserId:    8,
		CurrentStage:   affiliateJobRunStageSettlement,
		ErrorMessage:   "legacy failed run reached settlement before counters were captured",
		StartedAt:      input.Now - 60,
		CreatedAt:      input.Now - 60,
		UpdatedAt:      input.Now - 60,
	}
	if err := db.Create(&failedRun).Error; err != nil {
		t.Fatalf("seed failed job run with missing stage counts: %v", err)
	}

	result, err := RunAffiliateSettlementPipeline(db, db, input)
	if err != nil {
		t.Fatalf("resume should rerun stages with missing completion counts, got error: %v", err)
	}
	if result.JobRunId != failedRun.Id || result.KPISnapshotCount != 1 || result.CommissionEventCount != 3 || result.HeadFeeEventCount != 2 || len(result.Settlements) != 1 {
		t.Fatalf("expected resume to rebuild stages when counts are missing, got %+v", result)
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

func assertAffiliatePipelineRows(t *testing.T, db *gorm.DB, jobRuns int64, kpiSnapshots int64, commissionEvents int64, headFeeEvents int64, settlements int64) {
	t.Helper()
	var actualJobRuns int64
	if err := db.Model(&model.AffiliateJobRun{}).Count(&actualJobRuns).Error; err != nil {
		t.Fatalf("count job runs: %v", err)
	}
	var actualKPISnapshots int64
	if err := db.Model(&model.AffiliateKPISnapshot{}).Count(&actualKPISnapshots).Error; err != nil {
		t.Fatalf("count kpi snapshots: %v", err)
	}
	var actualCommissionEvents int64
	if err := db.Model(&model.AffiliateCommissionEvent{}).Count(&actualCommissionEvents).Error; err != nil {
		t.Fatalf("count commission events: %v", err)
	}
	var actualHeadFeeEvents int64
	if err := db.Model(&model.AffiliateHeadFeeEvent{}).Count(&actualHeadFeeEvents).Error; err != nil {
		t.Fatalf("count head fee events: %v", err)
	}
	var actualSettlements int64
	if err := db.Model(&model.AffiliateSettlement{}).Count(&actualSettlements).Error; err != nil {
		t.Fatalf("count settlements: %v", err)
	}
	if actualJobRuns != jobRuns || actualKPISnapshots != kpiSnapshots || actualCommissionEvents != commissionEvents || actualHeadFeeEvents != headFeeEvents || actualSettlements != settlements {
		t.Fatalf("unexpected pipeline rows job_runs=%d/%d kpi=%d/%d commission=%d/%d head_fee=%d/%d settlements=%d/%d",
			actualJobRuns, jobRuns,
			actualKPISnapshots, kpiSnapshots,
			actualCommissionEvents, commissionEvents,
			actualHeadFeeEvents, headFeeEvents,
			actualSettlements, settlements,
		)
	}
}

func assertAffiliateSettlementMatchesEventTotals(t *testing.T, settlement model.AffiliateSettlement, totals AffiliateSettlementEventTotals) {
	t.Helper()
	if totals.SettlementId != settlement.Id {
		t.Fatalf("expected audit totals for settlement %d, got %+v", settlement.Id, totals)
	}
	if totals.CommissionCents != settlement.CommissionCents || totals.HeadFeeCents != settlement.HeadFeeCents || totals.DeductionCents != settlement.DeductionCents || totals.PayableCents != settlement.PayableCents {
		t.Fatalf("settlement amounts do not match linked event totals, settlement=%+v totals=%+v", settlement, totals)
	}
	if totals.GrossCents != totals.CommissionCents+totals.HeadFeeCents {
		t.Fatalf("audit gross total is inconsistent: %+v", totals)
	}
}
