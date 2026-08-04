package middleware

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func tokenConcurrencyTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	addr := os.Getenv("TOKEN_CONCURRENCY_TEST_REDIS_ADDR")
	if addr == "" {
		t.Skip("TOKEN_CONCURRENCY_TEST_REDIS_ADDR is required for Redis-backed concurrency tests")
	}
	rdb := redis.NewClient(&redis.Options{Addr: addr})
	require.NoError(t, rdb.Ping(context.Background()).Err())
	t.Cleanup(func() { _ = rdb.Close() })
	return rdb
}

func setTokenConcurrencyTestPolicy(t *testing.T, limits string) {
	t.Helper()
	t.Setenv("TOKEN_CONCURRENCY_ENABLED", "true")
	t.Setenv("TOKEN_CONCURRENCY_LIMITS", limits)
	t.Setenv("TOKEN_CONCURRENCY_LEASE_TTL_SECONDS", "30")
}

func testTokenContext(tokenID int, group string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("token_id", tokenID)
		common.SetContextKey(c, constant.ContextKeyTokenGroup, group)
		common.SetContextKey(c, constant.ContextKeyUsingGroup, group)
		c.Next()
	}
}

type httpResult struct {
	status int
	body   string
}

func postTestRequest(t *testing.T, client *http.Client, url string) <-chan httpResult {
	t.Helper()
	result := make(chan httpResult, 1)
	go func() {
		request, err := http.NewRequest(http.MethodPost, url, strings.NewReader(`{"model":"test"}`))
		if err != nil {
			result <- httpResult{}
			return
		}
		request.Header.Set("Content-Type", "application/json")
		response, err := client.Do(request)
		if err != nil {
			result <- httpResult{}
			return
		}
		defer response.Body.Close()
		body, _ := io.ReadAll(response.Body)
		result <- httpResult{status: response.StatusCode, body: string(body)}
	}()
	return result
}

func waitForTestSignal(t *testing.T, signal <-chan struct{}) {
	t.Helper()
	select {
	case <-signal:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for handler signal")
	}
}

func TestTokenConcurrencyLimitOneRealHTTPAcrossRedisClients(t *testing.T) {
	redisOne := tokenConcurrencyTestRedis(t)
	redisTwo := redis.NewClient(&redis.Options{Addr: os.Getenv("TOKEN_CONCURRENCY_TEST_REDIS_ADDR")})
	require.NoError(t, redisTwo.Ping(context.Background()).Err())
	t.Cleanup(func() { _ = redisTwo.Close() })
	setTokenConcurrencyTestPolicy(t, "real-http-limit-one=1")

	const tokenID = 910001
	const group = "real-http-limit-one"
	key := tokenConcurrencyKey(tokenID, group)
	t.Cleanup(func() { _ = redisOne.Del(context.Background(), key).Err() })

	gin.SetMode(gin.TestMode)
	entered := make(chan struct{}, 1)
	release := make(chan struct{}, 1)
	var calls int32
	newServer := func(rdb *redis.Client) *httptest.Server {
		router := gin.New()
		router.POST("/relay", testTokenContext(tokenID, group), TokenConcurrencyGateWithRedis(rdb), func(c *gin.Context) {
			if atomic.AddInt32(&calls, 1) == 1 {
				entered <- struct{}{}
				<-release
			}
			c.Status(http.StatusOK)
		})
		return httptest.NewServer(router)
	}
	serverOne := newServer(redisOne)
	serverTwo := newServer(redisTwo)
	defer serverOne.Close()
	defer serverTwo.Close()
	client := &http.Client{Timeout: 3 * time.Second}

	first := postTestRequest(t, client, serverOne.URL+"/relay")
	waitForTestSignal(t, entered)
	second := postTestRequest(t, client, serverTwo.URL+"/relay")
	secondResult := <-second
	require.Equal(t, http.StatusTooManyRequests, secondResult.status)
	require.Contains(t, secondResult.body, "token_concurrency_limit_reached")

	release <- struct{}{}
	require.Equal(t, http.StatusOK, (<-first).status)
	third := postTestRequest(t, client, serverTwo.URL+"/relay")
	require.Equal(t, http.StatusOK, (<-third).status, "release must allow the next real HTTP request")
	require.Equal(t, int32(2), atomic.LoadInt32(&calls))
}

