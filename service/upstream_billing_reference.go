package service

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// upstreamBillingReferenceKey is intentionally private: the value comes only
// from a successful upstream HTTP response, never from a client request.
const upstreamBillingReferenceKey = "upstream_billing_reference"

var upstreamBillingReferencePattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`)

// CaptureUpstreamBillingReference saves a narrow, opaque supplier correlation
// value for the request's later consumption log. It never changes the local
// X-Oneapi-Request-Id, which remains the authoritative customer/billing ID.
func CaptureUpstreamBillingReference(c *gin.Context, response *http.Response) {
	if c == nil || response == nil || response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return
	}
	for _, header := range []string{"X-Request-Id", "Request-Id", "X-Provider-Request-Id"} {
		value := strings.TrimSpace(response.Header.Get(header))
		if upstreamBillingReferencePattern.MatchString(value) {
			c.Set(upstreamBillingReferenceKey, value)
			return
		}
	}
}

func appendUpstreamBillingReference(c *gin.Context, other map[string]interface{}) {
	if c == nil || other == nil {
		return
	}
	if value := c.GetString(upstreamBillingReferenceKey); upstreamBillingReferencePattern.MatchString(value) {
		other["upstream_request_id"] = value
	}
}
