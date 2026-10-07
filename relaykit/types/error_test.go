package types

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestHasUpstreamErrorCodeByConstructor(t *testing.T) {
	upstream := WithOpenAIError(OpenAIError{Code: "rate_limit_exceeded", Message: "Slow down"}, http.StatusTooManyRequests)
	for _, tc := range []struct {
		name     string
		err      *NewAPIError
		wantCode ErrorCode
		want     bool
	}{
		{"upstream string code", upstream, "rate_limit_exceeded", true},
		{"upstream numeric code", WithOpenAIError(OpenAIError{Code: 20001, Message: "Quota exhausted"}, http.StatusForbidden), "20001", true},
		{"missing upstream code falls back to unknown_error", WithOpenAIError(OpenAIError{Message: "Failed"}, http.StatusBadGateway), "unknown_error", false},
		{"empty upstream code", WithOpenAIError(OpenAIError{Code: "", Message: "Failed"}, http.StatusBadGateway), "", false},
		{"Claude error type", WithClaudeError(ClaudeError{Type: "overloaded_error", Message: "Overloaded"}, http.StatusInternalServerError), "overloaded_error", true},
		{"Claude error without type falls back to upstream_error", WithClaudeError(ClaudeError{Message: "Failed"}, http.StatusInternalServerError), "upstream_error", false},
		{"InitOpenAIError", InitOpenAIError(ErrorCodeBadResponseStatusCode, http.StatusBadGateway), ErrorCodeBadResponseStatusCode, false},
		{"NewOpenAIError", NewOpenAIError(errors.New("Failed"), ErrorCodeBadResponseStatusCode, http.StatusBadGateway), ErrorCodeBadResponseStatusCode, false},
		{"NewOpenAIError keeps a wrapped upstream code", NewOpenAIError(fmt.Errorf("stream: %w", upstream), ErrorCodeBadResponseBody, http.StatusBadGateway), "rate_limit_exceeded", true},
		{"NewErrorWithStatusCode", NewErrorWithStatusCode(errors.New("Failed"), ErrorCodeInsufficientUserQuota, http.StatusForbidden), ErrorCodeInsufficientUserQuota, false},
		{"local code option", WithOpenAIError(OpenAIError{Code: "blocked", Message: "Blocked"}, http.StatusForbidden, ErrOptionWithLocalErrorCode()), "blocked", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.wantCode, tc.err.GetErrorCode())
			assert.Equal(t, tc.want, tc.err.HasUpstreamErrorCode())
		})
	}
}
