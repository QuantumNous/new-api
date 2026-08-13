package service

import (
	"math"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

type fakeWebsitePricingSource struct {
	modes           map[string]string
	ratios          map[string]types.GroupRatioInfo
	videoRules      []billing_setting.VideoPriceRule
	quotaPerUnit    float64
	configuredGroup bool
}

func (source fakeWebsitePricingSource) BillingMode(modelName string) string {
	if mode := source.modes[modelName]; mode != "" {
		return mode
	}
	return billing_setting.BillingModeRatio
}

func (source fakeWebsitePricingSource) EffectiveGroupRatio(modelName string) types.GroupRatioInfo {
	return source.ratios[modelName]
}

func (source fakeWebsitePricingSource) HasGroup(string) bool  { return source.configuredGroup }
func (source fakeWebsitePricingSource) QuotaPerUnit() float64 { return source.quotaPerUnit }
func (source fakeWebsitePricingSource) VideoPriceRules() []billing_setting.VideoPriceRule {
	return source.videoRules
}

func TestBuildWebsitePricingV2ReturnsDisplayReadyPLGPricesOnly(t *testing.T) {
	cacheRatio := 0.25
	createCacheRatio := 0.5
	audioRatio := 4.0
	audioCompletionRatio := 3.0
	pricing := []model.Pricing{
		{
			ModelName: "token-model", QuotaType: 0, ModelRatio: 2, CompletionRatio: 3,
			Description: "internal description", Icon: "internal-icon", Tags: "internal-tag", VendorID: 42,
			CacheRatio: &cacheRatio, CreateCacheRatio: &createCacheRatio, AudioRatio: &audioRatio, AudioCompletionRatio: &audioCompletionRatio,
			EnableGroup: []string{"plg", "internal"}, BillingExpr: "secret()",
		},
		{ModelName: "request-model", QuotaType: 1, ModelPrice: 0.02, EnableGroup: []string{"all"}},
		{ModelName: "tiered-model", QuotaType: 0, EnableGroup: []string{"plg"}, BillingExpr: "tier(secret)"},
		{ModelName: "internal-model", QuotaType: 0, ModelRatio: 9, EnableGroup: []string{"internal"}},
	}
	source := fakeWebsitePricingSource{
		modes: map[string]string{"tiered-model": billing_setting.BillingModeTieredExpr},
		ratios: map[string]types.GroupRatioInfo{
			"token-model":   {GroupRatio: 0.5, HasGroupModelRatio: true},
			"request-model": {GroupRatio: 0.5},
			"tiered-model":  {GroupRatio: 0.5},
		},
		quotaPerUnit: 500_000, configuredGroup: true,
	}

	payload, err := buildWebsitePricingV2(pricing, "plg", time.Unix(100, 0), source)
	require.NoError(t, err)
	require.Len(t, payload.Models, 3)
	require.Equal(t, "request-model", payload.Models[0].ModelName)
	require.Equal(t, "0.02", payload.Models[0].Prices.Request.Configured)
	require.Equal(t, "0.01", payload.Models[0].Prices.Request.PLG)
	require.Equal(t, "token-model", payload.Models[2].ModelName)
	require.Equal(t, "4", payload.Models[2].Prices.Input.Configured)
	require.Equal(t, "2", payload.Models[2].Prices.Input.PLG)
	require.Equal(t, "12", payload.Models[2].Prices.Output.Configured)
	require.Equal(t, "6", payload.Models[2].Prices.Output.PLG)
	require.Equal(t, "1", payload.Models[2].Prices.Cache.Configured)
	require.Equal(t, "0.5", payload.Models[2].Prices.Cache.PLG)
	require.Equal(t, "16", payload.Models[2].Prices.AudioInput.Configured)
	require.Equal(t, "8", payload.Models[2].Prices.AudioInput.PLG)
	require.Equal(t, "48", payload.Models[2].Prices.AudioOutput.Configured)
	require.Equal(t, "24", payload.Models[2].Prices.AudioOutput.PLG)
	require.Equal(t, billing_setting.BillingModeTieredExpr, payload.Models[1].BillingKind)
	require.Nil(t, payload.Models[1].Prices.Input)

	body, err := common.Marshal(payload)
	require.NoError(t, err)
	require.NotContains(t, string(body), "model_ratio")
	require.NotContains(t, string(body), "billing_expr")
	require.NotContains(t, string(body), "secret")
	require.NotContains(t, string(body), "internal-model")
	require.NotContains(t, string(body), "internal description")
	require.NotContains(t, string(body), "internal-icon")
	require.NotContains(t, string(body), "internal-tag")
	require.NotContains(t, string(body), "vendor_id")
	require.NotContains(t, string(body), "enable_groups")
	require.NotContains(t, string(body), "supported_endpoint")
	require.NotContains(t, string(body), "effective_group_ratio")
	require.NotContains(t, string(body), "ratio_source")
	require.NotContains(t, string(body), "availability_")
	require.NotContains(t, string(body), "create_cache")

	var decoded map[string]any
	require.NoError(t, common.Unmarshal(body, &decoded))
	require.ElementsMatch(t, []string{"success", "schema_version", "group", "generated_at", "models"}, mapKeys(decoded))
	decodedModels := decoded["models"].([]any)
	for _, decodedModel := range decodedModels {
		modelObject := decodedModel.(map[string]any)
		require.ElementsMatch(t, []string{"model_name", "billing_kind", "prices"}, mapKeys(modelObject))
	}
}

func TestBuildWebsitePricingV2FailsClosedOutsidePLG(t *testing.T) {
	source := fakeWebsitePricingSource{quotaPerUnit: 500_000, configuredGroup: true}
	_, err := buildWebsitePricingV2(nil, "vip", time.Unix(100, 0), source)
	require.ErrorContains(t, err, "unsupported website pricing group")

	source.configuredGroup = false
	_, err = buildWebsitePricingV2(nil, "plg", time.Unix(100, 0), source)
	require.ErrorContains(t, err, "public website group is not configured")
}

func TestBuildWebsitePricingV2UsesRuntimeDefaultAudioRatioForOutput(t *testing.T) {
	audioCompletionRatio := 3.0
	pricing := []model.Pricing{{
		ModelName: "audio-model", ModelRatio: 2, CompletionRatio: 1,
		AudioCompletionRatio: &audioCompletionRatio, EnableGroup: []string{"plg"},
	}}
	source := fakeWebsitePricingSource{
		ratios:       map[string]types.GroupRatioInfo{"audio-model": {GroupRatio: 0.5}},
		quotaPerUnit: 500_000, configuredGroup: true,
	}

	payload, err := buildWebsitePricingV2(pricing, "plg", time.Unix(100, 0), source)
	require.NoError(t, err)
	require.Nil(t, payload.Models[0].Prices.AudioInput)
	require.Equal(t, "12", payload.Models[0].Prices.AudioOutput.Configured)
	require.Equal(t, "6", payload.Models[0].Prices.AudioOutput.PLG)
}

func TestBuildWebsitePricingV2FailsAtomicallyOnInvalidSourceValues(t *testing.T) {
	negative := -1.0
	nan := math.NaN()
	valid := model.Pricing{
		ModelName: "a-valid", ModelRatio: 1, CompletionRatio: 1, EnableGroup: []string{"plg"},
	}
	tests := []struct {
		name       string
		invalid    model.Pricing
		groupRatio float64
	}{
		{name: "model ratio", invalid: model.Pricing{ModelName: "invalid", ModelRatio: math.NaN(), CompletionRatio: 1, EnableGroup: []string{"plg"}}, groupRatio: 1},
		{name: "completion ratio", invalid: model.Pricing{ModelName: "invalid", ModelRatio: 1, CompletionRatio: math.Inf(1), EnableGroup: []string{"plg"}}, groupRatio: 1},
		{name: "optional ratio", invalid: model.Pricing{ModelName: "invalid", ModelRatio: 1, CompletionRatio: 1, CacheRatio: &negative, EnableGroup: []string{"plg"}}, groupRatio: 1},
		{name: "optional NaN", invalid: model.Pricing{ModelName: "invalid", ModelRatio: 1, CompletionRatio: 1, AudioRatio: &nan, EnableGroup: []string{"plg"}}, groupRatio: 1},
		{name: "input overflow", invalid: model.Pricing{ModelName: "invalid", ModelRatio: math.MaxFloat64, CompletionRatio: 1, EnableGroup: []string{"plg"}}, groupRatio: 1},
		{name: "output overflow", invalid: model.Pricing{ModelName: "invalid", ModelRatio: 1, CompletionRatio: math.MaxFloat64, EnableGroup: []string{"plg"}}, groupRatio: 1},
		{name: "request price", invalid: model.Pricing{ModelName: "invalid", QuotaType: 1, ModelPrice: math.Inf(1), EnableGroup: []string{"plg"}}, groupRatio: 1},
		{name: "request price overflow", invalid: model.Pricing{ModelName: "invalid", QuotaType: 1, ModelPrice: math.MaxFloat64, EnableGroup: []string{"plg"}}, groupRatio: 2},
		{name: "group ratio", invalid: model.Pricing{ModelName: "invalid", ModelRatio: 1, CompletionRatio: 1, EnableGroup: []string{"plg"}}, groupRatio: math.Inf(1)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			source := fakeWebsitePricingSource{
				ratios: map[string]types.GroupRatioInfo{
					"a-valid": {GroupRatio: 1},
					"invalid": {GroupRatio: test.groupRatio},
				},
				quotaPerUnit: 500_000, configuredGroup: true,
			}

			payload, err := buildWebsitePricingV2([]model.Pricing{valid, test.invalid}, "plg", time.Unix(100, 0), source)
			require.Error(t, err)
			require.Equal(t, WebsitePricingV2{}, payload)
		})
	}
}

