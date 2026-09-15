package plugins_test

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Gemini REST 成功体用 generatedSamples,取不到 uri 会让产物为空、内容接口 410
func TestGoogleVideoURIFromGeneratedSamples(t *testing.T) {
	source, err := builtinplugins.Source("google")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "google"})
	require.NoError(t, err)
	const uri = "https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media"
	body := map[string]any{"name": "models/veo-3.1-fast-generate-preview/operations/abc", "done": true,
		"response": map[string]any{"generateVideoResponse": map[string]any{
			"generatedSamples": []any{map[string]any{"video": map[string]any{"uri": uri}}},
		}}}

	value, err := plugin.Engine.Call(t.Context(), "parseTaskResult", map[string]any{}, body)
	require.NoError(t, err)
	encoded, err := common.Marshal(value)
	require.NoError(t, err)
	var result map[string]any
	require.NoError(t, common.Unmarshal(encoded, &result))
	assert.Equal(t, uri, result["remoteUrl"])

	value, err = plugin.Engine.Call(t.Context(), "listArtifacts", map[string]any{"taskId": "task_x", "status": "SUCCESS", "data": body})
	require.NoError(t, err)
	encoded, err = common.Marshal(value)
	require.NoError(t, err)
	assert.JSONEq(t, `[{"key":"video","type":"video"}]`, string(encoded))
}
