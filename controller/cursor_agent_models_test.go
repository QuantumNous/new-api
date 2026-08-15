package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestFetchCursorAgentModelsUsesResolvedSidecarAndParsedCredential(t *testing.T) {
	const apiKey = "cursor_test_model_key"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/models", r.URL.Path)
		require.Equal(t, "Bearer "+apiKey, r.Header.Get("Authorization"))
		require.Equal(t, apiKey, r.Header.Get("x-api-key"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"claude-sonnet-4-6"},{"id":"grok-4.6"}]}`))
	}))
	defer server.Close()
	t.Setenv("CURSOR_AGENT_SIDECAR_BASE_URL", server.URL)

	channel := &model.Channel{
		Type:    constant.ChannelTypeCursorAgent,
		Key:     `{"api_key":"` + apiKey + `"}`,
		BaseURL: common.GetPointer("http://ignored.invalid"),
	}
	models, err := fetchChannelUpstreamModelIDs(channel)

	require.NoError(t, err)
	require.ElementsMatch(t, []string{"claude-sonnet-4-6", "grok-4.6"}, models)
}