func TestBuildWebsiteDisplayPricingUsesPublicVideoAndPricingUnits(t *testing.T) {
	cacheRatio := 0.25
	createCacheRatio := 0.5
	audioRatio := 4.0
	audioCompletionRatio := 3.0
	oneTierVideoRules := []billing_setting.VideoPriceRule{
		{
			Model:          "one-tier-video-model",
			PricePerSecond: 0.02,
			Basis:          billing_setting.BasisOutputDuration,
		},
	}
	twoTierVideoRules := []billing_setting.VideoPriceRule{
		{
			Model:          "video-model",
			Match:          map[string]string{"resolution": "720p"},
			PricePerSecond: 0.03,
			Basis:          billing_setting.BasisOutputDuration,
		},
		{
			Model:          "video-model",
			Match:          map[string]string{"resolution": "1080p"},
			PricePerSecond: 0.08,
			Basis:          billing_setting.BasisOutputDuration,
		},
		{
			Model:          "video-model",
			Match:          map[string]string{"resolution": "2k"},
			PricePerSecond: math.NaN(),
			Basis:          billing_setting.BasisOutputDuration,
		},
	}
	pricing := []model.Pricing{
		{
			ModelName: "video-model", EnableGroup: []string{"plg"},
		},
		{
			ModelName: "one-tier-video-model", EnableGroup: []string{"plg"},
		},
		{
			ModelName: "request-model", QuotaType: 1, ModelPrice: 0.04, EnableGroup: []string{"plg"},
		},
		{
			ModelName: "token-model", ModelRatio: 2, CompletionRatio: 3, EnableGroup: []string{"plg"},
			CacheRatio: &cacheRatio, CreateCacheRatio: &createCacheRatio, AudioRatio: &audioRatio, AudioCompletionRatio: &audioCompletionRatio,
		},
	}
	source := fakeWebsitePricingSource{
		ratios: map[string]types.GroupRatioInfo{
			"video-model":          {GroupRatio: 0.5},
			"one-tier-video-model": {GroupRatio: 0.5},
			"request-model":        {GroupRatio: 0.5},
			"token-model":          {GroupRatio: 0.5},
		},
		quotaPerUnit:    500_000,
		configuredGroup: true,
		videoRules:      append(twoTierVideoRules, oneTierVideoRules...),
	}

	displayPricing, err := buildWebsiteDisplayPricing(pricing, "plg", source)
	require.NoError(t, err)
	require.Len(t, displayPricing, 4)
	require.Contains(t, displayPricing, "video-model")
	require.Contains(t, displayPricing, "one-tier-video-model")
	require.Contains(t, displayPricing, "request-model")
	require.Contains(t, displayPricing, "token-model")
	require.Equal(t, "per_second", displayPricing["video-model"].BillingKind)
	require.Equal(t, "0.03", displayPricing["video-model"].Prices.Second.Configured)
	require.Equal(t, "0.015", displayPricing["video-model"].Prices.Second.PLG)
	require.True(t, displayPricing["video-model"].Prices.Second.From)
	require.Equal(t, "per_second", displayPricing["one-tier-video-model"].BillingKind)
	require.Equal(t, "0.02", displayPricing["one-tier-video-model"].Prices.Second.Configured)
	require.Equal(t, "0.01", displayPricing["one-tier-video-model"].Prices.Second.PLG)
	require.False(t, displayPricing["one-tier-video-model"].Prices.Second.From)
	require.Equal(t, "request", displayPricing["request-model"].BillingKind)
	require.Equal(t, "0.04", displayPricing["request-model"].Prices.Request.Configured)
	require.Equal(t, "0.02", displayPricing["request-model"].Prices.Request.PLG)
	require.Nil(t, displayPricing["request-model"].Prices.Second)
	require.Equal(t, "token", displayPricing["token-model"].BillingKind)
	require.Equal(t, "4", displayPricing["token-model"].Prices.Input.Configured)
	require.Equal(t, "2", displayPricing["token-model"].Prices.Input.PLG)
	require.Equal(t, "12", displayPricing["token-model"].Prices.Output.Configured)
	require.Equal(t, "6", displayPricing["token-model"].Prices.Output.PLG)
	require.Equal(t, "1", displayPricing["token-model"].Prices.Cache.Configured)
	require.Equal(t, "0.5", displayPricing["token-model"].Prices.Cache.PLG)
	require.Equal(t, "2", displayPricing["token-model"].Prices.CreateCache.Configured)
	require.Equal(t, "1", displayPricing["token-model"].Prices.CreateCache.PLG)
	require.Equal(t, "16", displayPricing["token-model"].Prices.AudioInput.Configured)
	require.Equal(t, "8", displayPricing["token-model"].Prices.AudioInput.PLG)
	require.Equal(t, "48", displayPricing["token-model"].Prices.AudioOutput.Configured)
	require.Equal(t, "24", displayPricing["token-model"].Prices.AudioOutput.PLG)
}

