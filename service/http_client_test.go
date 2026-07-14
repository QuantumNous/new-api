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
