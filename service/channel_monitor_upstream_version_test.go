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

	result, err := FetchSub2APIUpstreamVersion(context.Background(), server.URL, "")
	require.NoError(t, err)
	assert.Equal(t, "0.1.161", result.Version)
	assert.Equal(t, channelMonitorSub2APIPublicSettingsEndpoint, result.Endpoint)
}

func TestFetchSub2APIUpstreamVersionUsesChannelProxy(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	originalFetchSetting := *fetchSetting
	t.Cleanup(func() {
		*fetchSetting = originalFetchSetting
	})
	fetchSetting.EnableSSRFProtection = true
	fetchSetting.AllowPrivateIp = true
	fetchSetting.DomainFilterMode = false
	fetchSetting.IpFilterMode = false
	fetchSetting.DomainList = nil
	fetchSetting.IpList = nil
	fetchSetting.AllowedPorts = []string{"80"}
	fetchSetting.ApplyIPFilterForDomain = true
	ResetProxyClientCache()
	t.Cleanup(ResetProxyClientCache)

	proxyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "93.184.216.34", r.URL.Host)
		assert.Equal(t, channelMonitorSub2APIPublicSettingsEndpoint, r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"version":"0.1.162"}}`))
	}))
	defer proxyServer.Close()

	result, err := FetchSub2APIUpstreamVersion(
		context.Background(),
		"http://93.184.216.34",
		proxyServer.URL,
	)
	require.NoError(t, err)
	assert.Equal(t, "0.1.162", result.Version)
}
