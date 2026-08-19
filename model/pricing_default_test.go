package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInferDefaultVendorName(t *testing.T) {
	tests := []struct {
		model string
		want  string
	}{
		{model: "gpt-5.3-codex-spark", want: "OpenAI"},
		{model: "codex-auto-review", want: "OpenAI"},
		{model: "qwen3-max", want: "Alibaba"},
		{model: "glm-4.6", want: "Zhipu AI"},
		{model: "kimi-k2.5", want: "Moonshot AI"},
		{model: "doubao-seed-1.6", want: "Bytedance Seed"},
		{model: "hunyuan-t1", want: "Tencent"},
		{model: "@cf/meta/model", want: "Cloudflare"},
		{model: "ernie-4.5", want: "百度"},
		{model: "spark-max-32k", want: "讯飞"},
		{model: "abab6.5s-chat", want: "MiniMax"},
		{model: "360-model", want: "360"},
		{model: "yi-large", want: "零一万物"},
		{model: "jina-embeddings-v3", want: "Jina"},
		{model: "kling-v1", want: "快手"},
		{model: "jimeng-v1", want: "即梦"},
		{model: "vidu-v1", want: "Vidu"},
		{model: "gpt-4o,claude-3-5-sonnet", want: ""},
		{model: "unknown-provider-model", want: ""},
	}

	for _, test := range tests {
		t.Run(test.model, func(t *testing.T) {
			for range 100 {
				assert.Equal(t, test.want, inferDefaultVendorName(test.model))
			}
		})
	}
}

func TestDefaultVendorIconsSupportCanonicalLabNames(t *testing.T) {
	tests := map[string]string{
		"Alibaba":        "Qwen.Color",
		"Moonshot AI":    "Moonshot",
		"Zhipu AI":       "Zhipu.Color",
		"Bytedance Seed": "Doubao.Color",
		"Tencent":        "Hunyuan.Color",
	}

	for vendor, want := range tests {
		t.Run(vendor, func(t *testing.T) {
			assert.Equal(t, want, getDefaultVendorIcon(vendor))
		})
	}
}

func pricingByName(pricings []Pricing) map[string]Pricing {
	result := make(map[string]Pricing, len(pricings))
	for _, pricing := range pricings {
		result[pricing.ModelName] = pricing
	}
	return result
}

func TestPricingVendorInferenceUsesModelLabAndPreservesMetadata(t *testing.T) {
	resetPricingEndpointTestTables(t)

	require.NoError(t, DB.Create(&Vendor{Id: 90, Name: "Configured Vendor", Status: 1}).Error)
	require.NoError(t, DB.Create(&Model{
		ModelName: "configured-",
		VendorID:  90,
		Status:    1,
		NameRule:  NameRulePrefix,
	}).Error)
	require.NoError(t, DB.Create(&Model{
		ModelName: "contains-marker",
		VendorID:  90,
		Status:    1,
		NameRule:  NameRuleContains,
	}).Error)
	require.NoError(t, DB.Create(&Model{
		ModelName: "-configured-suffix",
		VendorID:  90,
		Status:    1,
		NameRule:  NameRuleSuffix,
	}).Error)
	require.NoError(t, DB.Create(&Model{
		ModelName: "gpt-platform-model",
		VendorID:  0,
		Status:    1,
		NameRule:  NameRuleExact,
	}).Error)

	insertPricingEndpointChannel(t, 601, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{})
	for _, modelName := range []string{
		"gpt-5.3-codex-spark",
		"codex-auto-review",
		"configured-model",
		"model-contains-marker-value",
		"model-configured-suffix",
		"gpt-platform-model",
		"unknown-provider-model",
		"gpt-compact-vendor",
	} {
		insertPricingEndpointAbility(t, 601, modelName)
	}

	InitChannelCache()
	byName := pricingByName(GetPricing())

	spark := byName["gpt-5.3-codex-spark"]
	review := byName["codex-auto-review"]
	require.NotZero(t, spark.VendorID)
	assert.Equal(t, spark.VendorID, review.VendorID)
	assert.Equal(t, "OpenAI", spark.OwnerBy)
	assert.Equal(t, "OpenAI", review.OwnerBy)
	assert.Equal(t, 90, byName["configured-model"].VendorID)
	assert.Equal(t, "Configured Vendor", byName["configured-model"].OwnerBy)
	assert.Equal(t, 90, byName["model-contains-marker-value"].VendorID)
	assert.Equal(t, "Configured Vendor", byName["model-contains-marker-value"].OwnerBy)
	assert.Equal(t, 90, byName["model-configured-suffix"].VendorID)
	assert.Equal(t, "Configured Vendor", byName["model-configured-suffix"].OwnerBy)
	assert.Zero(t, byName["gpt-platform-model"].VendorID)
	assert.Empty(t, byName["gpt-platform-model"].OwnerBy)
	assert.Zero(t, byName["unknown-provider-model"].VendorID)
	assert.Empty(t, byName["unknown-provider-model"].OwnerBy)

	base := byName["gpt-compact-vendor"]
	compact := byName["gpt-compact-vendor-openai-compact"]
	assert.Equal(t, base.VendorID, compact.VendorID)
	assert.Equal(t, "OpenAI", compact.OwnerBy)
	assert.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAIResponseCompact}, compact.SupportedEndpointTypes)

	var inferredMetadataCount int64
	require.NoError(t, DB.Model(&Model{}).Where("model_name IN ?", []string{
		"gpt-5.3-codex-spark",
		"codex-auto-review",
		"gpt-compact-vendor",
	}).Count(&inferredMetadataCount).Error)
	assert.Zero(t, inferredMetadataCount)

	var openAIVendorCount int64
	require.NoError(t, DB.Model(&Vendor{}).Where("name = ?", "OpenAI").Count(&openAIVendorCount).Error)
	assert.EqualValues(t, 1, openAIVendorCount)
}
