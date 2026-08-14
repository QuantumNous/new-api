package controller

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuiltinRatioSyncPresetsExposeFixedEndpoints(t *testing.T) {
	presets := builtinRatioSyncPresets()
	require.Len(t, presets, 2)

	require.Equal(t, officialRatioPresetID, presets[0].ID)
	require.Equal(t, officialRatioPresetBaseURL, presets[0].BaseURL)
	require.Equal(t, officialRatioPresetEndpoint, presets[0].Endpoint)

	require.Equal(t, modelsDevPresetID, presets[1].ID)
	require.Equal(t, modelsDevPresetBaseURL, presets[1].BaseURL)
	require.Equal(t, modelsDevPath, presets[1].Endpoint)
}

func TestConvertModelsDevToRatioDataUsesCatalogProviderPriority(t *testing.T) {
	converted, err := convertModelsDevToRatioData(strings.NewReader(`{
		"xpersona": {"models": {"gpt-5.6-sol": {"cost": {"input": 1, "output": 6, "cache_read": 0.1}}}},
		"openai": {"models": {"gpt-5.6-sol": {"cost": {"input": 5, "output": 30, "cache_read": 0.5}}}}
	}`))
	require.NoError(t, err)

	modelRatios := converted["model_ratio"].(map[string]any)
	completionRatios := converted["completion_ratio"].(map[string]any)
	cacheRatios := converted["cache_ratio"].(map[string]any)
	require.Equal(t, 2.5, modelRatios["gpt-5.6-sol"])
	require.Equal(t, 6.0, completionRatios["gpt-5.6-sol"])
	require.Equal(t, 0.1, cacheRatios["gpt-5.6-sol"])
}
