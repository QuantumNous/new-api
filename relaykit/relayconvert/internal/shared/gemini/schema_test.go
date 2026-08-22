package gemini

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCleanFunctionParametersNormalizesNullableUnion(t *testing.T) {
	cleaned := CleanFunctionParameters(map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"due_date": map[string]interface{}{
				"description": "Optional due date",
				"anyOf": []interface{}{
					map[string]interface{}{"type": "string"},
					map[string]interface{}{"type": "null"},
				},
			},
		},
	})

	root, ok := cleaned.(map[string]interface{})
	require.True(t, ok)
	properties, ok := root["properties"].(map[string]interface{})
	require.True(t, ok)
	dueDate, ok := properties["due_date"].(map[string]interface{})
	require.True(t, ok)

	assert.Equal(t, "OBJECT", root["type"])
	assert.Equal(t, "STRING", dueDate["type"])
	assert.Equal(t, true, dueDate["nullable"])
	assert.Equal(t, "Optional due date", dueDate["description"])
	assert.NotContains(t, dueDate, "anyOf")
}

func TestCleanFunctionParametersNormalizesLiteralUnion(t *testing.T) {
	cleaned := CleanFunctionParameters(map[string]interface{}{
		"anyOf": []interface{}{
			map[string]interface{}{"type": "string", "const": "open"},
			map[string]interface{}{"type": "string", "const": "completed"},
		},
	})

	schema, ok := cleaned.(map[string]interface{})
	require.True(t, ok)

	assert.Equal(t, "STRING", schema["type"])
	assert.Equal(t, []interface{}{"open", "completed"}, schema["enum"])
	assert.NotContains(t, schema, "anyOf")
	assert.NotContains(t, schema, "const")
}
