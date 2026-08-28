package router

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMetricsRouteRegistersAtRoot(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	require.NotPanics(t, func() { SetMetricsRouter(engine) })

	var found bool
	for _, route := range engine.Routes() {
		if route.Method == http.MethodGet && route.Path == "/metrics" {
			found = true
			break
		}
	}
	assert.True(t, found)
}
