package codex

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newAutoResetTestRequest(baseURL string, enabled bool) (*gin.Context, *relaycommon.RelayInfo, string) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	requestBody := `{"model":"gpt-5-codex","input":"hello"}`
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeCodex,
			ChannelId:      1,
			ChannelBaseUrl: baseURL,
			ApiKey:         `{"access_token":"test-access-token","account_id":"test-account"}`,
			ChannelOtherSettings: dto.ChannelOtherSettings{
				AutoResetUsageEnabled: enabled,
			},
		},
		UpstreamRequestBodySize: int64(len(requestBody)),
	}
	return c, info, requestBody
}

func setAutoResetTestRedis(t *testing.T, enabled bool, client *redis.Client) {
	t.Helper()
	previousEnabled := common.RedisEnabled
	previousClient := common.RDB
	common.RedisEnabled = enabled
	common.RDB = client
	t.Cleanup(func() {
		common.RedisEnabled = previousEnabled
		common.RDB = previousClient
	})
}

func TestAutoResetUsageRetriesAfterRateLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()
	setAutoResetTestRedis(t, false, nil)

	var responseCalls, usageCalls, creditCalls, resetCalls int
	var bodies []string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/backend-api/codex/responses":
			responseCalls++
			body, _ := io.ReadAll(r.Body)
			bodies = append(bodies, string(body))
			assert.Equal(t, "Bearer test-access-token", r.Header.Get("Authorization"))
			assert.Equal(t, "test-account", r.Header.Get("chatgpt-account-id"))
			if responseCalls == 1 {
				w.WriteHeader(http.StatusTooManyRequests)
				return
			}
			w.WriteHeader(http.StatusOK)
		case "/backend-api/wham/usage":
			usageCalls++
			_, _ = w.Write([]byte(`{"rate_limit":{"secondary_window":{"used_percent":100,"limit_window_seconds":604800}}}`))
		case "/backend-api/wham/rate-limit-reset-credits":
			creditCalls++
			_, _ = w.Write([]byte(`{"available_count":1}`))
		case "/backend-api/wham/rate-limit-reset-credits/consume":
			resetCalls++
			_, _ = w.Write([]byte(`{"windows_reset":1}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	c, info, requestBody := newAutoResetTestRequest(upstream.URL, true)
	respAny, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(requestBody))
	require.NoError(t, err)
	resp, ok := respAny.(*http.Response)
	require.True(t, ok)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, 2, responseCalls)
	assert.Equal(t, 1, usageCalls)
	assert.Equal(t, 1, creditCalls)
	assert.Equal(t, 1, resetCalls)
	assert.Equal(t, []string{requestBody, requestBody}, bodies)
}

func TestAutoResetUsageRejectsIneligibleReset(t *testing.T) {
	tests := []struct {
		name        string
		enabled     bool
		usage       string
		credits     string
		consume     string
		usageCalls  int
		creditCalls int
		resetCalls  int
	}{
		{
			name:    "disabled",
			enabled: false,
		},
		{
			name:       "weekly quota remains",
			enabled:    true,
			usage:      `{"rate_limit":{"primary_window":{"used_percent":100,"limit_window_seconds":18000},"secondary_window":{"used_percent":50,"limit_window_seconds":604800}}}`,
			usageCalls: 1,
		},
		{
			name:        "no reset credits",
			enabled:     true,
			usage:       `{"rate_limit":{"secondary_window":{"used_percent":100,"limit_window_seconds":604800}}}`,
			credits:     `{"available_count":0}`,
			usageCalls:  1,
			creditCalls: 1,
		},
		{
			name:        "no window reset",
			enabled:     true,
			usage:       `{"rate_limit":{"secondary_window":{"used_percent":100,"limit_window_seconds":604800}}}`,
			credits:     `{"available_count":1}`,
			consume:     `{"windows_reset":0}`,
			usageCalls:  1,
			creditCalls: 1,
			resetCalls:  1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			service.InitHttpClient()
			setAutoResetTestRedis(t, false, nil)

			var responseCalls, usageCalls, creditCalls, resetCalls int
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/backend-api/codex/responses":
					responseCalls++
					w.WriteHeader(http.StatusTooManyRequests)
				case "/backend-api/wham/usage":
					usageCalls++
					_, _ = w.Write([]byte(tt.usage))
				case "/backend-api/wham/rate-limit-reset-credits":
					creditCalls++
					_, _ = w.Write([]byte(tt.credits))
				case "/backend-api/wham/rate-limit-reset-credits/consume":
					resetCalls++
					_, _ = w.Write([]byte(tt.consume))
				default:
					http.NotFound(w, r)
				}
			}))
			defer upstream.Close()

			c, info, requestBody := newAutoResetTestRequest(upstream.URL, tt.enabled)
			respAny, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(requestBody))
			require.NoError(t, err)
			resp, ok := respAny.(*http.Response)
			require.True(t, ok)
			defer resp.Body.Close()

			assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
			assert.Equal(t, 1, responseCalls)
			assert.Equal(t, tt.usageCalls, usageCalls)
			assert.Equal(t, tt.creditCalls, creditCalls)
			assert.Equal(t, tt.resetCalls, resetCalls)
		})
	}
}

func TestAutoResetUsageHasTimeout(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()
	setAutoResetTestRedis(t, false, nil)
	originalTimeout := codexAutoResetTimeout
	codexAutoResetTimeout = 50 * time.Millisecond
	t.Cleanup(func() { codexAutoResetTimeout = originalTimeout })

	var usageCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/backend-api/codex/responses":
			w.WriteHeader(http.StatusTooManyRequests)
		case "/backend-api/wham/usage":
			usageCalls.Add(1)
			<-r.Context().Done()
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	c, info, requestBody := newAutoResetTestRequest(upstream.URL, true)
	respAny, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(requestBody))
	require.NoError(t, err)
	resp, ok := respAny.(*http.Response)
	require.True(t, ok)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
	assert.Equal(t, int32(1), usageCalls.Load())
}

func TestAutoResetUsageCoalescesConcurrentResets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()
	setAutoResetTestRedis(t, false, nil)

	var initialCalls, usageCalls, creditCalls, resetCalls atomic.Int32
	var resetDone atomic.Bool
	var bothInitialOnce sync.Once
	bothInitial := make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/backend-api/codex/responses":
			if resetDone.Load() {
				w.WriteHeader(http.StatusOK)
				return
			}
			if initialCalls.Add(1) == 2 {
				bothInitialOnce.Do(func() { close(bothInitial) })
			}
			w.WriteHeader(http.StatusTooManyRequests)
		case "/backend-api/wham/usage":
			usageCalls.Add(1)
			select {
			case <-bothInitial:
				_, _ = w.Write([]byte(`{"rate_limit":{"secondary_window":{"used_percent":100,"limit_window_seconds":604800}}}`))
			case <-r.Context().Done():
			}
		case "/backend-api/wham/rate-limit-reset-credits":
			creditCalls.Add(1)
			_, _ = w.Write([]byte(`{"available_count":1}`))
		case "/backend-api/wham/rate-limit-reset-credits/consume":
			resetCalls.Add(1)
			resetDone.Store(true)
			_, _ = w.Write([]byte(`{"windows_reset":1}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	type result struct {
		status int
		err    error
	}
	results := make(chan result, 2)
	for range 2 {
		go func() {
			c, info, requestBody := newAutoResetTestRequest(upstream.URL, true)
			respAny, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(requestBody))
			if err != nil {
				results <- result{err: err}
				return
			}
			resp := respAny.(*http.Response)
			defer resp.Body.Close()
			results <- result{status: resp.StatusCode}
		}()
	}

	for range 2 {
		select {
		case result := <-results:
			require.NoError(t, result.err)
			assert.Equal(t, http.StatusOK, result.status)
		case <-time.After(3 * time.Second):
			t.Fatal("timed out waiting for concurrent requests")
		}
	}
	assert.Equal(t, int32(2), initialCalls.Load())
	assert.Equal(t, int32(1), usageCalls.Load())
	assert.Equal(t, int32(1), creditCalls.Load())
	assert.Equal(t, int32(1), resetCalls.Load())
}

