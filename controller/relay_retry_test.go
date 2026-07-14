package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestRelayRetryDelayUsesBoundedExponentialJitter verifies every backoff stage
// remains within its equal-jitter floor and exponential cap.
func TestRelayRetryDelayUsesBoundedExponentialJitter(t *testing.T) {
	for attempt, bounds := range []struct {
		min time.Duration
		max time.Duration
	}{
		{50 * time.Millisecond, 100 * time.Millisecond},
		{100 * time.Millisecond, 200 * time.Millisecond},
		{200 * time.Millisecond, 400 * time.Millisecond},
		{400 * time.Millisecond, 800 * time.Millisecond},
		{800 * time.Millisecond, 1600 * time.Millisecond},
		{time.Second, 2 * time.Second},
	} {
		delay := relayRetryDelay(attempt, 0)
		require.GreaterOrEqual(t, delay, bounds.min)
		require.LessOrEqual(t, delay, bounds.max)
	}
}

// TestRelayRetryDelayHonorsAndCapsRetryAfter verifies upstream guidance wins
// over jitter without allowing an excessive relay stall.
func TestRelayRetryDelayHonorsAndCapsRetryAfter(t *testing.T) {
	require.Equal(t, 5*time.Second, relayRetryDelay(0, 5*time.Second))
	require.Equal(t, relayRetryAfterMax, relayRetryDelay(0, time.Minute))
}

// TestShouldRetryUpstreamFirstByteTimeout protects failover for the dedicated
// first-byte timeout error even though its mapped status is 504.
func TestShouldRetryUpstreamFirstByteTimeout(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	apiErr := types.NewErrorWithStatusCode(
		errors.New("first byte timeout"),
		types.ErrorCodeUpstreamFirstByteTimeout,
		http.StatusGatewayTimeout,
	)

	require.True(t, shouldRetry(c, apiErr, 1))
}

// TestShouldRetryStopsAfterResponseWasWritten prevents duplicate model output
// from a second channel after a partial response reached the client.
func TestShouldRetryStopsAfterResponseWasWritten(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Status(http.StatusOK)
	_, err := c.Writer.Write([]byte("partial stream"))
	require.NoError(t, err)

	apiErr := types.NewErrorWithStatusCode(
		errors.New("upstream failed after partial output"),
		types.ErrorCodeDoRequestFailed,
		http.StatusServiceUnavailable,
	)
	require.False(t, shouldRetry(c, apiErr, 1))
}

// TestShouldRetryAllowsSyntheticPingOnly confirms keepalive comments do not
// make failover unsafe before the first upstream payload.
func TestShouldRetryAllowsSyntheticPingOnly(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	require.NoError(t, helper.PingData(c))

	apiErr := types.NewErrorWithStatusCode(
		errors.New("upstream busy before first response"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusServiceUnavailable,
	)
	require.True(t, shouldRetry(c, apiErr, 1))
}

// TestRespondRelayErrorRestoresJSONContentTypeBeforeWrite verifies an unstarted
// stream can still return the original HTTP status and JSON error contract.
func TestRespondRelayErrorRestoresJSONContentTypeBeforeWrite(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	helper.SetEventStreamHeaders(c)
	apiErr := types.NewErrorWithStatusCode(errors.New("upstream busy"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)

	respondRelayError(c, types.RelayFormatOpenAI, apiErr)

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "application/json")
}

// TestRespondRelayErrorUsesSSEAfterSyntheticPing verifies Chat Completions
// errors retain SSE framing after response headers were committed by a ping.
func TestRespondRelayErrorUsesSSEAfterSyntheticPing(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	helper.SetEventStreamHeaders(c)
	require.NoError(t, helper.PingData(c))
	apiErr := types.NewErrorWithStatusCode(errors.New("upstream busy"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)

	respondRelayError(c, types.RelayFormatOpenAI, apiErr)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "text/event-stream")
	require.Contains(t, recorder.Body.String(), ": PING")
	require.Contains(t, recorder.Body.String(), `data: {"error"`)
	require.Contains(t, recorder.Body.String(), "data: [DONE]")
}

// TestRespondRelayErrorUsesResponsesEventAfterSyntheticPing protects the flat
// type=error event contract for Responses and Responses Compaction.
func TestRespondRelayErrorUsesResponsesEventAfterSyntheticPing(t *testing.T) {
	for _, relayFormat := range []types.RelayFormat{
		types.RelayFormatOpenAIResponses,
		types.RelayFormatOpenAIResponsesCompaction,
	} {
		t.Run(string(relayFormat), func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
			helper.SetEventStreamHeaders(c)
			require.NoError(t, helper.PingData(c))
			apiErr := types.NewErrorWithStatusCode(errors.New("upstream busy"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)

			respondRelayError(c, relayFormat, apiErr)

			body := recorder.Body.String()
			require.Equal(t, http.StatusOK, recorder.Code)
			require.Contains(t, body, ": PING")
			require.Contains(t, body, "event: error")
			require.Contains(t, body, `"type":"error"`)
			require.Contains(t, body, `"message":"upstream busy"`)
			require.NotContains(t, body, `"error":{`)
			require.NotContains(t, body, "[DONE]")
		})
	}
}

// TestRespondRelayErrorUsesGeminiErrorAfterSyntheticPing ensures native Gemini
// streams never receive an OpenAI-shaped error after a keepalive.
func TestRespondRelayErrorUsesGeminiErrorAfterSyntheticPing(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-test:streamGenerateContent", nil)
	helper.SetEventStreamHeaders(c)
	require.NoError(t, helper.PingData(c))
	apiErr := types.NewErrorWithStatusCode(errors.New("upstream busy"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)

	respondRelayError(c, types.RelayFormatGemini, apiErr)

	body := recorder.Body.String()
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, body, ": PING")
	require.Contains(t, body, `data: {"error":{"code":503,"message":"upstream busy","status":"UNAVAILABLE"}}`)
	require.NotContains(t, body, `"type":"new_api_error"`)
	require.NotContains(t, body, "[DONE]")
}

// TestRespondRelayErrorUsesGeminiJSONBeforeResponseWrite verifies native Gemini
// errors preserve both the HTTP status and Google RPC JSON envelope.
func TestRespondRelayErrorUsesGeminiJSONBeforeResponseWrite(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-test:generateContent", nil)
	apiErr := types.NewErrorWithStatusCode(errors.New("upstream busy"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)

	respondRelayError(c, types.RelayFormatGemini, apiErr)

	require.Equal(t, http.StatusBadGateway, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "application/json")
	require.JSONEq(t, `{"error":{"code":502,"message":"upstream busy","status":"UNAVAILABLE"}}`, recorder.Body.String())
}
