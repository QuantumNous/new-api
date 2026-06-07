package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeminiChatGenerationConfigPreservesExplicitZeroValuesCamelCase(t *testing.T) {
	raw := []byte(`{
		"contents":[{"role":"user","parts":[{"text":"hello"}]}],
		"generationConfig":{
			"topP":0,
			"topK":0,
			"maxOutputTokens":0,
			"candidateCount":0,
			"seed":0,
			"responseLogprobs":false
		}
	}`)

	var req GeminiChatRequest
	require.NoError(t, common.Unmarshal(raw, &req))

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	var out map[string]any
	require.NoError(t, common.Unmarshal(encoded, &out))

	generationConfig, ok := out["generationConfig"].(map[string]any)
	require.True(t, ok)

	assert.Contains(t, generationConfig, "topP")
	assert.Contains(t, generationConfig, "topK")
	assert.Contains(t, generationConfig, "maxOutputTokens")
	assert.Contains(t, generationConfig, "candidateCount")
	assert.Contains(t, generationConfig, "seed")
	assert.Contains(t, generationConfig, "responseLogprobs")

	assert.Equal(t, float64(0), generationConfig["topP"])
	assert.Equal(t, float64(0), generationConfig["topK"])
	assert.Equal(t, float64(0), generationConfig["maxOutputTokens"])
	assert.Equal(t, float64(0), generationConfig["candidateCount"])
	assert.Equal(t, float64(0), generationConfig["seed"])
	assert.Equal(t, false, generationConfig["responseLogprobs"])
}

func TestGeminiChatGenerationConfigPreservesExplicitZeroValuesSnakeCase(t *testing.T) {
	raw := []byte(`{
		"contents":[{"role":"user","parts":[{"text":"hello"}]}],
		"generationConfig":{
			"top_p":0,
			"top_k":0,
			"max_output_tokens":0,
			"candidate_count":0,
			"seed":0,
			"response_logprobs":false
		}
	}`)

	var req GeminiChatRequest
	require.NoError(t, common.Unmarshal(raw, &req))

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	var out map[string]any
	require.NoError(t, common.Unmarshal(encoded, &out))

	generationConfig, ok := out["generationConfig"].(map[string]any)
	require.True(t, ok)

	assert.Contains(t, generationConfig, "topP")
	assert.Contains(t, generationConfig, "topK")
	assert.Contains(t, generationConfig, "maxOutputTokens")
	assert.Contains(t, generationConfig, "candidateCount")
	assert.Contains(t, generationConfig, "seed")
	assert.Contains(t, generationConfig, "responseLogprobs")

	assert.Equal(t, float64(0), generationConfig["topP"])
	assert.Equal(t, float64(0), generationConfig["topK"])
	assert.Equal(t, float64(0), generationConfig["maxOutputTokens"])
	assert.Equal(t, float64(0), generationConfig["candidateCount"])
	assert.Equal(t, float64(0), generationConfig["seed"])
	assert.Equal(t, false, generationConfig["responseLogprobs"])
}

func TestGeminiThinkingConfigPreservesExplicitFalseValues(t *testing.T) {
	tests := []struct {
		name string
		raw  []byte
	}{
		{
			name: "camel case",
			raw: []byte(`{
				"contents":[{"role":"user","parts":[{"text":"hello"}]}],
				"generationConfig":{
					"thinkingConfig":{
						"includeThoughts":false
					}
				}
			}`),
		},
		{
			name: "snake case",
			raw: []byte(`{
				"contents":[{"role":"user","parts":[{"text":"hello"}]}],
				"generationConfig":{
					"thinking_config":{
						"include_thoughts":false
					}
				}
			}`),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req GeminiChatRequest
			require.NoError(t, common.Unmarshal(tt.raw, &req))

			encoded, err := common.Marshal(req)
			require.NoError(t, err)

			var out map[string]any
			require.NoError(t, common.Unmarshal(encoded, &out))

			generationConfig, ok := out["generationConfig"].(map[string]any)
			require.True(t, ok)
			thinkingConfig, ok := generationConfig["thinkingConfig"].(map[string]any)
			require.True(t, ok)

			assert.Contains(t, thinkingConfig, "includeThoughts")
			assert.Equal(t, false, thinkingConfig["includeThoughts"])
		})
	}
}
