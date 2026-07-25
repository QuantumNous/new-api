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

func TestBuildWebsitePricingV2ReturnsDisplayReadyPLGPricesOnly(t *testing.T) {
	cacheRatio := 0.25
	audioRatio := 4.0
	audioCompletionRatio := 3.0
	pricing := []model.Pricing{
		{
			ModelName: "token-model", QuotaType: 0, ModelRatio: 2, CompletionRatio: 3,
			Description: "internal description", Icon: "internal-icon", Tags: "internal-tag", VendorID: 42,
			CacheRatio: &cacheRatio, AudioRatio: &audioRatio, AudioCompletionRatio: &audioCompletionRatio,
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

func mapKeys(value map[string]any) []string {
	keys := make([]string, 0, len(value))
	for key := range value {
		keys = append(keys, key)
	}
	return keys
}
