package dto

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestImageRequestUnmarshalUnifiedInputNormalizesFields(t *testing.T) {
	var request ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"gemini-3-pro-image-preview",
		"input":{
			"prompt":"a lighthouse at dusk",
			"image_input":["https://example.com/one.png","data:image/jpeg;base64,ZmFrZQ=="],
			"aspect_ratio":"16:9",
			"resolution":"2K",
			"size":"1536x864",
			"output_format":"png",
			"seed":42
		},
		"callBackUrl":"https://example.com/callback"
	}`), &request))

	assert.True(t, request.HasUnifiedImageInput())
	assert.Equal(t, "a lighthouse at dusk", request.Prompt)
	assert.Equal(t, "1536x864", request.Size)
	assert.Equal(t, "https://example.com/callback", request.WebhookURL)
	assert.JSONEq(t, `"png"`, string(request.OutputFormat))
	assert.JSONEq(t, `"16:9"`, string(request.Extra["aspect_ratio"]))
	assert.JSONEq(t, `"2K"`, string(request.Extra["resolution"]))
	assert.JSONEq(t, `42`, string(request.Extra["seed"]))

	urls, err := request.ImageInputURLs()
	require.NoError(t, err)
	assert.Equal(t, []string{
		"https://example.com/one.png",
		"data:image/jpeg;base64,ZmFrZQ==",
	}, urls)

	encoded, err := common.Marshal(request)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), `"input"`)
	assert.NotContains(t, string(encoded), `"callBackUrl"`)
	assert.Contains(t, string(encoded), `"prompt":"a lighthouse at dusk"`)
}

func TestImageRequestUnmarshalUnifiedInputAcceptsEquivalentDuplicateValues(t *testing.T) {
	var request ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"image-model",
		"prompt":"same prompt",
		"images":["https://example.com/a.png"],
		"webhook_url":"https://example.com/hook",
		"input":{
			"prompt":"same prompt",
			"input_urls":"https://example.com/a.png"
		},
		"callBackUrl":"https://example.com/hook"
	}`), &request))

	assert.Equal(t, "same prompt", request.Prompt)
	urls, err := request.ImageInputURLs()
	require.NoError(t, err)
	assert.Equal(t, []string{"https://example.com/a.png"}, urls)
}

func TestImageRequestUnmarshalUnifiedInputRejectsConflictingDuplicates(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{
			name: "prompt",
			body: `{"model":"image-model","prompt":"top","input":{"prompt":"nested"}}`,
			want: "conflicting prompt",
		},
		{
			name: "image aliases",
			body: `{"model":"image-model","input":{"images":["https://example.com/a.png"],"input_urls":["https://example.com/b.png"]}}`,
			want: "conflicting image input",
		},
		{
			name: "flat and nested images",
			body: `{"model":"image-model","images":["https://example.com/a.png"],"input":{"image_input":["https://example.com/b.png"]}}`,
			want: "conflicting image input",
		},
		{
			name: "callback",
			body: `{"model":"image-model","webhook_url":"https://example.com/a","callBackUrl":"https://example.com/b"}`,
			want: "conflicting callback",
		},
		{
			name: "nested size",
			body: `{"model":"image-model","size":"1024x1024","input":{"size":"1536x864"}}`,
			want: "conflicting size",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var request ImageRequest
			err := common.Unmarshal([]byte(tt.body), &request)
			require.Error(t, err)
			assert.Contains(t, strings.ToLower(err.Error()), strings.ToLower(tt.want))
		})
	}
}

func TestImageRequestUnmarshalUnifiedInputRejectsInvalidImageURLs(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{name: "unsupported scheme", url: "file:///tmp/image.png"},
		{name: "missing host", url: "https:///image.png"},
		{name: "unsupported data mime", url: "data:text/plain;base64,ZmFrZQ=="},
		{name: "malformed data uri", url: "data:image/png;base64"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var request ImageRequest
			raw := fmt.Sprintf(`{"model":"image-model","input":{"images":[%q]}}`, tt.url)
			err := common.Unmarshal([]byte(raw), &request)
			require.Error(t, err)
			assert.Contains(t, strings.ToLower(err.Error()), "image")
		})
	}
}

