package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// SetUsageReconciliationRouter mounts the root-level, static-token-guarded
// BlockRun usage reconciliation endpoints. Mounted on the root engine (NOT under
// /api) so the path is exactly /usage/summary and /usage/transactions; does not
// collide with the authenticated /api/usage/token route.
//
// GlobalAPIRateLimit() is applied BEFORE UsageReconAuth() so that even
// unauthenticated brute-force attempts against the static token are throttled,
// and so the expensive per-request DB window-scans cannot be amplified into a
// resource-exhaustion vector. The IP-keyed global limit (default 180/180s) is
// the same tier the whole /api surface uses and is generous enough for a
// periodic reconciliation consumer paginating through results.
func SetUsageReconciliationRouter(router *gin.Engine) {
	channelUsage := router.Group("/usage")
	channelUsage.Use(middleware.GlobalAPIRateLimit(), middleware.UsageReconAuth())
	channelUsage.GET("/summary", controller.GetUsageSummary)
	channelUsage.GET("/validation", controller.GetUsageValidation)
	channelUsage.GET("/transactions", controller.GetUsageTransactions)
	channelUsage.GET("/models", controller.GetUsageModels)
	channelUsage.GET("/channels", controller.GetUsageChannels)
	channelUsage.GET("/channel-summary", controller.GetChannelUsageSummary)
	channelUsage.GET("/channel-validation", controller.GetChannelUsageValidation)
	channelUsage.GET("/channel-transactions", controller.GetChannelUsageTransactions)
	channelUsage.GET("/channel-models", controller.GetChannelUsageModels)

	customerUsage := router.Group("/usage")
	customerUsage.Use(middleware.GlobalAPIRateLimit(), middleware.CustomerUsageAuth())
	customerUsage.GET("/customers/:customer_id", controller.GetCustomerUsageCustomer)
	customerUsage.GET("/customer-transactions", controller.GetCustomerUsageTransactions)
	customerUsage.GET("/customer-summary", controller.GetCustomerUsageSummary)
}
