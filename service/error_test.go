package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/system_setting"
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

func TestScrubWhitelabelError(t *testing.T) {
	const leak = "GenerateOpenAIRequest.max_tokens of type x not present in request id"
	const brand = "blockrun upstream connection timed out"
	const benign = "Rate limit exceeded, please slow down"

	newUpstreamErr := func(oe types.OpenAIError) *types.NewAPIError {
		return types.WithOpenAIError(oe, http.StatusInternalServerError)
	}
	plain := func(msg string) *types.NewAPIError {
		return newUpstreamErr(types.OpenAIError{Message: msg, Type: "server_error", Code: "server_error"})
	}

	t.Run("blockrun message leak scrubbed on both render paths", func(t *testing.T) {
		for _, msg := range []string{leak, brand} {
			e := plain(msg)
			ScrubWhitelabelError(context.Background(), e, constant.ChannelTypeBlockRun)
			require.Equal(t, whitelabelGenericErrorMessage, e.ToClaudeError().Message)
			require.Equal(t, whitelabelGenericErrorMessage, e.ToOpenAIError().Message)
			require.NotContains(t, e.ToOpenAIError().Message, "blockrun")
		}
	})

	t.Run("benign message passes through unchanged", func(t *testing.T) {
		e := plain(benign)
		ScrubWhitelabelError(context.Background(), e, constant.ChannelTypeBlockRun)
		require.Equal(t, benign, e.ToOpenAIError().Message)
	})

	t.Run("non-whitelabel channel never scrubbed", func(t *testing.T) {
		e := plain(leak)
		ScrubWhitelabelError(context.Background(), e, constant.ChannelTypeOpenAI)
		require.Equal(t, leak, e.ToOpenAIError().Message)
	})

	t.Run("async video/seedance channels are out of sync scope", func(t *testing.T) {
		for _, ct := range []int{constant.ChannelTypeBlockRunVideo, constant.ChannelTypeBlockRunSeedance} {
			e := plain(leak)
			ScrubWhitelabelError(context.Background(), e, ct)
			require.Equal(t, leak, e.ToOpenAIError().Message)
		}
	})

	t.Run("leak only in Param (clean message) is detected via surface and envelope cleared", func(t *testing.T) {
		e := newUpstreamErr(types.OpenAIError{
			Message: "Internal error", // clean — no brand/internal pattern
			Type:    "server_error",
			Param:   "GenerateOpenAIRequest.max_tokens", // leak lives only here
			Code:    "server_error",
		})
		ScrubWhitelabelError(context.Background(), e, constant.ChannelTypeBlockRun)
		oe := e.ToOpenAIError()
		require.Equal(t, whitelabelGenericErrorMessage, oe.Message)
		require.Empty(t, oe.Param)
		require.NotContains(t, oe.Param, "GenerateOpenAIRequest")
	})

	t.Run("leak in Metadata is cleared from the rendered envelope", func(t *testing.T) {
		e := newUpstreamErr(types.OpenAIError{
			Message:  "boom",
			Type:     "server_error",
			Code:     "server_error",
			Metadata: json.RawMessage(`{"provider":"blockrun"}`),
		})
		ScrubWhitelabelError(context.Background(), e, constant.ChannelTypeBlockRun)
		oe := e.ToOpenAIError()
		require.Equal(t, whitelabelGenericErrorMessage, oe.Message)
		require.Empty(t, string(oe.Metadata))
		require.NotContains(t, string(oe.Metadata), "blockrun")
	})

	t.Run("nil-safe", func(t *testing.T) {
		require.NotPanics(t, func() {
			ScrubWhitelabelError(context.Background(), nil, constant.ChannelTypeBlockRun)
		})
	})
}

func TestToOpenAIErrorDoesNotUnmaskAllowlistedHostWithoutExplicitOptIn(t *testing.T) {
	originalAllowedHosts := append([]string(nil), system_setting.GetTopupHintSettings().AllowedHosts...)
	t.Cleanup(func() {
		system_setting.GetTopupHintSettings().AllowedHosts = originalAllowedHosts
	})

	system_setting.GetTopupHintSettings().AllowedHosts = []string{"console.flatkey.ai"}

	err := types.NewErrorWithStatusCode(
		errors.New("boom https://console.flatkey.ai/wallet"),
		types.ErrorCodeInsufficientUserQuota,
		http.StatusForbidden,
	)

	require.NotContains(t, err.ToOpenAIError().Message, "https://console.flatkey.ai/wallet")
	require.Contains(t, err.ToOpenAIError().Message, "https://***.ai/***")
}

func withDebugEnabled(t *testing.T, enabled bool) {
	t.Helper()

	oldDebug := common.DebugEnabled
	common.DebugEnabled = enabled
	t.Cleanup(func() {
		common.DebugEnabled = oldDebug
	})
}
