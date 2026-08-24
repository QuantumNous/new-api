package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

func newPrometheusMetricsAuthEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/metrics", PrometheusMetricsAuth(), func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	return r
}

func TestPrometheusMetricsAuth(t *testing.T) {
	t.Run("503 when env not set", func(t *testing.T) {
		os.Unsetenv(PrometheusMetricsTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
		req.RemoteAddr = "203.0.113.10:1234"
		rec := httptest.NewRecorder()
		newPrometheusMetricsAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503; body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("200 when local sidecar scrapes without token", func(t *testing.T) {
		os.Unsetenv(PrometheusMetricsTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
		req.RemoteAddr = "127.0.0.1:1234"
		rec := httptest.NewRecorder()
		newPrometheusMetricsAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("200 when IPv6 local sidecar scrapes without token", func(t *testing.T) {
		os.Unsetenv(PrometheusMetricsTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
		req.RemoteAddr = "[::1]:1234"
		rec := httptest.NewRecorder()
		newPrometheusMetricsAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("401 when token missing", func(t *testing.T) {
		os.Setenv(PrometheusMetricsTokenEnv, "secret")
		defer os.Unsetenv(PrometheusMetricsTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
		req.RemoteAddr = "203.0.113.10:1234"
		rec := httptest.NewRecorder()
		newPrometheusMetricsAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("401 when token wrong", func(t *testing.T) {
		os.Setenv(PrometheusMetricsTokenEnv, "secret")
		defer os.Unsetenv(PrometheusMetricsTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
		req.RemoteAddr = "203.0.113.10:1234"
		req.Header.Set("Authorization", "Bearer wrong")
		rec := httptest.NewRecorder()
		newPrometheusMetricsAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("200 when Bearer token correct", func(t *testing.T) {
		os.Setenv(PrometheusMetricsTokenEnv, "secret")
		defer os.Unsetenv(PrometheusMetricsTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
		req.Header.Set("Authorization", "Bearer secret")
		rec := httptest.NewRecorder()
		newPrometheusMetricsAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
		}
	})
}

func TestPrometheusMetricsTokenEqual(t *testing.T) {
	if !prometheusMetricsTokenEqual("secret", "secret") {
		t.Fatal("same token should match")
	}
	if prometheusMetricsTokenEqual("secret", "wrong") {
		t.Fatal("different token should not match")
	}
	if prometheusMetricsTokenEqual("secret", "much-longer-wrong-token") {
		t.Fatal("different-length token should not match")
	}
}

func TestPrometheusMetricsAuthFailureRateLimit(t *testing.T) {
	origRedisEnabled := common.RedisEnabled
	origRDB := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	defer func() {
		common.RedisEnabled = origRedisEnabled
		common.RDB = origRDB
	}()

	t.Setenv(PrometheusMetricsTokenEnv, "secret")
	t.Setenv("PROMETHEUS_METRICS_RATE_LIMIT", "1")
	t.Setenv("PROMETHEUS_METRICS_RATE_LIMIT_DURATION", "60")
	r := newPrometheusMetricsAuthEngine()

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	req.RemoteAddr = "203.0.113.20:1234"
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("first invalid status = %d, want 401", rec.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/metrics", nil)
	req.RemoteAddr = "203.0.113.20:1234"
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second invalid status = %d, want 429", rec.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/metrics", nil)
	req.RemoteAddr = "203.0.113.20:1234"
	req.Header.Set("Authorization", "Bearer secret")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("valid scrape status = %d, want 200", rec.Code)
	}
}

func TestPrometheusMetricsRateLimitClampsInvalidEnv(t *testing.T) {
	origRedisEnabled := common.RedisEnabled
	origRDB := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	defer func() {
		common.RedisEnabled = origRedisEnabled
		common.RDB = origRDB
	}()

	t.Setenv(PrometheusMetricsTokenEnv, "secret")
	t.Setenv("PROMETHEUS_METRICS_RATE_LIMIT", "0")
	t.Setenv("PROMETHEUS_METRICS_RATE_LIMIT_DURATION", "-1")
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rec := httptest.NewRecorder()
	newPrometheusMetricsAuthEngine().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}
