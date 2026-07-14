package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type errorReadCloser struct {
	closed bool
}

// Read forces the response-body failure path without returning partial bytes.
func (r *errorReadCloser) Read([]byte) (int, error) {
	return 0, errors.New("read failed")
}

// Close records cleanup so read-failure tests can assert body ownership.
func (r *errorReadCloser) Close() error {
	r.closed = true
	return nil
}

// TestResetStatusCode verifies mappings accept integral encodings, reject
// malformed values, and retain the provider's original status for policy checks.
func TestResetStatusCode(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name             string
		statusCode       int
		statusCodeConfig string
		expectedCode     int
	}{
		{
			name:             "map string value",
			statusCode:       429,
			statusCodeConfig: `{"429":"503"}`,
			expectedCode:     503,
		},
		{
			name:             "map int value",
			statusCode:       429,
			statusCodeConfig: `{"429":503}`,
			expectedCode:     503,
		},
		{
			name:             "skip invalid string value",
			statusCode:       429,
			statusCodeConfig: `{"429":"bad-code"}`,
			expectedCode:     429,
		},
		{
			name:             "skip status code 200",
			statusCode:       200,
			statusCodeConfig: `{"200":503}`,
			expectedCode:     200,
		},
		{
			name:             "do not map an error to success",
			statusCode:       503,
			statusCodeConfig: `{"503":200}`,
			expectedCode:     503,
		},
		{
			name:             "skip out of range target",
			statusCode:       503,
			statusCodeConfig: `{"503":999}`,
			expectedCode:     503,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			newAPIError := &types.NewAPIError{
				StatusCode: tc.statusCode,
			}
			ResetStatusCode(newAPIError, tc.statusCodeConfig)
			require.Equal(t, tc.expectedCode, newAPIError.StatusCode)
			if tc.expectedCode != tc.statusCode {
				require.Equal(t, tc.statusCode, newAPIError.GetUpstreamStatusCode())
			}
		})
	}
}

// TestParseRetryAfter covers delta seconds, HTTP dates, expired values, and
// saturation of values that cannot fit in time.Duration.
func TestParseRetryAfter(t *testing.T) {
	now := time.Date(2026, time.July, 14, 12, 0, 0, 0, time.UTC)
	require.Equal(t, 3*time.Second, ParseRetryAfter("3", now))
	require.Equal(t, 5*time.Second, ParseRetryAfter(now.Add(5*time.Second).Format(http.TimeFormat), now))
	require.Zero(t, ParseRetryAfter("0", now))
	require.Zero(t, ParseRetryAfter("invalid", now))
	require.Zero(t, ParseRetryAfter(now.Add(-time.Second).Format(http.TimeFormat), now))
	require.Equal(t, time.Duration(1<<63-1), ParseRetryAfter("9223372036854775807", now))
}

// TestRelayErrorHandlerClosesBodyWhenReadFails protects response cleanup and
// metadata preservation when the upstream body cannot be read.
func TestRelayErrorHandlerClosesBodyWhenReadFails(t *testing.T) {
	body := &errorReadCloser{}
	resp := &http.Response{
		StatusCode: http.StatusBadGateway,
		Header:     http.Header{"Retry-After": []string{"7"}},
		Body:       body,
	}

	apiErr := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, apiErr)
	assert.True(t, body.closed)
	assert.Equal(t, http.StatusBadGateway, apiErr.UpstreamStatusCode)
	assert.Equal(t, 7*time.Second, apiErr.RetryAfter)
}

// TestTaskErrorFromAPIErrorPreservesRetryAfter verifies async relay errors carry
// provider backoff hints into task retry handling.
func TestTaskErrorFromAPIErrorPreservesRetryAfter(t *testing.T) {
	apiErr := types.NewErrorWithStatusCode(errors.New("busy"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)
	apiErr.RetryAfter = 7 * time.Second

	taskErr := TaskErrorFromAPIError(apiErr)

	require.Equal(t, 7*time.Second, taskErr.RetryAfter)
}

func TestRelayErrorHandlerTruncatesInvalidJSONBodyInLog(t *testing.T) {
	withDebugEnabled(t, false)

	body := strings.Repeat("b", common.LocalLogContentLimit+256)
	var logBuffer bytes.Buffer

	common.LogWriterMu.Lock()
	oldWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logBuffer
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = oldWriter
		common.LogWriterMu.Unlock()
	})

	resp := &http.Response{
		StatusCode: http.StatusInternalServerError,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, newAPIError)
	require.Equal(t, "bad response status code 500", newAPIError.Error())
	require.Contains(t, logBuffer.String(), "[truncated")
	require.Contains(t, logBuffer.String(), fmt.Sprintf("original_length=%d", len(body)))
	require.NotContains(t, logBuffer.String(), strings.Repeat("b", common.LocalLogContentLimit+1))
}

func TestRelayErrorHandlerKeepsStructuredErrorMessage(t *testing.T) {
	message := strings.Repeat("c", common.LocalLogContentLimit+256)
	body := `{"message":"` + message + `"}`
	resp := &http.Response{
		StatusCode: http.StatusInternalServerError,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, newAPIError)
	require.Equal(t, message, newAPIError.Error())
}

func TestRelayErrorHandlerKeepsOpenAIErrorMessage(t *testing.T) {
	message := strings.Repeat("d", common.LocalLogContentLimit+256)
	body := `{"error":{"message":"` + message + `","type":"server_error","code":"server_error"}}`
	resp := &http.Response{
		StatusCode: http.StatusInternalServerError,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, newAPIError)
	require.Equal(t, message, newAPIError.Error())
}

func TestRelayErrorHandlerKeepsInvalidJSONBodyInDebugLog(t *testing.T) {
	withDebugEnabled(t, true)

	body := strings.Repeat("e", common.LocalLogContentLimit+256)
	var logBuffer bytes.Buffer

	common.LogWriterMu.Lock()
	oldWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logBuffer
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = oldWriter
		common.LogWriterMu.Unlock()
	})

	resp := &http.Response{
		StatusCode: http.StatusInternalServerError,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, newAPIError)
	require.NotContains(t, logBuffer.String(), "[truncated")
	require.Contains(t, logBuffer.String(), body)
}

func withDebugEnabled(t *testing.T, enabled bool) {
	t.Helper()

	oldDebug := common.DebugEnabled
	common.DebugEnabled = enabled
	t.Cleanup(func() {
		common.DebugEnabled = oldDebug
	})
}
