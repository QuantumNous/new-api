package gemini

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCleanFunctionParametersInfersMissingGeminiTypes(t *testing.T) {
	params := map[string]interface{}{
		"properties": map[string]interface{}{
			"projectId": map[string]interface{}{"description": "Project identifier"},
			"paths": map[string]interface{}{
				"items": map[string]interface{}{"type": "string"},
			},
			"options": map[string]interface{}{
				"properties": map[string]interface{}{"enabled": map[string]interface{}{"type": "boolean"}},
			},
		},
		"required": []interface{}{"projectId"},
	}

	cleaned, ok := CleanFunctionParameters(params).(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "OBJECT", cleaned["type"])
	properties := cleaned["properties"].(map[string]interface{})
	assert.Equal(t, "STRING", properties["projectId"].(map[string]interface{})["type"])
	assert.Equal(t, "ARRAY", properties["paths"].(map[string]interface{})["type"])
	assert.Equal(t, "OBJECT", properties["options"].(map[string]interface{})["type"])
}
