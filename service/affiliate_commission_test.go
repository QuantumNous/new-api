package service

import (
	"errors"
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

func TestBuildAffiliatePendingCommissionEventsScansSourceLogsWithCursorLimit(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	restoreBatchSize := setAffiliateLogScanBatchSizeForTest(2)
	defer restoreBatchSize()
	removeQueryGuard := rejectUnboundedAffiliateLogQueries(t, db)
	defer removeQueryGuard()

	savePublishedAffiliateCommissionRuleSet(t, db, "commission-cursor-scan")
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 300, 1)
	for i := 0; i < 3; i++ {
		seedAffiliateCommissionLog(t, db, model.Log{
			UserId:    300,
			CreatedAt: int64(1100 + i),
			Type:      model.LogTypeConsume,
			Quota:     100,
			Other:     `{"quota_source":"paid"}`,
		})
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
	if len(events) != 3 {
		t.Fatalf("expected three commission events from cursor scan, got %+v", events)
	}
}

func TestBuildAffiliatePendingCommissionEventsUsesLegacyDirectInviter(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	ruleSet := savePublishedAffiliateCommissionRuleSet(t, db, "commission-legacy-direct-inviter")
	if err := db.Create(&model.User{Id: 100, Username: "level-one", AffCode: "AFF100"}).Error; err != nil {
		t.Fatalf("seed affiliate user: %v", err)
	}
	if err := db.Create(&model.User{Id: 300, Username: "normal-downstream", InviterId: 100, AffCode: "AFF300"}).Error; err != nil {
		t.Fatalf("seed downstream user: %v", err)
	}
	if err := db.Create(&model.AffiliateProfile{
		UserId: 100,
		Level:  1,
		Status: model.AffiliateProfileStatusActive,
	}).Error; err != nil {
		t.Fatalf("seed affiliate profile: %v", err)
	}
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
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingCommissionEvents returned error: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one commission event from legacy inviter chain, got %+v", events)
	}
	event := events[0]
	if event.RuleSetId != ruleSet.Id || event.AffiliateUserId != 100 || event.DownstreamUserId != 300 || event.SourceLogId != log.Id {
		t.Fatalf("unexpected legacy inviter event identity: %+v", event)
	}
	if event.NetPaidConsumptionCents != 100 || event.CommissionCents != 12 {
		t.Fatalf("unexpected legacy inviter event amount: %+v", event)
	}
}

func TestBuildAffiliatePendingCommissionEventsSkipsDisabledCommissionRuleLevel(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	input := newAffiliateRuleSetDraftInput("commission-disabled-level")
	input.CommissionRules[0].Status = model.AffiliateProfileStatusActive
	input.CommissionRules[1].Status = model.AffiliateProfileStatusDisabled
	ruleSet := savePublishedAffiliateCommissionRuleSetFromInput(t, db, input)
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 200, 1)
	seedAffiliateCommissionRelation(t, db, 300, 200, 2)
	seedAffiliateCommissionLog(t, db, model.Log{UserId: 200, CreatedAt: 1000, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})

	events, err := BuildAffiliatePendingCommissionEvents(db, db, AffiliateCommissionBuildInput{
		RuleSetId:       ruleSet.Id,
		PeriodStart:     900,
		PeriodEnd:       1100,
		QuotaPerUnit:    100,
		USDExchangeRate: 1,
	})
	if err != nil {
		t.Fatalf("BuildAffiliatePendingCommissionEvents returned error: %v", err)
	}
	if len(events) != 1 || events[0].AffiliateUserId != 100 {
		t.Fatalf("expected only active level one commission event, got %+v", events)
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

func TestBuildAffiliatePendingCommissionEventsUsesQuotaSourceSidecarPaidPortion(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	savePublishedAffiliateCommissionRuleSet(t, db, "commission-quota-source-sidecar")
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 300, 1)
	log := seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 1100,
		Type:      model.LogTypeConsume,
		Quota:     1000,
	})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      300,
		Source:      AffiliateQuotaSourcePaid,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      400,
		SourceLogId: log.Id,
	})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      300,
		Source:      AffiliateQuotaSourceGift,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      600,
		SourceLogId: log.Id,
	})
	giftTaggedLog := seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 1150,
		Type:      model.LogTypeConsume,
		Quota:     500,
		Other:     `{"quota_source":"gift"}`,
	})
	seedAffiliateQuotaSourceEvent(t, db, model.UserQuotaSourceEvent{
		UserId:      300,
		Source:      AffiliateQuotaSourcePaid,
		EventType:   model.QuotaSourceEventDebit,
		Amount:      500,
		SourceLogId: giftTaggedLog.Id,
	})
	seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 1200,
		Type:      model.LogTypeConsume,
		Quota:     500,
	})

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
		t.Fatalf("expected one commission event from sidecar paid portion, got %+v", events)
	}
	event := events[0]
	if event.SourceLogId != log.Id || event.RawQuota != 400 || event.NetPaidConsumptionCents != 400 || event.CommissionCents != 48 {
		t.Fatalf("expected sidecar paid portion only to be commissioned, got %+v", event)
	}
}

