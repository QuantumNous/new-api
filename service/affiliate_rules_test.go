package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

func TestSaveAffiliateRuleSetDraftPersistsConfigAndAudit(t *testing.T) {
	db := newAffiliateStoreTestDB(t)

	ruleSet, err := SaveAffiliateRuleSetDraft(db, newAffiliateRuleSetDraftInput("rules-2026-06"))
	if err != nil {
		t.Fatalf("SaveAffiliateRuleSetDraft returned error: %v", err)
	}
	if ruleSet.Id <= 0 || ruleSet.Status != model.AffiliateRuleSetStatusDraft {
		t.Fatalf("expected saved draft rule set, got %+v", ruleSet)
	}
	if ruleSet.ConfigSnapshot == "" || !strings.Contains(ruleSet.ConfigSnapshot, `"settlement_cycle":"monthly"`) {
		t.Fatalf("expected config snapshot to include settlement config, got %q", ruleSet.ConfigSnapshot)
	}

	assertAffiliateRuleSetChildCount(t, db, &model.AffiliateCommissionRule{}, ruleSet.Id, 2)
	assertAffiliateRuleSetChildCount(t, db, &model.AffiliateCommissionTier{}, ruleSet.Id, 2)
	assertAffiliateRuleSetChildCount(t, db, &model.AffiliateKPITier{}, ruleSet.Id, 2)
	assertAffiliateRuleSetChildCount(t, db, &model.AffiliateHeadFeeRule{}, ruleSet.Id, 2)
	assertAffiliateRuleSetChildCount(t, db, &model.AffiliateRiskRule{}, ruleSet.Id, 2)

	var auditCount int64
	if err := db.Model(&model.AffiliateConfigAuditLog{}).
		Where("rule_set_id = ? AND action = ?", ruleSet.Id, AffiliateConfigAuditActionCreateRuleSet).
		Count(&auditCount).Error; err != nil {
		t.Fatalf("count config audit logs: %v", err)
	}
	if auditCount != 1 {
		t.Fatalf("expected one create audit log, got %d", auditCount)
	}
}

func TestSaveAffiliateRuleSetDraftRejectsPublishedOrArchivedOverwrite(t *testing.T) {
	db := newAffiliateStoreTestDB(t)

	publishedDraft, err := SaveAffiliateRuleSetDraft(db, newAffiliateRuleSetDraftInput("rules-published-immutable"))
	if err != nil {
		t.Fatalf("save published seed draft: %v", err)
	}
	published, err := PublishAffiliateRuleSet(db, publishedDraft.Id, AffiliateRuleSetStatusInput{
		ActorUserId: 1,
		Reason:      "publish immutable seed",
	})
	if err != nil {
		t.Fatalf("publish seed draft: %v", err)
	}

	archivedDraft, err := SaveAffiliateRuleSetDraft(db, newAffiliateRuleSetDraftInput("rules-archived-immutable"))
	if err != nil {
		t.Fatalf("save archived seed draft: %v", err)
	}
	archived, err := ArchiveAffiliateRuleSet(db, archivedDraft.Id, AffiliateRuleSetStatusInput{
		ActorUserId: 1,
		Reason:      "archive immutable seed",
	})
	if err != nil {
		t.Fatalf("archive seed draft: %v", err)
	}

	tests := []struct {
		name      string
		input     AffiliateRuleSetDraftInput
		wantError string
	}{
		{
			name: "published id overwrite",
			input: func() AffiliateRuleSetDraftInput {
				input := newAffiliateRuleSetDraftInput("rules-published-immutable-id")
				input.Id = published.Id
				return input
			}(),
			wantError: "only draft affiliate rule set can be edited",
		},
		{
			name:      "published version overwrite",
			input:     newAffiliateRuleSetDraftInput(published.Version),
			wantError: "affiliate rule set version already exists",
		},
		{
			name: "archived id overwrite",
			input: func() AffiliateRuleSetDraftInput {
				input := newAffiliateRuleSetDraftInput("rules-archived-immutable-id")
				input.Id = archived.Id
				return input
			}(),
			wantError: "only draft affiliate rule set can be edited",
		},
		{
			name:      "archived version overwrite",
			input:     newAffiliateRuleSetDraftInput(archived.Version),
			wantError: "affiliate rule set version already exists",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := SaveAffiliateRuleSetDraft(db, tt.input)
			if err == nil {
				t.Fatalf("expected immutable rule set overwrite error containing %q", tt.wantError)
			}
			if !strings.Contains(err.Error(), tt.wantError) {
				t.Fatalf("expected error containing %q, got %v", tt.wantError, err)
			}
		})
	}

	var unchanged model.AffiliateRuleSet
	if err := db.Where("id = ?", published.Id).First(&unchanged).Error; err != nil {
		t.Fatalf("query published rule set: %v", err)
	}
	if unchanged.Status != model.AffiliateRuleSetStatusPublished || unchanged.Version != published.Version {
		t.Fatalf("published rule set should remain immutable, got %+v", unchanged)
	}
	unchanged = model.AffiliateRuleSet{}
	if err := db.Where("id = ?", archived.Id).First(&unchanged).Error; err != nil {
		t.Fatalf("query archived rule set: %v", err)
	}
	if unchanged.Status != model.AffiliateRuleSetStatusArchived || unchanged.Version != archived.Version {
		t.Fatalf("archived rule set should remain immutable, got %+v", unchanged)
	}
}

