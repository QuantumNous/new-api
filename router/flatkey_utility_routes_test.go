package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSetRelayRouterRegistersFlatkeyUtilityRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetRelayRouter(engine)

	want := map[string]string{
		"/v1/status":  http.MethodGet,
		"/v1/credits": http.MethodGet,
	}
	got := map[string]string{}
	for _, route := range engine.Routes() {
		if _, ok := want[route.Path]; ok {
			got[route.Path] = route.Method
		}
	}
	for path, method := range want {
		if got[path] != method {
			t.Fatalf("expected route %s %s to be registered, got method %q", method, path, got[path])
		}
	}
}

func TestFlatkeyUtilityRoutesReachAuthMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetRelayRouter(engine)

	for _, path := range []string{"/v1/status", "/v1/credits"} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, path, nil)
		engine.ServeHTTP(recorder, request)
		if recorder.Code == http.StatusNotFound {
			t.Fatalf("%s returned 404; route not registered", path)
		}
		if recorder.Code != http.StatusUnauthorized {
			t.Fatalf("%s status=%d body=%s, want 401 from auth middleware", path, recorder.Code, recorder.Body.String())
		}
	}
}
