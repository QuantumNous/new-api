package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

func TestShouldCopyUpstreamHeaderBlocksProviderInternalHeaders(t *testing.T) {
	blocked := []string{
		"anthropic-organization-id",
		"Anthropic-Organization-Id",
		"anthropic-ratelimit-requests-limit",
		"anthropic-ratelimit-requests-remaining",
		"anthropic-ratelimit-requests-reset",
		"anthropic-ratelimit-input-tokens-limit",
		"anthropic-ratelimit-output-tokens-remaining",
		"anthropic-ratelimit-tokens-reset",
		"Anthropic-Ratelimit-Tokens-Limit",
		"access-control-expose-headers",
		"Access-Control-Expose-Headers",
	}
	for _, h := range blocked {
		if ShouldCopyUpstreamHeader(nil, h, []string{"x"}) {
			t.Errorf("header %q should be blocked", h)
		}
	}
}

func TestShouldCopyUpstreamHeaderAllowsNormalHeaders(t *testing.T) {
	allowed := []string{
		"Content-Type",
		"Cache-Control",
		"request-id",
		"anthropic-version",
	}
	for _, h := range allowed {
		if !ShouldCopyUpstreamHeader(nil, h, []string{"x"}) {
			t.Errorf("header %q should be copied", h)
		}
	}
}

func TestShouldCopyUpstreamHeaderCapturesRequestId(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	if ShouldCopyUpstreamHeader(c, common.RequestIdKey, []string{"upstream-id"}) {
		t.Errorf("header %q should not be copied", common.RequestIdKey)
	}
	if got := c.GetString(common.UpstreamRequestIdKey); got != "upstream-id" {
		t.Errorf("expected upstream request id to be captured, got %q", got)
	}
}