func TestSaveAffiliateRuleSetDraftValidatesBusinessBounds(t *testing.T) {
	tests := []struct {
		name      string
		mutate    func(*AffiliateRuleSetDraftInput)
		wantError string
	}{
		{
			name: "rejects level one commission cap above thirty percent",
			mutate: func(input *AffiliateRuleSetDraftInput) {
				input.CommissionRules[0].DefaultCapRateBps = 3001
			},
			wantError: "level one commission cap",
		},
		{
			name: "rejects level one tier cap above thirty percent",
			mutate: func(input *AffiliateRuleSetDraftInput) {
				input.CommissionTiers[0].CapRateBps = 3001
			},
			wantError: "level one commission cap",
		},
		{
			name: "rejects level two commission cap inversion",
			mutate: func(input *AffiliateRuleSetDraftInput) {
				input.CommissionRules[1].DefaultCapRateBps = 3500
			},
			wantError: "level two commission cap",
		},
		{
			name: "rejects kpi coefficient below one",
			mutate: func(input *AffiliateRuleSetDraftInput) {
				input.KPITiers[0].CoefficientBps = 9999
			},
			wantError: "kpi coefficient",
		},
		{
			name: "rejects non base kpi coefficient equal one",
			mutate: func(input *AffiliateRuleSetDraftInput) {
				input.KPITiers = append(input.KPITiers, AffiliateKPITierInput{
					AffiliateLevel:        1,
					Code:                  "growth",
					Name:                  "Growth",
					MinEffectiveNewUsers:  10,
					MinNetPaidAmountCents: 100000,
					CoefficientBps:        10000,
					SortOrder:             2,
				})
			},
			wantError: "kpi coefficient",
		},
		{
			name: "rejects invalid effective window",
			mutate: func(input *AffiliateRuleSetDraftInput) {
				input.EffectiveEnd = input.EffectiveStart - 1
			},
			wantError: "effective window",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newAffiliateStoreTestDB(t)
			input := newAffiliateRuleSetDraftInput("rules-" + strings.ReplaceAll(tt.name, " ", "-"))
			tt.mutate(&input)

			_, err := SaveAffiliateRuleSetDraft(db, input)
			if err == nil {
				t.Fatalf("expected validation error containing %q", tt.wantError)
			}
			if !strings.Contains(err.Error(), tt.wantError) {
				t.Fatalf("expected error containing %q, got %v", tt.wantError, err)
			}
		})
	}
}

