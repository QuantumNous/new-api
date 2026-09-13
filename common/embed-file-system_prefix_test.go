package common

import (
	"embed"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

//go:embed route_prefix_testdata/*
var routePrefixTestFS embed.FS

func TestEmbedFolderExistsStripsPrefix(t *testing.T) {
	fs := EmbedFolder(routePrefixTestFS, "route_prefix_testdata")
	assert.True(t, fs.Exists("/proxy/", "/proxy/assets/app.js"))
	assert.False(t, fs.Exists("/", "/proxy/assets/app.js"))
	assert.True(t, fs.Exists("/", "/assets/app.js"))
}

func TestEmbedFolderStaticServeHonoursPrefix(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	handler := static.Serve("/proxy/", EmbedFolder(routePrefixTestFS, "route_prefix_testdata"))
	engine.NoRoute(handler)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/proxy/assets/app.js", nil)
	engine.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "console.log('app')")

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/proxy/assets/missing.js", nil)
	engine.ServeHTTP(rec, req)
	assert.NotEqual(t, http.StatusOK, rec.Code)
}
