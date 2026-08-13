package service

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/shopspring/decimal"
)

const websitePricingV2Group = "plg"

type WebsitePricePair struct {
	Configured string `json:"configured"`
	PLG        string `json:"plg"`
	From       bool   `json:"from,omitempty"`
}

type WebsiteDisplayPrices struct {
	Second      *WebsitePricePair `json:"second,omitempty"`
	Input       *WebsitePricePair `json:"input,omitempty"`
	Output      *WebsitePricePair `json:"output,omitempty"`
	Cache       *WebsitePricePair `json:"cache,omitempty"`
	CreateCache *WebsitePricePair `json:"create_cache,omitempty"`
	Image       *WebsitePricePair `json:"image,omitempty"`
	AudioInput  *WebsitePricePair `json:"audio_input,omitempty"`
	AudioOutput *WebsitePricePair `json:"audio_output,omitempty"`
	Request     *WebsitePricePair `json:"request,omitempty"`
}

type WebsitePricingPrices struct {
	Input       *WebsitePricePair `json:"input"`
	Output      *WebsitePricePair `json:"output"`
	Cache       *WebsitePricePair `json:"cache"`
	Image       *WebsitePricePair `json:"image"`
	AudioInput  *WebsitePricePair `json:"audio_input"`
	AudioOutput *WebsitePricePair `json:"audio_output"`
	Request     *WebsitePricePair `json:"request"`
}

type WebsitePricingModel struct {
	ModelName     string               `json:"model_name"`
	BillingKind   string               `json:"billing_kind"`
	Prices        WebsitePricingPrices `json:"prices"`
	FeaturedOrder *int                 `json:"featured_order,omitempty"`
}

type WebsitePricingV2 struct {
	Success       bool                  `json:"success"`
	SchemaVersion string                `json:"schema_version"`
	Group         string                `json:"group"`
	GeneratedAt   int64                 `json:"generated_at"`
	Models        []WebsitePricingModel `json:"models"`
}

type WebsiteDisplayPricing struct {
	BillingKind string               `json:"billing_kind"`
	Prices      WebsiteDisplayPrices `json:"prices"`
}

type websitePricingSource interface {
	BillingMode(string) string
	EffectiveGroupRatio(string) types.GroupRatioInfo
	HasGroup(string) bool
	QuotaPerUnit() float64
	VideoPriceRules() []billing_setting.VideoPriceRule
}

type liveWebsitePricingSource struct{}

func (liveWebsitePricingSource) BillingMode(modelName string) string {
	return billing_setting.GetBillingMode(modelName)
}

func (liveWebsitePricingSource) EffectiveGroupRatio(modelName string) types.GroupRatioInfo {
	return ratio_setting.GetEffectiveGroupRatio(websitePricingV2Group, websitePricingV2Group, modelName)
}

func (liveWebsitePricingSource) HasGroup(group string) bool {
	_, ok := ratio_setting.GetGroupRatioCopy()[group]
	return ok
}

func (liveWebsitePricingSource) QuotaPerUnit() float64 { return common.QuotaPerUnit }

func (liveWebsitePricingSource) VideoPriceRules() []billing_setting.VideoPriceRule {
	return billing_setting.GetVideoPriceRules()
}

func BuildWebsiteDisplayPricing(
	pricing []model.Pricing,
	group string,
) (map[string]WebsiteDisplayPricing, error) {
	return buildWebsiteDisplayPricing(pricing, group, liveWebsitePricingSource{})
}

