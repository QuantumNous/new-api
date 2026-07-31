package billingexpr

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
)

// quotaConversion converts raw expression output to quota based on the
// expression version. This is the central dispatch point for future versions
// that may use a different conversion formula.
func quotaConversion(exprOutput float64, snap *BillingSnapshot) float64 {
	switch snap.ExprVersion {
	default: // v1: coefficients are $/1M tokens prices
		return exprOutput / 1_000_000 * snap.QuotaPerUnit * snap.EffectiveBillingUSDToCNYRate()
	}
}

// ComputeTieredQuota runs the Expr from a frozen BillingSnapshot against
// actual token counts and returns the settlement result.
func ComputeTieredQuota(snap *BillingSnapshot, params TokenParams) (TieredResult, error) {
	return ComputeTieredQuotaWithRequest(snap, params, RequestInput{})
}

func ComputeTieredQuotaWithRequest(snap *BillingSnapshot, params TokenParams, request RequestInput) (TieredResult, error) {
	cost, trace, err := RunExprByHashWithRequest(snap.ExprString, snap.ExprHash, params, request)
	if err != nil {
		return TieredResult{}, err
	}
	if cost < 0 || math.IsNaN(cost) || math.IsInf(cost, 0) {
		return TieredResult{}, fmt.Errorf("billing expression returned invalid cost: %v", cost)
	}

	quotaBeforeGroup := quotaConversion(cost, snap)
	quotaAfterGroup := quotaBeforeGroup * snap.GroupRatio
	if quotaBeforeGroup < 0 || quotaAfterGroup < 0 || math.IsNaN(quotaAfterGroup) || math.IsInf(quotaAfterGroup, 0) {
		return TieredResult{}, fmt.Errorf("billing expression produced invalid quota: before_group=%v group_ratio=%v", quotaBeforeGroup, snap.GroupRatio)
	}
	afterGroup, clamp := common.QuotaRoundChecked(quotaAfterGroup)
	crossed := trace.MatchedTier != snap.EstimatedTier

	return TieredResult{
		ActualQuotaBeforeGroup: quotaBeforeGroup,
		ActualQuotaAfterGroup:  afterGroup,
		MatchedTier:            trace.MatchedTier,
		CrossedTier:            crossed,
		Clamp:                  clamp,
	}, nil
}
