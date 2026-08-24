package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetPrometheusMetricsRouter(router *gin.Engine) {
	router.GET(
		"/metrics",
		middleware.RouteTag("prometheus_metrics"),
		middleware.PrometheusMetricsAuth(),
		controller.GetPrometheusMetrics,
	)
}
