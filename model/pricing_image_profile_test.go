package model

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
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

func TestPricingPublishesExplicitVerifiedImageRouteForUnknownModelName(t *testing.T) {
	resetPricingEndpointTestTables(t)
	setImageResolutionPricesForPricingTest(t, `{"provider-art-v9":{"1K":0.3}}`)
	routing := verifiedImageRoutingProfile("provider-art-v9", []string{"1K"}, []string{"1024x1024"})
	insertPricingEndpointChannel(t, 409, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{ImageRouting: routing})
	insertPricingEndpointAbility(t, 409, "provider-art-v9")

	byModel := make(map[string]Pricing)
	for _, pricing := range GetPricing() {
		byModel[pricing.ModelName] = pricing
	}

	pricing, ok := byModel["provider-art-v9"]
	require.True(t, ok)
	assert.Contains(t, pricing.SupportedEndpointTypes, constant.EndpointTypeImageGeneration)
	require.NotNil(t, pricing.APIProfile)
	assert.Equal(t, []string{"generation", "edit"}, pricing.APIProfile.Operations)
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

func TestPricingProfileUnionsOnlyProductionVerifiedImageRoutes(t *testing.T) {
	setImageResolutionPricesForPricingTest(t, `{"gpt-image-2":{"1K":0.25,"4K":1.2}}`)
	oneK := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	fourK := verifiedImageRoutingProfile("gpt-image-2", []string{"4K"}, []string{"2880x2880"})
	unverified := verifiedImageRoutingProfile("gpt-image-2", []string{"2K"}, []string{"2048x2048"})
	unverified.Profiles[0].VerificationStatus = dto.ImageRoutingVerificationDocsClaimed

	profile := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{
		{ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, oneK)},
		{ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, fourK)},
		{ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, unverified)},
	})

	require.NotNil(t, profile)
	resolution := imageProfileParameter(t, profile, "resolution")
	assert.Equal(t, []string{"1K", "4K"}, resolution.EnumValues)
	assert.True(t, resolution.Required)
	size := imageProfileParameter(t, profile, "size")
	assert.Equal(t, []string{"1024x1024", "2880x2880"}, size.EnumValues)
	assert.True(t, size.Required)
	outputFormat := imageProfileParameter(t, profile, "output_format")
	assert.Equal(t, []string{"png"}, outputFormat.EnumValues)
	assert.NotContains(t, imageProfileParameterNames(profile), "output_compression")
	assert.NotContains(t, imageProfileParameterNames(profile), "background")
	assert.NotContains(t, imageProfileParameterNames(profile), "moderation")
	n := imageProfileParameter(t, profile, "n")
	require.NotNil(t, n.Max)
	assert.Equal(t, 1, *n.Max)
	require.Len(t, profile.Constraints, 1)
	assert.Equal(t, []string{"operation", "resolution", "aspect_ratio", "size", "output_format"}, profile.Constraints[0].Fields)
	assert.Equal(t, []common.ImageSizeCombination{
		{Operation: "generation", Resolution: "1K", AspectRatio: "1:1", Size: "1024x1024", OutputFormat: "png"},
		{Operation: "edit", Resolution: "1K", AspectRatio: "1:1", Size: "1024x1024", OutputFormat: "png"},
		{Operation: "generation", Resolution: "4K", AspectRatio: "1:1", Size: "2880x2880", OutputFormat: "png"},
		{Operation: "edit", Resolution: "4K", AspectRatio: "1:1", Size: "2880x2880", OutputFormat: "png"},
	}, profile.Constraints[0].Combinations)
}

func TestPricingProfilePublishesVerifiedReferenceAndOptionalParameters(t *testing.T) {
	setImageResolutionPricesForPricingTest(t, `{"gpt-image-2":{"1K":0.25}}`)
	routing := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	routing.Profiles[0].MaxReferenceImages = 4
	routing.Profiles[0].OptionalParameters = []string{"background", "moderation", "output_compression", "watermark"}

	profile := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{{
		ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, routing),
	}})

	require.NotNil(t, profile)
	imageInput := imageProfileParameter(t, profile, "image_input")
	require.NotNil(t, imageInput.MaxItems)
	assert.Equal(t, 4, *imageInput.MaxItems)
	parameterNames := imageProfileParameterNames(profile)
	assert.Contains(t, parameterNames, "watermark")
	assert.Contains(t, parameterNames, "output_compression")
	assert.Contains(t, parameterNames, "background")
	assert.Contains(t, parameterNames, "moderation")
}

