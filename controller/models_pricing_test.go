/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Contract tests for the pure helper functions in controller/models_pricing.go.
// The full HTTP handler is exercised via integration tests once the test DB
// harness (also used by commission_test.go) is available for /v1/models/pricing.
// These unit tests pin down the shape rules that downstream integrations
// (BuildingAI Agent Platform) will parse against, so a silent shape change
// breaks the tests before it hits production.

func TestPricingTypeForKind(t *testing.T) {
	// The mapping is stable — downstream plugin developers cache these
	// strings in their PricingService. Renaming any value is a breaking
	// change and needs an API version bump.
	cases := []struct {
		kind string
		want string
	}{
		{constant.PricingKindChat, "token"},
		{constant.PricingKindMultimodalChat, "token"},
		{constant.PricingKindEmbedding, "token"},
		{constant.PricingKindImageGen, "per_image"},
		{constant.PricingKindVideoGen, "per_second"},
		{constant.PricingKindAudioIn, "per_minute"},
		{constant.PricingKindAudioOut, "per_million_chars"},
		{"unknown-kind", "token"}, // fallback to token
	}
	for _, tc := range cases {
		got := pricingTypeForKind(tc.kind)
		assert.Equalf(t, tc.want, got, "pricingTypeForKind(%q)", tc.kind)
	}
}

func TestModelTypeForKind(t *testing.T) {
	cases := []struct {
		kind string
		want string
	}{
		{constant.PricingKindImageGen, model.ModelTypeImage},
		{constant.PricingKindVideoGen, model.ModelTypeVideo},
		{constant.PricingKindAudioIn, model.ModelTypeAudio},
		{constant.PricingKindAudioOut, model.ModelTypeAudio},
		{constant.PricingKindEmbedding, model.ModelTypeEmbedding},
		{constant.PricingKindChat, model.ModelTypeText},
		{constant.PricingKindMultimodalChat, model.ModelTypeText},
	}
	for _, tc := range cases {
		got := modelTypeForKind(tc.kind)
		assert.Equalf(t, tc.want, got, "modelTypeForKind(%q)", tc.kind)
	}
}

func TestBuildPricingBodyChatFields(t *testing.T) {
	// A chat model MUST populate the token-based fields and leave all the
	// image/video/audio fields at zero, otherwise the JSON output will
	// pollute the downstream Agent's PricingCache with false-positive
	// units.
	cacheRatio := 0.5
	src := model.Pricing{
		ModelName:       "gpt-4o",
		ModelRatio:      2.5,
		CompletionRatio: 4.0,
		CacheRatio:      &cacheRatio,
	}
	got, _ := buildPricingBody(src, constant.PricingKindChat, "", nil, nil, nil, nil)

	// Ratios preserved verbatim.
	assert.Equal(t, 2.5, got.ModelRatio)
	assert.Equal(t, 4.0, got.CompletionRatio)
	require.NotNil(t, got.CacheRatio)
	assert.Equal(t, 0.5, *got.CacheRatio)

	// Denormalized $/1M tokens computed correctly.
	// 1 ModelRatio unit = $2 / 1M tokens.
	assert.Equal(t, 5.0, got.InputPerMillionTokens)   // 2.5 × 2
	assert.Equal(t, 20.0, got.OutputPerMillionTokens) // 2.5 × 2 × 4.0

	// image/video/audio fields must be zero — this is the contract that
	// keeps the JSON shape unambiguous.
	assert.Zero(t, got.PricePerImage)
	assert.Zero(t, got.PricePerSecond)
	assert.Zero(t, got.PricePerMinute)
	assert.Zero(t, got.PricePerMillionChars)
	assert.Nil(t, got.QualityMultipliers)
	assert.Nil(t, got.ResolutionMultipliers)
}

func TestBuildPricingBodyChatWithZeroCompletionRatio(t *testing.T) {
	// Some chat models have CompletionRatio=0 (input-only pricing).
	// OutputPerMillionTokens must fall back to InputPerMillionTokens so
	// downstream doesn't display "$0 for output" for a paid model.
	src := model.Pricing{ModelName: "text-embedding-3-large", ModelRatio: 0.02}
	got, _ := buildPricingBody(src, constant.PricingKindEmbedding, "", nil, nil, nil, nil)

	assert.Equal(t, 0.04, got.InputPerMillionTokens)  // 0.02 × 2
	assert.Equal(t, 0.04, got.OutputPerMillionTokens) // same fallback
}

func TestBuildPricingBodyImageGenFields(t *testing.T) {
	imageMap := map[string]ratio_setting.ImagePricing{
		"dall-e-3": {
			PricePerImage:      0.04,
			QualityMultipliers: map[string]float64{"hd": 2.0},
			SizeMultipliers:    map[string]float64{"1024x1792": 2.0},
		},
	}
	src := model.Pricing{ModelName: "dall-e-3"}
	got, _ := buildPricingBody(src, constant.PricingKindImageGen, "", imageMap, nil, nil, nil)

	assert.Equal(t, 0.04, got.PricePerImage)
	assert.Equal(t, 2.0, got.QualityMultipliers["hd"])
	assert.Equal(t, 2.0, got.SizeMultipliers["1024x1792"])

	// Token fields must be zero — image-gen isn't billed per token, so
	// exposing ModelRatio would mislead downstream.
	assert.Zero(t, got.ModelRatio)
	assert.Zero(t, got.InputPerMillionTokens)
	assert.Zero(t, got.OutputPerMillionTokens)
}

