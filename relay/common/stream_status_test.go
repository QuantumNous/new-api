package common

import (
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStreamStatus_SetEndReason_FirstWins(t *testing.T) {
	t.Parallel()
	s := NewStreamStatus()

	s.SetEndReason(StreamEndReasonDone, nil)
	s.SetEndReason(StreamEndReasonTimeout, nil)
	s.SetEndReason(StreamEndReasonClientGone, fmt.Errorf("context canceled"))

	assert.Equal(t, StreamEndReasonDone, s.EndReason)
	assert.Nil(t, s.EndError)
}

func TestStreamStatus_SetEndReason_WithError(t *testing.T) {
	t.Parallel()
	s := NewStreamStatus()

	expectedErr := fmt.Errorf("read: connection reset")
	s.SetEndReason(StreamEndReasonScannerErr, expectedErr)

	assert.Equal(t, StreamEndReasonScannerErr, s.EndReason)
	assert.Equal(t, expectedErr, s.EndError)
}

func TestStreamStatus_SetEndReason_NilSafe(t *testing.T) {
	t.Parallel()
	var s *StreamStatus
	s.SetEndReason(StreamEndReasonDone, nil)
}

func TestStreamStatus_SetEndReason_Concurrent(t *testing.T) {
	t.Parallel()
	s := NewStreamStatus()

	reasons := []StreamEndReason{
		StreamEndReasonDone,
		StreamEndReasonTimeout,
		StreamEndReasonClientGone,
		StreamEndReasonScannerErr,
		StreamEndReasonHandlerStop,
		StreamEndReasonEOF,
		StreamEndReasonPanic,
		StreamEndReasonPingFail,
	}

	var wg sync.WaitGroup
	for _, r := range reasons {
		wg.Add(1)
		go func(reason StreamEndReason) {
			defer wg.Done()
			s.SetEndReason(reason, nil)
		}(r)
	}
	wg.Wait()

	assert.NotEqual(t, StreamEndReasonNone, s.EndReason)
}

func TestStreamStatus_RecordError_Basic(t *testing.T) {
	t.Parallel()
	s := NewStreamStatus()

	s.RecordError("bad json")
	s.RecordError("another bad json")
	s.RecordError("client gone")

	assert.True(t, s.HasErrors())
	assert.Equal(t, 3, s.TotalErrorCount())
	assert.Len(t, s.Errors, 3)
}

func TestStreamStatus_RecordError_CapAtMax(t *testing.T) {
	t.Parallel()
	s := NewStreamStatus()

	for i := 0; i < 30; i++ {
		s.RecordError(fmt.Sprintf("error_%d", i))
	}

	assert.Equal(t, maxStreamErrorEntries, len(s.Errors))
	assert.Equal(t, 30, s.TotalErrorCount())
}

func TestStreamStatus_RecordError_NilSafe(t *testing.T) {
	t.Parallel()
	var s *StreamStatus
	s.RecordError("should not panic")
}

func TestStreamStatus_RecordError_Concurrent(t *testing.T) {
	t.Parallel()
	s := NewStreamStatus()

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			s.RecordError(fmt.Sprintf("error_%d", idx))
		}(i)
	}
	wg.Wait()

	assert.Equal(t, 100, s.TotalErrorCount())
	assert.LessOrEqual(t, len(s.Errors), maxStreamErrorEntries)
}

func TestStreamStatus_HasErrors_Empty(t *testing.T) {
	t.Parallel()
	s := NewStreamStatus()
	assert.False(t, s.HasErrors())
	assert.Equal(t, 0, s.TotalErrorCount())
}

func TestStreamStatus_HasErrors_NilSafe(t *testing.T) {
	t.Parallel()
	var s *StreamStatus
	assert.False(t, s.HasErrors())
	assert.Equal(t, 0, s.TotalErrorCount())
}

func TestStreamStatus_IsNormalEnd(t *testing.T) {
	t.Parallel()
	tests := []struct {
		reason StreamEndReason
		normal bool
	}{
		{StreamEndReasonDone, true},
		{StreamEndReasonEOF, true},
		{StreamEndReasonHandlerStop, true},
		{StreamEndReasonTimeout, false},
		{StreamEndReasonClientGone, false},
		{StreamEndReasonScannerErr, false},
		{StreamEndReasonPanic, false},
		{StreamEndReasonPingFail, false},
		{StreamEndReasonInternalError, false},
		{StreamEndReasonNone, false},
	}
	for _, tt := range tests {
		s := NewStreamStatus()
		s.SetEndReason(tt.reason, nil)
		assert.Equal(t, tt.normal, s.IsNormalEnd(), "reason=%s", tt.reason)
	}
}

