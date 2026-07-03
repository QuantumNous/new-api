package router

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSetVideoRouterRegistersGenerationTaskRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	SetVideoRouter(engine)

	routes := map[string]bool{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = true
	}

	for _, want := range []string{
		http.MethodPost + " /v1/generation/tasks",
		http.MethodGet + " /v1/generation/tasks/:task_id",
	} {
		if !routes[want] {
			t.Fatalf("route %s was not registered", want)
		}
	}
}
