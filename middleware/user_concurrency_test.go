package middleware

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserConcurrencySharesAPIKeysAndReleasesAfterStreaming(t *testing.T) {
	require.NoError(t, i18n.Init())
	for _, backend := range []string{"memory", "redis"} {
		for _, limit := range []int{0, 1} {
			t.Run(backend+"/limit="+strconv.Itoa(limit), func(t *testing.T) {
				setupDashboardAuthMiddlewareTest(t)
				t.Setenv("LOG_SQL_DSN", "")
				previousMaster, previousLogType := common.IsMasterNode, common.LogDatabaseType()
				common.IsMasterNode = false
				initErr := model.InitLogDB() // Initialize the dialect's reserved-word columns.
				common.IsMasterNode = previousMaster
				t.Cleanup(func() { common.SetLogDatabaseType(previousLogType) })
				require.NoError(t, initErr)
				require.NoError(t, model.DB.AutoMigrate(&model.Token{}))
				sqlDB, err := model.DB.DB()
				require.NoError(t, err)
				sqlDB.SetMaxOpenConns(1)
				if backend == "redis" {
					useRateLimitMiniRedis(t)
				}
				user := model.User{Username: "limited", Password: "unused", Group: "default", AffCode: "limited", MaxConcurrency: limit, AuthVersion: 1}
				other := model.User{Username: "other", Password: "unused", Group: "default", AffCode: "other", MaxConcurrency: 1, AuthVersion: 1}
				require.NoError(t, model.DB.Create(&user).Error)
				require.NoError(t, model.DB.Create(&other).Error)
				keys := []string{strings.Repeat("a", 48), strings.Repeat("b", 48), strings.Repeat("c", 48)}
				for index, userID := range []int{user.Id, user.Id, other.Id} {
					require.NoError(t, model.DB.Create(&model.Token{UserId: userID, Key: keys[index], ExpiredTime: -1, UnlimitedQuota: true}).Error)
				}
				entered, release, finished := make(chan struct{}), make(chan struct{}), make(chan struct{})
				var releaseOnce sync.Once
				t.Cleanup(func() { releaseOnce.Do(func() { close(release) }) })
				router := gin.New()
				router.GET("/v1/chat/completions", TokenAuth(), func(c *gin.Context) {
					common.SetContextKey(c, constant.ContextKeyTokenGroup, c.Query("group"))
				}, UserConcurrencyLimit(), func(c *gin.Context) {
					if c.Query("stream") == "true" {
						c.Header("Content-Type", "text/event-stream")
						_, _ = c.Writer.WriteString("data: {}\n\n")
						c.Writer.Flush()
						close(entered)
						<-release
					}
					c.Status(http.StatusOK)
				})
				first := httptest.NewRecorder()
				request := httptest.NewRequest(http.MethodGet, "/v1/chat/completions?stream=true&group=a", nil)
				request.Header.Set("Authorization", "Bearer "+keys[0])
				go func() { defer close(finished); router.ServeHTTP(first, request) }()
				select {
				case <-entered:
				case <-time.After(5 * time.Second):
					t.Fatal("authenticated stream did not start")
				}
				second := middlewareBearerRequest(router, "/v1/chat/completions?group=b", keys[1])
				if limit == 0 {
					assert.Equal(t, http.StatusOK, second.Code)
				} else {
					assert.Equal(t, http.StatusTooManyRequests, second.Code, second.Body.String())
					assert.Contains(t, second.Body.String(), `"code":"user_concurrency_limit"`)
				}
				assert.Equal(t, http.StatusOK, middlewareBearerRequest(router, "/v1/chat/completions", keys[2]).Code)
				releaseOnce.Do(func() { close(release) })
				<-finished
				assert.Equal(t, http.StatusOK, first.Code)
				assert.Equal(t, http.StatusOK, middlewareBearerRequest(router, "/v1/chat/completions", keys[1]).Code)
			})
		}
	}
}

