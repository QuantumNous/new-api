package common

import (
	"io"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewOutboundJSONBody_GetBodyReplaysFullBody(t *testing.T) {
	t.Parallel()

	payload := []byte(`{"model":"test-model","messages":[{"role":"user","content":"hello"}]}`)

	body, size, getBody, closer, err := NewOutboundJSONBody(payload)
	require.NoError(t, err)
	defer closer.Close()

	require.EqualValues(t, len(payload), size)
	require.NotNil(t, getBody)

	// Consume the primary body, as the HTTP transport does on the first attempt.
	first, err := io.ReadAll(body)
	require.NoError(t, err)
	require.Equal(t, payload, first)

	// GetBody must hand out the complete body again — and repeatedly, since the
	// transport may need more than one retry.
	for i := 0; i < 2; i++ {
		rc, err := getBody()
		require.NoError(t, err)
		replay, err := io.ReadAll(rc)
		require.NoError(t, err)
		require.NoError(t, rc.Close())
		require.Equal(t, payload, replay, "replay %d must equal the original payload", i+1)
	}
}

func TestNewOutboundJSONBody_GetBodyAfterPartialRead(t *testing.T) {
	t.Parallel()

	payload := []byte(`{"model":"test-model","input":"0123456789"}`)

	body, _, getBody, closer, err := NewOutboundJSONBody(payload)
	require.NoError(t, err)
	defer closer.Close()

	// Simulate an aborted first attempt that only wrote part of the body.
	partial := make([]byte, 10)
	_, err = io.ReadFull(body, partial)
	require.NoError(t, err)

	rc, err := getBody()
	require.NoError(t, err)
	replay, err := io.ReadAll(rc)
	require.NoError(t, err)
	require.Equal(t, payload, replay)

	// Closing the replayed body must not close the underlying storage: the
	// handler owns the storage lifetime via the returned closer.
	require.NoError(t, rc.Close())
	rc2, err := getBody()
	require.NoError(t, err)
	replay2, err := io.ReadAll(rc2)
	require.NoError(t, err)
	require.Equal(t, payload, replay2)
}
