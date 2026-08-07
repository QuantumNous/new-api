package billingexpr

import (
	"errors"
	"math"

	"github.com/QuantumNous/new-api/common"
)

var errTieredExpressionEvaluation = errors.New("tiered billing expression evaluation failed")

// quotaConversion converts raw expression output to quota based on the
// expression version. This is the central dispatch point for future versions
// that may use a different conversion formula.
func quotaConversion(exprOutput float64, snap *BillingSnapshot) float64 {
	switch snap.ExprVersion {
	default: // v1: coefficients are $/1M tokens prices
		return exprOutput / 1_000_000 * snap.QuotaPerUnit
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
		return TieredResult{}, errTieredExpressionEvaluation
	}
	if math.IsNaN(cost) || math.IsInf(cost, 0) || cost < 0 {
		return TieredResult{}, errors.New("tiered billing cost must be finite and non-negative")
	}

	quotaBeforeGroup := quotaConversion(cost, snap)
	if math.IsNaN(quotaBeforeGroup) || math.IsInf(quotaBeforeGroup, 0) || quotaBeforeGroup < 0 {
		return TieredResult{}, errors.New("tiered billing quota before group must be finite and non-negative")
	}
	if math.IsNaN(snap.GroupRatio) || math.IsInf(snap.GroupRatio, 0) || snap.GroupRatio < 0 {
		return TieredResult{}, errors.New("tiered billing group ratio must be finite and non-negative")
	}
	quotaAfterGroup := quotaBeforeGroup * snap.GroupRatio
	if math.IsNaN(quotaAfterGroup) || math.IsInf(quotaAfterGroup, 0) || quotaAfterGroup < 0 {
		return TieredResult{}, errors.New("tiered billing quota after group must be finite and non-negative")
	}
	afterGroup, clamp := common.QuotaRoundChecked(quotaAfterGroup)
	if afterGroup < 0 {
		return TieredResult{}, errors.New("tiered billing quota after group must be non-negative")
	}
	crossed := trace.MatchedTier != snap.EstimatedTier

	return TieredResult{
		ActualQuotaBeforeGroup: quotaBeforeGroup,
		ActualQuotaAfterGroup:  afterGroup,
		MatchedTier:            trace.MatchedTier,
		CrossedTier:            crossed,
		Clamp:                  clamp,
	}, nil
}
