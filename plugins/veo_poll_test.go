package plugins_test

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Google long-running operations serialize proto3 defaults by omission: a
// still-running operation has no `done` key at all. Treating that as
// unrecognized would count every normal poll as a failure and fail the task
// at the poll-failure threshold while the video is still rendering.
func TestVeoParseTaskResultTreatsMissingDoneAsInProgress(t *testing.T) {
	cases := []struct {
		name       string
		body       map[string]any
		wantStatus string
	}{
		{
			name:       "running operation omits done",
			body:       map[string]any{"name": "operations/abc", "metadata": map[string]any{"@type": "x"}},
			wantStatus: "IN_PROGRESS",
		},
		{
			name:       "explicit done false",
			body:       map[string]any{"name": "operations/abc", "done": false},
			wantStatus: "IN_PROGRESS",
		},
		{
			name:       "body without operation name is unrecognized",
			body:       map[string]any{"foo": "bar"},
			wantStatus: "UNKNOWN",
		},
		{
			name:       "operation error is failure",
			body:       map[string]any{"name": "operations/abc", "done": true, "error": map[string]any{"message": "quota exceeded"}},
			wantStatus: "FAILURE",
		},
	}
	for _, key := range []string{"google", "vertex-ai"} {
		source, err := builtinplugins.Source(key)
		require.NoError(t, err)
		plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: key})
		require.NoError(t, err)
		for _, tc := range cases {
			t.Run(key+"/"+tc.name, func(t *testing.T) {
				value, err := plugin.Engine.Call(t.Context(), "parseTaskResult", map[string]any{}, tc.body)
				require.NoError(t, err)
				encoded, err := common.Marshal(value)
				require.NoError(t, err)
				var result map[string]any
				require.NoError(t, common.Unmarshal(encoded, &result))
				assert.Equal(t, tc.wantStatus, result["status"])
			})
		}
	}
}

// Veo predictLongRunning 只接受 image.bytesBase64Encoded,inlineData 会被 Google 400 拒绝
func TestGoogleBuildSubmitRequestUsesBytesBase64Encoded(t *testing.T) {
	source, err := builtinplugins.Source("google")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "google"})
	require.NoError(t, err)

	ctx := map[string]any{
		"baseUrl":       "https://generativelanguage.googleapis.com",
		"apiKey":        "key",
		"upstreamModel": "veo-3.1-fast-generate-preview",
		"requestBody": map[string]any{
			"model":  "veo-3.1-fast-generate-preview",
			"prompt": "animate",
			"images": []any{"data:image/png;base64,iVBORw0KGgoTEST"},
		},
	}
	value, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", ctx)
	require.NoError(t, err)
	result := decodePluginValue(t, value)
	assert.Equal(t, "image_to_video", result["action"])
	instances := result["body"].(map[string]any)["instances"].([]any)
	require.Len(t, instances, 1)
	image := instances[0].(map[string]any)["image"].(map[string]any)
	assert.Equal(t, "iVBORw0KGgoTEST", image["bytesBase64Encoded"])
	assert.Equal(t, "image/png", image["mimeType"])
	assert.NotContains(t, image, "inlineData")
}
