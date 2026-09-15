package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCacheHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name     string
		path     string
		expected string
	}{
		{
			name:     "fingerprinted static assets are immutable",
			path:     "/static/js/index.0614d5c7d4.js",
			expected: "public, max-age=31536000, immutable",
		},
		{
			name:     "the application shell is revalidated",
			path:     "/",
			expected: "no-cache",
		},
		{
			name:     "application shell query parameters do not change caching",
			path:     "/?cache_bust=1",
			expected: "no-cache",
		},
		{
			name:     "non-fingerprinted public assets keep the existing short cache",
			path:     "/favicon.ico",
			expected: "public, max-age=604800",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.Use(Cache())
			router.GET("/*path", func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})

			request := httptest.NewRequest(http.MethodGet, tt.path, nil)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			require.Equal(t, http.StatusNoContent, response.Code)
			assert.Equal(t, tt.expected, response.Header().Get("Cache-Control"))
			assert.NotEmpty(t, response.Header().Get("Cache-Version"))
		})
	}
}
