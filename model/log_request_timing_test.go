package model

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newLogTimingContext(t *testing.T, requestID string, stream bool) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, requestID)
	start := time.Now().Add(-50 * time.Millisecond)
	session := common.NewRequestTimingSession(start)
	session.MarkUpstreamAttempt(start.Add(10*time.Millisecond), stream)
	if stream {
		session.MarkFirstUpstreamData(start.Add(25 * time.Millisecond))
		session.MarkClientWrite(start.Add(30*time.Millisecond), start.Add(31*time.Millisecond))
		session.MarkClientWrite(start.Add(40*time.Millisecond), start.Add(41*time.Millisecond))
	} else {
		session.MarkClientWrite(start.Add(25*time.Millisecond), start.Add(30*time.Millisecond))
	}
	common.SetRequestTimingSession(c, session)
	return c
}

func requireStoredRequestTiming(t *testing.T, requestID string) map[string]interface{} {
	t.Helper()
	var log Log
	require.NoError(t, LOG_DB.Where("request_id = ?", requestID).First(&log).Error)
	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	timing, ok := other["request_timing"].(map[string]interface{})
	require.True(t, ok)
	assert.Contains(t, timing, "total_ms")
	assert.Contains(t, timing, "gateway_ms")
	for _, key := range []string{"channel_id", "channel_name", "channel_type", "api_key", "ip", "request_content"} {
		assert.NotContains(t, timing, key)
	}
	return timing
}

func TestRecordConsumeLogIncludesRequestTiming(t *testing.T) {
	requestID := "timing-consume-log"
	c := newLogTimingContext(t, requestID, false)

	RecordConsumeLog(c, 1001, RecordConsumeLogParams{
		ModelName:      "test-model",
		UseTimeSeconds: 1,
		Other:          map[string]interface{}{"frt": 25},
	})

	timing := requireStoredRequestTiming(t, requestID)
	assert.Contains(t, timing, "upstream_response_ms")
	assert.Contains(t, timing, "response_write_ms")
}

func TestRecordErrorLogIncludesAvailableRequestTiming(t *testing.T) {
	requestID := "timing-error-log"
	c := newLogTimingContext(t, requestID, true)

	RecordErrorLog(c, 1002, 8, "test-model", "test-token", "upstream interrupted", 7, 1, true, "default", nil)

	timing := requireStoredRequestTiming(t, requestID)
	assert.Contains(t, timing, "upstream_first_data_ms")
	assert.Contains(t, timing, "client_stream_ms")
}
