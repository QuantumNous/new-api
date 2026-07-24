package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// newTestContext returns a gin.Context backed by a recorder, enough for
// shouldRetry which only reads specific_channel_id and affinity keys off it.
func newTestContext() *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

// infoNotStarted builds a RelayInfo whose HasSendResponse() reports false
// (no bytes written to the client yet).
func infoNotStarted() *relaycommon.RelayInfo {
	now := time.Now()
	return &relaycommon.RelayInfo{
		StartTime:         now,
		FirstResponseTime: now.Add(-time.Second),
	}
}

// infoStarted builds a RelayInfo whose HasSendResponse() reports true
// (the response stream has already begun flushing to the client).
func infoStarted() *relaycommon.RelayInfo {
	now := time.Now()
	return &relaycommon.RelayInfo{
		StartTime:         now,
		FirstResponseTime: now.Add(time.Second),
	}
}

// A retryable upstream error (500) must NOT be retried once part of the
// response has already been streamed to the client, otherwise the retry would
// append a second response onto the partial output and corrupt it.
func TestShouldRetry_NoRetryAfterResponseStarted(t *testing.T) {
	c := newTestContext()
	err := types.NewErrorWithStatusCode(
		&stubErr{"upstream mid-stream failure"},
		types.ErrorCode("upstream_error"),
		http.StatusInternalServerError,
	)

	if shouldRetry(c, infoStarted(), err, 3) {
		t.Fatal("must not retry after bytes were sent to the client")
	}
	// Same error, nothing sent yet -> retry is allowed.
	if !shouldRetry(c, infoNotStarted(), err, 3) {
		t.Fatal("expected retry for a 500 when no response has been sent")
	}
}

// A nil RelayInfo must not panic and must fall through to the normal policy.
func TestShouldRetry_NilInfoFallsThrough(t *testing.T) {
	c := newTestContext()
	err := types.NewErrorWithStatusCode(
		&stubErr{"boom"},
		types.ErrorCode("upstream_error"),
		http.StatusInternalServerError,
	)
	if !shouldRetry(c, nil, err, 3) {
		t.Fatal("expected retry for a 500 with nil info (no send-state to block on)")
	}
}

type stubErr struct{ s string }

func (e *stubErr) Error() string { return e.s }
