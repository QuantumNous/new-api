package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ModelMappingTarget resolves the upstream model name for a client-facing model
// using the channel's model_mapping JSON (supports chained mappings, same as relay).
// Returns "" when there is no mapping for canonical.
func ModelMappingTarget(modelMapping *string, canonical string) string {
	if modelMapping == nil {
		return ""
	}
	raw := *modelMapping
	if raw == "" || raw == "{}" {
		return ""
	}
	var modelMap map[string]string
	if err := common.Unmarshal([]byte(raw), &modelMap); err != nil {
		return ""
	}
	current := canonical
	visited := map[string]bool{canonical: true}
	for {
		mapped, ok := modelMap[current]
		if !ok || mapped == "" {
			break
		}
		if visited[mapped] {
			break
		}
		visited[mapped] = true
		current = mapped
	}
	if current == canonical {
		return ""
	}
	return current
}

// PricingNameCandidates returns model_name values to match in channel_model_pricings:
// global aliases (ModelNameCandidates) plus this channel's model_mapping target.
func PricingNameCandidates(canonical string, modelMapping *string) []string {
	out := ModelNameCandidates(canonical)
	if target := ModelMappingTarget(modelMapping, canonical); target != "" {
		out = appendUniqueStrings(out, target)
	}
	return out
}

func appendUniqueStrings(base []string, extra ...string) []string {
	seen := make(map[string]bool, len(base)+len(extra))
	out := make([]string, 0, len(base)+len(extra))
	for _, s := range append(append([]string{}, base...), extra...) {
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}

// ChannelPricingLookupRow is a single channel_model_pricings match.
type ChannelPricingLookupRow struct {
	InputPrice         float64
	OutputPrice        float64
	CachePrice         float64
	CacheCreationPrice float64
	GroupRatio         float64
	PricingSource      string
}

// LookupChannelPricingRow returns the cheapest row for (channel, any of candidates).
func LookupChannelPricingRow(channelID int, candidates []string) (*ChannelPricingLookupRow, bool) {
	if channelID <= 0 || len(candidates) == 0 {
		return nil, false
	}
	var row struct {
		InputPrice         float64
		OutputPrice        float64
		CachePrice         float64
		CacheCreationPrice float64
		GroupRatio         float64
		PricingSource      *string
	}
	err := model.DB.Table("channel_model_pricings").
		Select("input_price, output_price, cache_price, cache_creation_price, group_ratio, pricing_source").
		Where("channel_id = ? AND model_name IN ?", channelID, candidates).
		Where("input_price > 0").
		Order("input_price ASC").
		Limit(1).
		Scan(&row).Error
	if err != nil || row.InputPrice <= 0 {
		return nil, false
	}
	gr := row.GroupRatio
	if gr <= 0 {
		gr = 1.0
	}
	src := ""
	if row.PricingSource != nil {
		src = *row.PricingSource
	}
	return &ChannelPricingLookupRow{
		InputPrice:         row.InputPrice,
		OutputPrice:        row.OutputPrice,
		CachePrice:         row.CachePrice,
		CacheCreationPrice: row.CacheCreationPrice,
		GroupRatio:         gr,
		PricingSource:      src,
	}, true
}

// ResolvePricingViaModelMapping looks up pricing using only the channel's model_mapping
// target (not global aliases). Use when the SQL JOIN on global candidates missed but the
// channel maps canonical → upstream model name in channel_model_pricings.
func ResolvePricingViaModelMapping(channelID int, modelMapping *string, canonical string) (*ChannelPricingLookupRow, bool) {
	target := ModelMappingTarget(modelMapping, canonical)
	if target == "" {
		return nil, false
	}
	return LookupChannelPricingRow(channelID, []string{target})
}

// ChannelActualPricesResolved returns the user-facing unit price
// (采购价 × apimaster_price_ratio = input_price × recharge_rate × apimaster_ratio)
// for billing logs. NOT raw procurement cost — matches Model Data「用户价格」.
func ChannelActualPricesResolved(channelID int, modelName string) (*model.ChannelActualPrices, error) {
	var ch struct {
		ModelMapping        *string
		RechargeRate        *float64
		ApimasterPriceRatio *float64
	}
	if err := model.DB.Table("channels").
		Select("model_mapping, recharge_rate, apimaster_price_ratio").
		Where("id = ?", channelID).
		Scan(&ch).Error; err != nil {
		return nil, err
	}
	candidates := PricingNameCandidates(modelName, ch.ModelMapping)
	row, ok := LookupChannelPricingRow(channelID, candidates)
	if !ok {
		return nil, nil
	}
	rechargeRate := 1.0
	if ch.RechargeRate != nil && *ch.RechargeRate > 0 {
		rechargeRate = *ch.RechargeRate
	}
	apimasterRatio := 1.0
	if ch.ApimasterPriceRatio != nil && *ch.ApimasterPriceRatio > 0 {
		apimasterRatio = *ch.ApimasterPriceRatio
	}
	mult := rechargeRate * apimasterRatio
	return &model.ChannelActualPrices{
		InputPrice:         row.InputPrice * mult,
		OutputPrice:        row.OutputPrice * mult,
		CachePrice:         row.CachePrice * mult,
		CacheCreationPrice: row.CacheCreationPrice * mult,
	}, nil
}

// ChannelProcurementPricesResolved returns the channel procurement unit price
// (channel_model_pricings × recharge_rate) using the same alias/model_mapping
// resolution as ChannelActualPricesResolved.
func ChannelProcurementPricesResolved(channelID int, modelName string) (*model.ChannelActualPrices, error) {
	var ch struct {
		ModelMapping *string
		RechargeRate *float64
	}
	if err := model.DB.Table("channels").
		Select("model_mapping, recharge_rate").
		Where("id = ?", channelID).
		Scan(&ch).Error; err != nil {
		return nil, err
	}
	candidates := PricingNameCandidates(modelName, ch.ModelMapping)
	row, ok := LookupChannelPricingRow(channelID, candidates)
	if !ok {
		return nil, nil
	}
	rechargeRate := 1.0
	if ch.RechargeRate != nil && *ch.RechargeRate > 0 {
		rechargeRate = *ch.RechargeRate
	}
	return &model.ChannelActualPrices{
		InputPrice:         row.InputPrice * rechargeRate,
		OutputPrice:        row.OutputPrice * rechargeRate,
		CachePrice:         row.CachePrice * rechargeRate,
		CacheCreationPrice: row.CacheCreationPrice * rechargeRate,
	}, nil
}
