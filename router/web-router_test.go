package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const sampleIndexHTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>New API</title>
    <meta name="title" content="New API" />
    <meta name="description" content="Unified AI API gateway and admin dashboard." />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

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
	oldName := common.SystemName
	oldAddr := system_setting.ServerAddress
	common.SystemName = "BoxAI"
	system_setting.ServerAddress = "https://you-box.com"
	t.Cleanup(func() {
		common.SystemName = oldName
		system_setting.ServerAddress = oldAddr
	})

	engine := gin.New()
	engine.NoRoute(webFallbackHandler(ThemeAssets{
		DefaultIndexPage: []byte(sampleIndexHTML),
		ClassicIndexPage: []byte(sampleIndexHTML),
	}))

	request := httptest.NewRequest(http.MethodGet, "/playground", nil)
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)

	require.Equal(t, http.StatusOK, response.Code)
	assert.Equal(t, "no-cache", response.Header().Get("Cache-Control"))
	body := response.Body.String()
	assert.Contains(t, body, `name="robots" content="noindex,nofollow"`)
	assert.Contains(t, body, "<div id=\"root\"")
}

func TestWebFallbackInjectsPublicPageSEO(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldName := common.SystemName
	oldAddr := system_setting.ServerAddress
	common.SystemName = "BoxAI"
	system_setting.ServerAddress = "https://you-box.com"
	t.Cleanup(func() {
		common.SystemName = oldName
		system_setting.ServerAddress = oldAddr
	})

	engine := gin.New()
	engine.NoRoute(webFallbackHandler(ThemeAssets{
		DefaultIndexPage: []byte(sampleIndexHTML),
		ClassicIndexPage: []byte(sampleIndexHTML),
	}))

	request := httptest.NewRequest(http.MethodGet, "/pricing", nil)
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)

	require.Equal(t, http.StatusOK, response.Code)
	body := response.Body.String()
	assert.Contains(t, body, "Model Pricing | BoxAI")
	assert.Contains(t, body, `rel="canonical" href="https://you-box.com/pricing"`)
	assert.Contains(t, body, `name="robots" content="index,follow"`)
	assert.Contains(t, body, `id="seo-prerender"`)
	assert.True(t, strings.Contains(body, "<h1>"))
}