func TestImageRequestUnmarshalUnifiedInputEnforcesBounds(t *testing.T) {
	t.Run("too many urls", func(t *testing.T) {
		urls := make([]string, MaxUnifiedImageInputURLs+1)
		for idx := range urls {
			urls[idx] = "https://example.com/image.png"
		}
		encodedURLs, err := common.Marshal(urls)
		require.NoError(t, err)
		body := fmt.Sprintf(`{"model":"image-model","input":{"images":%s}}`, encodedURLs)

		var request ImageRequest
		err = common.Unmarshal([]byte(body), &request)
		require.Error(t, err)
		assert.Contains(t, strings.ToLower(err.Error()), "too many")
	})

	t.Run("url too long", func(t *testing.T) {
		longURL := "https://example.com/" + strings.Repeat("a", MaxUnifiedImageInputURLLength)
		body := fmt.Sprintf(`{"model":"image-model","input":{"images":[%q]}}`, longURL)

		var request ImageRequest
		err := common.Unmarshal([]byte(body), &request)
		require.Error(t, err)
		assert.Contains(t, strings.ToLower(err.Error()), "long")
	})

	t.Run("large data URI is accepted within decoded input limit", func(t *testing.T) {
		dataURL := "data:image/png;base64," + strings.Repeat("A", 9000)
		body := fmt.Sprintf(`{"model":"image-model","input":{"images":[%q]}}`, dataURL)

		var request ImageRequest
		require.NoError(t, common.Unmarshal([]byte(body), &request))
		urls, err := request.ImageInputURLs()
		require.NoError(t, err)
		require.Len(t, urls, 1)
		assert.Equal(t, dataURL, urls[0])
	})

	t.Run("nested prompt too long", func(t *testing.T) {
		prompt := strings.Repeat("p", MaxUnifiedImagePromptLength+1)
		body := fmt.Sprintf(`{"model":"image-model","input":{"prompt":%q}}`, prompt)

		var request ImageRequest
		err := common.Unmarshal([]byte(body), &request)
		require.Error(t, err)
		assert.Contains(t, strings.ToLower(err.Error()), "prompt")
	})

	t.Run("nested multibyte prompt at code point limit", func(t *testing.T) {
		prompt := strings.Repeat("界", MaxUnifiedImagePromptLength)
		body := fmt.Sprintf(`{"model":"image-model","input":{"prompt":%q}}`, prompt)

		var request ImageRequest
		require.NoError(t, common.Unmarshal([]byte(body), &request))
		assert.Equal(t, prompt, request.Prompt)
	})

	t.Run("nested multibyte prompt over code point limit", func(t *testing.T) {
		prompt := strings.Repeat("界", MaxUnifiedImagePromptLength+1)
		body := fmt.Sprintf(`{"model":"image-model","input":{"prompt":%q}}`, prompt)

		var request ImageRequest
		err := common.Unmarshal([]byte(body), &request)
		require.Error(t, err)
		assert.Contains(t, strings.ToLower(err.Error()), "prompt")
	})

	t.Run("provider native multibyte prompt at code point limit", func(t *testing.T) {
		prompt := strings.Repeat("界", MaxUnifiedImagePromptLength)
		body := fmt.Sprintf(`{"model":"image-model","input":{"prompt":%q,"num_outputs":1}}`, prompt)

		var request ImageRequest
		require.NoError(t, common.Unmarshal([]byte(body), &request))
		assert.Equal(t, prompt, request.Prompt)
		assert.False(t, request.HasUnifiedImageInput())
	})

	t.Run("provider native multibyte prompt over code point limit", func(t *testing.T) {
		prompt := strings.Repeat("界", MaxUnifiedImagePromptLength+1)
		body := fmt.Sprintf(`{"model":"image-model","input":{"prompt":%q,"num_outputs":1}}`, prompt)

		var request ImageRequest
		err := common.Unmarshal([]byte(body), &request)
		require.Error(t, err)
		assert.Contains(t, strings.ToLower(err.Error()), "prompt")
	})
}

