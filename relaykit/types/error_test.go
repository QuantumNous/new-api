package types

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestErrorMaskingExemptionRequiresLocalTokenCountError(t *testing.T) {
	const upstreamURL = "https://private-upstream.example"
	const message = "upstream overloaded at https://private-upstream.example/v1/responses"
	cases := []struct {
		name       string
		err        *NewAPIError
		wantMasked bool
	}{
		{"local token count", NewError(errors.New(message), ErrorCodeCountTokenFailed), false},
		{"local OpenAI token count", NewOpenAIError(errors.New(message), ErrorCodeCountTokenFailed, http.StatusInternalServerError), false},
		{"wrapped local token count", NewOpenAIError(NewError(errors.New(message), ErrorCodeCountTokenFailed), ErrorCodeBadResponse, http.StatusInternalServerError), false},
		{"other local error", NewError(errors.New(message), ErrorCodeBadResponse), true},
		{"upstream OpenAI code", WithOpenAIError(OpenAIError{Code: string(ErrorCodeCountTokenFailed), Type: "new_api_error", Message: message}, http.StatusInternalServerError), true},
		{"upstream Claude type", WithClaudeError(ClaudeError{Type: string(ErrorCodeCountTokenFailed), Message: message}, http.StatusInternalServerError), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.NotNil(t, tc.err)
			messages := []string{
				tc.err.MaskSensitiveError(upstreamURL),
				tc.err.ToOpenAIError(upstreamURL).Message,
				tc.err.ToClaudeError(upstreamURL).Message,
			}
			for _, got := range messages {
				assert.Contains(t, got, "upstream overloaded")
				if tc.wantMasked {
					assert.NotContains(t, got, "private-upstream.example")
				} else {
					assert.Equal(t, message, got)
				}
			}
			if tc.name == "upstream OpenAI code" {
				assert.Equal(t, "count_token_failed", tc.err.ToOpenAIError(upstreamURL).Code)
			}
		})
	}
}

func TestChannelErrorClassificationRequiresLocalConstruction(t *testing.T) {
	const code = ErrorCodeChannelNoAvailableKey
	cases := []struct {
		name  string
		err   *NewAPIError
		local bool
	}{
		{"local", NewError(errors.New("no key"), code, ErrOptionWithSkipRetry()), true},
		{"local OpenAI", NewOpenAIError(errors.New("no key"), code, http.StatusInternalServerError), true},
		{"local initialized OpenAI", InitOpenAIError(code, http.StatusInternalServerError), true},
		{"local with status", NewErrorWithStatusCode(errors.New("no key"), code, http.StatusInternalServerError), true},
		{"upstream OpenAI", WithOpenAIError(OpenAIError{Code: string(code), Message: "no key"}, http.StatusInternalServerError), false},
		{"upstream Claude", WithClaudeError(ClaudeError{Type: string(code), Message: "no key"}, http.StatusInternalServerError), false},
		{"wrapped upstream", NewError(WithOpenAIError(OpenAIError{Code: string(code), Message: "no key"}, http.StatusInternalServerError), code), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.NotNil(t, tc.err)
			assert.Equal(t, tc.local, IsChannelError(tc.err))
			if !tc.local {
				assert.Equal(t, string(code), tc.err.ToClaudeError().Type)
			}
		})
	}
}
