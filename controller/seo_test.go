package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRobotsTxt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	old := system_setting.ServerAddress
	system_setting.ServerAddress = "https://you-box.com"
	t.Cleanup(func() { system_setting.ServerAddress = old })

	engine := gin.New()
	engine.GET("/robots.txt", GetRobotsTxt)

	req := httptest.NewRequest(http.MethodGet, "/robots.txt", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get("Content-Type"), "text/plain")
	body := rec.Body.String()
	assert.Contains(t, body, "User-agent: *")
	assert.Contains(t, body, "Sitemap: https://you-box.com/sitemap.xml")
	assert.Contains(t, body, "Disallow: /console")
}

func TestGetSitemapXML(t *testing.T) {
	gin.SetMode(gin.TestMode)
	old := system_setting.ServerAddress
	system_setting.ServerAddress = "https://you-box.com"
	t.Cleanup(func() { system_setting.ServerAddress = old })

	engine := gin.New()
	engine.GET("/sitemap.xml", GetSitemapXML)

	req := httptest.NewRequest(http.MethodGet, "/sitemap.xml", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get("Content-Type"), "application/xml")
	body := rec.Body.String()
	assert.Contains(t, body, "<loc>https://you-box.com/</loc>")
	assert.Contains(t, body, "<loc>https://you-box.com/pricing</loc>")
}
