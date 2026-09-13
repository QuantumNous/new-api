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

// TestCleanFunctionParametersPreservesConst 验证常量与已有枚举的交集不会放宽约束。
func TestCleanFunctionParametersPreservesConst(t *testing.T) {
	for _, tc := range []struct {
		name   string
		values []interface{}
		want   []interface{}
	}{
		{"overlapping", []interface{}{"open", "completed"}, []interface{}{"open"}},
		{"disjoint", []interface{}{"completed"}, []interface{}{}},
		{"empty", []interface{}{}, []interface{}{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cleaned := CleanFunctionParameters(map[string]interface{}{"type": "string", "const": "open", "enum": tc.values})
			schema, ok := cleaned.(map[string]interface{})
			require.True(t, ok)
			assert.Equal(t, tc.want, schema["enum"])
			assert.NotContains(t, schema, "const")
		})
	}
}

// TestCleanFunctionParametersPreservesConstrainedUnion 验证同类型分支的独立约束得到保留。
func TestCleanFunctionParametersPreservesConstrainedUnion(t *testing.T) {
	cleaned := CleanFunctionParameters(map[string]interface{}{"anyOf": []interface{}{
		map[string]interface{}{"type": "string", "pattern": "^a"},
		map[string]interface{}{"type": "string", "pattern": "^b"},
	}})
	schema, ok := cleaned.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "STRING", schema["type"])
	assert.Equal(t, []interface{}{
		map[string]interface{}{"type": "STRING", "pattern": "^a"},
		map[string]interface{}{"type": "STRING", "pattern": "^b"},
	}, schema["anyOf"])
}
