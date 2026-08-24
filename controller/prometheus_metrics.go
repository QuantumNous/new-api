package controller

import (
	"net/http"

	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"

	"github.com/gin-gonic/gin"
)

func GetPrometheusMetrics(c *gin.Context) {
	text, err := perfmetrics.BuildPrometheusText(c.Request.Context())
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	c.Data(http.StatusOK, "text/plain; version=0.0.4; charset=utf-8", []byte(text))
}
