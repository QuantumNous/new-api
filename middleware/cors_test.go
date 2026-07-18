package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func corsTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORS())
	router.GET("/resource", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	return router
}

func performCORSPreflight(t *testing.T, router *gin.Engine, origin string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodOptions, "/resource", nil)
	request.Header.Set("Origin", origin)
	request.Header.Set("Access-Control-Request-Method", http.MethodGet)
	request.Header.Set("Access-Control-Request-Headers", "authorization,content-type")
	router.ServeHTTP(recorder, request)
	return recorder
}

func TestCORSRejectsCrossOriginByDefault(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	t.Setenv("SESSION_COOKIE_TRUSTED_URL", "")

	recorder := performCORSPreflight(t, corsTestRouter(), "https://evil.example")
	require.Empty(t, recorder.Header().Get("Access-Control-Allow-Origin"))
	require.NotEqual(t, http.StatusNoContent, recorder.Code)
}

func TestCORSRejectsOriginOutsideConfiguredAllowlist(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://console.example")
	t.Setenv("SESSION_COOKIE_TRUSTED_URL", "")

	recorder := performCORSPreflight(t, corsTestRouter(), "https://evil.example")
	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.Empty(t, recorder.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSAllowsConfiguredCredentialOrigin(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://console.example, https://admin.example")
	t.Setenv("SESSION_COOKIE_TRUSTED_URL", "")

	recorder := performCORSPreflight(t, corsTestRouter(), "https://console.example")
	require.Equal(t, http.StatusNoContent, recorder.Code)
	require.Equal(t, "https://console.example", recorder.Header().Get("Access-Control-Allow-Origin"))
	require.Equal(t, "true", recorder.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORSFallsBackToTrustedSessionURLs(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	t.Setenv("SESSION_COOKIE_TRUSTED_URL", "https://console.example")

	recorder := performCORSPreflight(t, corsTestRouter(), "https://console.example")
	require.Equal(t, "https://console.example", recorder.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSRejectsWildcardAndInvalidOrigins(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "*,javascript:alert(1),https://console.example/path")
	t.Setenv("SESSION_COOKIE_TRUSTED_URL", "")

	recorder := performCORSPreflight(t, corsTestRouter(), "https://evil.example")
	require.Empty(t, recorder.Header().Get("Access-Control-Allow-Origin"))
	require.NotEqual(t, http.StatusNoContent, recorder.Code)
}

func TestCORSNormalizesTrailingSlash(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://console.example/")
	t.Setenv("SESSION_COOKIE_TRUSTED_URL", "")

	recorder := performCORSPreflight(t, corsTestRouter(), "https://console.example")
	require.Equal(t, http.StatusNoContent, recorder.Code)
	require.Equal(t, "https://console.example", recorder.Header().Get("Access-Control-Allow-Origin"))
}
