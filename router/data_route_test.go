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

func TestAdminQuotaDataRouteSupportsBothTrailingSlashForms(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	want := map[string]string{
		"/api/data":  http.MethodGet,
		"/api/data/": http.MethodGet,
	}
	got := map[string]string{}
	for _, route := range engine.Routes() {
		if _, ok := want[route.Path]; ok {
			got[route.Path] = route.Method
		}
	}

	require.Equal(t, want, got)
}

func TestAdminQuotaDataRouteDoesNotRedirectEitherSlashForm(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("data-route-auth"))))
	SetApiRouter(engine)

	for _, target := range []string{"/api/data", "/api/data/"} {
		t.Run(target, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, target, nil)
			engine.ServeHTTP(recorder, request)

			require.Equal(t, http.StatusUnauthorized, recorder.Code)
			require.Empty(t, recorder.Header().Get("Location"))
		})
	}
}
