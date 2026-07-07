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

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

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
		})
	}
}

func TestResetStatusCodeUsesOriginalStatusCode(t *testing.T) {
	t.Parallel()

	newAPIError := types.NewOpenAIError(
		errors.New("rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)

	ResetStatusCode(newAPIError, `{"429":503}`)
	require.Equal(t, http.StatusServiceUnavailable, newAPIError.StatusCode)

	ResetStatusCode(newAPIError, `{"429":502}`)
	require.Equal(t, http.StatusBadGateway, newAPIError.StatusCode)
	require.Equal(t, http.StatusTooManyRequests, newAPIError.GetOriginalStatusCode())
}

func TestApplyStatusCodeResponseMapping(t *testing.T) {
	t.Parallel()

	newAPIError := types.NewOpenAIError(
		errors.New("upstream rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)
	mapping := `{"429":{"status_code":503,"message":"Upstream is busy, please retry later.","type":"server_error","code":"upstream_overloaded"}}`

	messageOverridden := ApplyStatusCodeResponseMapping(newAPIError, mapping)

	require.True(t, messageOverridden)
	require.Equal(t, http.StatusServiceUnavailable, newAPIError.StatusCode)
	require.Equal(t, "Upstream is busy, please retry later.", newAPIError.Error())

	openAIError := newAPIError.ToOpenAIError()
	require.Equal(t, "Upstream is busy, please retry later.", openAIError.Message)
	require.Equal(t, "server_error", openAIError.Type)
	require.Equal(t, "upstream_overloaded", openAIError.Code)

	claudeError := newAPIError.ToClaudeError()
	require.Equal(t, "Upstream is busy, please retry later.", claudeError.Message)
	require.Equal(t, "server_error", claudeError.Type)
}

func TestApplyStatusCodeResponseMappingKeepsValidFieldsWhenStatusCodeInvalid(t *testing.T) {
	t.Parallel()

	newAPIError := types.NewOpenAIError(
		errors.New("upstream rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)

	messageOverridden := ApplyStatusCodeResponseMapping(newAPIError, `{"429":{"status_code":700,"message":"Custom message"}}`)

	require.True(t, messageOverridden)
	require.Equal(t, http.StatusTooManyRequests, newAPIError.StatusCode)
	require.Equal(t, "Custom message", newAPIError.ToOpenAIError().Message)
}

func TestApplyStatusCodeResponseMappingIgnoresInvalidConfig(t *testing.T) {
	t.Parallel()

	newAPIError := types.NewOpenAIError(
		errors.New("upstream rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)

	messageOverridden := ApplyStatusCodeResponseMapping(newAPIError, `{"429":"busy"}`)

	require.False(t, messageOverridden)
	require.Equal(t, http.StatusTooManyRequests, newAPIError.StatusCode)
	require.Equal(t, "upstream rate limited", newAPIError.Error())
}

func TestApplyStatusCodeResponseMappingTakesPrecedenceOverStatusCodeMapping(t *testing.T) {
	t.Parallel()

	newAPIError := types.NewOpenAIError(
		errors.New("upstream rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)

	ResetStatusCode(newAPIError, `{"429":503}`)
	ApplyStatusCodeResponseMapping(newAPIError, `{"429":{"status_code":502,"message":"Gateway failed"}}`)

	require.Equal(t, http.StatusBadGateway, newAPIError.StatusCode)
	require.Equal(t, "Gateway failed", newAPIError.ToOpenAIError().Message)
}

func TestApplyStatusCodeResponseMappingToTaskError(t *testing.T) {
	t.Parallel()

	taskErr := &dto.TaskError{
		Code:               "upstream_error",
		Message:            "too many requests",
		StatusCode:         http.StatusTooManyRequests,
		OriginalStatusCode: http.StatusTooManyRequests,
		Error:              errors.New("too many requests"),
	}

	messageOverridden := ApplyStatusCodeResponseMappingToTaskError(
		taskErr,
		`{"429":{"status_code":503,"message":"Task upstream is busy.","code":"upstream_overloaded"}}`,
	)

	require.True(t, messageOverridden)
	require.Equal(t, http.StatusServiceUnavailable, taskErr.StatusCode)
	require.Equal(t, "Task upstream is busy.", taskErr.Message)
	require.Equal(t, "upstream_overloaded", taskErr.Code)
	require.EqualError(t, taskErr.Error, "Task upstream is busy.")
}

func TestValidateStatusCodeResponseMapping(t *testing.T) {
	t.Parallel()

	require.NoError(t, ValidateStatusCodeResponseMapping(`{"429":{"status_code":503,"message":"busy","type":"server_error","code":"upstream_overloaded"}}`))
	require.NoError(t, ValidateStatusCodeResponseMapping(""))
	require.Error(t, ValidateStatusCodeResponseMapping(`{"bad":{"message":"busy"}}`))
	require.Error(t, ValidateStatusCodeResponseMapping(`{"429":"busy"}`))
	require.Error(t, ValidateStatusCodeResponseMapping(`{"429":{"status_code":700}}`))
	require.Error(t, ValidateStatusCodeResponseMapping(`{"429":{"message":503}}`))
	require.Error(t, ValidateStatusCodeResponseMapping(`{"429":{"description":"busy"}}`))
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
