package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	// Import oauth package to register providers via init()
	_ "github.com/QuantumNous/new-api/oauth"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

func SetApiRouter(router *gin.Engine) {
	apiRouter := router.Group("/api")
	apiRouter.Use(middleware.RouteTag("api"))
	apiRouter.Use(gzip.Gzip(gzip.DefaultCompression))
	apiRouter.Use(middleware.BodyStorageCleanup()) // 清理请求体存储
	apiRouter.Use(middleware.GlobalAPIRateLimit())
	{
		apiRouter.GET("/setup", controller.GetSetup)
		apiRouter.POST("/setup", controller.PostSetup)
		apiRouter.GET("/status", controller.GetStatus)
		apiRouter.GET("/uptime/status", controller.GetUptimeKumaStatus)
		apiRouter.GET("/models", middleware.UserAuth(), controller.DashboardListModels)
		apiRouter.GET("/status/test", middleware.AdminAuth(), controller.TestStatus)
		apiRouter.GET("/notice", controller.GetNotice)
		apiRouter.GET("/user-agreement", controller.GetUserAgreement)
		apiRouter.GET("/privacy-policy", controller.GetPrivacyPolicy)
		apiRouter.GET("/about", controller.GetAbout)
		//apiRouter.GET("/midjourney", controller.GetMidjourney)
		apiRouter.GET("/home_page_content", controller.GetHomePageContent)
		apiRouter.GET("/pricing", middleware.TryUserAuth(), controller.GetPricing)
		perfMetricsRoute := apiRouter.Group("/perf-metrics")
		perfMetricsRoute.Use(middleware.TryUserAuth())
		{
			perfMetricsRoute.GET("/summary", controller.GetPerfMetricsSummary)
			perfMetricsRoute.GET("", controller.GetPerfMetrics)
		}
		apiRouter.GET("/rankings", controller.GetRankings)
		apiRouter.GET("/verification", middleware.EmailVerificationRateLimit(), middleware.TurnstileCheck(), controller.SendEmailVerification)
		apiRouter.GET("/reset_password", middleware.CriticalRateLimit(), middleware.TurnstileCheck(), controller.SendPasswordResetEmail)
		apiRouter.POST("/user/reset", middleware.CriticalRateLimit(), controller.ResetPassword)
		// OAuth routes - specific routes must come before :provider wildcard
		apiRouter.GET("/oauth/state", middleware.CriticalRateLimit(), controller.GenerateOAuthCode)
		apiRouter.POST("/oauth/email/bind", middleware.CriticalRateLimit(), controller.EmailBind)
		// Non-standard OAuth (WeChat, Telegram) - keep original routes
		apiRouter.GET("/oauth/wechat", middleware.CriticalRateLimit(), controller.WeChatAuth)
		apiRouter.POST("/oauth/wechat/bind", middleware.CriticalRateLimit(), controller.WeChatBind)
		apiRouter.GET("/oauth/telegram/login", middleware.CriticalRateLimit(), controller.TelegramLogin)
		apiRouter.GET("/oauth/telegram/bind", middleware.CriticalRateLimit(), controller.TelegramBind)
		// Standard OAuth providers (GitHub, Discord, OIDC, LinuxDO) - unified route
		apiRouter.GET("/oauth/:provider", middleware.CriticalRateLimit(), controller.HandleOAuth)
		apiRouter.GET("/ratio_config", middleware.CriticalRateLimit(), controller.GetRatioConfig)

		apiRouter.POST("/stripe/webhook", controller.StripeWebhook)
		apiRouter.POST("/creem/webhook", controller.CreemWebhook)
		apiRouter.POST("/waffo/webhook", controller.WaffoWebhook)
		//apiRouter.POST("/waffo-pancake/webhook", controller.WaffoPancakeWebhook)
		apiRouter.POST("/alipay/notify", controller.AlipayNotify)
		apiRouter.GET("/alipay/notify", controller.AlipayNotify)
		apiRouter.POST("/wxpay/notify", controller.WxpayNotify)

		// Universal secure verification routes
		apiRouter.POST("/verify", middleware.UserAuth(), middleware.CriticalRateLimit(), controller.UniversalVerify)

		// 画布提示词库（仅登录可见，数据来自 canvas_prompts 表/内置 seed，不访问外网）
		apiRouter.GET("/prompts", middleware.UserAuth(), controller.GetCanvasPrompts)

		// 画布项目服务端持久化 + 素材库（OBS 存储、用户级容量限制）
		canvasRoute := apiRouter.Group("/canvas")
		canvasRoute.Use(middleware.UserAuth())
		{
			canvasRoute.GET("/projects", controller.ListCanvasProjects)
			canvasRoute.GET("/projects/:project_id", controller.GetCanvasProjectDetail)
			canvasRoute.PUT("/projects/:project_id", controller.UpsertCanvasProjectHandler)
			canvasRoute.DELETE("/projects/:project_id", controller.DeleteCanvasProjectHandler)
			canvasRoute.GET("/assets", controller.ListCanvasAssets)
			canvasRoute.POST("/assets/upload", controller.UploadCanvasAsset)
			canvasRoute.GET("/assets/:asset_id/url", controller.GetCanvasAssetURL)
			canvasRoute.DELETE("/assets/:asset_id", controller.DeleteCanvasAsset)
			canvasRoute.GET("/storage", controller.GetCanvasStorage)
		}

		userRoute := apiRouter.Group("/user")
		{
			userRoute.POST("/register", middleware.CriticalRateLimit(), middleware.TurnstileCheck(), controller.Register)
			userRoute.POST("/login", middleware.CriticalRateLimit(), middleware.TurnstileCheck(), controller.Login)
			userRoute.POST("/login/2fa", middleware.CriticalRateLimit(), controller.Verify2FALogin)
			userRoute.POST("/passkey/login/begin", middleware.CriticalRateLimit(), controller.PasskeyLoginBegin)
			userRoute.POST("/passkey/login/finish", middleware.CriticalRateLimit(), controller.PasskeyLoginFinish)
			//userRoute.POST("/tokenlog", middleware.CriticalRateLimit(), controller.TokenLog)
			userRoute.GET("/logout", controller.Logout)
			userRoute.POST("/epay/notify", controller.EpayNotify)
			userRoute.GET("/epay/notify", controller.EpayNotify)
			userRoute.GET("/groups", controller.GetUserGroups)

			selfRoute := userRoute.Group("/")
			selfRoute.Use(middleware.UserAuth())
			{
				selfRoute.GET("/self/groups", controller.GetUserGroups)
				selfRoute.GET("/self", controller.GetSelf)
				selfRoute.GET("/models", controller.GetUserModels)
				// 子账户凭据由企业主账户管理（M3-4）：禁止自改用户名/密码/显示名。
				selfRoute.PUT("/self", middleware.SubAccountForbidden(), controller.UpdateSelf)
				// 子账户由企业主账户管理生命周期，禁止自删（否则绕过「有绑定不可删」的绑定保护）
				selfRoute.DELETE("/self", middleware.SubAccountForbidden(), controller.DeleteSelf)
				selfRoute.GET("/token", controller.GenerateAccessToken)
				selfRoute.GET("/passkey", controller.PasskeyStatus)
				// 子账户不得自设 passkey（M3-4）：注册新登录因子会让企业「改密码吊销」失效。
				selfRoute.POST("/passkey/register/begin", middleware.SubAccountForbidden(), controller.PasskeyRegisterBegin)
				selfRoute.POST("/passkey/register/finish", middleware.SubAccountForbidden(), controller.PasskeyRegisterFinish)
				selfRoute.POST("/passkey/verify/begin", controller.PasskeyVerifyBegin)
				selfRoute.POST("/passkey/verify/finish", controller.PasskeyVerifyFinish)
				selfRoute.DELETE("/passkey", controller.PasskeyDelete)
				// 子账户黑名单：一切能改变余额/产生消费承诺的入口全部封死（设计 §4.4）。
				// 子账户是企业主账户的只读视图，不能充值/兑换/邀请/认证/管理令牌。
				selfRoute.GET("/aff", middleware.SubAccountForbidden(), controller.GetAffCode)
				selfRoute.GET("/topup/info", controller.GetTopUpInfo)
				selfRoute.GET("/topup/self", controller.GetUserTopUps)
				selfRoute.POST("/topup", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), controller.TopUp)
				selfRoute.POST("/pay", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.RequestEpay)
				selfRoute.POST("/amount", middleware.SubAccountForbidden(), controller.RequestAmount)
				selfRoute.POST("/stripe/pay", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.RequestStripePay)
				selfRoute.POST("/stripe/amount", middleware.SubAccountForbidden(), controller.RequestStripeAmount)
				selfRoute.POST("/creem/pay", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.RequestCreemPay)
				selfRoute.POST("/waffo/amount", middleware.SubAccountForbidden(), controller.RequestWaffoAmount)
				selfRoute.POST("/waffo/pay", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.RequestWaffoPay)
				//selfRoute.POST("/waffo-pancake/amount", controller.RequestWaffoPancakeAmount)
				//selfRoute.POST("/waffo-pancake/pay", middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.RequestWaffoPancakePay)
				selfRoute.POST("/alipay/pay", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.RequestAlipay)
				selfRoute.GET("/alipay/query", controller.QueryAlipayOrder)
				selfRoute.POST("/wxpay/pay", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.RequestWxpay)
				selfRoute.GET("/wxpay/query", controller.QueryWxpayOrder)
				selfRoute.POST("/aff_transfer", middleware.SubAccountForbidden(), controller.TransferAffQuota)
				selfRoute.PUT("/setting", controller.UpdateUserSetting)

				// 2FA routes — 子账户不得自设 2FA（M3-4），同 passkey 理由；禁用/查询保留。
				selfRoute.GET("/2fa/status", controller.Get2FAStatus)
				selfRoute.POST("/2fa/setup", middleware.SubAccountForbidden(), controller.Setup2FA)
				selfRoute.POST("/2fa/enable", middleware.SubAccountForbidden(), controller.Enable2FA)
				selfRoute.POST("/2fa/disable", controller.Disable2FA)
				selfRoute.POST("/2fa/backup_codes", middleware.SubAccountForbidden(), controller.RegenerateBackupCodes)

				// Check-in routes
				selfRoute.GET("/checkin", controller.GetCheckinStatus)
				selfRoute.POST("/checkin", middleware.SubAccountForbidden(), middleware.TurnstileCheck(), controller.DoCheckin)

				// Custom OAuth bindings
				selfRoute.GET("/oauth/bindings", controller.GetUserOAuthBindings)
				selfRoute.DELETE("/oauth/bindings/:provider_id", controller.UnbindCustomOAuth)

				// KYC routes — 子账户不是独立法律主体，写操作封禁
				selfRoute.GET("/kyc", controller.GetKYCStatus)
				selfRoute.POST("/kyc", middleware.SubAccountForbidden(), controller.SubmitKYC)
				selfRoute.PUT("/kyc", middleware.SubAccountForbidden(), controller.UpdateKYC)
				selfRoute.DELETE("/kyc", middleware.SubAccountForbidden(), controller.DeleteKYC)

				// Enterprise certification routes — 同上，写操作封禁
				selfRoute.GET("/enterprise", controller.GetEnterpriseStatus)
				selfRoute.POST("/enterprise", middleware.SubAccountForbidden(), controller.SubmitEnterprise)
				selfRoute.PUT("/enterprise", middleware.SubAccountForbidden(), controller.UpdateEnterprise)
				selfRoute.DELETE("/enterprise", middleware.SubAccountForbidden(), controller.DeleteEnterprise)
				selfRoute.GET("/bank_transfer/config", controller.GetBankTransferConfig)
				selfRoute.GET("/bank_transfer/self", controller.GetUserBankTransfers)
				selfRoute.POST("/bank_transfer", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), controller.SubmitBankTransfer)
				selfRoute.DELETE("/bank_transfer/:id", middleware.SubAccountForbidden(), controller.CancelBankTransfer)
				selfRoute.GET("/invoice/quota", controller.GetInvoiceQuota)
				selfRoute.GET("/invoice/self", controller.GetUserInvoices)
				selfRoute.POST("/invoice", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), controller.SubmitInvoice)
				selfRoute.DELETE("/invoice/:id", middleware.SubAccountForbidden(), controller.CancelInvoice)
				selfRoute.GET("/invoice/:id/file", controller.GetUserInvoiceFile)

				// 子账户管理（企业主账户操作）。全部挂 SubAccountForbidden 防套娃；
				// enterprise_status==2 前置校验在 controller 内进行。
				selfRoute.GET("/sub_account", middleware.SubAccountForbidden(), controller.GetSubAccounts)
				selfRoute.POST("/sub_account", middleware.SubAccountForbidden(), controller.CreateSubAccount)
				selfRoute.PUT("/sub_account/:id/password", middleware.SubAccountForbidden(), controller.ResetSubAccountPassword)
				selfRoute.PUT("/sub_account/:id/status", middleware.SubAccountForbidden(), controller.SetSubAccountStatus)
				selfRoute.DELETE("/sub_account/:id", middleware.SubAccountForbidden(), controller.DeleteSubAccount)
				selfRoute.GET("/sub_account/:id/bindings", middleware.SubAccountForbidden(), controller.GetSubAccountBindings)
				selfRoute.POST("/sub_account/:id/bind", middleware.SubAccountForbidden(), controller.BindSubAccountToken)
				selfRoute.POST("/sub_account/:id/unbind", middleware.SubAccountForbidden(), controller.UnbindSubAccountToken)

				// Feedback (建议及咨询/工单) routes
				selfRoute.GET("/feedback/topics", controller.GetUserFeedbackTopics)
				selfRoute.POST("/feedback/topics", middleware.CriticalRateLimit(), controller.CreateFeedbackTopic)
				selfRoute.GET("/feedback/unread", controller.GetUserFeedbackUnread)
				selfRoute.GET("/feedback/images/:imageId", controller.GetUserFeedbackImage)
				selfRoute.GET("/feedback/topics/:id", controller.GetUserFeedbackTopicDetail)
				selfRoute.POST("/feedback/topics/:id/messages", middleware.CriticalRateLimit(), controller.ReplyFeedbackTopic)
				selfRoute.PUT("/feedback/topics/:id/close", controller.CloseFeedbackTopicByUser)
			}

			adminRoute := userRoute.Group("/")
			adminRoute.Use(middleware.AdminAuth())
			{
				adminRoute.GET("/", controller.GetAllUsers)
				adminRoute.GET("/topup", controller.GetAllTopUps)
				adminRoute.POST("/topup/complete", controller.AdminCompleteTopUp)
				adminRoute.GET("/search", controller.SearchUsers)
				adminRoute.GET("/:id/oauth/bindings", controller.GetUserOAuthBindingsByAdmin)
				adminRoute.DELETE("/:id/oauth/bindings/:provider_id", controller.UnbindCustomOAuthByAdmin)
				adminRoute.DELETE("/:id/bindings/:binding_type", controller.AdminClearUserBinding)
				adminRoute.GET("/:id", controller.GetUser)
				adminRoute.POST("/", controller.CreateUser)
				adminRoute.POST("/manage", controller.ManageUser)
				adminRoute.PUT("/", controller.UpdateUser)
				adminRoute.DELETE("/:id", controller.DeleteUser)
				adminRoute.DELETE("/:id/reset_passkey", controller.AdminResetPasskey)

				// Admin 2FA routes
				adminRoute.GET("/2fa/stats", controller.Admin2FAStats)
				adminRoute.DELETE("/:id/2fa", controller.AdminDisable2FA)

				// KYC admin routes — /kyc/admin/by-user/:user_id must be registered before /:id routes
				adminRoute.GET("/kyc/admin", controller.AdminGetKYCList)
				adminRoute.GET("/kyc/admin/by-user/:user_id", controller.AdminGetKYCByUser)
				adminRoute.PUT("/kyc/admin/:id/approve", controller.AdminApproveKYC)
				adminRoute.PUT("/kyc/admin/:id/reject", controller.AdminRejectKYC)
				// 重置仅超管：清空认证状态影响较大，叠加 RootAuth 强制（前端按钮也仅 root 可见）
				adminRoute.PUT("/kyc/admin/:id/reset", middleware.RootAuth(), controller.AdminResetKYC)
				adminRoute.GET("/kyc/admin/:id/reveal", controller.AdminRevealKYC)
				adminRoute.GET("/kyc/admin/:id/images", controller.AdminGetKYCImages)

				// Enterprise admin routes — by-user/:user_id before /:id routes
				adminRoute.GET("/enterprise/admin", controller.AdminGetEnterpriseList)
				adminRoute.GET("/enterprise/admin/by-user/:user_id", controller.AdminGetEnterpriseByUser)
				adminRoute.PUT("/enterprise/admin/:id/approve", controller.AdminApproveEnterprise)
				adminRoute.PUT("/enterprise/admin/:id/reject", controller.AdminRejectEnterprise)
				// 重置仅超管（同 KYC）
				adminRoute.PUT("/enterprise/admin/:id/reset", middleware.RootAuth(), controller.AdminResetEnterprise)
				adminRoute.GET("/enterprise/admin/:id/reveal", controller.AdminRevealEnterprise)
				adminRoute.GET("/enterprise/admin/:id/images", controller.AdminGetEnterpriseImages)
				adminRoute.GET("/bank_transfer/admin", controller.AdminGetBankTransferList)
				adminRoute.GET("/bank_transfer/admin/:id/receipt", controller.AdminGetBankTransferReceipt)
				adminRoute.PUT("/bank_transfer/admin/:id/approve", controller.AdminApproveBankTransfer)
				adminRoute.PUT("/bank_transfer/admin/:id/reject", controller.AdminRejectBankTransfer)
				adminRoute.GET("/invoice/admin", controller.AdminGetInvoiceList)
				adminRoute.PUT("/invoice/admin/:id/issue", controller.AdminIssueInvoice)
				adminRoute.PUT("/invoice/admin/:id/reject", controller.AdminRejectInvoice)
				adminRoute.GET("/invoice/admin/:id/file", controller.AdminGetInvoiceFile)

				// 审核待办计数（侧边栏/页签红点）：实名认证 / 企业认证 / 对公转账+发票
				adminRoute.GET("/review/pending_counts", controller.GetReviewPendingCounts)

				// Feedback admin routes — static segments before /:id
				adminRoute.GET("/feedback/admin/topics", controller.AdminGetFeedbackTopics)
				adminRoute.GET("/feedback/admin/unread", controller.AdminGetFeedbackUnread)
				adminRoute.GET("/feedback/admin/images/:imageId", controller.AdminGetFeedbackImage)
				adminRoute.GET("/feedback/admin/topics/:id", controller.AdminGetFeedbackTopicDetail)
				adminRoute.POST("/feedback/admin/topics/:id/messages", middleware.CriticalRateLimit(), controller.AdminReplyFeedbackTopic)
				adminRoute.PUT("/feedback/admin/topics/:id/status", controller.AdminUpdateFeedbackStatus)
			}
		}

		// Subscription billing (plans, purchase, admin management)
		subscriptionRoute := apiRouter.Group("/subscription")
		subscriptionRoute.Use(middleware.UserAuth())
		{
			subscriptionRoute.GET("/plans", controller.GetSubscriptionPlans)
			subscriptionRoute.GET("/self", controller.GetSubscriptionSelf)
			subscriptionRoute.PUT("/self/preference", middleware.SubAccountForbidden(), controller.UpdateSubscriptionPreference)
			subscriptionRoute.POST("/epay/pay", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.SubscriptionRequestEpay)
			subscriptionRoute.POST("/stripe/pay", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.SubscriptionRequestStripePay)
			subscriptionRoute.POST("/creem/pay", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.SubscriptionRequestCreemPay)
			subscriptionRoute.POST("/alipay/pay", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.SubscriptionRequestAlipay)
			subscriptionRoute.GET("/alipay/query", controller.SubscriptionQueryAlipayOrder)
			subscriptionRoute.POST("/wxpay/pay", middleware.SubAccountForbidden(), middleware.CriticalRateLimit(), middleware.KYCRequired(), controller.SubscriptionRequestWxpay)
			subscriptionRoute.GET("/wxpay/query", controller.SubscriptionQueryWxpayOrder)
		}
		subscriptionAdminRoute := apiRouter.Group("/subscription/admin")
		subscriptionAdminRoute.Use(middleware.AdminAuth())
		{
			subscriptionAdminRoute.GET("/plans", controller.AdminListSubscriptionPlans)
			subscriptionAdminRoute.POST("/plans", controller.AdminCreateSubscriptionPlan)
			subscriptionAdminRoute.PUT("/plans/:id", controller.AdminUpdateSubscriptionPlan)
			subscriptionAdminRoute.PATCH("/plans/:id", controller.AdminUpdateSubscriptionPlanStatus)
			subscriptionAdminRoute.POST("/bind", controller.AdminBindSubscription)

			// User subscription management (admin)
			subscriptionAdminRoute.GET("/users/:id/subscriptions", controller.AdminListUserSubscriptions)
			subscriptionAdminRoute.POST("/users/:id/subscriptions", controller.AdminCreateUserSubscription)
			subscriptionAdminRoute.POST("/user_subscriptions/:id/invalidate", controller.AdminInvalidateUserSubscription)
			subscriptionAdminRoute.DELETE("/user_subscriptions/:id", controller.AdminDeleteUserSubscription)
		}

		// Reconciliation v3.0 (upload-driven). Admin uploads supplier xlsx,
		// system compares against logs in memory, returns full diff in one
		// response. See docs/reconciliation-upload-design.md.
		reconcileAdmin := apiRouter.Group("/reconcile/admin")
		reconcileAdmin.Use(middleware.AdminAuth())
		{
			reconcileAdmin.POST("/upload", controller.AdminReconcileUpload)
		}

		// Subscription payment callbacks (no auth)
		apiRouter.POST("/subscription/epay/notify", controller.SubscriptionEpayNotify)
		apiRouter.GET("/subscription/epay/notify", controller.SubscriptionEpayNotify)
		apiRouter.GET("/subscription/epay/return", controller.SubscriptionEpayReturn)
		apiRouter.POST("/subscription/epay/return", controller.SubscriptionEpayReturn)
		apiRouter.POST("/subscription/alipay/notify", controller.SubscriptionAlipayNotify)
		apiRouter.GET("/subscription/alipay/notify", controller.SubscriptionAlipayNotify)
		apiRouter.POST("/subscription/wxpay/notify", controller.SubscriptionWxpayNotify)
		optionRoute := apiRouter.Group("/option")
		optionRoute.Use(middleware.RootAuth())
		{
			optionRoute.GET("/", controller.GetOptions)
			optionRoute.PUT("/", controller.UpdateOption)
			optionRoute.GET("/channel_affinity_cache", controller.GetChannelAffinityCacheStats)
			optionRoute.DELETE("/channel_affinity_cache", controller.ClearChannelAffinityCache)
			optionRoute.POST("/rest_model_ratio", controller.ResetModelRatio)
			optionRoute.POST("/migrate_console_setting", controller.MigrateConsoleSetting) // 用于迁移检测的旧键，下个版本会删除
		}

		// Custom OAuth provider management (root only)
		customOAuthRoute := apiRouter.Group("/custom-oauth-provider")
		customOAuthRoute.Use(middleware.RootAuth())
		{
			customOAuthRoute.POST("/discovery", controller.FetchCustomOAuthDiscovery)
			customOAuthRoute.GET("/", controller.GetCustomOAuthProviders)
			customOAuthRoute.GET("/:id", controller.GetCustomOAuthProvider)
			customOAuthRoute.POST("/", controller.CreateCustomOAuthProvider)
			customOAuthRoute.PUT("/:id", controller.UpdateCustomOAuthProvider)
			customOAuthRoute.DELETE("/:id", controller.DeleteCustomOAuthProvider)
		}
		performanceRoute := apiRouter.Group("/performance")
		performanceRoute.Use(middleware.RootAuth())
		{
			performanceRoute.GET("/stats", controller.GetPerformanceStats)
			performanceRoute.DELETE("/disk_cache", controller.ClearDiskCache)
			performanceRoute.POST("/reset_stats", controller.ResetPerformanceStats)
			performanceRoute.POST("/gc", controller.ForceGC)
			performanceRoute.GET("/logs", controller.GetLogFiles)
			performanceRoute.DELETE("/logs", controller.CleanupLogFiles)
		}
		systemRoute := apiRouter.Group("/system")
		systemRoute.Use(middleware.RootAuth())
		{
			systemRoute.POST("/update", middleware.CriticalRateLimit(), controller.PerformUpdate)
		}

		mediaStoreRoute := apiRouter.Group("/media-store")
		mediaStoreRoute.Use(middleware.RootAuth())
		{
			mediaStoreRoute.GET("/stats", controller.GetMediaStoreStats)
			mediaStoreRoute.POST("/snapshot", controller.RefreshMediaStoreStats)
		}

		ratioSyncRoute := apiRouter.Group("/ratio_sync")
		ratioSyncRoute.Use(middleware.RootAuth())
		{
			ratioSyncRoute.GET("/channels", controller.GetSyncableChannels)
			ratioSyncRoute.POST("/fetch", controller.FetchUpstreamRatios)
		}
		channelRoute := apiRouter.Group("/channel")
		channelRoute.Use(middleware.AdminAuth())
		{
			channelRoute.GET("/", controller.GetAllChannels)
			channelRoute.GET("/search", controller.SearchChannels)
			channelRoute.GET("/models", controller.ChannelListModels)
			channelRoute.GET("/models_enabled", controller.EnabledListModels)
			channelRoute.GET("/:id", controller.GetChannel)
			channelRoute.POST("/:id/key", middleware.RootAuth(), middleware.CriticalRateLimit(), middleware.DisableCache(), middleware.SecureVerificationRequired(), controller.GetChannelKey)
			channelRoute.GET("/test", controller.TestAllChannels)
			channelRoute.GET("/test/:id", controller.TestChannel)
			channelRoute.GET("/update_balance", controller.UpdateAllChannelsBalance)
			channelRoute.GET("/update_balance/:id", controller.UpdateChannelBalance)
			channelRoute.POST("/", controller.AddChannel)
			channelRoute.PUT("/", controller.UpdateChannel)
			channelRoute.DELETE("/disabled", controller.DeleteDisabledChannel)
			channelRoute.POST("/tag/disabled", controller.DisableTagChannels)
			channelRoute.POST("/tag/enabled", controller.EnableTagChannels)
			channelRoute.PUT("/tag", controller.EditTagChannels)
			channelRoute.DELETE("/:id", controller.DeleteChannel)
			channelRoute.POST("/batch", controller.DeleteChannelBatch)
			channelRoute.POST("/fix", controller.FixChannelsAbilities)
			channelRoute.GET("/fetch_models/:id", controller.FetchUpstreamModels)
			channelRoute.POST("/fetch_models", middleware.RootAuth(), controller.FetchModels)
			channelRoute.POST("/codex/oauth/start", controller.StartCodexOAuth)
			channelRoute.POST("/codex/oauth/complete", controller.CompleteCodexOAuth)
			channelRoute.POST("/:id/codex/oauth/start", controller.StartCodexOAuthForChannel)
			channelRoute.POST("/:id/codex/oauth/complete", controller.CompleteCodexOAuthForChannel)
			channelRoute.POST("/:id/codex/refresh", controller.RefreshCodexChannelCredential)
			channelRoute.GET("/:id/codex/usage", controller.GetCodexChannelUsage)
			channelRoute.POST("/ollama/pull", controller.OllamaPullModel)
			channelRoute.POST("/ollama/pull/stream", controller.OllamaPullModelStream)
			channelRoute.DELETE("/ollama/delete", controller.OllamaDeleteModel)
			channelRoute.GET("/ollama/version/:id", controller.OllamaVersion)
			channelRoute.POST("/batch/tag", controller.BatchSetChannelTag)
			channelRoute.GET("/tag/models", controller.GetTagModels)
			channelRoute.POST("/copy/:id", controller.CopyChannel)
			channelRoute.POST("/multi_key/manage", controller.ManageMultiKeys)
			channelRoute.POST("/upstream_updates/apply", controller.ApplyChannelUpstreamModelUpdates)
			channelRoute.POST("/upstream_updates/apply_all", controller.ApplyAllChannelUpstreamModelUpdates)
			channelRoute.POST("/upstream_updates/detect", controller.DetectChannelUpstreamModelUpdates)
			channelRoute.POST("/upstream_updates/detect_all", controller.DetectAllChannelUpstreamModelUpdates)
		}
		tokenRoute := apiRouter.Group("/token")
		tokenRoute.Use(middleware.UserAuth())
		{
			tokenRoute.GET("/", controller.GetAllTokens)
			tokenRoute.GET("/search", middleware.SearchRateLimit(), controller.SearchTokens)
			tokenRoute.GET("/:id", controller.GetToken)
			tokenRoute.POST("/:id/key", middleware.CriticalRateLimit(), middleware.DisableCache(), controller.GetTokenKey)
			// 子账户令牌页只读：禁止创建/修改/删除（含批量）；读取走 GetAllTokens 的子账户分支。
			tokenRoute.POST("/", middleware.SubAccountForbidden(), controller.AddToken)
			tokenRoute.PUT("/", middleware.SubAccountForbidden(), controller.UpdateToken)
			tokenRoute.DELETE("/:id", middleware.SubAccountForbidden(), controller.DeleteToken)
			tokenRoute.POST("/batch", middleware.SubAccountForbidden(), controller.DeleteTokenBatch)
			tokenRoute.POST("/batch/keys", middleware.CriticalRateLimit(), middleware.DisableCache(), controller.GetTokenKeysBatch)
		}

		usageRoute := apiRouter.Group("/usage")
		usageRoute.Use(middleware.CORS(), middleware.CriticalRateLimit())
		{
			tokenUsageRoute := usageRoute.Group("/token")
			tokenUsageRoute.Use(middleware.TokenAuthReadOnly())
			{
				tokenUsageRoute.GET("/", controller.GetTokenUsage)
			}
		}

		redemptionRoute := apiRouter.Group("/redemption")
		redemptionRoute.Use(middleware.AdminAuth())
		{
			redemptionRoute.GET("/", controller.GetAllRedemptions)
			redemptionRoute.GET("/search", controller.SearchRedemptions)
			redemptionRoute.GET("/:id", controller.GetRedemption)
			redemptionRoute.POST("/", controller.AddRedemption)
			redemptionRoute.PUT("/", controller.UpdateRedemption)
			redemptionRoute.DELETE("/invalid", controller.DeleteInvalidRedemption)
			redemptionRoute.DELETE("/:id", controller.DeleteRedemption)
		}
		logRoute := apiRouter.Group("/log")
		logRoute.GET("/", middleware.AdminAuth(), controller.GetAllLogs)
		logRoute.DELETE("/", middleware.AdminAuth(), controller.DeleteHistoryLogs)
		logRoute.GET("/stat", middleware.AdminAuth(), controller.GetLogsStat)
		logRoute.GET("/self/stat", middleware.UserAuth(), controller.GetLogsSelfStat)
		logRoute.GET("/channel_affinity_usage_cache", middleware.AdminAuth(), controller.GetChannelAffinityUsageCacheStats)
		logRoute.GET("/search", middleware.AdminAuth(), controller.SearchAllLogs)
		logRoute.GET("/self", middleware.UserAuth(), controller.GetUserLogs)
		logRoute.GET("/self/search", middleware.UserAuth(), middleware.SearchRateLimit(), controller.SearchUserLogs)
		logRoute.GET("/export", middleware.AdminAuth(), controller.ExportAllLogs)
		logRoute.GET("/self/export", middleware.UserAuth(), controller.ExportUserLogs)

		dataRoute := apiRouter.Group("/data")
		dataRoute.GET("/", middleware.AdminAuth(), controller.GetAllQuotaDates)
		dataRoute.GET("/users", middleware.AdminAuth(), controller.GetQuotaDatesByUser)
		dataRoute.GET("/self", middleware.UserAuth(), controller.GetUserQuotaDates)

		logRoute.Use(middleware.CORS(), middleware.CriticalRateLimit())
		{
			logRoute.GET("/token", middleware.TokenAuthReadOnly(), controller.GetLogByKey)
		}
		groupRoute := apiRouter.Group("/group")
		groupRoute.Use(middleware.AdminAuth())
		{
			groupRoute.GET("/", controller.GetGroups)
		}

		prefillGroupRoute := apiRouter.Group("/prefill_group")
		prefillGroupRoute.Use(middleware.AdminAuth())
		{
			prefillGroupRoute.GET("/", controller.GetPrefillGroups)
			prefillGroupRoute.POST("/", controller.CreatePrefillGroup)
			prefillGroupRoute.PUT("/", controller.UpdatePrefillGroup)
			prefillGroupRoute.DELETE("/:id", controller.DeletePrefillGroup)
		}

		mjRoute := apiRouter.Group("/mj")
		// 绘图日志本期不对子账户开放（D10）：midjourneys 无 token_id 维度，无法按绑定集合过滤。
		mjRoute.GET("/self", middleware.UserAuth(), middleware.SubAccountForbidden(), controller.GetUserMidjourney)
		mjRoute.GET("/", middleware.AdminAuth(), controller.GetAllMidjourney)

		taskRoute := apiRouter.Group("/task")
		{
			taskRoute.GET("/self", middleware.UserAuth(), controller.GetUserTask)
			taskRoute.GET("/self/:id/download", middleware.UserAuth(), controller.GetSelfTaskDownloadURL)
			taskRoute.GET("/", middleware.AdminAuth(), controller.GetAllTask)
			taskRoute.GET("/:id/download", middleware.AdminAuth(), controller.GetTaskDownloadURL)
		}

		vendorRoute := apiRouter.Group("/vendors")
		vendorRoute.Use(middleware.AdminAuth())
		{
			vendorRoute.GET("/", controller.GetAllVendors)
			vendorRoute.GET("/search", controller.SearchVendors)
			vendorRoute.GET("/:id", controller.GetVendorMeta)
			vendorRoute.POST("/", controller.CreateVendorMeta)
			vendorRoute.PUT("/", controller.UpdateVendorMeta)
			vendorRoute.DELETE("/:id", controller.DeleteVendorMeta)
		}

		modelsRoute := apiRouter.Group("/models")
		modelsRoute.Use(middleware.AdminAuth())
		{
			modelsRoute.GET("/sync_upstream/preview", controller.SyncUpstreamPreview)
			modelsRoute.POST("/sync_upstream", controller.SyncUpstreamModels)
			modelsRoute.GET("/missing", controller.GetMissingModels)
			modelsRoute.GET("/", controller.GetAllModelsMeta)
			modelsRoute.GET("/search", controller.SearchModelsMeta)
			modelsRoute.GET("/:id", controller.GetModelMeta)
			modelsRoute.POST("/", controller.CreateModelMeta)
			modelsRoute.PUT("/", controller.UpdateModelMeta)
			modelsRoute.DELETE("/:id", controller.DeleteModelMeta)
		}

		// Deployments (model deployment management)
		deploymentsRoute := apiRouter.Group("/deployments")
		deploymentsRoute.Use(middleware.AdminAuth())
		{
			deploymentsRoute.GET("/settings", controller.GetModelDeploymentSettings)
			deploymentsRoute.POST("/settings/test-connection", controller.TestIoNetConnection)
			deploymentsRoute.GET("/", controller.GetAllDeployments)
			deploymentsRoute.GET("/search", controller.SearchDeployments)
			deploymentsRoute.POST("/test-connection", controller.TestIoNetConnection)
			deploymentsRoute.GET("/hardware-types", controller.GetHardwareTypes)
			deploymentsRoute.GET("/locations", controller.GetLocations)
			deploymentsRoute.GET("/available-replicas", controller.GetAvailableReplicas)
			deploymentsRoute.POST("/price-estimation", controller.GetPriceEstimation)
			deploymentsRoute.GET("/check-name", controller.CheckClusterNameAvailability)
			deploymentsRoute.POST("/", controller.CreateDeployment)

			deploymentsRoute.GET("/:id", controller.GetDeployment)
			deploymentsRoute.GET("/:id/logs", controller.GetDeploymentLogs)
			deploymentsRoute.GET("/:id/containers", controller.ListDeploymentContainers)
			deploymentsRoute.GET("/:id/containers/:container_id", controller.GetContainerDetails)
			deploymentsRoute.PUT("/:id", controller.UpdateDeployment)
			deploymentsRoute.PUT("/:id/name", controller.UpdateDeploymentName)
			deploymentsRoute.POST("/:id/extend", controller.ExtendDeployment)
			deploymentsRoute.DELETE("/:id", controller.DeleteDeployment)
		}
	}
}