func TestTokenConcurrencyRunsAfterRealTokenAuthContext(t *testing.T) {
	rdb := tokenConcurrencyTestRedis(t)
	setTokenConcurrencyTestPolicy(t, "default=1")
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "false")
	require.NoError(t, model.DB.Create(&model.User{
		Id: 11, Username: "token-concurrency-auth-user", Password: "password", Group: "default",
		AffCode: "token-concurrency-auth-aff", Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		Id: 11, UserId: 11, Key: "tokenauthconcurrency", Status: common.TokenStatusEnabled,
		UnlimitedQuota: true, ExpiredTime: -1, Group: "default",
	}).Error)
	key := tokenConcurrencyKey(11, "default")
	t.Cleanup(func() { _ = rdb.Del(context.Background(), key).Err() })

	gin.SetMode(gin.TestMode)
	entered := make(chan struct{}, 1)
	release := make(chan struct{}, 1)
	router := gin.New()
	router.POST("/relay", TokenAuth(), TokenConcurrencyGateWithRedis(rdb), func(c *gin.Context) {
		entered <- struct{}{}
		<-release
		c.Status(http.StatusOK)
	})
	server := httptest.NewServer(router)
	defer server.Close()
	client := &http.Client{Timeout: 3 * time.Second}
	requestURL := server.URL + "/relay"
	request := func() <-chan httpResult {
		result := make(chan httpResult, 1)
		go func() {
			req, err := http.NewRequest(http.MethodPost, requestURL, nil)
			if err != nil {
				result <- httpResult{}
				return
			}
			req.Header.Set("Authorization", "Bearer sk-tokenauthconcurrency")
			response, err := client.Do(req)
			if err != nil {
				result <- httpResult{}
				return
			}
			defer response.Body.Close()
			body, _ := io.ReadAll(response.Body)
			result <- httpResult{status: response.StatusCode, body: string(body)}
		}()
		return result
	}

	first := request()
	waitForTestSignal(t, entered)
	second := request()
	require.Equal(t, http.StatusTooManyRequests, (<-second).status)
	release <- struct{}{}
	require.Equal(t, http.StatusOK, (<-first).status)
}

func TestTokenConcurrencySeparatesTokenAndGroupKeys(t *testing.T) {
	rdb := tokenConcurrencyTestRedis(t)
	setTokenConcurrencyTestPolicy(t, "key-isolation=1")
	keys := []string{tokenConcurrencyKey(910002, "key-isolation"), tokenConcurrencyKey(910003, "key-isolation"), tokenConcurrencyKey(910002, "other-group")}
	t.Cleanup(func() { _ = rdb.Del(context.Background(), keys...).Err() })

	require.NoError(t, acquireTokenConcurrency(context.Background(), rdb, keys[0], "lease-1", 1, time.Minute))
	require.NoError(t, acquireTokenConcurrency(context.Background(), rdb, keys[1], "lease-2", 1, time.Minute), "different token must not share a lease")
	require.NoError(t, acquireTokenConcurrency(context.Background(), rdb, keys[2], "lease-3", 1, time.Minute), "different group must not share a lease")
	require.ErrorIs(t, acquireTokenConcurrency(context.Background(), rdb, keys[0], "lease-4", 1, time.Minute), errTokenConcurrencyLimit)
	require.NoError(t, releaseTokenConcurrency(context.Background(), rdb, keys[0], "lease-1"))
	require.NoError(t, acquireTokenConcurrency(context.Background(), rdb, keys[0], "lease-5", 1, time.Minute))
}

