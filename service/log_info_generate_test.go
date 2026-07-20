package service

import (
	"context"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAppendStreamStatusIncludesDiagnosticContext(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		IsStream:              true,
		ReceivedResponseCount: 3,
		StreamStatus:          relaycommon.NewStreamStatus(),
	}
	relayInfo.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, context.Canceled)
	other := map[string]interface{}{}

	appendStreamStatus(relayInfo, other)

	streamStatus, ok := other["stream_status"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "error", streamStatus["status"])
	assert.Equal(t, "client_gone", streamStatus["end_reason"])
	assert.Equal(t, "context canceled", streamStatus["end_error"])
	assert.Equal(t, 3, streamStatus["received_response_count"])
}
