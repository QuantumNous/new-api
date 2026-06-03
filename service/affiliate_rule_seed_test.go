package service

import (
	"sort"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestDefaultAffiliateRuleSetSeedUsesOperationalUnitConversions(t *testing.T) {
	seed := BuildDefaultAffiliateRuleSetDraftInput("native-default-seed-units", 17, "seed smoke")

	if seed.Version != "native-default-seed-units" || seed.Name != "Native Affiliate Rules" {
		t.Fatalf("unexpected seed identity: %+v", seed)
	}
	if seed.SettlementConfig.Cycle != "monthly" ||
		seed.SettlementConfig.FreezeDays != 7 ||
		seed.SettlementConfig.MinSettlementAmountCents != 10000 ||
		!seed.SettlementConfig.ManualReviewEnabled ||
		!seed.SettlementConfig.AutoSettlementEnabled ||
		seed.SettlementConfig.ReviewNote != "" {
		t.Fatalf("unexpected settlement config: %+v", seed.SettlementConfig)
	}

	levelOneRule := findSeedCommissionRule(t, seed, 1)
	if levelOneRule.Status != model.AffiliateProfileStatusActive || levelOneRule.DefaultRateBps != 2000 || levelOneRule.DefaultCapRateBps != 3000 || levelOneRule.MinSettlementAmountCents != 10000 {
		t.Fatalf("unexpected level one commission rule: %+v", levelOneRule)
	}
	levelTwoRule := findSeedCommissionRule(t, seed, 2)
	if levelTwoRule.Status != model.AffiliateProfileStatusActive || levelTwoRule.DefaultRateBps != 1000 || levelTwoRule.DefaultCapRateBps != 2000 || levelTwoRule.MinSettlementAmountCents != 10000 {
		t.Fatalf("unexpected level two commission rule: %+v", levelTwoRule)
	}

	levelOneMidTier := findSeedCommissionTier(t, seed, 1, 20000)
	if levelOneMidTier.MaxNetPaidAmountCents != 80000 || levelOneMidTier.BaseRateBps != 1333 || levelOneMidTier.CapRateBps != 2000 {
		t.Fatalf("unexpected level one 200-800 yuan tier: %+v", levelOneMidTier)
	}
	levelOneOpenTier := findSeedCommissionTier(t, seed, 1, 500000)
	if levelOneOpenTier.MaxNetPaidAmountCents != 0 || levelOneOpenTier.BaseRateBps != 200 || levelOneOpenTier.CapRateBps != 500 || !levelOneOpenTier.RequiresManualApproval {
		t.Fatalf("unexpected level one 5000+ yuan tier: %+v", levelOneOpenTier)
	}
	levelTwoBaseTier := findSeedCommissionTier(t, seed, 2, 0)
	if levelTwoBaseTier.MaxNetPaidAmountCents != 20000 || levelTwoBaseTier.BaseRateBps != 1000 || levelTwoBaseTier.CapRateBps != 2000 {
		t.Fatalf("unexpected level two 0-200 yuan tier: %+v", levelTwoBaseTier)
	}

	qualifiedKPI := findSeedKPITier(t, seed, 1, "qualified")
	if qualifiedKPI.MinEffectiveNewUsers != 30 || qualifiedKPI.MinNetPaidAmountCents != 150000 || qualifiedKPI.CoefficientBps != 12000 {
		t.Fatalf("unexpected level one qualified KPI tier: %+v", qualifiedKPI)
	}
	baseKPI := findSeedKPITier(t, seed, 2, "base")
	if baseKPI.MinEffectiveNewUsers != 10 || baseKPI.MinNetPaidAmountCents != 20000 || baseKPI.CoefficientBps != 14000 {
		t.Fatalf("unexpected level two base KPI tier: %+v", baseKPI)
	}

	excellentHeadFee := findSeedHeadFeeRule(t, seed, 1, "excellent")
	if excellentHeadFee.AmountCents != 200 || excellentHeadFee.FirstRechargeMinCents != 1000 || excellentHeadFee.PeriodNetPaidMinCents != 1000 || excellentHeadFee.QualificationDays != 14 {
		t.Fatalf("unexpected level one excellent head fee rule: %+v", excellentHeadFee)
	}
	levelTwoRisk := findSeedRiskRule(t, seed, 2, "default")
	if levelTwoRisk.MaxGiftOnlyRatioBps != 3000 ||
		levelTwoRisk.MaxAbnormalRatioBps != 1000 ||
		levelTwoRisk.MaxRefundRatioBps != 1000 ||
		levelTwoRisk.SelfBrushStrategy != affiliateRiskSelfBrushStrategy ||
		levelTwoRisk.BulkAbuseStrategy != affiliateRiskBulkAbuseStrategy ||
		levelTwoRisk.Action != affiliateRiskAction {
		t.Fatalf("unexpected level two risk rule: %+v", levelTwoRisk)
	}
}

func TestDefaultAffiliateRuleSetSeedCommissionTiersHaveNoOverlapAndNoGap(t *testing.T) {
	seed := BuildDefaultAffiliateRuleSetDraftInput("native-default-seed-intervals", 17, "seed smoke")

	for _, level := range []int{1, 2} {
		tiers := make([]AffiliateCommissionTierInput, 0, len(seed.CommissionTiers))
		for _, tier := range seed.CommissionTiers {
			if tier.AffiliateLevel == level {
				tiers = append(tiers, tier)
			}
		}
		sort.Slice(tiers, func(i, j int) bool {
			return tiers[i].MinNetPaidAmountCents < tiers[j].MinNetPaidAmountCents
		})
		if len(tiers) != 5 {
			t.Fatalf("expected five commission tiers for level %d, got %d: %+v", level, len(tiers), tiers)
		}

		var wantMin int64
		for index, tier := range tiers {
			if tier.MinNetPaidAmountCents != wantMin {
				t.Fatalf("level %d tier %d starts at %d, want %d: %+v", level, index+1, tier.MinNetPaidAmountCents, wantMin, tiers)
			}
			if tier.MaxNetPaidAmountCents == 0 {
				if index != len(tiers)-1 {
					t.Fatalf("level %d open-ended tier must be last: %+v", level, tiers)
				}
				continue
			}
			if tier.MaxNetPaidAmountCents <= tier.MinNetPaidAmountCents {
				t.Fatalf("level %d tier max must be greater than min: %+v", level, tier)
			}
			wantMin = tier.MaxNetPaidAmountCents
		}
	}
}

func TestDefaultAffiliateRuleSetSeedCanBePublishedAndRemainImmutable(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	seed := BuildDefaultAffiliateRuleSetDraftInput("native-default-seed-immutable", 17, "seed smoke")

	draft, err := SaveAffiliateRuleSetDraft(db, seed)
	if err != nil {
		t.Fatalf("save default seed draft: %v", err)
	}
	assertAffiliateRuleSetChildCount(t, db, &model.AffiliateCommissionRule{}, draft.Id, 2)
	assertAffiliateRuleSetChildCount(t, db, &model.AffiliateCommissionTier{}, draft.Id, 10)
	assertAffiliateRuleSetChildCount(t, db, &model.AffiliateKPITier{}, draft.Id, 8)
	assertAffiliateRuleSetChildCount(t, db, &model.AffiliateHeadFeeRule{}, draft.Id, 8)
	assertAffiliateRuleSetChildCount(t, db, &model.AffiliateRiskRule{}, draft.Id, 2)

	published, err := PublishAffiliateRuleSet(db, draft.Id, AffiliateRuleSetStatusInput{
		ActorUserId: 17,
		Reason:      "publish default seed",
	})
	if err != nil {
		t.Fatalf("publish default seed draft: %v", err)
	}

	overwrite := BuildDefaultAffiliateRuleSetDraftInput("native-default-seed-immutable-overwrite", 18, "should reject")
	overwrite.Id = published.Id
	_, err = SaveAffiliateRuleSetDraft(db, overwrite)
	if err == nil || !strings.Contains(err.Error(), "only draft affiliate rule set can be edited") {
		t.Fatalf("expected published rule set id overwrite to be rejected, got %v", err)
	}

	duplicate := BuildDefaultAffiliateRuleSetDraftInput(published.Version, 18, "should reject")
	_, err = SaveAffiliateRuleSetDraft(db, duplicate)
	if err == nil || !strings.Contains(err.Error(), "affiliate rule set version already exists") {
		t.Fatalf("expected published rule set version overwrite to be rejected, got %v", err)
	}
}

func findSeedCommissionRule(t *testing.T, seed AffiliateRuleSetDraftInput, level int) AffiliateCommissionRuleInput {
	t.Helper()
	for _, rule := range seed.CommissionRules {
		if rule.AffiliateLevel == level {
			return rule
		}
	}
	t.Fatalf("missing commission rule for level %d", level)
	return AffiliateCommissionRuleInput{}
}

func findSeedCommissionTier(t *testing.T, seed AffiliateRuleSetDraftInput, level int, minCents int64) AffiliateCommissionTierInput {
	t.Helper()
	for _, tier := range seed.CommissionTiers {
		if tier.AffiliateLevel == level && tier.MinNetPaidAmountCents == minCents {
			return tier
		}
	}
	t.Fatalf("missing commission tier for level %d min %d", level, minCents)
	return AffiliateCommissionTierInput{}
}

func findSeedKPITier(t *testing.T, seed AffiliateRuleSetDraftInput, level int, code string) AffiliateKPITierInput {
	t.Helper()
	for _, tier := range seed.KPITiers {
		if tier.AffiliateLevel == level && tier.Code == code {
			return tier
		}
	}
	t.Fatalf("missing KPI tier for level %d code %s", level, code)
	return AffiliateKPITierInput{}
}

func findSeedHeadFeeRule(t *testing.T, seed AffiliateRuleSetDraftInput, level int, code string) AffiliateHeadFeeRuleInput {
	t.Helper()
	for _, rule := range seed.HeadFeeRules {
		if rule.AffiliateLevel == level && rule.KPITierCode == code {
			return rule
		}
	}
	t.Fatalf("missing head fee rule for level %d code %s", level, code)
	return AffiliateHeadFeeRuleInput{}
}

func findSeedRiskRule(t *testing.T, seed AffiliateRuleSetDraftInput, level int, code string) AffiliateRiskRuleInput {
	t.Helper()
	for _, rule := range seed.RiskRules {
		if rule.AffiliateLevel == level && rule.Code == code {
			return rule
		}
	}
	t.Fatalf("missing risk rule for level %d code %s", level, code)
	return AffiliateRiskRuleInput{}
}
