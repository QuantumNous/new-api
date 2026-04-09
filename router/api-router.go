package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"

	// Import oauth package to register providers via init()
	_ "github.com/QuantumNous/new-api/oauth"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
)

func SetApiRouter(router *gin.Engine, engine *fuego.Engine) {
	apiRouter := router.Group("/api")
	apiRouter.Use(middleware.RouteTag("api"))
	apiRouter.Use(gzip.Gzip(gzip.DefaultCompression))
	apiRouter.Use(middleware.BodyStorageCleanup()) // 清理请求体存储
	apiRouter.Use(middleware.GlobalAPIRateLimit())
	anonymousRequestBodyLimit := middleware.AnonymousRequestBodyLimit()
	{
		// --- Public routes (OpenAPI documented) ---
		pub := dto.NewRouter(engine, apiRouter, "System", secPublic())

		pub.GinGet("/setup", controller.GetSetup, dto.GinResp[dto.Response[dto.SetupData]]())
		pubSetup := dto.NewRouter(engine, apiRouter.Group("", anonymousRequestBodyLimit), "System", secPublic())
		pubSetup.GinPost("/setup", controller.PostSetup, dto.GinBody[dto.SetupRequest]())
		pub.GinGet("/status", controller.GetStatus, dto.GinResp[dto.Response[dto.StatusData]]())
		pub.GinGet("/uptime/status", controller.GetUptimeKumaStatus)
		pub.GinGet("/notice", controller.GetNotice)
		pub.GinGet("/user-agreement", controller.GetUserAgreement)
		pub.GinGet("/privacy-policy", controller.GetPrivacyPolicy)
		pub.GinGet("/about", controller.GetAbout)
		pub.GinGet("/home_page_content", controller.GetHomePageContent)
		pub.GinGet("/ratio_config", controller.GetRatioConfig)

		pricing := dto.NewRouter(engine, apiRouter.Group("", middleware.HeaderNavModuleAuth("pricing")), "Pricing", secPublic())
		pricing.GinGet("/pricing", controller.GetPricing, dto.GinResp[dto.Response[dto.PricingData]]())

		perfMetrics := dto.NewRouter(engine, apiRouter.Group("", middleware.TryUserAuth(), middleware.HeaderNavModulePublicOrUserAuth("pricing")), "PerfMetrics", secPublic())
		perfMetrics.GinGet("/perf-metrics/summary", controller.GetPerfMetricsSummary, dto.GinResp[dto.ApiResponse]())
		perfMetrics.GinGet("/perf-metrics", controller.GetPerfMetrics, dto.GinResp[dto.ApiResponse]())

		rankings := dto.NewRouter(engine, apiRouter.Group("", middleware.HeaderNavModuleAuth("rankings")), "Rankings", secPublic())
		rankings.GinGet("/rankings", controller.GetRankings, dto.GinResp[dto.ApiResponse]())

		apiRouter.GET("/models", middleware.UserAuth(), controller.DashboardListModels)
		apiRouter.GET("/status/test", middleware.AdminAuth(), controller.TestStatus)

		pubEmail := dto.NewRouter(engine, apiRouter.Group("", middleware.EmailVerificationRateLimit(), middleware.TurnstileCheck()), "System", secPublic())
		pubEmail.GinGet("/verification", controller.SendEmailVerification, dto.TurnstileQuery())

		pubCriticalTurnstile := dto.NewRouter(engine, apiRouter.Group("", middleware.CriticalRateLimit(), middleware.TurnstileCheck()), "System", secPublic())
		pubCriticalTurnstile.GinGet("/reset_password", controller.SendPasswordResetEmail, dto.TurnstileQuery())

		pubCritical := dto.NewRouter(engine, apiRouter.Group("", middleware.CriticalRateLimit(), anonymousRequestBodyLimit), "System", secPublic())
		pubCritical.GinPost("/user/reset", controller.ResetPassword)

		// OAuth routes
		oauth := dto.NewRouter(engine, apiRouter, "OAuth", secPublic())
		oauth.GinGet("/oauth/state", controller.GenerateOAuthCode)
		oauthAnon := dto.NewRouter(engine, apiRouter.Group("", anonymousRequestBodyLimit), "OAuth", secPublic())
		oauthAnon.GinPost("/oauth/email/bind", controller.EmailBind)
		oauth.GinGet("/oauth/wechat", controller.WeChatAuth)
		oauthAnon.GinPost("/oauth/wechat/bind", controller.WeChatBind)
		oauth.GinGet("/oauth/telegram/login", controller.TelegramLogin)
		apiRouter.POST("/oauth/telegram/bind/start", middleware.UserAuth(), middleware.CriticalRateLimit(), middleware.DisableCache(), controller.TelegramBindStart)
		apiRouter.GET("/oauth/telegram/bind/:flow_token", middleware.CriticalRateLimit(), middleware.DisableCache(), controller.TelegramBind)
		oauth.GinGet("/oauth/:provider", controller.HandleOAuth)

		// Webhooks
		apiRouter.POST("/stripe/webhook", anonymousRequestBodyLimit, controller.StripeWebhook)
		apiRouter.POST("/creem/webhook", anonymousRequestBodyLimit, controller.CreemWebhook)
		apiRouter.POST("/waffo/webhook", anonymousRequestBodyLimit, controller.WaffoWebhook)
		// :env separates test vs prod URLs so the operator can register each
		// in Pancake's matching webhook slot; handler enforces env match.
		apiRouter.POST("/waffo-pancake/webhook/:env", anonymousRequestBodyLimit, controller.WaffoPancakeWebhook)

		// Universal secure verification
		apiRouter.POST("/verify", middleware.UserAuth(), middleware.CriticalRateLimit(), middleware.DisableCache(), controller.UniversalVerify)

		// --- User routes ---
		userRoute := apiRouter.Group("/user")
		{
			// Session-cookie-guarded auth (raw gin, upstream middleware chain)
			userRoute.POST("/auth/refresh", middleware.SessionCookieOriginGuard(), middleware.CriticalRateLimit(), middleware.DisableCache(), controller.RefreshAuth)
			userRoute.POST("/auth/logout", middleware.SessionCookieOriginGuard(), middleware.CriticalRateLimit(), middleware.DisableCache(), controller.AuthLogout)

			// Public auth routes
			auth := dto.NewRouter(engine, userRoute, "Authentication", secPublic())
			authAnon := dto.NewRouter(engine, userRoute.Group("", anonymousRequestBodyLimit), "Authentication", secPublic())
			authAnonNoCache := dto.NewRouter(engine, userRoute.Group("", middleware.DisableCache(), anonymousRequestBodyLimit), "Authentication", secPublic())
			authAnon.GinPost("/register", controller.Register,
				dto.GinBody[dto.RegisterRequest](), dto.GinResp[dto.Response[dto.LoginData]](), dto.TurnstileQuery())
			authAnonNoCache.GinPost("/login", controller.Login,
				dto.GinBody[dto.LoginRequest](), dto.TurnstileQuery())
			authAnonNoCache.GinPost("/login/2fa", controller.Verify2FALogin,
				dto.GinBody[dto.Verify2FARequest](), dto.GinResp[dto.Response[dto.LoginData]]())
			authAnonNoCache.GinPost("/passkey/login/begin", controller.PasskeyLoginBegin)
			authAnonNoCache.GinPost("/passkey/login/finish", controller.PasskeyLoginFinish)
			auth.GinGet("/groups", controller.GetUserGroups, dto.GinResp[dto.Response[[]dto.UserGroupInfo]]())

			// Payment notifications (no auth)
			userRoute.POST("/epay/notify", anonymousRequestBodyLimit, controller.EpayNotify)
			userRoute.GET("/epay/notify", controller.EpayNotify)

			// Self routes (UserAuth required)
			selfRoute := userRoute.Group("/")
			selfRoute.Use(middleware.UserAuth())
			self := dto.NewRouter(engine, selfRoute, "User", secDashboard())
			{
				// Login-session management (raw gin, DisableCache)
				selfRoute.GET("/sessions", middleware.DisableCache(), controller.GetLoginSessions)
				selfRoute.DELETE("/sessions/:sid", middleware.DisableCache(), controller.DeleteLoginSession)
				selfRoute.POST("/sessions/revoke-others", middleware.DisableCache(), controller.RevokeOtherLoginSessions)

				self.GinGet("/self/groups", controller.GetUserGroups, dto.GinResp[dto.Response[[]dto.UserGroupInfo]]())
				self.GinGet("/self", controller.GetSelf, dto.GinResp[dto.Response[dto.UserSelfData]]())
				self.GinGet("/models", controller.GetUserModels)
				selfNoCache := dto.NewRouter(engine, selfRoute.Group("", middleware.DisableCache()), "User", secDashboard())
				selfCriticalUser := dto.NewRouter(engine, selfRoute.Group("", middleware.CriticalRateLimit(), middleware.DisableCache()), "User", secDashboard())
				selfCriticalUser.GinPut("/self", controller.UpdateSelf)
				self.GinDelete("/self", controller.DeleteSelf)
				selfNoCache.GinGet("/token", controller.GenerateAccessToken, dto.GinResp[dto.Response[string]]())

				// Passkeys
				passkey := self.WithTag("Passkey")
				passkeyNoCache := selfNoCache.WithTag("Passkey")
				passkey.GinGet("/passkey", controller.PasskeyStatus, dto.GinResp[dto.Response[dto.PasskeyStatusData]]())
				passkeyNoCache.GinPost("/passkey/register/begin", controller.PasskeyRegisterBegin)
				passkeyNoCache.GinPost("/passkey/register/finish", controller.PasskeyRegisterFinish)
				passkeyNoCache.GinPost("/passkey/verify/begin", controller.PasskeyVerifyBegin)
				passkeyNoCache.GinPost("/passkey/verify/finish", controller.PasskeyVerifyFinish)
				passkeyNoCache.GinDelete("/passkey", controller.PasskeyDelete)

				// Affiliate
				aff := self.WithTag("Affiliate")
				aff.GinGet("/aff", controller.GetAffCode, dto.GinResp[dto.Response[string]]())
				aff.GinPost("/aff_transfer", controller.TransferAffQuota, dto.GinBody[dto.TransferAffQuotaRequest]())

				// Top-up / payment
				topup := self.WithTag("Payment")
				topup.GinGet("/topup/info", controller.GetTopUpInfo, dto.GinResp[dto.Response[dto.TopUpInfoData]]())
				topup.GinGet("/topup/self", controller.GetUserTopUps)
				topup.GinPost("/amount", controller.RequestAmount, dto.GinBody[dto.AmountRequest]())
				topup.GinPost("/stripe/amount", controller.RequestStripeAmount, dto.GinBody[dto.StripePayRequest]())
				topup.GinPost("/waffo/amount", controller.RequestWaffoAmount)
				topup.GinPost("/waffo-pancake/amount", controller.RequestWaffoPancakeAmount)
				selfCritical := dto.NewRouter(engine, selfRoute.Group("", middleware.CriticalRateLimit()), "Payment", secDashboard())
				selfCritical.GinPost("/topup", controller.TopUp)
				selfCritical.GinPost("/pay", controller.RequestEpay)
				selfCritical.GinPost("/stripe/pay", controller.RequestStripePay)
				selfCritical.GinPost("/creem/pay", controller.RequestCreemPay)
				selfCritical.GinPost("/waffo/pay", controller.RequestWaffoPay)
				selfCritical.GinPost("/waffo-pancake/pay", controller.RequestWaffoPancakePay)

				// Settings
				self.GinPut("/setting", controller.UpdateUserSetting, dto.GinBody[dto.UpdateUserSettingRequest]())

				// 2FA
				twofa := self.WithTag("Two-Factor Authentication")
				twofaNoCache := selfNoCache.WithTag("Two-Factor Authentication")
				twofa.GinGet("/2fa/status", controller.Get2FAStatus, dto.GinResp[dto.Response[dto.TwoFAStatusData]]())
				twofaNoCache.GinPost("/2fa/setup", controller.Setup2FA, dto.GinResp[dto.Response[dto.Setup2FAResponse]]())
				twofaNoCache.GinPost("/2fa/enable", controller.Enable2FA, dto.GinBody[dto.Verify2FARequest]())
				twofaNoCache.GinPost("/2fa/disable", controller.Disable2FA, dto.GinBody[dto.Verify2FARequest]())
				twofaNoCache.GinPost("/2fa/backup_codes", controller.RegenerateBackupCodes)

				// Check-in
				checkin := self.WithTag("Check-in")
				checkin.GinGet("/checkin", controller.GetCheckinStatus, dto.GinResp[dto.Response[dto.CheckinStatusData]]())
				checkin.GinPost("/checkin", controller.DoCheckin, dto.GinResp[dto.Response[dto.CheckinResultData]]())

				// OAuth bindings
				oauthBindings := self.WithTag("OAuth Bindings")
				oauthBindings.GinGet("/oauth/bindings", controller.GetUserOAuthBindings)
				oauthBindings.GinDelete("/oauth/bindings/:provider_id", controller.UnbindCustomOAuth)
			}

			// Admin user routes (no OpenAPI annotation)
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
				adminRoute.GET("/2fa/stats", controller.Admin2FAStats)
				adminRoute.DELETE("/:id/2fa", controller.AdminDisable2FA)
			}
		}

		// --- Subscription routes ---
		subscriptionRoute := apiRouter.Group("/subscription")
		subscriptionRoute.Use(middleware.UserAuth())
		sub := dto.NewRouter(engine, subscriptionRoute, "Subscription", secDashboard())
		{
			sub.GinGet("/plans", controller.GetSubscriptionPlans)
			sub.GinGet("/self", controller.GetSubscriptionSelf)
			sub.GinPut("/self/preference", controller.UpdateSubscriptionPreference,
				dto.GinBody[dto.BillingPreferenceRequest]())
			subCritical := dto.NewRouter(engine, subscriptionRoute.Group("", middleware.CriticalRateLimit()), "Subscription", secDashboard())
			subCritical.GinPost("/balance/pay", controller.SubscriptionRequestBalancePay)
			subCritical.GinPost("/epay/pay", controller.SubscriptionRequestEpay)
			subCritical.GinPost("/stripe/pay", controller.SubscriptionRequestStripePay)
			subCritical.GinPost("/creem/pay", controller.SubscriptionRequestCreemPay)
			subCritical.GinPost("/waffo-pancake/pay", controller.SubscriptionRequestWaffoPancakePay)
		}
		// Admin subscription routes
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

		// --- Admin-only routes (no OpenAPI annotation) ---
		optionRoute := apiRouter.Group("/option")
		optionRoute.Use(middleware.RootAuth())
		{
			optionRoute.GET("/", controller.GetOptions)
			optionRoute.PUT("/", controller.UpdateOption)
			optionRoute.POST("/payment_compliance", controller.ConfirmPaymentCompliance)
			optionRoute.GET("/channel_affinity_cache", controller.GetChannelAffinityCacheStats)
			optionRoute.DELETE("/channel_affinity_cache", controller.ClearChannelAffinityCache)
			optionRoute.POST("/rest_model_ratio", controller.ResetModelRatio)
			optionRoute.GET("/waffo-pancake/catalog", controller.ListWaffoPancakeCatalog)
			optionRoute.POST("/waffo-pancake/pair", controller.CreateWaffoPancakePair)
			optionRoute.POST("/waffo-pancake/save", controller.SaveWaffoPancake)
			optionRoute.POST("/waffo-pancake/subscription-product", controller.CreateWaffoPancakeSubscriptionProduct)
			optionRoute.GET("/waffo-pancake/subscription-product-options", controller.ListWaffoPancakeSubscriptionProductOptions)
		}

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

		// Token routes (OpenAPI documented)
		tokenRoute := apiRouter.Group("/token")
		tokenRoute.Use(middleware.UserAuth())
		tok := dto.NewRouter(engine, tokenRoute, "Token", secDashboard())
		{
			tok.GinGet("/", controller.GetAllTokens, dto.GinResp[dto.Response[dto.PageData[model.Token]]](), dto.PageParams())
			tok.GinGet("/search", controller.SearchTokens, dto.PageParams())
			tok.GinGet("/:id", controller.GetToken, dto.GinResp[dto.Response[model.Token]]())
			tok.GinPost("/:id/key", controller.GetTokenKey)
			tok.GinPost("/", controller.AddToken, dto.GinBody[dto.CreateTokenRequest](), dto.GinResp[dto.Response[model.Token]]())
			tok.GinPut("/", controller.UpdateToken, dto.GinBody[dto.UpdateTokenRequest]())
			tok.GinDelete("/:id", controller.DeleteToken)
			tok.GinPost("/batch", controller.DeleteTokenBatch, dto.GinBody[dto.TokenBatch]())
			tokenRoute.POST("/batch/keys", middleware.CriticalRateLimit(), middleware.DisableCache(), controller.GetTokenKeysBatch)
		}

		// Usage routes
		usageRoute := apiRouter.Group("/usage")
		usageRoute.Use(middleware.CORS(), middleware.CriticalRateLimit())
		{
			tokenUsageRoute := usageRoute.Group("/token")
			tokenUsageRoute.Use(middleware.TokenAuthReadOnly())
			{
				tokenUsageRoute.GET("/", controller.GetTokenUsage)
			}
		}

		// Redemption routes (admin only)
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

		// Log routes (mixed: user routes OpenAPI documented, admin routes plain gin)
		logRoute := apiRouter.Group("/log")
		logRoute.GET("/", middleware.AdminAuth(), controller.GetAllLogs)
		logRoute.GET("/stat", middleware.AdminAuth(), controller.GetLogsStat)
		logRoute.GET("/channel_affinity_usage_cache", middleware.AdminAuth(), controller.GetChannelAffinityUsageCacheStats)
		logRoute.GET("/search", middleware.AdminAuth(), controller.SearchAllLogs)

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

		// User-facing log routes are OpenAPI documented via dto.NewRouter.
		logUserRoute := logRoute.Group("", middleware.UserAuth())
		logUser := dto.NewRouter(engine, logUserRoute, "Logs", secDashboard())
		logUser.GinGet("/self/stat", controller.GetLogsSelfStat, dto.GinResp[dto.Response[dto.LogStatData]]())
		logUser.GinGet("/self", controller.GetUserLogs, dto.GinResp[dto.Response[dto.PageData[model.Log]]](), dto.PageParams())
		logUserSearch := dto.NewRouter(engine, logUserRoute.Group("", middleware.SearchRateLimit()), "Logs", secDashboard())
		logUserSearch.GinGet("/self/search", controller.SearchUserLogs, dto.GinResp[dto.Response[dto.PageData[model.Log]]](), dto.PageParams())

		// Data routes (mixed: user routes OpenAPI documented, admin routes plain gin)
		dataRoute := apiRouter.Group("/data")
		dataAdminRoute := dataRoute.Group("", middleware.AdminAuth())
		dataAdminRoute.GET("/", controller.GetAllQuotaDates)
		dataRoute.GET("/users", middleware.AdminAuth(), controller.GetQuotaDatesByUser)
		dataRoute.GET("/flow", middleware.AdminAuth(), controller.GetAllFlowQuotaDates)
		dataRoute.GET("/flow/self", middleware.UserAuth(), controller.GetUserFlowQuotaDates)
		dataUserRoute := dataRoute.Group("", middleware.UserAuth())
		dataUser := dto.NewRouter(engine, dataUserRoute, "Data", secDashboard())
		dataUser.GinGet("/self", controller.GetUserQuotaDates, dto.PageParams())

		logRoute.Use(middleware.CORS(), middleware.CriticalRateLimit())
		{
			logRoute.GET("/token", middleware.TokenAuthReadOnly(), controller.GetLogByKey)
		}

		// Group routes (admin only)
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
