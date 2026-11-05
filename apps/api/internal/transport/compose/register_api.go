package compose

import (
	"github.com/QuantumNous/new-api/internal/billing"
	"github.com/QuantumNous/new-api/internal/identity"
	"github.com/QuantumNous/new-api/internal/identity/policy"
	"github.com/QuantumNous/new-api/internal/ops"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/handler"
	"github.com/QuantumNous/new-api/internal/transport/middleware"
	"github.com/QuantumNous/new-api/internal/usage"

	// Import oauth package to register providers via init()
	_ "github.com/QuantumNous/new-api/internal/security/oauth"

	"github.com/QuantumNous/new-api/internal/security"
)

func SetApiRouter(router contract.Engine) {
	apiRouter := router.Group("/api")
	apiRouter.Use(middleware.RouteTag("api"))
	apiRouter.UseCompression()
	apiRouter.Use(middleware.BodyStorageCleanup()) // 清理请求体存储
	apiRouter.Use(middleware.GlobalAPIRateLimit())
	anonymousRequestBodyLimit := middleware.AnonymousRequestBodyLimit()
	{
		apiRouter.GET("/setup", ops.GetSetup)
		apiRouter.POST("/setup", anonymousRequestBodyLimit, ops.PostSetup)
		apiRouter.GET("/status", handler.GetStatus)
		apiRouter.GET("/home_stats", handler.GetHomeStats)
		apiRouter.GET("/uptime/status", ops.GetUptimeKumaStatus)
		apiRouter.GET("/models", security.UserAuth(), middleware.ReadOnlyCache(middleware.ReadOnlyCacheConfig{Namespace: "api_models", TTL: middleware.CacheTTLShort, Params: []string{}}), handler.DashboardListModels)
		apiRouter.GET("/status/test", security.AdminAuth(), handler.TestStatus)
		apiRouter.GET("/notice", handler.GetNotice)
		apiRouter.GET("/user-agreement", handler.GetUserAgreement)
		apiRouter.GET("/privacy-policy", handler.GetPrivacyPolicy)
		apiRouter.GET("/about", handler.GetAbout)
		//apiRouter.GET("/midjourney", handler.GetMidjourney)
		apiRouter.GET("/home_page_content", handler.GetHomePageContent)
		// QQ open-platform webhook. Public by design; every dispatch must pass
		// Ed25519 signature verification inside the handler. The *token wildcard
		// serves the optional WebhookPathToken suffix (billing.GetQQWebhookPath):
		// the handler 404s any request whose path does not match the currently
		// configured token, so no route re-registration is needed when the token
		// changes at runtime.
		apiRouter.POST("/qqbot/webhook", anonymousRequestBodyLimit, billing.QQBotWebhook)
		apiRouter.POST("/qqbot/webhook/*token", anonymousRequestBodyLimit, billing.QQBotWebhook)
		apiRouter.GET("/pricing", middleware.HeaderNavModuleAuth("pricing"), handler.GetPricing)
		// /api/log routes
		logRoute := apiRouter.Group("/log")
		logRoute.GET("/", security.AdminAuth(), handler.GetAllLogs)
		logRoute.GET("/stat", security.AdminAuth(), middleware.ReadOnlyCache(middleware.ReadOnlyCacheConfig{Namespace: "api_log_stat", TTL: middleware.CacheTTLMedium, Params: []string{"type", "start_timestamp", "end_timestamp", "model_name", "username", "token_name", "channel", "group"}}), handler.GetLogsStat)
		logRoute.GET("/self/stat", security.UserAuth(), handler.GetLogsSelfStat)
		logRoute.GET("/channel_affinity_usage_cache", security.AdminAuth(), handler.GetChannelAffinityUsageCacheStats)
		logRoute.GET("/search", security.AdminAuth(), handler.SearchAllLogs)
		logRoute.GET("/self", security.UserAuth(), handler.GetUserLogs)
		logRoute.GET("/self/search", security.UserAuth(), middleware.SearchRateLimit(), handler.SearchUserLogs)
		logRoute.UseCORS()
		logRoute.Use(middleware.CriticalRateLimit())
		{
			logRoute.GET("/token", security.TokenAuthReadOnly(), handler.GetLogByKey)
		}

		// /api/data routes
		dataRoute := apiRouter.Group("/data")
		dataRoute.GET("/", security.AdminAuth(), middleware.ReadOnlyCache(middleware.ReadOnlyCacheConfig{Namespace: "api_data", TTL: middleware.CacheTTLLong, Params: []string{"start_timestamp", "end_timestamp", "username", "default_time"}}), handler.GetAllQuotaDates)
		dataRoute.GET("/users", security.AdminAuth(), middleware.ReadOnlyCache(middleware.ReadOnlyCacheConfig{Namespace: "api_data_users", TTL: middleware.CacheTTLLong, Params: []string{"start_timestamp", "end_timestamp"}}), handler.GetQuotaDatesByUser)
		dataRoute.GET("/self", security.UserAuth(), handler.GetUserQuotaDates)
		dataRoute.GET("/flow", security.AdminAuth(), handler.GetAllFlowQuotaDates)
		dataRoute.GET("/flow/self", security.UserAuth(), handler.GetUserFlowQuotaDates)

		// /api/rankings route
		apiRouter.GET("/rankings", middleware.HeaderNavModuleAuth("rankings"), middleware.ReadOnlyCache(middleware.ReadOnlyCacheConfig{Namespace: "api_rankings", TTL: middleware.CacheTTLLong, Params: []string{"period"}}), handler.GetRankings)

		// /api/perf-metrics routes
		perfMetricsRoute := apiRouter.Group("/perf-metrics")
		perfMetricsRoute.Use(middleware.HeaderNavModulePublicOrUserAuth("pricing"))
		{
			perfMetricsRoute.GET("/summary", handler.GetPerfMetricsSummary)
			perfMetricsRoute.GET("", handler.GetPerfMetrics)
		}

		// /api/performance routes
		performanceRoute := apiRouter.Group("/performance")
		performanceRoute.Use(security.AdminAuth(), security.RequirePermission(policy.SystemSettings))
		{
			performanceRoute.GET("/stats", usage.GetPerformanceStats)
			performanceRoute.DELETE("/disk_cache", usage.ClearDiskCache)
			performanceRoute.POST("/reset_stats", usage.ResetPerformanceStats)
			performanceRoute.POST("/gc", usage.ForceGC)
			performanceRoute.GET("/logs", usage.GetLogFiles)
			performanceRoute.DELETE("/logs", usage.CleanupLogFiles)
		}
		routeUnitAuditRoute := apiRouter.Group("/route_unit")
		routeUnitAuditRoute.Use(security.AdminAuth(), security.RequirePermission(policy.SystemSettings))
		{
			routeUnitAuditRoute.GET("/audit", handler.GetRouteUnitAudit)
		}
		apiRouter.GET("/verification", middleware.EmailVerificationRateLimit(), middleware.TurnstileCheck(), identity.SendEmailVerification)
		apiRouter.GET("/reset_password", middleware.CriticalRateLimit(), middleware.TurnstileCheck(), identity.SendPasswordResetEmail)
		apiRouter.POST("/user/reset", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, identity.ResetPassword)
		// OAuth routes - specific routes must come before :provider wildcard
		apiRouter.POST("/oauth/state", middleware.CriticalRateLimit(), middleware.DisableCache(), security.TryUserAuth(), anonymousRequestBodyLimit, handler.GenerateOAuthCode)
		apiRouter.POST("/oauth/email/bind", security.UserAuth(), middleware.CriticalRateLimit(), identity.EmailBind)
		// Non-standard OAuth (WeChat, Telegram) - keep original routes
		apiRouter.GET("/oauth/wechat", middleware.CriticalRateLimit(), middleware.DisableCache(), identity.WeChatAuth)
		apiRouter.POST("/oauth/wechat/bind", security.UserAuth(), middleware.CriticalRateLimit(), identity.WeChatBind)
		apiRouter.GET("/oauth/telegram/login", middleware.CriticalRateLimit(), middleware.DisableCache(), identity.TelegramLogin)
		apiRouter.POST("/oauth/telegram/bind/start", security.UserAuth(), middleware.CriticalRateLimit(), middleware.DisableCache(), identity.TelegramBindStart)
		apiRouter.GET("/oauth/telegram/bind/:flow_token", middleware.CriticalRateLimit(), middleware.DisableCache(), identity.TelegramBind)
		// Standard OAuth providers (GitHub, Discord, OIDC, LinuxDO) - unified route
		apiRouter.GET("/oauth/:provider", middleware.CriticalRateLimit(), middleware.DisableCache(), security.TryUserAuth(), handler.HandleOAuth)
		apiRouter.GET("/ratio_config", middleware.CriticalRateLimit(), handler.GetRatioConfig)

		apiRouter.POST("/stripe/webhook", anonymousRequestBodyLimit, billing.StripeWebhook)
		apiRouter.POST("/creem/webhook", anonymousRequestBodyLimit, billing.CreemWebhook)
		apiRouter.POST("/waffo/webhook", anonymousRequestBodyLimit, billing.WaffoWebhook)
		// :env separates test vs prod URLs so the operator can register each
		// in Pancake's matching webhook slot; handler enforces env match.
		apiRouter.POST("/waffo-pancake/webhook/:env", anonymousRequestBodyLimit, billing.WaffoPancakeWebhook)

		// Universal secure verification routes
		apiRouter.POST("/verify", security.UserAuth(), middleware.CriticalRateLimit(), middleware.DisableCache(), identity.UniversalVerify)

		userRoute := apiRouter.Group("/user")
		{
			userRoute.POST("/auth/refresh", security.SessionCookieOriginGuard(), middleware.CriticalRateLimit(), middleware.DisableCache(), identity.RefreshAuth)
			userRoute.POST("/auth/logout", security.SessionCookieOriginGuard(), middleware.CriticalRateLimit(), middleware.DisableCache(), identity.AuthLogout)
			userRoute.POST("/register", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, middleware.TurnstileCheck(), identity.Register)
			userRoute.POST("/login", middleware.CriticalRateLimit(), middleware.DisableCache(), anonymousRequestBodyLimit, middleware.TurnstileCheck(), identity.Login)
			// Dev-only credential-free login. Compiled out entirely without the
			// `dev` build tag, so a production binary serves 404 here.
			registerDevAutoLogin(userRoute)
			userRoute.POST("/login/2fa", middleware.CriticalRateLimit(), middleware.DisableCache(), anonymousRequestBodyLimit, identity.Verify2FALogin)
			userRoute.POST("/passkey/login/begin", middleware.CriticalRateLimit(), middleware.DisableCache(), anonymousRequestBodyLimit, identity.PasskeyLoginBegin)
			userRoute.POST("/passkey/login/finish", middleware.CriticalRateLimit(), middleware.DisableCache(), anonymousRequestBodyLimit, identity.PasskeyLoginFinish)
			//userRoute.POST("/tokenlog", middleware.CriticalRateLimit(), controller.TokenLog)
			userRoute.POST("/epay/notify", anonymousRequestBodyLimit, billing.EpayNotify)
			userRoute.GET("/epay/notify", billing.EpayNotify)
			userRoute.POST("/vmq/notify", anonymousRequestBodyLimit, billing.VmqNotify)
			userRoute.GET("/vmq/notify", billing.VmqNotify)
			userRoute.POST("/codepay/notify", anonymousRequestBodyLimit, billing.CodePayNotify)
			userRoute.GET("/codepay/notify", billing.CodePayNotify)
			userRoute.GET("/groups", handler.GetUserGroups)

			selfRoute := userRoute.Group("/")
			selfRoute.Use(security.UserAuth())
			{
				selfRoute.GET("/sessions", middleware.DisableCache(), identity.GetLoginSessions)
				selfRoute.DELETE("/sessions/:sid", middleware.DisableCache(), identity.DeleteLoginSession)
				selfRoute.POST("/sessions/revoke-others", middleware.DisableCache(), identity.RevokeOtherLoginSessions)
				selfRoute.GET("/self/groups", handler.GetUserGroups)
				selfRoute.GET("/self", identity.GetSelf)
				selfRoute.GET("/models", identity.GetUserModels)
				selfRoute.PUT("/self", middleware.CriticalRateLimit(), middleware.DisableCache(), identity.UpdateSelf)
				selfRoute.DELETE("/self", identity.DeleteSelf)
				selfRoute.GET("/token", middleware.CriticalRateLimit(), middleware.UserCriticalRateLimit("access-token"), middleware.DisableCache(), identity.GenerateAccessToken)
				selfRoute.GET("/passkey", identity.PasskeyStatus)
				selfRoute.POST("/passkey/register/begin", middleware.DisableCache(), identity.PasskeyRegisterBegin)
				selfRoute.POST("/passkey/register/finish", middleware.DisableCache(), identity.PasskeyRegisterFinish)
				selfRoute.POST("/passkey/verify/begin", middleware.DisableCache(), identity.PasskeyVerifyBegin)
				selfRoute.POST("/passkey/verify/finish", middleware.DisableCache(), identity.PasskeyVerifyFinish)
				selfRoute.DELETE("/passkey", middleware.DisableCache(), identity.PasskeyDelete)
				selfRoute.GET("/aff", identity.GetAffCode)
				selfRoute.GET("/topup/info", billing.GetTopUpInfo)
				selfRoute.GET("/topup/self", billing.GetUserTopUps)
				selfRoute.POST("/topup", middleware.CriticalRateLimit(), identity.TopUp)
				selfRoute.POST("/pay", middleware.CriticalRateLimit(), billing.RequestEpay)
				selfRoute.POST("/amount", billing.RequestAmount)
				selfRoute.POST("/stripe/pay", middleware.CriticalRateLimit(), billing.RequestStripePay)
				selfRoute.POST("/stripe/amount", billing.RequestStripeAmount)
				selfRoute.POST("/creem/pay", middleware.CriticalRateLimit(), billing.RequestCreemPay)
				selfRoute.POST("/waffo/amount", billing.RequestWaffoAmount)
				selfRoute.POST("/waffo/pay", middleware.CriticalRateLimit(), billing.RequestWaffoPay)
				selfRoute.POST("/waffo-pancake/amount", billing.RequestWaffoPancakeAmount)
				selfRoute.POST("/waffo-pancake/pay", middleware.CriticalRateLimit(), billing.RequestWaffoPancakePay)
				selfRoute.POST("/vmq/pay", middleware.CriticalRateLimit(), billing.RequestVmqPay)
				selfRoute.POST("/codepay/pay", middleware.CriticalRateLimit(), billing.RequestCodePayPay)
				selfRoute.POST("/aff_transfer", middleware.UserCriticalRateLimit("aff-transfer"), billing.RequirePaymentComplianceMiddleware, identity.TransferAffQuota)
				selfRoute.PUT("/setting", identity.UpdateUserSettingHandler)

				// 2FA routes
				selfRoute.GET("/2fa/status", identity.Get2FAStatus)
				selfRoute.POST("/2fa/setup", middleware.DisableCache(), identity.Setup2FA)
				selfRoute.POST("/2fa/enable", middleware.DisableCache(), identity.Enable2FA)
				selfRoute.POST("/2fa/disable", middleware.DisableCache(), identity.Disable2FA)
				selfRoute.POST("/2fa/backup_codes", middleware.DisableCache(), identity.RegenerateBackupCodes)

				// Check-in routes
				selfRoute.GET("/checkin", billing.GetCheckinStatus)
				selfRoute.POST("/checkin", middleware.TurnstileCheck(), billing.DoCheckin)

				// QQ binding routes
				selfRoute.GET("/qq/bind", billing.GetQQBindStatus)
				selfRoute.POST("/qq/bind/code", middleware.CriticalRateLimit(), middleware.DisableCache(), billing.GenerateQQBindCode)
				selfRoute.DELETE("/qq/bind", middleware.CriticalRateLimit(), billing.UnbindQQ)
				selfRoute.POST("/qq/panel/sync", security.AdminAuth(), middleware.CriticalRateLimit(), billing.SyncQQPanel)

				// Custom OAuth bindings
				selfRoute.GET("/oauth/bindings", identity.GetUserOAuthBindings)
				selfRoute.DELETE("/oauth/bindings/:provider_id", identity.UnbindCustomOAuth)
			}

			adminRoute := userRoute.Group("/")
			adminRoute.Use(security.AdminAuth())
			{
				adminRoute.GET("/", identity.GetAllUsers)
				adminRoute.GET("/topup", billing.GetAllTopUps)
				adminRoute.POST("/topup/complete", billing.AdminCompleteTopUp)
				adminRoute.GET("/search", identity.SearchUsersHandler)
				adminRoute.GET("/:id/oauth/bindings", identity.GetUserOAuthBindingsByAdmin)
				adminRoute.DELETE("/:id/oauth/bindings/:provider_id", identity.UnbindCustomOAuthByAdmin)
				adminRoute.DELETE("/:id/bindings/:binding_type", identity.AdminClearUserBinding)
				adminRoute.GET("/:id", identity.GetUser)
				adminRoute.POST("/", identity.CreateUser)
				adminRoute.POST("/manage", identity.ManageUser)
				adminRoute.PUT("/", identity.UpdateUser)
				adminRoute.DELETE("/:id", identity.DeleteUser)
				adminRoute.DELETE("/:id/reset_passkey", identity.AdminResetPasskey)

				// Admin 2FA routes
				adminRoute.GET("/2fa/stats", identity.Admin2FAStats)
				adminRoute.DELETE("/:id/2fa", identity.AdminDisable2FA)
			}
		}

		// User insights (admin only): client fingerprint, usage profile,
		// jailbreak risk. Ban actions reuse /api/user/manage.
		insightRoute := apiRouter.Group("/user-insight")
		insightRoute.Use(security.AdminAuth())
		{
			insightRoute.GET("/summary", usage.HandleGetUserInsightSummary)
			insightRoute.GET("", usage.HandleGetUserInsights)
			insightRoute.GET("/client-catalog", usage.HandleGetClientCatalog)
			insightRoute.GET("/:id", usage.HandleGetUserInsightDetail)
			insightRoute.DELETE("/:id", usage.HandlePurgeUserInsight)
			// Client banning by request-header detection: global (site-wide)
			// and per-user scopes. Enforced on relay routes by InsightClientBan.
			insightRoute.POST("/client-ban", usage.HandleSetGlobalClientBan)
			insightRoute.POST("/:id/client-ban", usage.HandleToggleUserClientBan)
		}
		// Evidence samples: hit keywords with original sentences, plus the
		// optional full request body.
		insightSampleRoute := apiRouter.Group("/insight-sample")
		insightSampleRoute.Use(security.AdminAuth())
		{
			insightSampleRoute.GET("", usage.HandleGetInsightSamples)
			insightSampleRoute.GET("/:id", usage.HandleGetInsightSampleDetail)
			insightSampleRoute.DELETE("/user/:id", usage.HandleDeleteUserInsightSamples)
		}
		insightSampleGroupRoute := apiRouter.Group("/insight-sample-group")
		insightSampleGroupRoute.Use(security.AdminAuth())
		{
			insightSampleGroupRoute.GET("", usage.HandleGetInsightSampleGroups)
		}

		// Subscription billing (plans, purchase, admin management)
		subscriptionRoute := apiRouter.Group("/subscription")
		subscriptionRoute.Use(security.UserAuth())
		{
			subscriptionRoute.GET("/plans", billing.GetSubscriptionPlans)
			subscriptionRoute.GET("/self", billing.GetSubscriptionSelf)
			subscriptionRoute.PUT("/self/preference", billing.UpdateSubscriptionPreference)
			subscriptionRoute.POST("/balance/pay", middleware.CriticalRateLimit(), billing.SubscriptionRequestBalancePay)
			subscriptionRoute.POST("/epay/pay", middleware.CriticalRateLimit(), billing.SubscriptionRequestEpay)
			subscriptionRoute.POST("/stripe/pay", middleware.CriticalRateLimit(), billing.SubscriptionRequestStripePay)
			subscriptionRoute.POST("/creem/pay", middleware.CriticalRateLimit(), billing.SubscriptionRequestCreemPay)
			subscriptionRoute.POST("/waffo-pancake/pay", middleware.CriticalRateLimit(), billing.SubscriptionRequestWaffoPancakePay)
			subscriptionRoute.POST("/vmq/pay", middleware.CriticalRateLimit(), billing.SubscriptionRequestVmqPay)
			subscriptionRoute.POST("/codepay/pay", middleware.CriticalRateLimit(), billing.SubscriptionRequestCodePayPay)
		}
		subscriptionAdminRoute := apiRouter.Group("/subscription/admin")
		subscriptionAdminRoute.Use(security.AdminAuth())
		{
			subscriptionAdminRoute.GET("/plans", billing.AdminListSubscriptionPlans)
			subscriptionAdminRoute.POST("/plans", billing.AdminCreateSubscriptionPlan)
			subscriptionAdminRoute.PUT("/plans/:id", billing.AdminUpdateSubscriptionPlan)
			subscriptionAdminRoute.PATCH("/plans/:id", billing.AdminUpdateSubscriptionPlanStatus)
			subscriptionAdminRoute.POST("/bind", billing.AdminBindSubscription)
			subscriptionAdminRoute.POST("/plans/:id/subscriptions/reset", billing.AdminResetPlanSubscriptions)

			// User subscription management (admin)
			subscriptionAdminRoute.GET("/users/:id/subscriptions", billing.AdminListUserSubscriptions)
			subscriptionAdminRoute.POST("/users/:id/subscriptions", billing.AdminCreateUserSubscription)
			subscriptionAdminRoute.POST("/users/:id/subscriptions/reset", billing.AdminResetUserSubscriptionsByPlan)
			subscriptionAdminRoute.POST("/user_subscriptions/:id/invalidate", billing.AdminInvalidateUserSubscription)
			subscriptionAdminRoute.DELETE("/user_subscriptions/:id", billing.AdminDeleteUserSubscription)
		}

		// Subscription payment callbacks (no auth)
		apiRouter.POST("/subscription/epay/notify", anonymousRequestBodyLimit, billing.SubscriptionEpayNotify)
		apiRouter.GET("/subscription/epay/notify", billing.SubscriptionEpayNotify)
		apiRouter.GET("/subscription/epay/return", billing.SubscriptionEpayReturn)
		apiRouter.POST("/subscription/vmq/notify", anonymousRequestBodyLimit, billing.SubscriptionVmqNotify)
		apiRouter.GET("/subscription/vmq/notify", billing.SubscriptionVmqNotify)
		apiRouter.POST("/subscription/codepay/notify", anonymousRequestBodyLimit, billing.SubscriptionCodePayNotify)
		apiRouter.GET("/subscription/codepay/notify", billing.SubscriptionCodePayNotify)
		optionRoute := apiRouter.Group("/option")
		optionRoute.Use(security.AdminAuth(), security.RequirePermission(policy.SystemSettings))
		{
			optionRoute.GET("/", ops.GetOptions)
			optionRoute.PUT("/", ops.UpdateOption)
			optionRoute.POST("/payment_compliance", billing.ConfirmPaymentCompliance)
			optionRoute.GET("/channel_affinity_cache", handler.GetChannelAffinityCacheStats)
			optionRoute.GET("/smtp_pool_status", handler.GetSMTPPoolStatus)
			optionRoute.DELETE("/channel_affinity_cache", handler.ClearChannelAffinityCache)
			optionRoute.POST("/rest_model_ratio", handler.ResetModelRatio)
			optionRoute.GET("/waffo-pancake/catalog", billing.ListWaffoPancakeCatalog)
			optionRoute.POST("/waffo-pancake/pair", billing.CreateWaffoPancakePair)
			optionRoute.POST("/waffo-pancake/save", billing.SaveWaffoPancake)
			optionRoute.POST("/waffo-pancake/subscription-product", billing.CreateWaffoPancakeSubscriptionProduct)
			optionRoute.GET("/waffo-pancake/subscription-product-options", billing.ListWaffoPancakeSubscriptionProductOptions)
		}
		geoipRoute := apiRouter.Group("/geoip")
		geoipRoute.Use(security.AdminAuth(), security.RequirePermission(policy.SystemSettings))
		{
			geoipRoute.GET("/database", ops.GetGeoIPDatabase)
			geoipRoute.POST("/database/update", ops.UpdateGeoIPDatabase)
		}
		proxyRoute := apiRouter.Group("/proxy")
		proxyRoute.Use(security.AdminAuth(), security.RequirePermission(policy.SystemSettings))
		{
			proxyRoute.GET("/config", ops.GetProxyConfig)
			proxyRoute.PUT("/config", ops.UpdateProxyConfig)
			proxyRoute.GET("/config/generate", ops.GenerateProxyConfig)
			proxyRoute.GET("/status", ops.GetProxyStatus)
			proxyRoute.POST("/reload", ops.ReloadProxy)
			proxyRoute.GET("/nodes", ops.ListProxyNodes)
			proxyRoute.GET("/nodes/report", ops.GetProxyNodeReport)
			proxyRoute.POST("/nodes", ops.CreateProxyNode)
			proxyRoute.POST("/nodes/batch", ops.BatchCreateProxyNodes)
			proxyRoute.POST("/nodes/batch-enabled", ops.BatchSetProxyNodesEnabled)
			proxyRoute.POST("/nodes/batch-clear-errors", ops.BatchClearProxyNodeErrors)
			proxyRoute.GET("/nodes/:id", ops.GetProxyNode)
			proxyRoute.PUT("/nodes/:id", ops.UpdateProxyNode)
			proxyRoute.DELETE("/nodes/:id", ops.DeleteProxyNode)
			proxyRoute.POST("/nodes/:id/test", ops.TestProxyNode)
			proxyRoute.POST("/nodes/test", ops.TestAllProxyNodes)
		}

		// Custom OAuth provider management (admin with system.settings permission)
		customOAuthRoute := apiRouter.Group("/custom-oauth-provider")
		customOAuthRoute.Use(security.AdminAuth(), security.RequirePermission(policy.SystemSettings))
		{
			customOAuthRoute.POST("/discovery", identity.FetchCustomOAuthDiscovery)
			customOAuthRoute.GET("/", identity.GetCustomOAuthProviders)
			customOAuthRoute.GET("/:id", identity.GetCustomOAuthProvider)
			customOAuthRoute.POST("/", identity.CreateCustomOAuthProvider)
			customOAuthRoute.PUT("/:id", identity.UpdateCustomOAuthProvider)
			customOAuthRoute.DELETE("/:id", identity.DeleteCustomOAuthProvider)
		}
		ratioSyncRoute := apiRouter.Group("/ratio_sync")
		ratioSyncRoute.Use(security.AdminAuth(), security.RequirePermission(policy.SystemSettings))
		{
			ratioSyncRoute.GET("/channels", handler.GetSyncableChannels)
			ratioSyncRoute.POST("/fetch", handler.FetchUpstreamRatios)
		}
		registerChannelRoutes(apiRouter)
		registerAuthzRoutes(apiRouter)
		tokenRoute := apiRouter.Group("/token")
		tokenRoute.Use(security.UserAuth())
		{
			tokenRoute.GET("/", identity.GetAllTokens)
			tokenRoute.GET("/search", middleware.SearchRateLimit(), identity.SearchTokens)
			tokenRoute.GET("/auto-groups", identity.GetTokenAutoGroups)
			tokenRoute.GET("/:id", identity.GetToken)
			tokenRoute.POST("/:id/key", middleware.CriticalRateLimit(), middleware.DisableCache(), identity.GetTokenKey)
			tokenRoute.POST("/", identity.AddToken)
			tokenRoute.PUT("/", identity.UpdateToken)
			tokenRoute.DELETE("/:id", identity.DeleteToken)
			tokenRoute.POST("/batch", identity.DeleteTokenBatch)
			tokenRoute.POST("/batch/keys", middleware.CriticalRateLimit(), middleware.DisableCache(), identity.GetTokenKeysBatch)
		}

		usageRoute := apiRouter.Group("/usage")
		usageRoute.UseCORS()
		usageRoute.Use(middleware.CriticalRateLimit())
		{
			tokenUsageRoute := usageRoute.Group("/token")
			tokenUsageRoute.Use(security.TokenAuthReadOnly())
			{
				tokenUsageRoute.GET("/", identity.GetTokenUsage)
			}
		}

		redemptionRoute := apiRouter.Group("/redemption")
		redemptionRoute.Use(security.AdminAuth())
		{
			redemptionRoute.GET("/", billing.GetAllRedemptions)
			redemptionRoute.GET("/search", billing.SearchRedemptions)
			redemptionRoute.GET("/:id", billing.GetRedemption)
			redemptionRoute.POST("/", billing.AddRedemption)
			redemptionRoute.PUT("/", billing.UpdateRedemption)
			redemptionRoute.DELETE("/invalid", billing.DeleteInvalidRedemption)
			redemptionRoute.DELETE("/:id", billing.DeleteRedemption)
		}

		systemTaskRoute := apiRouter.Group("/system-task")
		systemTaskRoute.Use(security.AdminAuth(), security.RequirePermission(policy.SystemSettings))
		{
			systemTaskRoute.POST("/log-cleanup", handler.CreateLogCleanupSystemTask)
			systemTaskRoute.GET("/list", handler.ListSystemTasks)
			systemTaskRoute.GET("/current", handler.GetCurrentSystemTask)
			systemTaskRoute.GET("/:task_id", handler.GetSystemTask)
		}
		systemInfoRoute := apiRouter.Group("/system-info")
		systemInfoRoute.Use(security.AdminAuth(), security.RequirePermission(policy.SystemSettings))
		{
			systemInfoRoute.GET("/instances", handler.ListSystemInstances)
			systemInfoRoute.DELETE("/stale-instances", handler.DeleteStaleSystemInstances)
			systemInfoRoute.DELETE("/instances/:node_name", handler.DeleteStaleSystemInstance)
		}

		groupRoute := apiRouter.Group("/group")
		groupRoute.Use(security.AdminAuth())
		{
			groupRoute.GET("/", handler.GetGroups)
		}

		prefillGroupRoute := apiRouter.Group("/prefill_group")
		prefillGroupRoute.Use(security.AdminAuth())
		{
			prefillGroupRoute.GET("/", handler.GetPrefillGroups)
			prefillGroupRoute.POST("/", handler.CreatePrefillGroup)
			prefillGroupRoute.PUT("/", handler.UpdatePrefillGroup)
			prefillGroupRoute.DELETE("/:id", handler.DeletePrefillGroup)
		}

		mjRoute := apiRouter.Group("/mj")
		mjRoute.GET("/self", security.UserAuth(), handler.GetUserMidjourney)
		mjRoute.GET("/", security.AdminAuth(), handler.GetAllMidjourney)

		taskRoute := apiRouter.Group("/task")
		{
			taskRoute.GET("/self", security.UserAuth(), handler.GetUserTask)
			taskRoute.GET("/", security.AdminAuth(), handler.GetAllTask)
		}

		vendorRoute := apiRouter.Group("/vendors")
		vendorRoute.Use(security.AdminAuth())
		{
			vendorRoute.GET("/", handler.GetAllVendors)
			vendorRoute.GET("/search", handler.SearchVendors)
			vendorRoute.GET("/:id", handler.GetVendorMeta)
			vendorRoute.POST("/", handler.CreateVendorMeta)
			vendorRoute.PUT("/", handler.UpdateVendorMeta)
			vendorRoute.DELETE("/:id", handler.DeleteVendorMeta)
		}

		modelsRoute := apiRouter.Group("/models")
		modelsRoute.Use(security.AdminAuth())
		{
			modelsRoute.GET("/sync_upstream/preview", handler.SyncUpstreamPreview)
			modelsRoute.POST("/sync_upstream", handler.SyncUpstreamModels)
			modelsRoute.GET("/missing", handler.GetMissingModels)
			modelsRoute.GET("/meta", handler.GetAllModelsMeta)
			modelsRoute.GET("/search", handler.SearchModelsMeta)
			modelsRoute.GET("/:id", handler.GetModelMeta)
			modelsRoute.POST("/", handler.CreateModelMeta)
			modelsRoute.PUT("/", handler.UpdateModelMeta)
			modelsRoute.DELETE("/:id", handler.DeleteModelMeta)
		}

	}
}
