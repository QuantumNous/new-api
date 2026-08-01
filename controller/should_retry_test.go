package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// newTestContext returns a gin.Context backed by a recorder, enough for
// shouldRetry which only reads specific_channel_id and affinity keys off it.
func newTestContext() *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

// infoNotStarted builds a RelayInfo whose HasSendResponse() reports false
// (no first-response timing recorded yet).

func withRetryStatusCodes(t *testing.T) {
	t.Helper()
	previous := operation_setting.AutomaticRetryStatusCodeRanges
	operation_setting.AutomaticRetryStatusCodeRanges = []operation_setting.StatusCodeRange{{Start: 500, End: 599}}
	t.Cleanup(func() { operation_setting.AutomaticRetryStatusCodeRanges = previous })
}

func infoNotStarted() *relaycommon.RelayInfo {
	now := time.Now()
	return &relaycommon.RelayInfo{
		StartTime:         now,
		FirstResponseTime: now.Add(-time.Second),
	}
}

// infoStarted builds a RelayInfo whose HasSendResponse() reports true
// (the relay has begun reporting first-response timing).
func infoStarted() *relaycommon.RelayInfo {
	now := time.Now()
	return &relaycommon.RelayInfo{
		StartTime:         now,
		FirstResponseTime: now.Add(time.Second),
	}
}

// A retryable upstream error (500) must NOT be retried once first-response
// timing has been recorded, because some adaptors are already at their render
// boundary and a retry could append a second response to the same writer.
func TestShouldRetry_NoRetryAfterResponseStarted(t *testing.T) {
	withRetryStatusCodes(t)
	c := newTestContext()
	err := types.NewErrorWithStatusCode(
		&stubErr{"upstream mid-stream failure"},
		types.ErrorCode("upstream_error"),
		http.StatusInternalServerError,
	)

	require.False(t, shouldRetry(c, infoStarted(), err, 3))
	// Same error, no first-response timing -> retry is allowed.
	require.True(t, shouldRetry(c, infoNotStarted(), err, 3))
}

// A nil RelayInfo must not panic and must fall through to the normal policy.
func TestShouldRetry_NilInfoFallsThrough(t *testing.T) {
	withRetryStatusCodes(t)
	c := newTestContext()
	err := types.NewErrorWithStatusCode(
		&stubErr{"boom"},
		types.ErrorCode("upstream_error"),
		http.StatusInternalServerError,
	)
	require.True(t, shouldRetry(c, nil, err, 3))
}

type stubErr struct{ s string }

func (e *stubErr) Error() string { return e.s }
