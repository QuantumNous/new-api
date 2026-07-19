package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPricingPublishesImageAPIProfileForImageEndpoints(t *testing.T) {
	resetPricingEndpointTestTables(t)

	insertPricingEndpointChannel(t, 401, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{})
	insertPricingEndpointAbility(t, 401, "gpt-image-2")
	insertPricingEndpointAbility(t, 401, "gpt-5")

	insertPricingEndpointChannel(t, 402, constant.ChannelTypeAdvancedCustom, pricingEndpointAdvancedCustomConfig(
		dto.AdvancedCustomRoute{
			IncomingPath: "/v1/images/generations",
			UpstreamPath: "/v1/images/generations",
			Models:       []string{"future-provider-image-model"},
		},
	))
	insertPricingEndpointAbility(t, 402, "future-provider-image-model")

	InitChannelCache()
	byModel := make(map[string]Pricing)
	for _, pricing := range GetPricing() {
		byModel[pricing.ModelName] = pricing
	}

	gptProfile := byModel["gpt-image-2"].APIProfile
	require.NotNil(t, gptProfile)
	assert.Equal(t, common.ImageGenerationEndpoint, gptProfile.Endpoint)
	assert.Equal(t, common.ImageGenerationPollPath, gptProfile.PollEndpoint)
	assert.Equal(t, common.ImageResultDeliveryOSSURL, gptProfile.ResultDelivery)
	assert.NotEmpty(t, gptProfile.Parameters)
	assert.NotEmpty(t, gptProfile.Constraints)

	customProfile := byModel["future-provider-image-model"].APIProfile
	require.NotNil(t, customProfile)
	assert.Equal(t, []string{"generation"}, customProfile.Operations)
	assert.Empty(t, customProfile.Constraints)

	assert.Nil(t, byModel["gpt-5"].APIProfile)
}

func TestPricingResolvesChannelModelMappingForImageEndpointsAndProfiles(t *testing.T) {
	resetPricingEndpointTestTables(t)

	insertPricingEndpointChannelWithMapping(t, 403, constant.ChannelTypeOpenAI, `{"my-art":"image-alias","image-alias":"gpt-image-2"}`)
	insertPricingEndpointAbility(t, 403, "my-art")

	byModel := make(map[string]Pricing)
	for _, pricing := range GetPricing() {
		byModel[pricing.ModelName] = pricing
	}

	pricing := byModel["my-art"]
	assert.Contains(t, pricing.SupportedEndpointTypes, constant.EndpointTypeImageGeneration)
	require.NotNil(t, pricing.APIProfile)
	assert.Contains(t, imageProfileParameterNames(pricing.APIProfile), "aspect_ratio")
	assert.Contains(t, imageProfileParameterNames(pricing.APIProfile), "output_compression")
	n := imageProfileParameter(t, pricing.APIProfile, "n")
	require.NotNil(t, n.Max)
	assert.Equal(t, 1, *n.Max)
}

func TestPricingProfileUsesMappedProviderFamily(t *testing.T) {
	modelMapping := `{"gpt-image-2":"image-01"}`
	profile := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{{
		Ability:             Ability{Model: "gpt-image-2"},
		ChannelType:         constant.ChannelTypeOpenAI,
		ChannelModelMapping: &modelMapping,
	}})

	parameters := imageProfileParameterNames(profile)
	assert.Contains(t, parameters, "prompt_optimizer")
	assert.Contains(t, parameters, "watermark")
	assert.NotContains(t, parameters, "output_compression")
}

func TestPricingCapabilityModelFallsBackOnCycles(t *testing.T) {
	cycle := `{"my-art":"image-alias","image-alias":"my-art"}`
	selfLoop := `{"my-art":"image-alias","image-alias":"image-alias"}`

	assert.Equal(t, "my-art", pricingCapabilityModel("my-art", AbilityWithChannel{ChannelModelMapping: &cycle}))
	assert.Equal(t, "image-alias", pricingCapabilityModel("my-art", AbilityWithChannel{ChannelModelMapping: &selfLoop}))
}