func TestTokenConcurrencyRedisFailureOnlyBlocksConfiguredGroup(t *testing.T) {
	setTokenConcurrencyTestPolicy(t, "restricted-group=1")
	gin.SetMode(gin.TestMode)
	makeServer := func(group string) *httptest.Server {
		router := gin.New()
		router.POST("/relay", testTokenContext(910004, group), TokenConcurrencyGateWithRedis(nil), func(c *gin.Context) {
			c.Status(http.StatusOK)
		})
		return httptest.NewServer(router)
	}
	restricted := makeServer("restricted-group")
	unconfigured := makeServer("legacy-group")
	defer restricted.Close()
	defer unconfigured.Close()

	client := &http.Client{Timeout: 2 * time.Second}
	require.Equal(t, http.StatusServiceUnavailable, (<-postTestRequest(t, client, restricted.URL+"/relay")).status)
	require.Equal(t, http.StatusOK, (<-postTestRequest(t, client, unconfigured.URL+"/relay")).status)
}

func TestTokenConcurrencyDefaultsOffAndPreservesUnconfiguredBehavior(t *testing.T) {
	t.Setenv("TOKEN_CONCURRENCY_ENABLED", "")
	t.Setenv("TOKEN_CONCURRENCY_LIMITS", "default=1")
	t.Setenv("TOKEN_CONCURRENCY_LEASE_TTL_SECONDS", "")
	router := gin.New()
	router.POST("/relay", testTokenContext(910009, "default"), TokenConcurrencyGateWithRedis(nil), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	server := httptest.NewServer(router)
	defer server.Close()
	require.Equal(t, http.StatusOK, (<-postTestRequest(t, &http.Client{Timeout: 2 * time.Second}, server.URL+"/relay")).status)
}

func TestTokenConcurrencyLeaseTTLRecoversUnreleasedProcess(t *testing.T) {
	rdb := tokenConcurrencyTestRedis(t)
	key := tokenConcurrencyKey(910005, "ttl-recovery")
	t.Cleanup(func() { _ = rdb.Del(context.Background(), key).Err() })
	require.NoError(t, acquireTokenConcurrency(context.Background(), rdb, key, "crashed-lease", 1, 100*time.Millisecond))
	require.Eventually(t, func() bool {
		return acquireTokenConcurrency(context.Background(), rdb, key, "recovered-lease", 1, time.Second) == nil
	}, 2*time.Second, 20*time.Millisecond)
	require.NoError(t, releaseTokenConcurrency(context.Background(), rdb, key, "recovered-lease"))
}

func TestTokenConcurrencyHeartbeatKeepsLongHTTPLease(t *testing.T) {
	rdb := tokenConcurrencyTestRedis(t)
	t.Setenv("TOKEN_CONCURRENCY_ENABLED", "true")
	t.Setenv("TOKEN_CONCURRENCY_LIMITS", "long-http=1")
	t.Setenv("TOKEN_CONCURRENCY_LEASE_TTL_SECONDS", "1")
	key := tokenConcurrencyKey(910010, "long-http")
	t.Cleanup(func() { _ = rdb.Del(context.Background(), key).Err() })

	gin.SetMode(gin.TestMode)
	entered := make(chan struct{}, 1)
	release := make(chan struct{}, 1)
	router := gin.New()
	router.POST("/relay", testTokenContext(910010, "long-http"), TokenConcurrencyGateWithRedis(rdb), func(c *gin.Context) {
		entered <- struct{}{}
		<-release
		c.Status(http.StatusOK)
	})
	server := httptest.NewServer(router)
	defer server.Close()
	client := &http.Client{Timeout: 5 * time.Second}
	first := postTestRequest(t, client, server.URL+"/relay")
	waitForTestSignal(t, entered)
	time.Sleep(1500 * time.Millisecond)
	second := postTestRequest(t, client, server.URL+"/relay")
	require.Equal(t, http.StatusTooManyRequests, (<-second).status, "heartbeat must retain a live long-running HTTP lease")
	release <- struct{}{}
	require.Equal(t, http.StatusOK, (<-first).status)
}

func TestTokenConcurrencyReleasesAfterHTTP4xx5xxCancelAndPanic(t *testing.T) {
	rdb := tokenConcurrencyTestRedis(t)
	setTokenConcurrencyTestPolicy(t, "lifecycle-group=1")
	client := &http.Client{Timeout: 3 * time.Second}

	for _, testCase := range []struct {
		name   string
		status int
		handle func(*gin.Context)
	}{
		{name: "4xx", status: http.StatusBadRequest, handle: func(c *gin.Context) { c.Status(http.StatusBadRequest) }},
		{name: "5xx", status: http.StatusBadGateway, handle: func(c *gin.Context) { c.Status(http.StatusBadGateway) }},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			key := tokenConcurrencyKey(910006, "lifecycle-group")
			t.Cleanup(func() { _ = rdb.Del(context.Background(), key).Err() })
			router := gin.New()
			router.POST("/relay", testTokenContext(910006, "lifecycle-group"), TokenConcurrencyGateWithRedis(rdb), testCase.handle)
			server := httptest.NewServer(router)
			defer server.Close()
			require.Equal(t, testCase.status, (<-postTestRequest(t, client, server.URL+"/relay")).status)
			require.Equal(t, testCase.status, (<-postTestRequest(t, client, server.URL+"/relay")).status, "the same lease is released after an error response")
		})
	}

	t.Run("cancel", func(t *testing.T) {
		key := tokenConcurrencyKey(910007, "lifecycle-group")
		t.Cleanup(func() { _ = rdb.Del(context.Background(), key).Err() })
		router := gin.New()
		router.POST("/relay", testTokenContext(910007, "lifecycle-group"), TokenConcurrencyGateWithRedis(rdb), func(c *gin.Context) {
			select {
			case <-c.Request.Context().Done():
			case <-time.After(500 * time.Millisecond):
			}
			c.Status(499) // nginx-style client-closed status used only by this test handler
		})
		server := httptest.NewServer(router)
		defer server.Close()
		request, err := http.NewRequest(http.MethodPost, server.URL+"/relay", nil)
		require.NoError(t, err)
		request.Header.Set("Content-Type", "application/json")
		requestCtx, cancel := context.WithCancel(context.Background())
		request = request.WithContext(requestCtx)
		finished := make(chan error, 1)
		go func() {
			response, err := client.Do(request)
			if response != nil {
				_ = response.Body.Close()
			}
			finished <- err
		}()
		time.Sleep(50 * time.Millisecond)
		cancel()
		<-finished
		require.Equal(t, 499, (<-postTestRequest(t, client, server.URL+"/relay")).status, "cancellation must release the lease")
	})

	t.Run("panic", func(t *testing.T) {
		key := tokenConcurrencyKey(910008, "lifecycle-group")
		t.Cleanup(func() { _ = rdb.Del(context.Background(), key).Err() })
		router := gin.New()
		router.Use(gin.CustomRecoveryWithWriter(io.Discard, func(c *gin.Context, _ any) {
			c.AbortWithStatus(http.StatusInternalServerError)
		}))
		router.POST("/relay", testTokenContext(910008, "lifecycle-group"), TokenConcurrencyGateWithRedis(rdb), func(c *gin.Context) {
			panic("isolated panic")
		})
		server := httptest.NewServer(router)
		defer server.Close()
		require.Equal(t, http.StatusInternalServerError, (<-postTestRequest(t, client, server.URL+"/relay")).status)
		require.Equal(t, http.StatusInternalServerError, (<-postTestRequest(t, client, server.URL+"/relay")).status, "panic path must release the lease")
	})
}
