package controller

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

// Same-origin proxy for the 广告日报 landing-page thumbnails (admin only).
//
// The console never talks to the screenshot service directly: the browser
// would leak the admin console origin via Referer and hand every landing URL
// plus request metadata to a third party. Instead the frontend loads
// /api/data/ops_report_landing_thumb and the app fetches the screenshot
// server-side, with:
//   - an allowlist: only flatkey.ai landing URLs (the same host rule the
//     report itself applies), so the proxy cannot be used as an open fetcher;
//   - width clamped to sane bounds and a hard timeout + response size cap;
//   - an in-memory cache for real screenshots. thum.io returns a GIF
//     placeholder while a screenshot is being generated — placeholders are
//     passed through uncached so the real image replaces them on refetch.
//
// Multi-node (Rule 11): the cache is per-node and purely a read-through
// optimization; nodes never coordinate and serve identical content.

const (
	adsThumbTimeout       = 20 * time.Second
	adsThumbCacheTTL      = 24 * time.Hour
	adsThumbCacheMax      = 500      // entry cap
	adsThumbMaxBytes      = 4 << 20  // per-response size cap
	adsThumbCacheMaxBytes = 64 << 20 // total cached bytes cap
	adsThumbMinWidth      = 80
	adsThumbMaxWidth      = 640
	adsThumbDefWidth      = 320
)

// adsThumbTarget escapes the characters that would otherwise make the target
// URL's query/fragment read as the screenshot service's own (# would not even
// reach it). Scheme/host/path stay literal — thum.io rejects fully-encoded
// URLs with a 400.
func adsThumbTarget(rawUrl string) string {
	return strings.NewReplacer(
		"?", "%3F", "&", "%26", "=", "%3D", "#", "%23", " ", "%20",
	).Replace(rawUrl)
}

type adsThumbEntry struct {
	data        []byte
	contentType string
	fetchedAt   time.Time
}

var (
	adsThumbMu         sync.Mutex
	adsThumbCache      = map[string]*adsThumbEntry{}
	adsThumbCacheBytes int
)

// GetOpsAdsLandingThumb handles
// GET /api/data/ops_report_landing_thumb?url=&width= (admin only).
func GetOpsAdsLandingThumb(c *gin.Context) {
	// image endpoint: real HTTP status codes instead of the 200+JSON error
	// convention, so image consumers see failures as failures
	rawUrl := c.Query("url")
	if !adsDailyIsFlatkeyLanding(rawUrl) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "url is not an allowed landing page"})
		return
	}
	width, _ := strconv.Atoi(c.Query("width"))
	if width <= 0 {
		width = adsThumbDefWidth
	}
	if width < adsThumbMinWidth {
		width = adsThumbMinWidth
	}
	if width > adsThumbMaxWidth {
		width = adsThumbMaxWidth
	}
	key := fmt.Sprintf("%d|%s", width, rawUrl)

	adsThumbMu.Lock()
	entry, ok := adsThumbCache[key]
	adsThumbMu.Unlock()
	if ok && time.Since(entry.fetchedAt) < adsThumbCacheTTL {
		c.Data(http.StatusOK, entry.contentType, entry.data)
		return
	}

	client := &http.Client{Timeout: adsThumbTimeout}
	resp, err := client.Get(fmt.Sprintf("https://image.thum.io/get/width/%d/%s", width, adsThumbTarget(rawUrl)))
	if err != nil {
		common.SysError("landing thumb fetch: " + err.Error())
		c.Status(http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	// read one sentinel byte past the cap so an at-limit read is
	// distinguishable from a truncated oversized response
	body, err := io.ReadAll(io.LimitReader(resp.Body, adsThumbMaxBytes+1))
	if err != nil {
		common.SysError("landing thumb read: " + err.Error())
		c.Status(http.StatusBadGateway)
		return
	}
	if len(body) > adsThumbMaxBytes {
		common.SysError("landing thumb response exceeds size limit")
		c.Status(http.StatusBadGateway)
		return
	}
	contentType := strings.ToLower(strings.TrimSpace(resp.Header.Get("Content-Type")))
	if resp.StatusCode != http.StatusOK || !strings.HasPrefix(contentType, "image/") {
		common.SysError(fmt.Sprintf("landing thumb upstream status %d (%s)", resp.StatusCode, contentType))
		c.Status(http.StatusBadGateway)
		return
	}
	// GIF (any parameter/case variant) = "still generating" placeholder;
	// only real screenshots are cached
	if !strings.HasPrefix(contentType, "image/gif") {
		adsThumbMu.Lock()
		// bounded by entries and total bytes; a full reset is fine here —
		// a page shows a handful of thumbnails and refills instantly
		if len(adsThumbCache) >= adsThumbCacheMax ||
			adsThumbCacheBytes+len(body) > adsThumbCacheMaxBytes {
			adsThumbCache = map[string]*adsThumbEntry{}
			adsThumbCacheBytes = 0
		}
		if old, ok := adsThumbCache[key]; ok {
			adsThumbCacheBytes -= len(old.data)
		}
		adsThumbCache[key] = &adsThumbEntry{data: body, contentType: contentType, fetchedAt: time.Now()}
		adsThumbCacheBytes += len(body)
		adsThumbMu.Unlock()
	}
	c.Data(http.StatusOK, contentType, body)
}
