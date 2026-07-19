package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFetchSub2APIUpstreamVersionReadsPublicSettings(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodGet, r.Method)
		assert.Equal(t, channelMonitorSub2APIPublicSettingsEndpoint, r.URL.Path)
		assert.Empty(t, r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"version":"0.1.161"}}`))
	}))
	defer server.Close()

	fetchSetting := system_setting.GetFetchSetting()
	originalFetchSetting := *fetchSetting
	originalHTTPClient := httpClient
	originalProtectedHTTPClient := ssrfProtectedHTTPClient
	t.Cleanup(func() {
		*fetchSetting = originalFetchSetting
		httpClient = originalHTTPClient
		ssrfProtectedHTTPClient = originalProtectedHTTPClient
	})
	fetchSetting.EnableSSRFProtection = false
	httpClient = server.Client()

	result, err := FetchSub2APIUpstreamVersion(context.Background(), server.URL)
	require.NoError(t, err)
	assert.Equal(t, "0.1.161", result.Version)
	assert.Equal(t, channelMonitorSub2APIPublicSettingsEndpoint, result.Endpoint)
}
