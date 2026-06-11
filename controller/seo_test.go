package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func TestGetRobotsTxtUsesRequestHost(t *testing.T) {
	originalServerAddress := system_setting.ServerAddress
	system_setting.ServerAddress = ""
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
	})

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.GET("/robots.txt", GetRobotsTxt)

	req := httptest.NewRequest(http.MethodGet, "https://flatkey.ai/robots.txt", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	for _, expected := range []string{
		"User-agent: *",
		"Sitemap: https://flatkey.ai/sitemap.xml",
		"LLMs: https://flatkey.ai/llms.txt",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected robots.txt to contain %q, got:\n%s", expected, body)
		}
	}
}