func buildWebsiteDisplayPricing(
	pricing []model.Pricing,
	group string,
	source websitePricingSource,
) (map[string]WebsiteDisplayPricing, error) {
	if group != websitePricingV2Group {
		return nil, fmt.Errorf("unsupported website pricing group %q", group)
	}
	if !source.HasGroup(group) {
		return nil, errors.New("public website group is not configured")
	}
	quotaPerUnit := source.QuotaPerUnit()
	if !validWebsitePrice(quotaPerUnit) || quotaPerUnit == 0 {
		return nil, errors.New("quota per unit must be a positive finite number")
	}

	displayPricing := make(map[string]WebsiteDisplayPricing, len(pricing))
	videoRules := source.VideoPriceRules()
	for _, item := range pricing {
		if !websiteModelVisibleToGroup(item, group) {
			continue
		}
		ratioInfo := source.EffectiveGroupRatio(item.ModelName)
		if !validWebsitePrice(ratioInfo.GroupRatio) {
			return nil, fmt.Errorf("invalid group ratio for model %q", item.ModelName)
		}

		row := WebsiteDisplayPricing{}
		if secondPrice, ok := websiteDisplaySecondPrice(item.ModelName, videoRules, ratioInfo.GroupRatio); ok {
			row.BillingKind = "per_second"
			row.Prices.Second = secondPrice
			displayPricing[item.ModelName] = row
			continue
		}
		switch source.BillingMode(item.ModelName) {
		case billing_setting.BillingModeTieredExpr:
			row.BillingKind = billing_setting.BillingModeTieredExpr
		default:
			if item.QuotaType == 1 {
				row.BillingKind = "request"
				requestPrice, err := websitePricePair(item.ModelPrice, ratioInfo.GroupRatio)
				if err != nil {
					return nil, fmt.Errorf("invalid request price for model %q: %w", item.ModelName, err)
				}
				row.Prices.Request = requestPrice
				displayPricing[item.ModelName] = row
				continue
			}
			row.BillingKind = "token"
			if !validWebsitePrice(item.ModelRatio) {
				return nil, fmt.Errorf("invalid model ratio for model %q", item.ModelName)
			}
			if !validWebsitePrice(item.CompletionRatio) {
				return nil, fmt.Errorf("invalid completion ratio for model %q", item.ModelName)
			}
			if err := validateWebsiteOptionalRatios(item); err != nil {
				return nil, fmt.Errorf("invalid optional ratio for model %q: %w", item.ModelName, err)
			}
			input := decimal.NewFromInt(1_000_000).
				Mul(decimal.NewFromFloat(item.ModelRatio)).
				Div(decimal.NewFromFloat(quotaPerUnit)).InexactFloat64()
			if !validWebsitePrice(input) {
				return nil, fmt.Errorf("invalid input price for model %q", item.ModelName)
			}
			var err error
			if row.Prices.Input, err = websitePricePair(input, ratioInfo.GroupRatio); err != nil {
				return nil, fmt.Errorf("invalid input price for model %q: %w", item.ModelName, err)
			}
			if row.Prices.Output, err = websiteScaledPricePair(input, ratioInfo.GroupRatio, item.CompletionRatio); err != nil {
				return nil, fmt.Errorf("invalid output price for model %q: %w", item.ModelName, err)
			}
			if row.Prices.Cache, err = websiteOptionalPricePair(input, item.CacheRatio, ratioInfo.GroupRatio); err != nil {
				return nil, fmt.Errorf("invalid cache price for model %q: %w", item.ModelName, err)
			}
			if row.Prices.CreateCache, err = websiteOptionalPricePair(input, item.CreateCacheRatio, ratioInfo.GroupRatio); err != nil {
				return nil, fmt.Errorf("invalid cache creation price for model %q: %w", item.ModelName, err)
			}
			if row.Prices.Image, err = websiteOptionalPricePair(input, item.ImageRatio, ratioInfo.GroupRatio); err != nil {
				return nil, fmt.Errorf("invalid image price for model %q: %w", item.ModelName, err)
			}
			if row.Prices.AudioInput, err = websiteOptionalPricePair(input, item.AudioRatio, ratioInfo.GroupRatio); err != nil {
				return nil, fmt.Errorf("invalid audio input price for model %q: %w", item.ModelName, err)
			}
			if item.AudioCompletionRatio != nil {
				audioRatio := 1.0
				if item.AudioRatio != nil {
					audioRatio = *item.AudioRatio
				}
				if row.Prices.AudioOutput, err = websiteScaledPricePair(input, ratioInfo.GroupRatio, audioRatio, *item.AudioCompletionRatio); err != nil {
					return nil, fmt.Errorf("invalid audio output price for model %q: %w", item.ModelName, err)
				}
			}
		}
		displayPricing[item.ModelName] = row
	}
	return displayPricing, nil
}

func BuildWebsitePricingV2(
	pricing []model.Pricing,
	group string,
	generatedAt time.Time,
) (WebsitePricingV2, error) {
	return buildWebsitePricingV2(pricing, group, generatedAt, liveWebsitePricingSource{})
}

