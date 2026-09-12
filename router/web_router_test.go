package router

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type missingStaticTestFS struct{}

func (missingStaticTestFS) Exists(string, string) bool { return false }
func (missingStaticTestFS) Open(string) (http.File, error) {
	return nil, fs.ErrNotExist
}

func TestRecoverMissingJavaScriptChunkReloadsStaleClient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(recoverMissingStaticAsset(missingStaticTestFS{}, "new-build"))
	r.GET("/*path", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	recorder := httptest.NewRecorder()
	r.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/static/js/async/old-build.js", nil))

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "application/javascript")
	require.Contains(t, recorder.Header().Get("Cache-Control"), "no-store")
	require.Contains(t, recorder.Body.String(), "window.location.replace(url.href)")
	require.Contains(t, recorder.Body.String(), "new-build")
	require.NotContains(t, recorder.Body.String(), "import.meta")
	require.NotContains(t, recorder.Body.String(), "export")
}

func TestRecoverMissingStaticAssetDoesNotInterceptCurrentAsset(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	assets := existingStaticTestFS{paths: map[string]bool{"/static/js/current.js": true}}
	r.Use(recoverMissingStaticAsset(assets, "new-build"))
	r.GET("/*path", func(c *gin.Context) { c.String(http.StatusOK, "current") })

	recorder := httptest.NewRecorder()
	r.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/static/js/current.js", nil))

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "current", strings.TrimSpace(recorder.Body.String()))
}

type existingStaticTestFS struct {
	missingStaticTestFS
	paths map[string]bool
}

func (f existingStaticTestFS) Exists(_ string, path string) bool { return f.paths[path] }