func TestUserConcurrencyCancellationHoldsSlotUntilHandlerFinishes(t *testing.T) {
	require.NoError(t, i18n.Init())
	for _, backend := range []string{"memory", "redis"} {
		t.Run(backend, func(t *testing.T) {
			previousRedis := common.RedisEnabled
			common.RedisEnabled = false
			t.Cleanup(func() { common.RedisEnabled = previousRedis })
			if backend == "redis" {
				useRateLimitMiniRedis(t)
			}
			entered, canceled, cleanup, finished := make(chan struct{}), make(chan struct{}), make(chan struct{}), make(chan struct{})
			var cleanupOnce sync.Once
			t.Cleanup(func() { cleanupOnce.Do(func() { close(cleanup) }) })
			router := gin.New()
			router.GET("/:action", func(c *gin.Context) {
				c.Set("id", 830001)
				common.SetContextKey(c, constant.ContextKeyUserMaxConcurrency, 1)
			}, UserConcurrencyLimit(), func(c *gin.Context) {
				if c.Param("action") == "hold" {
					close(entered)
					<-c.Request.Context().Done()
					close(canceled)
					<-cleanup
				}
			})
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			go func() {
				defer close(finished)
				router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/hold", nil).WithContext(ctx))
			}()
			<-entered
			cancel()
			<-canceled
			assert.Equal(t, http.StatusTooManyRequests, performRateLimitRequest(router, "/probe", "127.0.0.1:1").Code)
			cleanupOnce.Do(func() { close(cleanup) })
			<-finished
			assert.Equal(t, http.StatusOK, performRateLimitRequest(router, "/probe", "127.0.0.1:1").Code)
		})
	}
}

func TestUserConcurrencyLeaseLossCancelsHTTPUpstream(t *testing.T) {
	_, rdb := useRateLimitMiniRedis(t)
	service.InitHttpClient()
	type pendingRequest struct {
		kind         string
		bodyStarted  bool
		userID       int
		entered      chan struct{}
		upstreamDone chan struct{}
		finished     chan struct{}
		result       chan error
	}
	requests := make(map[string]*pendingRequest)
	for _, kind := range []string{"json", "multipart", "custom"} {
		for _, bodyStarted := range []bool{false, true} {
			name := fmt.Sprintf("/%s/body=%t", kind, bodyStarted)
			requests[name] = &pendingRequest{
				kind: kind, bodyStarted: bodyStarted, userID: 831000 + len(requests),
				entered: make(chan struct{}), upstreamDone: make(chan struct{}),
				finished: make(chan struct{}), result: make(chan error, 1),
			}
		}
	}
	cleanup := make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		request := requests[r.URL.Path]
		_, _ = io.Copy(io.Discard, r.Body)
		if request.bodyStarted {
			_, _ = io.WriteString(w, "partial response")
			w.(http.Flusher).Flush()
		}
		close(request.entered)
		select {
		case <-r.Context().Done():
		case <-cleanup:
		}
		close(request.upstreamDone)
	}))
	t.Cleanup(upstream.Close)
	// All requests are started together so the real renewal ticker is exercised
	// once, without changing production timing or relying on synthetic cancel().
	t.Cleanup(func() {
		close(cleanup)
		for name, request := range requests {
			select {
			case <-request.finished:
			case <-time.After(5 * time.Second):
				t.Errorf("relay %s did not finish during cleanup", name)
			}
		}
	})
	router := gin.New()
	router.POST("/:kind/:phase", func(c *gin.Context) {
		c.Set("id", requests[c.Request.URL.Path].userID)
		common.SetContextKey(c, constant.ContextKeyUserMaxConcurrency, 1)
	}, UserConcurrencyLimit(), func(c *gin.Context) {
		request := requests[c.Request.URL.Path]
		info := &relaycommon.RelayInfo{
			RequestURLPath: c.Request.URL.Path,
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelType: constant.ChannelTypeOpenAI, ChannelBaseUrl: upstream.URL,
			},
		}
		adaptor := &openai.Adaptor{}
		var response *http.Response
		var err error
		switch request.kind {
		case "json":
			response, err = channel.DoApiRequest(adaptor, c, info, strings.NewReader("{}"))
		case "multipart":
			response, err = channel.DoFormRequest(adaptor, c, info, strings.NewReader("form body"))
		case "custom":
			var req *http.Request
			req, err = http.NewRequest(http.MethodPost, upstream.URL+c.Request.URL.Path, strings.NewReader("{}"))
			if err == nil {
				response, err = channel.DoRequest(c, req, info)
			}
		}
		if err == nil {
			_, err = io.Copy(io.Discard, response.Body)
			_ = response.Body.Close()
		}
		request.result <- err
	})
	for name, request := range requests {
		go func() {
			defer close(request.finished)
			router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, name, strings.NewReader("body")))
		}()
	}
	keys := make([]string, 0, len(requests))
	for name, request := range requests {
		select {
		case <-request.entered:
		case <-time.After(5 * time.Second):
			t.Fatalf("upstream %s did not start", name)
		}
		keys = append(keys, fmt.Sprintf("concurrency:user:v1:%d", request.userID))
	}
	require.NoError(t, rdb.Del(t.Context(), keys...).Err())
	deadline := time.NewTimer(userConcurrencyLeaseTTL/3 + 5*time.Second)
	defer deadline.Stop()
	for name, request := range requests {
		select {
		case err := <-request.result:
			assert.Error(t, err, name)
		case <-deadline.C:
			t.Fatalf("HTTP upstream %s continued after lease loss", name)
		}
		select {
		case <-request.upstreamDone:
		case <-time.After(3 * time.Second):
			t.Fatalf("HTTP upstream connection %s remained open", name)
		}
	}
}

