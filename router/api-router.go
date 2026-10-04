package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	// Import oauth package to register providers via init()
	_ "github.com/QuantumNous/new-api/oauth"

	"github.com/gin-gonic/gin"
)

func SetApiRouter(router *gin.Engine) {
	apiRouter := router.Group("/api")
	apiRouter.Use(middleware.RouteTag("api"))
	apiRouter.Use(middleware.Gzip())
	apiRouter.Use(middleware.BodyStorageCleanup()) // 清理请求体存储
	apiRouter.Use(middleware.GlobalAPIRateLimit())
	anonymousRequestBodyLimit := middleware.AnonymousRequestBodyLimit()
	{
		apiRouter.GET("/setup", controller.GetSetup)
		apiRouter.POST("/setup", anonymousRequestBodyLimit, controller.PostSetup)
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
		apiRouter.GET("/rankings", middleware.HeaderNavModuleAuth("rankings"), controller.GetRankings)
		apiRouter.GET("/verification", middleware.EmailVerificationRateLimit(), middleware.TurnstileEmailVerificationCheckNoSession(), controller.SendEmailVerification)
		apiRouter.GET("/reset_password", middleware.CriticalRateLimit(), middleware.TurnstileCheckForScope(middleware.TurnstileScopePasswordReset), controller.SendPasswordResetEmail)
		apiRouter.POST("/user/reset", middleware.CriticalRateLimit(), controller.ResetPassword)
		// OAuth routes - specific routes must come before :provider wildcard
		apiRouter.GET("/oauth/state", middleware.CriticalRateLimit(), controller.GenerateOAuthCode)
		apiRouter.POST("/oauth/email/bind", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, controller.EmailBind)
		apiRouter.GET("/oauth/ownership/status", middleware.CriticalRateLimit(), controller.GetOAuthOwnershipTransferStatus)
		apiRouter.POST("/oauth/ownership/send", middleware.CriticalRateLimit(), controller.SendOAuthOwnershipTransferVerification)
		apiRouter.POST("/oauth/ownership/confirm", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, controller.ConfirmOAuthOwnershipTransfer)
		// Non-standard OAuth (WeChat, Telegram) - keep original routes
		apiRouter.GET("/oauth/wechat", middleware.CriticalRateLimit(), controller.WeChatAuth)
		apiRouter.POST("/oauth/wechat/bind", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, controller.WeChatBind)
		apiRouter.GET("/oauth/telegram/login", middleware.CriticalRateLimit(), controller.TelegramLogin)
		apiRouter.GET("/oauth/telegram/bind", middleware.CriticalRateLimit(), controller.TelegramBind)
		// Standard OAuth providers (GitHub, Discord, OIDC, LinuxDO) - unified route
		apiRouter.GET("/oauth/:provider", middleware.CriticalRateLimit(), controller.HandleOAuth)
		apiRouter.GET("/ratio_config", middleware.CriticalRateLimit(), controller.GetRatioConfig)

		apiRouter.POST("/stripe/webhook", controller.StripeWebhook)
		apiRouter.POST("/creem/webhook", controller.CreemWebhook)
		apiRouter.POST("/waffo/webhook", controller.WaffoWebhook)
		//apiRouter.POST("/waffo-pancake/webhook", controller.WaffoPancakeWebhook)

		// Universal secure verification routes
		apiRouter.POST("/verify", middleware.UserAuth(), middleware.CriticalRateLimit(), controller.UniversalVerify)

		userRoute := apiRouter.Group("/user")
		{
			userRoute.POST("/register", middleware.CriticalRateLimit(), middleware.TurnstileCheckForScope(middleware.TurnstileScopeRegister), controller.Register)
			userRoute.GET("/login/encryption-key", middleware.DisableCache(), controller.GetPasswordEncryptionKey)
			userRoute.POST("/login", middleware.CriticalRateLimit(), middleware.TurnstileCheckForScope(middleware.TurnstileScopeLogin), controller.Login)
			userRoute.POST("/login/2fa", middleware.CriticalRateLimit(), controller.Verify2FALogin)
			userRoute.POST("/passkey/login/begin", middleware.CriticalRateLimit(), controller.PasskeyLoginBegin)
			userRoute.POST("/passkey/login/finish", middleware.CriticalRateLimit(), controller.PasskeyLoginFinish)
			//userRoute.POST("/tokenlog", middleware.CriticalRateLimit(), controller.TokenLog)
			userRoute.GET("/logout", controller.Logout)
			userRoute.POST("/epay/notify", anonymousRequestBodyLimit, controller.EpayNotify)
			userRoute.GET("/epay/notify", controller.EpayNotify)
			userRoute.GET("/groups", controller.GetUserGroups)

			selfRoute := userRoute.Group("/")
			selfRoute.Use(middleware.UserAuth())
			{
				selfRoute.GET("/self/groups", controller.GetUserGroups)
				selfRoute.GET("/self", controller.GetSelf)
				selfRoute.GET("/models", controller.GetUserModels)
				selfRoute.GET("/models-dev/catalog", controller.GetModelsDevCatalog)
				selfRoute.PUT("/self", middleware.CriticalRateLimit(), controller.UpdateSelf)
				selfRoute.DELETE("/self", controller.DeleteSelf)
				selfRoute.GET("/token", middleware.CriticalRateLimit(), middleware.UserCriticalRateLimit("access-token"), middleware.DisableCache(), controller.GenerateAccessToken)
				selfRoute.GET("/passkey", controller.PasskeyStatus)
				selfRoute.POST("/passkey/register/begin", controller.PasskeyRegisterBegin)
				selfRoute.POST("/passkey/register/finish", controller.PasskeyRegisterFinish)
				selfRoute.POST("/passkey/verify/begin", controller.PasskeyVerifyBegin)
				selfRoute.POST("/passkey/verify/finish", controller.PasskeyVerifyFinish)
				selfRoute.DELETE("/passkey", controller.PasskeyDelete)
				selfRoute.GET("/aff", controller.GetAffCode)
				selfRoute.GET("/aff/invited", controller.GetInvitedUsers)
				selfRoute.POST("/aff/reset", controller.ResetAffCode)
				selfRoute.POST("/aff/one-time", middleware.CriticalRateLimit(), controller.GenerateOneTimeInviteCode)
				selfRoute.GET("/topup/info", controller.GetTopUpInfo)
				selfRoute.GET("/topup/self", controller.GetUserTopUps)
				selfRoute.POST("/topup", middleware.CriticalRateLimit(), controller.TopUp)
				selfRoute.POST("/pay", middleware.CriticalRateLimit(), controller.RequestEpay)
				selfRoute.POST("/amount", controller.RequestAmount)
				selfRoute.POST("/stripe/pay", middleware.CriticalRateLimit(), controller.RequestStripePay)
				selfRoute.POST("/stripe/amount", controller.RequestStripeAmount)
				selfRoute.POST("/creem/pay", middleware.CriticalRateLimit(), controller.RequestCreemPay)
				selfRoute.POST("/waffo/amount", controller.RequestWaffoAmount)
				selfRoute.POST("/waffo/pay", middleware.CriticalRateLimit(), controller.RequestWaffoPay)
				//selfRoute.POST("/waffo-pancake/amount", controller.RequestWaffoPancakeAmount)
				//selfRoute.POST("/waffo-pancake/pay", middleware.CriticalRateLimit(), controller.RequestWaffoPancakePay)
				selfRoute.POST("/aff_transfer", middleware.UserCriticalRateLimit("aff-transfer"), controller.TransferAffQuota)
				selfRoute.PUT("/setting", controller.UpdateUserSetting)

				// 2FA routes
				selfRoute.GET("/2fa/status", controller.Get2FAStatus)
				selfRoute.POST("/2fa/setup", controller.Setup2FA)
				selfRoute.POST("/2fa/enable", controller.Enable2FA)
				selfRoute.POST("/2fa/disable", controller.Disable2FA)
				selfRoute.POST("/2fa/backup_codes", controller.RegenerateBackupCodes)

				// Check-in routes
				selfRoute.GET("/checkin", controller.GetCheckinStatus)
				selfRoute.POST("/checkin", middleware.TurnstileCheckForScope(middleware.TurnstileScopeCheckin), controller.DoCheckin)
				selfRoute.POST("/checkin/makeup", middleware.TurnstileCheckForScope(middleware.TurnstileScopeCheckin), controller.DoMakeupCheckin)

				// Token loan routes
				selfRoute.GET("/loan/status", controller.GetLoanStatus)
				selfRoute.POST("/loan/agree", controller.AgreeLoanTerms)
				selfRoute.POST("/loan/borrow", controller.BorrowLoan)
				selfRoute.POST("/loan/repay", controller.RepayLoan)
				selfRoute.GET("/loan/records", controller.GetLoanRecords)
				selfRoute.POST("/loan/applications", controller.CreateLoanApplication)
				selfRoute.GET("/loan/applications", controller.GetLoanApplications)
				selfRoute.GET("/loan/applications/:id", controller.GetLoanApplicationDetail)
				selfRoute.POST("/loan/applications/:id/reply", controller.ReplyLoanApplication)
				selfRoute.POST("/loan/applications/:id/rate", controller.RateLoanApplication)

				// Token loan marketplace routes（放贷市场，P2P）
				selfRoute.POST("/loan/market/disclaimer", controller.AgreeLenderDisclaimer)
				selfRoute.GET("/loan/market/offers", controller.GetLoanMarketOffers)
				selfRoute.POST("/loan/market/offers", controller.CreateLoanMarketOffer)
				selfRoute.POST("/loan/market/offers/:id/pause", controller.PauseLoanMarketOffer)
				selfRoute.POST("/loan/market/offers/:id/resume", controller.ResumeLoanMarketOffer)
				selfRoute.POST("/loan/market/offers/:id/close", controller.CloseLoanMarketOffer)
				selfRoute.POST("/loan/market/offers/:id/withdraw", controller.WithdrawLoanMarketOffer)
				selfRoute.GET("/loan/market/list", controller.GetLoanMarketList)
				selfRoute.GET("/loan/market/fundings", controller.GetLoanMarketFundings)
				selfRoute.POST("/loan/market/fundings/:id/resolve", controller.ResolveLoanMarketFunding)
				selfRoute.POST("/loan/market/fundings/:id/repay_plan", controller.SetLoanMarketFundingRepayPlan)

				// Custom OAuth bindings
				selfRoute.GET("/oauth/bindings", controller.GetUserOAuthBindings)
				selfRoute.DELETE("/oauth/bindings/:provider_id", controller.UnbindCustomOAuth)
			}

			adminRoute := userRoute.Group("/")
			adminRoute.Use(middleware.AdminAuth())
			{
				// Token loan admin query routes（只读；与用户自助路由同组，用 /loan/admin 前缀避开冲突）
				adminRoute.GET("/loan/admin/accounts", controller.AdminGetLoanAccounts)
				adminRoute.GET("/loan/admin/records", controller.AdminGetLoanRecords)
				adminRoute.GET("/loan/admin/applications", controller.AdminGetLoanApplications)
				adminRoute.GET("/loan/admin/offers", controller.AdminGetLoanOffers)
				adminRoute.GET("/loan/admin/fundings", controller.AdminGetLoanFundings)
				adminRoute.GET("/loan/admin/market_overview", controller.AdminGetLoanMarketOverview)
				adminRoute.GET("/", controller.GetAllUsers)
				adminRoute.GET("/topup", controller.GetAllTopUps)
				adminRoute.POST("/topup/complete", controller.AdminCompleteTopUp)
				adminRoute.GET("/search", controller.SearchUsers)
				adminRoute.GET("/:id/oauth/bindings", controller.GetUserOAuthBindingsByAdmin)
				adminRoute.DELETE("/:id/oauth/bindings/:provider_id", controller.UnbindCustomOAuthByAdmin)
				adminRoute.DELETE("/:id/bindings/:binding_type", controller.AdminClearUserBinding)
				adminRoute.GET("/:id/groups", controller.AdminGetUserGroups)
				adminRoute.GET("/:id/models", controller.AdminGetUserModels)
				adminRoute.GET("/:id/tokens", controller.AdminGetUserTokens)
				adminRoute.GET("/:id/tokens/:token_id", controller.AdminGetUserToken)
				adminRoute.POST("/:id/tokens", controller.AdminAddUserToken)
				adminRoute.PUT("/:id/tokens/:token_id", controller.AdminUpdateUserToken)
				adminRoute.DELETE("/:id/tokens/:token_id", controller.AdminDeleteUserToken)
				adminRoute.GET("/:id", controller.GetUser)
				adminRoute.POST("/", controller.CreateUser)
				adminRoute.POST("/manage", controller.ManageUser)
				adminRoute.PUT("/", controller.UpdateUser)
				adminRoute.DELETE("/:id", controller.DeleteUser)
				adminRoute.DELETE("/:id/reset_passkey", controller.AdminResetPasskey)

				// Admin 2FA routes
				adminRoute.GET("/2fa/stats", controller.Admin2FAStats)
				adminRoute.DELETE("/:id/2fa", controller.AdminDisable2FA)
			}
		}

		// Checkin risk watch admin routes（签到风控观察名单）
		checkinRiskRoute := apiRouter.Group("/checkin_risk")
		checkinRiskRoute.Use(middleware.AdminAuth())
		{
			checkinRiskRoute.GET("/", controller.AdminListCheckinRiskWatches)
			checkinRiskRoute.GET("/:user_id/contrast", controller.AdminGetCheckinRiskContrast)
			checkinRiskRoute.POST("/:user_id/release", controller.AdminReleaseCheckinRiskWatch)
		}

		// Subscription billing (plans, purchase, admin management)
		subscriptionRoute := apiRouter.Group("/subscription")
		subscriptionRoute.Use(middleware.UserAuth())
		{
			subscriptionRoute.GET("/plans", controller.GetSubscriptionPlans)
			subscriptionRoute.GET("/self", controller.GetSubscriptionSelf)
			subscriptionRoute.PUT("/self/preference", controller.UpdateSubscriptionPreference)
			subscriptionRoute.POST("/balance/pay", middleware.CriticalRateLimit(), controller.SubscriptionRequestBalancePay)
			subscriptionRoute.POST("/epay/pay", middleware.CriticalRateLimit(), controller.SubscriptionRequestEpay)
			subscriptionRoute.POST("/stripe/pay", middleware.CriticalRateLimit(), controller.SubscriptionRequestStripePay)
			subscriptionRoute.POST("/creem/pay", middleware.CriticalRateLimit(), controller.SubscriptionRequestCreemPay)
			subscriptionRoute.POST("/wallet/pay", middleware.CriticalRateLimit(), controller.SubscriptionRequestWalletPay)
			subscriptionRoute.POST("/waffo-pancake/pay", middleware.CriticalRateLimit(), controller.SubscriptionRequestWaffoPancakePay)
		}
		subscriptionAdminRoute := apiRouter.Group("/subscription/admin")
		subscriptionAdminRoute.Use(middleware.AdminAuth())
		{
			subscriptionAdminRoute.GET("/plans", controller.AdminListSubscriptionPlans)
			subscriptionAdminRoute.POST("/plans", controller.AdminCreateSubscriptionPlan)
			subscriptionAdminRoute.PUT("/plans/:id", controller.AdminUpdateSubscriptionPlan)
			subscriptionAdminRoute.PATCH("/plans/:id", controller.AdminUpdateSubscriptionPlanStatus)
			subscriptionAdminRoute.POST("/bind", controller.AdminBindSubscription)
			subscriptionAdminRoute.POST("/plans/:id/subscriptions/reset", controller.AdminResetPlanSubscriptions)

			// User subscription management (admin)
			subscriptionAdminRoute.GET("/users/:id/subscriptions", controller.AdminListUserSubscriptions)
			subscriptionAdminRoute.POST("/users/:id/subscriptions", controller.AdminCreateUserSubscription)
			subscriptionAdminRoute.POST("/users/:id/subscriptions/reset", controller.AdminResetUserSubscriptionsByPlan)
			subscriptionAdminRoute.POST("/user_subscriptions/:id/invalidate", controller.AdminInvalidateUserSubscription)
			subscriptionAdminRoute.DELETE("/user_subscriptions/:id", controller.AdminDeleteUserSubscription)
		}

		// Subscription payment callbacks (no auth)
		apiRouter.POST("/subscription/epay/notify", anonymousRequestBodyLimit, controller.SubscriptionEpayNotify)
		apiRouter.GET("/subscription/epay/notify", controller.SubscriptionEpayNotify)
		apiRouter.GET("/subscription/epay/return", controller.SubscriptionEpayReturn)
		apiRouter.POST("/subscription/epay/return", anonymousRequestBodyLimit, controller.SubscriptionEpayReturn)
		optionRoute := apiRouter.Group("/option")
		optionRoute.Use(middleware.RootAuth())
		{
			optionRoute.GET("/", controller.GetOptions)
			optionRoute.PUT("/", controller.UpdateOption)
			optionRoute.PUT("/passkey/domains", controller.UpdatePasskeyDomains)
			optionRoute.POST("/test_email", middleware.CriticalRateLimit(), controller.TestEmailDelivery)
			optionRoute.GET("/email_templates", controller.GetEmailTemplateCatalog)
			optionRoute.GET("/email_templates/:event/:locale", controller.GetEmailTemplate)
			optionRoute.PUT("/email_templates/:event/:locale", controller.UpdateEmailTemplate)
			optionRoute.DELETE("/email_templates/:event/:locale", controller.RestoreEmailTemplate)
			optionRoute.POST("/email_templates/preview", controller.PreviewEmailTemplate)
			optionRoute.POST("/payment_compliance", controller.ConfirmPaymentCompliance)
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
		ratioSyncRoute := apiRouter.Group("/ratio_sync")
		ratioSyncRoute.Use(middleware.RootAuth())
		{
			ratioSyncRoute.GET("/channels", controller.GetSyncableChannels)
			ratioSyncRoute.POST("/fetch", controller.FetchUpstreamRatios)
		}
		registerChannelRoutes(apiRouter)
		registerAuthzRoutes(apiRouter)
		tokenRoute := apiRouter.Group("/token")
		tokenRoute.Use(middleware.UserAuth())
		{
			tokenRoute.GET("/", controller.GetAllTokens)
			tokenRoute.GET("/search", middleware.SearchRateLimit(), controller.SearchTokens)
			tokenRoute.GET("/:id", controller.GetToken)
			tokenRoute.POST("/:id/key", middleware.CriticalRateLimit(), middleware.DisableCache(), controller.GetTokenKey)
			tokenRoute.POST("/", controller.AddToken)
			tokenRoute.PUT("/", controller.UpdateToken)
			tokenRoute.DELETE("/:id", controller.DeleteToken)
			tokenRoute.POST("/batch", controller.DeleteTokenBatch)
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
		logRoute.GET("/email", middleware.AdminAuth(), controller.GetAllEmailLogs)
		logRoute.GET("/email/:id", middleware.AdminAuth(), controller.GetEmailLog)
		logRoute.GET("/stat", middleware.AdminAuth(), controller.GetLogsStat)
		logRoute.GET("/self/stat", middleware.UserAuth(), controller.GetLogsSelfStat)
		logRoute.GET("/channel_affinity_usage_cache", middleware.AdminAuth(), controller.GetChannelAffinityUsageCacheStats)
		logRoute.GET("/search", middleware.AdminAuth(), controller.SearchAllLogs)
		logRoute.GET("/self", middleware.UserAuth(), controller.GetUserLogs)
		logRoute.GET("/self/search", middleware.UserAuth(), middleware.SearchRateLimit(), controller.SearchUserLogs)

		systemTaskRoute := apiRouter.Group("/system-task")
		systemTaskRoute.Use(middleware.RootAuth())
		{
			systemTaskRoute.POST("/log-cleanup", controller.CreateLogCleanupSystemTask)
			systemTaskRoute.GET("/list", controller.ListSystemTasks)
			systemTaskRoute.GET("/current", controller.GetCurrentSystemTask)
			systemTaskRoute.GET("/:task_id", controller.GetSystemTask)
		}
		systemInfoRoute := apiRouter.Group("/system-info")
		systemInfoRoute.Use(middleware.RootAuth())
		{
			systemInfoRoute.GET("/instances", controller.ListSystemInstances)
			systemInfoRoute.DELETE("/stale-instances", controller.DeleteStaleSystemInstances)
			systemInfoRoute.DELETE("/instances/:node_name", controller.DeleteStaleSystemInstance)
		}

		dataRoute := apiRouter.Group("/data")
		dataRoute.GET("/", middleware.AdminAuth(), controller.GetAllQuotaDates)
		dataRoute.GET("/users", middleware.AdminAuth(), controller.GetQuotaDatesByUser)
		dataRoute.GET("/self", middleware.UserAuth(), controller.GetUserQuotaDates)
		dataRoute.GET("/flow", middleware.AdminAuth(), controller.GetAllFlowQuotaDates)
		dataRoute.GET("/flow/self", middleware.UserAuth(), controller.GetUserFlowQuotaDates)

		logRoute.Use(middleware.CORS(), middleware.CriticalRateLimit())
		{
			logRoute.GET("/token", middleware.TokenAuthReadOnly(), controller.GetLogByKey)
		}
		groupRoute := apiRouter.Group("/group")
		groupRoute.Use(middleware.AdminAuth())
		{
			groupRoute.GET("/", controller.GetGroups)
		}

		ipBanRoute := apiRouter.Group("/ip_ban")
		ipBanRoute.Use(middleware.AdminAuth())
		{
			ipBanRoute.GET("/", controller.GetAllIPBans)
			ipBanRoute.GET("/search", controller.SearchIPBans)
			ipBanRoute.GET("/:id", controller.GetIPBan)
			ipBanRoute.POST("/", controller.AddIPBan)
			ipBanRoute.PUT("/", controller.UpdateIPBan)
			ipBanRoute.DELETE("/:id", controller.DeleteIPBan)
			ipBanRoute.POST("/batch", controller.BatchCreateIPBans)
		}

		// 风控中心（仅 root 可访问）
		riskGroup := apiRouter.Group("/risk")
		riskGroup.Use(middleware.RootAuth())
		{
			// 阈值前实时进度
			riskGroup.GET("/live-progress/rules", controller.ListRiskLiveRules)
			riskGroup.GET("/live-progress/targets", controller.ListRiskLiveTargets)
			riskGroup.PATCH("/live-progress/rules/enabled", controller.ToggleRiskLiveRule)
			// 批量模型探测防护
			riskGroup.GET("/probe-guard/config", controller.GetProbeGuardConfig)
			riskGroup.PUT("/probe-guard/config", controller.UpdateProbeGuardConfig)
			riskGroup.GET("/probe-guard/ip-offenses", controller.ListProbeIPOffenses)
			riskGroup.GET("/probe-guard/user-offenses", controller.ListProbeUserOffenses)
			riskGroup.POST("/probe-guard/ip-offenses/:ip/reset", controller.ResetProbeIPOffense)
			riskGroup.POST("/probe-guard/user-offenses/:id/unban", controller.UnbanProbeUser)
			riskGroup.GET("/probe-guard/stats", controller.ProbeGuardStats)
			// 错误日志触发自动封禁
			riskGroup.GET("/error-ban/config", controller.GetErrorBanConfig)
			riskGroup.PUT("/error-ban/config", controller.UpdateErrorBanConfig)
			riskGroup.POST("/error-ban/rules/test", controller.TestErrorBanRule)
			riskGroup.GET("/error-ban/ip-states", controller.ListErrorBanIPStates)
			riskGroup.GET("/error-ban/user-states", controller.ListErrorBanUserStates)
			riskGroup.POST("/error-ban/ip-states/:ip/reset", controller.ResetErrorBanIPState)
			riskGroup.POST("/error-ban/user-states/:id/reset", controller.ResetErrorBanUserState)
			riskGroup.GET("/error-ban/stats", controller.ErrorBanStats)
			// 统一封禁日志
			riskGroup.GET("/ban-logs", controller.ListRiskBanLogs)
			riskGroup.GET("/ban-logs/stats", controller.RiskBanLogStats)
			riskGroup.GET("/ban-logs/:id", controller.GetRiskBanLog)
			// 多开账号证据排行与管理员人工封禁
			riskGroup.GET("/multi-account", controller.ListMultiAccountClusters)
			riskGroup.POST("/multi-account/users/:id/ban", controller.BanMultiAccountUser)
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
		mjRoute.GET("/self", middleware.UserAuth(), controller.GetUserMidjourney)
		mjRoute.GET("/", middleware.AdminAuth(), controller.GetAllMidjourney)

		taskRoute := apiRouter.Group("/task")
		{
			taskRoute.GET("/self", middleware.UserAuth(), controller.GetUserTask)
			taskRoute.GET("/", middleware.AdminAuth(), controller.GetAllTask)
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
