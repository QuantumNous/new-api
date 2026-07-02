package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestFetchChannelUpstreamModelIDs_JimengZhizinanUsesModelsEndpoint(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		require.Equal(t, http.MethodGet, r.Method)
		require.Equal(t, "/v1/models", r.URL.Path)
		require.Equal(t, "Bearer jimeng-session-id", r.Header.Get("Authorization"))

		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(`{
			"data": [
				{"id": "jimeng-video-3.0-fast", "object": "model", "owned_by": "jimeng-api"},
				{"id": "jimeng-image-4.5", "object": "model", "owned_by": "jimeng-api"},
				{"id": " jimeng-image-4.5 ", "object": "model", "owned_by": "jimeng-api"},
				{"id": "", "object": "model", "owned_by": "jimeng-api"}
			]
		}`))
		require.NoError(t, err)
	}))
	defer server.Close()

	channel := &model.Channel{
		Type:    constant.ChannelTypeJimengZhizinan,
		BaseURL: &server.URL,
		Key:     " jimeng-session-id \nsecond-key",
	}

	models, err := fetchChannelUpstreamModelIDs(channel)

	require.NoError(t, err)
	require.Equal(t, 1, requests)
	require.Equal(t, []string{"jimeng-video-3.0-fast", "jimeng-image-4.5"}, models)
}
