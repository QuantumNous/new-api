package types

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMarkUpstreamOrigin_NilSafe(t *testing.T) {
	var e *NewAPIError
	require.NotPanics(t, func() { e.MarkUpstreamOrigin() })
	assert.False(t, IsFromUpstreamError(e))
}

func TestReplaceMessage_NilSafe(t *testing.T) {
	var e *NewAPIError
	require.NotPanics(t, func() { e.ReplaceMessage("x") })
}

func TestIsFromUpstreamError_Nil(t *testing.T) {
	assert.False(t, IsFromUpstreamError(nil))
}

func TestWithUpstreamOpenAIError_MarksOrigin(t *testing.T) {
	e := WithUpstreamOpenAIError(OpenAIError{
		Message: "Your credit balance is too low, please top up",
		Type:    "upstream_error",
		Code:    "credits_exhausted",
	}, http.StatusPaymentRequired)

	require.True(t, IsFromUpstreamError(e))
	assert.Equal(t, http.StatusPaymentRequired, e.StatusCode)
	assert.Equal(t, ErrorTypeOpenAIError, e.GetErrorType())
	assert.Equal(t, ErrorCode("credits_exhausted"), e.GetErrorCode())
}

func TestWithOpenAIError_DoesNotMarkOrigin(t *testing.T) {
	e := WithOpenAIError(OpenAIError{
		Message: "some local message",
		Type:    "upstream_error",
	}, http.StatusBadRequest)
	assert.False(t, IsFromUpstreamError(e))
}

func TestWithUpstreamClaudeError_MarksOrigin(t *testing.T) {
	e := WithUpstreamClaudeError(ClaudeError{
		Type:    "error",
		Message: "You exceeded your current quota",
	}, http.StatusTooManyRequests)

	require.True(t, IsFromUpstreamError(e))
	assert.Equal(t, ErrorTypeClaudeError, e.GetErrorType())
	assert.Equal(t, http.StatusTooManyRequests, e.StatusCode)
}

func TestWithClaudeError_DoesNotMarkOrigin(t *testing.T) {
	e := WithClaudeError(ClaudeError{
		Type:    "error",
		Message: "local",
	}, http.StatusBadRequest)
	assert.False(t, IsFromUpstreamError(e))
}

// ReplaceMessage must rewrite every user-facing representation while preserving
// StatusCode, type, code, and clearing upstream metadata.
func TestReplaceMessage_OpenAIError(t *testing.T) {
	metadata := json.RawMessage(`{"raw":"upstream-secret"}`)
	e := WithUpstreamOpenAIError(OpenAIError{
		Message:  "No available channel for model gpt-4o under group default",
		Type:     "upstream_error",
		Code:     "no_available_channel",
		Metadata: metadata,
	}, http.StatusServiceUnavailable)
	e.Metadata = metadata

	e.ReplaceMessage("Service Unavailable")

	// Err mirrors the new message.
	assert.Equal(t, "Service Unavailable", e.Error())

	// ToOpenAIError returns the RelayError payload verbatim, so it must reflect the new message.
	openAI := e.ToOpenAIError()
	assert.Equal(t, "Service Unavailable", openAI.Message)
	assert.Nil(t, openAI.Metadata)

	// Preserved fields.
	assert.Equal(t, http.StatusServiceUnavailable, e.StatusCode)
	assert.Equal(t, ErrorTypeOpenAIError, e.GetErrorType())
	assert.Equal(t, ErrorCode("no_available_channel"), e.GetErrorCode())
	assert.Nil(t, e.Metadata)
}

func TestReplaceMessage_ClaudeError(t *testing.T) {
	e := WithUpstreamClaudeError(ClaudeError{
		Type:    "error",
		Message: "You exceeded your current quota",
	}, http.StatusTooManyRequests)

	e.ReplaceMessage("Service Unavailable")

	assert.Equal(t, "Service Unavailable", e.Error())
	claude := e.ToClaudeError()
	assert.Equal(t, "Service Unavailable", claude.Message)
	assert.Equal(t, "error", claude.Type)
	assert.Equal(t, http.StatusTooManyRequests, e.StatusCode)
	assert.Equal(t, ErrorTypeClaudeError, e.GetErrorType())
}

func TestReplaceMessage_DefaultErrorType(t *testing.T) {
	e := NewErrorWithStatusCode(errors.New("upstream quota exhausted"),
		ErrorCodeBadResponseStatusCode, http.StatusBadGateway)
	e.MarkUpstreamOrigin()
	require.True(t, IsFromUpstreamError(e))

	e.ReplaceMessage("Service Unavailable")

	assert.Equal(t, "Service Unavailable", e.Error())
	openAI := e.ToOpenAIError()
	assert.Equal(t, "Service Unavailable", openAI.Message)
	assert.Equal(t, http.StatusBadGateway, e.StatusCode)
	assert.Equal(t, ErrorTypeNewAPIError, e.GetErrorType())
}

// NewError preserves a deeply wrapped *NewAPIError, so the upstream marker must
// survive wrapping carried by errors.As.
func TestUpstreamMarker_SurvivesNewErrorWrap(t *testing.T) {
	upstream := WithUpstreamOpenAIError(OpenAIError{
		Message: "Please top up your credits",
		Type:    "upstream_error",
	}, http.StatusPaymentRequired)

	wrapped := NewError(upstream, ErrorCodeBadResponseStatusCode)

	require.True(t, IsFromUpstreamError(wrapped))
	assert.Equal(t, http.StatusPaymentRequired, wrapped.StatusCode)
}
