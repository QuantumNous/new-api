package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

func TestBuildAffiliatePendingHeadFeeEventsCreatesQualifiedEvent(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("head-fee-qualified"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	inviteEvent := seedAffiliateHeadFeeInviteEvent(t, db, 100, 200, 1000)
	kpiSnapshot := seedAffiliateHeadFeeKPISnapshot(t, db, 100, ruleSet.Id, "growth", 1000, 2000)
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 500, Other: `{"quota_source":"paid"}`})

	events, err := BuildAffiliatePendingHeadFeeEvents(db, db, AffiliateHeadFeeBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		Now:             1000 + 21*affiliateSecondsPerDay + 1,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingHeadFeeEvents returned error: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one head fee event, got %+v", events)
	}
	event := events[0]
	if event.AffiliateUserId != 100 || event.DownstreamUserId != 200 || event.InviteEventId != inviteEvent.Id {
		t.Fatalf("unexpected event identity: %+v", event)
	}
	if event.RuleSetId != ruleSet.Id || event.KPISnapshotId != kpiSnapshot.Id || event.Status != model.AffiliateEventStatusPending {
		t.Fatalf("unexpected event status/rule linkage: %+v", event)
	}
	if event.AmountCents != 2500 || event.FirstRechargeCents != 1000 || event.NetPaidCents != 1500 || event.QualificationDays != 14 {
		t.Fatalf("unexpected head fee amounts: %+v", event)
	}
	if !strings.Contains(event.Metadata, `"rule_set_version":"head-fee-qualified"`) {
		t.Fatalf("expected metadata to record rule set version, got %q", event.Metadata)
	}
}

func TestBuildAffiliatePendingHeadFeeEventsScansPaidLogsWithCursorLimit(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	restoreBatchSize := setAffiliateLogScanBatchSizeForTest(2)
	defer restoreBatchSize()
	removeQueryGuard := rejectUnboundedAffiliateLogQueries(t, db)
	defer removeQueryGuard()

	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("head-fee-cursor-scan"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateHeadFeeInviteEvent(t, db, 100, 200, 1000)
	seedAffiliateHeadFeeKPISnapshot(t, db, 100, ruleSet.Id, "growth", 1000, 2000)
	for i, quota := range []int{1000, 500, 500} {
		seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: int64(1100 + i), Type: model.LogTypeConsume, Quota: quota, Other: `{"quota_source":"paid"}`})
	}

	events, err := BuildAffiliatePendingHeadFeeEvents(db, db, AffiliateHeadFeeBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		Now:             1000 + 21*affiliateSecondsPerDay + 1,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingHeadFeeEvents returned error: %v", err)
	}
	if len(events) != 1 || events[0].NetPaidCents != 2000 {
		t.Fatalf("expected one cursor-scanned head fee event, got %+v", events)
	}
}

func TestBuildAffiliatePendingHeadFeeEventsSkipsUnqualifiedUsersAndDeduplicates(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("head-fee-skip-unqualified"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateCommissionRelation(t, db, 100, 300, 1)
	seedAffiliateHeadFeeInviteEvent(t, db, 100, 200, 1000)
	seedAffiliateHeadFeeInviteEvent(t, db, 100, 300, 1000)
	seedAffiliateHeadFeeKPISnapshot(t, db, 100, ruleSet.Id, "growth", 1000, 2000)
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 50, Other: `{"quota_source":"gift"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"gift"}`})

	events, err := BuildAffiliatePendingHeadFeeEvents(db, db, AffiliateHeadFeeBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		Now:             1000 + 21*affiliateSecondsPerDay + 1,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingHeadFeeEvents returned error: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("expected unqualified users to be skipped, got %+v", events)
	}

	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1300, Type: model.LogTypeConsume, Quota: 500, Other: `{"quota_source":"paid"}`})
	first, err := BuildAffiliatePendingHeadFeeEvents(db, db, AffiliateHeadFeeBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		Now:             1000 + 21*affiliateSecondsPerDay + 1,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingHeadFeeEvents second run returned error: %v", err)
	}
	second, err := BuildAffiliatePendingHeadFeeEvents(db, db, AffiliateHeadFeeBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		Now:             1000 + 21*affiliateSecondsPerDay + 1,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingHeadFeeEvents third run returned error: %v", err)
	}
	if len(first) != 1 || len(second) != 1 || first[0].Id != second[0].Id {
		t.Fatalf("expected head fee generation to deduplicate by synthetic marker, first=%+v second=%+v", first, second)
	}
}

