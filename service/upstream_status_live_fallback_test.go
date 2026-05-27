package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildPublicUpstreamStatusFallsBackToLiveProvidersWhenHistoryEmpty(t *testing.T) {
	setupUpstreamStatusTestDB(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": [],
			"groups": [{
				"provider": "Codex Pro",
				"provider_slug": "codex-pro",
				"current_status": 1,
				"layers": [{
					"model": "GPT 5.4",
					"request_model": "gpt-5.4",
					"current_status": {"status": 1, "latency": 1300, "timestamp": 1779441000},
					"timeline": [
						{"timestamp": 1779440700, "status": 1, "latency": 2200, "availability": 100}
					]
				}]
			}]
		}`))
	}))
	defer server.Close()

	originalProviderSource := upstreamStatusProviderSource
	upstreamStatusProviderSource = func() []UpstreamStatusProvider {
		return []UpstreamStatusProvider{
			{
				Name:        "ikun",
				DisplayName: "Ikun",
				Kind:        UpstreamStatusProviderKindIkun,
				StatusURL:   server.URL,
			},
		}
	}
	t.Cleanup(func() {
		upstreamStatusProviderSource = originalProviderSource
	})

	payload, err := BuildPublicUpstreamStatus(context.Background())

	require.NoError(t, err)
	require.True(t, payload.Success)
	require.Len(t, payload.Data, 1)
	require.Equal(t, "GPT 中转渠道", payload.Data[0].CategoryName)
	require.Len(t, payload.Data[0].Monitors, 1)
	require.Equal(t, "gpt-5.4", payload.Data[0].Monitors[0].Model)
}
