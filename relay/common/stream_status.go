package common

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

type StreamEndReason string

const (
	StreamEndReasonNone        StreamEndReason = ""
	StreamEndReasonDone        StreamEndReason = "done"
	StreamEndReasonTimeout     StreamEndReason = "timeout"
	StreamEndReasonClientGone  StreamEndReason = "client_gone"
	StreamEndReasonScannerErr  StreamEndReason = "scanner_error"
	StreamEndReasonHandlerStop StreamEndReason = "handler_stop"
	StreamEndReasonEOF         StreamEndReason = "eof"
	StreamEndReasonPanic       StreamEndReason = "panic"
	StreamEndReasonPingFail    StreamEndReason = "ping_fail"
)

const maxStreamErrorEntries = 20

type StreamErrorEntry struct {
	Message   string    `json:"message"`
	Code      string    `json:"code,omitempty"`
	Source    string    `json:"source,omitempty"`
	Timestamp time.Time `json:"-"`
}

type StreamStatus struct {
	EndReason      StreamEndReason
	EndError       error
	EndErrorCode   string
	EndErrorSource string
	endOnce        sync.Once

	mu         sync.Mutex
	Errors     []StreamErrorEntry
	ErrorCount int
}

func NewStreamStatus() *StreamStatus {
	return &StreamStatus{}
}

func (s *StreamStatus) SetEndReason(reason StreamEndReason, err error) {
	if s == nil {
		return
	}
	s.endOnce.Do(func() {
		s.EndReason = reason
		s.EndError = err
		if err != nil {
			details := describeStreamError(err)
			s.EndErrorCode = details.Code
			s.EndErrorSource = details.Source
		}
	})
}

func (s *StreamStatus) RecordError(msg string) {
	s.RecordErrorCause(errors.New(msg))
}

func (s *StreamStatus) RecordErrorCause(err error) {
	if s == nil || err == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ErrorCount++
	if len(s.Errors) < maxStreamErrorEntries {
		s.Errors = append(s.Errors, describeStreamError(err))
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

func (s *StreamStatus) IsNormalEnd() bool {
	if s == nil {
		return true
	}
	return s.EndReason == StreamEndReasonDone ||
		s.EndReason == StreamEndReasonEOF ||
		s.EndReason == StreamEndReasonHandlerStop
}

func (s *StreamStatus) Summary() string {
	if s == nil {
		return "StreamStatus<nil>"
	}
	b := &strings.Builder{}
	fmt.Fprintf(b, "reason=%s", s.EndReason)
	if s.EndError != nil {
		fmt.Fprintf(b, " end_error=%q error_code=%s", s.EndError.Error(), s.EndErrorCode)
		if s.EndErrorSource != "" {
			fmt.Fprintf(b, " error_source=%s", s.EndErrorSource)
		}
	}
	s.mu.Lock()
	if s.ErrorCount > 0 {
		fmt.Fprintf(b, " soft_errors=%d", s.ErrorCount)
	}
	s.mu.Unlock()
	return b.String()
}

// WithStreamErrorSource tags the observation point without changing the original
// error text or breaking errors.Is/As. Preserve an earlier, more specific source.
func WithStreamErrorSource(err error, source string) error {
	if err == nil {
		return nil
	}
	var tagged *streamSourceError
	if errors.As(err, &tagged) {
		return err
	}
	return &streamSourceError{err: err, source: source}
}

type streamSourceError struct {
	err    error
	source string
}

func (e *streamSourceError) Error() string { return e.err.Error() }
func (e *streamSourceError) Unwrap() error { return e.err }

func describeStreamError(err error) StreamErrorEntry {
	entry := StreamErrorEntry{Message: err.Error(), Code: "unknown_error", Timestamp: time.Now()}
	var tagged *streamSourceError
	if errors.As(err, &tagged) {
		entry.Source = tagged.source
	}
	var closeErr *websocket.CloseError
	var netErr net.Error
	switch {
	case errors.Is(err, context.Canceled):
		entry.Code = "context_canceled"
	case errors.Is(err, context.DeadlineExceeded):
		entry.Code = "deadline_exceeded"
	case errors.Is(err, os.ErrDeadlineExceeded):
		entry.Code = "io_timeout"
	case errors.Is(err, syscall.EPIPE):
		entry.Code = "broken_pipe"
	case errors.Is(err, syscall.ECONNRESET):
		entry.Code = "connection_reset"
	case errors.Is(err, syscall.ECONNABORTED):
		entry.Code = "connection_aborted"
	case errors.Is(err, net.ErrClosed):
		entry.Code = "connection_closed"
	case errors.Is(err, io.ErrClosedPipe):
		entry.Code = "closed_pipe"
	case errors.Is(err, io.ErrUnexpectedEOF):
		entry.Code = "unexpected_eof"
	case errors.Is(err, io.EOF):
		entry.Code = "eof"
	case errors.As(err, &closeErr):
		entry.Code = fmt.Sprintf("websocket_close_%d", closeErr.Code)
	case errors.As(err, &netErr) && netErr.Timeout():
		entry.Code = "network_timeout"
	}
	return entry
}
