package service

import (
	"bytes"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
)

// captureLogOutput swaps gin.DefaultWriter (the INFO log sink) for a buffer
// and returns the buffer plus a restore function.
func captureLogOutput() (*bytes.Buffer, func()) {
	buf := &bytes.Buffer{}
	common.LogWriterMu.Lock()
	oldWriter := gin.DefaultWriter
	gin.DefaultWriter = buf
	common.LogWriterMu.Unlock()
	return buf, func() {
		common.LogWriterMu.Lock()
		gin.DefaultWriter = oldWriter
		common.LogWriterMu.Unlock()
	}
}

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

func TestShouldCopyUpstreamHeaderLogsBlockedHeadersWhenEnabled(t *testing.T) {
	old := constant.LogBlockedUpstreamHeaders
	constant.LogBlockedUpstreamHeaders = true
	defer func() { constant.LogBlockedUpstreamHeaders = old }()

	buf, restore := captureLogOutput()
	defer restore()

	// nil gin context must not panic and must still log
	if ShouldCopyUpstreamHeader(nil, "Anthropic-Organization-Id", []string{"org-123"}) {
		t.Fatal("header should be blocked")
	}
	out := buf.String()
	if !strings.Contains(out, "Anthropic-Organization-Id") || !strings.Contains(out, "org-123") {
		t.Errorf("expected log to contain blocked header name and value, got %q", out)
	}

	// multi-value headers log every value
	buf.Reset()
	if ShouldCopyUpstreamHeader(nil, "anthropic-ratelimit-requests-limit", []string{"100", "200"}) {
		t.Fatal("header should be blocked")
	}
	out = buf.String()
	if !strings.Contains(out, "anthropic-ratelimit-requests-limit") ||
		!strings.Contains(out, "100, 200") {
		t.Errorf("expected log to contain all blocked header values, got %q", out)
	}

	// non-nil gin context also works
	buf.Reset()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	if ShouldCopyUpstreamHeader(c, "access-control-expose-headers", []string{"x"}) {
		t.Fatal("header should be blocked")
	}
	if out = buf.String(); !strings.Contains(out, "access-control-expose-headers") {
		t.Errorf("expected log with gin context, got %q", out)
	}
}

func TestShouldCopyUpstreamHeaderDoesNotLogWhenDisabled(t *testing.T) {
	old := constant.LogBlockedUpstreamHeaders
	constant.LogBlockedUpstreamHeaders = false
	defer func() { constant.LogBlockedUpstreamHeaders = old }()

	buf, restore := captureLogOutput()
	defer restore()

	if ShouldCopyUpstreamHeader(nil, "anthropic-organization-id", []string{"org-123"}) {
		t.Fatal("header should still be blocked when logging is disabled")
	}
	if out := buf.String(); out != "" {
		t.Errorf("expected no log output when disabled, got %q", out)
	}
}

func TestShouldCopyUpstreamHeaderDoesNotLogBuiltinExclusions(t *testing.T) {
	old := constant.LogBlockedUpstreamHeaders
	constant.LogBlockedUpstreamHeaders = true
	defer func() { constant.LogBlockedUpstreamHeaders = old }()

	buf, restore := captureLogOutput()
	defer restore()

	if ShouldCopyUpstreamHeader(nil, "Content-Length", []string{"42"}) {
		t.Fatal("Content-Length should not be copied")
	}
	if ShouldCopyUpstreamHeader(nil, common.RequestIdKey, []string{"id"}) {
		t.Fatalf("%s should not be copied", common.RequestIdKey)
	}
	if out := buf.String(); out != "" {
		t.Errorf("builtin exclusions should not be logged, got %q", out)
	}
}
