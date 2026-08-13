package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/require"
	"golang.org/x/sync/singleflight"
)

func resetCopilotTokenTestState(t *testing.T) {
	t.Helper()
	oldEndpoint := copilotTokenEndpoint
	oldSecret := common.SessionSecret
	oldRedisEnabled := common.RedisEnabled
	copilotTokenCacheOnce = sync.Once{}
	copilotTokenCache = nil
	copilotTokenGroup = singleflight.Group{}
	common.RedisEnabled = false
	common.SessionSecret = "copilot-test-cache-secret"
	InitHttpClient()
	t.Cleanup(func() {
		copilotTokenEndpoint = oldEndpoint
		common.SessionSecret = oldSecret
		common.RedisEnabled = oldRedisEnabled
		copilotTokenCacheOnce = sync.Once{}
		copilotTokenCache = nil
		copilotTokenGroup = singleflight.Group{}
	})
}

func TestResolveCopilotAccessTokenCachesAndDeduplicatesRefresh(t *testing.T) {
	resetCopilotTokenTestState(t)
	credential := "github-secret-credential"
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		require.Equal(t, "Bearer "+credential, r.Header.Get("Authorization"))
		time.Sleep(20 * time.Millisecond)
		_, _ = fmt.Fprintf(w, `{"token":"short-copilot-token","expires_at":%d}`, time.Now().Add(time.Hour).Unix())
	}))
	defer server.Close()
	copilotTokenEndpoint = server.URL

	const count = 12
	results := make(chan string, count)
	errs := make(chan error, count)
	var wg sync.WaitGroup
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			token, err := ResolveCopilotAccessToken(context.Background(), 112, 0, credential, "")
			results <- token
			errs <- err
		}()
	}
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	for token := range results {
		require.Equal(t, "short-copilot-token", token)
	}
	require.Equal(t, int32(1), requests.Load())

	token, err := ResolveCopilotAccessToken(context.Background(), 112, 0, credential, "")
	require.NoError(t, err)
	require.Equal(t, "short-copilot-token", token)
	require.Equal(t, int32(1), requests.Load())
	require.NotContains(t, copilotTokenCacheKey(112, 0, credential), credential)
}

func TestResolveCopilotAccessTokenSanitizesUpstreamError(t *testing.T) {
	resetCopilotTokenTestState(t)
	credential := "github-secret-credential"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte("credential=" + credential))
	}))
	defer server.Close()
	copilotTokenEndpoint = server.URL

	_, err := ResolveCopilotAccessToken(context.Background(), 112, 0, credential, "")
	require.Error(t, err)
	require.False(t, strings.Contains(err.Error(), credential))
	require.Equal(t, "copilot token exchange failed with status 401", err.Error())
}
