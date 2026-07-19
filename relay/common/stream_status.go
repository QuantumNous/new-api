package common

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

type StreamEndReason string

const (
	StreamEndReasonNone                StreamEndReason = ""
	StreamEndReasonDone                StreamEndReason = "done"
	StreamEndReasonTimeout             StreamEndReason = "timeout"
	StreamEndReasonClientGone          StreamEndReason = "client_gone"
	StreamEndReasonScannerErr          StreamEndReason = "scanner_error"
	StreamEndReasonHandlerStop         StreamEndReason = "handler_stop"
	StreamEndReasonEOF                 StreamEndReason = "eof"
	StreamEndReasonPanic               StreamEndReason = "panic"
	StreamEndReasonPingFail            StreamEndReason = "ping_fail"
	StreamEndReasonInternalError       StreamEndReason = "internal_error"
	StreamEndReasonUpstreamFailed      StreamEndReason = "upstream_failed"
	StreamEndReasonTerminalClientError StreamEndReason = "terminal_client_error"
)

const maxStreamErrorEntries = 20

type StreamErrorEntry struct {
	Message   string
	Timestamp time.Time
}

type StreamSnapshot struct {
	EndReason          StreamEndReason
	EndError           error
	EndSource          string
	StartedAt          time.Time
	EndedAt            time.Time
	FirstDataAt        time.Time
	LastDataAt         time.Time
	UpstreamStatusCode int
	Errors             []StreamErrorEntry
	ErrorCount         int
}

type StreamStatus struct {
	EndReason          StreamEndReason
	EndError           error
	EndSource          string
	StartedAt          time.Time
	EndedAt            time.Time
	FirstDataAt        time.Time
	LastDataAt         time.Time
	UpstreamStatusCode int
	endOnce            sync.Once
	protocolTerminal   bool

	mu         sync.Mutex
	Errors     []StreamErrorEntry
	ErrorCount int
}

func NewStreamStatus() *StreamStatus {
	return &StreamStatus{StartedAt: time.Now()}
}

func (s *StreamStatus) SetEndReason(reason StreamEndReason, err error) {
	s.SetEndReasonWithSource(reason, err, "")
}

func (s *StreamStatus) SetEndReasonWithSource(reason StreamEndReason, err error, source string) {
	if s == nil {
		return
	}
	s.endOnce.Do(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.EndReason = reason
		s.EndError = err
		s.EndSource = source
		s.EndedAt = time.Now()
	})
}

// SetProtocolTerminalEndReasonWithSource records a terminal protocol event
// that was already written successfully to the downstream client. Such an
// event is more authoritative than a concurrent scanner EOF/[DONE], timeout,
// or request-context cancellation observed around the same final flush.
func (s *StreamStatus) SetProtocolTerminalEndReasonWithSource(reason StreamEndReason, err error, source string) {
	if s == nil {
		return
	}
	// Consume the one-shot setter so a later scanner/ping outcome cannot
	// overwrite the protocol terminal recorded below.
	s.endOnce.Do(func() {})
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.protocolTerminal {
		return
	}
	s.protocolTerminal = true
	s.EndReason = reason
	s.EndError = err
	s.EndSource = source
	s.EndedAt = time.Now()
}

// OverrideEndReasonIfNoProtocolTerminal records a post-scanner outcome such
// as a downstream disconnect or terminal-write failure. Scanner EOF/[DONE]
// may arrive first, but it must not hide a later failure before any protocol
// terminal was committed to the client.
func (s *StreamStatus) OverrideEndReasonIfNoProtocolTerminal(reason StreamEndReason, err error, source string) {
	if s == nil {
		return
	}
	s.endOnce.Do(func() {})
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.protocolTerminal {
		return
	}
	s.EndReason = reason
	s.EndError = err
	s.EndSource = source
	s.EndedAt = time.Now()
}

func (s *StreamStatus) RecordDataReceived() {
	if s == nil {
		return
	}
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.FirstDataAt.IsZero() {
		s.FirstDataAt = now
	}
	s.LastDataAt = now
}

func (s *StreamStatus) RecordError(msg string) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ErrorCount++
	if len(s.Errors) < maxStreamErrorEntries {
		s.Errors = append(s.Errors, StreamErrorEntry{
			Message:   msg,
			Timestamp: time.Now(),
		})
	}
}

func (s *StreamStatus) HasErrors() bool {
	if s == nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ErrorCount > 0
}

func (s *StreamStatus) TotalErrorCount() int {
	if s == nil {
		return 0
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ErrorCount
}

func (s *StreamStatus) Snapshot() StreamSnapshot {
	if s == nil {
		return StreamSnapshot{}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	errors := make([]StreamErrorEntry, len(s.Errors))
	copy(errors, s.Errors)
	return StreamSnapshot{
		EndReason:          s.EndReason,
		EndError:           s.EndError,
		EndSource:          s.EndSource,
		StartedAt:          s.StartedAt,
		EndedAt:            s.EndedAt,
		FirstDataAt:        s.FirstDataAt,
		LastDataAt:         s.LastDataAt,
		UpstreamStatusCode: s.UpstreamStatusCode,
		Errors:             errors,
		ErrorCount:         s.ErrorCount,
	}
}

func (s *StreamStatus) IsNormalEnd() bool {
	if s == nil {
		return true
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.EndReason == StreamEndReasonDone ||
		s.EndReason == StreamEndReasonEOF ||
		s.EndReason == StreamEndReasonHandlerStop
}

func (s *StreamStatus) Summary() string {
	if s == nil {
		return "StreamStatus<nil>"
	}
	b := &strings.Builder{}
	s.mu.Lock()
	fmt.Fprintf(b, "reason=%s", s.EndReason)
	if s.EndSource != "" {
		fmt.Fprintf(b, " source=%s", s.EndSource)
	}
	if s.EndError != nil {
		fmt.Fprintf(b, " end_error=%q", s.EndError.Error())
	}
	if !s.StartedAt.IsZero() {
		endAt := s.EndedAt
		if endAt.IsZero() {
			endAt = time.Now()
		}
		fmt.Fprintf(b, " elapsed_ms=%d", endAt.Sub(s.StartedAt).Milliseconds())
	}
	if s.UpstreamStatusCode != 0 {
		fmt.Fprintf(b, " upstream_status=%d", s.UpstreamStatusCode)
	}
	if !s.FirstDataAt.IsZero() && !s.StartedAt.IsZero() {
		fmt.Fprintf(b, " first_data_ms=%d", s.FirstDataAt.Sub(s.StartedAt).Milliseconds())
	}
	if !s.LastDataAt.IsZero() && !s.StartedAt.IsZero() {
		fmt.Fprintf(b, " last_data_ms=%d", s.LastDataAt.Sub(s.StartedAt).Milliseconds())
	}
	if s.ErrorCount > 0 {
		fmt.Fprintf(b, " soft_errors=%d", s.ErrorCount)
	}
	s.mu.Unlock()
	return b.String()
}
