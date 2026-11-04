package router

// Public HisarWeb AI routes: the TL price comparator, the quality meter and the
// service status. They are reachable without a login (the page is public) and
// sit behind the public read limit (60 a minute per address, one budget for all
// three) in addition to the global API limit. The critical limiter is not used
// here: mobile carriers in Turkey share one public address between many
// customers, so a strict per-address budget would lock out a whole carrier.
// The status and quality answers take a short public cache; the comparator
// takes none because its answer depends on the query. Starting a quality
// measurement is an admin action.

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetHwRouter(apiRouter *gin.RouterGroup) {
	hwRouter := apiRouter.Group("/hw")
	hwRouter.GET("/pricing/compare", middleware.HwPublicReadRateLimit(), controller.HwPricingCompare)
	hwRouter.GET("/quality/latest", middleware.HwPublicReadRateLimit(), middleware.HwPublicReadCache(), controller.HwQualityLatest)
	// The public service status. No login; the answer never names a supplier.
	hwRouter.GET("/status", middleware.HwPublicReadRateLimit(), middleware.HwPublicReadCache(), controller.HwStatus)
	hwRouter.POST("/quality/run", middleware.AdminAuth(), controller.HwQualityRun)
	// The bureau reserve of the current window (part B2). Admin only; it reports
	// numbers, never the token or the URL of the measurement.
	hwRouter.GET("/admin/reserve", middleware.AdminAuth(), controller.HwAdminReserveStatus)
	// The admin agent: chat, one-click text fixes and the escalation card.
	// Admin only; the text read is public (the pages merge it at start-up).
	hwRouter.GET("/text-overrides", middleware.HwPublicReadRateLimit(), middleware.HwPublicReadCache(), controller.HwTextOverrides)
	// The assistant: fixed answers without a model call, public and rate limited.
	hwRouter.GET("/assistant/faq", middleware.HwPublicReadRateLimit(), controller.HwAssistantFAQ)
	hwRouter.POST("/assistant/ask", middleware.HwPublicReadRateLimit(), controller.HwAssistantAsk)
	hwRouter.POST("/assistant/chat", middleware.HwPublicReadRateLimit(), controller.HwAssistantChat)
	hwRouter.GET("/admin/assistant/questions", middleware.AdminAuth(), controller.HwAssistantOpenQuestions)
	// Pricing feedback from /pricing: stored, mailed and bundled into one card an hour.
	hwRouter.POST("/pricing/feedback", middleware.AnonymousRequestBodyLimit(), middleware.HwPublicReadRateLimit(), middleware.HwPricingFeedbackRateLimit(), controller.HwPricingFeedback)
	hwRouter.POST("/admin/pricing/feedback/card", middleware.AdminAuth(), controller.HwAdminFlushPricingFeedback)
	hwRouter.POST("/assistant/feedback", middleware.HwPublicReadRateLimit(), controller.HwAssistantFeedback)
	hwRouter.POST("/admin/agent/feedback", middleware.AdminAuth(), controller.HwAdminAgentFeedback)
	hwRouter.GET("/admin/assistant/feedback", middleware.AdminAuth(), controller.HwAssistantListFeedback)
	hwRouter.POST("/admin/assistant/feedback/:id/review", middleware.AdminAuth(), controller.HwAssistantReviewFeedback)
	hwRouter.POST("/admin/agent/chat", middleware.AdminAuth(), controller.HwAdminAgentChat)
	hwRouter.POST("/admin/agent/ask", middleware.AdminAuth(), controller.HwAdminAgentAskFAQ)
	hwRouter.GET("/admin/agent/texts", middleware.AdminAuth(), controller.HwAdminAgentListTexts)
	hwRouter.POST("/admin/agent/texts", middleware.AdminAuth(), controller.HwAdminAgentApplyText)
	hwRouter.POST("/admin/agent/texts/revert", middleware.AdminAuth(), controller.HwAdminAgentRevertText)
	hwRouter.POST("/admin/agent/escalate", middleware.AdminAuth(), controller.HwAdminAgentEscalate)
	hwRouter.GET("/admin/agent/escalations", middleware.AdminAuth(), controller.HwAdminAgentPendingEscalations)
	hwRouter.POST("/admin/agent/escalations/card", middleware.AdminAuth(), controller.HwAdminAgentLinkEscalationCard)
}
