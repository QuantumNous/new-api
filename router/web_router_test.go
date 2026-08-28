package router

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseCloudflareWebAnalyticsHostTokens(t *testing.T) {
	hostTokens := ParseCloudflareWebAnalyticsHostTokens(
		"GPTTalkApp.com.=main-token, gpttalk.cc=mirror-token,invalid,missing-token=,=missing-host",
	)

	assert.Equal(t, map[string]string{
		"gpttalkapp.com": "main-token",
		"gpttalk.cc":     "mirror-token",
	}, hostTokens)
}

func TestCloudflareWebAnalyticsTokenForHost(t *testing.T) {
	hostTokens := map[string]string{
		"gpttalkapp.com":       "main-token",
		"admin.gpttalkapp.com": "admin-token",
		"gpttalk.cc":           "mirror-token",
	}

	tests := []struct {
		name        string
		requestHost string
		want        string
	}{
		{name: "exact host", requestHost: "gpttalkapp.com", want: "main-token"},
		{name: "host with port", requestHost: "gpttalk.cc:443", want: "mirror-token"},
		{name: "subdomain", requestHost: "www.gpttalkapp.com", want: "main-token"},
		{name: "most specific host", requestHost: "admin.gpttalkapp.com", want: "admin-token"},
		{name: "unconfigured host", requestHost: "example.com", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, cloudflareWebAnalyticsTokenForHost(tt.requestHost, "default-token", hostTokens))
		})
	}
}

func TestCloudflareWebAnalyticsTokenForHostUsesDefaultWithoutHostConfig(t *testing.T) {
	assert.Equal(t, "default-token", cloudflareWebAnalyticsTokenForHost("example.com", "default-token", nil))
}

func TestInjectCloudflareWebAnalytics(t *testing.T) {
	page := injectCloudflareWebAnalytics(
		[]byte("<body>\n<!--Cloudflare Web Analytics-->\n</body>"),
		"main-token",
	)

	assert.Contains(t, string(page), "https://static.cloudflareinsights.com/beacon.min.js")
	assert.Contains(t, string(page), `data-cf-beacon='{"token":"main-token"}'`)
	assert.NotContains(t, string(page), "<!--Cloudflare Web Analytics-->\n")
}

func TestInjectCloudflareWebAnalyticsWithoutToken(t *testing.T) {
	page := injectCloudflareWebAnalytics(
		[]byte("<body>\n<!--Cloudflare Web Analytics-->\n</body>"),
		"",
	)

	assert.NotContains(t, string(page), "beacon.min.js")
	assert.Contains(t, string(page), "<!--Cloudflare Web Analytics QuantumNous-->")
}
