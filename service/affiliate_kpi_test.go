package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

func TestBuildAffiliateKPISnapshotsSelectsQualifiedTier(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateKPIRuleSetInput("kpi-qualified-tier"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateCommissionRelation(t, db, 100, 300, 2)
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200, 300})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, CreatedAt: 1300, Type: model.LogTypeConsume, Quota: 3000, Other: `{"quota_source":"paid"}`})

	snapshots, err := BuildAffiliateKPISnapshots(db, db, AffiliateKPIBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		QuotaPerUnit:    1000,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateKPISnapshots returned error: %v", err)
	}
	if len(snapshots) != 1 {
		t.Fatalf("expected one KPI snapshot, got %+v", snapshots)
	}
	snapshot := snapshots[0]
	if snapshot.AffiliateUserId != 100 || snapshot.RuleSetId != ruleSet.Id {
		t.Fatalf("unexpected snapshot identity: %+v", snapshot)
	}
	if snapshot.EffectiveNewUserCount != 2 || snapshot.NetPaidConsumptionCents != 500 || snapshot.PaidConsumptionRawQuota != 5000 {
		t.Fatalf("unexpected KPI metrics: %+v", snapshot)
	}
	if snapshot.GiftOnlyRatioBps != 0 || snapshot.AbnormalRatioBps != 0 || snapshot.SecondPaymentRatioBps != 5000 {
		t.Fatalf("unexpected KPI quality ratios: %+v", snapshot)
	}
	if snapshot.TierCode != "growth" || snapshot.CoefficientBps != 15000 {
		t.Fatalf("expected growth KPI tier, got %+v", snapshot)
	}
	if !strings.Contains(snapshot.Snapshot, `"rule_set_version":"kpi-qualified-tier"`) {
		t.Fatalf("expected snapshot to record rule set version, got %q", snapshot.Snapshot)
	}
}

func TestBuildAffiliateKPISnapshotsScansUsageLogsWithCursorLimit(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	restoreBatchSize := setAffiliateLogScanBatchSizeForTest(2)
	defer restoreBatchSize()
	removeQueryGuard := rejectUnboundedAffiliateLogQueries(t, db)
	defer removeQueryGuard()

	savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateKPIRuleSetInput("kpi-cursor-scan"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200})
	for i := 0; i < 3; i++ {
		seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: int64(1100 + i), Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	}

	snapshots, err := BuildAffiliateKPISnapshots(db, db, AffiliateKPIBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		QuotaPerUnit:    1000,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateKPISnapshots returned error: %v", err)
	}
	if len(snapshots) != 1 || snapshots[0].PaidConsumptionRawQuota != 3000 {
		t.Fatalf("expected one KPI snapshot from cursor scan, got %+v", snapshots)
	}
}

func TestBuildAffiliateKPISnapshotsFallsBackWhenQualityGateFails(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateKPIRuleSetInput("kpi-quality-fallback"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateCommissionRelation(t, db, 100, 300, 2)
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200, 300})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 5000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 5000, Other: `{"quota_source":"gift"}`})

	snapshots, err := BuildAffiliateKPISnapshots(db, db, AffiliateKPIBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		QuotaPerUnit:    1000,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateKPISnapshots returned error: %v", err)
	}
	if len(snapshots) != 1 {
		t.Fatalf("expected one KPI snapshot, got %+v", snapshots)
	}
	snapshot := snapshots[0]
	if snapshot.GiftOnlyUserCount != 1 || snapshot.GiftOnlyRatioBps != 10000 {
		t.Fatalf("expected one gift-only user and 100%% ratio against qualified effective users, got %+v", snapshot)
	}
	if snapshot.TierCode != "base" || snapshot.CoefficientBps != 10000 {
		t.Fatalf("expected quality gate to fall back to base tier, got %+v", snapshot)
	}
}

func TestBuildAffiliateKPISnapshotsUsesQuotaSourceSidecar(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateKPIRuleSetInput("kpi-quota-source-sidecar"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateCommissionRelation(t, db, 100, 300, 2)
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200, 300})
	paidLog := seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000})
	giftLog := seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 500})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      200,
		Source:      AffiliateQuotaSourcePaid,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      1000,
		SourceLogId: paidLog.Id,
	})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      300,
		Source:      AffiliateQuotaSourceGift,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      500,
		SourceLogId: giftLog.Id,
	})

	snapshots, err := BuildAffiliateKPISnapshots(db, db, AffiliateKPIBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		QuotaPerUnit:    1000,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateKPISnapshots returned error: %v", err)
	}
	if len(snapshots) != 1 {
		t.Fatalf("expected one KPI snapshot, got %+v", snapshots)
	}
	snapshot := snapshots[0]
	if snapshot.PaidConsumptionRawQuota != 1000 || snapshot.NetPaidConsumptionCents != 100 {
		t.Fatalf("expected sidecar paid consumption metrics, got %+v", snapshot)
	}
	if snapshot.GiftOnlyUserCount != 1 || snapshot.GiftOnlyRatioBps != 10000 {
		t.Fatalf("expected sidecar gift-only quality metrics, got %+v", snapshot)
	}
}

