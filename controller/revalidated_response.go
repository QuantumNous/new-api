package controller

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// serveRevalidatedJSON writes payload as JSON with a weak content-derived ETag
// and answers conditional requests with 304 Not Modified.
//
// Intended for small, public, admin-editable payloads (notice, home page
// content) that every anonymous visitor fetches on page load. The goal is to
// make those fetches cheap without ever serving stale content:
//
//   - The ETag is a hash of the response body, so it is identical across
//     replicas. Deriving it from a timestamp would not be, and the Option table
//     has no updated_at column to derive one from anyway.
//   - The validator is weak (W/ prefixed) because /api is gzip-compressed by
//     middleware that runs after this handler returns. The hash is computed over
//     the uncompressed body, so the compressed and identity forms of one payload
//     share a validator, and a strong ETag asserts byte-for-byte equality that
//     does not hold across encodings (RFC 9110 §8.8.1). Weakening it costs
//     nothing here: conditional GET compares weakly anyway, and these payloads
//     are a few hundred bytes of JSON that no client Range-requests.
//   - Cache-Control is "no-cache", which means "may be stored, but must be
//     revalidated before reuse" (RFC 9111 §5.2.2.4). Browsers and CDNs both
//     revalidate on every request, so an admin edit takes effect immediately.
//     max-age/s-maxage are deliberately not set: upstream cannot assume how
//     long any given deployment tolerates a stale notice.
//   - Vary: Accept-Encoding is still required. Weakening the validator makes
//     revalidation correct, but it does not separate the two encodings in a
//     shared cache. Without Vary, a cache holding the gzip copy would hand those
//     bytes to a client that never sent Accept-Encoding: gzip.
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
	etag := `W/"` + hex.EncodeToString(digest[:]) + `"`

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
// The field is a comma-separated list of entity-tags or the wildcard "*".
//
// Weak comparison ignores the W/ prefix on both operands, so it must be
// stripped from the served etag as well as from each candidate. Stripping only
// the candidate would make a weak served validator match nothing, silently
// disabling 304 responses.
func etagMatches(ifNoneMatch string, etag string) bool {
	ifNoneMatch = strings.TrimSpace(ifNoneMatch)
	if ifNoneMatch == "" {
		return false
	}
	if ifNoneMatch == "*" {
		return true
	}
	etag = strings.TrimPrefix(etag, "W/")
	for _, candidate := range strings.Split(ifNoneMatch, ",") {
		if strings.TrimPrefix(strings.TrimSpace(candidate), "W/") == etag {
			return true
		}
	}
	return false
}
