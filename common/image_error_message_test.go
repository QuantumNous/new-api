package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestImageErrorMessageDoesNotInferCustomerContent(t *testing.T) {
	for _, path := range []string{"/pg/images/edits", "/v1/images/generations"} {
		require.Equal(t, "Image generation failed. Please contact support with the request ID.", ImageErrorMessage(path, "content_policy_violation", "safety checks: sensitive prompt"))
	}
	require.Equal(t, "invalid size", ImageErrorMessage("/v1/images/edits", "invalid_request", "invalid size"))
	require.Equal(t, "original", ImageErrorMessage("/v1/chat/completions", "content_policy_violation", "original"))
}
