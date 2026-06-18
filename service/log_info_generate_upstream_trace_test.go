package service

import (
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// appendUpstreamTrace must publish the trace into other["upstream_trace"] and
// derive LocalPreprocessMs from StartTime -> StartAt (the pre-dispatch local cost).
func TestAppendUpstreamTrace_PresentComputesLocalPreprocess(t *testing.T) {
	start := time.Now()
	dispatch := start.Add(120 * time.Millisecond)
	info := &relaycommon.RelayInfo{
		StartTime:     start,
		UpstreamTrace: &relaycommon.UpstreamTraceInfo{Enabled: true, StartAt: dispatch},
	}
	other := map[string]interface{}{}

	appendUpstreamTrace(info, other)

	got, ok := other["upstream_trace"]
	if !ok {
		t.Fatal("upstream_trace not written to other")
	}
	tr, ok := got.(*relaycommon.UpstreamTraceInfo)
	if !ok {
		t.Fatalf("upstream_trace wrong type %T", got)
	}
	if tr.LocalPreprocessMs < 100 {
		t.Errorf("LocalPreprocessMs = %d, want ~120 (StartAt was 120ms after StartTime)", tr.LocalPreprocessMs)
	}
}

// When tracing is off (UpstreamTrace nil) the key must be omitted entirely.
func TestAppendUpstreamTrace_NilOmitted(t *testing.T) {
	info := &relaycommon.RelayInfo{StartTime: time.Now()}
	other := map[string]interface{}{}

	appendUpstreamTrace(info, other)

	if _, ok := other["upstream_trace"]; ok {
		t.Error("upstream_trace must be omitted when trace is nil")
	}
}
