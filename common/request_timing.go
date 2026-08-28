package common

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const requestTimingContextKey = "request_timing_session"

type RequestTiming struct {
	TotalMs             int64  `json:"total_ms"`
	GatewayMs           *int64 `json:"gateway_ms,omitempty"`
	UpstreamFirstDataMs *int64 `json:"upstream_first_data_ms,omitempty"`
	FirstDataToClientMs *int64 `json:"first_data_to_client_ms,omitempty"`
	ClientStreamMs      *int64 `json:"client_stream_ms,omitempty"`
	UpstreamResponseMs  *int64 `json:"upstream_response_ms,omitempty"`
	ResponseWriteMs     *int64 `json:"response_write_ms,omitempty"`
	UpstreamErrorMs     *int64 `json:"upstream_error_ms,omitempty"`
	FinalizeMs          *int64 `json:"finalize_ms,omitempty"`
}

type RequestTimingSession struct {
	mu                   sync.Mutex
	start                time.Time
	firstUpstreamAttempt time.Time
	firstUpstreamData    time.Time
	upstreamComplete     time.Time
	firstClientWrite     time.Time
	lastClientWrite      time.Time
	stream               bool
}

func NewRequestTimingSession(start time.Time) *RequestTimingSession {
	return &RequestTimingSession{start: start}
}

func SetRequestTimingSession(c *gin.Context, session *RequestTimingSession) {
	if c == nil || session == nil {
		return
	}
	c.Set(requestTimingContextKey, session)
}

func GetRequestTimingSession(c *gin.Context) *RequestTimingSession {
	if c == nil {
		return nil
	}
	value, exists := c.Get(requestTimingContextKey)
	if !exists {
		return nil
	}
	session, _ := value.(*RequestTimingSession)
	return session
}

func (s *RequestTimingSession) MarkUpstreamAttempt(at time.Time, stream bool) bool {
	if s == nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	resetFirstData := false
	if s.firstUpstreamAttempt.IsZero() {
		s.firstUpstreamAttempt = at
	} else if s.firstClientWrite.IsZero() {
		s.firstUpstreamData = time.Time{}
		resetFirstData = true
	}
	s.upstreamComplete = time.Time{}
	s.stream = stream
	return resetFirstData
}

func (s *RequestTimingSession) SetStream(stream bool) {
	if s == nil {
		return
	}
	s.mu.Lock()
	s.stream = stream
	s.mu.Unlock()
}

func (s *RequestTimingSession) MarkFirstUpstreamData(at time.Time) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stream = true
	if s.firstUpstreamData.IsZero() {
		s.firstUpstreamData = at
	}
}

func (s *RequestTimingSession) MarkClientWrite(startedAt time.Time, completedAt time.Time) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.stream && s.firstUpstreamData.IsZero() {
		return
	}
	if !s.stream && s.upstreamComplete.IsZero() {
		s.upstreamComplete = startedAt
	}
	if s.firstClientWrite.IsZero() {
		s.firstClientWrite = startedAt
	}
	s.lastClientWrite = completedAt
}

func (s *RequestTimingSession) Snapshot(at time.Time, failed bool) *RequestTiming {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	start := s.start
	firstUpstreamAttempt := s.firstUpstreamAttempt
	firstUpstreamData := s.firstUpstreamData
	upstreamComplete := s.upstreamComplete
	firstClientWrite := s.firstClientWrite
	lastClientWrite := s.lastClientWrite
	stream := s.stream
	s.mu.Unlock()
	if start.IsZero() || at.Before(start) {
		return nil
	}

	timing := &RequestTiming{TotalMs: at.Sub(start).Milliseconds()}
	if firstUpstreamAttempt.IsZero() {
		if failed {
			timing.GatewayMs = millisecondsBetween(start, at)
		}
		return timing
	}

	timing.GatewayMs = millisecondsBetween(start, firstUpstreamAttempt)
	if failed && upstreamComplete.IsZero() && firstUpstreamData.IsZero() {
		timing.UpstreamErrorMs = millisecondsBetween(firstUpstreamAttempt, at)
		return timing
	}

	if stream {
		timing.UpstreamFirstDataMs = millisecondsBetween(firstUpstreamAttempt, firstUpstreamData)
		timing.FirstDataToClientMs = millisecondsBetween(firstUpstreamData, firstClientWrite)
		timing.ClientStreamMs = millisecondsBetween(firstClientWrite, lastClientWrite)
		timing.FinalizeMs = millisecondsBetween(lastClientWrite, at)
		return timing
	}

	timing.UpstreamResponseMs = millisecondsBetween(firstUpstreamAttempt, upstreamComplete)
	timing.ResponseWriteMs = millisecondsBetween(upstreamComplete, lastClientWrite)
	if lastClientWrite.IsZero() {
		timing.FinalizeMs = millisecondsBetween(upstreamComplete, at)
	} else {
		timing.FinalizeMs = millisecondsBetween(lastClientWrite, at)
	}
	return timing
}

func millisecondsBetween(start time.Time, end time.Time) *int64 {
	if start.IsZero() || end.IsZero() || end.Before(start) {
		return nil
	}
	value := end.Sub(start).Milliseconds()
	return &value
}
