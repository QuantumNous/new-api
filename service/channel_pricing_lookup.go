package service

import "github.com/QuantumNous/new-api/model"

type ChannelModelPriceRatios struct {
	ModelRatio         float64
	CompletionRatio    float64
	CacheRatio         float64
	CacheCreationRatio float64
}

// ChannelModelPriceRatio derives newapi-internal ratio numbers from a specific
// channel's row in channel_model_pricings. Returns (0, 0, false) when no
// pricing row exists for the (channel, model) pair.
//
// Conversion (newapi internal scale: 1.0 ratio == $2/1M tokens, baked into
// setting/ratio_setting/model_ratio.go):
//
//	model_ratio       = input_price / 2.0
//	completion_ratio  = output_price / input_price   (defaults to 1.0 when output_price missing)
//
// Used by relay/helper/price.go ModelPriceHelper as a fallback when neither
// ModelPrice nor ModelRatio is configured — implements apimaster's
// "cost price == sell price" routing 0.1 + step 4 billing model.
func ChannelModelPriceData(channelID int, modelName string) (ChannelModelPriceRatios, bool) {
	var ch struct {
		ModelMapping        *string
		Setting             *string
		RechargeRate        float64
		ApimasterPriceRatio float64
	}
	_ = model.DB.Table("channels").
		Select("model_mapping, setting, COALESCE(recharge_rate, 1.0) AS recharge_rate, COALESCE(apimaster_price_ratio, 1.0) AS apimaster_price_ratio").
		Where("id = ?", channelID).
		Scan(&ch).Error

	candidates := PricingNameCandidates(modelName, ch.ModelMapping)
	pricing, ok := LookupChannelPricingRow(channelID, candidates)
	var inputPrice, outputPrice, cachePrice, cacheCreationPrice float64
	if ok {
		inputPrice, outputPrice, cachePrice, cacheCreationPrice =
			pricing.InputPrice, pricing.OutputPrice, pricing.CachePrice, pricing.CacheCreationPrice
	} else {
		// No stored row — resolve live for manual-priced channels (see
		// fetchModelPriceRatioFallback: manual channels never store a
		// snapshot, precisely so a 官方原价 edit takes effect on the very
		// next request instead of waiting for "刷新价格").
		manual, manualOk := LookupPublicManualPricing(ch.Setting, modelName)
		if !manualOk || manual.InputPrice <= 0 {
			return ChannelModelPriceRatios{}, false
		}
		inputPrice, outputPrice, cachePrice, cacheCreationPrice =
			manual.InputPrice, manual.OutputPrice, manual.CachePrice, manual.CacheCreationPrice
	}
	row := struct {
		InputPrice         float64
		OutputPrice        float64
		CachePrice         float64
		CacheCreationPrice float64
		RechargeRate       float64
	}{
		InputPrice:         inputPrice,
		OutputPrice:        outputPrice,
		CachePrice:         cachePrice,
		CacheCreationPrice: cacheCreationPrice,
		RechargeRate:       ch.RechargeRate,
	}
	if row.RechargeRate <= 0 {
		row.RechargeRate = 1.0
	}
	rechargeRate := row.RechargeRate
	if rechargeRate <= 0 {
		rechargeRate = 1.0
	}
	// apimaster markup multiplier; nil/0 already coalesced to 1.0, guard for safety.
	// Applied to ModelRatio (input). Output/cache ride along automatically because
	// their ratios are relative to input_price.
	apimasterRatio := ch.ApimasterPriceRatio
	if apimasterRatio <= 0 {
		apimasterRatio = 1.0
	}
	priceData := ChannelModelPriceRatios{
		ModelRatio:      row.InputPrice * rechargeRate * apimasterRatio / 2.0,
		CompletionRatio: 1.0,
	}
	if row.OutputPrice > 0 {
		priceData.CompletionRatio = row.OutputPrice / row.InputPrice
	}
	if row.CachePrice > 0 {
		priceData.CacheRatio = row.CachePrice / row.InputPrice
	}
	if row.CacheCreationPrice > 0 {
		priceData.CacheCreationRatio = row.CacheCreationPrice / row.InputPrice
	}
	return priceData, true
}

func ChannelModelPriceRatio(channelID int, modelName string) (modelRatio, completionRatio float64, ok bool) {
	priceData, ok := ChannelModelPriceData(channelID, modelName)
	if !ok {
		return 0, 0, false
	}
	return priceData.ModelRatio, priceData.CompletionRatio, true
}
