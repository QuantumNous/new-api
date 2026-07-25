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
}

type WebsiteDisplayPrices struct {
	Input       *WebsitePricePair `json:"input"`
	Output      *WebsitePricePair `json:"output"`
	Cache       *WebsitePricePair `json:"cache"`
	Image       *WebsitePricePair `json:"image"`
	AudioInput  *WebsitePricePair `json:"audio_input"`
	AudioOutput *WebsitePricePair `json:"audio_output"`
	Request     *WebsitePricePair `json:"request"`
}

type WebsitePricingModel struct {
	ModelName   string               `json:"model_name"`
	BillingKind string               `json:"billing_kind"`
	Prices      WebsiteDisplayPrices `json:"prices"`
}

type WebsitePricingV2 struct {
	Success       bool                  `json:"success"`
	SchemaVersion string                `json:"schema_version"`
	Group         string                `json:"group"`
	GeneratedAt   int64                 `json:"generated_at"`
	Models        []WebsitePricingModel `json:"models"`
}

type websitePricingSource interface {
	BillingMode(string) string
	EffectiveGroupRatio(string) types.GroupRatioInfo
	HasGroup(string) bool
	QuotaPerUnit() float64
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
			ModelName: item.ModelName,
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

	sort.Slice(models, func(i, j int) bool { return models[i].ModelName < models[j].ModelName })
	return WebsitePricingV2{
		Success:       true,
		SchemaVersion: "website-public-plg-v2",
		Group:         group,
		GeneratedAt:   generatedAt.Unix(),
		Models:        models,
	}, nil
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
