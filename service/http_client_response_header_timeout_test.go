package service

import (
	"math"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/require"
)

// The relay transport must bound how long it waits for upstream response headers.
// Without it an upstream that accepts the connection but never answers parks the
// goroutine forever and keeps the whole request body reachable, which shows up as
// unbounded heap growth and eventually OOM.
func TestNewRelayHTTPTransportResponseHeaderTimeout(t *testing.T) {
	original := common.RelayResponseHeaderTimeout
	defer func() { common.RelayResponseHeaderTimeout = original }()

	t.Run("applies configured timeout", func(t *testing.T) {
		common.RelayResponseHeaderTimeout = 42
		require.Equal(t, 42*time.Second, newRelayHTTPTransport().ResponseHeaderTimeout)
	})

	t.Run("zero keeps it unset", func(t *testing.T) {
		common.RelayResponseHeaderTimeout = 0
		require.Zero(t, newRelayHTTPTransport().ResponseHeaderTimeout)
	})

	t.Run("negative keeps it unset", func(t *testing.T) {
		common.RelayResponseHeaderTimeout = -1
		require.Zero(t, newRelayHTTPTransport().ResponseHeaderTimeout)
	})

	// A value large enough to overflow time.Duration must not wrap into a tiny
	// positive timeout, which would cut every relay request.
	t.Run("overflowing value is clamped", func(t *testing.T) {
		common.RelayResponseHeaderTimeout = math.MaxInt64
		got := newRelayHTTPTransport().ResponseHeaderTimeout
		require.Positive(t, got)
		require.Equal(t, time.Duration(maxTimeoutSeconds)*time.Second, got)
	})
}
