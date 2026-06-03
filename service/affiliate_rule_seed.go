package service

import (
	"math"
	"strings"

	"github.com/QuantumNous/new-api/model"
)

const (
	DefaultAffiliateRuleSetVersion = "native-affiliate-default"
	DefaultAffiliateRuleSetName    = "Native Affiliate Rules"
)

// BuildDefaultAffiliateRuleSetDraftInput returns the current Feishu-derived
// native affiliate defaults in the same draft shape used by admin rule saves.
func BuildDefaultAffiliateRuleSetDraftInput(version string, actorUserId int, reason string) AffiliateRuleSetDraftInput {
	version = strings.TrimSpace(version)
	if version == "" {
		version = DefaultAffiliateRuleSetVersion
	}

	return AffiliateRuleSetDraftInput{
		Version:        version,
		Name:           DefaultAffiliateRuleSetName,
		EffectiveStart: 0,
		EffectiveEnd:   0,
		ActorUserId:    actorUserId,
		Reason:         strings.TrimSpace(reason),
		CommissionRules: []AffiliateCommissionRuleInput{
			{
				AffiliateLevel:           1,
				Name:                     "Level 1",
				Status:                   model.AffiliateProfileStatusActive,
				DefaultRateBps:           affiliateSeedPercentToBps(20),
				DefaultCapRateBps:        affiliateSeedPercentToBps(30),
				MinSettlementAmountCents: affiliateSeedYuanToCents(100),
				AllowManualApprovalRate:  true,
			},
			{
				AffiliateLevel:           2,
				Name:                     "Level 2",
				Status:                   model.AffiliateProfileStatusActive,
				DefaultRateBps:           affiliateSeedPercentToBps(10),
				DefaultCapRateBps:        affiliateSeedPercentToBps(20),
				MinSettlementAmountCents: affiliateSeedYuanToCents(100),
				AllowManualApprovalRate:  true,
			},
		},
		CommissionTiers: []AffiliateCommissionTierInput{
			{AffiliateLevel: 1, MinNetPaidAmountCents: affiliateSeedYuanToCents(0), MaxNetPaidAmountCents: affiliateSeedYuanToCents(200), BaseRateBps: affiliateSeedPercentToBps(20), CapRateBps: affiliateSeedPercentToBps(30), SortOrder: 1},
			{AffiliateLevel: 1, MinNetPaidAmountCents: affiliateSeedYuanToCents(200), MaxNetPaidAmountCents: affiliateSeedYuanToCents(800), BaseRateBps: affiliateSeedPercentToBps(13.33), CapRateBps: affiliateSeedPercentToBps(20), SortOrder: 2},
			{AffiliateLevel: 1, MinNetPaidAmountCents: affiliateSeedYuanToCents(800), MaxNetPaidAmountCents: affiliateSeedYuanToCents(1500), BaseRateBps: affiliateSeedPercentToBps(10), CapRateBps: affiliateSeedPercentToBps(15), SortOrder: 3},
			{AffiliateLevel: 1, MinNetPaidAmountCents: affiliateSeedYuanToCents(1500), MaxNetPaidAmountCents: affiliateSeedYuanToCents(5000), BaseRateBps: affiliateSeedPercentToBps(5.33), CapRateBps: affiliateSeedPercentToBps(8), SortOrder: 4},
			{AffiliateLevel: 1, MinNetPaidAmountCents: affiliateSeedYuanToCents(5000), MaxNetPaidAmountCents: 0, BaseRateBps: affiliateSeedPercentToBps(2), CapRateBps: affiliateSeedPercentToBps(5), RequiresManualApproval: true, SortOrder: 5},
			{AffiliateLevel: 2, MinNetPaidAmountCents: affiliateSeedYuanToCents(0), MaxNetPaidAmountCents: affiliateSeedYuanToCents(200), BaseRateBps: affiliateSeedPercentToBps(10), CapRateBps: affiliateSeedPercentToBps(20), SortOrder: 1},
			{AffiliateLevel: 2, MinNetPaidAmountCents: affiliateSeedYuanToCents(200), MaxNetPaidAmountCents: affiliateSeedYuanToCents(800), BaseRateBps: affiliateSeedPercentToBps(6), CapRateBps: affiliateSeedPercentToBps(12), SortOrder: 2},
			{AffiliateLevel: 2, MinNetPaidAmountCents: affiliateSeedYuanToCents(800), MaxNetPaidAmountCents: affiliateSeedYuanToCents(1500), BaseRateBps: affiliateSeedPercentToBps(4.5), CapRateBps: affiliateSeedPercentToBps(9), SortOrder: 3},
			{AffiliateLevel: 2, MinNetPaidAmountCents: affiliateSeedYuanToCents(1500), MaxNetPaidAmountCents: affiliateSeedYuanToCents(5000), BaseRateBps: affiliateSeedPercentToBps(2.5), CapRateBps: affiliateSeedPercentToBps(5), SortOrder: 4},
			{AffiliateLevel: 2, MinNetPaidAmountCents: affiliateSeedYuanToCents(5000), MaxNetPaidAmountCents: 0, BaseRateBps: affiliateSeedPercentToBps(1), CapRateBps: affiliateSeedPercentToBps(2), RequiresManualApproval: true, SortOrder: 5},
		},
		KPITiers: []AffiliateKPITierInput{
			{AffiliateLevel: 1, Code: "observe", Name: "Observe", MinEffectiveNewUsers: 0, MinNetPaidAmountCents: affiliateSeedYuanToCents(0), CoefficientBps: affiliateSeedMultiplierToBps(1), MaxGiftOnlyRatioBps: affiliateSeedPercentToBps(20), MaxAbnormalRatioBps: affiliateSeedPercentToBps(10), MinSecondPaymentRatioBps: 0, SortOrder: 1},
			{AffiliateLevel: 1, Code: "qualified", Name: "Qualified", MinEffectiveNewUsers: 30, MinNetPaidAmountCents: affiliateSeedYuanToCents(1500), CoefficientBps: affiliateSeedMultiplierToBps(1.2), MaxGiftOnlyRatioBps: affiliateSeedPercentToBps(20), MaxAbnormalRatioBps: affiliateSeedPercentToBps(10), MinSecondPaymentRatioBps: 0, SortOrder: 2},
			{AffiliateLevel: 1, Code: "growth", Name: "Growth", MinEffectiveNewUsers: 45, MinNetPaidAmountCents: affiliateSeedYuanToCents(2250), CoefficientBps: affiliateSeedMultiplierToBps(1.35), MaxGiftOnlyRatioBps: affiliateSeedPercentToBps(20), MaxAbnormalRatioBps: affiliateSeedPercentToBps(10), MinSecondPaymentRatioBps: 0, SortOrder: 3},
			{AffiliateLevel: 1, Code: "excellent", Name: "Excellent", MinEffectiveNewUsers: 60, MinNetPaidAmountCents: affiliateSeedYuanToCents(3000), CoefficientBps: affiliateSeedMultiplierToBps(1.5), MaxGiftOnlyRatioBps: affiliateSeedPercentToBps(20), MaxAbnormalRatioBps: affiliateSeedPercentToBps(10), MinSecondPaymentRatioBps: affiliateSeedPercentToBps(20), SortOrder: 4},
			{AffiliateLevel: 2, Code: "observe", Name: "Observe", MinEffectiveNewUsers: 0, MinNetPaidAmountCents: affiliateSeedYuanToCents(0), CoefficientBps: affiliateSeedMultiplierToBps(1), MaxGiftOnlyRatioBps: affiliateSeedPercentToBps(30), MaxAbnormalRatioBps: affiliateSeedPercentToBps(10), MinSecondPaymentRatioBps: 0, SortOrder: 1},
			{AffiliateLevel: 2, Code: "base", Name: "Base", MinEffectiveNewUsers: 10, MinNetPaidAmountCents: affiliateSeedYuanToCents(200), CoefficientBps: affiliateSeedMultiplierToBps(1.4), MaxGiftOnlyRatioBps: affiliateSeedPercentToBps(30), MaxAbnormalRatioBps: affiliateSeedPercentToBps(10), MinSecondPaymentRatioBps: 0, SortOrder: 2},
			{AffiliateLevel: 2, Code: "growth", Name: "Growth", MinEffectiveNewUsers: 20, MinNetPaidAmountCents: affiliateSeedYuanToCents(500), CoefficientBps: affiliateSeedMultiplierToBps(1.7), MaxGiftOnlyRatioBps: affiliateSeedPercentToBps(30), MaxAbnormalRatioBps: affiliateSeedPercentToBps(10), MinSecondPaymentRatioBps: 0, SortOrder: 3},
			{AffiliateLevel: 2, Code: "excellent", Name: "Excellent", MinEffectiveNewUsers: 50, MinNetPaidAmountCents: affiliateSeedYuanToCents(1500), CoefficientBps: affiliateSeedMultiplierToBps(2), MaxGiftOnlyRatioBps: affiliateSeedPercentToBps(30), MaxAbnormalRatioBps: affiliateSeedPercentToBps(10), MinSecondPaymentRatioBps: 0, SortOrder: 4},
		},
		HeadFeeRules: []AffiliateHeadFeeRuleInput{
			affiliateSeedHeadFeeRule(1, "observe", 0),
			affiliateSeedHeadFeeRule(1, "qualified", 1.6),
			affiliateSeedHeadFeeRule(1, "growth", 1.8),
			affiliateSeedHeadFeeRule(1, "excellent", 2),
			affiliateSeedHeadFeeRule(2, "observe", 0),
			affiliateSeedHeadFeeRule(2, "base", 0.7),
			affiliateSeedHeadFeeRule(2, "growth", 0.85),
			affiliateSeedHeadFeeRule(2, "excellent", 1),
		},
		RiskRules: []AffiliateRiskRuleInput{
			affiliateSeedRiskRule(1, affiliateSeedPercentToBps(20)),
			affiliateSeedRiskRule(2, affiliateSeedPercentToBps(30)),
		},
		SettlementConfig: AffiliateSettlementRuleConfig{
			Cycle:                    "monthly",
			FreezeDays:               7,
			MinSettlementAmountCents: affiliateSeedYuanToCents(100),
			ManualReviewEnabled:      true,
			AutoSettlementEnabled:    true,
			ReviewNote:               "",
		},
	}
}