func TestPublishAffiliateRuleSetArchivesPreviousPublished(t *testing.T) {
	db := newAffiliateStoreTestDB(t)

	first, err := SaveAffiliateRuleSetDraft(db, newAffiliateRuleSetDraftInput("rules-2026-06"))
	if err != nil {
		t.Fatalf("save first draft: %v", err)
	}
	if _, err := PublishAffiliateRuleSet(db, first.Id, AffiliateRuleSetStatusInput{
		ActorUserId: 1,
		Reason:      "first publish",
	}); err != nil {
		t.Fatalf("publish first draft: %v", err)
	}
	second, err := SaveAffiliateRuleSetDraft(db, newAffiliateRuleSetDraftInput("rules-2026-07"))
	if err != nil {
		t.Fatalf("save second draft: %v", err)
	}
	published, err := PublishAffiliateRuleSet(db, second.Id, AffiliateRuleSetStatusInput{
		ActorUserId: 2,
		Reason:      "replace rules",
	})
	if err != nil {
		t.Fatalf("publish second draft: %v", err)
	}
	if published.Status != model.AffiliateRuleSetStatusPublished || published.PublishedAt == 0 {
		t.Fatalf("expected published second rule set, got %+v", published)
	}

	var archivedFirst model.AffiliateRuleSet
	if err := db.Where("id = ?", first.Id).First(&archivedFirst).Error; err != nil {
		t.Fatalf("query first rule set: %v", err)
	}
	if archivedFirst.Status != model.AffiliateRuleSetStatusArchived {
		t.Fatalf("expected previous published rule set to be archived, got %+v", archivedFirst)
	}

	var publishAuditCount int64
	if err := db.Model(&model.AffiliateConfigAuditLog{}).
		Where("action = ?", AffiliateConfigAuditActionPublishRuleSet).
		Count(&publishAuditCount).Error; err != nil {
		t.Fatalf("count publish audit logs: %v", err)
	}
	if publishAuditCount != 2 {
		t.Fatalf("expected two publish audit logs, got %d", publishAuditCount)
	}
}

func TestPublishAffiliateRuleSetRevalidatesPersistedConfig(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	ruleSet := model.AffiliateRuleSet{
		Version:        "rules-invalid-persisted",
		Name:           "Invalid Persisted Rules",
		Status:         model.AffiliateRuleSetStatusDraft,
		EffectiveStart: 1000,
		EffectiveEnd:   2000,
		ConfigSnapshot: buildAffiliateRuleSetConfigSnapshot(newAffiliateRuleSetDraftInput("rules-invalid-persisted")),
	}
	if err := db.Create(&ruleSet).Error; err != nil {
		t.Fatalf("seed rule set: %v", err)
	}
	if err := db.Create(&model.AffiliateCommissionRule{
		RuleSetId:         ruleSet.Id,
		AffiliateLevel:    1,
		Name:              "Invalid Level 1",
		Status:            model.AffiliateProfileStatusActive,
		Currency:          "CNY",
		DefaultRateBps:    1200,
		DefaultCapRateBps: 4000,
		CalculationMode:   "single_user_net_paid_tier",
	}).Error; err != nil {
		t.Fatalf("seed invalid commission rule: %v", err)
	}

	_, err := PublishAffiliateRuleSet(db, ruleSet.Id, AffiliateRuleSetStatusInput{
		ActorUserId: 1,
		Reason:      "should reject",
	})
	if err == nil {
		t.Fatal("expected publish to reject persisted invalid config")
	}
	if !strings.Contains(err.Error(), "level one commission cap") {
		t.Fatalf("expected level one cap error, got %v", err)
	}

	var unchanged model.AffiliateRuleSet
	if err := db.Where("id = ?", ruleSet.Id).First(&unchanged).Error; err != nil {
		t.Fatalf("query rule set: %v", err)
	}
	if unchanged.Status != model.AffiliateRuleSetStatusDraft {
		t.Fatalf("expected invalid rule set to remain draft, got %+v", unchanged)
	}
}

func TestArchiveAffiliateRuleSetSetsArchivedAndAudits(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	ruleSet, err := SaveAffiliateRuleSetDraft(db, newAffiliateRuleSetDraftInput("rules-2026-08"))
	if err != nil {
		t.Fatalf("save draft: %v", err)
	}

	archived, err := ArchiveAffiliateRuleSet(db, ruleSet.Id, AffiliateRuleSetStatusInput{
		ActorUserId: 1,
		Reason:      "stop rules",
	})
	if err != nil {
		t.Fatalf("ArchiveAffiliateRuleSet returned error: %v", err)
	}
	if archived.Status != model.AffiliateRuleSetStatusArchived {
		t.Fatalf("expected archived rule set, got %+v", archived)
	}

	var auditCount int64
	if err := db.Model(&model.AffiliateConfigAuditLog{}).
		Where("rule_set_id = ? AND action = ?", ruleSet.Id, AffiliateConfigAuditActionArchiveRuleSet).
		Count(&auditCount).Error; err != nil {
		t.Fatalf("count archive audit logs: %v", err)
	}
	if auditCount != 1 {
		t.Fatalf("expected one archive audit log, got %d", auditCount)
	}
}

