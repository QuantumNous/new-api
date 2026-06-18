package common

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// AttachUpstreamTrace, when enabled, must record connection facts, request-write
// and first-response-byte timings, and the request body size against a real
// upstream round-trip.
func TestAttachUpstreamTrace_PopulatesTimings(t *testing.T) {
	common.UpstreamTraceEnabled.Store(true)
	defer common.UpstreamTraceEnabled.Store(false)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	info := &RelayInfo{}
	req, err := http.NewRequest(http.MethodPost, srv.URL, strings.NewReader("hello"))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}

	req = AttachUpstreamTrace(req, info)
	if info.UpstreamTrace == nil {
		t.Fatal("UpstreamTrace not attached")
	}

	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("do: %v", err)
	}
	_, _ = io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	tr := info.UpstreamTrace
	if !tr.Enabled {
		t.Error("Enabled should be true")
	}
	if tr.GotConnAt.IsZero() {
		t.Error("GotConn callback did not fire")
	}
	if tr.RemoteAddr == "" {
		t.Error("RemoteAddr should be populated")
	}
	if tr.WroteRequestAt.IsZero() {
		t.Error("WroteRequest callback did not fire")
	}
	if tr.GotFirstResponseByteAt.IsZero() {
		t.Error("GotFirstResponseByte callback did not fire")
	}
	if tr.BodySize != int64(len("hello")) {
		t.Errorf("BodySize = %d, want %d", tr.BodySize, len("hello"))
	}
}

// On a second request over the same client, the connection from the pool must be
// reported as reused — the field that answers "did we reuse a warm connection".
func TestAttachUpstreamTrace_ReusesConnection(t *testing.T) {
	common.UpstreamTraceEnabled.Store(true)
	defer common.UpstreamTraceEnabled.Store(false)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()
	client := srv.Client()

	doOnce := func() *UpstreamTraceInfo {
		info := &RelayInfo{}
		req, _ := http.NewRequest(http.MethodGet, srv.URL, nil)
		req = AttachUpstreamTrace(req, info)
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("do: %v", err)
		}
		_, _ = io.ReadAll(resp.Body) // must drain to return conn to pool
		_ = resp.Body.Close()
		return info.UpstreamTrace
	}

	doOnce() // warms the pool
	second := doOnce()
	if !second.ReusedConn {
		t.Error("second request should report ReusedConn=true")
	}
}

// When tracing is disabled, AttachUpstreamTrace must be an inert no-op: it
// returns the request untouched and attaches no trace.
func TestAttachUpstreamTrace_DisabledNoOp(t *testing.T) {
	common.UpstreamTraceEnabled.Store(false)

	info := &RelayInfo{}
	req, _ := http.NewRequest(http.MethodGet, "http://example.invalid", nil)

	out := AttachUpstreamTrace(req, info)

	if out != req {
		t.Error("disabled trace must return the same *http.Request")
	}
	if info.UpstreamTrace != nil {
		t.Error("disabled trace must not attach UpstreamTrace")
	}
}

// With the global switch off, a channel that opted in must still be traced
// (semantics B: per-channel enables tracing independently of the global flag).
func TestAttachUpstreamTrace_PerChannelEnablesWhenGlobalOff(t *testing.T) {
	common.UpstreamTraceEnabled.Store(false)
	defer common.UpstreamTraceEnabled.Store(false)

	info := &RelayInfo{
		ChannelMeta: &ChannelMeta{
			ChannelOtherSettings: dto.ChannelOtherSettings{UpstreamTraceEnabled: true},
		},
	}
	req, _ := http.NewRequest(http.MethodGet, "http://example.invalid", nil)

	out := AttachUpstreamTrace(req, info)

	if info.UpstreamTrace == nil {
		t.Fatal("per-channel opt-in must attach a trace even when the global switch is off")
	}
	if out == req {
		t.Error("expected the request to be wrapped with a trace context")
	}
}

// Global off and channel off must remain an inert no-op.
func TestAttachUpstreamTrace_GlobalAndChannelOffNoOp(t *testing.T) {
	common.UpstreamTraceEnabled.Store(false)

	info := &RelayInfo{ChannelMeta: &ChannelMeta{}}
	req, _ := http.NewRequest(http.MethodGet, "http://example.invalid", nil)

	out := AttachUpstreamTrace(req, info)

	if out != req || info.UpstreamTrace != nil {
		t.Error("global off + channel off must be a no-op")
	}
}
