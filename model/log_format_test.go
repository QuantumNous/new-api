package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/require"
)

func TestFormatUserLogsShowsOnlyStatusCodeForRelayErrors(t *testing.T) {
	logs := []*Log{
		{
			Type:    LogTypeError,
			Content: "status_code=503, 服务暂时不可用，请稍后重试",
			Other:   common.MapToJsonStr(map[string]interface{}{"status_code": 503}),
		},
		{
			Type:    LogTypeError,
			Content: "status_code=524, upstream timeout",
			Other:   "{}",
		},
		{
			Type:    LogTypeConsume,
			Content: "正常消费日志",
			Other:   "{}",
		},
	}

	formatUserLogs(logs, 0)

	require.Equal(t, "status_code=503", logs[0].Content)
	require.Equal(t, "status_code=524", logs[1].Content)
	require.Equal(t, "正常消费日志", logs[2].Content)
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
