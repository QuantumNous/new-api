package middleware

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func configureModelRateLimitTest(t *testing.T, redisBackend bool) {
	t.Helper()
	enabled, total, success, minutes := setting.ModelRequestRateLimitEnabled, setting.ModelRequestRateLimitCount, setting.ModelRequestRateLimitSuccessCount, setting.ModelRequestRateLimitDurationMinutes
	redisEnabled := common.RedisEnabled
	previousLimiter := inMemoryRateLimiter
	inMemoryRateLimiter = &common.InMemoryRateLimiter{}
	inMemoryRateLimiter.Init(0)
	setting.ModelRequestRateLimitEnabled = true
	setting.ModelRequestRateLimitCount = 0
	setting.ModelRequestRateLimitSuccessCount = 1
	setting.ModelRequestRateLimitDurationMinutes = 1
	common.RedisEnabled = redisBackend
	t.Cleanup(func() {
		setting.ModelRequestRateLimitEnabled = enabled
		setting.ModelRequestRateLimitCount = total
		setting.ModelRequestRateLimitSuccessCount = success
		setting.ModelRequestRateLimitDurationMinutes = minutes
		common.RedisEnabled = redisEnabled
		inMemoryRateLimiter = previousLimiter
	})
	if redisBackend {
		if addr := os.Getenv("TEST_RATE_LIMIT_REDIS_ADDR"); addr != "" {
			previousClient := common.RDB
			client := redis.NewClient(&redis.Options{Addr: addr, DB: 15})
			require.NoError(t, client.Ping(context.Background()).Err())
			common.RDB = client
			t.Cleanup(func() {
				for _, id := range []string{"923101", "923102", "923103", "923104"} {
					require.NoError(t, client.Del(context.Background(), "rateLimit:"+id, "rateLimit:MRRLS:"+id).Err())
				}
				require.NoError(t, client.Close())
				common.RDB = previousClient
			})
		} else {
			useRateLimitMiniRedis(t)
		}
	}
}

func TestModelRateLimitReservesAcrossConcurrentSessions(t *testing.T) {
	for _, redisBackend := range []bool{false, true} {
		t.Run(map[bool]string{false: "memory", true: "redis"}[redisBackend], func(t *testing.T) {
			configureModelRateLimitTest(t, redisBackend)
			start := make(chan struct{})
			commits := make(chan ModelRequestRateLimitCommit, 2)
			statuses := make(chan int, 2)
			var workers sync.WaitGroup
			for range 2 {
				workers.Add(1)
				go func() {
					defer workers.Done()
					c, _ := gin.CreateTestContext(httptest.NewRecorder())
					c.Set("id", 923101)
					<-start
					commit, apiErr := CheckModelRequestRateLimit(c)
					if apiErr != nil {
						statuses <- apiErr.StatusCode
						return
					}
					commits <- commit
				}()
			}
			close(start)
			workers.Wait()
			close(commits)
			close(statuses)
			var admitted []ModelRequestRateLimitCommit
			for commit := range commits {
				admitted = append(admitted, commit)
				t.Cleanup(func() { commit(false) })
			}
			require.Len(t, admitted, 1)
			assert.Equal(t, http.StatusTooManyRequests, <-statuses)
			admitted[0](false)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("id", 923101)
			commit, apiErr := CheckModelRequestRateLimit(c)
			require.Nil(t, apiErr)
			commit(true)
			commit(false)
			_, apiErr = CheckModelRequestRateLimit(c)
			require.NotNil(t, apiErr)
			assert.Equal(t, http.StatusTooManyRequests, apiErr.StatusCode)
		})
	}
}

func TestModelRateLimitReleasesFailedAndCancelledHTTPCalls(t *testing.T) {
	for _, redisBackend := range []bool{false, true} {
		for _, outcome := range []string{"failure", "cancel", "panic"} {
			t.Run(map[bool]string{false: "memory/", true: "redis/"}[redisBackend]+outcome, func(t *testing.T) {
				configureModelRateLimitTest(t, redisBackend)
				requestContext, cancel := context.WithCancel(context.Background())
				defer cancel()
				router := gin.New()
				router.Use(gin.RecoveryWithWriter(io.Discard))
				router.GET("/call", func(c *gin.Context) { c.Set("id", 923102) }, ModelRequestRateLimit(), func(c *gin.Context) {
					switch outcome {
					case "panic":
						panic("test upstream panic")
					case "cancel":
						cancel()
						c.Status(http.StatusOK)
					default:
						c.Status(http.StatusBadGateway)
					}
				})
				request := httptest.NewRequest(http.MethodGet, "/call", nil).WithContext(requestContext)
				router.ServeHTTP(httptest.NewRecorder(), request)
				c, _ := gin.CreateTestContext(httptest.NewRecorder())
				c.Set("id", 923102)
				commit, apiErr := CheckModelRequestRateLimit(c)
				require.Nil(t, apiErr)
				require.NotNil(t, commit)
				commit(false)
			})
		}
	}
}

