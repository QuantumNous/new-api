package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func imageAPIParameterByName(t *testing.T, profile *ImageAPIProfile, name string) ImageAPIParameter {
	t.Helper()
	require.NotNil(t, profile)
	for _, parameter := range profile.Parameters {
		if parameter.Name == name {
			return parameter
		}
	}
	require.FailNow(t, "image API parameter not found", name)
	return ImageAPIParameter{}
}

func TestNanoBanana2ImageAPIProfileMatchesRuntimeCapabilities(t *testing.T) {
	profile := ImageAPIProfileForModel("models/gemini-3.1-flash-image-preview")

	assert.Equal(t, "image", profile.Kind)
	assert.Equal(t, ImageGenerationEndpoint, profile.Endpoint)
	assert.True(t, profile.Async)
	assert.Equal(t, ImageGenerationPollPath, profile.PollEndpoint)
	assert.True(t, profile.Webhook)
	assert.Equal(t, ImageResultDeliveryOSSURL, profile.ResultDelivery)
	assert.Equal(t, []string{"generation", "edit"}, profile.Operations)

	imageInput := imageAPIParameterByName(t, profile, "image_input")
	require.NotNil(t, imageInput.MaxItems)
	assert.Equal(t, MaxGeminiImageInputURLs, *imageInput.MaxItems)

	aspectRatio := imageAPIParameterByName(t, profile, "aspect_ratio")
	assert.Equal(t, "auto", aspectRatio.Default)
	assert.Contains(t, aspectRatio.EnumValues, "1:8")
	assert.Contains(t, aspectRatio.EnumValues, "21:9")

	resolution := imageAPIParameterByName(t, profile, "resolution")
	assert.Equal(t, []string{"512", "1K", "2K", "4K"}, resolution.EnumValues)
	assert.NotContains(t, parameterNames(profile.Parameters), "output_format")
	n := imageAPIParameterByName(t, profile, "n")
	require.NotNil(t, n.Max)
	assert.Equal(t, 1, *n.Max)
}

func TestGPTImage2ProfileAndValidatorShareCombinationMatrix(t *testing.T) {
	capabilities := ImageModelCapabilitiesForModel("gpt-image-2-image-to-image")
	profile := ImageAPIProfileForModel("gpt-image-2-image-to-image")

	assert.Equal(t, ImageModelFamilyGPTImage2, capabilities.Family)
	assert.Equal(t, []string{"edit"}, profile.Operations)
	require.Len(t, profile.Constraints, 1)
	assert.Equal(t, "allowed_combinations", profile.Constraints[0].Type)
	assert.Equal(t, []string{"resolution", "aspect_ratio", "size"}, profile.Constraints[0].Fields)
	assert.Len(t, profile.Constraints[0].Combinations, 16)

	for _, combination := range profile.Constraints[0].Combinations {
		size, ok := capabilities.SizeFor(combination.Resolution, combination.AspectRatio)
		assert.True(t, ok, "%s %s", combination.Resolution, combination.AspectRatio)
		assert.Equal(t, combination.Size, size)
	}
	_, ok := capabilities.SizeFor("4K", "auto")
	assert.False(t, ok)
}

func TestGenericImageAPIProfileIsConservative(t *testing.T) {
	profile := ImageAPIProfileForModel("future-provider-image-model")

	assert.Equal(t, []string{"generation"}, profile.Operations)
	assert.Empty(t, profile.Constraints)
	assert.NotContains(t, parameterNames(profile.Parameters), "aspect_ratio")
	assert.NotContains(t, parameterNames(profile.Parameters), "resolution")
	assert.NotContains(t, parameterNames(profile.Parameters), "image_input")

	n := imageAPIParameterByName(t, profile, "n")
	require.NotNil(t, n.Max)
	assert.Equal(t, 1, *n.Max)
	responseFormat := imageAPIParameterByName(t, profile, "response_format")
	assert.Equal(t, []string{"url"}, responseFormat.EnumValues)
	assert.Equal(t, "string", imageAPIParameterByName(t, profile, "webhook_url").Type)
	assert.Equal(t, "string", imageAPIParameterByName(t, profile, "webhook_secret").Type)
}

func TestImageCatalogEntriesHaveExplicitCapabilityProfiles(t *testing.T) {
	models := []string{
		"dall-e-3",
		"dall-e-2",
		"gpt-image-2",
		"chatgpt-image-latest",
		"imagen-4.0-generate-001",
		"gemini-2.5-flash-image",
		"gemini-3.1-flash-image-preview",
		"nano-banana",
		"black-forest-labs/flux-1.1-pro",
		"flux-1-schnell",
		"flux.1-dev",
		"grok-imagine-image",
		"grok-2-image-1212",
		"image-01",
		"seedream-4.0",
		"doubao-seedream-4.0",
		"qwen-image",
		"qwen-image-edit-plus",
		"z-image-turbo",
		"wanx-v1",
		"wan2.6-t2i",
		"jimeng_v21",
		"instantx/instantid",
		"bytedance/sdxl-lightning",
	}

	for _, model := range models {
		t.Run(model, func(t *testing.T) {
			capabilities := ImageModelCapabilitiesForModel(model)
			assert.NotEqual(t, ImageModelFamilyGeneric, capabilities.Family)
			profile := ImageAPIProfileForCapabilities(capabilities)
			assert.NotEmpty(t, profile.Parameters)
		})
	}
}

