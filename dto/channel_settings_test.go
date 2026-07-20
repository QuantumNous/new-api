package dto

import (
	"regexp"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdvancedCustomValidateResponsesToChatConverterPath(t *testing.T) {
	valid := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/chat/completions",
				Converter:    advancedCustomConverterOpenAIResponsesToOpenAIChat,
			},
		},
	}
	require.NoError(t, valid.Validate())

	validGemini := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Converter:    advancedCustomConverterOpenAIResponsesToGemini,
			},
		},
	}
	require.NoError(t, validGemini.Validate())

	tests := []struct {
		name         string
		incomingPath string
	}{
		{name: "chat completions", incomingPath: "/v1/chat/completions"},
		{name: "responses compact", incomingPath: "/v1/responses/compact"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &AdvancedCustomConfig{
				Routes: []AdvancedCustomRoute{
					{
						IncomingPath: tt.incomingPath,
						UpstreamPath: "/v1/chat/completions",
						Converter:    advancedCustomConverterOpenAIResponsesToOpenAIChat,
					},
				},
			}
			err := config.Validate()
			require.Error(t, err)
			assert.Contains(t, err.Error(), "converter does not match incoming_path")
		})
	}
}

func TestValidateAdvancedCustomUpstreamTargetRejectsEmbeddedCredentials(t *testing.T) {
	tests := []struct {
		name   string
		target string
	}{
		{name: "userinfo", target: "https://user:password@example.com/v1/images"},
		{name: "api key query", target: "https://example.com/v1/images?api_key=secret"},
		{name: "signed query", target: "https://example.com/v1/images?X-Amz-Signature=secret"},
		{name: "fragment", target: "https://example.com/v1/images#secret"},
		{name: "relative api key query", target: "/v1/images?api_key=secret"},
		{name: "relative signed query", target: "/v1/images?X-Amz-Signature=secret"},
		{name: "relative fragment", target: "/v1/images#secret"},
		{name: "malformed credential query", target: "https://example.com/v1/images?api_key=secret;foo=bar"},
		{name: "malformed relative credential query", target: "/v1/images?api_key=secret;foo=bar"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Error(t, validateAdvancedCustomUpstreamTarget(0, test.target))
		})
	}

	require.NoError(t, validateAdvancedCustomUpstreamTarget(0, "https://example.com/v1/images?api-version=2026-01-01"))
	require.NoError(t, validateAdvancedCustomUpstreamTarget(0, "/v1/images?api-version=2026-01-01"))
}

func TestAdvancedCustomValidateDuplicateIncomingPathWithDisjointModels(t *testing.T) {
	config := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/chat/completions",
				Converter:    advancedCustomConverterOpenAIResponsesToOpenAIChat,
				Models:       []string{"gpt-4o"},
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Converter:    advancedCustomConverterOpenAIResponsesToGemini,
				Models:       []string{"gemini-2.5-flash"},
			},
		},
	}

	require.NoError(t, config.Validate())
}

func TestAdvancedCustomValidateDuplicateIncomingPathRejectsOverlappingModels(t *testing.T) {
	config := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/chat/completions",
				Converter:    advancedCustomConverterOpenAIResponsesToOpenAIChat,
				Models:       []string{"shared-model"},
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Converter:    advancedCustomConverterOpenAIResponsesToGemini,
				Models:       []string{"shared-model"},
			},
		},
	}

	err := config.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "models overlaps")
}

func TestAdvancedCustomValidateDuplicateIncomingPathRejectsMultipleCatchAllRoutes(t *testing.T) {
	config := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/chat/completions",
				Converter:    advancedCustomConverterOpenAIResponsesToOpenAIChat,
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Converter:    advancedCustomConverterOpenAIResponsesToGemini,
			},
		},
	}

	err := config.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "catch-all already exists")
}

func TestAdvancedCustomValidateDuplicateIncomingPathRequiresCatchAllLast(t *testing.T) {
	config := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/chat/completions",
				Converter:    advancedCustomConverterOpenAIResponsesToOpenAIChat,
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Converter:    advancedCustomConverterOpenAIResponsesToGemini,
				Models:       []string{"gemini-2.5-flash"},
			},
		},
	}

	err := config.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "catch-all route must be last")
}

