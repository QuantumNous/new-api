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
		ModelMapping *string
		RechargeRate float64
	}
	_ = model.DB.Table("channels").
		Select("model_mapping, COALESCE(recharge_rate, 1.0) AS recharge_rate").
		Where("id = ?", channelID).
		Scan(&ch).Error

	candidates := PricingNameCandidates(modelName, ch.ModelMapping)
	pricing, ok := LookupChannelPricingRow(channelID, candidates)
	if !ok {
		return ChannelModelPriceRatios{}, false
	}
	row := struct {
		InputPrice         float64
		OutputPrice        float64
		CachePrice         float64
		CacheCreationPrice float64
		RechargeRate       float64
	}{
		InputPrice:         pricing.InputPrice,
		OutputPrice:        pricing.OutputPrice,
		CachePrice:         pricing.CachePrice,
		CacheCreationPrice: pricing.CacheCreationPrice,
		RechargeRate:       ch.RechargeRate,
	}
	if row.RechargeRate <= 0 {
		row.RechargeRate = 1.0
	}
	rechargeRate := row.RechargeRate
	if rechargeRate <= 0 {
		rechargeRate = 1.0
	}
	priceData := ChannelModelPriceRatios{
		ModelRatio:      row.InputPrice * rechargeRate / 2.0,
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
