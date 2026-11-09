package plugins_test

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The Vertex AI driver reads its region from the channel's region field, as
// the built-in Vertex AI channel does: a plain region, or a JSON map of model
// to region with a default. An empty field is the global endpoint.
func TestVertexAIRegionFromChannelOther(t *testing.T) {
	source, err := builtinplugins.Source("vertex-ai")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "vertex-ai"})
	require.NoError(t, err)
	const veo = "veo-3.0-generate-001"
	submitURL := func(channelOther, model string) string {
		t.Helper()
		value, err := plugin.Engine.CallPath(t.Context(), "buildSubmitRequest", nil, map[string]any{
			"requestBody": map[string]any{"model": model, "prompt": "p"}, "model": model, "upstreamModel": model,
			"baseUrl": "https://aiplatform.example", "authHeader": "Bearer ya29.vendor",
			"auth":     map[string]any{"authHeader": "Bearer ya29.vendor", "projectId": "proj"},
			"upstream": map[string]any{"kind": "vendor"}, "channelOther": channelOther,
		})
		require.NoError(t, err)
		return decodePluginValue(t, value)["url"].(string)
	}
	location := func(region, model string) string {
		return "https://aiplatform.example/v1/projects/proj/locations/" + region + "/publishers/google/models/" + model + ":predictLongRunning"
	}
	regions := `{"default": "europe-west4", "` + veo + `": "us-east5"}`

	assert.Equal(t, location("global", veo), submitURL("", veo))
	assert.Equal(t, location("us-central1", veo), submitURL(" us-central1 ", veo))
	assert.Equal(t, location("us-east5", veo), submitURL(regions, veo))
	assert.Equal(t, location("europe-west4", "veo-3.1-generate-preview"), submitURL(regions, "veo-3.1-generate-preview"))
	assert.Equal(t, location("global", veo), submitURL(`{"veo-3.1-generate-preview": "us-east5"}`, veo))
}
