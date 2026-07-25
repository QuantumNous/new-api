package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

func allowPrivateCodexModelFetch(t *testing.T) {
	t.Helper()
	setting := system_setting.GetFetchSetting()
	original := *setting
	setting.EnableSSRFProtection = false
	t.Cleanup(func() { *setting = original })
}

func TestFetchCodexModelsBuildsAuthenticatedRequestAndDeduplicates(t *testing.T) {
	allowPrivateCodexModelFetch(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/backend-api/codex/models", r.URL.Path)
		require.Equal(t, "0.144.6", r.URL.Query().Get("client_version"))
		require.Equal(t, "Bearer access-token", r.Header.Get("Authorization"))
		require.Equal(t, "account-id", r.Header.Get("ChatGPT-Account-Id"))
		require.Equal(t, "codex-cli/0.144.6", r.Header.Get("User-Agent"))
		require.Equal(t, "application/json", r.Header.Get("Accept"))
		_, _ = w.Write([]byte(`{"models":[{"slug":"gpt-5.6-sol"},{"slug":" gpt-5.6-terra "},{"slug":"gpt-5.6-sol"},{"slug":""}]}`))
	}))
	defer server.Close()

	status, models, err := FetchCodexModels(
		context.Background(),
		server.Client(),
		server.URL+"/",
		&CodexOAuthKey{AccessToken: "access-token", AccountID: "account-id"},
		"0.144.6",
	)

	require.NoError(t, err)
	require.Equal(t, http.StatusOK, status)
	require.Equal(t, []string{"gpt-5.6-sol", "gpt-5.6-terra"}, models)
}

func TestFetchCodexModelsReturnsUnauthorizedWithoutParsingBody(t *testing.T) {
	allowPrivateCodexModelFetch(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`not-json`))
	}))
	defer server.Close()

	status, models, err := FetchCodexModels(
		context.Background(),
		server.Client(),
		server.URL,
		&CodexOAuthKey{AccessToken: "access-token", AccountID: "account-id"},
		"0.144.6",
	)

	require.NoError(t, err)
	require.Equal(t, http.StatusUnauthorized, status)
	require.Nil(t, models)
}

func TestFetchCodexModelsRejectsDisallowedPrivateURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Fatal("request must be rejected before credentials are sent")
	}))
	defer server.Close()

	setting := system_setting.GetFetchSetting()
	original := *setting
	setting.EnableSSRFProtection = true
	setting.AllowPrivateIp = false
	setting.AllowedPorts = []string{"1-65535"}
	t.Cleanup(func() { *setting = original })

	status, models, err := FetchCodexModels(
		context.Background(),
		server.Client(),
		server.URL,
		&CodexOAuthKey{AccessToken: "access-token", AccountID: "account-id"},
		"0.144.6",
	)

	require.ErrorContains(t, err, "codex models URL rejected")
	require.Zero(t, status)
	require.Nil(t, models)
}

func TestFetchCodexModelsRejectsOversizedResponse(t *testing.T) {
	allowPrivateCodexModelFetch(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"models":[],"padding":"`))
		_, _ = w.Write([]byte(strings.Repeat("x", codexModelsResponseMaxBytes)))
		_, _ = w.Write([]byte(`"}`))
	}))
	defer server.Close()

	status, models, err := FetchCodexModels(
		context.Background(),
		server.Client(),
		server.URL,
		&CodexOAuthKey{AccessToken: "access-token", AccountID: "account-id"},
		"0.144.6",
	)

	require.ErrorContains(t, err, "codex models response exceeds")
	require.Equal(t, http.StatusOK, status)
	require.Nil(t, models)
}

func TestCodexClientVersionCacheUsesCachedVersion(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requestCount++
		_, _ = w.Write([]byte(`{"name":"0.144.6","draft":false,"prerelease":false}`))
	}))
	defer server.Close()

	now := time.Date(2026, time.July, 20, 12, 0, 0, 0, time.UTC)
	cache := codexClientVersionCache{}
	first, err := cache.get(context.Background(), server.Client(), server.URL, now)
	require.NoError(t, err)
	second, err := cache.get(context.Background(), server.Client(), server.URL, now.Add(30*time.Minute))
	require.NoError(t, err)

	require.Equal(t, "0.144.6", first)
	require.Equal(t, first, second)
	require.Equal(t, 1, requestCount)
}

func TestCodexClientVersionCacheFallsBackToStaleVersion(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer server.Close()

	now := time.Date(2026, time.July, 20, 12, 0, 0, 0, time.UTC)
	cache := codexClientVersionCache{
		version:   "0.143.0",
		expiresAt: now.Add(-time.Minute),
	}
	version, err := cache.get(context.Background(), server.Client(), server.URL, now)

	require.NoError(t, err)
	require.Equal(t, "0.143.0", version)
	require.Equal(t, now.Add(codexClientVersionCacheTTL), cache.expiresAt)
}

func TestCodexClientVersionCacheTemporarilyCachesColdFailure(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requestCount++
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer server.Close()

	now := time.Date(2026, time.July, 20, 12, 0, 0, 0, time.UTC)
	cache := codexClientVersionCache{}
	_, firstErr := cache.get(context.Background(), server.Client(), server.URL, now)
	_, secondErr := cache.get(context.Background(), server.Client(), server.URL, now.Add(10*time.Second))

	require.Error(t, firstErr)
	require.EqualError(t, secondErr, firstErr.Error())
	require.Equal(t, 1, requestCount)
}

func TestCodexClientVersionCacheDoesNotHoldMutexDuringFetch(t *testing.T) {
	requestStarted := make(chan struct{})
	releaseRequest := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(requestStarted)
		<-releaseRequest
		_, _ = w.Write([]byte(`{"name":"0.144.6","draft":false,"prerelease":false}`))
	}))
	defer server.Close()

	cache := codexClientVersionCache{}
	done := make(chan error, 1)
	go func() {
		_, err := cache.get(context.Background(), server.Client(), server.URL, time.Now())
		done <- err
	}()

	<-requestStarted
	mutexAvailable := cache.TryLock()
	if mutexAvailable {
		cache.Unlock()
	}
	close(releaseRequest)
	require.True(t, mutexAvailable, "cache mutex must remain available during network I/O")
	require.NoError(t, <-done)
}
