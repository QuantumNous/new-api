package router

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// canonicalPlaygroundPath presents the /v1 path a /pg route stands in for.
// gin has already resolved the route by the time this runs, so only the
// downstream lookups — plugin ownership, path-scoped channel filters, billing —
// observe the canonical value, exactly as they would on the /v1 route.
func canonicalPlaygroundPath(path string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(string(constant.ContextKeyPlaygroundRequest), true)
		c.Request.URL.Path = path
		c.Next()
	}
}

// SetPlaygroundGenerationRouter mounts the image and video generation relays the
// playground needs, next to the chat relay registered in SetRelayRouter. The
// browser only holds a session cookie, so token auth is replaced by the same
// session-scoped temporary token the chat playground uses; every other
// middleware keeps the /v1 order, because plugin ownership has to be pinned
// before distribution or the video relay falls back to a native adaptor that
// does not exist for these channels.
func SetPlaygroundGenerationRouter(engine *gin.Engine) {
	imageRouter := engine.Group("/pg/images/generations")
	imageRouter.Use(
		middleware.RouteTag("relay"),
		middleware.SystemPerformanceCheck(),
		middleware.UserAuth(),
		canonicalPlaygroundPath("/v1/images/generations"),
		controller.PlaygroundSessionAuth(types.RelayFormatOpenAIImage),
		middleware.ModelRequestRateLimit(),
		middleware.RouteTaskPluginEndpoint(),
		middleware.PrepareTaskPluginEndpoint(),
		middleware.Distribute(),
	)
	{
		imageRouter.POST("", controller.PlaygroundImage)
	}

	videoRouter := engine.Group("/pg/video/generations")
	videoRouter.Use(
		middleware.RouteTag("relay"),
		middleware.SystemPerformanceCheck(),
		middleware.UserAuth(),
		canonicalPlaygroundPath("/v1/video/generations"),
		controller.PlaygroundSessionAuth(types.RelayFormatTask),
		middleware.PinTaskPluginEndpoint(),
		middleware.TaskPluginEndpointOnly(middleware.ModelRequestRateLimit()),
		middleware.PrepareTaskPluginEndpoint(),
		middleware.Distribute(),
	)
	{
		videoRouter.POST("", controller.PlaygroundTask)
		videoRouter.GET("/:task_id", controller.PlaygroundTaskFetch)
	}
}
