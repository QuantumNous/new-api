package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func newModelUsageRequest(t *testing.T, key string) (*httptest.ResponseRecorder, *gin.Context) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/website/model-usage?model=seedance-2.5", nil)
	if key != "" {
		c.Request.Header.Set("X-Website-Metrics-Key", key)
	}
	return recorder, c
}

// An unconfigured deployment must not serve usage, and must not advertise that
// the route exists.
func TestGetWebsiteModelUsageDisabledWithoutKey(t *testing.T) {
	t.Setenv(websiteMetricsKeyEnv, "")
	recorder, c := newModelUsageRequest(t, "anything")

	GetWebsiteModelUsage(c)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when %s is unset, got %d", websiteMetricsKeyEnv, recorder.Code)
	}
}

func TestGetWebsiteModelUsageRejectsWrongKey(t *testing.T) {
	t.Setenv(websiteMetricsKeyEnv, "correct-key")

	for _, presented := range []string{"", "wrong-key", "correct-key-with-suffix", "correct-ke"} {
		recorder, c := newModelUsageRequest(t, presented)
		GetWebsiteModelUsage(c)
		if recorder.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 for presented key %q, got %d", presented, recorder.Code)
		}
	}
}

// A correct key still requires a model: without one the handler would otherwise
// scan every model's buckets.
func TestGetWebsiteModelUsageRequiresModel(t *testing.T) {
	t.Setenv(websiteMetricsKeyEnv, "correct-key")
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/website/model-usage", nil)
	c.Request.Header.Set("X-Website-Metrics-Key", "correct-key")

	GetWebsiteModelUsage(c)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 without a model, got %d", recorder.Code)
	}
	var payload struct {
		Success bool `json:"success"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("response is not JSON: %v", err)
	}
	if payload.Success {
		t.Fatal("expected success=false")
	}
}

// The cache key carries the UTC date, so an entry cannot be served on a day it
// was not computed for even if the TTL is somehow missed.
func TestWebsiteModelUsageCacheKeyIsDayScoped(t *testing.T) {
	day1 := time.Date(2026, 8, 19, 23, 59, 0, 0, time.UTC)
	day2 := day1.Add(2 * time.Minute) // crosses into the next UTC day

	if websiteModelUsageCacheKey("seedance-2.5", 30, day1) == websiteModelUsageCacheKey("seedance-2.5", 30, day2) {
		t.Fatal("expected the cache key to change across a UTC day boundary")
	}
	// Different windows of the same model must not share an entry: a 7-day
	// request would otherwise be served a 30-day series.
	if websiteModelUsageCacheKey("seedance-2.5", 7, day1) == websiteModelUsageCacheKey("seedance-2.5", 30, day1) {
		t.Fatal("expected the cache key to vary by day count")
	}
	if websiteModelUsageCacheKey("model-a", 30, day1) == websiteModelUsageCacheKey("model-b", 30, day1) {
		t.Fatal("expected the cache key to vary by model")
	}
}

// TTL runs to the next UTC midnight so one aggregation query serves the whole
// day, with a floor so a request landing on the boundary still caches usefully.
func TestWebsiteModelUsageCacheTTLExpiresAtUtcMidnight(t *testing.T) {
	morning := time.Date(2026, 8, 19, 6, 0, 0, 0, time.UTC)
	if got, want := websiteModelUsageCacheTTL(morning), 18*time.Hour; got != want {
		t.Fatalf("expected TTL %v at 06:00 UTC, got %v", want, got)
	}

	nearMidnight := time.Date(2026, 8, 19, 23, 59, 30, 0, time.UTC)
	if got := websiteModelUsageCacheTTL(nearMidnight); got != time.Minute {
		t.Fatalf("expected the one-minute floor near midnight, got %v", got)
	}
}