func TestBuildPricingBodyVideoGenFields(t *testing.T) {
	videoMap := map[string]ratio_setting.VideoPricing{
		"doubao-seedance-2-0-260128": {
			PricePerSecond: 6.301369,
			ResolutionMultipliers: map[string]float64{
				"720p":  1.0,
				"1080p": 1.1087,
				"4k":    0.5652,
			},
			HasAudioMultiplier: 1.0,
		},
	}
	src := model.Pricing{ModelName: "doubao-seedance-2-0-260128"}
	got, _ := buildPricingBody(src, constant.PricingKindVideoGen, "", nil, videoMap, nil, nil)

	assert.InDelta(t, 6.301369, got.PricePerSecond, 1e-6)
	assert.Equal(t, 1.1087, got.ResolutionMultipliers["1080p"])
	assert.Equal(t, 0.5652, got.ResolutionMultipliers["4k"])
	assert.Equal(t, 1.0, got.HasAudioMultiplier)

	// Non-video fields must be zero.
	assert.Zero(t, got.PricePerImage)
	assert.Zero(t, got.PricePerMinute)
	assert.Zero(t, got.ModelRatio)
}

func TestBuildPricingBodyAudioInFields(t *testing.T) {
	audioInMap := map[string]ratio_setting.AudioInPricing{
		"whisper-1": {
			PricePerMinute: 0.006,
			MinBillMinutes: 0.0,
		},
	}
	src := model.Pricing{ModelName: "whisper-1"}
	got, _ := buildPricingBody(src, constant.PricingKindAudioIn, "", nil, nil, audioInMap, nil)

	assert.Equal(t, 0.006, got.PricePerMinute)
	assert.Zero(t, got.MinBillMinutes)
	assert.Zero(t, got.PricePerMillionChars)
	assert.Zero(t, got.ModelRatio)
}

func TestBuildPricingBodyAudioOutFields(t *testing.T) {
	audioOutMap := map[string]ratio_setting.AudioOutPricing{
		"tts-1": {
			PricePerMillionChars: 15.0,
			VoiceMultipliers:     map[string]float64{"nova": 1.0, "clone": 2.0},
		},
	}
	src := model.Pricing{ModelName: "tts-1"}
	got, _ := buildPricingBody(src, constant.PricingKindAudioOut, "", nil, nil, nil, audioOutMap)

	assert.Equal(t, 15.0, got.PricePerMillionChars)
	assert.Equal(t, 2.0, got.VoiceMultipliers["clone"])
	assert.Zero(t, got.PricePerMinute)
	assert.Zero(t, got.ModelRatio)
}

func TestBuildPricingBodyFlatPriceCarriedOnEveryKind(t *testing.T) {
	// FlatPricePerRequest is the legacy ModelPrice fallback. It's copied
	// onto every entry regardless of kind so downstream can honor it as
	// an override — this is the "escape hatch" for admins who want a
	// simple flat per-request price without going into the structured
	// tables.
	src := model.Pricing{ModelName: "custom-model", ModelPrice: 0.15}

	// Verify FlatPricePerRequest is present on every kind.
	for _, kind := range []string{
		constant.PricingKindChat,
		constant.PricingKindImageGen,
		constant.PricingKindVideoGen,
		constant.PricingKindAudioIn,
		constant.PricingKindAudioOut,
		constant.PricingKindEmbedding,
	} {
		got, _ := buildPricingBody(src, kind, "", nil, nil, nil, nil)
		assert.Equalf(t, 0.15, got.FlatPricePerRequest,
			"FlatPricePerRequest lost for kind=%q", kind)
	}
}

func TestBuildPricingBodyMissingEntryReturnsZeroPricing(t *testing.T) {
	// If the admin marks a model as image-gen but hasn't filled the
	// ImagePricing table entry yet, we should return zeroes rather than
	// crash. Downstream renders these as "not-priced-yet" placeholders.
	src := model.Pricing{ModelName: "not-yet-configured"}
	imageMap := map[string]ratio_setting.ImagePricing{} // empty

	got, _ := buildPricingBody(src, constant.PricingKindImageGen, "", imageMap, nil, nil, nil)

	assert.Zero(t, got.PricePerImage)
	assert.Nil(t, got.QualityMultipliers)
	assert.Nil(t, got.SizeMultipliers)
}

func TestFirstPricingVersionEmptySlice(t *testing.T) {
	// pricings[0].PricingVersion on an empty slice would panic; the
	// helper must handle that gracefully so /v1/models/pricing returns
	// an empty-but-valid response on a fresh install.
	assert.Equal(t, "", firstPricingVersion(nil))
	assert.Equal(t, "", firstPricingVersion([]model.Pricing{}))
	assert.Equal(t, "v42",
		firstPricingVersion([]model.Pricing{{PricingVersion: "v42"}}))
}
