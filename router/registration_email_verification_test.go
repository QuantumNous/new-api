package router

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRegistrationEmailVerificationRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	want := map[string]string{
		"/api/registration/email-verification/exchange": http.MethodPost,
		"/api/registration/email-verification/status":   http.MethodPost,
	}
	got := map[string]string{}
	for _, route := range engine.Routes() {
		if _, ok := want[route.Path]; ok {
			got[route.Path] = route.Method
		}
	}
	require.Equal(t, want, got)
}
