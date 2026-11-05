package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useRateLimitMiniRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()

	previousRedisEnabled := common.RedisEnabled
	previousRedisClient := common.RDB
	redisServer := miniredis.RunT(t)
	redisClient := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	require.NoError(t, redisClient.Ping(context.Background()).Err())

	common.RedisEnabled = true
	common.RDB = redisClient
	t.Cleanup(func() {
		_ = redisClient.Close()
		common.RedisEnabled = previousRedisEnabled
		common.RDB = previousRedisClient
	})

	return redisServer, redisClient
}

// newRateLimitEngine builds an engine that trusts no proxy, so the peer address
// each case injects is authoritative and the per-IP keys under test are the ones
// the assertions name.
//
// It returns the fiber app alongside, because these cases vary the peer address
// per request and contract.Engine exposes no listener seam. See the fixture notes
// in trust_proxies_test.go for why the peer cannot come from app.Test.
func newRateLimitEngine(t *testing.T, register func(contract.Routes)) *fiber.App {
	t.Helper()

	server := fiberadapter.NewEngine(func(c contract.Context, recovered any) {
		c.AbortWithStatus(http.StatusInternalServerError)
	})
	require.NoError(t, server.TrustProxies(nil))
	register(server)
	return captureEngineApp(t, server)
}

func performRateLimitRequest(t *testing.T, app *fiber.App, path string, remoteAddr string) *http.Response {
	t.Helper()

	request := httptest.NewRequest(http.MethodGet, path, nil)
	return servePeerRequest(t, app, request, remoteAddr)
}

func TestRedisIPRateLimiterThresholdTTLAndNamespace(t *testing.T) {
	redisServer, _ := useRateLimitMiniRedis(t)

	app := newRateLimitEngine(t, func(router contract.Routes) {
		router.GET("/limited", rateLimitFactory(2, 37, "TEST"), func(c contract.Context) {
			c.Status(http.StatusNoContent)
		})
	})

	remoteAddr := "192.0.2.10:12345"
	legacyKey := "rateLimit:TEST192.0.2.10"
	_, err := redisServer.Push(legacyKey, "legacy-list-entry")
	require.NoError(t, err)
	assert.Equal(t, http.StatusNoContent, performRateLimitRequest(t, app, "/limited", remoteAddr).StatusCode)
	assert.Equal(t, http.StatusNoContent, performRateLimitRequest(t, app, "/limited", remoteAddr).StatusCode)
	limitedResponse := performRateLimitRequest(t, app, "/limited", remoteAddr)
	assert.Equal(t, http.StatusTooManyRequests, limitedResponse.StatusCode)
	assert.Equal(t, "37", limitedResponse.Header.Get("Retry-After"))

	key := redisIPRateLimitKey("TEST", "192.0.2.10")
	count, err := redisServer.Get(key)
	require.NoError(t, err)
	assert.Equal(t, "3", count)
	assert.Equal(t, 37*time.Second, redisServer.TTL(key))
	assert.True(t, redisServer.Exists(legacyKey), "the v2 counter must not touch an old list key")
}

func TestRedisUserRateLimiterUsesSharedFixedWindow(t *testing.T) {
	redisServer, _ := useRateLimitMiniRedis(t)

	app := newRateLimitEngine(t, func(router contract.Routes) {
		router.GET(
			"/limited",
			func(c contract.Context) { c.Set("id", 42) },
			userRateLimitFactory(1, 23, "USER"),
			func(c contract.Context) { c.Status(http.StatusNoContent) },
		)
	})

	assert.Equal(t, http.StatusNoContent, performRateLimitRequest(t, app, "/limited", "192.0.2.20:12345").StatusCode)
	assert.Equal(t, http.StatusTooManyRequests, performRateLimitRequest(t, app, "/limited", "198.51.100.20:12345").StatusCode)

	key := redisUserRateLimitKey("USER", 42)
	assert.True(t, redisServer.Exists(key))
	assert.Equal(t, 23*time.Second, redisServer.TTL(key))
}

func TestRedisEmailVerificationRateLimiterPreservesResponseAndTTL(t *testing.T) {
	redisServer, _ := useRateLimitMiniRedis(t)

	app := newRateLimitEngine(t, func(router contract.Routes) {
		router.GET("/verify", EmailVerificationRateLimit(), func(c contract.Context) {
			c.Status(http.StatusNoContent)
		})
	})

	remoteAddr := "192.0.2.30:12345"
	assert.Equal(t, http.StatusNoContent, performRateLimitRequest(t, app, "/verify", remoteAddr).StatusCode)
	assert.Equal(t, http.StatusNoContent, performRateLimitRequest(t, app, "/verify", remoteAddr).StatusCode)
	response := performRateLimitRequest(t, app, "/verify", remoteAddr)
	assert.Equal(t, http.StatusTooManyRequests, response.StatusCode)
	assert.JSONEq(t, `{"success":false,"message":"发送过于频繁，请等待 30 秒后再试"}`, responseBody(t, response))

	key := redisIPRateLimitKey(EmailVerificationRateLimitMark, "192.0.2.30")
	assert.True(t, redisServer.Exists(key))
	assert.Equal(t, time.Duration(EmailVerificationDuration)*time.Second, redisServer.TTL(key))
}