func buildWebsitePricingV2(
	pricing []model.Pricing,
	group string,
	generatedAt time.Time,
	source websitePricingSource,
) (WebsitePricingV2, error) {
	if group != websitePricingV2Group {
		return WebsitePricingV2{}, fmt.Errorf("unsupported website pricing group %q", group)
	}
	if !source.HasGroup(group) {
		return WebsitePricingV2{}, errors.New("public website group is not configured")
	}
	quotaPerUnit := source.QuotaPerUnit()
	if !validWebsitePrice(quotaPerUnit) || quotaPerUnit == 0 {
		return WebsitePricingV2{}, errors.New("quota per unit must be a positive finite number")
	}

	models := make([]WebsitePricingModel, 0, len(pricing))
	for _, item := range pricing {
		if !websiteModelVisibleToGroup(item, group) {
			continue
		}
		ratioInfo := source.EffectiveGroupRatio(item.ModelName)
		if !validWebsitePrice(ratioInfo.GroupRatio) {
			return WebsitePricingV2{}, fmt.Errorf("invalid group ratio for model %q", item.ModelName)
		}

		row := WebsitePricingModel{
			ModelName:     item.ModelName,
			FeaturedOrder: item.WebsiteFeaturedOrder,
		}

		switch source.BillingMode(item.ModelName) {
		case billing_setting.BillingModeTieredExpr:
			row.BillingKind = billing_setting.BillingModeTieredExpr
		case billing_setting.BillingModeRatio:
			if item.QuotaType == 1 {
				row.BillingKind = "request_base"
				requestPrice, err := websitePricePair(item.ModelPrice, ratioInfo.GroupRatio)
				if err != nil {
					return WebsitePricingV2{}, fmt.Errorf("invalid request price for model %q: %w", item.ModelName, err)
				}
				row.Prices.Request = requestPrice
				break
			}
			row.BillingKind = "token_ratio"
			if !validWebsitePrice(item.ModelRatio) {
				return WebsitePricingV2{}, fmt.Errorf("invalid model ratio for model %q", item.ModelName)
			}
			if !validWebsitePrice(item.CompletionRatio) {
				return WebsitePricingV2{}, fmt.Errorf("invalid completion ratio for model %q", item.ModelName)
			}
			if err := validateWebsiteOptionalRatios(item); err != nil {
				return WebsitePricingV2{}, fmt.Errorf("invalid optional ratio for model %q: %w", item.ModelName, err)
			}
			input := decimal.NewFromInt(1_000_000).
				Mul(decimal.NewFromFloat(item.ModelRatio)).
				Div(decimal.NewFromFloat(quotaPerUnit)).InexactFloat64()
			if !validWebsitePrice(input) {
				return WebsitePricingV2{}, fmt.Errorf("invalid input price for model %q", item.ModelName)
			}
			var err error
			if row.Prices.Input, err = websitePricePair(input, ratioInfo.GroupRatio); err != nil {
				return WebsitePricingV2{}, fmt.Errorf("invalid input price for model %q: %w", item.ModelName, err)
			}
			if row.Prices.Output, err = websiteScaledPricePair(input, ratioInfo.GroupRatio, item.CompletionRatio); err != nil {
				return WebsitePricingV2{}, fmt.Errorf("invalid output price for model %q: %w", item.ModelName, err)
			}
			if row.Prices.Cache, err = websiteOptionalPricePair(input, item.CacheRatio, ratioInfo.GroupRatio); err != nil {
				return WebsitePricingV2{}, fmt.Errorf("invalid cache price for model %q: %w", item.ModelName, err)
			}
			if row.Prices.Image, err = websiteOptionalPricePair(input, item.ImageRatio, ratioInfo.GroupRatio); err != nil {
				return WebsitePricingV2{}, fmt.Errorf("invalid image price for model %q: %w", item.ModelName, err)
			}
			if row.Prices.AudioInput, err = websiteOptionalPricePair(input, item.AudioRatio, ratioInfo.GroupRatio); err != nil {
				return WebsitePricingV2{}, fmt.Errorf("invalid audio input price for model %q: %w", item.ModelName, err)
			}
			if item.AudioCompletionRatio != nil {
				audioRatio := 1.0
				if item.AudioRatio != nil {
					audioRatio = *item.AudioRatio
				}
				if row.Prices.AudioOutput, err = websiteScaledPricePair(input, ratioInfo.GroupRatio, audioRatio, *item.AudioCompletionRatio); err != nil {
					return WebsitePricingV2{}, fmt.Errorf("invalid audio output price for model %q: %w", item.ModelName, err)
				}
			}
		default:
			return WebsitePricingV2{}, fmt.Errorf("unsupported billing mode for model %q", item.ModelName)
		}
		models = append(models, row)
	}

	sort.SliceStable(models, func(i, j int) bool {
		leftOrder := featuredOrderOrMax(models[i].FeaturedOrder)
		rightOrder := featuredOrderOrMax(models[j].FeaturedOrder)
		if leftOrder != rightOrder {
			return leftOrder < rightOrder
		}
		return models[i].ModelName < models[j].ModelName
	})
	return WebsitePricingV2{
		Success:       true,
		SchemaVersion: "website-public-plg-v2",
		Group:         group,
		GeneratedAt:   generatedAt.Unix(),
		Models:        models,
	}, nil
}

