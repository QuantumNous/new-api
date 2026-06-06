package conversationarchive

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResolveSessionID(t *testing.T) {
	require.Equal(t, "from-header", ResolveSessionID(" from-header ", []byte(`{"metadata":{"session_id":"from-meta"}}`), "fallback"))
	require.Equal(t, "from-meta", ResolveSessionID("", []byte(`{"metadata":{"session_id":"from-meta"}}`), "fallback"))
	require.Equal(t, "from-root", ResolveSessionID("", []byte(`{"session_id":"from-root"}`), "fallback"))
	require.Equal(t, "from-conversation", ResolveSessionID("", []byte(`{"conversation_id":"from-conversation"}`), "fallback"))
	require.Equal(t, "fallback", ResolveSessionID("", []byte(`{"metadata":{"session_id":123}}`), "fallback"))
}

func TestCompressBytesRoundTrip(t *testing.T) {
	origin := []byte(`{"model":"gpt-test","messages":[{"role":"user","content":"hello"}]}`)
	compressed, err := CompressBytes(origin)
	require.NoError(t, err)
	require.NotEmpty(t, compressed)

	decompressed, err := DecompressBytes(compressed)
	require.NoError(t, err)
	require.Equal(t, origin, decompressed)
}

func TestBodyForExport(t *testing.T) {
	jsonBody := bodyForExport([]byte(`{"ok":true}`))
	require.IsType(t, json.RawMessage{}, jsonBody)
	rendered, err := jsonBody.(json.RawMessage).MarshalJSON()
	require.NoError(t, err)
	require.Equal(t, []byte(`{"ok":true}`), rendered)

	streamBody := bodyForExport([]byte("data: {\"ok\":true}\n\n"))
	require.Equal(t, "data: {\"ok\":true}\n\n", streamBody)
}
