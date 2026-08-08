package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/savings_setting"

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

func TestFormatUserLogsHidesSavingsEstimateWhenDisabled(t *testing.T) {
	require.NoError(t, savings_setting.UpdateSettingByJSONString(""))
	t.Cleanup(func() { require.NoError(t, savings_setting.UpdateSettingByJSONString("")) })

	logs := []*Log{{
		Other: common.MapToJsonStr(map[string]any{
			"savings_estimate": map[string]any{"savings_quota": 100},
			"visible":          true,
		}),
	}}

	formatUserLogs(logs, 0)

	otherMap, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	require.NotContains(t, otherMap, "savings_estimate")
	require.Equal(t, true, otherMap["visible"])
}

func TestFormatUserLogsKeepsSavingsEstimateWhenEnabledForUsageLogs(t *testing.T) {
	require.NoError(t, savings_setting.UpdateSettingByJSONString(`{
		"enabled": true,
		"show_on_usage_logs": true
	}`))
	t.Cleanup(func() { require.NoError(t, savings_setting.UpdateSettingByJSONString("")) })

	logs := []*Log{{
		Other: common.MapToJsonStr(map[string]any{
			"savings_estimate": map[string]any{"savings_quota": 100},
		}),
	}}

	formatUserLogs(logs, 0)

	otherMap, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	require.Contains(t, otherMap, "savings_estimate")
}