func TestPricingProfileUnionsVerifiedReferenceAndOptionalCapabilities(t *testing.T) {
	setImageResolutionPricesForPricingTest(t, `{"gpt-image-2":{"1K":0.25,"4K":1.2}}`)
	oneK := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	oneK.Profiles[0].MaxReferenceImages = 2
	oneK.Profiles[0].OptionalParameters = []string{"watermark"}
	fourK := verifiedImageRoutingProfile("gpt-image-2", []string{"4K"}, []string{"2880x2880"})
	fourK.Profiles[0].MaxReferenceImages = 4
	fourK.Profiles[0].OptionalParameters = []string{"background"}

	profile := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{
		{ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, oneK)},
		{ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, fourK)},
	})

	require.NotNil(t, profile)
	imageInput := imageProfileParameter(t, profile, "image_input")
	require.NotNil(t, imageInput.MaxItems)
	assert.Equal(t, 4, *imageInput.MaxItems)
	assert.Contains(t, imageProfileParameterNames(profile), "watermark")
	assert.Contains(t, imageProfileParameterNames(profile), "background")
}

func TestPricingProfileMergesVerifiedTypedParametersDeterministically(t *testing.T) {
	setImageResolutionPricesForPricingTest(t, `{"gpt-image-2":{"1K":0.25,"4K":1.2}}`)
	oneK := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	oneK.Profiles[0].Parameters = []dto.ImageRoutingParameter{{
		Name: "style", Type: "enum", Required: true, Default: json.RawMessage(`"vivid"`),
		EnumValues: []string{"vivid"}, Description: "Provider style preset.",
	}}
	fourK := verifiedImageRoutingProfile("gpt-image-2", []string{"4K"}, []string{"2880x2880"})
	fourK.Profiles[0].Parameters = []dto.ImageRoutingParameter{{
		Name: "style", Type: "enum", EnumValues: []string{"natural"}, Description: "Provider style preset.",
	}}

	abilities := []AbilityWithChannel{
		{ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, oneK)},
		{ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, fourK)},
	}
	profile := imageAPIProfileForPricing("gpt-image-2", abilities)
	reversed := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{abilities[1], abilities[0]})

	require.NotNil(t, profile)
	require.NotNil(t, reversed)
	style := imageProfileParameter(t, profile, "style")
	reversedStyle := imageProfileParameter(t, reversed, "style")
	assert.Equal(t, []string{"natural", "vivid"}, style.EnumValues)
	assert.True(t, style.Required)
	assert.Nil(t, style.Default)
	assert.Equal(t, style, reversedStyle)
}

func TestPricingProfileMakesRouteSpecificRequiredParameterOptional(t *testing.T) {
	setImageResolutionPricesForPricingTest(t, `{"gpt-image-2":{"1K":0.25,"4K":1.2}}`)
	oneK := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	oneK.Profiles[0].Parameters = []dto.ImageRoutingParameter{{
		Name: "style", Type: "enum", Required: true, Default: json.RawMessage(`"vivid"`),
		EnumValues: []string{"vivid"}, Description: "Provider style preset.",
	}}
	fourK := verifiedImageRoutingProfile("gpt-image-2", []string{"4K"}, []string{"2880x2880"})

	profile := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{
		{ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, oneK)},
		{ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, fourK)},
	})

	require.NotNil(t, profile)
	style := imageProfileParameter(t, profile, "style")
	assert.True(t, style.Required)
	assert.Nil(t, style.Default)
}