func TestModelRateLimitTotalRejectionReleasesSuccessReservation(t *testing.T) {
	for _, redisBackend := range []bool{false, true} {
		t.Run(map[bool]string{false: "memory", true: "redis"}[redisBackend], func(t *testing.T) {
			configureModelRateLimitTest(t, redisBackend)
			setting.ModelRequestRateLimitCount = 1
			setting.ModelRequestRateLimitSuccessCount = 2
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("id", 923103)
			commit, apiErr := CheckModelRequestRateLimit(c)
			require.Nil(t, apiErr)
			commit(false)
			_, apiErr = CheckModelRequestRateLimit(c)
			require.NotNil(t, apiErr)
			assert.Equal(t, http.StatusTooManyRequests, apiErr.StatusCode)
			setting.ModelRequestRateLimitCount = 0
			first, apiErr := CheckModelRequestRateLimit(c)
			require.Nil(t, apiErr)
			defer first(false)
			second, apiErr := CheckModelRequestRateLimit(c)
			require.Nil(t, apiErr)
			second(false)
			first(false)
			if redisBackend {
				// Reuse the client because the total-request limiter is a singleton.
				setting.ModelRequestRateLimitCount = 1
				setting.ModelRequestRateLimitSuccessCount = 1
				c.Set("id", 923104)
				require.NoError(t, common.RDB.Set(context.Background(), "rateLimit:923104", "invalid bucket type", 0).Err())
				_, apiErr = CheckModelRequestRateLimit(c)
				require.NotNil(t, apiErr)
				assert.Equal(t, http.StatusInternalServerError, apiErr.StatusCode)
				setting.ModelRequestRateLimitCount = 0
				commit, apiErr := CheckModelRequestRateLimit(c)
				require.Nil(t, apiErr)
				commit(false)
			}
		})
	}
}

func TestModelRateLimitExpiredCancellationDoesNotReleaseNewCall(t *testing.T) {
	t.Run("memory", func(t *testing.T) {
		limiter := &common.InMemoryRateLimiter{}
		limiter.Init(0)
		old, allowed := limiter.Reserve("expired", 1, 0)
		require.True(t, allowed)
		current, allowed := limiter.Reserve("expired", 1, 0)
		require.True(t, allowed)
		defer current(false)
		old(false)
		_, allowed = limiter.Reserve("expired", 1, 60)
		assert.False(t, allowed)
	})
	t.Run("redis", func(t *testing.T) {
		server, client := useRateLimitMiniRedis(t)
		ctx := context.Background()
		old, err := checkRedisRateLimit(ctx, client, "expired", 1, 60)
		require.NoError(t, err)
		require.NotNil(t, old)
		server.FastForward(time.Minute)
		current, err := checkRedisRateLimit(ctx, client, "expired", 1, 60)
		require.NoError(t, err)
		require.NotNil(t, current)
		defer current(false)
		old(false)
		blocked, err := checkRedisRateLimit(ctx, client, "expired", 1, 60)
		require.NoError(t, err)
		assert.Nil(t, blocked)
	})
}

func TestModelRedisRateLimitUsesUTCRegardlessOfLocalTimezone(t *testing.T) {
	redisServer, redisClient := useRateLimitMiniRedis(t)
	previousLocation := time.Local
	time.Local = time.FixedZone("test-utc-plus-eight", 8*60*60)
	t.Cleanup(func() { time.Local = previousLocation })

	ctx := context.Background()
	recordKey := "rateLimit:model-utc-record"
	commit, err := checkRedisRateLimit(ctx, redisClient, recordKey, 2, 60)
	require.NoError(t, err)
	require.NotNil(t, commit)
	commit(true)
	recorded, err := redisClient.LIndex(ctx, recordKey, 0).Result()
	require.NoError(t, err)
	timestamp, _, _ := strings.Cut(recorded, "|")
	recordedAt, err := time.Parse(modelRateLimitTimeFormat, timestamp)
	require.NoError(t, err)
	assert.WithinDuration(t, time.Now().UTC(), recordedAt, 2*time.Second)

	checkKey := "rateLimit:model-utc-check"
	withinWindow := time.Now().UTC().Add(-30 * time.Second).Format(modelRateLimitTimeFormat)
	_, err = redisServer.Push(checkKey, withinWindow, withinWindow)
	require.NoError(t, err)
	commit, err = checkRedisRateLimit(ctx, redisClient, checkKey, 2, 60)
	require.NoError(t, err)
	assert.Nil(t, commit, "an existing UTC timestamp inside the window must remain limited on a non-UTC host")
}