func TestAdvancedCustomMatchPathForModel(t *testing.T) {
	config := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Converter:    advancedCustomConverterOpenAIResponsesToGemini,
				Models:       []string{"gemini-2.5-flash"},
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/chat/completions",
				Converter:    advancedCustomConverterOpenAIResponsesToOpenAIChat,
				Models:       []string{"gpt-4o"},
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/responses",
				Converter:    advancedCustomConverterNone,
			},
		},
	}
	require.NoError(t, config.Validate())

	geminiRoute, ok := config.MatchPathForModel("/v1/responses", "gemini-2.5-flash")
	require.True(t, ok)
	assert.Equal(t, advancedCustomConverterOpenAIResponsesToGemini, geminiRoute.Converter)

	chatRoute, ok := config.MatchPathForModel("/v1/responses", "gpt-4o")
	require.True(t, ok)
	assert.Equal(t, advancedCustomConverterOpenAIResponsesToOpenAIChat, chatRoute.Converter)

	fallbackRoute, ok := config.MatchPathForModel("/v1/responses", "unknown-model")
	require.True(t, ok)
	assert.Equal(t, advancedCustomConverterNone, fallbackRoute.Converter)
}

func TestAdvancedCustomMatchPathForModelRegexRules(t *testing.T) {
	config := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Converter:    advancedCustomConverterOpenAIResponsesToGemini,
				Models:       []string{"re:^gemini-"},
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/chat/completions",
				Converter:    advancedCustomConverterOpenAIResponsesToOpenAIChat,
				Models:       []string{"re:(?i)^OAI-"},
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/responses",
				Converter:    advancedCustomConverterNone,
			},
		},
	}
	require.NoError(t, config.Validate())

	geminiRoute, ok := config.MatchPathForModel("/v1/responses", "gemini-2.5-flash")
	require.True(t, ok)
	assert.Equal(t, advancedCustomConverterOpenAIResponsesToGemini, geminiRoute.Converter)

	chatRoute, ok := config.MatchPathForModel("/v1/responses", "oai-test")
	require.True(t, ok)
	assert.Equal(t, advancedCustomConverterOpenAIResponsesToOpenAIChat, chatRoute.Converter)

	fallbackRoute, ok := config.MatchPathForModel("/v1/responses", "gpt-4o")
	require.True(t, ok)
	assert.Equal(t, advancedCustomConverterNone, fallbackRoute.Converter)
}

func TestAdvancedCustomRouteModelRegexRulesAreCachedCompiled(t *testing.T) {
	require.True(t, matchAdvancedCustomRouteModelRule("re:^cache-probe-", "cache-probe-model"))

	cached, ok := advancedCustomModelRegexCache.Load("^cache-probe-")
	require.True(t, ok)
	require.NotNil(t, cached)
	_, isRegexp := cached.(*regexp.Regexp)
	require.True(t, isRegexp)

	// Invalid patterns never match and are cached as nil so they are not recompiled.
	require.False(t, matchAdvancedCustomRouteModelRule("re:(", "anything"))
	cached, ok = advancedCustomModelRegexCache.Load("(")
	require.True(t, ok)
	re, _ := cached.(*regexp.Regexp)
	require.Nil(t, re)

	// Cached entries keep matching correctly on subsequent calls.
	require.True(t, matchAdvancedCustomRouteModelRule("re:^cache-probe-", "cache-probe-other"))
	require.False(t, matchAdvancedCustomRouteModelRule("re:^cache-probe-", "other-model"))
}

func TestAdvancedCustomMatchPathForModelExactRuleDoesNotMatchPrefix(t *testing.T) {
	config := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Converter:    advancedCustomConverterOpenAIResponsesToGemini,
				Models:       []string{"gemini"},
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/responses",
				Converter:    advancedCustomConverterNone,
			},
		},
	}
	require.NoError(t, config.Validate())

	fallbackRoute, ok := config.MatchPathForModel("/v1/responses", "gemini-2.5-flash")
	require.True(t, ok)
	assert.Equal(t, advancedCustomConverterNone, fallbackRoute.Converter)
}

func TestAdvancedCustomValidateDuplicateIncomingPathRejectsInvalidRegexModels(t *testing.T) {
	tests := []struct {
		name   string
		models []string
		want   string
	}{
		{name: "empty regex", models: []string{"re:"}, want: "regex is empty"},
		{name: "invalid regex", models: []string{"re:["}, want: "regex is invalid"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &AdvancedCustomConfig{
				Routes: []AdvancedCustomRoute{
					{
						IncomingPath: "/v1/responses",
						UpstreamPath: "/v1beta/models/{model}:generateContent",
						Converter:    advancedCustomConverterOpenAIResponsesToGemini,
						Models:       tt.models,
					},
				},
			}

			err := config.Validate()
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.want)
		})
	}
}

func TestAdvancedCustomValidateDuplicateIncomingPathRejectsDuplicateRegexModels(t *testing.T) {
	config := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Converter:    advancedCustomConverterOpenAIResponsesToGemini,
				Models:       []string{"re:^gemini-"},
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/chat/completions",
				Converter:    advancedCustomConverterOpenAIResponsesToOpenAIChat,
				Models:       []string{"re:^gemini-"},
			},
		},
	}

	err := config.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "models overlaps")
}

