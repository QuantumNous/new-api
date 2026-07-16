package service

import (
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
)

func withRelayTimeoutConfig(t *testing.T) {
	t.Helper()
	old := struct {
		hdr, streamHdr, dial, tls, relay int
	}{
		common.RelayResponseHeaderTimeout,
		common.RelayStreamResponseHeaderTimeout,
		common.RelayDialTimeout,
		common.RelayTLSHandshakeTimeout,
		common.RelayTimeout,
	}
	common.RelayResponseHeaderTimeout = 60
	common.RelayStreamResponseHeaderTimeout = 30
	common.RelayDialTimeout = 10
	common.RelayTLSHandshakeTimeout = 10
	common.RelayTimeout = 0
	t.Cleanup(func() {
		common.RelayResponseHeaderTimeout = old.hdr
		common.RelayStreamResponseHeaderTimeout = old.streamHdr
		common.RelayDialTimeout = old.dial
		common.RelayTLSHandshakeTimeout = old.tls
		common.RelayTimeout = old.relay
		InitHttpClient()
	})
}

func transportOf(t *testing.T, c *http.Client) *http.Transport {
	t.Helper()
	tr, ok := c.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("client transport is %T, want *http.Transport", c.Transport)
	}
	return tr
}

// TestRelayTransportsSetConnectAndHandshakeTimeouts guards against regressing to
// a transport with no connect/TLS bound, which let a black-holed upstream hang.
func TestRelayTransportsSetConnectAndHandshakeTimeouts(t *testing.T) {
	withRelayTimeoutConfig(t)
	InitHttpClient()

	for _, streaming := range []bool{false, true} {
		tr := transportOf(t, GetRelayHttpClient(streaming))
		if tr.DialContext == nil {
			t.Fatalf("streaming=%v: DialContext is nil (no connect timeout)", streaming)
		}
		if tr.TLSHandshakeTimeout != 10*time.Second {
			t.Fatalf("streaming=%v: TLSHandshakeTimeout = %v, want 10s", streaming, tr.TLSHandshakeTimeout)
		}
		if tr.IdleConnTimeout != 90*time.Second {
			t.Fatalf("streaming=%v: IdleConnTimeout = %v, want 90s", streaming, tr.IdleConnTimeout)
		}
	}
}

// TestStreamingUsesShorterResponseHeaderTimeout is the core latency fix: a
// streaming relay must fail over from a dead channel using the shorter stream
// header timeout, while non-streaming keeps the longer one for slow buffered
// (reasoning) responses.
func TestStreamingUsesShorterResponseHeaderTimeout(t *testing.T) {
	withRelayTimeoutConfig(t)
	InitHttpClient()

	nonStream := transportOf(t, GetRelayHttpClient(false))
	if nonStream.ResponseHeaderTimeout != 60*time.Second {
		t.Fatalf("non-stream ResponseHeaderTimeout = %v, want 60s", nonStream.ResponseHeaderTimeout)
	}

	stream := transportOf(t, GetRelayHttpClient(true))
	if stream.ResponseHeaderTimeout != 30*time.Second {
		t.Fatalf("stream ResponseHeaderTimeout = %v, want 30s", stream.ResponseHeaderTimeout)
	}

	if GetRelayHttpClient(true) == GetRelayHttpClient(false) {
		t.Fatal("streaming and non-streaming relay must use distinct clients")
	}
}

// TestProxyClientCacheSeparatesStreamModes ensures the proxy client cache does
// not hand a non-streaming (60s) transport to a streaming request or vice
// versa, since they carry different header timeouts.
func TestProxyClientCacheSeparatesStreamModes(t *testing.T) {
	withRelayTimeoutConfig(t)
	InitHttpClient()
	ResetProxyClientCache()
	t.Cleanup(ResetProxyClientCache)

	const proxyURL = "http://127.0.0.1:3128"
	streamClient, err := GetRelayHttpClientWithProxy(proxyURL, true)
	if err != nil {
		t.Fatalf("stream proxy client: %v", err)
	}
	nonStreamClient, err := GetRelayHttpClientWithProxy(proxyURL, false)
	if err != nil {
		t.Fatalf("non-stream proxy client: %v", err)
	}

	if streamClient == nonStreamClient {
		t.Fatal("proxy cache returned the same client for stream and non-stream modes")
	}
	if got := transportOf(t, streamClient).ResponseHeaderTimeout; got != 30*time.Second {
		t.Fatalf("stream proxy ResponseHeaderTimeout = %v, want 30s", got)
	}
	if got := transportOf(t, nonStreamClient).ResponseHeaderTimeout; got != 60*time.Second {
		t.Fatalf("non-stream proxy ResponseHeaderTimeout = %v, want 60s", got)
	}
}

// TestRelayHTTP2KeepaliveConfigured verifies the transport gets proactive HTTP/2
// keepalive pings so a silently-dropped pooled upstream connection is reaped
// instead of stalling the next request until the response-header timeout.
func TestRelayHTTP2KeepaliveConfigured(t *testing.T) {
	oldIdle, oldPing := common.RelayH2ReadIdleTimeout, common.RelayH2PingTimeout
	t.Cleanup(func() {
		common.RelayH2ReadIdleTimeout = oldIdle
		common.RelayH2PingTimeout = oldPing
	})

	common.RelayH2ReadIdleTimeout = 15
	common.RelayH2PingTimeout = 5

	tr := &http.Transport{ForceAttemptHTTP2: true}
	h2 := configureRelayHTTP2Keepalive(tr)
	if h2 == nil {
		t.Fatal("expected HTTP/2 transport to be configured")
	}
	if h2.ReadIdleTimeout != 15*time.Second {
		t.Fatalf("ReadIdleTimeout = %v, want 15s", h2.ReadIdleTimeout)
	}
	if h2.PingTimeout != 5*time.Second {
		t.Fatalf("PingTimeout = %v, want 5s", h2.PingTimeout)
	}
	if tr.TLSNextProto["h2"] == nil {
		t.Fatal("expected h2 registered in transport.TLSNextProto")
	}
}

// TestRelayHTTP2KeepaliveDisabled verifies RELAY_H2_READ_IDLE_TIMEOUT=0 turns
// the keepalive off entirely (no h2 override registered).
func TestRelayHTTP2KeepaliveDisabled(t *testing.T) {
	old := common.RelayH2ReadIdleTimeout
	t.Cleanup(func() { common.RelayH2ReadIdleTimeout = old })

	common.RelayH2ReadIdleTimeout = 0

	tr := &http.Transport{ForceAttemptHTTP2: true}
	if h2 := configureRelayHTTP2Keepalive(tr); h2 != nil {
		t.Fatal("expected no HTTP/2 keepalive transport when disabled (0)")
	}
	if tr.TLSNextProto["h2"] != nil {
		t.Fatal("expected h2 not registered when keepalive disabled")
	}
}