func TestBuildAffiliateKPISnapshotsExcludesUnmarkedAndLegacyUnknownUsage(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateKPIRuleSetInput("kpi-legacy-unknown-excluded"))
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 5000})
	legacyUnknownLog := seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 3000})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      200,
		Source:      model.QuotaSourceLegacyUnknown,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      3000,
		SourceLogId: legacyUnknownLog.Id,
	})

	snapshots, err := BuildAffiliateKPISnapshots(db, db, AffiliateKPIBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateKPISnapshots returned error: %v", err)
	}
	if len(snapshots) != 1 {
		t.Fatalf("expected one KPI snapshot, got %+v", snapshots)
	}
	snapshot := snapshots[0]
	if snapshot.PaidConsumptionRawQuota != 0 || snapshot.NetPaidConsumptionCents != 0 {
		t.Fatalf("expected unmarked and legacy_unknown usage to stay out of paid metrics, got %+v", snapshot)
	}
	if snapshot.GiftOnlyUserCount != 0 || snapshot.GiftOnlyRatioBps != 0 {
		t.Fatalf("expected legacy_unknown usage not to be classified as gift-only quality traffic, got %+v", snapshot)
	}
	if snapshot.SecondPaymentRatioBps != 0 {
		t.Fatalf("expected legacy_unknown usage not to count as second paid consumption, got %+v", snapshot)
	}
}

func TestBuildAffiliateKPISnapshotsCountsOnlyQualifiedEffectiveNewUsers(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	input := newAffiliateKPIRuleSetInput("kpi-qualified-effective-users")
	input.HeadFeeRules = []AffiliateHeadFeeRuleInput{
		{AffiliateLevel: 1, KPITierCode: "base", AmountCents: 1000, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 500, QualificationDays: 14, UnlockDelayDays: 7},
		{AffiliateLevel: 2, KPITierCode: "base", AmountCents: 500, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 500, QualificationDays: 14, UnlockDelayDays: 7},
	}
	savePublishedAffiliateCommissionRuleSetFromInput(t, db, input)
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	for _, userId := range []int{300, 400, 500, 600, 700} {
		seedAffiliateCommissionRelation(t, db, 100, userId, 1)
	}
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200, 300, 400, 500, 600, 700})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 3000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 3000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 6000, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, CreatedAt: 1200, Type: model.LogTypeRefund, Quota: 100, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 400, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 6000, Other: `{"quota_source":"paid","affiliate_abnormal":true}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 500, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 500, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 600, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 6000, Other: `{"quota_source":"gift"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 700, CreatedAt: 1100 + 15*affiliateSecondsPerDay, Type: model.LogTypeConsume, Quota: 6000, Other: `{"quota_source":"paid"}`})

	snapshots, err := BuildAffiliateKPISnapshots(db, db, AffiliateKPIBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       1100 + 30*affiliateSecondsPerDay,
		QuotaPerUnit:    1000,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateKPISnapshots returned error: %v", err)
	}
	if len(snapshots) != 1 {
		t.Fatalf("expected one KPI snapshot, got %+v", snapshots)
	}
	if snapshots[0].EffectiveNewUserCount != 1 {
		t.Fatalf("expected only the qualified paid invitee to count as KPI effective, got %+v", snapshots[0])
	}
}

func newAffiliateKPIRuleSetInput(version string) AffiliateRuleSetDraftInput {
	input := newAffiliateRuleSetDraftInput(version)
	input.KPITiers = []AffiliateKPITierInput{
		{AffiliateLevel: 1, Code: "base", Name: "Base", MinEffectiveNewUsers: 1, MinNetPaidAmountCents: 100, CoefficientBps: 10000, MaxGiftOnlyRatioBps: 10000, MaxAbnormalRatioBps: 10000, MinSecondPaymentRatioBps: 0, SortOrder: 1},
		{AffiliateLevel: 1, Code: "growth", Name: "Growth", MinEffectiveNewUsers: 2, MinNetPaidAmountCents: 500, CoefficientBps: 15000, MaxGiftOnlyRatioBps: 2500, MaxAbnormalRatioBps: 2500, MinSecondPaymentRatioBps: 5000, SortOrder: 2},
		{AffiliateLevel: 2, Code: "base", Name: "Base", MinEffectiveNewUsers: 1, MinNetPaidAmountCents: 100, CoefficientBps: 10000, MaxGiftOnlyRatioBps: 10000, MaxAbnormalRatioBps: 10000, MinSecondPaymentRatioBps: 0, SortOrder: 1},
	}
	input.HeadFeeRules = []AffiliateHeadFeeRuleInput{
		{AffiliateLevel: 1, KPITierCode: "base", AmountCents: 1000, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 100, QualificationDays: 14, UnlockDelayDays: 7},
		{AffiliateLevel: 1, KPITierCode: "growth", AmountCents: 2500, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 100, QualificationDays: 14, UnlockDelayDays: 7},
		{AffiliateLevel: 2, KPITierCode: "base", AmountCents: 500, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 100, QualificationDays: 14, UnlockDelayDays: 7},
	}
	return input
}

func seedAffiliateCommissionRelation(t *testing.T, db *gorm.DB, ancestor int, descendant int, depth int) {
	t.Helper()
	if err := db.Create(&model.AffiliateRelation{
		AncestorUserId:   ancestor,
		DescendantUserId: descendant,
		Depth:            depth,
		DirectInviterId:  ancestor,
		Status:           model.AffiliateProfileStatusActive,
		EffectiveAt:      100,
	}).Error; err != nil {
		t.Fatalf("seed affiliate relation: %v", err)
	}
}

func seedAffiliateKPIInviteEvents(t *testing.T, db *gorm.DB, inviterUserId int, inviteeUserIds []int) {
	t.Helper()
	events := make([]model.AffiliateInviteEvent, 0, len(inviteeUserIds))
	for _, inviteeUserId := range inviteeUserIds {
		events = append(events, model.AffiliateInviteEvent{
			InviterUserId: inviterUserId,
			InviteeUserId: inviteeUserId,
			InviteSource:  AffiliateInviteSourceAffiliate,
			CreatedAt:     1100,
		})
	}
	if err := db.Create(&events).Error; err != nil {
		t.Fatalf("seed invite events: %v", err)
	}
}
