package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
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

func TestNormalizeUpstreamQuotaError(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name       string
		err        *types.NewAPIError
		normalized bool
	}{
		{
			name: "openai insufficient quota code",
			err: types.WithOpenAIError(types.OpenAIError{
				Message: "You exceeded your current quota.",
				Type:    "insufficient_quota",
				Code:    "insufficient_quota",
			}, http.StatusTooManyRequests),
			normalized: true,
		},
		{
			name: "anthropic credit balance message",
			err: types.WithClaudeError(types.ClaudeError{
				Type:    "invalid_request_error",
				Message: "Your credit balance is too low to access the API.",
			}, http.StatusBadRequest),
			normalized: true,
		},
		{
			name: "local user quota remains unchanged",
			err: types.NewErrorWithStatusCode(
				errors.New("用户额度不足, 剩余额度: 0"),
				types.ErrorCodeInsufficientUserQuota,
				http.StatusForbidden,
				types.ErrOptionWithSkipRetry(),
				types.ErrOptionWithNoRecordErrorLog(),
			),
			normalized: false,
		},
		{
			name: "local token quota remains unchanged",
			err: types.NewErrorWithStatusCode(
				errors.New("预扣费失败，用户额度不足"),
				types.ErrorCodePreConsumeTokenQuotaFailed,
				http.StatusForbidden,
				types.ErrOptionWithSkipRetry(),
				types.ErrOptionWithNoRecordErrorLog(),
			),
		},
		{name: "nil error remains nil"},
		{
			name: "ordinary rate limit remains unchanged",
			err: types.WithOpenAIError(types.OpenAIError{
				Message: "Too many requests",
				Type:    "rate_limit_error",
				Code:    "rate_limit_exceeded",
			}, http.StatusTooManyRequests),
			normalized: false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			result := NormalizeUpstreamQuotaError(testCase.err)
			if !testCase.normalized {
				if testCase.err == nil {
					assert.Nil(t, result)
				} else {
					assert.Same(t, testCase.err, result)
				}
				return
			}

			require.NotNil(t, result)
			assert.NotSame(t, testCase.err, result)
			assert.Equal(t, types.ErrorCodeUpstreamQuotaInsufficient, result.GetErrorCode())
			assert.Equal(t, "请联系管理员修复该分组", result.ToOpenAIError().Message)
			assert.True(t, types.IsSkipRetryError(result))
			assert.Equal(t, testCase.err.StatusCode, result.StatusCode)
		})
	}
}

func TestUpstreamQuotaErrorRelayPolicy(t *testing.T) {
	previousRetryRanges := operation_setting.AutomaticRetryStatusCodeRanges
	operation_setting.AutomaticRetryStatusCodeRanges = []operation_setting.StatusCodeRange{
		{Start: http.StatusTooManyRequests, End: http.StatusTooManyRequests},
	}
	t.Cleanup(func() { operation_setting.AutomaticRetryStatusCodeRanges = previousRetryRanges })

	for _, tc := range []struct {
		name       string
		status     int
		body       string
		normalized bool
	}{
		{
			name:       "OpenAI billing quota",
			status:     http.StatusTooManyRequests,
			body:       `{"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota","code":"insufficient_quota"}}`,
			normalized: true,
		},
		{
			name:       "Anthropic low credit balance",
			status:     http.StatusBadRequest,
			body:       `{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the API."}}`,
			normalized: true,
		},
		{
			name:       "upstream user quota code is not a local error",
			status:     http.StatusForbidden,
			body:       `{"error":{"message":"用户额度不足","type":"new_api_error","code":"insufficient_user_quota"}}`,
			normalized: true,
		},
		{
			name:       "Chinese upstream balance message",
			status:     http.StatusPaymentRequired,
			body:       `{"message":"账户余额不足，请充值"}`,
			normalized: true,
		},
		{
			name:       "insufficient balance",
			status:     http.StatusPaymentRequired,
			body:       `{"error":{"message":"Insufficient Balance","type":"insufficient_balance","code":"insufficient_balance"}}`,
			normalized: true,
		},
		{
			name:       "Gemini depleted prepay balance",
			status:     http.StatusPaymentRequired,
			body:       `{"error":{"code":402,"status":"RESOURCE_EXHAUSTED","message":"Your credit balance is depleted. Please top up your account."}}`,
			normalized: true,
		},
		{
			name:       "Gemini payment required resource exhaustion",
			status:     http.StatusPaymentRequired,
			body:       `{"error":{"code":402,"status":"RESOURCE_EXHAUSTED","message":"Resource exhausted"}}`,
			normalized: true,
		},
		{
			name:   "Gemini requests per minute limit",
			status: http.StatusTooManyRequests,
			body:   `{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_requests_per_minute. Please retry in 30 seconds."}}`,
		},
		{
			name:   "resource exhaustion without a billing failure",
			status: http.StatusTooManyRequests,
			body:   `{"error":{"message":"Resource exhausted. Please try again later.","type":"RESOURCE_EXHAUSTED","code":"resource_exhausted"}}`,
		},
		{
			name:   "daily request quota is not a balance failure",
			status: http.StatusTooManyRequests,
			body:   `{"error":{"message":"Daily request quota exceeded","type":"quota_exceeded","code":"quota_exceeded"}}`,
		},
		{
			name:   "request quota shortage is not a balance failure",
			status: http.StatusTooManyRequests,
			body:   `{"error":{"message":"Insufficient quota for requests; retry later","type":"rate_limit_error","code":"rate_limit_exceeded"}}`,
		},
		{
			name:   "Chinese rate quota is not a balance failure",
			status: http.StatusTooManyRequests,
			body:   `{"error":{"message":"每分钟请求配额不足，请稍后重试","type":"rate_limit_error","code":"rate_limit_exceeded"}}`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			original := RelayErrorHandler(c, &http.Response{
				StatusCode: tc.status,
				Body:       io.NopCloser(strings.NewReader(tc.body)),
			}, false)
			require.NotNil(t, original)
			result := NormalizeUpstreamQuotaError(original)
			require.NotNil(t, result)
			assert.Equal(t, tc.status, result.StatusCode)
			decision := DecideRelayRetry(c, result, 1)
			if tc.normalized {
				assert.Equal(t, "请联系管理员修复该分组", result.ToOpenAIError().Message)
				assert.Equal(t, "请联系管理员修复该分组", result.ToClaudeError().Message)
				assert.Equal(t, types.ErrorCodeUpstreamQuotaInsufficient, result.GetErrorCode())
				assert.True(t, types.IsSkipRetryError(result))
				assert.Equal(t, PolicyDecision{Action: "stop", Reason: "non_retryable_error", Source: "system"}, decision)
			} else {
				assert.Same(t, original, result)
				assert.False(t, types.IsSkipRetryError(result))
				assert.Equal(t, PolicyDecision{Action: "retry", Reason: "retry_status_matched", Source: "global"}, decision)
			}
		})
	}
}

func withDebugEnabled(t *testing.T, enabled bool) {
	t.Helper()

	oldDebug := common.DebugEnabled
	common.DebugEnabled = enabled
	t.Cleanup(func() {
		common.DebugEnabled = oldDebug
	})
}
