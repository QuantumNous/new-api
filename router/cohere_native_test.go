package router

import (
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSetRelayRouterRegistersOnlyCohereNativeV2Routes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetRelayRouter(engine)
	routes := map[string]bool{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = true
	}
	for _, path := range []string{"/v2/chat", "/v2/embed", "/v2/rerank"} {
		require.True(t, routes["POST "+path])
		require.False(t, routes["GET "+path])
	}
	require.False(t, routes["POST /v2/unknown"])
}
