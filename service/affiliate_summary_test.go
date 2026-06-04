package service

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestBuildAffiliateDashboardSummaryForLevelOneScope(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	if err := db.AutoMigrate(&model.Log{}); err != nil {
		t.Fatalf("migrate logs: %v", err)
	}

	if err := db.Create(&[]model.AffiliateRelation{
		{AncestorUserId: 100, DescendantUserId: 200, Depth: 1, Status: model.AffiliateProfileStatusActive},
		{AncestorUserId: 100, DescendantUserId: 300, Depth: 2, Status: model.AffiliateProfileStatusActive},
		{AncestorUserId: 100, DescendantUserId: 400, Depth: 3, Status: model.AffiliateProfileStatusActive},
		{AncestorUserId: 100, DescendantUserId: 500, Depth: 1, Status: model.AffiliateProfileStatusDisabled},
	}).Error; err != nil {
		t.Fatalf("seed relations: %v", err)
	}
	if err := db.Create(&[]model.AffiliateInviteEvent{
		{InviteeUserId: 200, InviterUserId: 100, InviteSource: AffiliateInviteSourceAffiliate, CreatedAt: 20},
		{InviteeUserId: 300, InviterUserId: 200, InviteSource: AffiliateInviteSourceAffiliate, CreatedAt: 30},
		{InviteeUserId: 400, InviterUserId: 100, InviteSource: AffiliateInviteSourceAffiliate, CreatedAt: 40},
		{InviteeUserId: 500, InviterUserId: 100, InviteSource: AffiliateInviteSourceAffiliate, CreatedAt: 50},
		{InviteeUserId: 600, InviterUserId: 100, InviteSource: AffiliateInviteSourceNormal, CreatedAt: 60},
	}).Error; err != nil {
		t.Fatalf("seed invite events: %v", err)
	}
	if err := db.Create(&[]model.Log{
		{UserId: 200, Type: model.LogTypeConsume, Quota: 1000, CreatedAt: 20, Other: `{"quota_source":"paid"}`},
		{UserId: 300, Type: model.LogTypeConsume, Quota: 2000, CreatedAt: 30, Other: `{"quota_source":"paid"}`},
		{UserId: 300, Type: model.LogTypeRefund, Quota: 500, CreatedAt: 35, Other: `{"quota_source":"paid"}`},
		{UserId: 400, Type: model.LogTypeConsume, Quota: 4000, CreatedAt: 40},
		{UserId: 200, Type: model.LogTypeError, Quota: 900, CreatedAt: 45},
	}).Error; err != nil {
		t.Fatalf("seed logs: %v", err)
	}

	summary, err := BuildAffiliateDashboardSummary(db, db, AffiliateDashboardSummaryInput{
		Scope: AffiliateScope{
			Kind:           AffiliateScopeAffiliate,
			UserId:         100,
			AffiliateLevel: 1,
			MaxDepth:       2,
		},
		QuotaPerUnit:    1000,
		USDExchangeRate: 7,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateDashboardSummary returned error: %v", err)
	}

	if summary.TeamUserCount != 2 {
		t.Fatalf("expected two visible team users, got %+v", summary)
	}
	if summary.EffectiveNewUserCount != 0 {
		t.Fatalf("expected no effective affiliate invitees before rules are published, got %+v", summary)
	}
	if summary.NetConsumptionQuota != 2500 {
		t.Fatalf("expected net quota 2500, got %+v", summary)
	}
	if math.Abs(summary.NetConsumptionRMB-17.5) > 0.000001 {
		t.Fatalf("expected RMB 17.5, got %+v", summary)
	}
	if summary.EstimatedCommissionRMB != 0 || summary.HeadFeeRMB != 0 || summary.PendingSettlementRMB != 0 {
		t.Fatalf("commission placeholders should stay zero before rules land: %+v", summary)
	}
	if summary.KPITierName != "待配置" || summary.RuleStatus != "pending_rules" {
		t.Fatalf("expected pending rule placeholders, got %+v", summary)
	}
}

func TestBuildAffiliateDashboardSummaryCountsPaidNetConsumptionOnly(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	if err := db.Create(&model.AffiliateRelation{
		AncestorUserId:   100,
		DescendantUserId: 200,
		Depth:            1,
		DirectInviterId:  100,
		Status:           model.AffiliateProfileStatusActive,
		EffectiveAt:      1000,
	}).Error; err != nil {
		t.Fatalf("seed relation: %v", err)
	}
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 1000, CreatedAt: 1100, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeRefund, Quota: 300, CreatedAt: 1110, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 2000, CreatedAt: 1120, Other: `{"quota_source":"gift"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 3000, CreatedAt: 1130, Other: `{"quota_source":"trial"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 4000, CreatedAt: 1140})
	legacyUnknownLog := seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 5000, CreatedAt: 1150})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      200,
		Source:      model.QuotaSourceLegacyUnknown,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      5000,
		SourceLogId: legacyUnknownLog.Id,
	})
	partialPaidLog := seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 1000, CreatedAt: 1160})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      200,
		Source:      AffiliateQuotaSourcePaid,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      250,
		SourceLogId: partialPaidLog.Id,
	})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      200,
		Source:      AffiliateQuotaSourceGift,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      750,
		SourceLogId: partialPaidLog.Id,
	})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 700, CreatedAt: 1170, Other: `{"quota_source":"paid","affiliate_abnormal":true}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 999, Type: model.LogTypeConsume, Quota: 9000, CreatedAt: 1180, Other: `{"quota_source":"paid"}`})
	restoreBatchSize := setAffiliateLogScanBatchSizeForTest(2)
	defer restoreBatchSize()
	removeQueryGuard := rejectUnboundedAffiliateLogQueries(t, db)
	defer removeQueryGuard()

	summary, err := BuildAffiliateDashboardSummary(db, db, AffiliateDashboardSummaryInput{
		Scope: AffiliateScope{
			Kind:           AffiliateScopeAffiliate,
			UserId:         100,
			AffiliateLevel: 1,
			MaxDepth:       1,
		},
		StartTimestamp:  1000,
		EndTimestamp:    2000,
		QuotaPerUnit:    1000,
		USDExchangeRate: 7,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateDashboardSummary returned error: %v", err)
	}

	if summary.NetConsumptionQuota != 950 {
		t.Fatalf("expected dashboard net consumption to include only paid net quota, got %+v", summary)
	}
	if math.Abs(summary.NetConsumptionRMB-6.65) > 0.000001 {
		t.Fatalf("expected RMB 6.65 from paid net quota only, got %+v", summary)
	}
}

func TestBuildAffiliateDashboardSummaryShowsPublishedRuleAndLiveKPITier(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	savePublishedAffiliateCommissionRuleSetFromInput(t, db, BuildDefaultAffiliateRuleSetDraftInput("summary-live-kpi-tier", 1, "test"))
	seedAffiliateCommissionRelation(t, db, 100, 200, 1)

	summary, err := BuildAffiliateDashboardSummary(db, db, AffiliateDashboardSummaryInput{
		Scope: AffiliateScope{
			Kind:           AffiliateScopeAffiliate,
			UserId:         100,
			AffiliateLevel: 1,
			MaxDepth:       1,
		},
		StartTimestamp:  1000,
		EndTimestamp:    2000,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateDashboardSummary returned error: %v", err)
	}

	if summary.RuleStatus != "published_rules" || summary.KPITierName != "Observe" {
		t.Fatalf("expected published rules with live KPI tier, got %+v", summary)
	}
}

func TestBuildAffiliateDashboardSummaryShowsUnqualifiedWhenPublishedRulesDoNotMatch(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleInput := newAffiliateRuleSetDraftInput("summary-live-kpi-unqualified")
	ruleInput.KPITiers[0].MinEffectiveNewUsers = 99
	savePublishedAffiliateCommissionRuleSetFromInput(t, db, ruleInput)
	seedAffiliateCommissionRelation(t, db, 100, 200, 1)

	summary, err := BuildAffiliateDashboardSummary(db, db, AffiliateDashboardSummaryInput{
		Scope: AffiliateScope{
			Kind:           AffiliateScopeAffiliate,
			UserId:         100,
			AffiliateLevel: 1,
			MaxDepth:       1,
		},
		StartTimestamp:  1000,
		EndTimestamp:    2000,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateDashboardSummary returned error: %v", err)
	}

	if summary.RuleStatus != "published_rules" || summary.KPITierName != "未达标" {
		t.Fatalf("expected published rules with unqualified KPI tier, got %+v", summary)
	}
}

func TestBuildAffiliateDashboardSummaryBuildsDailyTrendsFromPaidAndFinanceOnly(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleInput := newAffiliateHeadFeeRuleSetInput("summary-daily-trends")
	ruleInput.EffectiveStart = 0
	ruleInput.EffectiveEnd = 0
	savePublishedAffiliateCommissionRuleSetFromInput(t, db, ruleInput)
	seedAffiliateCommissionRelation(t, db, 100, 200, 1)
	seedAffiliateCommissionRelation(t, db, 100, 300, 1)
	seedAffiliateCommissionRelation(t, db, 100, 400, 1)
	dayOne := int64(1000)
	dayTwo := dayOne + affiliateSecondsPerDay
	trendEnd := dayTwo + affiliateSecondsPerDay - 1

	seedAffiliateHeadFeeInviteEvent(t, db, 100, 400, dayOne+5)
	seedAffiliateHeadFeeInviteEvent(t, db, 100, 300, dayTwo+5)
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 1000, CreatedAt: dayOne + 10, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeRefund, Quota: 200, CreatedAt: dayOne + 20, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 400, Type: model.LogTypeConsume, Quota: 200, CreatedAt: dayOne + 25, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 5000, CreatedAt: dayOne + 30, Other: `{"quota_source":"gift"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, Type: model.LogTypeConsume, Quota: 500, CreatedAt: dayTwo + 10, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 700, CreatedAt: dayTwo + 20, Other: `{"quota_source":"paid","affiliate_abnormal":true}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 999, Type: model.LogTypeConsume, Quota: 9000, CreatedAt: dayTwo + 30, Other: `{"quota_source":"paid"}`})

	if err := db.Create(&[]model.AffiliateCommissionEvent{
		{AffiliateUserId: 100, DownstreamUserId: 200, RuleSetId: 1, Status: model.AffiliateEventStatusPending, CommissionCents: 123, CreatedAt: dayOne + 40},
		{AffiliateUserId: 100, DownstreamUserId: 300, RuleSetId: 1, Status: model.AffiliateEventStatusReady, CommissionCents: 456, CreatedAt: dayTwo + 40},
		{AffiliateUserId: 999, DownstreamUserId: 300, RuleSetId: 1, Status: model.AffiliateEventStatusPending, CommissionCents: 9999, CreatedAt: dayTwo + 50},
		{AffiliateUserId: 100, DownstreamUserId: 300, RuleSetId: 1, Status: model.AffiliateEventStatusVoid, CommissionCents: 9999, CreatedAt: dayTwo + 60},
	}).Error; err != nil {
		t.Fatalf("seed commission events: %v", err)
	}
	if err := db.Create(&[]model.AffiliateHeadFeeEvent{
		{AffiliateUserId: 100, DownstreamUserId: 200, RuleSetId: 1, Status: model.AffiliateEventStatusPending, AmountCents: 200, CreatedAt: dayOne + 45},
		{AffiliateUserId: 100, DownstreamUserId: 300, RuleSetId: 1, Status: model.AffiliateEventStatusReady, AmountCents: 300, CreatedAt: dayTwo + 45},
	}).Error; err != nil {
		t.Fatalf("seed head fee events: %v", err)
	}
	if err := db.Create(&[]model.AffiliateSettlement{
		{AffiliateUserId: 100, RuleSetId: 1, PeriodStart: dayOne, PeriodEnd: dayOne + 99, Status: model.AffiliateSettlementStatusDraft, PayableCents: 500, CreatedAt: dayOne + 70},
		{AffiliateUserId: 100, RuleSetId: 1, PeriodStart: dayTwo, PeriodEnd: dayTwo + 99, Status: model.AffiliateSettlementStatusPaid, PayableCents: 900, CreatedAt: dayTwo + 70},
	}).Error; err != nil {
		t.Fatalf("seed settlements: %v", err)
	}

	summary, err := BuildAffiliateDashboardSummary(db, db, AffiliateDashboardSummaryInput{
		Scope: AffiliateScope{
			Kind:           AffiliateScopeAffiliate,
			UserId:         100,
			AffiliateLevel: 1,
			MaxDepth:       1,
		},
		TrendStartTimestamp: dayOne,
		TrendEndTimestamp:   trendEnd,
		QuotaPerUnit:        1000,
		USDExchangeRate:     7,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateDashboardSummary returned error: %v", err)
	}

	if len(summary.DailyTrends) != 2 {
		t.Fatalf("expected two daily trend buckets, got %+v", summary.DailyTrends)
	}
	first := summary.DailyTrends[0]
	if first.PeriodStart != dayOne || first.PeriodEnd != dayOne+affiliateSecondsPerDay-1 || first.NetConsumptionQuota != 1000 || first.EffectiveNewUserCount != 1 {
		t.Fatalf("unexpected first trend bucket: %+v", first)
	}
	if math.Abs(first.NetConsumptionRMB-7) > 0.000001 || math.Abs(first.EstimatedCommissionRMB-1.23) > 0.000001 || math.Abs(first.HeadFeeRMB-2) > 0.000001 || math.Abs(first.PendingSettlementRMB-5) > 0.000001 {
		t.Fatalf("unexpected first trend money fields: %+v", first)
	}
	second := summary.DailyTrends[1]
	if second.PeriodStart != dayTwo || second.PeriodEnd != trendEnd || second.NetConsumptionQuota != 500 || second.EffectiveNewUserCount != 1 {
		t.Fatalf("unexpected second trend bucket: %+v", second)
	}
	if math.Abs(second.NetConsumptionRMB-3.5) > 0.000001 || math.Abs(second.EstimatedCommissionRMB-4.56) > 0.000001 || math.Abs(second.HeadFeeRMB-3) > 0.000001 || second.PendingSettlementRMB != 0 {
		t.Fatalf("unexpected second trend money fields: %+v", second)
	}
}

func TestBuildAffiliateDashboardSummaryGlobalUsesSnapshotsWithoutScanningLogs(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	dayOne := int64(1000)
	dayTwo := dayOne + affiliateSecondsPerDay
	trendEnd := dayTwo + affiliateSecondsPerDay - 1
	if err := db.Create(&[]model.AffiliateRelation{
		{AncestorUserId: 100, DescendantUserId: 200, Depth: 1, Status: model.AffiliateProfileStatusActive},
		{AncestorUserId: 100, DescendantUserId: 300, Depth: 2, Status: model.AffiliateProfileStatusActive},
		{AncestorUserId: 100, DescendantUserId: 400, Depth: 1, Status: model.AffiliateProfileStatusDisabled},
	}).Error; err != nil {
		t.Fatalf("seed relations: %v", err)
	}
	if err := db.Create(&[]model.AffiliateKPISnapshot{
		{AffiliateUserId: 100, RuleSetId: 1, PeriodStart: dayOne, PeriodEnd: dayOne + 99, EffectiveNewUserCount: 2, PaidConsumptionRawQuota: 1000, TierCode: "growth", CoefficientBps: 15000},
		{AffiliateUserId: 200, RuleSetId: 1, PeriodStart: dayTwo, PeriodEnd: dayTwo + 99, EffectiveNewUserCount: 1, PaidConsumptionRawQuota: 500, TierCode: "base", CoefficientBps: 12000},
		{AffiliateUserId: 300, RuleSetId: 1, PeriodStart: trendEnd + 1, PeriodEnd: trendEnd + 99, EffectiveNewUserCount: 9, PaidConsumptionRawQuota: 9000, TierCode: "ignored", CoefficientBps: 10000},
	}).Error; err != nil {
		t.Fatalf("seed kpi snapshots: %v", err)
	}
	if err := db.Create(&[]model.AffiliateCommissionEvent{
		{AffiliateUserId: 100, DownstreamUserId: 200, RuleSetId: 1, Status: model.AffiliateEventStatusPending, CommissionCents: 123, CreatedAt: dayOne + 40},
		{AffiliateUserId: 200, DownstreamUserId: 300, RuleSetId: 1, Status: model.AffiliateEventStatusReady, CommissionCents: 456, CreatedAt: dayTwo + 40},
		{AffiliateUserId: 100, DownstreamUserId: 300, RuleSetId: 1, Status: model.AffiliateEventStatusVoid, CommissionCents: 9999, CreatedAt: dayTwo + 60},
	}).Error; err != nil {
		t.Fatalf("seed commission events: %v", err)
	}
	if err := db.Create(&[]model.AffiliateHeadFeeEvent{
		{AffiliateUserId: 100, DownstreamUserId: 200, RuleSetId: 1, Status: model.AffiliateEventStatusPending, AmountCents: 200, CreatedAt: dayOne + 45},
		{AffiliateUserId: 200, DownstreamUserId: 300, RuleSetId: 1, Status: model.AffiliateEventStatusReady, AmountCents: 300, CreatedAt: dayTwo + 45},
	}).Error; err != nil {
		t.Fatalf("seed head fee events: %v", err)
	}
	if err := db.Create(&[]model.AffiliateSettlement{
		{AffiliateUserId: 100, RuleSetId: 1, PeriodStart: dayOne, PeriodEnd: dayOne + 99, Status: model.AffiliateSettlementStatusDraft, PayableCents: 700, CreatedAt: dayOne + 70},
		{AffiliateUserId: 200, RuleSetId: 1, PeriodStart: dayTwo, PeriodEnd: dayTwo + 99, Status: model.AffiliateSettlementStatusFrozen, PayableCents: 800, CreatedAt: dayTwo + 70},
		{AffiliateUserId: 100, RuleSetId: 1, PeriodStart: dayTwo, PeriodEnd: dayTwo + 99, Status: model.AffiliateSettlementStatusPaid, PayableCents: 900, CreatedAt: dayTwo + 80},
	}).Error; err != nil {
		t.Fatalf("seed settlements: %v", err)
	}
	removeQueryGuard := rejectUnboundedAffiliateLogQueries(t, db)
	defer removeQueryGuard()

	summary, err := BuildAffiliateDashboardSummary(db, db, AffiliateDashboardSummaryInput{
		Scope: AffiliateScope{
			Kind:   AffiliateScopeGlobal,
			UserId: 1,
		},
		StartTimestamp:      dayOne,
		EndTimestamp:        trendEnd,
		TrendStartTimestamp: dayOne,
		TrendEndTimestamp:   trendEnd,
		QuotaPerUnit:        1000,
		USDExchangeRate:     7,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateDashboardSummary returned error: %v", err)
	}

	if summary.TeamUserCount != 2 || summary.EffectiveNewUserCount != 3 || summary.NetConsumptionQuota != 1500 {
		t.Fatalf("unexpected global summary counts: %+v", summary)
	}
	if math.Abs(summary.NetConsumptionRMB-10.5) > 0.000001 || math.Abs(summary.EstimatedCommissionRMB-5.79) > 0.000001 || math.Abs(summary.HeadFeeRMB-5) > 0.000001 || math.Abs(summary.PendingSettlementRMB-15) > 0.000001 {
		t.Fatalf("unexpected global summary money fields: %+v", summary)
	}
	if len(summary.DailyTrends) != 2 {
		t.Fatalf("expected two global trend buckets, got %+v", summary.DailyTrends)
	}
	if summary.DailyTrends[0].EffectiveNewUserCount != 2 || summary.DailyTrends[0].NetConsumptionQuota != 1000 || math.Abs(summary.DailyTrends[0].PendingSettlementRMB-7) > 0.000001 {
		t.Fatalf("unexpected first global trend bucket: %+v", summary.DailyTrends[0])
	}
	if summary.DailyTrends[1].EffectiveNewUserCount != 1 || summary.DailyTrends[1].NetConsumptionQuota != 500 || math.Abs(summary.DailyTrends[1].PendingSettlementRMB-8) > 0.000001 {
		t.Fatalf("unexpected second global trend bucket: %+v", summary.DailyTrends[1])
	}
}

func TestBuildAffiliateDashboardSummaryDoesNotTreatInvitesAsEffectiveWithoutRules(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	seedAffiliateCommissionRelation(t, db, 100, 200, 1)
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 500, CreatedAt: 1100, Other: `{"quota_source":"paid"}`})

	summary, err := BuildAffiliateDashboardSummary(db, db, AffiliateDashboardSummaryInput{
		Scope: AffiliateScope{
			Kind:           AffiliateScopeAffiliate,
			UserId:         100,
			AffiliateLevel: 1,
			MaxDepth:       1,
		},
		StartTimestamp:  1000,
		EndTimestamp:    2000,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateDashboardSummary returned error: %v", err)
	}

	if summary.EffectiveNewUserCount != 0 {
		t.Fatalf("expected invites not to be counted as effective without published rules, got %+v", summary)
	}
}

func TestBuildAffiliateDashboardSummaryCountsOnlyQualifiedEffectiveNewUsers(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateHeadFeeRuleSetInput("summary-effective-new-users"))
	for _, userId := range []int{200, 300, 400, 500, 600, 700} {
		seedAffiliateCommissionRelation(t, db, 100, userId, 1)
	}
	seedAffiliateKPIInviteEvents(t, db, 100, []int{200, 300, 400, 500, 600, 700})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, Type: model.LogTypeConsume, Quota: 200, CreatedAt: 1100, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, Type: model.LogTypeConsume, Quota: 200, CreatedAt: 1100, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 300, Type: model.LogTypeRefund, Quota: 10, CreatedAt: 1200, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 400, Type: model.LogTypeConsume, Quota: 200, CreatedAt: 1100, Other: `{"quota_source":"paid","affiliate_abnormal":true}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 500, Type: model.LogTypeConsume, Quota: 50, CreatedAt: 1100, Other: `{"quota_source":"paid"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 600, Type: model.LogTypeConsume, Quota: 500, CreatedAt: 1100, Other: `{"quota_source":"gift"}`})
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 700, Type: model.LogTypeConsume, Quota: 200, CreatedAt: 1000 + 15*affiliateSecondsPerDay, Other: `{"quota_source":"paid"}`})

	summary, err := BuildAffiliateDashboardSummary(db, db, AffiliateDashboardSummaryInput{
		Scope: AffiliateScope{
			Kind:           AffiliateScopeAffiliate,
			UserId:         100,
			AffiliateLevel: 1,
			MaxDepth:       1,
		},
		StartTimestamp:  1000,
		EndTimestamp:    1000 + 30*affiliateSecondsPerDay,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliateDashboardSummary returned error: %v", err)
	}

	if summary.EffectiveNewUserCount != 1 {
		t.Fatalf("expected only the qualified paid invitee to count as effective, got %+v", summary)
	}
}

func TestBuildAffiliateDashboardSummaryRejectsNoneScope(t *testing.T) {
	db := newAffiliateStoreTestDB(t)

	if _, err := BuildAffiliateDashboardSummary(db, db, AffiliateDashboardSummaryInput{
		Scope: AffiliateScope{Kind: AffiliateScopeNone, UserId: 9},
	}); err == nil {
		t.Fatal("expected none scope dashboard summary to be rejected")
	}
}
