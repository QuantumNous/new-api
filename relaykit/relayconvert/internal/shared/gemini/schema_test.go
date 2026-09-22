package gemini

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCleanFunctionParametersStripsUnsupportedKeywords(t *testing.T) {
	params := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"value": map[string]any{
				"const": "alice",
			},
		},
		"required":             []any{"value"},
		"oneOf":                []any{map[string]any{"required": []any{"value"}}},
		"additionalProperties": false,
	}

	cleaned, ok := CleanFunctionParameters(params).(map[string]any)
	require.True(t, ok)

	assert.Equal(t, "OBJECT", cleaned["type"])
	assert.Equal(t, []any{"value"}, cleaned["required"])
	assert.NotContains(t, cleaned, "oneOf")
	assert.NotContains(t, cleaned, "additionalProperties")

	properties, ok := cleaned["properties"].(map[string]any)
	require.True(t, ok)
	value, ok := properties["value"].(map[string]any)
	require.True(t, ok)
	assert.Empty(t, value)
	assert.NotContains(t, value, "const")
}

func TestFunctionParametersNeedJSONSchema(t *testing.T) {
	tests := []struct {
		name   string
		params any
		want   bool
	}{
		{
			name: "const property",
			params: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"value": map[string]any{"const": "alice"},
				},
			},
			want: true,
		},
		{
			name: "additionalProperties",
			params: map[string]any{
				"type":                 "object",
				"additionalProperties": false,
			},
			want: true,
		},
		{
			name: "oneOf",
			params: map[string]any{
				"oneOf": []any{map[string]any{"type": "string"}},
			},
			want: true,
		},
		{
			name: "allowlisted only",
			params: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"value": map[string]any{"type": "string", "enum": []any{"alice"}},
				},
				"required": []any{"value"},
			},
			want: false,
		},
		{name: "nil", params: nil, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, FunctionParametersNeedJSONSchema(tt.params))
		})
	}
}

func TestEncodeFunctionParametersForGemini(t *testing.T) {
	t.Run("const uses parametersJsonSchema", func(t *testing.T) {
		original := map[string]any{
			"type": "object",
			"properties": map[string]any{
				"value": map[string]any{"const": "alice"},
			},
			"required": []any{"value"},
		}
		parameters, parametersJSONSchema := EncodeFunctionParametersForGemini(original)
		assert.Nil(t, parameters)
		require.NotNil(t, parametersJSONSchema)
		schema, ok := parametersJSONSchema.(map[string]any)
		require.True(t, ok)
		props := schema["properties"].(map[string]any)
		assert.Equal(t, "alice", props["value"].(map[string]any)["const"])
	})

	t.Run("allowlisted uses cleaned parameters", func(t *testing.T) {
		parameters, parametersJSONSchema := EncodeFunctionParametersForGemini(map[string]any{
			"type": "object",
			"properties": map[string]any{
				"value": map[string]any{"type": "string"},
			},
		})
		assert.Nil(t, parametersJSONSchema)
		cleaned, ok := parameters.(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "OBJECT", cleaned["type"])
	})

	t.Run("empty properties clears schema", func(t *testing.T) {
		parameters, parametersJSONSchema := EncodeFunctionParametersForGemini(map[string]any{
			"type":       "object",
			"properties": map[string]any{},
		})
		assert.Nil(t, parameters)
		assert.Nil(t, parametersJSONSchema)
	})
}
