package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// A separate, roomier budget for the public read routes (/api/hw/status,
// /api/hw/quality/latest and /api/hw/pricing/compare).
//
// These are the routes a visitor without an account hits, often several times
// while a page loads and polls. The critical limiter (20 requests per 20
// minutes) is meant for endpoints that cost us money or touch an account, and
// it cannot be used here: mobile carriers in Turkey put many subscribers
// behind one public address, so a whole carrier can share one key. A strict
// budget per address would lock out every other customer of that carrier.
//
// The limit keeps the same implementation as every other server limit (the
// in-memory sliding window, or Redis when that is enabled) and has its own key
// prefix, so it never spends the critical budget and can be tuned on its own.
const (
	hwPublicReadRateLimitNum      = 60
	hwPublicReadRateLimitDuration = 60 // seconds
	hwPublicReadRateLimitMark     = "HR"

	// The status and quality answers change at most once a minute (one
	// measurement per minute and one per measurement pass). A short public
	// cache lets the browser and a shared carrier cache answer repeated polls
	// without waking the server at all.
	hwPublicReadCacheControl = "public, max-age=30"
)

// HwPublicReadRateLimit limits one client address to 60 public reads a minute.
func HwPublicReadRateLimit() func(c *gin.Context) {
	return rateLimitFactory(hwPublicReadRateLimitNum, hwPublicReadRateLimitDuration, hwPublicReadRateLimitMark)
}

// HwPublicReadCache marks a successful public read answer as cacheable for
// thirty seconds. A failed answer is never marked: caching an error for half a
// minute would show the visitor a stale failure after the server recovered.
// An answer that sets its own Cache-Control keeps it.
func HwPublicReadCache() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer = &hwPublicReadCacheWriter{ResponseWriter: c.Writer}
		c.Next()
	}
}

// hwPublicReadCacheWriter delays the cache header until the status code is
// known. gin writes headers together with the first body byte, so the status
// is only available while the handler commits its answer.
type hwPublicReadCacheWriter struct {
	gin.ResponseWriter
	committed bool
}

func (w *hwPublicReadCacheWriter) WriteHeader(code int) {
	w.commit(code)
	w.ResponseWriter.WriteHeader(code)
}

func (w *hwPublicReadCacheWriter) Write(data []byte) (int, error) {
	w.commit(http.StatusOK)
	return w.ResponseWriter.Write(data)
}

// commit adds the cache header once, before the answer is flushed.
func (w *hwPublicReadCacheWriter) commit(code int) {
	if w.committed {
		return
	}
	w.committed = true
	if code < http.StatusOK || code >= http.StatusMultipleChoices {
		return
	}
	if w.Header().Get("Cache-Control") == "" {
		w.Header().Set("Cache-Control", hwPublicReadCacheControl)
	}
}

// HwPricingFeedbackRateLimit allows one address five pricing reports an hour,
// on top of the public read budget.
func HwPricingFeedbackRateLimit() func(c *gin.Context) {
	return rateLimitFactory(5, 3600, "HPF")
}
