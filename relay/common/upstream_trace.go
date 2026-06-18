package common

import (
	"crypto/tls"
	"net/http"
	"net/http/httptrace"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// UpstreamTraceInfo holds segmented upstream-request timing captured via
// net/http/httptrace. It is populated only when common.UpstreamTraceEnabled is
// on (see AttachUpstreamTrace). The internal time.Time fields are json:"-"; only
// the derived *Ms values and connection facts are logged into
// logs.other.upstream_trace.
//
// IMPORTANT (see docs/httptrace-upstream-segmented-timing.md §13):
//   - FirstSSEMs / FirstFlushMs / FlushDelayMs are meaningful for STREAMING
//     requests only (stamped from the stream scanner / data-handler goroutines).
//   - FlushDelayMs (FirstSSEAt -> FirstFlushAt) is the NewAPI-local read->write
//     gap; for OpenAI's one-chunk delayed-write the real socket write may be one
//     chunk later than FirstFlushAt.
//   - LocalPreprocessMs (StartTime -> StartAt) is the pre-dispatch local cost
//     (auth/route/convert/marshal); it is NOT a flush/forward delay.
type UpstreamTraceInfo struct {
	// mu guards the httptrace callback writes below, which may fire from
	// concurrent dial goroutines (dual-stack Happy Eyeballs / request retries).
	// Unexported, so encoding/json ignores it; the struct is only ever used via
	// pointer, so there is no copylock concern.
	mu sync.Mutex

	// StartAt is the moment right before client.Do (upstream dispatch). All *Ms
	// values below are measured relative to it unless noted otherwise.
	StartAt                time.Time `json:"-"`
	GotConnAt              time.Time `json:"-"`
	WroteRequestAt         time.Time `json:"-"`
	GotFirstResponseByteAt time.Time `json:"-"`
	FirstSSEAt             time.Time `json:"-"`
	FirstFlushAt           time.Time `json:"-"`

	Enabled    bool   `json:"enabled"`
	ReusedConn bool   `json:"reused_conn"`
	WasIdle    bool   `json:"was_idle"`
	IdleMs     int64  `json:"idle_ms,omitempty"`
	RemoteAddr string `json:"remote_addr,omitempty"`

	DNSMs      int64 `json:"dns_ms,omitempty"`
	ConnectMs  int64 `json:"connect_ms,omitempty"`
	TLSMs      int64 `json:"tls_ms,omitempty"`
	GotConnMs  int64 `json:"got_conn_ms,omitempty"`
	WriteReqMs int64 `json:"write_req_ms,omitempty"`
	HeaderMs   int64 `json:"header_ms,omitempty"`
	// FirstSSEMs: StartAt -> first valid SSE data line read from upstream.
	FirstSSEMs int64 `json:"first_sse_ms,omitempty"`
	// FirstFlushMs: StartAt -> first chunk handed to the client-write pipeline.
	FirstFlushMs int64 `json:"first_flush_ms,omitempty"`
	// FlushDelayMs: FirstSSEAt -> FirstFlushAt. The NewAPI-local gap between
	// reading upstream data and writing it to the client. This is the field that
	// actually answers "does NewAPI add local flush latency".
	FlushDelayMs int64 `json:"flush_delay_ms,omitempty"`
	// LocalPreprocessMs: StartTime -> StartAt. Pre-dispatch local cost
	// (auth/route/convert/marshal). Computed at log time from RelayInfo.StartTime.
	LocalPreprocessMs int64 `json:"local_preprocess_ms,omitempty"`

	BodySize   int64  `json:"body_size,omitempty"`
	TraceError string `json:"trace_error,omitempty"`
}

// AttachUpstreamTrace attaches an httptrace.ClientTrace to req when upstream
// tracing is enabled, recording segmented timing into info.UpstreamTrace. Tracing
// is on when the global UpstreamTraceEnabled switch is set OR the request's
// channel opted in via ChannelOtherSettings.UpstreamTraceEnabled (semantics B).
// When tracing is off it returns req unchanged, so callers may invoke it
// unconditionally. It never alters request content or headers — it only layers a
// trace onto the existing request context, so request behavior is unchanged.
func AttachUpstreamTrace(req *http.Request, info *RelayInfo) *http.Request {
	if req == nil || info == nil {
		return req
	}
	// Trace when the global switch is on, OR when this specific channel opted in
	// (semantics B: a channel can enable tracing even if the global flag is off).
	enabled := common.UpstreamTraceEnabled.Load()
	if !enabled && info.ChannelMeta != nil {
		enabled = info.ChannelOtherSettings.UpstreamTraceEnabled
	}
	if !enabled {
		return req
	}
	if !common.UpstreamTraceSampleHit() {
		return req
	}

	traceInfo := &UpstreamTraceInfo{Enabled: true, StartAt: time.Now()}
	if req.ContentLength > 0 {
		traceInfo.BodySize = req.ContentLength
	} else if info.UpstreamRequestBodySize > 0 {
		traceInfo.BodySize = info.UpstreamRequestBodySize
	}
	info.UpstreamTrace = traceInfo

	// dnsStart/connectStart/tlsStart and all traceInfo writes are guarded by
	// traceInfo.mu, because httptrace hooks may fire concurrently from multiple
	// dial goroutines (dual-stack Happy Eyeballs, request-body retries).
	var dnsStart, connectStart, tlsStart time.Time
	trace := &httptrace.ClientTrace{
		DNSStart: func(httptrace.DNSStartInfo) {
			traceInfo.mu.Lock()
			dnsStart = time.Now()
			traceInfo.mu.Unlock()
		},
		DNSDone: func(httptrace.DNSDoneInfo) {
			traceInfo.mu.Lock()
			if !dnsStart.IsZero() {
				traceInfo.DNSMs = time.Since(dnsStart).Milliseconds()
			}
			traceInfo.mu.Unlock()
		},
		ConnectStart: func(string, string) {
			traceInfo.mu.Lock()
			connectStart = time.Now()
			traceInfo.mu.Unlock()
		},
		ConnectDone: func(_, _ string, err error) {
			traceInfo.mu.Lock()
			if !connectStart.IsZero() {
				traceInfo.ConnectMs = time.Since(connectStart).Milliseconds()
			}
			if err != nil {
				traceInfo.TraceError = err.Error()
			}
			traceInfo.mu.Unlock()
		},
		TLSHandshakeStart: func() {
			traceInfo.mu.Lock()
			tlsStart = time.Now()
			traceInfo.mu.Unlock()
		},
		TLSHandshakeDone: func(_ tls.ConnectionState, err error) {
			traceInfo.mu.Lock()
			if !tlsStart.IsZero() {
				traceInfo.TLSMs = time.Since(tlsStart).Milliseconds()
			}
			if err != nil {
				traceInfo.TraceError = err.Error()
			}
			traceInfo.mu.Unlock()
		},
		GotConn: func(ci httptrace.GotConnInfo) {
			now := time.Now()
			traceInfo.mu.Lock()
			traceInfo.GotConnAt = now
			traceInfo.GotConnMs = now.Sub(traceInfo.StartAt).Milliseconds()
			traceInfo.ReusedConn = ci.Reused
			traceInfo.WasIdle = ci.WasIdle
			traceInfo.IdleMs = ci.IdleTime.Milliseconds()
			if ci.Conn != nil {
				traceInfo.RemoteAddr = ci.Conn.RemoteAddr().String()
			}
			traceInfo.mu.Unlock()
		},
		WroteRequest: func(wi httptrace.WroteRequestInfo) {
			now := time.Now()
			traceInfo.mu.Lock()
			traceInfo.WroteRequestAt = now
			traceInfo.WriteReqMs = now.Sub(traceInfo.StartAt).Milliseconds()
			if wi.Err != nil {
				traceInfo.TraceError = wi.Err.Error()
			}
			traceInfo.mu.Unlock()
		},
		GotFirstResponseByte: func() {
			now := time.Now()
			traceInfo.mu.Lock()
			traceInfo.GotFirstResponseByteAt = now
			traceInfo.HeaderMs = now.Sub(traceInfo.StartAt).Milliseconds()
			traceInfo.mu.Unlock()
		},
	}
	return req.WithContext(httptrace.WithClientTrace(req.Context(), trace))
}
