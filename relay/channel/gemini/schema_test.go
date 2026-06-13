package gemini

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCleanFunctionParametersInfersMissingGeminiSchemaTypes(t *testing.T) {
	params := map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"edits": map[string]interface{}{
				"properties": map[string]interface{}{
					"lines": map[string]interface{}{
						"items": map[string]interface{}{
							"properties": map[string]interface{}{
								"line": map[string]interface{}{"type": "integer"},
							},
						},
					},
					"mode": map[string]interface{}{
						"enum": []interface{}{"replace", "insert"},
					},
				},
			},
		},
	}

	cleaned, ok := cleanFunctionParameters(params).(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "OBJECT", cleaned["type"])

	properties := cleaned["properties"].(map[string]interface{})
	edits := properties["edits"].(map[string]interface{})
	require.Equal(t, "OBJECT", edits["type"])

	editProperties := edits["properties"].(map[string]interface{})
	lines := editProperties["lines"].(map[string]interface{})
	require.Equal(t, "ARRAY", lines["type"])

	items := lines["items"].(map[string]interface{})
	require.Equal(t, "OBJECT", items["type"])

	itemProperties := items["properties"].(map[string]interface{})
	line := itemProperties["line"].(map[string]interface{})
	require.Equal(t, "INTEGER", line["type"])

	mode := editProperties["mode"].(map[string]interface{})
	require.Equal(t, "STRING", mode["type"])
}
