package service

import (
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func applyTierPricingToRelayInfo(relayInfo *relaycommon.RelayInfo, promptTokens int) {
	if relayInfo == nil || relayInfo.PriceData.UsePrice {
		return
	}
	if promptTokens < 0 {
		promptTokens = 0
	}
	if updatedPriceData, applied := ratio_setting.ApplyModelTierPricing(relayInfo.OriginModelName, relayInfo.PriceData, promptTokens); applied {
		relayInfo.PriceData = updatedPriceData
	}
}
