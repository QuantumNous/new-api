package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
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

func TestRelayErrorHandlerRewritesUpstreamPreConsumeError(t *testing.T) {
	body := `{"error":{"message":"预扣费额度失败, 用户剩余额度: ¥0.230000, 需要预扣费额度: ¥0.290000 (request id: 202607161100477844560988268d9d6uYrgwk77)","type":"new_api_error","code":"insufficient_user_quota"}}`
	resp := &http.Response{
		StatusCode: http.StatusForbidden,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError := RelayErrorHandler(context.Background(), resp, false)

	require.NotNil(t, newAPIError)
	expected := "预扣费额度失败, 可能是上游余额不足 (request id: 202607161100477844560988268d9d6uYrgwk77)"
	require.Equal(t, expected, newAPIError.Error())
	require.Equal(t, http.StatusForbidden, newAPIError.StatusCode)
	// 返回给最终用户的消息（RelayError）同样被改写
	require.Equal(t, expected, newAPIError.ToOpenAIError().Message)
	require.Equal(t, "insufficient_user_quota", fmt.Sprintf("%v", newAPIError.ToOpenAIError().Code))
}

func TestRewriteUpstreamPreConsumeError(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "CNY 金额带 request id",
			input:    "预扣费额度失败, 用户剩余额度: ¥0.230000, 需要预扣费额度: ¥0.290000 (request id: 202607161100477844560988268d9d6uYrgwk77)",
			expected: "预扣费额度失败, 可能是上游余额不足 (request id: 202607161100477844560988268d9d6uYrgwk77)",
		},
		{
			name:     "USD 金额不带 request id",
			input:    "预扣费额度失败, 用户剩余额度: $0.23, 需要预扣费额度: $0.29",
			expected: "预扣费额度失败, 可能是上游余额不足",
		},
		{
			name:     "token 数量格式",
			input:    "预扣费额度失败, 用户剩余额度: 115000, 需要预扣费额度: 145000",
			expected: "预扣费额度失败, 可能是上游余额不足",
		},
		{
			name:     "上游账户余额为零",
			input:    "用户额度不足, 剩余额度: ¥0.000000 (request id: 202607161100477844560988268d9d6uYrgwk77)",
			expected: "预扣费额度失败, 可能是上游余额不足 (request id: 202607161100477844560988268d9d6uYrgwk77)",
		},
		{
			name:     "上游令牌额度不足",
			input:    "token quota is not enough, token remain quota: ¥0.100000, need quota: ¥0.290000 (request id: 202607161100477844560988268d9d6uYrgwk77)",
			expected: "预扣费额度失败, 可能是上游余额不足 (request id: 202607161100477844560988268d9d6uYrgwk77)",
		},
		{
			name:     "上游订阅额度不足",
			input:    "订阅额度不足或未配置订阅: subscription quota insufficient, need=290000 (request id: 202607161100477844560988268d9d6uYrgwk77)",
			expected: "预扣费额度失败, 可能是上游余额不足 (request id: 202607161100477844560988268d9d6uYrgwk77)",
		},
		{
			name:     "上游未配置订阅",
			input:    "订阅额度不足或未配置订阅: no active subscription (request id: 202607161100477844560988268d9d6uYrgwk77)",
			expected: "预扣费额度失败, 可能是上游余额不足 (request id: 202607161100477844560988268d9d6uYrgwk77)",
		},
		{
			name:     "普通报错不改写",
			input:    "bad response status code 403",
			expected: "bad response status code 403",
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, tc.expected, rewriteUpstreamPreConsumeError(tc.input))
		})
	}
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
