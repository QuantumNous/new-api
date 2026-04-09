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
	{
		// --- Public routes (OpenAPI documented) ---
		pub := dto.NewRouter(engine, apiRouter, "System", secPublic())

		pub.GinGet("/setup", controller.GetSetup, dto.GinResp[dto.Response[dto.SetupData]]())
		pub.GinPost("/setup", controller.PostSetup, dto.GinBody[dto.SetupRequest]())
		pub.GinGet("/status", controller.GetStatus, dto.GinResp[dto.Response[dto.StatusData]]())
		pub.GinGet("/uptime/status", controller.GetUptimeKumaStatus)
		pub.GinGet("/notice", controller.GetNotice)
		pub.GinGet("/user-agreement", controller.GetUserAgreement)
		pub.GinGet("/privacy-policy", controller.GetPrivacyPolicy)
		pub.GinGet("/about", controller.GetAbout)
		pub.GinGet("/home_page_content", controller.GetHomePageContent)
		pub.GinGet("/ratio_config", controller.GetRatioConfig)

		pricing := dto.NewRouter(engine, apiRouter, "Pricing", secPublic())
		pricing.GinGet("/pricing", controller.GetPricing, dto.GinResp[dto.Response[dto.PricingData]]())

		apiRouter.GET("/models", middleware.UserAuth(), controller.DashboardListModels)
		apiRouter.GET("/status/test", middleware.AdminAuth(), controller.TestStatus)

		pubEmail := dto.NewRouter(engine, apiRouter.Group("", middleware.EmailVerificationRateLimit(), middleware.TurnstileCheck()), "System", secPublic())
		pubEmail.GinGet("/verification", controller.SendEmailVerification, dto.TurnstileQuery())

		pubCriticalTurnstile := dto.NewRouter(engine, apiRouter.Group("", middleware.CriticalRateLimit(), middleware.TurnstileCheck()), "System", secPublic())
		pubCriticalTurnstile.GinGet("/reset_password", controller.SendPasswordResetEmail, dto.TurnstileQuery())

		pubCritical := dto.NewRouter(engine, apiRouter.Group("", middleware.CriticalRateLimit()), "System", secPublic())
		pubCritical.GinPost("/user/reset", controller.ResetPassword)

		// OAuth routes
		oauth := dto.NewRouter(engine, apiRouter, "OAuth", secPublic())
		oauth.GinGet("/oauth/state", controller.GenerateOAuthCode)
		oauth.GinPost("/oauth/email/bind", controller.EmailBind)
		oauth.GinGet("/oauth/wechat", controller.WeChatAuth)
		oauth.GinPost("/oauth/wechat/bind", controller.WeChatBind)
		oauth.GinGet("/oauth/telegram/login", controller.TelegramLogin)
		oauth.GinGet("/oauth/telegram/bind", controller.TelegramBind)
		oauth.GinGet("/oauth/:provider", controller.HandleOAuth)

		// Webhooks
		apiRouter.POST("/stripe/webhook", controller.StripeWebhook)
		apiRouter.POST("/creem/webhook", controller.CreemWebhook)
		apiRouter.POST("/waffo/webhook", controller.WaffoWebhook)
		//apiRouter.POST("/waffo-pancake/webhook", controller.WaffoPancakeWebhook)

		// Universal secure verification
		apiRouter.POST("/verify", middleware.UserAuth(), middleware.CriticalRateLimit(), controller.UniversalVerify)

		// --- User routes ---
		userRoute := apiRouter.Group("/user")
		{
			// Public auth routes
			auth := dto.NewRouter(engine, userRoute, "Authentication", secPublic())
			auth.GinPost("/register", controller.Register,
				dto.GinBody[dto.RegisterRequest](), dto.GinResp[dto.Response[dto.LoginData]](), dto.TurnstileQuery())
			auth.GinPost("/login", controller.Login,
				dto.GinBody[dto.LoginRequest](), dto.TurnstileQuery())
			auth.GinPost("/login/2fa", controller.Verify2FALogin,
				dto.GinBody[dto.Verify2FARequest](), dto.GinResp[dto.Response[dto.LoginData]]())
			auth.GinPost("/passkey/login/begin", controller.PasskeyLoginBegin)
			auth.GinPost("/passkey/login/finish", controller.PasskeyLoginFinish)
			auth.GinGet("/logout", controller.Logout)
			auth.GinGet("/groups", controller.GetUserGroups, dto.GinResp[dto.Response[[]dto.UserGroupInfo]]())

			// Payment notifications (no auth)
			userRoute.POST("/epay/notify", controller.EpayNotify)
			userRoute.GET("/epay/notify", controller.EpayNotify)

			// Self routes (UserAuth required)
			selfRoute := userRoute.Group("/")
			selfRoute.Use(middleware.UserAuth())
			self := dto.NewRouter(engine, selfRoute, "User", secDashboard())
			{
				self.GinGet("/self/groups", controller.GetUserGroups, dto.GinResp[dto.Response[[]dto.UserGroupInfo]]())
				self.GinGet("/self", controller.GetSelf, dto.GinResp[dto.Response[dto.UserSelfData]]())
				self.GinGet("/models", controller.GetUserModels)
				self.GinPut("/self", controller.UpdateSelf)
				self.GinDelete("/self", controller.DeleteSelf)
				self.GinGet("/token", controller.GenerateAccessToken, dto.GinResp[dto.Response[string]]())

				// Passkeys
				passkey := self.WithTag("Passkey")
				passkey.GinGet("/passkey", controller.PasskeyStatus, dto.GinResp[dto.Response[dto.PasskeyStatusData]]())
				passkey.GinPost("/passkey/register/begin", controller.PasskeyRegisterBegin)
				passkey.GinPost("/passkey/register/finish", controller.PasskeyRegisterFinish)
				passkey.GinPost("/passkey/verify/begin", controller.PasskeyVerifyBegin)
				passkey.GinPost("/passkey/verify/finish", controller.PasskeyVerifyFinish)
				passkey.GinDelete("/passkey", controller.PasskeyDelete)

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
				selfCritical := dto.NewRouter(engine, selfRoute.Group("", middleware.CriticalRateLimit()), "Payment", secDashboard())
				selfCritical.GinPost("/topup", controller.TopUp)
				selfCritical.GinPost("/pay", controller.RequestEpay)
				selfCritical.GinPost("/stripe/pay", controller.RequestStripePay)
				selfCritical.GinPost("/creem/pay", controller.RequestCreemPay)
				selfCritical.GinPost("/waffo/pay", controller.RequestWaffoPay)

				// Settings
				self.GinPut("/setting", controller.UpdateUserSetting, dto.GinBody[dto.UpdateUserSettingRequest]())

				// 2FA
				twofa := self.WithTag("Two-Factor Authentication")
				twofa.GinGet("/2fa/status", controller.Get2FAStatus, dto.GinResp[dto.Response[dto.TwoFAStatusData]]())
				twofa.GinPost("/2fa/setup", controller.Setup2FA, dto.GinResp[dto.Response[dto.Setup2FAResponse]]())
				twofa.GinPost("/2fa/enable", controller.Enable2FA, dto.GinBody[dto.Verify2FARequest]())
				twofa.GinPost("/2fa/disable", controller.Disable2FA, dto.GinBody[dto.Verify2FARequest]())
				twofa.GinPost("/2fa/backup_codes", controller.RegenerateBackupCodes)

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
			subCritical.GinPost("/epay/pay", controller.SubscriptionRequestEpay)
			subCritical.GinPost("/stripe/pay", controller.SubscriptionRequestStripePay)
			subCritical.GinPost("/creem/pay", controller.SubscriptionRequestCreemPay)
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
			subscriptionAdminRoute.GET("/users/:id/subscriptions", controller.AdminListUserSubscriptions)
			subscriptionAdminRoute.POST("/users/:id/subscriptions", controller.AdminCreateUserSubscription)
			subscriptionAdminRoute.POST("/user_subscriptions/:id/invalidate", controller.AdminInvalidateUserSubscription)
			subscriptionAdminRoute.DELETE("/user_subscriptions/:id", controller.AdminDeleteUserSubscription)
		}

		// Subscription payment callbacks (no auth)
		apiRouter.POST("/subscription/epay/notify", controller.SubscriptionEpayNotify)
		apiRouter.GET("/subscription/epay/notify", controller.SubscriptionEpayNotify)
		apiRouter.GET("/subscription/epay/return", controller.SubscriptionEpayReturn)
		apiRouter.POST("/subscription/epay/return", controller.SubscriptionEpayReturn)

		// --- Admin-only routes (no OpenAPI annotation) ---
		optionRoute := apiRouter.Group("/option")
		optionRoute.Use(middleware.RootAuth())
		{
			optionRoute.GET("/", controller.GetOptions)
			optionRoute.PUT("/", controller.UpdateOption)
			optionRoute.GET("/channel_affinity_cache", controller.GetChannelAffinityCacheStats)
			optionRoute.DELETE("/channel_affinity_cache", controller.ClearChannelAffinityCache)
			optionRoute.POST("/rest_model_ratio", controller.ResetModelRatio)
			optionRoute.POST("/migrate_console_setting", controller.MigrateConsoleSetting)
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
		logAdminRoute := logRoute.Group("", middleware.AdminAuth())
		logAdminRoute.GET("/", controller.GetAllLogs)
		logAdminRoute.DELETE("/", controller.DeleteHistoryLogs)
		logAdminRoute.GET("/stat", controller.GetLogsStat)
		logRoute.GET("/channel_affinity_usage_cache", middleware.AdminAuth(), controller.GetChannelAffinityUsageCacheStats)
		logRoute.GET("/search", middleware.AdminAuth(), controller.SearchAllLogs)

		logUserRoute := logRoute.Group("", middleware.UserAuth())
		logUser := dto.NewRouter(engine, logUserRoute, "Logs", secDashboard())
		logUser.GinGet("/self/stat", controller.GetLogsSelfStat, dto.GinResp[dto.Response[dto.LogStatData]]())
		logUser.GinGet("/self", controller.GetUserLogs, dto.GinResp[dto.Response[dto.PageData[model.Log]]](), dto.PageParams())
		logUserSearch := dto.NewRouter(engine, logUserRoute.Group("", middleware.SearchRateLimit()), "Logs", secDashboard())
		logUserSearch.GinGet("/self/search", controller.SearchUserLogs, dto.GinResp[dto.Response[dto.PageData[model.Log]]](), dto.PageParams())

		// Data routes (mixed)
		dataRoute := apiRouter.Group("/data")
		dataAdminRoute := dataRoute.Group("", middleware.AdminAuth())
		dataAdminRoute.GET("/", controller.GetAllQuotaDates)
		dataRoute.GET("/users", middleware.AdminAuth(), controller.GetQuotaDatesByUser)
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
