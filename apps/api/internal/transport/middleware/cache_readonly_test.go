package middleware

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/testutil"
)

// countHandler writes the given status and body, counting invocations.
func countHandler(calls *int, status int, body string) contract.Handler {
	return func(c contract.Context) {
		*calls++
		_ = c.Data(status, "application/json; charset=utf-8", []byte(body))
	}
}

// A second GET must be served from the cache without running the handler, and
// the cached body must be the response byte-for-byte. A hit that writes without
// aborting would let the chain loop append the handler's body a second time,
// which is exactly what this pins.
func TestReadOnlyCacheServesSecondGetWithoutRunningHandler(t *testing.T) {
	calls := 0
	handler := countHandler(&calls, http.StatusOK, `{"ok":true}`)
	cache := ReadOnlyCache(ReadOnlyCacheConfig{Namespace: uniqueNamespace("test_ro_hit"), TTL: CacheTTLLong})

	first := testutil.ServeBufferedRoute(t, http.MethodGet, "/cached", []contract.Middleware{cache}, handler,
		httptest.NewRequest(http.MethodGet, "/cached", nil))
	body1 := readBody(t, first)

	second := testutil.ServeBufferedRoute(t, http.MethodGet, "/cached", []contract.Middleware{cache}, handler,
		httptest.NewRequest(http.MethodGet, "/cached", nil))
	body2 := readBody(t, second)

	require.Equal(t, 1, calls, "the handler must run only on the miss")
	assert.Equal(t, body1, body2, "a hit must replay exactly the stored body")
	assert.Equal(t, http.StatusOK, second.StatusCode)
}

// A non-GET request is never served from or stored into the cache.
func TestReadOnlyCachePassesThroughNonGet(t *testing.T) {
	calls := 0
	handler := countHandler(&calls, http.StatusOK, `{"ok":true}`)
	cache := ReadOnlyCache(ReadOnlyCacheConfig{Namespace: uniqueNamespace("test_ro_post"), TTL: CacheTTLLong})

	for range 2 {
		testutil.ServeBufferedRoute(t, http.MethodPost, "/write", []contract.Middleware{cache}, handler,
			httptest.NewRequest(http.MethodPost, "/write", nil))
	}

	assert.Equal(t, 2, calls, "a write must reach the handler every time")
}

// A non-200 response is not cacheable: the next request must reach the handler.
func TestReadOnlyCacheSkipsNonOK(t *testing.T) {
	calls := 0
	handler := countHandler(&calls, http.StatusBadRequest, `{"error":"nope"}`)
	cache := ReadOnlyCache(ReadOnlyCacheConfig{Namespace: uniqueNamespace("test_ro_error"), TTL: CacheTTLLong})

	for range 2 {
		resp := testutil.ServeBufferedRoute(t, http.MethodGet, "/err", []contract.Middleware{cache}, handler,
			httptest.NewRequest(http.MethodGet, "/err", nil))
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	}

	assert.Equal(t, 2, calls, "an error response must not be cached")
}

// Two spellings of one logical request must share an entry: the key drops a
// trailing slash and sorts the query, so the handler runs once for both.
func TestReadOnlyCacheKeyIsCanonical(t *testing.T) {
	calls := 0
	handler := countHandler(&calls, http.StatusOK, `{"ok":true}`)
	cache := ReadOnlyCache(ReadOnlyCacheConfig{Namespace: uniqueNamespace("test_ro_key"), TTL: CacheTTLLong, Params: []string{"a", "b"}})

	testutil.ServeBufferedRoute(t, http.MethodGet, "/canon/", []contract.Middleware{cache}, handler,
		httptest.NewRequest(http.MethodGet, "/canon/?b=2&a=1", nil))
	testutil.ServeBufferedRoute(t, http.MethodGet, "/canon", []contract.Middleware{cache}, handler,
		httptest.NewRequest(http.MethodGet, "/canon?a=1&b=2", nil))

	assert.Equal(t, 1, calls, "a trailing slash and query order must not split the entry")
}

// Concurrent cache misses for the same key must run the handler exactly once
// and every caller must replay the same body. The handler blocks on a channel
// until every goroutine is in flight, so the test is deterministic rather than
// timing-based.
func TestReadOnlyCacheSingleflightConcurrentMissesRunHandlerOnce(t *testing.T) {
	const n = 10
	calls := 0

	started := make(chan struct{}, n)
	leaderReady := make(chan struct{}, 1)
	release := make(chan struct{})

	handler := func(c contract.Context) {
		calls++
		leaderReady <- struct{}{} // leader is about to block on release
		<-release
		_ = c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(`{"ok":true}`))
	}
	cache := ReadOnlyCache(ReadOnlyCacheConfig{Namespace: uniqueNamespace("test_ro_singleflight"), TTL: CacheTTLLong})

	var wg sync.WaitGroup
	resps := make([]*http.Response, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			started <- struct{}{}
			resps[i] = testutil.ServeBufferedRoute(t, http.MethodGet, "/sf", []contract.Middleware{cache}, handler,
				httptest.NewRequest(http.MethodGet, "/sf", nil))
		}(i)
	}

	// Wait until every goroutine is in flight inside the route and the leader
	// is blocked inside the handler, then release them all at once.
	for range n {
		<-started
	}
	<-leaderReady
	close(release)

	wg.Wait()

	assert.Equal(t, 1, calls, "concurrent misses for the same key must run the handler once")
	require.Len(t, resps, n)
	for i, resp := range resps {
		require.Equal(t, http.StatusOK, resp.StatusCode, "request %d must be served", i)
		assert.Equal(t, `{"ok":true}`, readBody(t, resp), "every caller must replay the leader's body")
	}
}

