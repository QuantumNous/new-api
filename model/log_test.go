package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestFormatUserLogsRemovesErrorDebugFields(t *testing.T) {
	logs := []*Log{
		{
			Id:          99,
			ChannelName: "secret-channel",
			Other: common.MapToJsonStr(map[string]interface{}{
				"request_path":         "/v1/chat/completions",
				"request_method":       "POST",
				"error_type":           "openai_error",
				"error_code":           "bad_request",
				"error_source":         "upstream",
				"admin_info":           map[string]interface{}{"use_channel": []string{"1", "2"}},
				"channel_id":           1,
				"channel_name":         "secret-channel",
				"channel_type":         1,
				"final_model_name":     "upstream-model",
				"request_conversion":   []string{"openai", "claude"},
				"final_relay_format":   "claude",
				"retry_count":          1,
				"upstream_error":       map[string]interface{}{"message": "masked upstream error"},
				"upstream_status_code": 400,
				"last_error_summary":   "masked upstream error",
				"stream_status":        map[string]interface{}{"status": "error"},
			}),
		},
	}

	formatUserLogs(logs, 0)

	require.Equal(t, "", logs[0].ChannelName)
	require.Equal(t, 1, logs[0].Id)
	other, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	require.Equal(t, "/v1/chat/completions", other["request_path"])
	require.Equal(t, "POST", other["request_method"])
	require.Equal(t, "openai_error", other["error_type"])
	require.Equal(t, "bad_request", other["error_code"])
	require.Equal(t, "upstream", other["error_source"])
	require.NotContains(t, other, "admin_info")
	require.NotContains(t, other, "channel_id")
	require.NotContains(t, other, "channel_name")
	require.NotContains(t, other, "channel_type")
	require.NotContains(t, other, "final_model_name")
	require.NotContains(t, other, "request_conversion")
	require.NotContains(t, other, "final_relay_format")
	require.NotContains(t, other, "retry_count")
	require.NotContains(t, other, "upstream_error")
	require.NotContains(t, other, "upstream_status_code")
	require.NotContains(t, other, "last_error_summary")
	require.NotContains(t, other, "stream_status")
}
