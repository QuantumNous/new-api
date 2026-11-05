package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHwInstallSetsHeadersAndHashesTheFinalPage pins the contract of HwInstall:
// every answer carries the security headers, and the CSP hashes describe the
// index page as it is once the server starts serving, not as it was when the
// middleware was wired.
func TestHwInstallSetsHeadersAndHashesTheFinalPage(t *testing.T) {
	previousTurnstile := common.TurnstileCheckEnabled
	common.TurnstileCheckEnabled = false
	t.Cleanup(func() {
		common.TurnstileCheckEnabled = previousTurnstile
		HwSetIndexPageScriptHashes(nil)
	})
	HwSetIndexPageScriptHashes(nil)

	gin.SetMode(gin.TestMode)
	page := []byte(`<html><script>window.theme="dark"</script></html>`)
	engine := gin.New()
	HwInstall(engine, &page)
	engine.GET("/api/example", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/example", nil))
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "nosniff", recorder.Header().Get("X-Content-Type-Options"))
	assert.Equal(t, http.StatusNotFound, hwServeAndRecord(engine, httptest.NewRequest(http.MethodGet, "/missing", nil)).Code)
	assert.Equal(t, "nosniff", hwServeAndRecord(engine, httptest.NewRequest(http.MethodGet, "/missing", nil)).Header().Get("X-Content-Type-Options"))

	hashes := HwIndexPageScriptHashes(page)
	require.Len(t, hashes, 1)
	assert.Contains(t, hwCspDirective(recorder.Header().Get("Content-Security-Policy"), "script-src"), hashes[0])

	// A page changed after the first request keeps the hashes of the page that
	// was served first: the calculation runs exactly once.
	assert.NotEqual(t, hashes, HwIndexPageScriptHashes([]byte(`<html><script>window.theme="light"</script></html>`)))
	recorder = hwServeAndRecord(engine, httptest.NewRequest(http.MethodGet, "/api/example", nil))
	assert.Contains(t, hwCspDirective(recorder.Header().Get("Content-Security-Policy"), "script-src"), hashes[0])
}
