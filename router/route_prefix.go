package router

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// PrefixedEngine returns the gin target where router registrations should
// land when NEW_API_ROUTE_PREFIX is set. With no prefix configured it is the
// raw engine; otherwise it is the prefix group so every Group/Use/Handle call
// performed by routers automatically nests under the prefix.
//
// Callers that need engine-only methods (for example SetWebRouter with
// NoRoute) should keep using *gin.Engine directly and rely on
// common.StripRoutePrefix inside the NoRoute handler to recover the
// prefix-relative path.
func PrefixedEngine(engine *gin.Engine) gin.IRouter {
	if common.ResolveRoutePrefix() == "" {
		return engine
	}
	return engine.Group(common.RoutePrefix())
}