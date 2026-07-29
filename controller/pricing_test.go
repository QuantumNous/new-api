package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFilterPricingByUsableGroupsRestrictsPublicIntegrations(t *testing.T) {
	pricing := []model.Pricing{{
		ModelName:              "model",
		EnableGroup:            []string{"default", "vip"},
		SupportedEndpointTypes: []constant.EndpointType{constant.EndpointTypeOpenAI},
		Integrations: []model.ModelIntegration{
			{ProfileID: "explicit", Groups: []string{"default", "vip", "disabled"}, Verified: true, Source: "explicit"},
			{ProfileID: "inferred", Groups: []string{"default"}, Source: "inferred"},
			{ProfileID: "unverified", Groups: []string{"default"}, Source: "explicit"},
			{ProfileID: "other-group", Groups: []string{"vip"}, Verified: true, Source: "explicit"},
		},
	}}

	got := filterPricingByUsableGroups(pricing, map[string]string{"default": "Default"})
	require.Len(t, got, 1)
	require.Len(t, got[0].Integrations, 1)
	assert.Equal(t, "explicit", got[0].Integrations[0].ProfileID)
	assert.Equal(t, []string{"default"}, got[0].Integrations[0].Groups)
	assert.Empty(t, got[0].SupportedEndpointTypes)
	assert.Equal(t, []string{"default", "vip", "disabled"}, pricing[0].Integrations[0].Groups)
	assert.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAI}, pricing[0].SupportedEndpointTypes)
}

func TestFilterPricingByUsableGroupsExpandsExplicitAllGroupForCaller(t *testing.T) {
	pricing := []model.Pricing{{
		ModelName:   "global-model",
		EnableGroup: []string{"all"},
		Integrations: []model.ModelIntegration{{
			ProfileID: "openai.chat_completions",
			Groups:    []string{"all"},
			Verified:  true,
			Source:    "explicit",
		}},
	}}

	got := filterPricingByUsableGroups(pricing, map[string]string{"vip": "VIP", "default": "Default"})
	require.Len(t, got, 1)
	require.Len(t, got[0].Integrations, 1)
	assert.Equal(t, []string{"default", "vip"}, got[0].Integrations[0].Groups)
}

func TestNormalizeModelMetadataPreservesLegacyEndpointArrays(t *testing.T) {
	metadata := model.Model{Endpoints: `["openai","gemini"]`}
	require.NoError(t, normalizeModelMetadata(&metadata))
	assert.JSONEq(t, `["openai","gemini"]`, metadata.Endpoints)

	metadata.Endpoints = `{"openai":{"path":"/v1/chat/completions"}}`
	require.NoError(t, normalizeModelMetadata(&metadata))
	assert.JSONEq(t, `{"openai":{"path":"/v1/chat/completions"}}`, metadata.Endpoints)
}

func TestNormalizeModelMetadataRejectsUnsupportedEndpointShapes(t *testing.T) {
	for _, endpoints := range []string{`"openai"`, `["openai",1]`} {
		metadata := model.Model{Endpoints: endpoints}
		assert.Error(t, normalizeModelMetadata(&metadata))
	}
}

func TestNormalizeModelMetadataValidatesOfficialDiscount(t *testing.T) {
	for _, discount := range []float64{-0.01, 100} {
		metadata := model.Model{OfficialDiscount: &discount}
		assert.Error(t, normalizeModelMetadata(&metadata))
	}

	discount := 88.88
	metadata := model.Model{OfficialDiscount: &discount}
	require.NoError(t, normalizeModelMetadata(&metadata))
}

func TestPricingReferenceDifferencesExcludeWildcardKeys(t *testing.T) {
	local := map[string]any{
		"model_ratio": map[string]float64{
			"gpt-4-gizmo-*": 15,
			"service-model": 1,
		},
	}
	channels := []struct {
		name string
		data map[string]any
	}{{
		name: "reference",
		data: map[string]any{
			"model_ratio": map[string]float64{
				"gpt-4-gizmo-*": 20,
				"service-model": 2,
			},
		},
	}}

	differences := buildDifferences(local, channels)
	assert.NotContains(t, differences, "gpt-4-gizmo-*")
	assert.Contains(t, differences, "service-model")
}
