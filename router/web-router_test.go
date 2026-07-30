package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWebFallbackDoesNotServeIndexForMissingStaticAssets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(middleware.Cache())
	engine.NoRoute(webFallbackHandler(ThemeAssets{
		DefaultIndexPage: []byte("default index"),
		ClassicIndexPage: []byte("classic index"),
	}))

	for _, requestPath := range []string{
		"/static",
		"/static/js/missing.js",
		"/static/css/missing.css",
		"/assets/missing.js",
	} {
		t.Run(requestPath, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, requestPath, nil)
			response := httptest.NewRecorder()
			engine.ServeHTTP(response, request)

			assert.Equal(t, http.StatusNotFound, response.Code)
			assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))
			assert.NotContains(t, response.Body.String(), "index")
		})
	}
}

func TestWebFallbackServesIndexForClientRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.NoRoute(webFallbackHandler(ThemeAssets{
		DefaultIndexPage: []byte("index"),
		ClassicIndexPage: []byte("index"),
	}))

	request := httptest.NewRequest(http.MethodGet, "/playground", nil)
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)

	require.Equal(t, http.StatusOK, response.Code)
	assert.Equal(t, "no-cache", response.Header().Get("Cache-Control"))
	assert.Equal(t, "index", response.Body.String())
}
