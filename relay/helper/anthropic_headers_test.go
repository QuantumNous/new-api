package helper

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
)

// setNormalize flips ClaudeSettings.ResponseNormalizeEnabled for a test and
// restores it on cleanup (test-state isolation).
func setNormalize(t *testing.T, enabled bool) {
	t.Helper()
	settings := model_setting.GetClaudeSettings()
	old := settings.ResponseNormalizeEnabled
	settings.ResponseNormalizeEnabled = enabled
	t.Cleanup(func() { settings.ResponseNormalizeEnabled = old })
}

func TestFinalizeAnthropicResponseHeadersEnabled(t *testing.T) {
	setNormalize(t, true)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set(common.RequestIdKey, "internal-id-xyz")
	// simulate the global request-id middleware having already written the header
	c.Writer.Header().Set(common.RequestIdKey, "internal-id-xyz")

	FinalizeAnthropicResponseHeaders(c)

	if got := c.Writer.Header().Get(common.RequestIdKey); got != "" {
		t.Errorf("X-Oneapi-Request-Id should be removed, got %q", got)
	}
	reqID := c.Writer.Header().Get("request-id")
	if !strings.HasPrefix(reqID, "req_01") {
		t.Errorf("expected request-id req_01..., got %q", reqID)
	}
	// deterministic: must equal the pure encoder for the same internal id
	// (timestamp differs by call time, so just assert prefix + length here).
	if len(reqID) != len("req_")+24 {
		t.Errorf("unexpected request-id length: %q", reqID)
	}
}

func TestFinalizeAnthropicResponseHeadersDisabled(t *testing.T) {
	setNormalize(t, false)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set(common.RequestIdKey, "internal-id-xyz")
	c.Writer.Header().Set(common.RequestIdKey, "internal-id-xyz")

	FinalizeAnthropicResponseHeaders(c)

	if got := c.Writer.Header().Get(common.RequestIdKey); got != "internal-id-xyz" {
		t.Errorf("when disabled, X-Oneapi-Request-Id must be preserved, got %q", got)
	}
	if got := c.Writer.Header().Get("request-id"); got != "" {
		t.Errorf("when disabled, request-id must not be set, got %q", got)
	}
}

func TestFinalizeAnthropicResponseHeadersIdempotent(t *testing.T) {
	setNormalize(t, true)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set(common.RequestIdKey, "internal-id-xyz")

	FinalizeAnthropicResponseHeaders(c)
	first := c.Writer.Header().Get("request-id")
	FinalizeAnthropicResponseHeaders(c)
	second := c.Writer.Header().Get("request-id")

	if first != second {
		t.Errorf("second call must be a no-op: %q != %q", first, second)
	}
}

func TestFinalizeAnthropicResponseHeadersNoInternalID(t *testing.T) {
	setNormalize(t, true)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Writer.Header().Set(common.RequestIdKey, "internal-id-xyz")

	FinalizeAnthropicResponseHeaders(c)

	// internal header still stripped so we never leak it
	if got := c.Writer.Header().Get(common.RequestIdKey); got != "" {
		t.Errorf("internal header should be stripped, got %q", got)
	}
	// but no request-id we cannot reverse-map
	if got := c.Writer.Header().Get("request-id"); got != "" {
		t.Errorf("no request-id should be emitted without an internal id, got %q", got)
	}
}
