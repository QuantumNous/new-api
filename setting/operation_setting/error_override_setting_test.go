package operation_setting

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/relaykit/types"
)

// restoreOverrideState resets the package-level override settings to the defaults used
// by each test and reinstalls them after the test runs, so tests stay isolated.
func restoreOverrideState(t *testing.T) {
	t.Helper()
	origEnabled := ErrorOverrideEnabled
	origKeywords := ErrorOverrideKeywords
	t.Cleanup(func() {
		ErrorOverrideEnabled = origEnabled
		ErrorOverrideKeywords = origKeywords
	})
	ErrorOverrideEnabled = true
	ErrorOverrideKeywords = []string{"no available", "quota", "credits", "top-up"}
}

func TestOverrideUpstreamMessage_DisabledKeepsMessage(t *testing.T) {
	orig := ErrorOverrideEnabled
	t.Cleanup(func() { ErrorOverrideEnabled = orig })
	ErrorOverrideEnabled = false

	msg := "Your credit balance is too low, please top up"
	assert.Equal(t, msg, OverrideUpstreamMessage(msg))
	// Empty message is never overridden even when enabled.
	assert.Equal(t, "", OverrideUpstreamMessage(""))
}

func TestOverrideUpstreamMessage_MatchesKeywords(t *testing.T) {
	restoreOverrideState(t)

	cases := []struct {
		name    string
		message string
		want    string
	}{
		{"credits", "insufficient credits", ErrorOverrideMessage},
		{"top-up", "Please top-up your account", ErrorOverrideMessage},
		{"quota", "You exceeded your current quota", ErrorOverrideMessage},
		{"no available", "No available channel for model gpt-4o under group default", ErrorOverrideMessage},
		{"case-insensitive credits", "CREDITS exhausted", ErrorOverrideMessage},
		{"case-insensitive quota", "QUOTA exceeded", ErrorOverrideMessage},
		{"no match", "Internal Server Error", "Internal Server Error"},
		{"empty", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, OverrideUpstreamMessage(tc.message))
		})
	}
}

func TestOverrideUpstreamError_LocalErrorsNotOverridden(t *testing.T) {
	restoreOverrideState(t)

	// 本地错误：用户额度不足（由本站产生，未标记上游来源）。
	localQuota := types.NewErrorWithStatusCode(
		errors.New("用户额度不足, 剩余额度: $0.00"),
		types.ErrorCodeInsufficientUserQuota, http.StatusPaymentRequired)
	assert.False(t, OverrideUpstreamError(localQuota))
	assert.Equal(t, "用户额度不足, 剩余额度: $0.00", localQuota.Error())

	// 本地错误：distributor 的「无可用渠道」文案虽然命中 "no available" 关键词，
	// 但因未标记上游来源，不应被覆写。
	localNoChannel := types.NewErrorWithStatusCode(
		errors.New("No available channel for model gpt-4o under group default (distributor)"),
		types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)
	assert.False(t, OverrideUpstreamError(localNoChannel))
	assert.Contains(t, localNoChannel.Error(), "No available channel")
}

func TestOverrideUpstreamError_UpstreamErrorsOverridden(t *testing.T) {
	restoreOverrideState(t)

	cases := []struct {
		name    string
		build   func() *types.NewAPIError
		message string
	}{
		{
			name: "openai credits",
			build: func() *types.NewAPIError {
				return types.WithUpstreamOpenAIError(types.OpenAIError{
					Message: "insufficient credits balance, please top up",
					Type:    "upstream_error",
					Code:    "credits_exhausted",
				}, http.StatusPaymentRequired)
			},
			message: "insufficient credits balance, please top up",
		},
		{
			name: "claude quota",
			build: func() *types.NewAPIError {
				return types.WithUpstreamClaudeError(types.ClaudeError{
					Type:    "error",
					Message: "You exceeded your current quota",
				}, http.StatusTooManyRequests)
			},
			message: "You exceeded your current quota",
		},
		{
			name: "openai no available",
			build: func() *types.NewAPIError {
				return types.WithUpstreamOpenAIError(types.OpenAIError{
					Message: "No available channel for model gpt-4o under group default",
					Type:    "upstream_error",
					Code:    "no_available_channel",
				}, http.StatusServiceUnavailable)
			},
			message: "No available channel for model gpt-4o under group default",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.build()
			require.True(t, types.IsFromUpstreamError(err))
			require.True(t, OverrideUpstreamError(err))

			// Every user-facing representation is rewritten.
			assert.Equal(t, ErrorOverrideMessage, err.Error())
			openAI := err.ToOpenAIError()
			assert.Equal(t, ErrorOverrideMessage, openAI.Message)
			assert.Nil(t, openAI.Metadata)
		})
	}
}

