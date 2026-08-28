package router

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestSetRelayRouterRegistersOpenAIFileAndBatchWorkflow(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetRelayRouter(engine)

	routes := make(map[string]struct{})
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = struct{}{}
	}
	for _, route := range []string{
		http.MethodPost + " /v1/files",
		http.MethodDelete + " /v1/files/:id",
		http.MethodGet + " /v1/files/:id",
		http.MethodGet + " /v1/files/:id/content",
		http.MethodPost + " /v1/batches",
		http.MethodGet + " /v1/batches/:id",
		http.MethodPost + " /v1/batches/:id/cancel",
	} {
		_, found := routes[route]
		assert.True(t, found, route)
	}
}
