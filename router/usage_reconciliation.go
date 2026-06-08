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
	g := router.Group("/usage")
	g.Use(middleware.GlobalAPIRateLimit(), middleware.UsageReconAuth())
	g.GET("/summary", controller.GetUsageSummary)
	g.GET("/transactions", controller.GetUsageTransactions)
}