func TestOverrideUpstreamError_PreservesStatusCodeTypeCode(t *testing.T) {
	restoreOverrideState(t)

	err := types.WithUpstreamOpenAIError(types.OpenAIError{
		Message: "Please top up your credits",
		Type:    "upstream_error",
		Code:    "credits_exhausted",
	}, http.StatusPaymentRequired)
	originalCode := err.GetErrorCode()
	originalType := err.GetErrorType()

	require.True(t, OverrideUpstreamError(err))

	assert.Equal(t, http.StatusPaymentRequired, err.StatusCode)
	assert.Equal(t, originalType, err.GetErrorType())
	assert.Equal(t, originalCode, err.GetErrorCode())
}

func TestOverrideUpstreamError_DisabledDoesNothing(t *testing.T) {
	orig := ErrorOverrideEnabled
	t.Cleanup(func() { ErrorOverrideEnabled = orig })
	ErrorOverrideEnabled = false

	err := types.WithUpstreamOpenAIError(types.OpenAIError{
		Message: "quota exhausted",
		Type:    "upstream_error",
	}, http.StatusTooManyRequests)
	assert.False(t, OverrideUpstreamError(err))
	assert.Equal(t, "quota exhausted", err.Error())
}

func TestOverrideUpstreamError_NilSafe(t *testing.T) {
	restoreOverrideState(t)
	require.NotPanics(t, func() { OverrideUpstreamError(nil) })
}

func TestOverrideUpstreamMessage_NoKeywords(t *testing.T) {
	origEnabled := ErrorOverrideEnabled
	origKeywords := ErrorOverrideKeywords
	t.Cleanup(func() {
		ErrorOverrideEnabled = origEnabled
		ErrorOverrideKeywords = origKeywords
	})
	ErrorOverrideEnabled = true
	ErrorOverrideKeywords = nil

	msg := "Your credits are too low"
	assert.Equal(t, msg, OverrideUpstreamMessage(msg))
}

func TestErrorOverrideKeywordsFromString_ParsesAndNormalizes(t *testing.T) {
	orig := ErrorOverrideKeywords
	t.Cleanup(func() { ErrorOverrideKeywords = orig })

	ErrorOverrideKeywordsFromString("Credits\n  Quota  \n\n\ntop-up\n  ")

	require.Equal(t, []string{"credits", "quota", "top-up"}, ErrorOverrideKeywords)
}

func TestErrorOverrideKeywordsFromString_EmptyStringClears(t *testing.T) {
	orig := ErrorOverrideKeywords
	t.Cleanup(func() { ErrorOverrideKeywords = orig })

	ErrorOverrideKeywordsFromString("")
	require.Empty(t, ErrorOverrideKeywords)
}

func TestErrorOverrideKeywordsToString_RoundTrip(t *testing.T) {
	orig := ErrorOverrideKeywords
	t.Cleanup(func() { ErrorOverrideKeywords = orig })

	ErrorOverrideKeywords = []string{"no available", "quota", "credits", "top-up"}
	s := ErrorOverrideKeywordsToString()
	ErrorOverrideKeywordsFromString(s)
	require.Equal(t, []string{"no available", "quota", "credits", "top-up"}, ErrorOverrideKeywords)
}
