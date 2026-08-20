package router

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestIntelligentRoutingAdminRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)
	routes := make(map[string]struct{}, len(engine.Routes()))
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = struct{}{}
	}

	expected := []string{
		http.MethodGet + " /api/intelligent-routing/policies",
		http.MethodGet + " /api/intelligent-routing/policies/:id",
		http.MethodPost + " /api/intelligent-routing/policies",
		http.MethodPut + " /api/intelligent-routing/policies/:id",
		http.MethodPost + " /api/intelligent-routing/policies/:id/validate",
		http.MethodPost + " /api/intelligent-routing/policies/:id/publish",
		http.MethodPost + " /api/intelligent-routing/policies/versions/:version/rollback",
		http.MethodGet + " /api/intelligent-routing/rollout",
		http.MethodPut + " /api/intelligent-routing/rollout",
	}
	for _, route := range expected {
		_, ok := routes[route]
		assert.True(t, ok, route)
	}
}
