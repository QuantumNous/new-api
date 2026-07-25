package router

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestWebsitePricingV2RouteIsRegisteredAnonymously(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	for _, route := range engine.Routes() {
		if route.Method == http.MethodGet && route.Path == "/api/website/pricing/v2" {
			require.Contains(t, route.Handler, "GetWebsitePricingV2")
			return
		}
	}
	t.Fatal("GET /api/website/pricing/v2 is not registered")
}
