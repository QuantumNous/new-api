package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFetchGroupDataSupportsDirectHeartbeatURL(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/status-page/foxcode", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"publicGroupList": [
				{
					"id": 4,
					"name": "Claude Code 分组",
					"monitorList": [
						{"id": 2, "name": "Claude Code 官方专用线路", "type": "http"},
						{"id": 8, "name": "Codex 官方线路", "type": "http"}
					]
				}
			]
		}`))
	})
	mux.HandleFunc("/api/status-page/heartbeat/foxcode", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"heartbeatList": {
				"2": [{"status": 1, "time": "2026-05-23 05:39:40.128", "msg": "", "ping": 3960}],
				"8": [{"status": 0, "time": "2026-05-23 05:35:47.789", "msg": "", "ping": null}]
			},
			"uptimeList": {
				"2_24": 0.9876,
				"8_24": 0.9958
			}
		}`))
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	result := fetchGroupData(context.Background(), server.Client(), map[string]interface{}{
		"categoryName": "Foxcode",
		"url":          server.URL + "/api/status-page/heartbeat/foxcode",
	})

	require.Equal(t, "Foxcode", result.CategoryName)
	require.Len(t, result.Monitors, 2)
	require.Equal(t, "Claude Code 官方专用线路", result.Monitors[0].Name)
	require.Equal(t, "Claude Code 分组", result.Monitors[0].Group)
	require.Equal(t, 1, result.Monitors[0].Status)
	require.InDelta(t, 0.9876, result.Monitors[0].Uptime, 0.0001)
	require.Equal(t, "Codex 官方线路", result.Monitors[1].Name)
	require.Equal(t, 0, result.Monitors[1].Status)
}
