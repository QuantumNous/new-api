package service

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
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

// ShouldCopyUpstreamHeader checks whether an upstream response header is safe
// to expose to the client. The upstream request ID is retained for local logs.
func ShouldCopyUpstreamHeader(c *gin.Context, k string, v []string) bool {
	if len(v) == 0 {
		return false
	}
	if strings.EqualFold(k, common.RequestIdKey) {
		if c != nil {
			c.Set(common.UpstreamRequestIdKey, v[0])
		}
		return false
	}

	key := strings.ToLower(k)
	switch key {
	case "alt-svc", "connection", "content-length", "content-location", "keep-alive", "link", "location", "proxy-authenticate",
		"proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade",
		"server", "server-timing", "via", "x-powered-by",
		"request-id", "www-authenticate", "x-client-request-id", "x-correlation-id", "x-request-id", "x-trace-id",
		"traceparent", "tracestate", "nel", "report-to", "reporting-endpoints",
		"set-cookie", "set-cookie2":
		return false
	}

	for _, prefix := range []string{
		"cf-", "fly-", "x-amz-", "x-backend-", "x-b3-", "x-envoy-",
		"x-served-by", "x-upstream-", "x-vercel-",
	} {
		if strings.HasPrefix(key, prefix) {
			return false
		}
	}
	return true
}

// IOCopyBytes writes one buffered upstream response and reports how many body
// bytes the downstream writer accepted. Callers that make billing decisions
// must use the returned error instead of treating a failed client write as a
// successful delivery.
func IOCopyBytes(c *gin.Context, src *http.Response, data []byte) (int, error) {
	if c.Writer == nil {
		return 0, errors.New("response writer is nil")
	}

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

	written, err := c.Writer.Write(data)
	if err == nil && written != len(data) {
		err = io.ErrShortWrite
	}
	c.Writer.Flush()
	return written, err
}

func IOCopyBytesGracefully(c *gin.Context, src *http.Response, data []byte) {
	_, err := IOCopyBytes(c, src, data)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("failed to copy response body: %s", err.Error()))
	}
}
