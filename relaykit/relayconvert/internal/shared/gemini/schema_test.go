package gemini

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCleanFunctionParametersEnumSanitization(t *testing.T) {
	tests := []struct {
		name     string
		params   map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "string enum passes through",
			params: map[string]interface{}{
				"type": "string",
				"enum": []interface{}{"red", "green", "blue"},
			},
			expected: map[string]interface{}{
				"type": "STRING",
				"enum": []interface{}{"red", "green", "blue"},
			},
		},
		{
			name: "boolean enum is dropped and type is kept",
			params: map[string]interface{}{
				"type": "boolean",
				"enum": []interface{}{true},
			},
			expected: map[string]interface{}{
				"type": "BOOLEAN",
			},
		},
		{
			name: "mixed string and boolean enum is dropped",
			params: map[string]interface{}{
				"type": "string",
				"enum": []interface{}{"on", true},
			},
			expected: map[string]interface{}{
				"type": "STRING",
			},
		},
		{
			name: "number enum is dropped",
			params: map[string]interface{}{
				"type": "number",
				"enum": []interface{}{1.0, 2.5},
			},
			expected: map[string]interface{}{
				"type": "NUMBER",
			},
		},
		{
			name: "enum nested in properties is sanitized",
			params: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"flag": map[string]interface{}{
						"type": "boolean",
						"enum": []interface{}{true},
					},
					"color": map[string]interface{}{
						"type": "string",
						"enum": []interface{}{"red"},
					},
				},
			},
			expected: map[string]interface{}{
				"type": "OBJECT",
				"properties": map[string]interface{}{
					"flag": map[string]interface{}{
						"type": "BOOLEAN",
					},
					"color": map[string]interface{}{
						"type": "STRING",
						"enum": []interface{}{"red"},
					},
				},
			},
		},
		{
			name: "enum nested in array items is sanitized",
			params: map[string]interface{}{
				"type": "array",
				"items": map[string]interface{}{
					"type": "boolean",
					"enum": []interface{}{false},
				},
			},
			expected: map[string]interface{}{
				"type":  "ARRAY",
				"items": map[string]interface{}{"type": "BOOLEAN"},
			},
		},
		{
			name: "enum nested in anyOf is sanitized",
			params: map[string]interface{}{
				"anyOf": []interface{}{
					map[string]interface{}{
						"type": "boolean",
						"enum": []interface{}{true},
					},
					map[string]interface{}{
						"type": "string",
						"enum": []interface{}{"yes", "no"},
					},
				},
			},
			expected: map[string]interface{}{
				"anyOf": []interface{}{
					map[string]interface{}{"type": "BOOLEAN"},
					map[string]interface{}{
						"type": "STRING",
						"enum": []interface{}{"yes", "no"},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cleaned := CleanFunctionParameters(tt.params)
			assert.Equal(t, tt.expected, cleaned)
		})
	}
}

func TestCleanFunctionParametersShallowDropsBooleanEnum(t *testing.T) {
	// Schemas beyond geminiFunctionSchemaMaxDepth fall back to the shallow
	// cleaner, which must apply the same enum sanitization.
	params := map[string]interface{}{
		"type": "boolean",
		"enum": []interface{}{true},
	}
	cleaned := cleanGeminiFunctionParametersShallow(params)
	assert.Equal(t, map[string]interface{}{"type": "BOOLEAN"}, cleaned)

	stringEnum := map[string]interface{}{
		"type": "string",
		"enum": []interface{}{"a", "b"},
	}
	cleaned = cleanGeminiFunctionParametersShallow(stringEnum)
	assert.Equal(t, map[string]interface{}{
		"type": "STRING",
		"enum": []interface{}{"a", "b"},
	}, cleaned)
}
