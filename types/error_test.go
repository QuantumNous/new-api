package types

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewAPIErrorToOpenAIErrorSanitizesUserVisibleMessage(t *testing.T) {
	err := WithOpenAIError(OpenAIError{
		Message: "upstream channel failed Authorization: Bearer sk-test-secret123 api_key=raw-secret relay=claude",
		Type:    "upstream_error",
		Code:    "bad_response",
	}, 502)

	openaiErr := err.ToOpenAIError()

	require.Equal(t, "status_code=502, error_code=bad_response", openaiErr.Message)
	require.Equal(t, "new_api_error", openaiErr.Type)
	require.Equal(t, "bad_response", openaiErr.Code)
	require.NotContains(t, openaiErr.Message, "sk-test-secret123")
	require.NotContains(t, openaiErr.Message, "raw-secret")
	require.NotContains(t, strings.ToLower(openaiErr.Message), "upstream")
	require.NotContains(t, strings.ToLower(openaiErr.Message), "channel")
	require.NotContains(t, strings.ToLower(openaiErr.Message), "relay")
}

func TestNewAPIErrorToOpenAIErrorSanitizesInternalCode(t *testing.T) {
	err := WithOpenAIError(OpenAIError{
		Message: "no available key",
		Type:    "upstream_error",
		Code:    "channel:no_available_key",
	}, 502)

	openaiErr := err.ToOpenAIError()

	require.Equal(t, "request_error", openaiErr.Code)
	require.Equal(t, "new_api_error", openaiErr.Type)
	require.NotContains(t, strings.ToLower(openaiErr.Message), "channel")
	require.NotContains(t, strings.ToLower(fmt.Sprintf("%v", openaiErr.Code)), "channel")
}

func TestNewAPIErrorToClaudeErrorSanitizesUserVisibleMessage(t *testing.T) {
	err := WithClaudeError(ClaudeError{
		Message: "Authorization: Bearer sk-test-secret123 channel key_fp=abc",
		Type:    "bad_response",
	}, 500)

	claudeErr := err.ToClaudeError()

	require.Equal(t, "status_code=500, error_code=bad_response", claudeErr.Message)
	require.Equal(t, "bad_response", claudeErr.Type)
	require.NotContains(t, claudeErr.Message, "sk-test-secret123")
	require.NotContains(t, strings.ToLower(claudeErr.Message), "channel")
	require.NotContains(t, strings.ToLower(claudeErr.Message), "key_fp")
}

func TestNewAPIErrorToClaudeErrorSanitizesInternalType(t *testing.T) {
	err := WithClaudeError(ClaudeError{
		Message: "upstream unavailable",
		Type:    "channel:no_available_key",
	}, 500)

	claudeErr := err.ToClaudeError()

	require.Equal(t, "new_api_error", claudeErr.Type)
	require.NotContains(t, strings.ToLower(claudeErr.Type), "channel")
}

func TestNewAPIErrorMaskSensitiveErrorUsesStrongSecretMasking(t *testing.T) {
	err := NewErrorWithStatusCode(
		errors.New("bad response Authorization: Bearer sk-test-secret123 api_key=raw-secret"),
		ErrorCodeBadResponseStatusCode,
		502,
	)

	message := err.MaskSensitiveError()

	require.NotContains(t, message, "sk-test-secret123")
	require.NotContains(t, message, "raw-secret")
	require.Contains(t, message, "Authorization:***")
	require.Contains(t, message, "api_key=***")
}