func TestAliPricingProfileUsesCurrentSyncImageModelConfiguration(t *testing.T) {
	settings := model_setting.GetQwenSettings()
	originalModels := append([]string(nil), settings.SyncImageModels...)
	settings.SyncImageModels = []string{"qwen-image"}
	t.Cleanup(func() {
		settings.SyncImageModels = originalModels
	})

	qwenProfile := imageAPIProfileForPricing("qwen-image", []AbilityWithChannel{{
		Ability:     Ability{Model: "qwen-image"},
		ChannelType: constant.ChannelTypeAli,
	}})
	assert.Contains(t, imageProfileParameterNames(qwenProfile), "image_input")

	wanProfile := imageAPIProfileForPricing("wan2.7-t2i-turbo", []AbilityWithChannel{{
		Ability:     Ability{Model: "wan2.7-t2i-turbo"},
		ChannelType: constant.ChannelTypeAli,
	}})
	assert.NotContains(t, imageProfileParameterNames(wanProfile), "image_input")
}

func TestQwenConfigUpdateInvalidatesPricingCache(t *testing.T) {
	settings := model_setting.GetQwenSettings()
	originalModels := append([]string(nil), settings.SyncImageModels...)
	originalPricing := pricingMap
	originalVendors := vendorsList
	originalLastGetPricingTime := lastGetPricingTime
	t.Cleanup(func() {
		settings.SyncImageModels = originalModels
		pricingMap = originalPricing
		vendorsList = originalVendors
		lastGetPricingTime = originalLastGetPricingTime
	})

	pricingMap = []Pricing{{ModelName: "wan2.7-t2i-turbo"}}
	vendorsList = []PricingVendor{{ID: 1, Name: "test"}}
	lastGetPricingTime = time.Now()

	assert.True(t, handleConfigUpdate("qwen.sync_image_models", `["qwen-image"]`))
	assert.Nil(t, pricingMap)
	assert.Nil(t, vendorsList)
	assert.True(t, lastGetPricingTime.IsZero())
}

func TestImagePricingProfileUsesResponsesLimitOnlyForPlainOpenAIChannels(t *testing.T) {
	openAIProfile := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{{ChannelType: constant.ChannelTypeOpenAI}})
	openAIN := imageProfileParameter(t, openAIProfile, "n")
	require.NotNil(t, openAIN.Max)
	assert.Equal(t, 1, *openAIN.Max)

	adaptorProfile := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{{ChannelType: constant.ChannelTypeAdvancedCustom}})
	adaptorN := imageProfileParameter(t, adaptorProfile, "n")
	require.NotNil(t, adaptorN.Max)
	assert.Equal(t, common.MaxImageGenerationCount, *adaptorN.Max)
}

func TestGeminiImagePricingProfilesPublishOnlyVerifiedOutputControls(t *testing.T) {
	tests := []struct {
		name        string
		model       string
		channelType int
	}{
		{name: "flash 3.1", model: "gemini-3.1-flash-image-preview", channelType: constant.ChannelTypeGemini},
		{name: "pro 3", model: "gemini-3-pro-image-preview", channelType: constant.ChannelTypeGemini},
		{name: "legacy via vertex", model: "gemini-2.5-flash-image", channelType: constant.ChannelTypeVertexAi},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			profile := imageAPIProfileForPricing(test.model, []AbilityWithChannel{{ChannelType: test.channelType}})
			parameters := imageProfileParameterNames(profile)
			assert.Contains(t, parameters, "aspect_ratio")
			assert.Contains(t, parameters, "resolution")
			assert.NotContains(t, parameters, "output_format")

			n := imageProfileParameter(t, profile, "n")
			require.NotNil(t, n.Max)
			assert.Equal(t, 1, *n.Max)
		})
	}
}