func TestStreamStatus_IsNormalEnd_NilSafe(t *testing.T) {
	t.Parallel()
	var s *StreamStatus
	assert.True(t, s.IsNormalEnd())
}

func TestStreamStatus_SetEndReasonWithSource(t *testing.T) {
	t.Parallel()
	s := NewStreamStatus()

	s.SetEndReasonWithSource(StreamEndReasonClientGone, fmt.Errorf("context canceled"), "main_context_done")

	assert.Equal(t, StreamEndReasonClientGone, s.EndReason)
	assert.Equal(t, "main_context_done", s.EndSource)
	assert.False(t, s.EndedAt.IsZero())
}

func TestStreamStatus_ProtocolTerminalOverridesConcurrentTransportEnd(t *testing.T) {
	s := NewStreamStatus()
	s.SetEndReasonWithSource(StreamEndReasonClientGone, fmt.Errorf("context canceled"), "main_context_done")
	s.SetProtocolTerminalEndReasonWithSource(StreamEndReasonDone, nil, "handler_done")

	snapshot := s.Snapshot()
	assert.Equal(t, StreamEndReasonDone, snapshot.EndReason)
	assert.Equal(t, "handler_done", snapshot.EndSource)
}

func TestStreamStatus_ProtocolFailureOverridesScannerDone(t *testing.T) {
	s := NewStreamStatus()
	s.SetEndReasonWithSource(StreamEndReasonDone, nil, "scanner_done")
	s.SetProtocolTerminalEndReasonWithSource(StreamEndReasonUpstreamFailed, fmt.Errorf("empty upstream stream"), "synthetic_terminal")

	snapshot := s.Snapshot()
	assert.Equal(t, StreamEndReasonUpstreamFailed, snapshot.EndReason)
	assert.Equal(t, "synthetic_terminal", snapshot.EndSource)
}

func TestStreamStatus_ProtocolTerminalCannotBeOverwritten(t *testing.T) {
	s := NewStreamStatus()
	s.SetProtocolTerminalEndReasonWithSource(StreamEndReasonUpstreamFailed, fmt.Errorf("server error"), "upstream_terminal")
	s.SetEndReasonWithSource(StreamEndReasonEOF, nil, "scanner_eof")
	s.SetProtocolTerminalEndReasonWithSource(StreamEndReasonDone, nil, "handler_done")

	snapshot := s.Snapshot()
	assert.Equal(t, StreamEndReasonUpstreamFailed, snapshot.EndReason)
	assert.Equal(t, "upstream_terminal", snapshot.EndSource)
}

func TestStreamStatus_RecordDataReceived(t *testing.T) {
	t.Parallel()
	s := NewStreamStatus()

	s.RecordDataReceived()
	firstDataAt := s.FirstDataAt
	s.RecordDataReceived()

	assert.False(t, firstDataAt.IsZero())
	assert.Equal(t, firstDataAt, s.FirstDataAt)
	assert.False(t, s.LastDataAt.IsZero())
}

func TestStreamStatus_Summary(t *testing.T) {
	t.Parallel()

	s := NewStreamStatus()
	s.SetEndReason(StreamEndReasonDone, nil)
	summary := s.Summary()
	assert.Contains(t, summary, "reason=done")
	assert.NotContains(t, summary, "soft_errors")

	s2 := NewStreamStatus()
	s2.SetEndReasonWithSource(StreamEndReasonTimeout, nil, "timeout")
	s2.RecordDataReceived()
	s2.RecordError("bad json")
	s2.RecordError("write failed")
	summary2 := s2.Summary()
	assert.Contains(t, summary2, "reason=timeout")
	assert.Contains(t, summary2, "source=timeout")
	assert.Contains(t, summary2, "elapsed_ms=")
	assert.Contains(t, summary2, "first_data_ms=")
	assert.Contains(t, summary2, "soft_errors=2")
}

func TestStreamStatus_Summary_NilSafe(t *testing.T) {
	t.Parallel()
	var s *StreamStatus
	assert.Equal(t, "StreamStatus<nil>", s.Summary())
}
