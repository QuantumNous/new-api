package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestBuildAffiliatePendingCommissionEventsCreatesPaidAccrual(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "commission-paid-accrual")
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 300, 1)
	log := seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 1100,
		Type:      model.LogTypeConsume,
		Quota:     1000,
		Other:     `{"quota_source":"paid"}`,
	})

	events, err := BuildAffiliatePendingCommissionEvents(db, db, AffiliateCommissionBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		QuotaPerUnit:    1000,
		USDExchangeRate: 7,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingCommissionEvents returned error: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one commission event, got %+v", events)
	}
	event := events[0]
	if event.RuleSetId != ruleSet.Id || event.AffiliateUserId != 100 || event.DownstreamUserId != 300 || event.SourceLogId != log.Id {
		t.Fatalf("unexpected event identity: %+v", event)
	}
	if event.Status != model.AffiliateEventStatusPending || event.Kind != AffiliateCommissionEventKindAccrual {
		t.Fatalf("unexpected event status/kind: %+v", event)
	}
	if event.RawQuota != 1000 || event.NetPaidConsumptionCents != 700 || event.CommissionCents != 84 {
		t.Fatalf("unexpected event amount: %+v", event)
	}
	if event.UserCumulativeNetPaidBeforeCents != 0 || event.UserCumulativeNetPaidAfterCents != 700 {
		t.Fatalf("unexpected cumulative cents: %+v", event)
	}
	if event.BaseRateBps != 1200 || event.CapRateBps != 3000 || event.KPICoefficientBps != 10000 || event.FinalRateBps != 1200 {
		t.Fatalf("unexpected rate fields: %+v", event)
	}
	if !strings.Contains(event.Metadata, `"rule_set_version":"commission-paid-accrual"`) {
		t.Fatalf("expected event metadata to record rule set version, got %q", event.Metadata)
	}
}

func TestBuildAffiliatePendingCommissionEventsSkipsNonPaidAndCreatesRefundClawback(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	savePublishedAffiliateCommissionRuleSet(t, db, "commission-paid-refund")
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 300, 1)
	seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 900,
		Type:      model.LogTypeConsume,
		Quota:     1000,
		Other:     `{"quota_source":"paid"}`,
	})
	seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 1100,
		Type:      model.LogTypeConsume,
		Quota:     1000,
		Other:     `{"quota_source":"gift"}`,
	})
	refund := seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 1200,
		Type:      model.LogTypeRefund,
		Quota:     500,
		Other:     `{"quota_source":"paid"}`,
	})

	events, err := BuildAffiliatePendingCommissionEvents(db, db, AffiliateCommissionBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		QuotaPerUnit:    1000,
		USDExchangeRate: 7,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingCommissionEvents returned error: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one clawback event, got %+v", events)
	}
	event := events[0]
	if event.SourceLogId != refund.Id || event.Kind != AffiliateCommissionEventKindClawback {
		t.Fatalf("expected refund clawback event, got %+v", event)
	}
	if event.RawQuota != -500 || event.NetPaidConsumptionCents != -350 || event.CommissionCents != -42 {
		t.Fatalf("unexpected clawback amount: %+v", event)
	}
	if event.UserCumulativeNetPaidBeforeCents != 700 || event.UserCumulativeNetPaidAfterCents != 350 {
		t.Fatalf("unexpected refund cumulative cents: %+v", event)
	}
}