func affiliateSeedRiskRule(level int, giftOnlyRatioBps int) AffiliateRiskRuleInput {
	return AffiliateRiskRuleInput{
		AffiliateLevel:           level,
		Code:                     "default",
		MaxGiftOnlyRatioBps:      giftOnlyRatioBps,
		MaxAbnormalRatioBps:      affiliateSeedPercentToBps(10),
		MaxRefundRatioBps:        affiliateSeedPercentToBps(10),
		MinSecondPaymentRatioBps: 0,
		SelfBrushStrategy:        affiliateRiskSelfBrushStrategy,
		BulkAbuseStrategy:        affiliateRiskBulkAbuseStrategy,
		Action:                   affiliateRiskAction,
	}
}

func affiliateSeedHeadFeeRule(level int, kpiTierCode string, amountYuan float64) AffiliateHeadFeeRuleInput {
	return AffiliateHeadFeeRuleInput{
		AffiliateLevel:        level,
		KPITierCode:           kpiTierCode,
		Status:                model.AffiliateProfileStatusActive,
		AmountCents:           affiliateSeedYuanToCents(amountYuan),
		FirstRechargeMinCents: affiliateSeedYuanToCents(10),
		PeriodNetPaidMinCents: affiliateSeedYuanToCents(10),
		QualificationDays:     14,
		UnlockDelayDays:       7,
	}
}

func affiliateSeedYuanToCents(yuan float64) int64 {
	return int64(math.Round(yuan * 100))
}

func affiliateSeedPercentToBps(percent float64) int {
	return int(math.Round(percent * 100))
}

func affiliateSeedMultiplierToBps(multiplier float64) int {
	return int(math.Round(multiplier * affiliateBpsBase))
}
