package middleware

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// estimateModelQuota returns a conservative pre-consume estimate for the given model.
// If the model has a fixed price, uses that; otherwise uses a default token-based estimate.
func estimateModelQuota(modelName string) int {
	// Try fixed price first
	if price, ok := ratio_setting.GetModelPrice(modelName, false); ok && price > 0 {
		return int(price * common.QuotaPerUnit)
	}

	// Fall back to ratio-based estimate (assume ~500 prompt + ~500 completion tokens)
	ratio, _, _ := ratio_setting.GetModelRatio(modelName)
	if ratio <= 0 {
		ratio = 1.0
	}
	completionRatio := ratio_setting.GetCompletionRatio(modelName)

	estimatedTokens := 1000
	estimatedQuota := int(float64(estimatedTokens/2)*ratio + float64(estimatedTokens/2)*completionRatio)

	// Ensure at least 1
	if estimatedQuota < 1 {
		estimatedQuota = 1
	}
	return estimatedQuota
}
