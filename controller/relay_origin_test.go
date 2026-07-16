package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestRealtimeWebSocketOriginAllowed(t *testing.T) {
	originalDomains := append([]string(nil), constant.TrustedRedirectDomains...)
	constant.TrustedRedirectDomains = []string{"example.com"}
	t.Cleanup(func() {
		constant.TrustedRedirectDomains = originalDomains
	})

	tests := []struct {
		name   string
		origin string
		host   string
		want   bool
	}{
		{name: "missing origin", host: "api.internal", want: true},
		{name: "same origin", origin: "https://api.internal", host: "api.internal", want: true},
		{name: "trusted exact domain", origin: "https://example.com", host: "api.internal", want: true},
		{name: "trusted subdomain", origin: "https://console.example.com", host: "api.internal", want: true},
		{name: "untrusted domain", origin: "https://evil.example.net", host: "api.internal", want: false},
		{name: "suffix spoof", origin: "https://fakeexample.com", host: "api.internal", want: false},
		{name: "invalid scheme", origin: "file://example.com", host: "api.internal", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "https://"+tt.host+"/v1/realtime", nil)
			if tt.origin != "" {
				request.Header.Set("Origin", tt.origin)
			}
			require.Equal(t, tt.want, isRealtimeWebSocketOriginAllowed(request))
		})
	}
}
