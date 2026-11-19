package gemini

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFunctionParametersUsesParametersJsonSchemaForAnyOfNull(t *testing.T) {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"surface": map[string]any{
				"description": "target surface",
				"anyOf": []any{
					map[string]any{"type": "string", "enum": []any{"word", "excel"}},
					map[string]any{"type": "null"},
				},
			},
		},
	}

	field, value, misfits := FunctionParameters(schema, true)
	assert.Equal(t, "parametersJsonSchema", field)
	assert.Empty(t, misfits)
	assert.Equal(t, schema, value)
}

func TestFunctionParametersLegacyCollapsesNullableAnyOf(t *testing.T) {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"surface": map[string]any{
				"description": "target surface",
				"anyOf": []any{
					map[string]any{"type": "string", "enum": []any{"word", "excel"}},
					map[string]any{"type": "null"},
				},
			},
			"mixed": map[string]any{
				"anyOf": []any{
					map[string]any{"type": "string"},
					map[string]any{"type": "integer"},
					map[string]any{"type": "null"},
				},
			},
		},
	}

	field, value, misfits := FunctionParameters(schema, false)
	assert.Equal(t, "parameters", field)
	assert.Contains(t, misfits, "null type")

	cleaned, ok := value.(map[string]any)
	require.True(t, ok)
	props, ok := cleaned["properties"].(map[string]any)
	require.True(t, ok)

	surface, ok := props["surface"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "STRING", surface["type"])
	assert.Equal(t, true, surface["nullable"])
	assert.Equal(t, "target surface", surface["description"])
	assert.Equal(t, []any{"word", "excel"}, surface["enum"])
	assert.NotContains(t, surface, "anyOf")

	mixed, ok := props["mixed"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, true, mixed["nullable"])
	variants, ok := mixed["anyOf"].([]any)
	require.True(t, ok)
	require.Len(t, variants, 2)
	assert.Equal(t, "STRING", variants[0].(map[string]any)["type"])
	assert.Equal(t, "INTEGER", variants[1].(map[string]any)["type"])
}
