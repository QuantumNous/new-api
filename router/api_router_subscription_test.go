package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
)

func TestSubscriptionUserRoutesAreRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)

	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("subscription-route-test"))))
	SetApiRouter(engine)

	for _, path := range []string{
		"/api/subscription/plans",
		"/api/subscription/self",
	} {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			recorder := httptest.NewRecorder()

			engine.ServeHTTP(recorder, req)

			if recorder.Code == http.StatusNotFound {
				t.Fatalf("expected subscription route %s to be registered, got 404", path)
			}
			if recorder.Code != http.StatusUnauthorized {
				t.Fatalf("expected unauthenticated request to return 401, got %d", recorder.Code)
			}
		})
	}
}

func TestAirwallexWebhookRouteIsRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)

	airwallexSetting := operation_setting.GetAirwallexSetting()
	oldAirwallexSetting := *airwallexSetting
	t.Cleanup(func() { *airwallexSetting = oldAirwallexSetting })
	airwallexSetting.Enabled = true
	airwallexSetting.Accounts = map[string]operation_setting.AirwallexAccount{
		"b2c": {
			Enabled:       true,
			WebhookSecret: "webhook-secret",
		},
	}

	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("airwallex-webhook-route-test"))))
	SetApiRouter(engine)

	req := httptest.NewRequest(http.MethodPost, "/api/airwallex/webhook/b2c", nil)
	recorder := httptest.NewRecorder()

	engine.ServeHTTP(recorder, req)

	if recorder.Code == http.StatusNotFound {
		t.Fatalf("expected Airwallex webhook route to be registered, got 404")
	}
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected missing webhook signature to return 401, got %d", recorder.Code)
	}
}
