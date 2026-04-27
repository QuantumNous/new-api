package router

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestSetRouterWithoutBasePath(t *testing.T) {
	engine := newTestEngine(t, "")

	resp := performRequest(engine, http.MethodGet, "/api/status")
	if resp.Code != http.StatusOK {
		t.Fatalf("GET /api/status status = %d, want %d", resp.Code, http.StatusOK)
	}

	spaResp := performRequest(engine, http.MethodGet, "/console")
	if spaResp.Code != http.StatusOK {
		t.Fatalf("GET /console status = %d, want %d", spaResp.Code, http.StatusOK)
	}
	if !strings.Contains(spaResp.Body.String(), "test index") {
		t.Fatalf("GET /console body = %q, want SPA index", spaResp.Body.String())
	}
}

func TestSetRouterWithBasePath(t *testing.T) {
	engine := newTestEngine(t, "/new-api")

	indexResp := performRequest(engine, http.MethodGet, "/new-api")
	if indexResp.Code != http.StatusMovedPermanently {
		t.Fatalf("GET /new-api status = %d, want %d", indexResp.Code, http.StatusMovedPermanently)
	}
	if location := indexResp.Header().Get("Location"); location != "/new-api/" {
		t.Fatalf("GET /new-api redirect location = %q, want %q", location, "/new-api/")
	}

	slashResp := performRequest(engine, http.MethodGet, "/new-api/")
	if slashResp.Code != http.StatusOK {
		t.Fatalf("GET /new-api/ status = %d, want %d", slashResp.Code, http.StatusOK)
	}
	if !strings.Contains(slashResp.Body.String(), "test index") {
		t.Fatalf("GET /new-api/ body = %q, want SPA index", slashResp.Body.String())
	}

	consoleResp := performRequest(engine, http.MethodGet, "/new-api/console/channel")
	if consoleResp.Code != http.StatusOK {
		t.Fatalf("GET /new-api/console/channel status = %d, want %d", consoleResp.Code, http.StatusOK)
	}
	if !strings.Contains(consoleResp.Body.String(), "test index") {
		t.Fatalf("GET /new-api/console/channel body = %q, want SPA index", consoleResp.Body.String())
	}

	assetResp := performRequest(engine, http.MethodGet, "/new-api/assets/app.js")
	if assetResp.Code != http.StatusOK {
		t.Fatalf("GET /new-api/assets/app.js status = %d, want %d", assetResp.Code, http.StatusOK)
	}
	if !strings.Contains(assetResp.Body.String(), "asset-ok") {
		t.Fatalf("GET /new-api/assets/app.js body = %q, want asset contents", assetResp.Body.String())
	}

	apiNotFound := performRequest(engine, http.MethodGet, "/new-api/api/unknown")
	if apiNotFound.Code != http.StatusNotFound {
		t.Fatalf("GET /new-api/api/unknown status = %d, want %d", apiNotFound.Code, http.StatusNotFound)
	}
	if !strings.Contains(apiNotFound.Body.String(), "\"error\"") {
		t.Fatalf("GET /new-api/api/unknown body = %q, want API not-found payload", apiNotFound.Body.String())
	}

	rootResp := performRequest(engine, http.MethodGet, "/")
	if rootResp.Code != http.StatusNotFound {
		t.Fatalf("GET / status = %d, want %d", rootResp.Code, http.StatusNotFound)
	}

	rootAPIResp := performRequest(engine, http.MethodGet, "/api/status")
	if rootAPIResp.Code != http.StatusNotFound {
		t.Fatalf("GET /api/status status = %d, want %d", rootAPIResp.Code, http.StatusNotFound)
	}
}

func TestSetRouterWithFrontendBaseURLAndBasePath(t *testing.T) {
	engine := newTestEngineWithFrontendBaseURL(t, "/new-api", "https://cdn.example.com")

	consoleResp := performRequest(engine, http.MethodGet, "/new-api/console?x=1")
	if consoleResp.Code != http.StatusMovedPermanently {
		t.Fatalf("GET /new-api/console status = %d, want %d", consoleResp.Code, http.StatusMovedPermanently)
	}
	if location := consoleResp.Header().Get("Location"); location != "https://cdn.example.com/new-api/console?x=1" {
		t.Fatalf("GET /new-api/console redirect location = %q, want %q", location, "https://cdn.example.com/new-api/console?x=1")
	}

	rootResp := performRequest(engine, http.MethodGet, "/console")
	if rootResp.Code != http.StatusNotFound {
		t.Fatalf("GET /console status = %d, want %d", rootResp.Code, http.StatusNotFound)
	}
}

func newTestEngine(t *testing.T, basePath string) *gin.Engine {
	return newTestEngineWithFrontendBaseURL(t, basePath, "")
}

func newTestEngineWithFrontendBaseURL(t *testing.T, basePath string, frontendBaseURL string) *gin.Engine {
	t.Helper()

	original := common.AppBasePath
	common.AppBasePath = basePath
	t.Cleanup(func() {
		common.AppBasePath = original
	})
	t.Setenv("FRONTEND_BASE_URL", frontendBaseURL)

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetRouter(engine, newTestBuildFS(), []byte("<!doctype html><html><body>test index</body></html>"))
	return engine
}

func newTestBuildFS() fs.FS {
	return fstest.MapFS{
		"web/dist/index.html":    &fstest.MapFile{Data: []byte("<!doctype html><html><body>test index</body></html>")},
		"web/dist/assets/app.js": &fstest.MapFile{Data: []byte("console.log('asset-ok');")},
	}
}

func performRequest(engine *gin.Engine, method string, target string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, nil)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, req)
	return recorder
}
