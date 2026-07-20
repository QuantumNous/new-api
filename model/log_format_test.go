package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/require"
)

// TestFormatUserLogsStripsQuotaSaturation verifies the admin-only quota
// saturation marker (nested under other.admin_info) is removed for non-admin
// log views, since formatUserLogs strips the whole admin_info object.
func TestFormatUserLogsStripsQuotaSaturation(t *testing.T) {
	other := common.MapToJsonStr(map[string]interface{}{
		"model_price": 0.004,
		"admin_info": map[string]interface{}{
			"quota_saturation": map[string]interface{}{
				"op":      "QuotaFromDecimal",
				"kind":    "overflow",
				"clamped": common.MaxQuota,
			},
		},
	})
	logs := []*Log{{Other: other}}

	formatUserLogs(logs, 0)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	_, hasAdminInfo := parsed["admin_info"]
	require.False(t, hasAdminInfo, "admin_info (and nested quota_saturation) must be stripped for non-admin views")
	// Non-admin billing fields remain visible.
	require.Contains(t, parsed, "model_price")
}

func TestFormatTokenLogsRedactsImageTaskContent(t *testing.T) {
	other := common.MapToJsonStr(map[string]interface{}{
		"task_info": map[string]interface{}{
			"version": 1,
			"kind":    "image_generation",
			"status":  TaskStatusSuccess,
			"request": map[string]interface{}{
				"operation": "generation",
				"prompt":    "private prompt",
				"size":      "1024x1024",
				"style":     "private natural-language style",
			},
			"result": map[string]interface{}{
				"count": 1,
				"images": []map[string]interface{}{
					{"url": "https://cdn.example/private.png", "revised_prompt": "private revised prompt"},
				},
			},
			"timing": map[string]interface{}{"total_ms": 2500},
		},
	})
	logs := []*Log{{Other: other}}

	formatTokenLogs(logs)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	encoded := common.MapToJsonStr(parsed)
	require.NotContains(t, encoded, "private prompt")
	require.NotContains(t, encoded, "private revised prompt")
	require.NotContains(t, encoded, "private natural-language style")
	require.NotContains(t, encoded, "https://cdn.example/private.png")
	require.Contains(t, encoded, `"status":"SUCCESS"`)
	require.Contains(t, encoded, `"count":1`)
	require.Contains(t, encoded, `"total_ms":2500`)
	require.Contains(t, encoded, `"operation":"generation"`)
	require.Contains(t, encoded, `"size":"1024x1024"`)
}
