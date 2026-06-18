package common

import (
	"testing"
	"time"
)

// SetFirstResponseTime must, in addition to its existing behavior, stamp the
// upstream-trace first-SSE timestamp when tracing is active.
func TestSetFirstResponseTime_StampsUpstreamTrace(t *testing.T) {
	start := time.Now().Add(-100 * time.Millisecond)
	info := &RelayInfo{
		isFirstResponse: true,
		UpstreamTrace:   &UpstreamTraceInfo{Enabled: true, StartAt: start},
	}

	info.SetFirstResponseTime()

	if info.UpstreamTrace.FirstSSEAt.IsZero() {
		t.Fatal("FirstSSEAt was not stamped")
	}
	if info.UpstreamTrace.FirstSSEMs < 50 {
		t.Fatalf("FirstSSEMs = %d, want >= ~100 (start was 100ms ago)", info.UpstreamTrace.FirstSSEMs)
	}
}

// SetFirstResponseTime must not panic and must still set FirstResponseTime when
// no trace is attached (tracing disabled — the overwhelmingly common path).
func TestSetFirstResponseTime_NilTraceSafe(t *testing.T) {
	info := &RelayInfo{isFirstResponse: true}

	info.SetFirstResponseTime()

	if info.FirstResponseTime.IsZero() {
		t.Fatal("FirstResponseTime should still be set without a trace")
	}
}

// SetFirstFlushTime records the first client-write moment, derives FlushDelayMs
// from FirstSSEAt, and self-guards so only the first chunk is recorded.
func TestSetFirstFlushTime_StampsAndSelfGuards(t *testing.T) {
	start := time.Now().Add(-200 * time.Millisecond)
	sse := time.Now().Add(-150 * time.Millisecond)
	info := &RelayInfo{
		UpstreamTrace: &UpstreamTraceInfo{Enabled: true, StartAt: start, FirstSSEAt: sse},
	}

	info.SetFirstFlushTime()

	first := info.UpstreamTrace.FirstFlushAt
	if first.IsZero() {
		t.Fatal("FirstFlushAt was not stamped")
	}
	if info.UpstreamTrace.FirstFlushMs < 100 {
		t.Fatalf("FirstFlushMs = %d, want >= ~200 (start was 200ms ago)", info.UpstreamTrace.FirstFlushMs)
	}
	if info.UpstreamTrace.FlushDelayMs < 50 {
		t.Fatalf("FlushDelayMs = %d, want >= ~150 (sse was 150ms ago)", info.UpstreamTrace.FlushDelayMs)
	}

	// Second call must be a no-op: the first flush moment is the one we want.
	info.SetFirstFlushTime()
	if !info.UpstreamTrace.FirstFlushAt.Equal(first) {
		t.Fatal("FirstFlushAt was overwritten on the second call (self-guard broken)")
	}
}

// SetFirstFlushTime must be a safe no-op when tracing is disabled.
func TestSetFirstFlushTime_NilTraceSafe(t *testing.T) {
	info := &RelayInfo{}

	info.SetFirstFlushTime() // must not panic
}
