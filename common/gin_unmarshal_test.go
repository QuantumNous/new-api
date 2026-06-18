package common

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

// GeneralOpenAIRequest mirrors the real struct whose name leaked into customer
// error messages ("Go struct field GeneralOpenAIRequest.max_tokens of type uint").
type GeneralOpenAIRequest struct {
	MaxTokens *uint `json:"max_tokens"`
}

func TestSanitizeRequestUnmarshalError_TypeMismatch(t *testing.T) {
	var r GeneralOpenAIRequest
	raw := json.Unmarshal([]byte(`{"max_tokens":"30"}`), &r)
	require.Error(t, raw)
	// Sanity: the raw stdlib error really does leak the Go struct name.
	require.Contains(t, raw.Error(), "GeneralOpenAIRequest")

	clean := sanitizeRequestUnmarshalError(raw)
	msg := clean.Error()

	require.NotContains(t, msg, "GeneralOpenAIRequest", "Go struct name must not leak")
	require.NotContains(t, msg, "Go struct field")
	require.Contains(t, msg, "max_tokens", "should name the JSON field")
	require.Contains(t, msg, "integer", "should name the expected type")
	require.Contains(t, msg, "string", "should name the received type")
}

func TestSanitizeRequestUnmarshalError_PassThroughAndNil(t *testing.T) {
	require.Nil(t, sanitizeRequestUnmarshalError(nil))

	// Non-type errors are returned unchanged.
	other := errors.New("unexpected end of JSON input")
	require.Equal(t, other, sanitizeRequestUnmarshalError(other))
}
