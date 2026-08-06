package router

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func testWebAssets(nextIndex string) WebAssets {
	return WebAssets{
		BuildFS: fstest.MapFS{
			"web/dist/index.html":       {Data: []byte("legacy-index")},
			"web/dist/assets/legacy.js": {Data: []byte("legacy-asset")},
		},
		IndexPage: []byte("legacy-index"),
		NextBuildFS: fstest.MapFS{
			"frontend/embed-dist/index.html":    {Data: []byte(nextIndex)},
			"frontend/embed-dist/assets/app.js": {Data: []byte("next-asset")},
		},
		NextIndexPage: []byte(nextIndex),
	}
}

func serveWebRequest(t *testing.T, assets WebAssets, requestPath string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetWebRouter(engine, assets)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, requestPath, nil))
	return recorder
}

func TestNextFrontendRoutesAndAssets(t *testing.T) {
	t.Setenv("NEXT_FRONTEND_ENABLED", "true")
	assets := testWebAssets("next-index")

	for _, requestPath := range []string{"/next", "/next/", "/next/console/keys"} {
		recorder := serveWebRequest(t, assets, requestPath)
		require.Equal(t, http.StatusOK, recorder.Code)
		require.Equal(t, "next-index", recorder.Body.String())
		require.Equal(t, "no-cache", recorder.Header().Get("Cache-Control"))
	}

	asset := serveWebRequest(t, assets, "/next/assets/app.js")
	require.Equal(t, http.StatusOK, asset.Code)
	require.Equal(t, "next-asset", asset.Body.String())
	require.Equal(t, "public, max-age=31536000, immutable", asset.Header().Get("Cache-Control"))
}

func TestNextFrontendDoesNotFallbackForMissingAssets(t *testing.T) {
	t.Setenv("NEXT_FRONTEND_ENABLED", "true")
	recorder := serveWebRequest(t, testWebAssets("next-index"), "/next/assets/missing.js")

	require.Equal(t, http.StatusNotFound, recorder.Code)
	require.NotContains(t, recorder.Body.String(), "next-index")
}

func TestNextFrontendPlaceholderReturnsServiceUnavailable(t *testing.T) {
	t.Setenv("NEXT_FRONTEND_ENABLED", "true")
	placeholder := `<meta name="ren2hub-next-build" content="placeholder">`
	recorder := serveWebRequest(t, testWebAssets(placeholder), "/next/console/keys")

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.Equal(t, "no-cache", recorder.Header().Get("Cache-Control"))
}

func TestNextFrontendCanBeDisabled(t *testing.T) {
	t.Setenv("NEXT_FRONTEND_ENABLED", "false")
	recorder := serveWebRequest(t, testWebAssets("next-index"), "/next/")

	require.Equal(t, http.StatusNotFound, recorder.Code)
}

func TestBackendPrefixesNeverFallbackToSpa(t *testing.T) {
	t.Setenv("NEXT_FRONTEND_ENABLED", "true")
	assets := testWebAssets("next-index")

	for _, requestPath := range []string{"/api/missing", "/v1/missing", "/mj/missing", "/pg/missing"} {
		recorder := serveWebRequest(t, assets, requestPath)
		require.Equal(t, http.StatusNotFound, recorder.Code)
		require.NotContains(t, recorder.Body.String(), "legacy-index")
		require.NotContains(t, recorder.Body.String(), "next-index")
	}
}
