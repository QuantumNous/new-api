package constant

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMultipartAsyncImageRequestRoutesToEdits(t *testing.T) {
	t.Parallel()

	contentType := "multipart/form-data; boundary=test"
	require.Equal(t, "/v1/images/edits", EffectiveImageRequestPath("/v1/images/generations/async", contentType))
	require.Equal(t, RelayModeImagesEdits, Request2RelayMode("/v1/images/generations/async", contentType))
}

func TestJSONAsyncImageRequestRemainsGeneration(t *testing.T) {
	t.Parallel()

	require.Equal(t, "/v1/images/generations/async", EffectiveImageRequestPath("/v1/images/generations/async", "application/json"))
	require.Equal(t, RelayModeImagesGenerations, Request2RelayMode("/v1/images/generations/async", "application/json"))
}