func TestBuildAffiliatePendingCommissionEventsUsesOnlyPaidFromMixedSourcesAndPartialRefund(t *testing.T) {
	db := newAffiliateCommissionTestDB(t)
	savePublishedAffiliateCommissionRuleSet(t, db, "commission-mixed-source-partial-refund")
	seedAffiliateCommissionProfileAndRelation(t, db, 100, 300, 1)
	consumeLog := seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 1100,
		Type:      model.LogTypeConsume,
		Quota:     1000,
	})
	for _, event := range []model.UserQuotaSourceEvent{
		{UserId: 300, Source: AffiliateQuotaSourcePaid, EventType: model.QuotaSourceEventDebit, Amount: 300, SourceLogId: consumeLog.Id},
		{UserId: 300, Source: AffiliateQuotaSourceGift, EventType: model.QuotaSourceEventDebit, Amount: 200, SourceLogId: consumeLog.Id},
		{UserId: 300, Source: AffiliateQuotaSourceTrial, EventType: model.QuotaSourceEventDebit, Amount: 250, SourceLogId: consumeLog.Id},
		{UserId: 300, Source: model.QuotaSourceLegacyUnknown, EventType: model.QuotaSourceEventDebit, Amount: 250, SourceLogId: consumeLog.Id},
	} {
		seedAffiliateQuotaSourceEvent(t, db, event)
	}
	seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 1150,
		Type:      model.LogTypeConsume,
		Quota:     500,
		Other:     `{"quota_source":"trial"}`,
	})
	seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 1180,
		Type:      model.LogTypeConsume,
		Quota:     500,
	})
	refundLog := seedAffiliateCommissionLog(t, db, model.Log{
		UserId:    300,
		CreatedAt: 1200,
		Type:      model.LogTypeRefund,
		Quota:     200,
	})
	for _, event := range []model.UserQuotaSourceEvent{
		{UserId: 300, Source: AffiliateQuotaSourcePaid, EventType: model.QuotaSourceEventRefund, Amount: 100, SourceLogId: refundLog.Id},
		{UserId: 300, Source: AffiliateQuotaSourceGift, EventType: model.QuotaSourceEventRefund, Amount: 100, SourceLogId: refundLog.Id},
	} {
		seedAffiliateQuotaSourceEvent(t, db, event)
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
	if len(events) != 2 {
		t.Fatalf("expected accrual and partial refund clawback only, got %+v", events)
	}
	accrual := events[0]
	if accrual.SourceLogId != consumeLog.Id || accrual.Kind != AffiliateCommissionEventKindAccrual {
		t.Fatalf("expected first event to be mixed-source paid accrual, got %+v", accrual)
	}
	if accrual.RawQuota != 300 || accrual.NetPaidConsumptionCents != 300 || accrual.CommissionCents != 36 {
		t.Fatalf("expected only paid sidecar portion to accrue commission, got %+v", accrual)
	}
	clawback := events[1]
	if clawback.SourceLogId != refundLog.Id || clawback.Kind != AffiliateCommissionEventKindClawback {
		t.Fatalf("expected second event to be partial paid refund clawback, got %+v", clawback)
	}
	if clawback.RawQuota != -100 || clawback.NetPaidConsumptionCents != -100 || clawback.CommissionCents != -12 {
		t.Fatalf("expected only paid refund sidecar portion to claw back commission, got %+v", clawback)
	}
	if clawback.UserCumulativeNetPaidBeforeCents != 300 || clawback.UserCumulativeNetPaidAfterCents != 200 {
		t.Fatalf("unexpected cumulative cents after partial refund: %+v", clawback)
	}
}

func newAffiliateCommissionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	name := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := append(model.AffiliateSidecarModels(), model.QuotaSourceSidecarModels()...)
	models = append(models, &model.Log{}, &model.User{})
	if err := db.AutoMigrate(models...); err != nil {
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

func setAffiliateLogScanBatchSizeForTest(size int) func() {
	original := affiliateLogScanBatchSize
	affiliateLogScanBatchSize = size
	return func() {
		affiliateLogScanBatchSize = original
	}
}

func rejectUnboundedAffiliateLogQueries(t *testing.T, db *gorm.DB) func() {
	t.Helper()
	callbackName := "reject_unbounded_affiliate_log_queries_" + strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	if err := db.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Table != "logs" {
			return
		}
		if _, ok := tx.Statement.Clauses["LIMIT"]; !ok {
			tx.AddError(errors.New("unbounded logs query without LIMIT"))
		}
	}); err != nil {
		t.Fatalf("register unbounded log query guard: %v", err)
	}
	return func() {
		_ = db.Callback().Query().Remove(callbackName)
	}
}

func seedAffiliateQuotaSourceEvent(t *testing.T, db *gorm.DB, event model.UserQuotaSourceEvent) model.UserQuotaSourceEvent {
	t.Helper()
	if err := db.Create(&event).Error; err != nil {
		t.Fatalf("seed quota source event: %v", err)
	}
	return event
}
