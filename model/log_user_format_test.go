package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFormatUserLogsRemovesChannelMetadata(t *testing.T) {
	other := common.MapToJsonStr(map[string]interface{}{
		"channel_id":    42,
		"channel_name":  "private-upstream",
		"channel_type":  1,
		"admin_info":    map[string]interface{}{"use_channel": []string{"42"}},
		"audit_info":    map[string]interface{}{"route": "/v1/chat/completions"},
		"stream_status": "failed",
		"error_code":    "upstream_error",
	})
	logs := []*Log{{Id: 99, ChannelId: 42, ChannelName: "private-upstream", Other: other}}

	formatUserLogs(logs, 10)

	require.Len(t, logs, 1)
	assert.Equal(t, 0, logs[0].ChannelId)
	assert.Empty(t, logs[0].ChannelName)
	assert.Equal(t, 11, logs[0].Id)

	formatted, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.NotContains(t, formatted, "channel_id")
	assert.NotContains(t, formatted, "channel_name")
	assert.NotContains(t, formatted, "channel_type")
	assert.NotContains(t, formatted, "admin_info")
	assert.NotContains(t, formatted, "audit_info")
	assert.NotContains(t, formatted, "stream_status")
	assert.Equal(t, "upstream_error", formatted["error_code"])
}
