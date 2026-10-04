package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestNormalizeResponsesWebSocketEvent(t *testing.T) {
	body, model, streamID, err := normalizeResponsesWebSocketEvent([]byte(`{"type":"response.create","model":"gpt-6-astra","stream_id":"main","store":false,"max_output_tokens":0}`), true)
	require.NoError(t, err)
	require.Equal(t, "gpt-6-astra", model)
	require.Equal(t, "main", streamID)

	var normalized map[string]any
	require.NoError(t, common.Unmarshal(body, &normalized))
	require.NotContains(t, normalized, "type")
	require.NotContains(t, normalized, "stream_id")
	require.Equal(t, true, normalized["stream"])
	require.Equal(t, false, normalized["store"])
	require.Equal(t, float64(0), normalized["max_output_tokens"])
}

func TestNormalizeResponsesWebSocketEventRejectsInvalidStreamID(t *testing.T) {
	for _, event := range []string{
		`{"type":"response.create","model":"gpt-6-astra","stream_id":""}`,
		`{"type":"response.create","model":"gpt-6-astra","stream_id":"bad stream"}`,
	} {
		_, _, _, err := normalizeResponsesWebSocketEvent([]byte(event), true)
		require.Error(t, err)
	}
}

func TestNormalizeResponsesWebSocketEventRequiresModelOnFirstEvent(t *testing.T) {
	_, _, _, err := normalizeResponsesWebSocketEvent([]byte(`{"type":"response.create"}`), true)
	require.Error(t, err)

	_, model, _, err := normalizeResponsesWebSocketEvent([]byte(`{"type":"response.create"}`), false)
	require.NoError(t, err)
	require.Empty(t, model)
}

func TestIsXAIResponsesWebSocketModel(t *testing.T) {
	require.True(t, isXAIResponsesWebSocketModel("grok-4.6"))
	require.True(t, isXAIResponsesWebSocketModel(" GROK_4.3 "))
	require.False(t, isXAIResponsesWebSocketModel("gpt-6-astra"))
}

func TestCloneResponsesWebSocketHeadersRemovesUpgradeHeaders(t *testing.T) {
	source := make(http.Header)
	source.Set("Authorization", "Bearer token")
	source.Set("Sec-WebSocket-Key", "secret")
	source.Set("Sec-WebSocket-Protocol", "realtime")
	source.Set("X-Request-ID", "request")
	cloned := cloneResponsesWebSocketHeaders(source)
	require.Equal(t, "Bearer token", cloned.Get("Authorization"))
	require.Equal(t, "request", cloned.Get("X-Request-ID"))
	require.Empty(t, cloned.Get("Sec-WebSocket-Key"))
	require.Empty(t, cloned.Get("Sec-WebSocket-Protocol"))
}
