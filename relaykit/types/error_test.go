package types_test

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestToClaudeErrorUsesErrorType(t *testing.T) {
	for _, tc := range []struct {
		name     string
		body     string
		wantType string
		wantCode types.ErrorCode
	}{
		{
			name:     "missing code",
			body:     `{"type":"invalid_request_error","message":"fixture error"}`,
			wantType: "invalid_request_error",
			wantCode: "unknown_error",
		},
		{
			name:     "null code",
			body:     `{"type":"invalid_request_error","message":"fixture error","code":null}`,
			wantType: "invalid_request_error",
			wantCode: "unknown_error",
		},
		{
			name:     "code differs from type",
			body:     `{"type":"invalid_request_error","message":"fixture error","code":"bad_request"}`,
			wantType: "invalid_request_error",
			wantCode: "bad_request",
		},
		{
			name:     "numeric code",
			body:     `{"type":"invalid_request_error","message":"fixture error","code":400}`,
			wantType: "invalid_request_error",
			wantCode: "400",
		},
		{
			name:     "empty type and null code",
			body:     `{"type":"","message":"fixture error","param":"","code":null}`,
			wantType: "upstream_error",
			wantCode: "unknown_error",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var input types.OpenAIError
			require.NoError(t, kitutil.Unmarshal([]byte(tc.body), &input))
			apiErr := types.WithOpenAIError(input, http.StatusBadRequest)

			assert.Equal(t, types.ClaudeError{Type: tc.wantType, Message: input.Message}, apiErr.ToClaudeError())
			assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
			assert.Equal(t, types.ErrorTypeOpenAIError, apiErr.GetErrorType())
			assert.Equal(t, tc.wantCode, apiErr.GetErrorCode())
		})
	}
}

func TestToClaudeErrorPreservesNativeClaudeError(t *testing.T) {
	input := types.ClaudeError{Type: "invalid_request_error", Message: "fixture error"}
	apiErr := types.WithClaudeError(input, http.StatusBadRequest)

	assert.Equal(t, input, apiErr.ToClaudeError())
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
}

func TestToClaudeErrorMasksMessage(t *testing.T) {
	apiErr := types.WithOpenAIError(types.OpenAIError{
		Type:    "invalid_request_error",
		Message: "invalid api_key:fixture-secret",
	}, http.StatusBadRequest)

	assert.Equal(t, types.ClaudeError{
		Type:    "invalid_request_error",
		Message: "invalid api_key:***",
	}, apiErr.ToClaudeError())
}
