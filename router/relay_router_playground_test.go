package router

import (
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSetRelayRouterRegistersPlaygroundMediaRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetRelayRouter(engine)

	want := map[string]bool{
		"POST /pg/chat/completions":   false,
		"POST /pg/images/generations": false,
		"POST /pg/videos":             false,
		"GET /pg/videos/:task_id":     false,
	}
	for _, route := range engine.Routes() {
		key := route.Method + " " + route.Path
		if _, ok := want[key]; ok {
			want[key] = true
		}
	}
	for route, registered := range want {
		if !registered {
			t.Errorf("missing route %s", route)
		}
	}
}