func TestGPTImageProfileEnumeratesResponsesToolOptions(t *testing.T) {
	profile := ImageAPIProfileForModel("gpt-image-2")

	assert.Contains(t, parameterNames(profile.Parameters), "output_compression")
	assert.Contains(t, parameterNames(profile.Parameters), "background")
	assert.Contains(t, parameterNames(profile.Parameters), "moderation")

	compression := imageAPIParameterByName(t, profile, "output_compression")
	require.NotNil(t, compression.Min)
	require.NotNil(t, compression.Max)
	assert.Equal(t, 0, *compression.Min)
	assert.Equal(t, 100, *compression.Max)
	assert.Equal(t, []string{"auto", "opaque", "transparent"}, imageAPIParameterByName(t, profile, "background").EnumValues)
	assert.Equal(t, []string{"auto", "low"}, imageAPIParameterByName(t, profile, "moderation").EnumValues)
}

func TestGPTImageProfileKeepsUnifiedDimensionsOptionalWhenUpstreamDefaultsToAuto(t *testing.T) {
	profile := ImageAPIProfileForModel("gpt-image-2")

	assert.Nil(t, imageAPIParameterByName(t, profile, "aspect_ratio").Default)
	assert.Nil(t, imageAPIParameterByName(t, profile, "resolution").Default)
	assert.Equal(t, "auto", imageAPIParameterByName(t, profile, "size").Default)
}

func TestNativeImageResolutionAliasesDoNotAcceptHalfK(t *testing.T) {
	assert.False(t, IsKnownNativeImageResolution("0.5K"))
	assert.True(t, IsKnownNativeImageResolution("512"))
}

func TestImagenProfilePublishesOfficialDimensionAndCountLimits(t *testing.T) {
	profile := ImageAPIProfileForModel("imagen-4.0-generate-001")

	assert.Equal(t, []string{"1:1", "3:4", "4:3", "9:16", "16:9"}, imageAPIParameterByName(t, profile, "aspect_ratio").EnumValues)
	assert.Equal(t, []string{"1K", "2K"}, imageAPIParameterByName(t, profile, "resolution").EnumValues)
	n := imageAPIParameterByName(t, profile, "n")
	require.NotNil(t, n.Max)
	assert.Equal(t, 4, *n.Max)
	assert.NotContains(t, parameterNames(profile.Parameters), "output_format")
	assert.NotContains(t, parameterNames(profile.Parameters), "size")
	assert.NotContains(t, parameterNames(profile.Parameters), "quality")
}

func TestSeedreamProfileOnlyPublishesMappedGatewayParameters(t *testing.T) {
	profile := ImageAPIProfileForModel("doubao-seedream-4-0-250828")

	assert.Equal(t, []string{"generation"}, profile.Operations)
	assert.Contains(t, parameterNames(profile.Parameters), "size")
	assert.Contains(t, parameterNames(profile.Parameters), "watermark")
	assert.Equal(t, []string{"png", "jpeg"}, imageAPIParameterByName(t, profile, "output_format").EnumValues)
	assert.NotContains(t, parameterNames(profile.Parameters), "image_input")
	n := imageAPIParameterByName(t, profile, "n")
	require.NotNil(t, n.Max)
	assert.Equal(t, 1, *n.Max)
}

func TestIntersectImageModelCapabilitiesDropsUnsatisfiableParameters(t *testing.T) {
	leftMin, leftMax := 1, 4
	rightMin, rightMax := 5, 8
	invalidMaxItems := 0
	left := ImageModelCapabilities{AdditionalParameters: []ImageAPIParameter{
		{Name: "mode", Type: "enum", EnumValues: []string{"fast"}},
		{Name: "steps", Type: "integer", Min: &leftMin, Max: &leftMax},
		{Name: "references", Type: "array", MaxItems: &invalidMaxItems},
	}}
	right := ImageModelCapabilities{AdditionalParameters: []ImageAPIParameter{
		{Name: "mode", Type: "enum", EnumValues: []string{"quality"}},
		{Name: "steps", Type: "integer", Min: &rightMin, Max: &rightMax},
		{Name: "references", Type: "array", MaxItems: &invalidMaxItems},
	}}

	intersection := IntersectImageModelCapabilities(left, right)
	assert.Empty(t, intersection.AdditionalParameters)
}

func TestIntersectImageModelCapabilitiesKeepsSatisfiableParameterIntersection(t *testing.T) {
	leftMin, leftMax := 1, 8
	rightMin, rightMax := 3, 6
	left := ImageModelCapabilities{AdditionalParameters: []ImageAPIParameter{
		{Name: "mode", Type: "enum", EnumValues: []string{"fast", "quality"}},
		{Name: "steps", Type: "integer", Min: &leftMin, Max: &leftMax},
	}}
	right := ImageModelCapabilities{AdditionalParameters: []ImageAPIParameter{
		{Name: "mode", Type: "enum", EnumValues: []string{"quality", "draft"}},
		{Name: "steps", Type: "integer", Min: &rightMin, Max: &rightMax},
	}}

	intersection := IntersectImageModelCapabilities(left, right)
	require.Len(t, intersection.AdditionalParameters, 2)
	assert.Equal(t, []string{"quality"}, intersection.AdditionalParameters[0].EnumValues)
	require.NotNil(t, intersection.AdditionalParameters[1].Min)
	require.NotNil(t, intersection.AdditionalParameters[1].Max)
	assert.Equal(t, 3, *intersection.AdditionalParameters[1].Min)
	assert.Equal(t, 6, *intersection.AdditionalParameters[1].Max)
}

func parameterNames(parameters []ImageAPIParameter) []string {
	names := make([]string, 0, len(parameters))
	for _, parameter := range parameters {
		names = append(names, parameter.Name)
	}
	return names
}
