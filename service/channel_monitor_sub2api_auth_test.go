package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func resetSub2APIAccountTokenCache(t *testing.T) {
	t.Helper()
	reset := func() {
		sub2APIAccountTokenCache.Lock()
		sub2APIAccountTokenCache.tokens = make(map[[32]byte]sub2APIAccountTokenCacheEntry)
		sub2APIAccountTokenCache.pending = make(map[[32]byte]*sub2APIAccountTokenCall)
		sub2APIAccountTokenCache.Unlock()
	}
	reset()
	t.Cleanup(reset)
}

func TestFetchSub2APIAccountLogsInAndCachesToken(t *testing.T) {
	resetSub2APIAccountTokenCache(t)
	var loginRequests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v1/auth/login":
			loginRequests.Add(1)
			var request sub2APIAccountLoginRequest
			require.NoError(t, common.DecodeJson(r.Body, &request))
			assert.Equal(t, "monitor@example.com", request.Email)
			assert.Equal(t, "secret-password", request.Password)
			assert.Empty(t, request.TurnstileToken)
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"access_token":"auto-jwt","expires_in":3600,"token_type":"Bearer"}}`))
		case "/api/v1/groups/available":
			assert.Equal(t, "Bearer auto-jwt", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":[{"id":7,"name":"vip","rate_multiplier":1.25}]}`))
		case "/api/v1/groups/rates":
			assert.Equal(t, "Bearer auto-jwt", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"7":1.75}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	config := Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    Sub2APIAuthAccount,
		Account:     "monitor@example.com",
		Password:    "secret-password",
		SkipBalance: true,
	}
	for range 2 {
		result, err := fetchSub2APIGroupRatio(context.Background(), server.Client(), config, nil)
		require.NoError(t, err)
		assert.InDelta(t, 1.75, result.Ratio, 1e-9)
	}
	assert.EqualValues(t, 1, loginRequests.Load())
}

func TestFetchSub2APIAccountRefreshesRejectedCachedToken(t *testing.T) {
	resetSub2APIAccountTokenCache(t)
	var loginRequests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v1/auth/login":
			token := "expired-jwt"
			if loginRequests.Add(1) == 2 {
				token = "fresh-jwt"
			}
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"access_token":"` + token + `","expires_in":3600}}`))
		case "/api/v1/groups/available":
			if r.Header.Get("Authorization") == "Bearer expired-jwt" {
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"code":401,"message":"token expired","data":null}`))
				return
			}
			assert.Equal(t, "Bearer fresh-jwt", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":[{"id":7,"name":"vip","rate_multiplier":1.5}]}`))
		case "/api/v1/groups/rates":
			assert.Equal(t, "Bearer fresh-jwt", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result, err := fetchSub2APIGroupRatio(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    Sub2APIAuthAccount,
		Account:     "monitor@example.com",
		Password:    "secret-password",
		SkipBalance: true,
	}, nil)
	require.NoError(t, err)
	assert.InDelta(t, 1.5, result.Ratio, 1e-9)
	assert.EqualValues(t, 2, loginRequests.Load())
}

func TestFetchSub2APIAccountExplainsInteractiveLoginBlockers(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		body       string
		contains   string
	}{
		{
			name:       "turnstile",
			statusCode: http.StatusBadRequest,
			body:       `{"code":400,"message":"turnstile verification failed","reason":"TURNSTILE_VERIFICATION_FAILED"}`,
			contains:   "Turnstile",
		},
		{
			name:       "totp",
			statusCode: http.StatusOK,
			body:       `{"code":0,"message":"success","data":{"requires_2fa":true,"temp_token":"temporary"}}`,
			contains:   "TOTP",
		},
		{
			name:       "cloudflare challenge",
			statusCode: http.StatusServiceUnavailable,
			body:       `<html>cloudflare challenge</html>`,
			contains:   "Cloudflare",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resetSub2APIAccountTokenCache(t)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/api/v1/auth/login" {
					http.NotFound(w, r)
					return
				}
				if test.name == "cloudflare challenge" {
					w.Header().Set("cf-mitigated", "challenge")
				}
				w.WriteHeader(test.statusCode)
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()

			_, err := fetchSub2APIGroupRatio(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
				BaseURL:     server.URL,
				Group:       "vip",
				AuthType:    Sub2APIAuthAccount,
				Account:     "monitor@example.com",
				Password:    "secret-password",
				SkipBalance: true,
			}, nil)
			require.Error(t, err)
			assert.ErrorIs(t, err, ErrChannelMonitorUpstreamAuthentication)
			assert.True(t, strings.Contains(err.Error(), test.contains), err.Error())
			assert.NotContains(t, err.Error(), "secret-password")
		})
	}
}