// Query allowlist: requests carrying an unlisted parameter are served but never
// cached (always reach the handler). Requests with only allowlisted parameters
// are cached. An empty Params means the endpoint takes no query parameters,
// so any query string is served but not cached.
func TestReadOnlyCacheAllowlist(t *testing.T) {
	calls := 0
	handler := countHandler(&calls, http.StatusOK, `{"ok":true}`)

	// Endpoint allows only "a".
	cache := ReadOnlyCache(ReadOnlyCacheConfig{Namespace: uniqueNamespace("test_ro_allow"), TTL: CacheTTLLong, Params: []string{"a"}})

	// Unlisted param "z": served, never cached -> handler runs every time.
	testutil.ServeBufferedRoute(t, http.MethodGet, "/x", []contract.Middleware{cache}, handler,
		httptest.NewRequest(http.MethodGet, "/x?a=1&z=2", nil))
	testutil.ServeBufferedRoute(t, http.MethodGet, "/x", []contract.Middleware{cache}, handler,
		httptest.NewRequest(http.MethodGet, "/x?a=1&z=2", nil))
	assert.Equal(t, 2, calls, "an unlisted parameter must not be cached")

	// Allowlisted param only: cached -> handler runs once.
	testutil.ServeBufferedRoute(t, http.MethodGet, "/x", []contract.Middleware{cache}, handler,
		httptest.NewRequest(http.MethodGet, "/x?a=1", nil))
	testutil.ServeBufferedRoute(t, http.MethodGet, "/x", []contract.Middleware{cache}, handler,
		httptest.NewRequest(http.MethodGet, "/x?a=1", nil))
	assert.Equal(t, 3, calls, "allowlisted parameters must be cached")

	// Empty Params means the endpoint takes no query parameters: any query is
	// served but not cached.
	noParam := ReadOnlyCache(ReadOnlyCacheConfig{Namespace: uniqueNamespace("test_ro_noparams"), TTL: CacheTTLLong})
	testutil.ServeBufferedRoute(t, http.MethodGet, "/m", []contract.Middleware{noParam}, handler,
		httptest.NewRequest(http.MethodGet, "/m?foo=1", nil))
	testutil.ServeBufferedRoute(t, http.MethodGet, "/m", []contract.Middleware{noParam}, handler,
		httptest.NewRequest(http.MethodGet, "/m?foo=1", nil))
	assert.Equal(t, 5, calls, "empty Params with any query must not be cached")

	// Empty Params with no query: cached.
	testutil.ServeBufferedRoute(t, http.MethodGet, "/m", []contract.Middleware{noParam}, handler,
		httptest.NewRequest(http.MethodGet, "/m", nil))
	testutil.ServeBufferedRoute(t, http.MethodGet, "/m", []contract.Middleware{noParam}, handler,
		httptest.NewRequest(http.MethodGet, "/m", nil))
	assert.Equal(t, 6, calls, "empty Params with no query must be cached")
}

// When the leader's handler produces nothing cacheable (non-200), followers
// must fall through and run their own handler, not write nothing.
func TestReadOnlyCacheLeaderFailureFollowersRunHandler(t *testing.T) {
	const n = 5
	var calls atomic.Int64

	started := make(chan struct{}, n)
	leaderReady := make(chan struct{}, 1)
	release := make(chan struct{})

	handler := func(c contract.Context) {
		calls.Add(1)
		// Non-blocking: every follower runs this handler too once the leader
		// produced nothing cacheable, and a second blocking send would park
		// them until the app.Test timeout.
		select {
		case leaderReady <- struct{}{}:
		default:
		}
		<-release
		_ = c.Data(http.StatusBadRequest, "application/json; charset=utf-8", []byte(`{"error":"nope"}`))
	}
	cache := ReadOnlyCache(ReadOnlyCacheConfig{Namespace: uniqueNamespace("test_ro_leaderfail"), TTL: CacheTTLLong})

	var wg sync.WaitGroup
	resps := make([]*http.Response, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			started <- struct{}{}
			resps[i] = testutil.ServeBufferedRoute(t, http.MethodGet, "/lf", []contract.Middleware{cache}, handler,
				httptest.NewRequest(http.MethodGet, "/lf", nil))
		}(i)
	}

	for range n {
		<-started
	}
	<-leaderReady
	close(release)

	wg.Wait()

	assert.Equal(t, int64(n), calls.Load(), "when the leader produces nothing cacheable every follower must run its own handler")
	for i, resp := range resps {
		require.NotNil(t, resp, "request %d must produce a response", i)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "request %d must be served", i)
	}
}

// uniqueNamespace keeps a cached entry from leaking between runs of the same
// test, which would make -count=N see a hit on its first request.
func uniqueNamespace(base string) string {
	return base + ":" + strconv.FormatInt(time.Now().UnixNano(), 10)
}

func readBody(t *testing.T, resp *http.Response) string {
	t.Helper()
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return string(body)
}
