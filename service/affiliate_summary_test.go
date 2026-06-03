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
	if summary.EffectiveNewUserCount != 2 {
		t.Fatalf("expected two effective affiliate invitees, got %+v", summary)
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

func TestBuildAffiliateDashboardSummaryRejectsNoneScope(t *testing.T) {
	db := newAffiliateStoreTestDB(t)

	if _, err := BuildAffiliateDashboardSummary(db, db, AffiliateDashboardSummaryInput{
		Scope: AffiliateScope{Kind: AffiliateScopeNone, UserId: 9},
	}); err == nil {
		t.Fatal("expected none scope dashboard summary to be rejected")
	}
}