func TestAdvancedCustomMatchPathForModelUsesFirstMatchingRegexRoute(t *testing.T) {
	config := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Converter:    advancedCustomConverterOpenAIResponsesToGemini,
				Models:       []string{"re:^gemini-"},
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/chat/completions",
				Converter:    advancedCustomConverterOpenAIResponsesToOpenAIChat,
				Models:       []string{"gemini-2.5-flash"},
			},
		},
	}
	require.NoError(t, config.Validate())

	route, ok := config.MatchPathForModel("/v1/responses", "gemini-2.5-flash")
	require.True(t, ok)
	assert.Equal(t, advancedCustomConverterOpenAIResponsesToGemini, route.Converter)
}

func TestAdvancedCustomSupportedEndpointTypesForModel(t *testing.T) {
	config := &AdvancedCustomConfig{
		Routes: []AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Converter:    advancedCustomConverterOpenAIResponsesToGemini,
				Models:       []string{"re:^gemini-"},
			},
			{
				IncomingPath: "/v1beta/models/{model}:generateContent",
				UpstreamPath: "/v1beta/models/{model}:generateContent",
				Models:       []string{"re:^gemini-"},
			},
			{
				IncomingPath: "/v1beta/models/{model}:streamGenerateContent",
				UpstreamPath: "/v1beta/models/{model}:streamGenerateContent",
				Models:       []string{"re:^gemini-"},
			},
			{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "/v1/chat/completions",
				Models:       []string{"gpt-4o"},
			},
			{
				IncomingPath: "/v1/messages",
				UpstreamPath: "/v1/messages",
			},
			{
				IncomingPath: "/custom/endpoint",
				UpstreamPath: "/custom/endpoint",
			},
		},
	}
	require.NoError(t, config.Validate())

	assert.Equal(t, []constant.EndpointType{
		constant.EndpointTypeOpenAIResponse,
		constant.EndpointTypeGemini,
		constant.EndpointTypeAnthropic,
	}, config.SupportedEndpointTypesForModel("gemini-2.5-flash"))
	assert.Equal(t, []constant.EndpointType{
		constant.EndpointTypeOpenAI,
		constant.EndpointTypeAnthropic,
	}, config.SupportedEndpointTypesForModel("gpt-4o"))
	assert.Equal(t, []constant.EndpointType{
		constant.EndpointTypeAnthropic,
	}, config.SupportedEndpointTypesForModel("other-model"))
}

func TestImageRoutingConfigValidatesAndMatchesVerifiedModelProfile(t *testing.T) {
	config := &ImageRoutingConfig{
		Version: ImageRoutingVersion1,
		Profiles: []ImageRoutingProfile{
			{
				Model:              "gpt-image-2",
				Protocol:           ImageRoutingProtocolImagesGenerations,
				UpstreamPath:       "/v1/images/generations",
				Operations:         []ImageOperation{ImageOperationGeneration, ImageOperationEdit},
				Resolutions:        []string{"1K", "4K"},
				AspectRatios:       []string{"1:1", "16:9"},
				Sizes:              []string{"1024x1024", "2880x2880", "3840x2160"},
				Qualities:          []string{"low", "high"},
				VerificationStatus: ImageRoutingVerificationProductionVerified,
				AllowedCombinations: []ImageRoutingCombination{
					{Resolution: "1K", AspectRatio: "1:1", Size: "1024x1024"},
					{Resolution: "4K", AspectRatio: "1:1", Size: "2880x2880"},
					{Resolution: "4K", AspectRatio: "16:9", Size: "3840x2160"},
				},
			},
		},
	}

	require.NoError(t, config.Validate())

	profile, ok := config.ProfileForModel("gpt-image-2")
	require.True(t, ok)
	assert.Equal(t, ImageRoutingProtocolImagesGenerations, profile.Protocol)
	assert.True(t, config.Supports("gpt-image-2", ImageSelectionRequirement{
		Operation:   ImageOperationGeneration,
		Resolution:  "4k",
		AspectRatio: "16:9",
		Size:        "3840X2160",
		Quality:     "LOW",
	}))
	assert.False(t, config.Supports("gpt-image-2", ImageSelectionRequirement{
		Operation:   ImageOperationGeneration,
		Resolution:  "1K",
		AspectRatio: "16:9",
		Size:        "1024x1024",
		Quality:     "low",
	}))
	assert.False(t, config.Supports("other-model", ImageSelectionRequirement{
		Operation:  ImageOperationGeneration,
		Resolution: "4K",
	}))
}

