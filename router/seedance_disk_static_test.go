package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestSeedanceDiskOverrideServesLiveFile(t *testing.T) {
	gin.SetMode(gin.TestMode)
	common.SetTheme("classic")

	tmp := t.TempDir()
	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(tmp); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(oldWd) })

	rel := filepath.Join("web", "classic", "public", "seedance-debug.html")
	if err := os.MkdirAll(filepath.Dir(rel), 0o755); err != nil {
		t.Fatal(err)
	}
	const body = "<html>live-seedance</html>"
	if err := os.WriteFile(rel, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}

	r := gin.New()
	r.Use(seedanceDiskOverride())
	r.GET("/seedance-debug.html", func(c *gin.Context) {
		c.String(http.StatusOK, "embedded")
	})

	req := httptest.NewRequest(http.MethodGet, "/seedance-debug.html", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Body.String(); got != body {
		t.Fatalf("body = %q, want live disk content", got)
	}
	if cc := w.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Fatalf("Cache-Control = %q, want no-cache", cc)
	}
}

func TestSeedanceDiskOverrideFallsBackWhenMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	common.SetTheme("classic")

	tmp := t.TempDir()
	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(tmp); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(oldWd) })

	r := gin.New()
	r.Use(seedanceDiskOverride())
	r.GET("/seedance-debug.html", func(c *gin.Context) {
		c.String(http.StatusOK, "embedded")
	})

	req := httptest.NewRequest(http.MethodGet, "/seedance-debug.html", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if got := w.Body.String(); got != "embedded" {
		t.Fatalf("body = %q, want embedded fallback", got)
	}
}
