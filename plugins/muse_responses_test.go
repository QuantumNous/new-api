package plugins_test

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newMusePlugin(t *testing.T) *jsplugin.LoadedPlugin {
	t.Helper()
	source, err := builtinplugins.Source("muse")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "muse"})
	require.NoError(t, err)
	return plugin
}

func TestMuseImageProtocol(t *testing.T) {
	plugin := newMusePlugin(t)
	const model = "muse-image-1.0"
	decode, err := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_image", "decodeRequest"}, map[string]any{
		"protocol": "openai_image", "operation": "generate", "model": model, "upstreamModel": model,
		"path": "/v1/images/generations", "method": http.MethodPost,
		"body": map[string]any{"kind": "json", "value": map[string]any{
			"model": model, "prompt": "a red paper boat on a blue lake", "n": 2,
			"size": "1536x1024", "response_format": "b64_json",
		}},
	})
	require.NoError(t, err)
	decoded := alibabaObject(t, decode)
	assert.Equal(t, map[string]any{
		"model": model, "prompt": "a red paper boat on a blue lake", "n": float64(2), "size": "1536x1024",
		"response_format": "b64_json",
	}, decoded["requestBody"])

	request, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
		"model": model, "upstreamModel": model, "action": "image_generation",
		"requestBody": decoded["requestBody"], "baseUrl": "https://muse.example", "apiKey": "muse-key",
	})
	require.NoError(t, err)
	submitted := alibabaObject(t, request)
	assert.Equal(t, "https://muse.example/v1/images/generations", submitted["url"])
	assert.Equal(t, map[string]any{
		"model": model, "prompt": "a red paper boat on a blue lake", "n": float64(2), "size": "1536x1024",
		"response_format": "b64_json",
	}, submitted["body"])

	usage, err := plugin.Engine.Call(t.Context(), "extractUsage", map[string]any{
		"model": model, "upstreamModel": model, "action": "image_generation", "requestBody": submitted["body"],
	})
	require.NoError(t, err)
	assert.Equal(t, map[string]any{"image_count": float64(2)}, alibabaObject(t, usage))

	response := map[string]any{
		"created": float64(1792761137),
		"data": []any{
			map[string]any{"b64_json": "image-one"},
			map[string]any{"b64_json": "image-two"},
		},
	}
	parsed, err := plugin.Engine.Call(t.Context(), "parseSubmitResponse", map[string]any{
		"publicTaskId": "task_public", "action": "image_generation",
	}, map[string]any{"statusCode": float64(http.StatusOK), "body": response})
	require.NoError(t, err)
	assert.Equal(t, "SUCCESS", alibabaObject(t, alibabaObject(t, parsed)["immediate"])["status"])

	completed, err := plugin.Engine.Call(t.Context(), "extractUsageOnComplete", map[string]any{
		"action": "image_generation", "model": model, "upstreamModel": model,
	}, map[string]any{}, response)
	require.NoError(t, err)
	assert.Equal(t, map[string]any{"image_count": float64(2)}, alibabaObject(t, completed))

	rendered, err := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_image", "render"}, map[string]any{"model": model}, map[string]any{
		"task_id": "task_public", "status": "SUCCESS", "created_at": float64(1792761137), "data": response,
	})
	require.NoError(t, err)
	assert.Equal(t, response, alibabaObject(t, rendered))
}

func TestMuseImageValidation(t *testing.T) {
	plugin := newMusePlugin(t)
	base := map[string]any{"model": "muse-image-1.0", "prompt": "a boat"}
	for name, extra := range map[string]map[string]any{
		"aspect ratio": {"aspect_ratio": "16:9"},
		"quality":      {"quality": "high"},
		"edit image":   {"image": "https://cdn.example/input.png"},
		"bad size":     {"size": "2048x2048"},
	} {
		body := map[string]any{"kind": "json", "value": map[string]any{}}
		value := body["value"].(map[string]any)
		for key, item := range base {
			value[key] = item
		}
		for key, item := range extra {
			value[key] = item
		}
		_, err := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_image", "decodeRequest"}, map[string]any{
			"protocol": "openai_image", "operation": "generate", "model": "muse-image-1.0", "upstreamModel": "muse-image-1.0", "body": body,
		})
		require.Error(t, err, name)
	}

	_, err := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_image", "decodeRequest"}, map[string]any{
		"protocol": "openai_image", "operation": "edit", "model": "muse-image-1.0", "upstreamModel": "muse-image-1.0",
		"body": map[string]any{"kind": "json", "value": base},
	})
	require.ErrorContains(t, err, "image is required")

	decoded, err := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_image", "decodeRequest"}, map[string]any{
		"protocol": "openai_image", "operation": "edit", "model": "muse-image-1.0", "upstreamModel": "muse-image-1.0",
		"body": map[string]any{"kind": "json", "value": map[string]any{
			"model": "muse-image-1.0", "prompt": "add a red hat", "images": []any{
				map[string]any{"image_url": "https://cdn.example/input.png"},
			},
		}},
	})
	require.NoError(t, err)
	edit := alibabaObject(t, decoded)
	assert.Equal(t, "image_edit", edit["action"])
	assert.Equal(t, []any{map[string]any{"image_url": "https://cdn.example/input.png"}}, alibabaObject(t, edit["requestBody"])["images"])

	submitted, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
		"model": "muse-image-1.0", "upstreamModel": "muse-image-1.0", "action": "image_edit",
		"requestBody": edit["requestBody"], "baseUrl": "https://muse.example", "apiKey": "muse-key",
	})
	require.NoError(t, err)
	submit := alibabaObject(t, submitted)
	assert.Equal(t, "https://muse.example/v1/images/edits", submit["url"])

	multipart, err := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_image", "decodeRequest"}, map[string]any{
		"protocol": "openai_image", "operation": "edit", "model": "muse-image-1.0", "upstreamModel": "muse-image-1.0",
		"body": map[string]any{
			"kind": "multipart",
			"fields": map[string][]string{"model": {"muse-image-1.0"}, "prompt": {"add a red hat"}, "n": {"1"}},
			"files": []any{map[string]any{"ref": "request_file:image", "field": "image", "mimeType": "image/png"}},
		},
	})
	require.NoError(t, err)
	multipartRequest := alibabaObject(t, alibabaObject(t, multipart)["requestBody"])
	assert.Equal(t, "image_edit", alibabaObject(t, multipart)["action"])
	assert.Equal(t, []any{map[string]any{"image_url": map[string]any{
		"__fileRef": "request_file:image", "encoding": "dataUrl", "mimeType": "image/png", "maxBytes": float64(20 * 1024 * 1024),
	}}}, multipartRequest["images"])
}
