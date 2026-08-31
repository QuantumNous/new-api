package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestForwardedHeadersReachUpstream pins what makes this hop transparent to
// new-api's client-IP and origin handling. Both are 429 sources: new-api rate
// limits /api/user/login per client IP, and it derives the expected WebAuthn
// origin from X-Forwarded-Proto, so a proto downgraded to this hop's plain HTTP
// fails every passkey login and the retries hit that same per-IP limit.
func TestForwardedHeadersReachUpstream(t *testing.T) {
	cases := []struct {
		name          string
		inbound       map[string]string
		expectedFor   string
		expectedProto string
		expectedHost  string
	}{
		{
			name: "values from a TLS terminator survive the hop",
			inbound: map[string]string{
				"X-Forwarded-For":   "198.51.100.9",
				"X-Forwarded-Proto": "https",
				"X-Forwarded-Host":  "api.example.com",
			},
			expectedFor:   "198.51.100.9, 203.0.113.7",
			expectedProto: "https",
			expectedHost:  "api.example.com",
		},
		{
			name:          "a direct client gets this hop's own values",
			inbound:       nil,
			expectedFor:   "203.0.113.7",
			expectedProto: "http",
			expectedHost:  "newapi.example.com",
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			var received http.Header
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				received = r.Header.Clone()
			}))
			defer upstream.Close()

			store, err := NewStore(nil, StoreConfig{
				BufferSize:      1,
				BatchSize:       1,
				FlushIntervalMs: 1000,
				SpoolDir:        t.TempDir(),
			})
			require.NoError(t, err)
			proxy, err := NewProxy(&Config{Upstream: upstream.URL}, store, nil, nil)
			require.NoError(t, err)

			request := httptest.NewRequest(http.MethodGet, "http://newapi.example.com/api/user/self", nil)
			request.RemoteAddr = "203.0.113.7:41234"
			for name, value := range testCase.inbound {
				request.Header.Set(name, value)
			}
			proxy.ServeHTTP(httptest.NewRecorder(), request)

			require.NotNil(t, received)
			assert.Equal(t, testCase.expectedFor, received.Get("X-Forwarded-For"))
			assert.Equal(t, testCase.expectedProto, received.Get("X-Forwarded-Proto"))
			assert.Equal(t, testCase.expectedHost, received.Get("X-Forwarded-Host"))
		})
	}
}