func TestImageRoutingConfigWildcardProfileAndVerificationGate(t *testing.T) {
	config := &ImageRoutingConfig{
		Version: ImageRoutingVersion1,
		Profiles: []ImageRoutingProfile{
			{
				Model:              "*",
				Protocol:           ImageRoutingProtocolAdapter,
				UpstreamPath:       "/v1/custom/images",
				Operations:         []ImageOperation{ImageOperationGeneration},
				VerificationStatus: ImageRoutingVerificationDocsClaimed,
			},
		},
	}

	require.NoError(t, config.Validate())
	profile, ok := config.ProfileForModel("vendor-image-model")
	require.True(t, ok)
	assert.Equal(t, "*", profile.Model)
	assert.False(t, config.Supports("vendor-image-model", ImageSelectionRequirement{
		Operation: ImageOperationGeneration,
	}))

	config.Profiles[0].VerificationStatus = ImageRoutingVerificationProductionVerified
	require.NoError(t, config.Validate())
	assert.True(t, config.Supports("vendor-image-model", ImageSelectionRequirement{
		Operation: ImageOperationGeneration,
	}))
}

func TestImageSelectionRequirementNormalizeAndValidate(t *testing.T) {
	normalized, err := (ImageSelectionRequirement{
		Operation:   " EDIT ",
		Resolution:  "4k",
		AspectRatio: " 1:1 ",
		Size:        "2880X2880",
		Quality:     " HIGH ",
	}).Normalize()
	require.NoError(t, err)
	assert.Equal(t, ImageSelectionRequirement{
		Operation:   ImageOperationEdit,
		Resolution:  "4K",
		AspectRatio: "1:1",
		Size:        "2880x2880",
		Quality:     "high",
	}, normalized)

	_, err = (ImageSelectionRequirement{Operation: ImageOperationGeneration, Size: "2880-by-2880"}).Normalize()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "size")
}

func TestImageRoutingConfigRejectsInvalidProfiles(t *testing.T) {
	validProfile := ImageRoutingProfile{
		Model:              "gpt-image-2",
		Protocol:           ImageRoutingProtocolImagesGenerations,
		UpstreamPath:       "/v1/images/generations",
		Operations:         []ImageOperation{ImageOperationGeneration},
		Resolutions:        []string{"1K", "4K"},
		AspectRatios:       []string{"1:1"},
		Sizes:              []string{"1024x1024", "2880x2880"},
		VerificationStatus: ImageRoutingVerificationProductionVerified,
		AllowedCombinations: []ImageRoutingCombination{
			{Resolution: "1K", AspectRatio: "1:1", Size: "1024x1024"},
			{Resolution: "4K", AspectRatio: "1:1", Size: "2880x2880"},
		},
	}

	tests := []struct {
		name   string
		mutate func(*ImageRoutingConfig)
		want   string
	}{
		{name: "unsupported version", mutate: func(c *ImageRoutingConfig) { c.Version = 2 }, want: "version"},
		{name: "profiles required", mutate: func(c *ImageRoutingConfig) { c.Profiles = nil }, want: "at least one profile"},
		{name: "duplicate model", mutate: func(c *ImageRoutingConfig) { c.Profiles = append(c.Profiles, validProfile) }, want: "duplicate model"},
		{name: "invalid protocol", mutate: func(c *ImageRoutingConfig) { c.Profiles[0].Protocol = "magic" }, want: "protocol"},
		{name: "protocol path mismatch", mutate: func(c *ImageRoutingConfig) { c.Profiles[0].UpstreamPath = "/v1/responses" }, want: "upstream_path"},
		{name: "operations required", mutate: func(c *ImageRoutingConfig) { c.Profiles[0].Operations = nil }, want: "operations"},
		{name: "invalid verification status", mutate: func(c *ImageRoutingConfig) { c.Profiles[0].VerificationStatus = "maybe" }, want: "verification_status"},
		{name: "non canonical resolution", mutate: func(c *ImageRoutingConfig) { c.Profiles[0].Resolutions = []string{"4k"} }, want: "canonical"},
		{name: "combination outside declared values", mutate: func(c *ImageRoutingConfig) {
			c.Profiles[0].AllowedCombinations[1].AspectRatio = "16:9"
		}, want: "aspect_ratio"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &ImageRoutingConfig{Version: ImageRoutingVersion1, Profiles: []ImageRoutingProfile{validProfile}}
			config.Profiles[0].Operations = append([]ImageOperation(nil), validProfile.Operations...)
			config.Profiles[0].Resolutions = append([]string(nil), validProfile.Resolutions...)
			config.Profiles[0].AspectRatios = append([]string(nil), validProfile.AspectRatios...)
			config.Profiles[0].Sizes = append([]string(nil), validProfile.Sizes...)
			config.Profiles[0].AllowedCombinations = append([]ImageRoutingCombination(nil), validProfile.AllowedCombinations...)
			tt.mutate(config)

			err := config.Validate()
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.want)
		})
	}
}