func TestAutoResetUsageRedisLockExpiresAfterFifteenMinutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()
	redisServer := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	setAutoResetTestRedis(t, true, client)

	var responseCalls, usageCalls, resetCalls int
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/backend-api/codex/responses":
			responseCalls++
			if responseCalls == 2 {
				w.WriteHeader(http.StatusOK)
				return
			}
			w.WriteHeader(http.StatusTooManyRequests)
		case "/backend-api/wham/usage":
			usageCalls++
			_, _ = w.Write([]byte(`{"rate_limit":{"secondary_window":{"used_percent":100,"limit_window_seconds":604800}}}`))
		case "/backend-api/wham/rate-limit-reset-credits":
			_, _ = w.Write([]byte(`{"available_count":1}`))
		case "/backend-api/wham/rate-limit-reset-credits/consume":
			resetCalls++
			_, _ = w.Write([]byte(`{"windows_reset":1}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	for _, expectedStatus := range []int{http.StatusOK, http.StatusTooManyRequests} {
		c, info, requestBody := newAutoResetTestRequest(upstream.URL, true)
		respAny, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(requestBody))
		require.NoError(t, err)
		resp := respAny.(*http.Response)
		assert.Equal(t, expectedStatus, resp.StatusCode)
		_ = resp.Body.Close()
	}

	lockKey := "codex:auto-reset:lock:" + codexAutoResetKey(upstream.URL, "test-account")
	assert.True(t, redisServer.Exists(lockKey))
	assert.Equal(t, codexAutoResetLockTTL, redisServer.TTL(lockKey))
	assert.Equal(t, 3, responseCalls)
	assert.Equal(t, 1, usageCalls)
	assert.Equal(t, 1, resetCalls)
}

func TestAutoResetUsageFallsBackWhenRedisIsUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()
	client := redis.NewClient(&redis.Options{
		Addr:         "127.0.0.1:1",
		DialTimeout:  10 * time.Millisecond,
		ReadTimeout:  10 * time.Millisecond,
		WriteTimeout: 10 * time.Millisecond,
		MaxRetries:   -1,
	})
	t.Cleanup(func() { _ = client.Close() })
	setAutoResetTestRedis(t, true, client)

	var resetCalls int
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/backend-api/wham/usage":
			_, _ = w.Write([]byte(`{"rate_limit":{"secondary_window":{"used_percent":100,"limit_window_seconds":604800}}}`))
		case "/backend-api/wham/rate-limit-reset-credits":
			_, _ = w.Write([]byte(`{"available_count":1}`))
		case "/backend-api/wham/rate-limit-reset-credits/consume":
			resetCalls++
			_, _ = w.Write([]byte(`{"windows_reset":1}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	c, info, _ := newAutoResetTestRequest(upstream.URL, true)
	assert.True(t, consumeCodexResetCredit(c, info))
	assert.Equal(t, 1, resetCalls)
}
