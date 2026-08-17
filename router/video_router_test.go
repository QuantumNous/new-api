package router

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVideoRouterRegistersArkContentGenerationTaskRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	SetVideoRouter(engine)

	routes := engine.Routes()
	require.NotEmpty(t, routes)
	registered := make(map[string]bool, len(routes))
	for _, route := range routes {
		registered[route.Method+" "+route.Path] = true
	}

	assert.True(t, registered[http.MethodPost+" "+constant.ArkContentGenerationTasksPath])
	assert.True(t, registered[http.MethodGet+" "+constant.ArkContentGenerationTasksPath+"/:task_id"])
	assert.True(t, registered[http.MethodPost+" /v1/video/generations"])
	assert.True(t, registered[http.MethodGet+" /v1/video/generations/:task_id"])
}
