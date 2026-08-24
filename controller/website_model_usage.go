package controller

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"golang.org/x/sync/singleflight"
)

// WEBSITE_METRICS_KEY gates the public website's read-only usage feed. The
// website calls this server-side (never from the browser) with the shared key.
//
// The dashboard's own /api/data routes are admin/user scoped and expose quota,
// usernames, and per-channel spend. This endpoint deliberately exposes only the
// daily call count for one model: no money, no users, no channels. Even so it
// is not left open, because per-model call volume is competitive information.
//
// Unset key => endpoint disabled (404). A deployment that has not configured a
// key must not silently serve the data.
const websiteMetricsKeyEnv = "WEBSITE_METRICS_KEY"

// Bounds the scan: the website charts a month, and an unbounded range would let
// a caller walk the whole table one request at a time.
const websiteModelUsageMaxDays = 90

// The series is bucketed by UTC day, so it only changes when the day rolls
// over. Caching until the next UTC midnight means one aggregation query per
// (model, days) per day no matter how much traffic the model pages take -- the
// quota_data scan is the expensive part, and repeating it per request is what
// would flood the database.
//
// The cache key carries the UTC date, so a stale entry cannot outlive its day
// even if the TTL is missed.
const websiteModelUsageCachePrefix = "website:model-usage:"

// Redis is shared across nodes, so the cache is coherent in the multi-node
// deployment. Without Redis every node keeps its own in-process copy: still one
// query per node per day, which is the same bound, just multiplied by node
// count. The local entry carries its own expiry because sync.Map has no TTL
// semantics and the cache key changes at every UTC midnight.
type websiteModelUsageLocalCacheEntry struct {
	payload   websiteModelUsageResponse
	expiresAt time.Time
}

var websiteModelUsageLocalCache sync.Map // cacheKey -> websiteModelUsageLocalCacheEntry

// singleflight coalesces a miss per process. Redis remains the cross-node
// cache; this prevents a cold key from making every request on one node scan
// quota_data concurrently while Redis is unavailable or the day just rolled.
var websiteModelUsageLoadGroup singleflight.Group

func websiteModelUsageCacheKey(modelName string, days int, now time.Time) string {
	return fmt.Sprintf("%s%s:%d:%s", websiteModelUsageCachePrefix, modelName, days, now.UTC().Format("2006-01-02"))
}

// Seconds remaining until the next UTC midnight, floored at a minute so a
// request landing on the boundary still caches for a usable window.
func websiteModelUsageCacheTTL(now time.Time) time.Duration {
	nextDay := now.UTC().Truncate(24 * time.Hour).Add(24 * time.Hour)
	ttl := nextDay.Sub(now.UTC())
	if ttl < time.Minute {
		return time.Minute
	}
	return ttl
}

func loadCachedWebsiteModelUsage(cacheKey string) (websiteModelUsageResponse, bool) {
	if common.RedisEnabled {
		raw, err := common.RedisGet(cacheKey)
		if err == nil && raw != "" {
			var cached websiteModelUsageResponse
			if err := common.UnmarshalJsonStr(raw, &cached); err == nil {
				return cached, true
			}
		}
	}
	if value, ok := websiteModelUsageLocalCache.Load(cacheKey); ok {
		cached, ok := value.(websiteModelUsageLocalCacheEntry)
		if !ok {
			websiteModelUsageLocalCache.Delete(cacheKey)
			return websiteModelUsageResponse{}, false
		}
		if time.Now().Before(cached.expiresAt) {
			return cached.payload, true
		}
		websiteModelUsageLocalCache.Delete(cacheKey)
	}
	return websiteModelUsageResponse{}, false
}

func storeCachedWebsiteModelUsage(cacheKey string, payload websiteModelUsageResponse, ttl time.Duration) {
	// Always keep the local copy: it serves the next request on this node even
	// when Redis is down, and the day-scoped key keeps it from going stale.
	websiteModelUsageLocalCache.Store(cacheKey, websiteModelUsageLocalCacheEntry{
		payload:   payload,
		expiresAt: time.Now().Add(ttl),
	})
	if !common.RedisEnabled {
		return
	}
	encoded, err := common.Marshal(payload)
	if err != nil {
		return
	}
	if err := common.RedisSet(cacheKey, string(encoded), ttl); err != nil {
		common.SysError("failed to cache website model usage: " + err.Error())
	}
}

type websiteModelUsagePoint struct {
	// Unix seconds at UTC day start.
	Date  int64 `json:"date"`
	Count int   `json:"count"`
}

type websiteModelUsageResponse struct {
	Success bool                     `json:"success"`
	Model   string                   `json:"model"`
	Days    int                      `json:"days"`
	Total   int                      `json:"total"`
	Points  []websiteModelUsagePoint `json:"points"`
}