func websiteDisplaySecondPrice(modelName string, rules []billing_setting.VideoPriceRule, groupRatio float64) (*WebsitePricePair, bool) {
	var (
		bestPrice float64
		found     bool
		valid     int
	)
	for _, rule := range rules {
		if rule.Model != modelName || !validWebsitePrice(rule.PricePerSecond) || rule.PricePerSecond <= 0 {
			continue
		}
		valid++
		if !found || rule.PricePerSecond < bestPrice {
			bestPrice = rule.PricePerSecond
			found = true
		}
	}
	if !found {
		return nil, false
	}
	price, err := websitePricePair(bestPrice, groupRatio)
	if err != nil {
		return nil, false
	}
	price.From = valid > 1
	return price, true
}

func featuredOrderOrMax(order *int) int {
	if order == nil {
		return int(^uint(0) >> 1)
	}
	return *order
}

func websitePricePair(configured, groupRatio float64) (*WebsitePricePair, error) {
	if !validWebsitePrice(configured) || !validWebsitePrice(groupRatio) {
		return nil, errors.New("price inputs must be non-negative finite numbers")
	}
	plg := configured * groupRatio
	if !validWebsitePrice(plg) {
		return nil, errors.New("price overflow")
	}
	return &WebsitePricePair{
		Configured: decimal.NewFromFloat(configured).String(),
		PLG:        decimal.NewFromFloat(configured).Mul(decimal.NewFromFloat(groupRatio)).String(),
	}, nil
}

func websiteOptionalPricePair(base float64, ratio *float64, groupRatio float64) (*WebsitePricePair, error) {
	if ratio == nil {
		return nil, nil
	}
	return websiteScaledPricePair(base, groupRatio, *ratio)
}

func websiteScaledPricePair(base, groupRatio float64, multipliers ...float64) (*WebsitePricePair, error) {
	configured := base
	for _, multiplier := range multipliers {
		if !validWebsitePrice(multiplier) {
			return nil, errors.New("price multiplier must be a non-negative finite number")
		}
		configured *= multiplier
		if !validWebsitePrice(configured) {
			return nil, errors.New("price overflow")
		}
	}
	return websitePricePair(configured, groupRatio)
}

func websiteModelVisibleToGroup(item model.Pricing, group string) bool {
	for _, enabledGroup := range item.EnableGroup {
		if enabledGroup == "all" || enabledGroup == group {
			return true
		}
	}
	return false
}

func validateWebsiteOptionalRatios(item model.Pricing) error {
	ratios := []struct {
		name  string
		value *float64
	}{
		{name: "cache", value: item.CacheRatio},
		{name: "cache creation", value: item.CreateCacheRatio},
		{name: "image", value: item.ImageRatio},
		{name: "audio", value: item.AudioRatio},
		{name: "audio completion", value: item.AudioCompletionRatio},
	}
	for _, ratio := range ratios {
		if ratio.value != nil && !validWebsitePrice(*ratio.value) {
			return fmt.Errorf("%s ratio must be a non-negative finite number", ratio.name)
		}
	}
	return nil
}

func validWebsitePrice(value float64) bool {
	return value >= 0 && !math.IsNaN(value) && !math.IsInf(value, 0)
}
