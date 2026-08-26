package types

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestToClaudeErrorUsesOpenAITypeWhenCodeIsNil(t *testing.T) {
	t.Parallel()

	newAPIError := WithOpenAIError(OpenAIError{
		Message: "upstream overloaded",
		Type:    "overloaded_error",
		Code:    nil,
	}, http.StatusServiceUnavailable)

	claudeError := newAPIError.ToClaudeError()

	require.Equal(t, "overloaded_error", claudeError.Type)
	require.Equal(t, "upstream overloaded", claudeError.Message)
	require.NotEqual(t, "<nil>", claudeError.Type)
}

func TestToClaudeErrorMapsHTTPStatusToAnthropicType(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		statusCode int
		wantType   string
	}{
		{http.StatusBadRequest, "invalid_request_error"},
		{http.StatusUnauthorized, "authentication_error"},
		{http.StatusPaymentRequired, "billing_error"},
		{http.StatusForbidden, "permission_error"},
		{http.StatusNotFound, "not_found_error"},
		{http.StatusRequestTimeout, "invalid_request_error"},
		{http.StatusConflict, "conflict_error"},
		{http.StatusRequestEntityTooLarge, "request_too_large"},
		{http.StatusTooManyRequests, "rate_limit_error"},
		{http.StatusInternalServerError, "api_error"},
		{http.StatusServiceUnavailable, "overloaded_error"},
		{http.StatusGatewayTimeout, "timeout_error"},
		{524, "timeout_error"},
		{529, "overloaded_error"},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.wantType, func(t *testing.T) {
			t.Parallel()
			newAPIError := NewErrorWithStatusCode(errors.New("failure"), ErrorCodeBadResponse, testCase.statusCode)
			assert.Equal(t, testCase.wantType, newAPIError.ToClaudeError().Type)
		})
	}
}

func TestToClaudeErrorPreservesOfficialCandidateTypes(t *testing.T) {
	t.Parallel()

	for _, errorType := range []string{"billing_error", "conflict_error", "timeout_error"} {
		errorType := errorType
		t.Run(errorType, func(t *testing.T) {
			t.Parallel()
			newAPIError := WithOpenAIError(OpenAIError{
				Message: "failure",
				Type:    errorType,
			}, http.StatusInternalServerError)
			require.Equal(t, errorType, newAPIError.ToClaudeError().Type)
		})
	}
}

func TestToClaudeErrorResponsePreservesRequestID(t *testing.T) {
	t.Parallel()

	newAPIError := WithClaudeError(
		ClaudeError{Type: "rate_limit_error", Message: "slow down"},
		http.StatusTooManyRequests,
		ErrOptionWithClaudeRequestID(" req_native "),
	)

	require.Equal(t, ClaudeErrorResponse{
		Type:      "error",
		Error:     ClaudeError{Type: "rate_limit_error", Message: "slow down"},
		RequestID: "req_native",
	}, newAPIError.ToClaudeErrorResponse())
}

func TestToClaudeErrorResponseUsesFallbackRequestID(t *testing.T) {
	t.Parallel()

	newAPIError := NewClaudeError(errors.New("failure"), ErrorCodeBadResponse, http.StatusInternalServerError)

	require.Equal(t, "req_local", newAPIError.ToClaudeErrorResponse(" req_local ").RequestID)
}
