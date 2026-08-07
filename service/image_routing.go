package service

import (
	"math"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// FinalizeImageRoutingSettlement converts the final image response into the
// one billing decision for image-auto. It never invents a token merely to make
// the generic metered path charge: absent upstream usage is explicit and uses
// the route's configured fallback instead.
func FinalizeImageRoutingSettlement(info *relaycommon.RelayInfo, usage *dto.Usage) error {
	if info == nil || info.ImageRouting == nil {
		return nil
	}
	returnedImages := info.ImageRouting.Plan.N
	if info.ImageRouting.ReturnedImagesKnown {
		returnedImages = info.ImageRouting.ReturnedImages
	} else if ratio, ok := info.PriceData.OtherRatios()["n"]; ok && ratio > 0 &&
		ratio <= float64(^uint(0)>>1) && math.Trunc(ratio) == ratio {
		returnedImages = uint(ratio)
	}
	// TotalTokens alone is not enough to price the request: the normal billing
	// path derives quota from the input/output components and would otherwise
	// turn a non-zero total-only response into a zero charge.
	hasUsage := usage != nil && (usage.PromptTokens != 0 || usage.CompletionTokens != 0 ||
		usage.InputTokens != 0 || usage.OutputTokens != 0)
	return info.ImageRouting.PrepareSettlement(returnedImages, hasUsage)
}

// ResolveImageRoutingQuota chooses a configured fixed/missing-usage override
// or caps metered usage at the request-start reserve. The boolean is true only
// for a metered reserve breach and is used by the caller to isolate the route.
func ResolveImageRoutingQuota(info *relaycommon.RelayInfo, calculatedQuota int) (int, bool) {
	if info == nil || info.ImageRouting == nil {
		return calculatedQuota, false
	}
	if info.ImageRouting.FinalQuotaOverrideSet || info.ImageRouting.FinalQuotaOverride > 0 {
		return info.ImageRouting.CapActualQuota(info.ImageRouting.FinalQuotaOverride)
	}
	return info.ImageRouting.CapActualQuota(calculatedQuota)
}
