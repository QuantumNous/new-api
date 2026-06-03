package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestRelayResponseHeaderTimeout(t *testing.T) {
	oldRelayTimeout := common.RelayTimeout
	oldStreamingTimeout := constant.StreamingTimeout
	t.Cleanup(func() {
		common.RelayTimeout = oldRelayTimeout
		constant.StreamingTimeout = oldStreamingTimeout
	})

	common.RelayTimeout = 120
	constant.StreamingTimeout = 300
	require.Equal(t, 120*time.Second, relayResponseHeaderTimeout())

	common.RelayTimeout = 0
	constant.StreamingTimeout = 45
	require.Equal(t, 45*time.Second, relayResponseHeaderTimeout())

	common.RelayTimeout = 0
	constant.StreamingTimeout = 0
	require.Equal(t, 300*time.Second, relayResponseHeaderTimeout())
}
