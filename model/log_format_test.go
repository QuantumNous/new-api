package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/require"
)

func TestImageErrorLogsPreserveUpstreamMessage(t *testing.T) {
	const original = "status_code=400, upstream safety checks"
	entry := &Log{Type: LogTypeError, Content: original, Other: `{"request_path":"/pg/images/edits","error_code":"content_policy_violation","admin_info":{"use_channel":["1"]}}`}
	formatUserLogs([]*Log{entry}, 0)
	require.Equal(t, original, entry.Content)
	require.NotContains(t, entry.Other, "admin_info")
	require.NotContains(t, entry.Other, "original_error")
}

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
