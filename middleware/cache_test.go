package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func cacheHeaderForPath(path string) string {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Cache())
	router.GET("/*path", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
	return recorder.Header().Get("Cache-Control")
}

func TestCacheUsesImmutablePolicyForFingerprintedAssets(t *testing.T) {
	require.Equal(t, "public, max-age=31536000, immutable", cacheHeaderForPath("/static/js/index.457aecb830.js?theme=default"))
	require.Equal(t, "public, max-age=31536000, immutable", cacheHeaderForPath("/static/font/public-sans.035c7fe496.woff2"))
}

func TestCacheRevalidatesHTMLAndStableAssets(t *testing.T) {
	require.Equal(t, "no-cache", cacheHeaderForPath("/dashboard"))
	require.Equal(t, "no-cache", cacheHeaderForPath("/favicon.ico"))
}
