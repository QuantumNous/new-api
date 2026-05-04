package dto

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestImageRequestStreamJSON verifies that image requests preserve stream=true.
func TestImageRequestStreamJSON(t *testing.T) {
	var req ImageRequest
	require.NoError(t, req.UnmarshalJSON([]byte(`{"model":"gpt-image-1","prompt":"draw a cat","stream":true}`)))

	require.True(t, req.Stream)
	require.True(t, req.IsStream(nil))
}
