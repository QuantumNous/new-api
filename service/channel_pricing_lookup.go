package service

import "github.com/QuantumNous/new-api/model"

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
func ChannelModelPriceRatio(channelID int, modelName string) (modelRatio, completionRatio float64, ok bool) {
	candidates := ModelNameCandidates(modelName)
	var row struct {
		InputPrice  float64
		OutputPrice float64
	}
	err := model.DB.Table("channel_model_pricings").
		Select("input_price, output_price").
		Where("channel_id = ? AND model_name IN ?", channelID, candidates).
		Order("input_price ASC"). // tie-break across model name variants — pick cheapest row
		Limit(1).
		Scan(&row).Error
	if err != nil || row.InputPrice <= 0 {
		return 0, 0, false
	}
	modelRatio = row.InputPrice / 2.0
	if row.OutputPrice > 0 {
		completionRatio = row.OutputPrice / row.InputPrice
	} else {
		completionRatio = 1.0
	}
	return modelRatio, completionRatio, true
}