func TestPricingProfileRequiresTypedParameterWhenVerifiedGroupsHaveDifferentDefaults(t *testing.T) {
	setImageResolutionPricesForPricingTest(t, `{"gpt-image-2":{"1K":0.25}}`)
	first := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	first.Profiles[0].Parameters = []dto.ImageRoutingParameter{{
		Name: "seed_mode", Type: "enum", EnumValues: []string{"fixed", "random"},
		Default: json.RawMessage(`"fixed"`), Description: "Provider seed mode.",
	}}
	second := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	second.Profiles[0].Parameters = []dto.ImageRoutingParameter{{
		Name: "seed_mode", Type: "enum", EnumValues: []string{"fixed", "random"},
		Default: json.RawMessage(`"random"`), Description: "Provider seed mode.",
	}}

	profile := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{
		{Ability: Ability{Group: "first"}, ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, first)},
		{Ability: Ability{Group: "second"}, ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, second)},
	})

	require.NotNil(t, profile)
	seedMode := imageProfileParameter(t, profile, "seed_mode")
	assert.True(t, seedMode.Required)
	assert.Nil(t, seedMode.Default)
}

func TestPricingProfileHidesConfiguredImageModelWithoutVerifiedRoute(t *testing.T) {
	failed := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	failed.Profiles[0].VerificationStatus = dto.ImageRoutingVerificationFailed

	profile := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{{
		ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, failed),
	}})

	assert.Nil(t, profile)
}

func TestPricingProfileFailsClosedForInvalidExplicitImageRouting(t *testing.T) {
	invalid := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	invalid.Version = dto.ImageRoutingVersion1 + 1

	profile := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{{
		ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, invalid),
	}})

	assert.Nil(t, profile)
}

func TestPricingOmitsImageOnlyModelWhenConfiguredRoutesAreUnverified(t *testing.T) {
	resetPricingEndpointTestTables(t)
	failed := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	failed.Profiles[0].VerificationStatus = dto.ImageRoutingVerificationFailed
	insertPricingEndpointChannel(t, 404, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{ImageRouting: failed})
	insertPricingEndpointAbility(t, 404, "gpt-image-2")

	for _, pricing := range GetPricing() {
		assert.NotEqual(t, "gpt-image-2", pricing.ModelName)
	}
	assert.Empty(t, GetModelSupportEndpointTypes("gpt-image-2"))
}

func TestPricingKeepsExplicitTextEndpointWhenImageRouteIsUnverified(t *testing.T) {
	resetPricingEndpointTestTables(t)
	failed := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	failed.Profiles[0].VerificationStatus = dto.ImageRoutingVerificationFailed
	insertPricingEndpointChannel(t, 407, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{ImageRouting: failed})
	insertPricingEndpointAbility(t, 407, "gpt-image-2")
	require.NoError(t, DB.Create(&Model{
		ModelName: "gpt-image-2",
		Endpoints: `{"openai":"/v1/chat/completions"}`,
		Status:    1,
		NameRule:  NameRuleExact,
	}).Error)

	var pricing *Pricing
	for _, candidate := range GetPricing() {
		if candidate.ModelName == "gpt-image-2" {
			value := candidate
			pricing = &value
			break
		}
	}
	require.NotNil(t, pricing)
	assert.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAI}, pricing.SupportedEndpointTypes)
	assert.Nil(t, pricing.APIProfile)
}

func TestPricingPublishesOnlyGroupsWithVerifiedImageRoutes(t *testing.T) {
	setImageResolutionPricesForPricingTest(t, `{"gpt-image-2":{"4K":1.2,"8K":3.5}}`)
	resetPricingEndpointTestTables(t)
	verified := verifiedImageRoutingProfile("gpt-image-2", []string{"4K"}, []string{"2880x2880"})
	failed := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	failed.Profiles[0].VerificationStatus = dto.ImageRoutingVerificationFailed
	insertPricingEndpointChannel(t, 405, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{ImageRouting: verified})
	insertPricingEndpointChannel(t, 406, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{ImageRouting: failed})
	require.NoError(t, DB.Create(&[]Ability{
		{Group: "image", Model: "gpt-image-2", ChannelId: 405, Enabled: true},
		{Group: "gpt plus", Model: "gpt-image-2", ChannelId: 406, Enabled: true},
	}).Error)

	var pricing *Pricing
	pricings := GetPricing()
	for i := range pricings {
		candidate := pricings[i]
		if candidate.ModelName == "gpt-image-2" {
			pricing = &candidate
			break
		}
	}
	require.NotNil(t, pricing)
	assert.Equal(t, []string{"image"}, pricing.EnableGroup)
	assert.Equal(t, map[string]float64{"4K": 1.2}, pricing.ImageResolutionPrices)
}

