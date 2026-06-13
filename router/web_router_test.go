package router

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestShouldInjectGoogleTagManager(t *testing.T) {
	tests := []struct {
		name string
		path string
		want bool
	}{
		{name: "home page", path: "/", want: true},
		{name: "default product dashboard", path: "/dashboard", want: true},
		{name: "default product wallet", path: "/wallet", want: true},
		{name: "classic product console", path: "/console", want: true},
		{name: "classic product topup", path: "/console/topup", want: true},
		{name: "default admin channels", path: "/channels", want: false},
		{name: "default admin users", path: "/users", want: false},
		{name: "default admin settings", path: "/system-settings/site", want: false},
		{name: "classic admin channel", path: "/console/channel", want: false},
		{name: "classic admin settings", path: "/console/setting", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shouldInjectGoogleTagManager(tt.path); got != tt.want {
				t.Fatalf("shouldInjectGoogleTagManager(%q) = %v, want %v", tt.path, got, tt.want)
			}
		})
	}
}

func TestInjectGoogleTagManagerAddsHeadAndBodySnippetsOnce(t *testing.T) {
	indexPage := []byte(`<!doctype html><html><head><title>App</title></head><body><div id="root"></div></body></html>`)

	injected := injectGoogleTagManager(indexPage)

	if !bytes.Contains(injected, []byte("www.googletagmanager.com/gtm.js")) ||
		!bytes.Contains(injected, []byte(googleTagManagerID)) {
		t.Fatalf("expected GTM head script to be injected, got %s", injected)
	}
	if !bytes.Contains(injected, []byte("https://www.googletagmanager.com/ns.html?id=GTM-NKH9LPX9")) {
		t.Fatalf("expected GTM noscript iframe to be injected, got %s", injected)
	}

	injectedAgain := injectGoogleTagManager(injected)
	if bytes.Count(injectedAgain, []byte(googleTagManagerID)) != bytes.Count(injected, []byte(googleTagManagerID)) {
		t.Fatalf("expected GTM injection to be idempotent")
	}
}

func TestPublicWWWRedirectPolicyRedirectsToApex(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(publicWWWRedirectPolicy())
	engine.GET("/blog/:slug", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "https://www.flatkey.ai/blog/gateway-guide?ref=seo", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusPermanentRedirect {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Location"); got != "https://flatkey.ai/blog/gateway-guide?ref=seo" {
		t.Fatalf("Location=%q, want https://flatkey.ai/blog/gateway-guide?ref=seo", got)
	}
}

func TestPublicWWWRedirectPolicyIgnoresOtherHosts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(publicWWWRedirectPolicy())
	engine.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "https://router.flatkey.ai/", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Location"); got != "" {
		t.Fatalf("Location=%q, want empty", got)
	}
}

func TestPublicSearchIndexPolicyAddsNoindexForNonCanonicalHost(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(publicSearchIndexPolicy())
	engine.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "https://router.flatkey.ai/", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if got := rec.Header().Get("X-Robots-Tag"); got != "noindex, nofollow" {
		t.Fatalf("X-Robots-Tag=%q, want noindex, nofollow", got)
	}
}

func TestPublicSearchIndexPolicyAllowsCanonicalHost(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(publicSearchIndexPolicy())
	engine.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "https://flatkey.ai/", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if got := rec.Header().Get("X-Robots-Tag"); got != "" {
		t.Fatalf("X-Robots-Tag=%q, want empty", got)
	}
}