// GetWebsiteModelUsage returns the daily request count for a single model.
//
// GET /api/website/model-usage?model=<name>&days=<n>
// Header: X-Website-Metrics-Key: <WEBSITE_METRICS_KEY>
func GetWebsiteModelUsage(c *gin.Context) {
	configuredKey := strings.TrimSpace(common.GetEnvOrDefaultString(websiteMetricsKeyEnv, ""))
	if configuredKey == "" {
		// 404 rather than 503: an unconfigured deployment should not advertise
		// that this endpoint exists.
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "not found"})
		return
	}

	presented := strings.TrimSpace(c.GetHeader("X-Website-Metrics-Key"))
	// Constant-time compare so a caller cannot recover the key byte by byte.
	if subtle.ConstantTimeCompare([]byte(presented), []byte(configuredKey)) != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "unauthorized"})
		return
	}

	modelName := strings.TrimSpace(c.Query("model"))
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "model is required"})
		return
	}
	if len(modelName) > 128 || !isValidWebsiteModelName(modelName) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid model"})
		return
	}

	days := common.String2Int(c.Query("days"))
	if days <= 0 {
		days = 30
	}
	if days > websiteModelUsageMaxDays {
		days = websiteModelUsageMaxDays
	}

	now := time.Now()
	cacheKey := websiteModelUsageCacheKey(modelName, days, now)
	if cached, ok := loadCachedWebsiteModelUsage(cacheKey); ok {
		writeWebsiteModelUsage(c, cached, now)
		return
	}

	result, err, _ := websiteModelUsageLoadGroup.Do(cacheKey, func() (any, error) {
		// A second caller can arrive after the first fast-path check but before
		// it joins the flight. Check Redis/local cache again inside the group.
		if cached, ok := loadCachedWebsiteModelUsage(cacheKey); ok {
			return cached, nil
		}
		payload, err := buildWebsiteModelUsagePayload(modelName, days, now)
		if err != nil {
			return nil, err
		}
		storeCachedWebsiteModelUsage(cacheKey, payload, websiteModelUsageCacheTTL(now))
		return payload, nil
	})
	if err != nil {
		common.SysError("failed to load website model usage: " + err.Error())
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "usage temporarily unavailable",
		})
		return
	}
	payload, ok := result.(websiteModelUsageResponse)
	if !ok {
		common.SysError("failed to load website model usage: unexpected result type")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "usage temporarily unavailable",
		})
		return
	}
	writeWebsiteModelUsage(c, payload, now)
}

func buildWebsiteModelUsagePayload(modelName string, days int, now time.Time) (websiteModelUsageResponse, error) {
	// quota_data rows are bucketed hourly; align the window to UTC day starts so
	// the first and last buckets are whole days rather than partial ones.
	endOfToday := now.UTC().Truncate(24 * time.Hour).Add(24 * time.Hour)
	start := endOfToday.Add(-time.Duration(days) * 24 * time.Hour)

	rows, err := model.GetModelDailyUsage(modelName, start.Unix(), endOfToday.Unix())
	if err != nil {
		return websiteModelUsageResponse{}, err
	}

	points := make([]websiteModelUsagePoint, 0, len(rows))
	total := 0
	for _, row := range rows {
		points = append(points, websiteModelUsagePoint{Date: row.Date, Count: row.Count})
		total += row.Count
	}
	sort.Slice(points, func(i, j int) bool { return points[i].Date < points[j].Date })

	return websiteModelUsageResponse{
		Success: true,
		Model:   modelName,
		Days:    days,
		Total:   total,
		Points:  points,
	}, nil
}

func isValidWebsiteModelName(modelName string) bool {
	for _, char := range modelName {
		if (char >= 'a' && char <= 'z') ||
			(char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') ||
			strings.ContainsRune("._:/@+*-", char) {
			continue
		}
		return false
	}
	return modelName != ""
}

// Downstream caches (the website's fetch, any CDN in front) expire on the same
// UTC-day boundary as the server-side entry, so a client cannot hold a copy
// past the point where the series has moved on.
func writeWebsiteModelUsage(c *gin.Context, payload websiteModelUsageResponse, now time.Time) {
	maxAge := int(websiteModelUsageCacheTTL(now).Seconds())
	// The response is keyed by a secret request header. Never let a shared CDN
	// cache an authorised body and replay it for a later unauthorised request.
	c.Header("Cache-Control", fmt.Sprintf("private, max-age=%d, must-revalidate", maxAge))
	c.Header("Vary", "X-Website-Metrics-Key")
	c.JSON(http.StatusOK, payload)
}
