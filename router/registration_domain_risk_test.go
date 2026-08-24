package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRegistrationDomainRiskAdminRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	want := map[string]string{
		"/api/registration-domain-risk/blocks":             http.MethodGet,
		"/api/registration-domain-risk/blocks/:id":         http.MethodGet,
		"/api/registration-domain-risk/blocks/:id/release": http.MethodPost,
	}
	got := map[string]string{}
	for _, route := range engine.Routes() {
		if _, ok := want[route.Path]; ok {
			got[route.Path] = route.Method
		}
	}
	require.Equal(t, want, got)
}

func TestRegistrationDomainRiskRoutesRequireAdminAuth(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("registration-domain-risk-auth"))))
	SetApiRouter(engine)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/registration-domain-risk/blocks", nil)
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusUnauthorized, recorder.Code)
}
