package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// AttachResponseBilling adds the gateway-calculated charge to an API usage
// object when the client explicitly requested billing details.
func AttachResponseBilling(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage) {
	if relayInfo == nil || !relayInfo.ShouldIncludeBilling || usage == nil {
		return
	}
	usage.Billing = buildResponseBilling(ctx, relayInfo, usage)
}

func buildResponseBilling(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage) *dto.ResponseBilling {
	billingUsage := effectiveBillingUsage(usage)
	summary := calculateTextQuotaSummary(ctx, relayInfo, billingUsage)
	mode := billing_setting.BillingModeRatio
	matchedTier := ""
	quotaPerUnit := common.QuotaPerUnit

	if snap := relayInfo.TieredBillingSnapshot; snap != nil && snap.BillingMode == billing_setting.BillingModeTieredExpr {
		mode = billing_setting.BillingModeTieredExpr
		if snap.QuotaPerUnit > 0 {
			quotaPerUnit = snap.QuotaPerUnit
		}
		usedVars := billingexpr.UsedVars(snap.ExprString)
		ok, tieredQuota, result := TryTieredSettle(
			relayInfo,
			BuildTieredTokenParams(billingUsage, summary.IsClaudeUsageSemantic, usedVars),
		)
		if ok {
			summary.Quota = composeTieredTextQuota(relayInfo, summary, tieredQuota, result)
			if result != nil {
				matchedTier = result.MatchedTier
			}
		}
	} else if relayInfo.PriceData.UsePrice {
		mode = "fixed"
	}

	totalCost := 0.0
	if quotaPerUnit > 0 {
		totalCost, _ = decimal.NewFromInt(int64(summary.Quota)).
			Div(decimal.NewFromFloat(quotaPerUnit)).
			Float64()
	}

	billing := &dto.ResponseBilling{
		Currency:      "USD",
		TotalCost:     totalCost,
		BillingMode:   mode,
		BillingSource: relayInfo.BillingSource,
		GroupRatio:    summary.GroupRatio,
		MatchedTier:   matchedTier,
	}

	otherRatio := relayInfo.PriceData.OtherRatioMultiplier()
	switch mode {
	case billing_setting.BillingModeRatio:
		unitScale := 0.0
		if common.QuotaPerUnit > 0 {
			unitScale = 1_000_000 / common.QuotaPerUnit
		}
		inputPrice := summary.ModelRatio * summary.GroupRatio * otherRatio * unitScale
		outputPrice := inputPrice * summary.CompletionRatio
		billing.InputUnitPricePerMillion = &inputPrice
		billing.OutputUnitPricePerMillion = &outputPrice
	case "fixed":
		requestPrice := summary.ModelPrice * summary.GroupRatio * otherRatio
		billing.RequestPrice = &requestPrice
	}

	return billing
}
