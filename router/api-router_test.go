package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestApiRouterDisablesHttpCaching(t *testing.T) {
	gin.SetMode(gin.TestMode)
	server := gin.New()
	SetApiRouter(server)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	server.ServeHTTP(recorder, request)

	cacheControl := recorder.Header().Get("Cache-Control")
	if !strings.Contains(cacheControl, "no-store") || !strings.Contains(cacheControl, "max-age=0") {
		t.Fatalf("expected API Cache-Control to disable caching, got %q", cacheControl)
	}
	if recorder.Header().Get("Pragma") != "no-cache" {
		t.Fatalf("expected Pragma no-cache, got %q", recorder.Header().Get("Pragma"))
	}
	if recorder.Header().Get("Expires") != "0" {
		t.Fatalf("expected Expires 0, got %q", recorder.Header().Get("Expires"))
	}
}

func TestApiRouterMountsSMSLoginCodeRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalEnabled := common.SMSEnabled
	t.Cleanup(func() {
		common.SMSEnabled = originalEnabled
	})
	common.SMSEnabled = false

	server := gin.New()
	SetApiRouter(server)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/user/sms/login/code", strings.NewReader(`{"phone":"1009"}`))
	server.ServeHTTP(recorder, request)

	if recorder.Code == http.StatusNotFound {
		t.Fatalf("expected sms login code route to be mounted, got 404")
	}
	if !strings.Contains(recorder.Body.String(), "SMS is disabled") {
		t.Fatalf("expected route handler response, got status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}
