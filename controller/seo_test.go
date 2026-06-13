package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGetRobotsTxtAllowsCanonicalHost(t *testing.T) {
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
		"Allow: /",
		"Sitemap: https://flatkey.ai/sitemap.xml",
		"LLMs: https://flatkey.ai/llms.txt",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected robots.txt to contain %q, got:\n%s", expected, body)
		}
	}
}

func TestGetRobotsTxtDisallowsNonCanonicalHost(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.GET("/robots.txt", GetRobotsTxt)

	req := httptest.NewRequest(http.MethodGet, "https://router.flatkey.ai/robots.txt", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	for _, expected := range []string{
		"User-agent: *",
		"Disallow: /",
		"Sitemap: https://flatkey.ai/sitemap.xml",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected robots.txt to contain %q, got:\n%s", expected, body)
		}
	}
	if strings.Contains(body, "router.flatkey.ai") || strings.Contains(body, "Allow: /") {
		t.Fatalf("expected non-canonical robots.txt to disallow only canonical sitemap, got:\n%s", body)
	}
}
