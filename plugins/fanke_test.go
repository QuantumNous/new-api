package plugins_test

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFankeResponsesProtocol(t *testing.T) {
	testVideoResponsesProtocol(t, videoResponsesTestCase{
		pluginKey: "fanke",
		model:     "MiniMax-H3 768P 特价",
		requestBody: map[string]any{
			"model": "MiniMax-H3 768P 特价",
			"input": []any{map[string]any{"role": "user", "content": []any{
				map[string]any{"type": "input_text", "text": "a product turntable shot"},
				map[string]any{"type": "input_image", "image_url": "https://cdn.example/product.png"},
			}}},
			"seconds": 8,
			"size":    "720x1280",
		},
		wantAction: "image_to_video",
		wantRequest: map[string]any{
			"model":     "MiniMax-H3 768P 特价",
			"prompt":    "a product turntable shot",
			"imageUrls": []any{"https://cdn.example/product.png"},
			"duration":  float64(8),
			"size":      "720x1280",
		},
		wantUsageKeys:       []string{"seconds"},
		wantSubmitUsageKeys: []string{"seconds"},
		wantVendorName:      "fanke",
	})
}

func TestFankeVideoProtocol(t *testing.T) {
	source, err := builtinplugins.Source("fanke")
	require.NoError(t, err)
	registry := jsplugin.NewRegistry()
	plugin, err := registry.RegisterFactory(source, jsplugin.Options{Key: "fanke"})
	require.NoError(t, err)

	const (
		model     = "MiniMax-H3 768P 特价"
		vendorID  = "ft-video-v1-77e8ee7a636f15dac27b2ce6d6fcd746"
		baseURL   = "https://ai.fanke2026.xyz"
		imageURL  = "https://cdn.example/product.png"
		videoPath = "/api/open/v1/video/generate"
	)

	decode := func(t *testing.T, body map[string]any) map[string]any {
		t.Helper()
		value, callErr := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_video", "decodeRequest"}, map[string]any{
			"model": model,
			"body":  map[string]any{"kind": "json", "value": body},
		})
		require.NoError(t, callErr)
		encoded, marshalErr := common.Marshal(value)
		require.NoError(t, marshalErr)
		var resolved map[string]any
		require.NoError(t, common.Unmarshal(encoded, &resolved))
		return resolved
	}

	submit := func(t *testing.T, requestBody map[string]any) map[string]any {
		t.Helper()
		value, callErr := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
			"requestBody":  requestBody,
			"model":        model,
			"baseUrl":      baseURL,
			"apiKey":       "sk-test",
			"publicTaskId": "task-1",
		})
		require.NoError(t, callErr)
		encoded, marshalErr := common.Marshal(value)
		require.NoError(t, marshalErr)
		var descriptor map[string]any
		require.NoError(t, common.Unmarshal(encoded, &descriptor))
		return descriptor
	}

	t.Run("decodes the openai video body", func(t *testing.T) {
		resolved := decode(t, map[string]any{
			"model":     model,
			"prompt":    "a cat walking",
			"duration":  12,
			"ratio":     "1:1",
			"imageUrls": []any{imageURL},
			"audioUrls": []any{"https://cdn.example/voice.mp3"},
		})
		assert.Equal(t, model, resolved["model"])
		assert.Equal(t, "image_to_video", resolved["action"])
		requestBody, ok := resolved["requestBody"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "a cat walking", requestBody["prompt"])
		assert.Equal(t, float64(12), requestBody["duration"])
	})

	t.Run("submits to the vendor endpoint with the platform headers", func(t *testing.T) {
		descriptor := submit(t, map[string]any{
			"model":     model,
			"prompt":    "a cat walking",
			"duration":  12,
			"ratio":     "1:1",
			"imageUrls": []any{imageURL},
		})
		assert.Equal(t, baseURL+videoPath, descriptor["url"])
		assert.Equal(t, "POST", descriptor["method"])
		headers, ok := descriptor["headers"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "Bearer sk-test", headers["Authorization"])
		assert.Equal(t, "1", headers["X-Public-Model-Ids"])
		body, ok := descriptor["body"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, vendorID, body["model"])
		assert.Equal(t, float64(12), body["duration"])
		assert.Equal(t, "1:1", body["ratio"])
		assert.Equal(t, []any{imageURL}, body["imageUrls"])
	})

	t.Run("defaults to a 5 second 9:16 clip", func(t *testing.T) {
		body, ok := submit(t, map[string]any{"model": model, "prompt": "a cat walking"})["body"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, float64(5), body["duration"])
		assert.Equal(t, "9:16", body["ratio"])
	})

	t.Run("derives the ratio from an openai size", func(t *testing.T) {
		body, ok := submit(t, map[string]any{"model": model, "prompt": "a cat walking", "size": "1280x720"})["body"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "16:9", body["ratio"])
	})

	t.Run("rejects unsupported requests", func(t *testing.T) {
		_, callErr := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
			"requestBody": map[string]any{"model": model, "prompt": "a cat", "duration": 16},
			"model":       model,
			"baseUrl":     baseURL,
		})
		require.ErrorContains(t, callErr, "duration must be an integer between 1 and 15 seconds")

		_, callErr = plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
			"requestBody": map[string]any{"model": model, "prompt": "a cat", "audioUrls": []any{"https://cdn.example/voice.mp3"}},
			"model":       model,
			"baseUrl":     baseURL,
		})
		require.ErrorContains(t, callErr, "reference audio requires at least one reference image")

		_, callErr = plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
			"requestBody": map[string]any{"model": model, "prompt": "a cat", "videoUrls": []any{"https://cdn.example/clip.mp4"}},
			"model":       model,
			"baseUrl":     baseURL,
		})
		require.ErrorContains(t, callErr, "does not accept reference videos")
	})

	t.Run("parses the submit and poll envelopes", func(t *testing.T) {
		value, callErr := plugin.Engine.Call(t.Context(), "parseSubmitResponse", map[string]any{}, map[string]any{
			"statusCode": 200,
			"body":       map[string]any{"success": true, "jobId": "job-1", "taskId": "task-1", "status": "submitted"},
		})
		require.NoError(t, callErr)
		encoded, marshalErr := common.Marshal(value)
		require.NoError(t, marshalErr)
		var submitted map[string]any
		require.NoError(t, common.Unmarshal(encoded, &submitted))
		assert.Equal(t, "job-1", submitted["taskId"])

		_, callErr = plugin.Engine.Call(t.Context(), "parseSubmitResponse", map[string]any{}, map[string]any{
			"statusCode": 402,
			"body":       map[string]any{"success": false, "error": "insufficient balance"},
		})
		require.ErrorContains(t, callErr, "insufficient balance")

		cases := []struct {
			name       string
			body       map[string]any
			wantStatus string
			wantURL    string
		}{
			{"queued", map[string]any{"success": true, "status": "submitted"}, "SUBMITTED", ""},
			{"succeeded", map[string]any{"success": true, "status": "success", "videoUrl": "https://ai.fanke2026.xyz/api/video/cache/job-1"}, "SUCCESS", "https://ai.fanke2026.xyz/api/video/cache/job-1"},
			{"failed", map[string]any{"success": true, "status": "failed", "errorMessage": "upstream rejected"}, "FAILURE", ""},
			{"unrecognized", map[string]any{"success": true, "status": "weird"}, "UNKNOWN", ""},
			{"api error", map[string]any{"success": false, "error": "任务不存在"}, "UNKNOWN", ""},
		}
		for _, testCase := range cases {
			t.Run(testCase.name, func(t *testing.T) {
				result, resultErr := plugin.Engine.Call(t.Context(), "parseTaskResult", map[string]any{}, testCase.body)
				require.NoError(t, resultErr)
				encoded, marshalErr := common.Marshal(result)
				require.NoError(t, marshalErr)
				var parsed map[string]any
				require.NoError(t, common.Unmarshal(encoded, &parsed))
				assert.Equal(t, testCase.wantStatus, parsed["status"])
				if testCase.wantURL == "" {
					assert.Nil(t, parsed["url"])
				} else {
					assert.Equal(t, testCase.wantURL, parsed["url"])
				}
			})
		}
	})

	t.Run("bills the requested duration only", func(t *testing.T) {
		facts, callErr := plugin.Engine.Call(t.Context(), "extractUsage", map[string]any{
			"model":         model,
			"upstreamModel": model,
			"requestBody":   map[string]any{"model": model, "prompt": "a cat", "duration": 12},
			"usagePurpose":  "facts",
		})
		require.NoError(t, callErr)
		encoded, marshalErr := common.Marshal(facts)
		require.NoError(t, marshalErr)
		var usage map[string]any
		require.NoError(t, common.Unmarshal(encoded, &usage))
		assert.Equal(t, map[string]any{"seconds": float64(12)}, usage)

		ratios, callErr := plugin.Engine.Call(t.Context(), "extractUsage", map[string]any{
			"model":        model,
			"requestBody":  map[string]any{"model": model, "prompt": "a cat"},
			"usagePurpose": "billing_ratios",
		})
		require.NoError(t, callErr)
		assert.Nil(t, ratios)
	})
}