func TestVerifiedImageResolutionPricesForPricingRequiresRoutableVerifiedTiers(t *testing.T) {
	setImageResolutionPricesForPricingTest(t, `{"gpt-image-2":{"1K":0.25,"4K":1.2,"8K":3.5}}`)
	capabilities := &common.ImageModelCapabilities{
		Resolutions: []string{"1K", "4K"},
		ResolutionAspectVariants: []common.ImageSizeCombination{
			{Resolution: "1K", Size: "1024x1024"},
			{Resolution: "4K", Size: "2880x2880"},
		},
	}

	assert.Equal(t, map[string]float64{"1K": 0.25, "4K": 1.2}, verifiedImageResolutionPricesForPricing("gpt-image-2", capabilities))
	assert.Nil(t, verifiedImageResolutionPricesForPricing("gpt-image-2", &common.ImageModelCapabilities{}))
	assert.Nil(t, verifiedImageResolutionPricesForPricing("gpt-image-2", nil))
}

func TestPricingDoesNotPublishCapabilitiesMissingFromAnotherVerifiedGroup(t *testing.T) {
	setImageResolutionPricesForPricingTest(t, `{"gpt-image-2":{"1K":0.25,"4K":1.2}}`)
	oneK := verifiedImageRoutingProfile("gpt-image-2", []string{"1K"}, []string{"1024x1024"})
	fourK := verifiedImageRoutingProfile("gpt-image-2", []string{"4K"}, []string{"2880x2880"})

	profile := imageAPIProfileForPricing("gpt-image-2", []AbilityWithChannel{
		{Ability: Ability{Group: "standard"}, ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, oneK)},
		{Ability: Ability{Group: "premium"}, ChannelOtherSettingsJSON: imageRoutingSettingsJSON(t, fourK)},
	})

	assert.Nil(t, profile)
}

func setImageResolutionPricesForPricingTest(t *testing.T, value string) {
	t.Helper()
	previous := ratio_setting.ImageResolutionPrice2JSONString()
	require.NoError(t, ratio_setting.UpdateImageResolutionPriceByJSONString(value))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateImageResolutionPriceByJSONString(previous))
	})
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

func TestImageResolutionPriceUpdateInvalidatesPricingCache(t *testing.T) {
	previousPrices := ratio_setting.ImageResolutionPrice2JSONString()
	originalOptionMap := common.OptionMap
	originalPricing := pricingMap
	originalVendors := vendorsList
	originalLastGetPricingTime := lastGetPricingTime
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateImageResolutionPriceByJSONString(previousPrices))
		common.OptionMap = originalOptionMap
		pricingMap = originalPricing
		vendorsList = originalVendors
		lastGetPricingTime = originalLastGetPricingTime
	})
	common.OptionMap = make(map[string]string)

	pricingMap = []Pricing{{ModelName: "gpt-image-2", ImageResolutionPrices: map[string]float64{"1K": 0.25}}}
	vendorsList = []PricingVendor{{ID: 1, Name: "test"}}
	lastGetPricingTime = time.Now()

	require.NoError(t, updateOptionMap("ImageResolutionPrice", `{"gpt-image-2":{"1K":0.3}}`))
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

func imageRoutingSettingsJSON(t *testing.T, routing *dto.ImageRoutingConfig) string {
	t.Helper()
	data, err := common.Marshal(dto.ChannelOtherSettings{ImageRouting: routing})
	require.NoError(t, err)
	return string(data)
}