func TestRedisFixedWindowIsAtomicUnderConcurrency(t *testing.T) {
	redisServer, _ := useRateLimitMiniRedis(t)
	const (
		requestCount = 20
		maximumCount = 7
		duration     = int64(41)
	)
	key := redisIPRateLimitKey("CONCURRENT", "192.0.2.40")

	var allowedCount atomic.Int64
	errorsFound := make(chan error, requestCount)
	var waitGroup sync.WaitGroup
	waitGroup.Add(requestCount)
	for range requestCount {
		go func() {
			defer waitGroup.Done()
			allowed, _, _, err := redisFixedWindowTake(context.Background(), key, maximumCount, duration)
			if err != nil {
				errorsFound <- err
				return
			}
			if allowed {
				allowedCount.Add(1)
			}
		}()
	}
	waitGroup.Wait()
	close(errorsFound)
	for err := range errorsFound {
		require.NoError(t, err)
	}

	assert.Equal(t, int64(maximumCount), allowedCount.Load())
	count, err := redisServer.Get(key)
	require.NoError(t, err)
	assert.Equal(t, "20", count)
	assert.Equal(t, time.Duration(duration)*time.Second, redisServer.TTL(key))
}

func TestRedisFixedWindowResetsAtBoundary(t *testing.T) {
	redisServer, _ := useRateLimitMiniRedis(t)
	const duration = int64(10)
	key := redisIPRateLimitKey("BOUNDARY", "192.0.2.50")

	for range 2 {
		allowed, _, _, err := redisFixedWindowTake(context.Background(), key, 2, duration)
		require.NoError(t, err)
		assert.True(t, allowed)
	}
	allowed, _, _, err := redisFixedWindowTake(context.Background(), key, 2, duration)
	require.NoError(t, err)
	assert.False(t, allowed)

	// This reset is intentional fixed-window behavior. A client can consume one
	// full allowance immediately before and another immediately after a boundary.
	redisServer.FastForward(time.Duration(duration) * time.Second)
	for range 2 {
		allowed, _, _, err = redisFixedWindowTake(context.Background(), key, 2, duration)
		require.NoError(t, err)
		assert.True(t, allowed)
	}
}

func TestRedisFixedWindowRepairsCounterWithoutTTL(t *testing.T) {
	redisServer, _ := useRateLimitMiniRedis(t)
	const duration = int64(29)
	key := redisIPRateLimitKey("MISSING-TTL", "192.0.2.51")
	redisServer.Set(key, "5")

	allowed, count, ttl, err := redisFixedWindowTake(context.Background(), key, 3, duration)
	require.NoError(t, err)
	assert.False(t, allowed)
	assert.Equal(t, int64(6), count)
	assert.Equal(t, duration, ttl)
	assert.Equal(t, time.Duration(duration)*time.Second, redisServer.TTL(key))

	redisServer.FastForward(time.Duration(duration) * time.Second)
	assert.False(t, redisServer.Exists(key), "a recovered counter must not remain permanently rate-limited")
}

func TestRedisFailurePolicies(t *testing.T) {
	// Reset the in-memory rate limiter to ensure test isolation when running
	// with -count=N. The limiter is a package-level global that accumulates
	// state across test iterations in the same process.
	inMemoryRateLimiter.Reset()

	_, redisClient := useRateLimitMiniRedis(t)
	require.NoError(t, redisClient.Close())

	app := newRateLimitEngine(t, func(router contract.Routes) {
		router.GET("/ip", rateLimitFactory(1, 30, "FAIL-IP"), func(c contract.Context) {
			c.Status(http.StatusNoContent)
		})
		router.GET(
			"/user",
			func(c contract.Context) { c.Set("id", 7) },
			userRateLimitFactory(1, 30, "FAIL-USER"),
			func(c contract.Context) { c.Status(http.StatusNoContent) },
		)
		router.GET("/email", EmailVerificationRateLimit(), func(c contract.Context) {
			c.Status(http.StatusNoContent)
		})
	})

	ipResponse := performRateLimitRequest(t, app, "/ip", "192.0.2.60:12345")
	assert.Equal(t, http.StatusInternalServerError, ipResponse.StatusCode)
	assert.Empty(t, responseBody(t, ipResponse))
	userResponse := performRateLimitRequest(t, app, "/user", "192.0.2.61:12345")
	assert.Equal(t, http.StatusInternalServerError, userResponse.StatusCode)
	assert.Empty(t, responseBody(t, userResponse))
	assert.Equal(t, http.StatusNoContent, performRateLimitRequest(t, app, "/email", "192.0.2.62:12345").StatusCode)
}
