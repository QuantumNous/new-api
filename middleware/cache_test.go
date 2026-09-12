package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestWebCacheOnlyKeepsContentHashedAssets(t *testing.T) {
	for _, path := range []string{"/", "/?old=1", "/index.html", "/index.html?old=1", "/drawing", "/static/js/index.js"} {
		t.Run(path, func(t *testing.T) {
			r := gin.New()
			r.Use(Cache())
			r.GET("/*path", func(c *gin.Context) { c.String(200, "entry") })
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
			require.Contains(t, w.Header().Get("Cache-Control"), "no-store")
			require.Equal(t, "no-store", w.Header().Get("Cloudflare-CDN-Cache-Control"))
		})
	}
	r := gin.New()
	r.Use(Cache())
	r.GET("/*path", func(c *gin.Context) { c.String(http.StatusOK, "asset") })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/static/js/index.0123456789ab.js", nil))
	require.Contains(t, w.Header().Get("Cache-Control"), "immutable")
}