func TestBuildAffiliatePendingCommissionEventsUsesCumulativeTierAndKPICoefficient(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	input := newAffiliateRuleSetDraftInput("commission-cumulative-tier")
	input.CommissionRules[0].DefaultRateBps = 1000
	input.CommissionRules[0].DefaultCapRateBps = 3000
	input.CommissionTiers = []AffiliateCommissionTierInput{
		{AffiliateLevel: 1, MinNetPaidAmountCents: 0, MaxNetPaidAmountCents: 999, BaseRateBps: 1000, CapRateBps: 3000, SortOrder: 1},
		{AffiliateLevel: 1, MinNetPaidAmountCents: 1000, MaxNetPaidAmountCents: 0, BaseRateBps: 2000, CapRateBps: 3000, SortOrder: 2},
		{AffiliateLevel: 2, MinNetPaidAmountCents: 0, MaxNetPaidAmountCents: 0, BaseRateBps: 600, CapRateBps: 1500, SortOrder: 1},
	}
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, input)
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 300, 1)
	seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 900,
		Type:      model.LogTypeConsume,
		Quota:     900,
		Other:     `{"quota_source":"paid"}`,
	})
	log := seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 1100,
		Type:      model.LogTypeConsume,
		Quota:     200,
		Other:     `{"quota_source":"paid"}`,
	})
	if err := db.Create(&model.AffiliateKPISnapshot{
		AffiliateUserId: 100,
		RuleSetId:       ruleSet.Id,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		TierCode:        "boost",
		CoefficientBps:  15000,
	}).Error; err != nil {
		t.Fatalf("seed kpi snapshot: %v", err)
	}

	events, err := BuildAffiliatePendingCommissionEvents(db, db, AffiliateCommissionBuildInput{
		PeriodStart:     1000,
		PeriodEnd:       2000,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingCommissionEvents returned error: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one commission event, got %+v", events)
	}
	event := events[0]
	if event.SourceLogId != log.Id {
		t.Fatalf("unexpected source log: %+v", event)
	}
	if event.UserCumulativeNetPaidBeforeCents != 900 || event.UserCumulativeNetPaidAfterCents != 1100 {
		t.Fatalf("unexpected cumulative tier tracking: %+v", event)
	}
	if event.BaseRateBps != 2000 || event.KPICoefficientBps != 15000 || event.FinalRateBps != 3000 {
		t.Fatalf("expected tier rate boosted and capped by KPI coefficient, got %+v", event)
	}
	if event.NetPaidConsumptionCents != 200 || event.CommissionCents != 60 {
		t.Fatalf("unexpected boosted commission amount: %+v", event)
	}
}

func newAffiliateCommissionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	name := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(append(model.AffiliateSidecarModels(), &model.Log{})...); err != nil {
		t.Fatalf("migrate affiliate/log models: %v", err)
	}
	return db
}

func savePublishedAffiliateCommissionRuleSet(t *testing.T, db *gorm.DB, version string) model.AffiliateRuleSet {
	t.Helper()
	return savePublishedAffiliateCommissionRuleSetFromInput(t, db, newAffiliateRuleSetDraftInput(version))
}

func savePublishedAffiliateCommissionRuleSetFromInput(t *testing.T, db *gorm.DB, input AffiliateRuleSetDraftInput) model.AffiliateRuleSet {
	t.Helper()
	ruleSet, err := SaveAffiliateRuleSetDraft(db, input)
	if err != nil {
		t.Fatalf("save rule set draft: %v", err)
	}
	published, err := PublishAffiliateRuleSet(db, ruleSet.Id, AffiliateRuleSetStatusInput{
		ActorUserId: 1,
		Reason:      "publish test rules",
	})
	if err != nil {
		t.Fatalf("publish rule set: %v", err)
	}
	return *published
}

func seedAffiliateCommissionProfileAndRelation(t *testing.T, db *gorm.DB, affiliateUserId int, downstreamUserId int, affiliateLevel int) {
	t.Helper()
	if err := db.Create(&model.AffiliateProfile{
		UserId: affiliateUserId,
		Level:  affiliateLevel,
		Status: model.AffiliateProfileStatusActive,
	}).Error; err != nil {
		t.Fatalf("seed affiliate profile: %v", err)
	}
	if err := db.Create(&model.AffiliateRelation{
		AncestorUserId:   affiliateUserId,
		DescendantUserId: downstreamUserId,
		Depth:            1,
		DirectInviterId:  affiliateUserId,
		Status:           model.AffiliateProfileStatusActive,
		EffectiveAt:      100,
	}).Error; err != nil {
		t.Fatalf("seed affiliate relation: %v", err)
	}
}

func seedAffiliateCommissionLog(t *testing.T, db *gorm.DB, log model.Log) model.Log {
	t.Helper()
	if err := db.Create(&log).Error; err != nil {
		t.Fatalf("seed log: %v", err)
	}
	return log
}