func newAffiliateRuleSetDraftInput(version string) AffiliateRuleSetDraftInput {
	return AffiliateRuleSetDraftInput{
		Version:        version,
		Name:           "2026 Native Affiliate Rules",
		EffectiveStart: 1000,
		EffectiveEnd:   2000,
		ActorUserId:    1,
		Reason:         "test rules",
		CommissionRules: []AffiliateCommissionRuleInput{
			{AffiliateLevel: 1, Name: "Level 1", DefaultRateBps: 1200, DefaultCapRateBps: 3000, MinSettlementAmountCents: 10000, AllowManualApprovalRate: true},
			{AffiliateLevel: 2, Name: "Level 2", DefaultRateBps: 600, DefaultCapRateBps: 1500, MinSettlementAmountCents: 10000, AllowManualApprovalRate: false},
		},
		CommissionTiers: []AffiliateCommissionTierInput{
			{AffiliateLevel: 1, MinNetPaidAmountCents: 0, MaxNetPaidAmountCents: 0, BaseRateBps: 1200, CapRateBps: 3000, SortOrder: 1},
			{AffiliateLevel: 2, MinNetPaidAmountCents: 0, MaxNetPaidAmountCents: 0, BaseRateBps: 600, CapRateBps: 1500, SortOrder: 1},
		},
		KPITiers: []AffiliateKPITierInput{
			{AffiliateLevel: 1, Code: "base", Name: "Base", MinEffectiveNewUsers: 1, MinNetPaidAmountCents: 10000, CoefficientBps: 10000, MaxGiftOnlyRatioBps: 5000, MaxAbnormalRatioBps: 1000, MinSecondPaymentRatioBps: 0, SortOrder: 1},
			{AffiliateLevel: 2, Code: "base", Name: "Base", MinEffectiveNewUsers: 1, MinNetPaidAmountCents: 10000, CoefficientBps: 10000, MaxGiftOnlyRatioBps: 5000, MaxAbnormalRatioBps: 1000, MinSecondPaymentRatioBps: 0, SortOrder: 1},
		},
		HeadFeeRules: []AffiliateHeadFeeRuleInput{
			{AffiliateLevel: 1, KPITierCode: "base", AmountCents: 1000, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 500, QualificationDays: 14, UnlockDelayDays: 7},
			{AffiliateLevel: 2, KPITierCode: "base", AmountCents: 500, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 500, QualificationDays: 14, UnlockDelayDays: 7},
		},
		RiskRules: []AffiliateRiskRuleInput{
			{AffiliateLevel: 1, Code: "default", MaxGiftOnlyRatioBps: 5000, MaxAbnormalRatioBps: 1000, MaxRefundRatioBps: 1000, MinSecondPaymentRatioBps: 0},
			{AffiliateLevel: 2, Code: "default", MaxGiftOnlyRatioBps: 5000, MaxAbnormalRatioBps: 1000, MaxRefundRatioBps: 1000, MinSecondPaymentRatioBps: 0},
		},
		SettlementConfig: AffiliateSettlementRuleConfig{
			Cycle:                    "monthly",
			FreezeDays:               7,
			MinSettlementAmountCents: 10000,
			ManualReviewEnabled:      true,
		},
	}
}

func assertAffiliateRuleSetChildCount(t *testing.T, db *gorm.DB, modelValue interface{}, ruleSetId int, want int64) {
	t.Helper()
	var count int64
	if err := db.Model(modelValue).Where("rule_set_id = ?", ruleSetId).Count(&count).Error; err != nil {
		t.Fatalf("count child rows for rule set %d: %v", ruleSetId, err)
	}
	if count != want {
		t.Fatalf("expected %d child rows for rule set %d, got %d", want, ruleSetId, count)
	}
}