func TestUserConcurrencyReleasesOnPanic(t *testing.T) {
	previousRedis := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedis })
	router := gin.New()
	router.Use(gin.Recovery())
	router.GET("/:action", func(c *gin.Context) {
		c.Set("id", 830002)
		common.SetContextKey(c, constant.ContextKeyUserMaxConcurrency, 1)
	}, UserConcurrencyLimit(), func(c *gin.Context) {
		if c.Param("action") == "panic" {
			panic("upstream panic")
		}
	})
	assert.Equal(t, http.StatusInternalServerError, performRateLimitRequest(router, "/panic", "127.0.0.1:1").Code)
	assert.Equal(t, http.StatusOK, performRateLimitRequest(router, "/probe", "127.0.0.1:1").Code)
}

func TestUserConcurrencyRedisLeaseRenewalExpiryAndOwnership(t *testing.T) {
	server, _ := useRateLimitMiniRedis(t)
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	server.SetTime(now)
	lease, err := acquireUserConcurrency(t.Context(), 830003, 1)
	require.NoError(t, err)
	require.NotNil(t, lease)
	defer lease.release()
	server.SetTime(now.Add(40 * time.Second))
	renewed, err := lease.renew()
	require.NoError(t, err)
	assert.True(t, renewed)
	server.SetTime(now.Add(70 * time.Second))
	blocked, err := acquireUserConcurrency(t.Context(), 830003, 1)
	require.NoError(t, err)
	assert.Nil(t, blocked, "renewal must protect requests beyond the original expiry")
	server.SetTime(now.Add(101 * time.Second))
	replacement, err := acquireUserConcurrency(t.Context(), 830003, 1)
	require.NoError(t, err)
	require.NotNil(t, replacement, "an abandoned process must eventually release capacity")
	defer replacement.release()
	renewed, err = lease.renew()
	require.NoError(t, err)
	assert.False(t, renewed, "an expired lease must never be resurrected")
	lease.release()
	lease.release()
	blocked, err = acquireUserConcurrency(t.Context(), 830003, 1)
	require.NoError(t, err)
	assert.Nil(t, blocked, "an old release must not delete the replacement's slot")
}

func TestUserConcurrencyRedisUnavailableRejectsInsteadOfBypassing(t *testing.T) {
	require.NoError(t, i18n.Init())
	_, client := useRateLimitMiniRedis(t)
	require.NoError(t, client.Close())
	router := gin.New()
	router.GET("/:limit", func(c *gin.Context) {
		c.Set("id", 830004)
		limit, err := strconv.Atoi(c.Param("limit"))
		require.NoError(t, err)
		common.SetContextKey(c, constant.ContextKeyUserMaxConcurrency, limit)
	}, UserConcurrencyLimit(), func(c *gin.Context) {
		if c.Param("limit") != "0" {
			t.Error("unavailable limiter must not reach the upstream")
		}
	})
	assert.Equal(t, http.StatusOK, performRateLimitRequest(router, "/0", "127.0.0.1:1").Code)
	response := performRateLimitRequest(router, "/1", "127.0.0.1:1")
	assert.Equal(t, http.StatusServiceUnavailable, response.Code)
	assert.Contains(t, response.Body.String(), "concurrency_limit_unavailable")
}

