package router

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSetPrometheusMetricsRouterRegistersMetricsRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetPrometheusMetricsRouter(engine)

	for _, route := range engine.Routes() {
		if route.Path == "/metrics" && route.Method == http.MethodGet {
			return
		}
	}
	t.Fatalf("expected GET /metrics to be registered, routes=%v", engine.Routes())
}
