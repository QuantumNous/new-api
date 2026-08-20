package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
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
		got := newRelayHTTPTransport().ResponseHeaderTimeout
		if want := 42 * time.Second; got != want {
			t.Fatalf("ResponseHeaderTimeout = %v, want %v", got, want)
		}
	})

	t.Run("zero keeps it unset", func(t *testing.T) {
		common.RelayResponseHeaderTimeout = 0
		if got := newRelayHTTPTransport().ResponseHeaderTimeout; got != 0 {
			t.Fatalf("ResponseHeaderTimeout = %v, want 0 (disabled)", got)
		}
	})
}
