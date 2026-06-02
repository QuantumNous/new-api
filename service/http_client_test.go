package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestRelayRequestTimeoutUsesStreamGlobalTimeout(t *testing.T) {
	oldRelayTimeout := common.RelayTimeout
	oldRelayNonStreamTimeout := common.RelayNonStreamTimeout
	t.Cleanup(func() {
		common.RelayTimeout = oldRelayTimeout
		common.RelayNonStreamTimeout = oldRelayNonStreamTimeout
	})

	common.RelayTimeout = 30
	common.RelayNonStreamTimeout = 5

	require.Equal(t, 30*time.Second, relayRequestTimeout(true))
}

func TestRelayRequestTimeoutUsesNonStreamOverride(t *testing.T) {
	oldRelayTimeout := common.RelayTimeout
	oldRelayNonStreamTimeout := common.RelayNonStreamTimeout
	t.Cleanup(func() {
		common.RelayTimeout = oldRelayTimeout
		common.RelayNonStreamTimeout = oldRelayNonStreamTimeout
	})

	common.RelayTimeout = 0
	common.RelayNonStreamTimeout = 5

	require.Equal(t, 5*time.Second, relayRequestTimeout(false))
}

func TestRelayRequestTimeoutFallsBackAndCapsNonStreamTimeout(t *testing.T) {
	oldRelayTimeout := common.RelayTimeout
	oldRelayNonStreamTimeout := common.RelayNonStreamTimeout
	t.Cleanup(func() {
		common.RelayTimeout = oldRelayTimeout
		common.RelayNonStreamTimeout = oldRelayNonStreamTimeout
	})

	common.RelayTimeout = 10
	common.RelayNonStreamTimeout = -1
	require.Equal(t, 10*time.Second, relayRequestTimeout(false))

	common.RelayNonStreamTimeout = 30
	require.Equal(t, 10*time.Second, relayRequestTimeout(false))
}

func TestShouldUseResponseHeaderTimeoutOnlyForStream(t *testing.T) {
	oldRelayResponseHeaderTimeout := common.RelayResponseHeaderTimeout
	t.Cleanup(func() {
		common.RelayResponseHeaderTimeout = oldRelayResponseHeaderTimeout
	})

	common.RelayResponseHeaderTimeout = 0
	require.False(t, shouldUseResponseHeaderTimeout(true))

	common.RelayResponseHeaderTimeout = 3
	require.True(t, shouldUseResponseHeaderTimeout(true))
	require.False(t, shouldUseResponseHeaderTimeout(false))
}