func TestBuildWebsiteDisplayPricingIgnoresInvalidVideoRules(t *testing.T) {
	pricing := []model.Pricing{{
		ModelName:   "invalid-video-rule-model",
		QuotaType:   1,
		ModelPrice:  0.04,
		EnableGroup: []string{"plg"},
	}}
	source := fakeWebsitePricingSource{
		ratios:          map[string]types.GroupRatioInfo{"invalid-video-rule-model": {GroupRatio: 0.5}},
		quotaPerUnit:    500_000,
		configuredGroup: true,
		videoRules: []billing_setting.VideoPriceRule{
			{Model: "invalid-video-rule-model", PricePerSecond: math.NaN()},
			{Model: "invalid-video-rule-model", PricePerSecond: 0},
			{Model: "invalid-video-rule-model", PricePerSecond: -1},
		},
	}

	displayPricing, err := buildWebsiteDisplayPricing(pricing, "plg", source)
	require.NoError(t, err)
	require.Equal(t, "request", displayPricing["invalid-video-rule-model"].BillingKind)
	require.Nil(t, displayPricing["invalid-video-rule-model"].Prices.Second)
	require.Equal(t, "0.04", displayPricing["invalid-video-rule-model"].Prices.Request.Configured)
}

func mapKeys(value map[string]any) []string {
	keys := make([]string, 0, len(value))
	for key := range value {
		keys = append(keys, key)
	}
	return keys
}