func TestBuildAffiliatePendingHeadFeeEventsUsesQuotaSourceSidecar(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("head-fee-quota-source-sidecar"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateHeadFeeInviteEvent(t, db, 100, 200, 1000)
	seedAffiliateHeadFeeKPISnapshot(t, db, 100, ruleSet.Id, "growth", 1000, 2000)
	firstPaidLog := seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1200})
	secondPaidLog := seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 800})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      200,
		Source:      AffiliateQuotaSourcePaid,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      1000,
		SourceLogId: firstPaidLog.Id,
	})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      200,
		Source:      AffiliateQuotaSourcePaid,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      500,
		SourceLogId: secondPaidLog.Id,
	})

	events, err := BuildAffiliatePendingHeadFeeEvents(db, db, AffiliateHeadFeeBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		Now:             1000 + 21*affiliateSecondsPerDay + 1,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingHeadFeeEvents returned error: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one sidecar-qualified head fee event, got %+v", events)
	}
	if events[0].FirstRechargeCents != 1000 || events[0].NetPaidCents != 1500 {
		t.Fatalf("expected sidecar paid amounts to qualify head fee, got %+v", events[0])
	}
}

func TestBuildAffiliatePendingHeadFeeEventsExcludesUnmarkedAndLegacyUnknownUsage(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("head-fee-legacy-unknown-excluded"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateHeadFeeInviteEvent(t, db, 100, 200, 1000)
	seedAffiliateHeadFeeKPISnapshot(t, db, 100, ruleSet.Id, "growth", 1000, 2000)
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 5000})
	legacyUnknownLog := seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 3000})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      200,
		Source:      model.QuotaSourceLegacyUnknown,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      3000,
		SourceLogId: legacyUnknownLog.Id,
	})

	events, err := BuildAffiliatePendingHeadFeeEvents(db, db, AffiliateHeadFeeBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		Now:             1000 + 21*affiliateSecondsPerDay + 1,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingHeadFeeEvents returned error: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("expected unmarked and legacy_unknown usage not to qualify head fee, got %+v", events)
	}
}

func TestBuildAffiliatePendingHeadFeeEventsSkipsDisabledHeadFeeRule(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	input := newAffiliateHeadFeeRuleSetInput("head-fee-disabled-rule")
	for i := range input.HeadFeeRules {
		if input.HeadFeeRules[i].AffiliateLevel == 1 && input.HeadFeeRules[i].KPITierCode == "growth" {
			input.HeadFeeRules[i].Status = model.AffiliateProfileStatusDisabled
		}
	}
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, input)
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateHeadFeeInviteEvent(t, db, 100, 200, 1000)
	seedAffiliateHeadFeeKPISnapshot(t, db, 100, ruleSet.Id, "growth", 1000, 2000)
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 500, Other: `{"quota_source":"paid"}`})

	events, err := BuildAffiliatePendingHeadFeeEvents(db, db, AffiliateHeadFeeBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		Now:             1000 + 21*affiliateSecondsPerDay + 1,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingHeadFeeEvents returned error: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("expected disabled head fee rule to be skipped, got %+v", events)
	}
}

func newAffiliateHeadFeeRuleSetInput(version string) AffiliateRuleSetDraftInput {
	input := newAffiliateKPIRuleSetInput(version)
	input.HeadFeeRules = []AffiliateHeadFeeRuleInput{
		{AffiliateLevel: 1, KPITierCode: "base", AmountCents: 1000, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 100, QualificationDays: 14, UnlockDelayDays: 7},
		{AffiliateLevel: 1, KPITierCode: "growth", AmountCents: 2500, FirstRechargeMinCents: 1000, PeriodNetPaidMinCents: 1500, QualificationDays: 14, UnlockDelayDays: 7},
		{AffiliateLevel: 2, KPITierCode: "base", AmountCents: 500, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 100, QualificationDays: 14, UnlockDelayDays: 7},
	}
	return input
}

func seedAffiliateHeadFeeInviteEvent(t *testing.T, db *gorm.DB, inviterUserId int, inviteeUserId int, createdAt int64) model.AffiliateInviteEvent {
	t.Helper()
	event := model.AffiliateInviteEvent{
		InviterUserId: inviterUserId,
		InviteeUserId: inviteeUserId,
		InviteSource:  AffiliateInviteSourceAffiliate,
		CreatedAt:     createdAt,
	}
	if err := db.Create(&event).Error; err != nil {
		t.Fatalf("seed invite event: %v", err)
	}
	return event
}

func seedAffiliateHeadFeeKPISnapshot(t *testing.T, db *gorm.DB, affiliateUserId int, ruleSetId int, tierCode string, periodStart int64, periodEnd int64) model.AffiliateKPISnapshot {
	t.Helper()
	snapshot := model.AffiliateKPISnapshot{
		AffiliateUserId: affiliateUserId,
		RuleSetId:       ruleSetId,
		PeriodStart:     periodStart,
		PeriodEnd:       periodEnd,
		TierCode:        tierCode,
		CoefficientBps:  15000,
	}
	if err := db.Create(&snapshot).Error; err != nil {
		t.Fatalf("seed kpi snapshot: %v", err)
	}
	return snapshot
}
