package middleware

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"

	"github.com/gin-gonic/gin"
)

func newChannelLimitRouter(channelLimit func(c *gin.Context) (int, int)) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		channelID, limit := channelLimit(c)
		common.SetContextKey(c, constant.ContextKeyChannelId, channelID)
		common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{ChannelRPMLimit: limit})
		c.Next()
	})
	r.Use(ChannelRequestRateLimit())
	r.GET("/v1/chat/completions", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return r
}

func TestChannelRequestRateLimitExceed(t *testing.T) {
	prevRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = prevRedisEnabled
	})

	channelID := int(time.Now().UnixNano()%1_000_000_000) + 1000
	r := newChannelLimitRouter(func(c *gin.Context) (int, int) {
		return channelID, 2
	})

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/v1/chat/completions", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d got status %d, want %d", i+1, w.Code, http.StatusOK)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/chat/completions", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("request 3 got status %d, want %d", w.Code, http.StatusTooManyRequests)
	}
}

func TestChannelRequestRateLimitIsolatedByChannel(t *testing.T) {
	prevRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = prevRedisEnabled
	})

	baseID := int(time.Now().UnixNano()%1_000_000_000) + 2000
	r := newChannelLimitRouter(func(c *gin.Context) (int, int) {
		id, _ := strconv.Atoi(c.GetHeader("X-Channel-Id"))
		return id, 1
	})

	reqA1 := httptest.NewRequest(http.MethodGet, "/v1/chat/completions", nil)
	reqA1.Header.Set("X-Channel-Id", strconv.Itoa(baseID))
	wA1 := httptest.NewRecorder()
	r.ServeHTTP(wA1, reqA1)
	if wA1.Code != http.StatusOK {
		t.Fatalf("channel A first request got %d, want %d", wA1.Code, http.StatusOK)
	}

	reqA2 := httptest.NewRequest(http.MethodGet, "/v1/chat/completions", nil)
	reqA2.Header.Set("X-Channel-Id", strconv.Itoa(baseID))
	wA2 := httptest.NewRecorder()
	r.ServeHTTP(wA2, reqA2)
	if wA2.Code != http.StatusTooManyRequests {
		t.Fatalf("channel A second request got %d, want %d", wA2.Code, http.StatusTooManyRequests)
	}

	reqB1 := httptest.NewRequest(http.MethodGet, "/v1/chat/completions", nil)
	reqB1.Header.Set("X-Channel-Id", strconv.Itoa(baseID+1))
	wB1 := httptest.NewRecorder()
	r.ServeHTTP(wB1, reqB1)
	if wB1.Code != http.StatusOK {
		t.Fatalf("channel B first request got %d, want %d", wB1.Code, http.StatusOK)
	}
}

func TestChannelRequestRateLimitDisabledWhenZero(t *testing.T) {
	prevRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = prevRedisEnabled
	})

	channelID := int(time.Now().UnixNano()%1_000_000_000) + 3000
	r := newChannelLimitRouter(func(c *gin.Context) (int, int) {
		return channelID, 0
	})

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/v1/chat/completions", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d got status %d, want %d", i+1, w.Code, http.StatusOK)
		}
	}
}