func TestImageRequestImageInputURLsPreservesFlatCompatibility(t *testing.T) {
	var request ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"dall-e-3",
		"prompt":"draw a cat",
		"images":["https://example.com/cat.png"]
	}`), &request))

	assert.False(t, request.HasUnifiedImageInput())
	urls, err := request.ImageInputURLs()
	require.NoError(t, err)
	assert.Equal(t, []string{"https://example.com/cat.png"}, urls)
}

func TestImageRequestPreservesProviderNativeInputForLegacyRoutes(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantPrompt string
	}{
		{
			name: "ali messages",
			body: `{
				"model":"qwen-image-edit-plus",
				"input":{"messages":[{"role":"user","content":[{"text":"red bicycle"}]}]}
			}`,
		},
		{
			name:       "replicate controls",
			body:       `{"model":"black-forest-labs/flux","prompt":"red bicycle","input":{"num_outputs":2}}`,
			wantPrompt: "red bicycle",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var request ImageRequest
			require.NoError(t, common.Unmarshal([]byte(tt.body), &request))

			assert.False(t, request.HasUnifiedImageInput())
			assert.Equal(t, tt.wantPrompt, request.Prompt)
			require.Contains(t, request.Extra, "input")
			assert.JSONEq(t, extractInputJSON(t, tt.body), string(request.Extra["input"]))
		})
	}
}

func TestImageRequestTreatsPromptControlsAsUnifiedInput(t *testing.T) {
	var request ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"wanx-v1",
		"input":{"prompt":"red bicycle","negative_prompt":"rain"}
	}`), &request))

	assert.True(t, request.HasUnifiedImageInput())
	assert.Equal(t, "red bicycle", request.Prompt)
	assert.JSONEq(t, `"rain"`, string(request.Extra["negative_prompt"]))
	assert.NotContains(t, request.Extra, "input")
}

func TestImageRequestRemovesGatewayControlsFromProviderNativeInput(t *testing.T) {
	var request ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"qwen-image-edit-plus",
		"input":{
			"messages":[{"role":"user"}],
			"webhook_secret":"nested-secret",
			"webhook_url":"https://example.com/nested-hook",
			"async":true
		}
	}`), &request))

	assert.False(t, request.HasUnifiedImageInput())
	assert.Equal(t, "https://example.com/nested-hook", request.WebhookURL)
	assert.Equal(t, "nested-secret", request.WebhookSecret)
	require.NotNil(t, request.Async)
	assert.True(t, *request.Async)
	var providerInput map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(request.Extra["input"], &providerInput))
	assert.NotContains(t, providerInput, "webhook_secret")
	assert.NotContains(t, providerInput, "webhook_url")
	assert.NotContains(t, providerInput, "async")
}

func TestImageRequestTreatsMixedImageAliasesAsUnifiedInput(t *testing.T) {
	var request ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"nano-banana-2",
		"input":{
			"prompt":"red bicycle",
			"image_input":["https://example.com/bicycle.png"],
			"negative_prompt":"rain"
		}
	}`), &request))

	assert.True(t, request.HasUnifiedImageInput())
	assert.Equal(t, "red bicycle", request.Prompt)
	assert.JSONEq(t, `"rain"`, string(request.Extra["negative_prompt"]))
	assert.NotContains(t, request.Extra, "input")
	urls, err := request.ImageInputURLs()
	require.NoError(t, err)
	assert.Equal(t, []string{"https://example.com/bicycle.png"}, urls)
}

func extractInputJSON(t *testing.T, body string) string {
	t.Helper()
	var fields map[string]json.RawMessage
	require.NoError(t, common.Unmarshal([]byte(body), &fields))
	return string(fields["input"])
}
