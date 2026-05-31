package router

import (
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRelayRouterRegistersOpenAIEnginesRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	engine := gin.New()
	SetRelayRouter(engine)

	routes := map[string]bool{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = true
	}

	require.True(t, routes["GET /v1/engines"])
	require.True(t, routes["GET /v1/engines/:model"])
}
