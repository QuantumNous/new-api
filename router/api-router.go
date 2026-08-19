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
	// Mailbox image proxies may refetch the same pixel; keep this response
	// neutral by bypassing the shared API group's global rate limiter.
	router.GET("/api/recall/open.gif", controller.TrackRecallEmailOpen)

	apiRouter := router.Group("/api")
	apiRouter.Use(middleware.RouteTag("api"))
	apiRouter.Use(gzip.Gzip(gzip.DefaultCompression))
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
		registrationDomainRiskRoute := apiRouter.Group("/registration-domain-risk")
		registrationDomainRiskRoute.Use(middleware.AdminAuth())
		{
			registrationDomainRiskRoute.GET("/blocks", controller.GetRegistrationDomainBlocks)
			registrationDomainRiskRoute.GET("/blocks/:id", controller.GetRegistrationDomainBlock)
			registrationDomainRiskRoute.POST("/blocks/:id/release", controller.ReleaseRegistrationDomainBlock)
		}
		apiRouter.GET("/notice", controller.GetNotice)
		apiRouter.GET("/user-agreement", controller.GetUserAgreement)
		apiRouter.GET("/privacy-policy", controller.GetPrivacyPolicy)
		apiRouter.GET("/refund-policy", controller.GetRefundPolicy)
		apiRouter.GET("/about", controller.GetAbout)
		blogRoute := apiRouter.Group("/blog")
		{
			blogRoute.GET("/list", controller.GetBlogList)
			blogRoute.GET("/detail/:slug", controller.GetBlogPost)
			blogRoute.GET("/categories", controller.GetBlogCategories)
		}
		promptLibraryRoute := apiRouter.Group("/prompt-library")
		{
			promptLibraryAdminRoute := promptLibraryRoute.Group("/admin")
			promptLibraryAdminRoute.Use(middleware.AdminAuth())
			{
				promptLibraryAdminRoute.GET("", controller.ListPromptLibraryAdmin)
				promptLibraryAdminRoute.POST("", controller.CreatePromptLibraryAdmin)
				promptLibraryAdminRoute.PUT("/:id", controller.UpdatePromptLibraryAdmin)
				promptLibraryAdminRoute.PUT("/:id/enabled", controller.UpdatePromptLibraryEnabledAdmin)
				promptLibraryAdminRoute.DELETE("/:id", controller.DeletePromptLibraryAdmin)
			}
			promptLibraryRoute.GET("", controller.ListPromptLibrary)
			promptLibraryRoute.GET("/:slug", controller.GetPromptLibraryItem)
			promptLibraryImportRoute := promptLibraryRoute.Group("")
			promptLibraryImportRoute.Use(middleware.PromptLibraryImportAuth())
			{
				promptLibraryImportRoute.POST("/import", anonymousRequestBodyLimit, controller.ImportPromptLibrary)
			}
		}
		//apiRouter.GET("/midjourney", controller.GetMidjourney)
		apiRouter.GET("/home_page_content", controller.GetHomePageContent)
		apiRouter.GET("/pricing", middleware.HeaderNavModuleAuth("pricing"), controller.GetPricing)
		apiRouter.GET("/website/pricing", controller.GetWebsitePricing)
		apiRouter.GET("/website/pricing/v2", controller.GetWebsitePricingV2)
		dataToolRoute := apiRouter.Group("/data-tools")
		{
			// Catalog browsing is available to an authenticated dashboard
			// session or an API client. Execution is deliberately token-only:
			// every billable call must be attributable to one Flatkey API key.
			dataToolRoute.GET("", middleware.TokenOrUserAuth(), controller.ListDataTools)
			dataToolRoute.GET("/inspect", middleware.TokenOrUserAuth(), controller.InspectDataTool)
			dataToolRoute.POST("/run", middleware.TokenAuth(), controller.RunDataTool)
		}
		perfMetricsRoute := apiRouter.Group("/perf-metrics")
		perfMetricsRoute.Use(middleware.HeaderNavModulePublicOrUserAuth("pricing"))
		{
			perfMetricsRoute.GET("/summary", controller.GetPerfMetricsSummary)
			perfMetricsRoute.GET("", controller.GetPerfMetrics)
		}
		apiRouter.GET("/rankings", middleware.HeaderNavModuleAuth("rankings"), controller.GetRankings)
		apiRouter.GET("/verification", middleware.EmailVerificationRateLimit(), middleware.TurnstileCheck(), controller.SendEmailVerification)
		apiRouter.POST("/registration/email-verification/exchange", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, controller.ExchangeRegistrationEmailVerification)
		apiRouter.POST("/registration/email-verification/status", middleware.RegistrationEmailVerificationStatusRateLimit(), anonymousRequestBodyLimit, controller.GetRegistrationEmailVerificationStatus)
		apiRouter.GET("/reset_password", middleware.CriticalRateLimit(), middleware.TurnstileCheck(), controller.SendPasswordResetEmail)
		apiRouter.POST("/user/reset", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, controller.ResetPassword)
		cliAuthRoute := apiRouter.Group("/cli/device_authorizations")
		{
			cliAuthRoute.POST("", middleware.CliDeviceAuthorizationCreateRateLimit(), anonymousRequestBodyLimit, controller.CreateCliDeviceAuthorization)
			cliAuthRoute.POST("/token", middleware.CliDeviceAuthorizationPollRateLimit(), anonymousRequestBodyLimit, controller.PollCliDeviceAuthorization)
			cliAuthRoute.GET("/:user_code", middleware.UserAuth(), controller.GetCliDeviceAuthorization)
			cliAuthRoute.POST("/:user_code/approve", middleware.UserAuth(), middleware.CriticalRateLimit(), controller.ApproveCliDeviceAuthorization)
			cliAuthRoute.POST("/:user_code/deny", middleware.UserAuth(), middleware.CriticalRateLimit(), controller.DenyCliDeviceAuthorization)
		}
		// OAuth routes - specific routes must come before :provider wildcard
		apiRouter.GET("/oauth/state", middleware.CriticalRateLimit(), controller.GenerateOAuthCode)
		apiRouter.POST("/oauth/email/bind", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, controller.EmailBind)
		// Non-standard OAuth (WeChat, Telegram) - keep original routes
		apiRouter.GET("/oauth/wechat", middleware.CriticalRateLimit(), controller.WeChatAuth)
		apiRouter.POST("/oauth/wechat/bind", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, controller.WeChatBind)
		apiRouter.GET("/oauth/telegram/login", middleware.CriticalRateLimit(), controller.TelegramLogin)
		apiRouter.GET("/oauth/telegram/bind", middleware.CriticalRateLimit(), controller.TelegramBind)
		apiRouter.GET("/oauth/google/start", middleware.CriticalRateLimit(), controller.StartGoogleOAuth)
		apiRouter.POST("/oauth/google/one-tap", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, controller.HandleGoogleOneTap)
		// Standard OAuth providers (GitHub, Discord, OIDC, LinuxDO) - unified route
		apiRouter.GET("/oauth/:provider", middleware.CriticalRateLimit(), controller.HandleOAuth)
		apiRouter.GET("/ratio_config", middleware.CriticalRateLimit(), controller.GetRatioConfig)

		apiRouter.POST("/stripe/webhook", anonymousRequestBodyLimit, controller.StripeWebhook)
		apiRouter.POST("/creem/webhook", anonymousRequestBodyLimit, controller.CreemWebhook)
		apiRouter.POST("/waffo/webhook", anonymousRequestBodyLimit, controller.WaffoWebhook)
		apiRouter.GET("/recall/unsubscribe", controller.UnsubscribeRecallEmail)
		// RFC 8058 one-click target. Mailbox providers POST here with no
		// session, so it stays anonymous like the GET landing page.
		apiRouter.POST("/recall/unsubscribe", anonymousRequestBodyLimit, controller.UnsubscribeRecallEmailOneClick)
		// :env separates test vs prod URLs so the operator can register each
		// in Pancake's matching webhook slot; handler enforces env match.
		apiRouter.POST("/waffo-pancake/webhook/:env", anonymousRequestBodyLimit, controller.WaffoPancakeWebhook)

		// Universal secure verification routes
		apiRouter.POST("/verify", middleware.UserAuth(), middleware.CriticalRateLimit(), controller.UniversalVerify)
		tempMediaRoute := apiRouter.Group("/temp-media")
		tempMediaRoute.Use(middleware.UserAuth(), middleware.UploadRateLimit())
		{
			tempMediaRoute.POST("/images", controller.UploadTempMediaImage)
		}

		userRoute := apiRouter.Group("/user")
		{
			userRoute.POST("/register", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, middleware.TurnstileCheck(), controller.Register)
			userRoute.POST("/login", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, middleware.TurnstileCheck(), controller.Login)
			userRoute.POST("/login/2fa", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, controller.Verify2FALogin)
			userRoute.POST("/passkey/login/begin", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, controller.PasskeyLoginBegin)
			userRoute.POST("/passkey/login/finish", middleware.CriticalRateLimit(), anonymousRequestBodyLimit, controller.PasskeyLoginFinish)
			//userRoute.POST("/tokenlog", middleware.CriticalRateLimit(), controller.TokenLog)
			userRoute.GET("/logout", controller.Logout)
			userRoute.GET("/analytics-self", controller.GetAnalyticsSelf)
			userRoute.POST("/epay/notify", anonymousRequestBodyLimit, controller.EpayNotify)
			userRoute.GET("/epay/notify", controller.EpayNotify)
			userRoute.GET("/groups", controller.GetUserGroups)

			selfRoute := userRoute.Group("/")
			selfRoute.Use(middleware.UserAuth())
			{
				selfRoute.GET("/self/groups", controller.GetUserGroups)
				selfRoute.GET("/model-access", controller.GetUserModelAccess)
				selfRoute.GET("/self", controller.GetSelf)
				selfRoute.GET("/self/invitations", controller.GetSelfInvitations)
				selfRoute.GET("/models", controller.GetUserModels)
				selfRoute.PUT("/self", controller.UpdateSelf)
				selfRoute.DELETE("/self", controller.DeleteSelf)
				selfRoute.GET("/token", controller.GenerateAccessToken)
				selfRoute.GET("/passkey", controller.PasskeyStatus)
				selfRoute.POST("/passkey/register/begin", controller.PasskeyRegisterBegin)
				selfRoute.POST("/passkey/register/finish", controller.PasskeyRegisterFinish)
				selfRoute.POST("/passkey/verify/begin", controller.PasskeyVerifyBegin)
				selfRoute.POST("/passkey/verify/finish", controller.PasskeyVerifyFinish)
				selfRoute.DELETE("/passkey", controller.PasskeyDelete)
				selfRoute.GET("/aff", controller.GetAffCode)
				selfRoute.GET("/topup/info", controller.GetTopUpInfo)
				selfRoute.GET("/topup/self", controller.GetUserTopUps)
				selfRoute.POST("/topup/:trade_no/resume", middleware.CriticalRateLimit(), controller.ResumeStripeTopUpCheckout)
				selfRoute.POST("/topup/:trade_no/invoice", middleware.CriticalRateLimit(), controller.RequestStripeTopUpInvoice)
				selfRoute.GET("/invoice-profile", controller.GetSelfInvoiceProfile)
				selfRoute.PUT("/invoice-profile", controller.UpdateSelfInvoiceProfile)
				selfRoute.POST("/topup", middleware.CriticalRateLimit(), controller.TopUp)
				selfRoute.POST("/redemption/claim", middleware.CriticalRateLimit(), controller.ClaimRedemption)
				selfRoute.POST("/pay", middleware.CriticalRateLimit(), controller.RequestEpay)
				selfRoute.POST("/amount", controller.RequestAmount)
				selfRoute.POST("/stripe/pay", middleware.CriticalRateLimit(), controller.RequestStripePay)
				selfRoute.POST("/stripe/amount", controller.RequestStripeAmount)
				selfRoute.GET("/stripe/card", controller.GetStripeCardStatus)
				selfRoute.DELETE("/stripe/card", middleware.CriticalRateLimit(), controller.RemoveStripeCard)
				selfRoute.POST("/creem/pay", middleware.CriticalRateLimit(), controller.RequestCreemPay)
				selfRoute.POST("/waffo/amount", controller.RequestWaffoAmount)
				selfRoute.POST("/waffo/pay", middleware.CriticalRateLimit(), controller.RequestWaffoPay)
				selfRoute.POST("/waffo-pancake/amount", controller.RequestWaffoPancakeAmount)
				selfRoute.POST("/waffo-pancake/pay", middleware.CriticalRateLimit(), controller.RequestWaffoPancakePay)
				selfRoute.POST("/paddle/amount", controller.RequestPaddleAmount)
				selfRoute.POST("/paddle/pay", middleware.CriticalRateLimit(), controller.RequestPaddlePay)
				selfRoute.GET("/paddle/status", controller.GetPaddleTopUpStatus)
				selfRoute.POST("/aff_transfer", controller.TransferAffQuota)
				selfRoute.PUT("/setting", controller.UpdateUserSetting)
				selfRoute.GET("/recall/offers", controller.ListRecallOffers)
				selfRoute.POST("/recall/claim/validate", controller.ValidateRecallClaim)

				// 2FA routes
				selfRoute.GET("/2fa/status", controller.Get2FAStatus)
				selfRoute.POST("/2fa/setup", controller.Setup2FA)
				selfRoute.POST("/2fa/enable", controller.Enable2FA)
				selfRoute.POST("/2fa/disable", controller.Disable2FA)
				selfRoute.POST("/2fa/backup_codes", controller.RegenerateBackupCodes)

				// Check-in routes
				selfRoute.GET("/checkin", controller.GetCheckinStatus)
				selfRoute.POST("/checkin", middleware.TurnstileCheck(), controller.DoCheckin)

				// Custom OAuth bindings
				selfRoute.GET("/oauth/bindings", controller.GetUserOAuthBindings)
				selfRoute.DELETE("/oauth/bindings/:provider_id", controller.UnbindCustomOAuth)
			}

			adminRoute := userRoute.Group("/")
			adminRoute.Use(middleware.AdminAuth())
			{
				adminRoute.GET("/", controller.GetAllUsers)
				adminRoute.GET("/topup", controller.GetAllTopUps)
				adminRoute.POST("/topup/complete", controller.AdminCompleteTopUp)
				adminRoute.GET("/search", controller.SearchUsers)
				adminRoute.GET("/recall_candidates", controller.GetRecallCandidates)
				adminRoute.GET("/:id/oauth/bindings", controller.GetUserOAuthBindingsByAdmin)
				adminRoute.GET("/:id/invoice-profile", controller.AdminGetUserInvoiceProfile)
				adminRoute.PUT("/:id/invoice-profile", controller.AdminUpdateUserInvoiceProfile)
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
			}
		}

		recallCampaignRoute := apiRouter.Group("/recall-campaigns")
		recallCampaignRoute.Use(middleware.AdminAuth())
		{
			recallCampaignRoute.GET("/", controller.ListRecallCampaigns)
			recallCampaignRoute.POST("/", controller.CreateRecallCampaign)
			recallCampaignRoute.POST("/stripe/validate", controller.ValidateRecallStripeConfig)
			recallCampaignRoute.POST("/email-preview", controller.PreviewRecallEmailTemplate)
			recallCampaignRoute.GET("/email-quota", controller.GetRecallEmailQuotaStatus)
			recallCampaignRoute.PUT("/email-quota", controller.UpdateRecallEmailQuotaLimit)
			recallCampaignRoute.GET("/smtp", controller.GetRecallActivitySMTP)
			recallCampaignRoute.PUT("/smtp", controller.UpdateRecallActivitySMTP)
			recallCampaignRoute.GET("/audience-users", controller.ListRecallAudienceUsers)
			recallCampaignRoute.POST("/:id/exclusions/preview", controller.PreviewRecallCampaignExclusions)
			recallCampaignRoute.GET("/:id/exclusions/batches/:batch_id", controller.GetRecallCampaignExclusionBatch)
			recallCampaignRoute.POST("/:id/exclusions/batches/:batch_id/confirm", controller.ConfirmRecallCampaignExclusionBatch)
			recallCampaignRoute.POST("/:id/email-translations/generate", middleware.CriticalRateLimit(), controller.GenerateRecallEmailTranslations)
			recallCampaignRoute.GET("/:id/email-translations/tasks/latest", controller.GetLatestRecallEmailTranslationTask)
			recallCampaignRoute.GET("/:id/email-translations/tasks/:task_id", controller.GetRecallEmailTranslationTask)
			recallCampaignRoute.GET("/:id", controller.GetRecallCampaign)
			recallCampaignRoute.PUT("/:id", controller.UpdateRecallCampaign)
			recallCampaignRoute.POST("/:id/preview", controller.PreviewRecallCampaign)
			recallCampaignRoute.POST("/:id/activate", controller.ActivateRecallCampaign)
			recallCampaignRoute.POST("/:id/pause", controller.PauseRecallCampaign)
			recallCampaignRoute.POST("/:id/resume", controller.ResumeRecallCampaign)
			recallCampaignRoute.POST("/:id/cancel", controller.CancelRecallCampaign)
			recallCampaignRoute.POST("/:id/complete", controller.CompleteRecallCampaign)
			recallCampaignRoute.GET("/:id/recipients", controller.ListRecallRecipients)
			recallCampaignRoute.GET("/:id/events", controller.ListRecallEvents)
			recallCampaignRoute.GET("/:id/metrics", controller.GetRecallCampaignMetrics)
			recallCampaignRoute.GET("/:id/metric-users", controller.GetRecallMetricUsers)
			recallCampaignRoute.GET("/:id/metric-users/export", controller.ExportRecallMetricUsers)
			recallCampaignRoute.GET("/:id/export", controller.ExportRecallCampaign)
			recallCampaignRoute.POST("/:id/recipients/:rid/retry", controller.RetryRecallRecipient)
		}

		// Subscription billing (plans, purchase, admin management)
		subscriptionRoute := apiRouter.Group("/subscription")
		subscriptionRoute.Use(middleware.UserAuth())
		{
			subscriptionRoute.GET("/plans", controller.GetSubscriptionPlans)
			subscriptionRoute.GET("/self", controller.GetSubscriptionSelf)
			subscriptionRoute.GET("/self/refundable-terms", controller.GetRefundableSubscriptionTerms)
			subscriptionRoute.PUT("/self/preference", controller.UpdateSubscriptionPreference)
			subscriptionRoute.POST("/self/refundable-terms/:term_segment_id/refund", middleware.CriticalRateLimit(), controller.RefundSubscriptionTerm)
			subscriptionRoute.POST("/self/quote", middleware.SubscriptionPaymentRateLimit(), controller.QuoteSubscriptionSelfPurchase)
			subscriptionRoute.POST("/self/purchase", middleware.SubscriptionPaymentRateLimit(), controller.PurchaseSubscriptionSelf)
			subscriptionRoute.POST("/self/change-plan", middleware.SubscriptionPaymentRateLimit(), controller.ChangeSubscriptionPlan)
			subscriptionRoute.POST("/self/renewal/cancel", middleware.CriticalRateLimit(), controller.CancelSubscriptionRenewal)
			subscriptionRoute.POST("/self/renewal/resume", middleware.CriticalRateLimit(), controller.ResumeSubscriptionRenewal)
			subscriptionRoute.POST("/balance/pay", middleware.CriticalRateLimit(), controller.SubscriptionRequestBalancePay)
			subscriptionRoute.POST("/epay/pay", middleware.CriticalRateLimit(), controller.SubscriptionRequestEpay)
			subscriptionRoute.POST("/stripe/pay", middleware.CriticalRateLimit(), controller.SubscriptionRequestStripePay)
			subscriptionRoute.POST("/creem/pay", middleware.CriticalRateLimit(), controller.SubscriptionPurchasePendingMigration)
			subscriptionRoute.POST("/waffo-pancake/pay", middleware.CriticalRateLimit(), controller.SubscriptionPurchasePendingMigration)
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

		// Subscription payment callbacks (no auth)
		apiRouter.POST("/subscription/epay/notify", anonymousRequestBodyLimit, controller.SubscriptionEpayNotify)
		apiRouter.GET("/subscription/epay/notify", controller.SubscriptionEpayNotify)
		apiRouter.GET("/subscription/epay/return", controller.SubscriptionEpayReturn)
		apiRouter.POST("/subscription/epay/return", anonymousRequestBodyLimit, controller.SubscriptionEpayReturn)
		apiRouter.POST("/paddle/webhook", anonymousRequestBodyLimit, controller.PaddleWebhook)
		optionRoute := apiRouter.Group("/option")
		optionRoute.Use(middleware.RootAuth())
		{
			optionRoute.GET("/", controller.GetOptions)
			optionRoute.PUT("/", controller.UpdateOption)
			optionRoute.PUT("/bulk", controller.UpdateOptions)
			optionRoute.POST("/payment_compliance", controller.ConfirmPaymentCompliance)
			optionRoute.GET("/channel_affinity_cache", controller.GetChannelAffinityCacheStats)
			optionRoute.DELETE("/channel_affinity_cache", controller.ClearChannelAffinityCache)
			optionRoute.POST("/rest_model_ratio", controller.ResetModelRatio)
			optionRoute.POST("/migrate_console_setting", controller.MigrateConsoleSetting) // 用于迁移检测的旧键，下个版本会删除
			optionRoute.POST("/waffo-pancake/catalog", controller.ListWaffoPancakeCatalog)
			optionRoute.POST("/waffo-pancake/pair", controller.CreateWaffoPancakePair)
			optionRoute.POST("/waffo-pancake/save", controller.SaveWaffoPancake)
			optionRoute.POST("/waffo-pancake/subscription-product", controller.CreateWaffoPancakeSubscriptionProduct)
			optionRoute.POST("/waffo-pancake/subscription-product-options", controller.ListWaffoPancakeSubscriptionProductOptions)
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
		channelRoute := apiRouter.Group("/channel")
		channelRoute.Use(middleware.AdminAuth())
		{
			channelRoute.GET("/", controller.GetAllChannels)
			channelRoute.GET("/search", controller.SearchChannels)
			channelRoute.GET("/concurrency", controller.GetChannelConcurrencyStatus)
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
			channelRoute.POST("/:id/copilot/device/start", controller.StartCopilotDeviceFlow)
			channelRoute.POST("/:id/copilot/device/poll", controller.PollCopilotDeviceFlow)
			channelRoute.POST("/:id/codex/refresh", controller.RefreshCodexChannelCredential)
			channelRoute.GET("/:id/codex/usage", controller.GetCodexChannelUsage)
			channelRoute.POST("/:id/codex/reset-credit", middleware.CriticalRateLimit(), controller.ConsumeCodexResetCredit)
			channelRoute.POST("/ollama/pull", controller.OllamaPullModel)
			channelRoute.POST("/ollama/pull/stream", controller.OllamaPullModelStream)
			channelRoute.DELETE("/ollama/delete", controller.OllamaDeleteModel)
			channelRoute.GET("/ollama/version/:id", controller.OllamaVersion)
			channelRoute.POST("/batch/tag", controller.BatchSetChannelTag)
			channelRoute.PUT("/batch", controller.EditChannelBatch)
			channelRoute.GET("/tag/models", controller.GetTagModels)
			channelRoute.POST("/copy/:id", controller.CopyChannel)
			channelRoute.POST("/multi_key/manage", controller.ManageMultiKeys)
			channelRoute.POST("/upstream_updates/apply", controller.ApplyChannelUpstreamModelUpdates)
			channelRoute.POST("/upstream_updates/apply_all", controller.ApplyAllChannelUpstreamModelUpdates)
			channelRoute.POST("/upstream_updates/detect", controller.DetectChannelUpstreamModelUpdates)
			channelRoute.POST("/upstream_updates/detect_all", controller.DetectAllChannelUpstreamModelUpdates)
		}
		codexModelGovernanceRoute := apiRouter.Group("/codex_model_governance")
		codexModelGovernanceRoute.Use(middleware.AdminAuth())
		{
			codexModelGovernanceRoute.GET("/", controller.ListCodexModelGovernanceRecords)
			codexModelGovernanceRoute.POST("/rules/test", controller.TestCodexModelGovernanceRule)
			codexModelGovernanceRoute.POST("/:id/review", controller.ReviewCodexModelGovernanceRecord)
		}
		// flatkey Compute (GPU rental) admin dashboard. Admin-only, same guard as
		// channels. Whitelabel: responses expose only flatkey-branded fields.
		computeRoute := apiRouter.Group("/compute")
		computeRoute.Use(middleware.AdminAuth())
		{
			computeRoute.GET("/nodes", controller.GetComputeNodes)
			computeRoute.GET("/nodes/:id", controller.GetComputeNode)
			computeRoute.POST("/nodes/:id/stop", controller.StopComputeNode)
			computeRoute.GET("/offers", controller.GetComputeOffers)
		}
		// flatkey Compute (GPU rental) user-facing endpoints. UserAuth: every
		// handler is scoped to c.GetInt("id") so a customer only ever sees /
		// controls their own rented instances. Whitelabel: responses expose only
		// flatkey-branded fields (provider fields are json:"-").
		computeUserRoute := apiRouter.Group("/compute/instances")
		computeUserRoute.Use(middleware.UserAuth())
		{
			computeUserRoute.GET("", controller.GetComputeInstances)
			computeUserRoute.POST("", controller.CreateComputeInstance)
			computeUserRoute.GET("/:id/connection", controller.GetComputeInstanceConnection)
			computeUserRoute.POST("/:id/stop", controller.StopComputeInstance)
		}
		// User-facing GPU offer catalog (whitelabeled). Standalone route to avoid
		// a Gin static/param conflict with /compute/instances/:id.
		apiRouter.GET("/compute/gpu-offers", middleware.UserAuth(), controller.GetUserGpuOffers)
		tokenRoute := apiRouter.Group("/token")
		tokenRoute.Use(middleware.UserAuth())
		{
			tokenRoute.GET("/", controller.GetAllTokens)
			tokenRoute.GET("/search", middleware.SearchRateLimit(), controller.SearchTokens)
			tokenRoute.POST("/ensure_initial", middleware.CriticalRateLimit(), middleware.DisableCache(), controller.EnsureInitialToken)
			tokenRoute.GET("/:id", controller.GetToken)
			tokenRoute.POST("/:id/key", middleware.CriticalRateLimit(), middleware.DisableCache(), controller.GetTokenKey)
			tokenRoute.POST("/", controller.AddToken)
			tokenRoute.PUT("/", controller.UpdateToken)
			tokenRoute.PUT("/batch", controller.UpdateTokenBatch)
			tokenRoute.PUT("/batch/group", controller.UpdateTokenGroupBatch)
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
		logRoute.GET("/request_samples", middleware.RootAuth(), controller.GetLogRequestSamples)
		logRoute.GET("/stat", middleware.AdminAuth(), controller.GetLogsStat)
		logRoute.GET("/self/stat", middleware.UserAuth(), controller.GetLogsSelfStat)
		logRoute.GET("/channel_affinity_usage_cache", middleware.AdminAuth(), controller.GetChannelAffinityUsageCacheStats)
		logRoute.GET("/search", middleware.AdminAuth(), controller.SearchAllLogs)
		logRoute.GET("/self", middleware.UserAuth(), controller.GetUserLogs)
		logRoute.GET("/self/search", middleware.UserAuth(), middleware.SearchRateLimit(), controller.SearchUserLogs)

		dataRoute := apiRouter.Group("/data")
		dataRoute.GET("", middleware.AdminAuth(), controller.GetAllQuotaDates)
		dataRoute.GET("/", middleware.AdminAuth(), controller.GetAllQuotaDates)
		dataRoute.GET("/users", middleware.AdminAuth(), controller.GetQuotaDatesByUser)
		dataRoute.GET("/codex/limits", middleware.AdminAuth(), controller.GetCodexChannelLimitReport)
		dataRoute.GET("/self", middleware.UserAuth(), controller.GetUserQuotaDates)
		dataRoute.GET("/tokens", middleware.AdminAuth(), controller.GetTokenQuotaDates)
		dataRoute.GET("/self/tokens", middleware.UserAuth(), controller.GetUserTokenQuotaDates)
		dataRoute.GET("/ops_report", middleware.AdminAuth(), controller.GetOpsReport)
		dataRoute.GET("/ops_report_stripe", middleware.AdminAuth(), controller.GetOpsStripeReport)
		dataRoute.GET("/ops_report_ads", middleware.AdminAuth(), controller.GetOpsAdsPilotReport)
		dataRoute.GET("/ops_report_ads_daily", middleware.AdminAuth(), controller.GetOpsAdsDailyReport)
		dataRoute.GET("/ops_report_landing_thumb", middleware.AdminAuth(), controller.GetOpsAdsLandingThumb)
		dataRoute.GET("/model_health", middleware.AdminAuth(), controller.GetModelHealthOverview)
		dataRoute.GET("/model_health/detail", middleware.AdminAuth(), controller.GetModelHealthDetail)

		adsPilotRoute := apiRouter.Group("/ads_pilot")
		adsPilotRoute.Use(middleware.AdminAuth())
		{
			adsPilotRoute.POST("/proposals/:id/decide", controller.DecideAdsPilotProposal)
			adsPilotRoute.POST("/insights/:id/ack", controller.AckAdsPilotInsight)
		}

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
			modelsRoute.GET("/catalog-readiness", controller.GetModelCatalogReadiness)
			modelsRoute.GET("/website-featured", controller.GetWebsiteFeaturedModels)
			modelsRoute.PUT("/website-featured", controller.UpdateWebsiteFeaturedModels)
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
