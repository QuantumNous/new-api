package controller

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// serveRevalidatedJSON writes payload as JSON with a strong content-derived
// ETag and answers conditional requests with 304 Not Modified.
//
// Intended for small, public, admin-editable payloads (notice, home page
// content) that every anonymous visitor fetches on page load. The goal is to
// make those fetches cheap without ever serving stale content:
//
//   - The ETag is a hash of the response body, so it is identical across
//     replicas. Deriving it from a timestamp would not be, and the Option table
//     has no updated_at column to derive one from anyway.
//   - Cache-Control is "no-cache", which means "may be stored, but must be
//     revalidated before reuse" (RFC 9111 §5.2.2.4). Browsers and CDNs both
//     revalidate on every request, so an admin edit takes effect immediately.
//     max-age/s-maxage are deliberately not set: upstream cannot assume how
//     long any given deployment tolerates a stale notice.
//   - Vary: Accept-Encoding is required, not decorative. The ETag is computed
//     on the uncompressed body, but /api is gzip-compressed by middleware that
//     runs after this handler, so the compressed and identity representations
//     end up sharing one validator. Without Vary, a shared cache holding the
//     gzip copy would hand those bytes to a client that never sent
//     Accept-Encoding: gzip, and revalidation could not catch it because the
//     validator matches.
func serveRevalidatedJSON(c *gin.Context, payload any) {
	body, err := common.Marshal(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	digest := sha256.Sum256(body)
	etag := `"` + hex.EncodeToString(digest[:]) + `"`

	c.Header("ETag", etag)
	c.Header("Cache-Control", "no-cache")
	c.Header("Vary", "Accept-Encoding")

	if etagMatches(c.GetHeader("If-None-Match"), etag) {
		c.Status(http.StatusNotModified)
		return
	}

	c.Data(http.StatusOK, "application/json; charset=utf-8", body)
}

// etagMatches reports whether an If-None-Match header field matches etag,
// using the weak comparison required for conditional GET (RFC 9110 §13.1.2).
// The field is a comma-separated list of entity-tags or the wildcard "*", and
// each entry may carry a W/ prefix that is ignored when comparing.
func etagMatches(ifNoneMatch string, etag string) bool {
	ifNoneMatch = strings.TrimSpace(ifNoneMatch)
	if ifNoneMatch == "" {
		return false
	}
	if ifNoneMatch == "*" {
		return true
	}
	for _, candidate := range strings.Split(ifNoneMatch, ",") {
		if strings.TrimPrefix(strings.TrimSpace(candidate), "W/") == etag {
			return true
		}
	}
	return false
}
