package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"

	"github.com/gin-gonic/gin"
)

func CloseResponseBodyGracefully(httpResponse *http.Response) {
	if httpResponse == nil || httpResponse.Body == nil {
		return
	}
	err := httpResponse.Body.Close()
	if err != nil {
		common.SysError("failed to close response body: " + err.Error())
	}
}

// blockedUpstreamHeaders lists upstream response headers (lowercase) that
// expose provider-internal details and must never reach the client.
var blockedUpstreamHeaders = map[string]struct{}{
	"anthropic-organization-id":     {},
	"access-control-expose-headers": {},
}

// blockedUpstreamHeaderPrefixes lists lowercase header-name prefixes that are
// stripped as a family, e.g. all anthropic-ratelimit-* quota headers.
var blockedUpstreamHeaderPrefixes = []string{
	"anthropic-ratelimit-",
}

// ShouldCopyUpstreamHeader checks whether a given upstream response header
// should be copied to the client response. It returns false for Content-Length
// (managed separately), X-Oneapi-Request-Id (to preserve the local instance
// ID), and provider-internal headers such as anthropic-ratelimit-*. When the
// upstream header is X-Oneapi-Request-Id, the value is captured into the Gin
// context for later logging.
func ShouldCopyUpstreamHeader(c *gin.Context, k string, v []string) bool {
	if strings.EqualFold(k, "Content-Length") {
		return false
	}
	if strings.EqualFold(k, common.RequestIdKey) {
		if c != nil && len(v) > 0 {
			c.Set(common.UpstreamRequestIdKey, v[0])
		}
		return false
	}
	lower := strings.ToLower(k)
	if _, blocked := blockedUpstreamHeaders[lower]; blocked {
		logBlockedUpstreamHeader(c, k, v)
		return false
	}
	for _, prefix := range blockedUpstreamHeaderPrefixes {
		if strings.HasPrefix(lower, prefix) {
			logBlockedUpstreamHeader(c, k, v)
			return false
		}
	}
	return true
}

// logBlockedUpstreamHeader logs the name and values of an upstream header that
// was stripped by the blocklist, so operators can audit what is being removed.
// Controlled by LOG_BLOCKED_UPSTREAM_HEADERS (default true). Only blocklist
// hits are logged; the Content-Length / X-Oneapi-Request-Id exclusions are not.
func logBlockedUpstreamHeader(c *gin.Context, k string, v []string) {
	if !constant.LogBlockedUpstreamHeaders {
		return
	}
	// A typed-nil *gin.Context must not be passed to logger.LogInfo as a
	// context.Context: gin's Context.Value would panic on the nil receiver.
	var ctx context.Context
	if c != nil {
		ctx = c
	}
	logger.LogInfo(ctx, fmt.Sprintf("blocked upstream header: %s: %s", k, strings.Join(v, ", ")))
}

func IOCopyBytesGracefully(c *gin.Context, src *http.Response, data []byte) {
	if c.Writer == nil {
		return
	}

	body := io.NopCloser(bytes.NewBuffer(data))

	// We shouldn't set the header before we parse the response body, because the parse part may fail.
	// And then we will have to send an error response, but in this case, the header has already been set.
	// So the httpClient will be confused by the response.
	// For example, Postman will report error, and we cannot check the response at all.
	if src != nil {
		for k, v := range src.Header {
			if !ShouldCopyUpstreamHeader(c, k, v) {
				continue
			}
			c.Writer.Header().Set(k, v[0])
		}
	}

	// set Content-Length header manually BEFORE calling WriteHeader
	c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))

	// Write header with status code (this sends the headers)
	if src != nil {
		c.Writer.WriteHeader(src.StatusCode)
	} else {
		c.Writer.WriteHeader(http.StatusOK)
	}

	_, err := io.Copy(c.Writer, body)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("failed to copy response body: %s", err.Error()))
	}
	c.Writer.Flush()
}
