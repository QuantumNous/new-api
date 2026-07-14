package dto

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestGetOpenAIErrorDefaultsMissingType locks in a non-empty error type for
// provider envelopes that include a message and code but omit type.
func TestGetOpenAIErrorDefaultsMissingType(t *testing.T) {
	apiErr := GetOpenAIError(map[string]any{
		"message": "upstream busy",
		"code":    "server_error",
	})

	require.NotNil(t, apiErr)
	require.Equal(t, "upstream_error", apiErr.Type)
	require.Equal(t, "upstream busy", apiErr.Message)
	require.Equal(t, "server_error", apiErr.Code)
}
