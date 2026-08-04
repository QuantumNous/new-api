package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestRecordConsumeLogStoresUpstreamResponseIdInOther(t *testing.T) {
	truncateTables(t)
	configureRequestSamplingForTest(t, false, 0, nil)
	c := newRequestSamplingContext("POST", "/v1/messages", nil)
	c.Set(common.UpstreamRequestIdKey, "req_upstream_123")
	c.Set(common.UpstreamResponseIdKey, "msg_response_456")

	RecordConsumeLog(c, 123, RecordConsumeLogParams{
		ModelName: "claude-opus-4-8",
		Other:     map[string]interface{}{"request_path": "/v1/messages"},
	})

	var log Log
	require.NoError(t, LOG_DB.Last(&log).Error)
	require.Equal(t, "req_upstream_123", log.UpstreamRequestId)
	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	require.Equal(t, "msg_response_456", other["upstream_response_id"])
	require.Equal(t, "/v1/messages", other["request_path"])
}