func TestImagePricingProfileNarrowsFluxCapabilitiesByChannel(t *testing.T) {
	replicateProfile := imageAPIProfileForPricing("black-forest-labs/FLUX.1-schnell", []AbilityWithChannel{{ChannelType: constant.ChannelTypeReplicate}})
	replicateParameters := imageProfileParameterNames(replicateProfile)
	assert.Contains(t, replicateParameters, "aspect_ratio")
	assert.Contains(t, replicateParameters, "quality")
	assert.Contains(t, replicateParameters, "output_format")

	siliconFlowProfile := imageAPIProfileForPricing("black-forest-labs/FLUX.1-schnell", []AbilityWithChannel{{ChannelType: constant.ChannelTypeSiliconFlow}})
	siliconFlowParameters := imageProfileParameterNames(siliconFlowProfile)
	assert.Contains(t, siliconFlowParameters, "image_input")
	assert.Contains(t, siliconFlowParameters, "batch_size")
	assert.NotContains(t, siliconFlowParameters, "aspect_ratio")
	assert.NotContains(t, siliconFlowParameters, "quality")
	assert.NotContains(t, siliconFlowParameters, "output_format")
	imageInput := imageProfileParameter(t, siliconFlowProfile, "image_input")
	require.NotNil(t, imageInput.MaxItems)
	assert.Equal(t, 3, *imageInput.MaxItems)

	mixedProfile := imageAPIProfileForPricing("black-forest-labs/FLUX.1-schnell", []AbilityWithChannel{
		{ChannelType: constant.ChannelTypeReplicate},
		{ChannelType: constant.ChannelTypeSiliconFlow},
	})
	mixedParameters := imageProfileParameterNames(mixedProfile)
	assert.Contains(t, mixedParameters, "size")
	assert.Contains(t, mixedParameters, "n")
	assert.NotContains(t, mixedParameters, "image_input")
	assert.NotContains(t, mixedParameters, "aspect_ratio")
	assert.NotContains(t, mixedParameters, "quality")
	assert.NotContains(t, mixedParameters, "output_format")
	assert.NotContains(t, mixedParameters, "batch_size")

	customProfile := imageAPIProfileForPricing("black-forest-labs/FLUX.1-schnell", []AbilityWithChannel{{ChannelType: constant.ChannelTypeAdvancedCustom}})
	customParameters := imageProfileParameterNames(customProfile)
	assert.Contains(t, customParameters, "size")
	assert.Contains(t, customParameters, "n")
	assert.NotContains(t, customParameters, "aspect_ratio")
	assert.NotContains(t, customParameters, "quality")
	assert.NotContains(t, customParameters, "output_format")
}

func TestImagePricingProfileEnumeratesCatalogFamilies(t *testing.T) {
	tests := []struct {
		model       string
		family      common.ImageModelFamily
		parameter   string
		maxOutputs  int
		maxInputRef int
	}{
		{model: "chatgpt-image-latest", family: common.ImageModelFamilyChatGPTImage, parameter: "n", maxOutputs: common.MaxImageGenerationCount},
		{model: "image-01", family: common.ImageModelFamilyMiniMax, parameter: "aspect_ratio", maxOutputs: common.MaxImageGenerationCount},
		{model: "black-forest-labs/flux-1.1-pro", family: common.ImageModelFamilyFlux, parameter: "size", maxOutputs: common.MaxImageGenerationCount},
		{model: "instantx/instantid", family: common.ImageModelFamilySiliconFlow, parameter: "batch_size", maxOutputs: common.MaxImageGenerationCount, maxInputRef: 3},
		{model: "qwen-image-edit-plus", family: common.ImageModelFamilyAliImage, parameter: "parameters", maxOutputs: common.MaxImageGenerationCount, maxInputRef: common.MaxImageInputURLs},
		{model: "wan2.7-t2i-turbo", family: common.ImageModelFamilyAliImage, parameter: "parameters", maxOutputs: common.MaxImageGenerationCount, maxInputRef: common.MaxImageInputURLs},
		{model: "jimeng_v21", family: common.ImageModelFamilyJimeng, parameter: "extra_fields", maxOutputs: 1, maxInputRef: common.MaxImageInputURLs},
	}

	for _, test := range tests {
		t.Run(test.model, func(t *testing.T) {
			capabilities := common.ImageModelCapabilitiesForModel(test.model)
			assert.Equal(t, test.family, capabilities.Family)
			profile := common.ImageAPIProfileForCapabilities(capabilities)
			assert.Contains(t, imageProfileParameterNames(profile), test.parameter)
			n := imageProfileParameter(t, profile, "n")
			require.NotNil(t, n.Max)
			assert.Equal(t, test.maxOutputs, *n.Max)
			if test.maxInputRef > 0 {
				imageInput := imageProfileParameter(t, profile, "image_input")
				require.NotNil(t, imageInput.MaxItems)
				assert.Equal(t, test.maxInputRef, *imageInput.MaxItems)
			}
		})
	}
}

func imageProfileParameter(t *testing.T, profile *common.ImageAPIProfile, name string) common.ImageAPIParameter {
	t.Helper()
	require.NotNil(t, profile)
	for _, parameter := range profile.Parameters {
		if parameter.Name == name {
			return parameter
		}
	}
	require.FailNow(t, "image API parameter not found", name)
	return common.ImageAPIParameter{}
}

func imageProfileParameterNames(profile *common.ImageAPIProfile) []string {
	names := make([]string, 0, len(profile.Parameters))
	for _, parameter := range profile.Parameters {
		names = append(names, parameter.Name)
	}
	return names
}