func TestUserConcurrencyRealRedisAtomicAdmission(t *testing.T) {
	address := os.Getenv("TEST_REDIS_ADDR")
	if address == "" {
		t.Skip("TEST_REDIS_ADDR is not configured")
	}
	previousEnabled, previousRDB := common.RedisEnabled, common.RDB
	client := redis.NewClient(&redis.Options{Addr: address})
	common.RedisEnabled, common.RDB = true, client
	t.Cleanup(func() { _ = client.Close(); common.RedisEnabled, common.RDB = previousEnabled, previousRDB })
	require.NoError(t, client.Ping(t.Context()).Err())
	// Every contender races for the same last slot; none releases it until all
	// contenders have received their admission decision.
	start := make(chan struct{})
	results := make(chan *userConcurrencyLease, 4)
	errors := make(chan error, 4)
	for range 4 {
		go func() {
			<-start
			lease, err := acquireUserConcurrency(t.Context(), 830005, 1)
			results <- lease
			errors <- err
		}()
	}
	close(start)
	admitted := 0
	for range 4 {
		require.NoError(t, <-errors)
		if lease := <-results; lease != nil {
			admitted++
			defer lease.release()
		}
	}
	assert.Equal(t, 1, admitted)
}

// pipeUserConcurrencyRedis keeps the Redis protocol boundary inside a synctest
// bubble, so renewal retries and expiry are tested without wall-clock sleeps.
func pipeUserConcurrencyRedis(t *testing.T, replies []string) (*redis.Client, <-chan time.Time) {
	t.Helper()
	renewals := make(chan time.Time, len(replies))
	client := redis.NewClient(&redis.Options{
		PoolSize: 1, MaxRetries: -1,
		Dialer: func(context.Context, string, string) (net.Conn, error) {
			conn, peer := net.Pipe()
			go func() {
				defer peer.Close()
				reader := bufio.NewReader(peer)
				index := 0
				for {
					line, err := reader.ReadString('\n')
					if err != nil {
						return
					}
					count, err := strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(line, "*")))
					if !assert.NoError(t, err) {
						return
					}
					args := make([]string, count)
					for i := range count {
						line, err = reader.ReadString('\n')
						if !assert.NoError(t, err) {
							return
						}
						size, err := strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(line, "$")))
						if !assert.NoError(t, err) {
							return
						}
						value := make([]byte, size+2)
						if _, err := io.ReadFull(reader, value); !assert.NoError(t, err) {
							return
						}
						args[i] = string(value[:size])
					}
					reply := ":1\r\n"
					if len(args) > 1 && args[1] == renewUserConcurrencyScript.Hash() {
						if !assert.Less(t, index, len(replies), "unexpected renewal") {
							return
						}
						reply = replies[index]
						index++
						renewals <- time.Now()
					}
					if _, err := io.WriteString(peer, reply); err != nil {
						return
					}
				}
			}()
			return conn, nil
		},
	})
	t.Cleanup(func() { _ = client.Close() })
	return client, renewals
}

func TestUserConcurrencyKeepAliveRenewalFailures(t *testing.T) {
	for _, test := range []struct {
		name       string
		replies    []string
		aliveAfter int
		cancelAt   time.Duration
	}{
		{"transient_error_then_recovered", []string{"-ERR temporary failure\r\n", ":1\r\n", "-ERR temporary failure\r\n", ":1\r\n", ":0\r\n"}, 4, 100 * time.Second},
		{"persistent_errors", []string{"-ERR temporary failure\r\n", "-ERR temporary failure\r\n"}, 2, userConcurrencyLeaseTTL - userConcurrencyOperationTimeout},
		{"lease_missing", []string{":0\r\n"}, 0, userConcurrencyLeaseTTL / 3},
	} {
		t.Run(test.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				client, renewals := pipeUserConcurrencyRedis(t, test.replies)
				previousEnabled, previousRDB := common.RedisEnabled, common.RDB
				common.RedisEnabled, common.RDB = true, client
				t.Cleanup(func() { common.RedisEnabled, common.RDB = previousEnabled, previousRDB })
				started := time.Now()
				lease, err := acquireUserConcurrency(t.Context(), 830006, 1)
				require.NoError(t, err)
				require.NotNil(t, lease)
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				lease.stop, lease.done = make(chan struct{}), make(chan struct{})
				go lease.keepAlive(cancel)
				defer lease.release()
				for range test.aliveAfter {
					<-renewals
					synctest.Wait()
					require.NoError(t, ctx.Err(), "a transient renewal error must preserve the active request")
				}
				<-ctx.Done()
				synctest.Wait()
				assert.Equal(t, test.cancelAt, time.Since(started), "cancel before a lease can expire, or immediately when Redis confirms loss")
			})
		})
	}
}
