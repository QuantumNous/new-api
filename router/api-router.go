package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"

	// Import oauth package to register providers via init()
	_ "github.com/QuantumNous/new-api/oauth"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
	"github.com/go-fuego/fuego/option"
)

func SetApiRouter(router *gin.Engine, engine *fuego.Engine) {
	apiRouter := router.Group("/api")
	apiRouter.Use(middleware.RouteTag("api"))
	apiRouter.Use(gzip.Gzip(gzip.DefaultCompression))
	apiRouter.Use(middleware.BodyStorageCleanup())
	apiRouter.Use(middleware.GlobalAPIRateLimit())
	{
		// ---- Public routes (no auth) ----
		setup := dto.NewRouter(engine, apiRouter, "Setup", secPublic())
		dto.Get(setup, "/setup", controller.GetSetup)
		dto.PostB(setup, "/setup", controller.PostSetup)

		system := dto.NewRouter(engine, apiRouter, "System", secPublic())
		dto.Get(system, "/status", controller.GetStatus)
		dto.Get(system, "/uptime/status", controller.GetUptimeKumaStatus)
		dto.Get(system, "/notice", controller.GetNotice)
		dto.Get(system, "/user-agreement", controller.GetUserAgreement)
		dto.Get(system, "/privacy-policy", controller.GetPrivacyPolicy)
		dto.Get(system, "/about", controller.GetAbout)
		dto.Get(system, "/home_page_content", controller.GetHomePageContent)
		dto.Get(system, "/ratio_config", controller.GetRatioConfig)

		// Public routes with inline middleware
		publicModels := dto.NewRouter(engine, apiRouter.Group("", middleware.UserAuth()), "Models", secDashboard())
		dto.Get(publicModels, "/models", controller.DashboardListModels)

		publicAdminSystem := dto.NewRouter(engine, apiRouter.Group("", middleware.AdminAuth()), "System", secDashboard())
		dto.Get(publicAdminSystem, "/status/test", controller.TestStatus)

		publicPricing := dto.NewRouter(engine, apiRouter.Group("", middleware.TryUserAuth()), "Pricing", secPublic())
		dto.Get(publicPricing, "/pricing", controller.GetPricing)

		publicEmailVerify := dto.NewRouter(engine, apiRouter.Group("", middleware.EmailVerificationRateLimit(), middleware.TurnstileCheck()), "Auth", secPublic())
		dto.GetP(publicEmailVerify, "/verification", controller.SendEmailVerification)

		publicResetPwd := dto.NewRouter(engine, apiRouter.Group("", middleware.CriticalRateLimit(), middleware.TurnstileCheck()), "Auth", secPublic())
		dto.GetP(publicResetPwd, "/reset_password", controller.SendPasswordResetEmail)

		publicCritical := dto.NewRouter(engine, apiRouter.Group("", middleware.CriticalRateLimit()), "Auth", secPublic())
		dto.PostB(publicCritical, "/user/reset", controller.ResetPassword)

		// OAuth routes (stay as *gin.Context -- sessions/redirects)
		oauthCritical := dto.NewRouter(engine, apiRouter.Group("", middleware.CriticalRateLimit()), "OAuth", secPublic())
		dto.GetP(oauthCritical, "/oauth/state", controller.GenerateOAuthCode)
		dto.GetP(oauthCritical, "/oauth/email/bind", controller.EmailBind)
		oauthCritical.GinGet("/oauth/wechat", controller.WeChatAuth, option.Query("code", "WeChat auth code"), dto.GinResp[dto.ApiResponse]())
		dto.GetP(oauthCritical, "/oauth/wechat/bind", controller.WeChatBind)
		oauthCritical.GinGet("/oauth/telegram/login", controller.TelegramLogin, dto.GinResp[dto.ApiResponse]())
		oauthCritical.GinGet("/oauth/telegram/bind", controller.TelegramBind, dto.GinResp[dto.ApiResponse]())
		oauthCritical.GinGet("/oauth/:provider", controller.HandleOAuth, option.Path("provider", "OAuth provider name"), option.Query("state", "OAuth state"), option.Query("code", "OAuth authorization code"), dto.GinResp[dto.ApiResponse]())

		// Payment webhooks (no auth, stay as *gin.Context -- raw body/writer)
		paymentWebhook := dto.NewRouter(engine, apiRouter, "Payment", secPublic())
		paymentWebhook.GinPost("/stripe/webhook", controller.StripeWebhook, dto.GinResp[dto.MessageResponse]())
		paymentWebhook.GinPost("/creem/webhook", controller.CreemWebhook, dto.GinResp[dto.MessageResponse]())

		// Secure verification (stays as *gin.Context -- sessions)
		verify := dto.NewRouter(engine, apiRouter.Group("", middleware.UserAuth(), middleware.CriticalRateLimit()), "Auth", secDashboard())
		verify.GinPost("/verify", controller.UniversalVerify, dto.GinResp[dto.Response[dto.VerificationStatusResponse]]())

		// ---- User routes ----
		userGroup := apiRouter.Group("/user")

		// Public user routes (stay as *gin.Context -- sessions)
		userPublicTurnstile := dto.NewRouter(engine, userGroup.Group("", middleware.CriticalRateLimit(), middleware.TurnstileCheck()), "User", secPublic())
		dto.PostB(userPublicTurnstile, "/register", controller.Register)
		userPublicTurnstile.GinPost("/login", controller.Login, dto.GinResp[dto.Response[dto.LoginData]](), dto.GinBody[dto.LoginRequest]())
		userPublicCritical := dto.NewRouter(engine, userGroup.Group("", middleware.CriticalRateLimit()), "User", secPublic())
		userPublicCritical.GinPost("/login/2fa", controller.Verify2FALogin, dto.GinResp[dto.Response[dto.LoginData]](), dto.GinBody[dto.Verify2FARequest]())
		userPublicCritical.GinPost("/passkey/login/begin", controller.PasskeyLoginBegin, dto.GinResp[dto.Response[dto.PasskeyOptionsData]]())
		userPublicCritical.GinPost("/passkey/login/finish", controller.PasskeyLoginFinish, dto.GinResp[dto.Response[dto.LoginData]]())
		userPublic := dto.NewRouter(engine, userGroup, "User", secPublic())
		dto.Get(userPublic, "/logout", controller.Logout)
		dto.Get(userPublic, "/groups", controller.GetUserGroups)

		userPaymentPublic := dto.NewRouter(engine, userGroup, "Payment", secPublic())
		userPaymentPublic.GinPost("/epay/notify", controller.EpayNotify, dto.GinResp[dto.MessageResponse]())
		userPaymentPublic.GinGet("/epay/notify", controller.EpayNotify, dto.GinResp[dto.MessageResponse]())

		// Self routes (UserAuth)
		selfGroup := userGroup.Group("", middleware.UserAuth())
		self := dto.NewRouter(engine, selfGroup, "User", secDashboard())
		dto.Get(self, "/self/groups", controller.GetUserGroups)
		dto.Get(self, "/self", controller.GetSelf)
		dto.Get(self, "/models", controller.GetUserModels)
		dto.Put(self, "/self", controller.UpdateSelf)
		dto.Delete(self, "/self", controller.DeleteSelf)
		dto.Get(self, "/token", controller.GenerateAccessToken)
		self.GinGet("/passkey", controller.PasskeyStatus, dto.GinResp[dto.Response[dto.PasskeyStatusData]]())
		self.GinPost("/passkey/register/begin", controller.PasskeyRegisterBegin, dto.GinResp[dto.Response[dto.PasskeyOptionsData]]())
		self.GinPost("/passkey/register/finish", controller.PasskeyRegisterFinish, dto.GinResp[dto.MessageResponse]())
		self.GinPost("/passkey/verify/begin", controller.PasskeyVerifyBegin, dto.GinResp[dto.Response[dto.PasskeyOptionsData]]())
		self.GinPost("/passkey/verify/finish", controller.PasskeyVerifyFinish, dto.GinResp[dto.MessageResponse]())
		self.GinDelete("/passkey", controller.PasskeyDelete, dto.GinResp[dto.MessageResponse]())
		dto.Get(self, "/aff", controller.GetAffCode)

		selfTopUp := self.WithTag("TopUp")
		dto.Get(selfTopUp, "/topup/info", controller.GetTopUpInfo)
		dto.GetP(selfTopUp, "/topup/self", controller.GetUserTopUps, dto.PageParams())
		dto.PostB(selfTopUp, "/amount", controller.RequestAmount)
		dto.PostB(selfTopUp, "/stripe/amount", controller.RequestStripeAmount)

		dto.PostB(self, "/aff_transfer", controller.TransferAffQuota)
		dto.PostB(self, "/setting", controller.UpdateUserSetting)

		// Self routes with rate limiting
		selfCritical := dto.NewRouter(engine, selfGroup.Group("", middleware.CriticalRateLimit()), "TopUp", secDashboard())
		dto.PostB(selfCritical, "/topup", controller.TopUp)
		dto.PostB(selfCritical, "/pay", controller.RequestEpay)
		dto.PostB(selfCritical, "/stripe/pay", controller.RequestStripePay)
		dto.PostB(selfCritical, "/creem/pay", controller.RequestCreemPay)

		// 2FA routes
		self2FA := dto.NewRouter(engine, selfGroup, "2FA", secDashboard())
		dto.Get(self2FA, "/2fa/status", controller.Get2FAStatus)
		dto.Post(self2FA, "/2fa/setup", controller.Setup2FA)
		dto.PostB(self2FA, "/2fa/enable", controller.Enable2FA)
		dto.PostB(self2FA, "/2fa/disable", controller.Disable2FA)
		dto.PostB(self2FA, "/2fa/backup_codes", controller.RegenerateBackupCodes)

		// Check-in routes
		selfCheckin := dto.NewRouter(engine, selfGroup, "Checkin", secDashboard())
		dto.GetP(selfCheckin, "/checkin", controller.GetCheckinStatus)
		selfCheckinTurnstile := dto.NewRouter(engine, selfGroup.Group("", middleware.TurnstileCheck()), "Checkin", secDashboard())
		dto.Post(selfCheckinTurnstile, "/checkin", controller.DoCheckin)

		// Custom OAuth bindings
		selfOAuth := dto.NewRouter(engine, selfGroup, "OAuth", secDashboard())
		dto.Get(selfOAuth, "/oauth/bindings", controller.GetUserOAuthBindings)
		dto.Delete(selfOAuth, "/oauth/bindings/:provider_id", controller.UnbindCustomOAuth, option.Path("provider_id", "OAuth provider ID"))

		// Admin user routes
		adminGroup := userGroup.Group("", middleware.AdminAuth())
		admin := dto.NewRouter(engine, adminGroup, "AdminUser", secDashboard())
		dto.Get(admin, "/", controller.GetAllUsers, dto.PageParams())
		dto.GetP(admin, "/topup", controller.GetAllTopUps, dto.PageParams())
		dto.PostB(admin, "/topup/complete", controller.AdminCompleteTopUp)
		dto.GetP(admin, "/search", controller.SearchUsers, dto.PageParams())
		dto.Get(admin, "/:id/oauth/bindings", controller.GetUserOAuthBindingsByAdmin, option.Path("id", "User ID"))
		dto.Delete(admin, "/:id/oauth/bindings/:provider_id", controller.UnbindCustomOAuthByAdmin, option.Path("id", "User ID"), option.Path("provider_id", "OAuth provider ID"))
		dto.Delete(admin, "/:id/bindings/:binding_type", controller.AdminClearUserBinding, option.Path("id", "User ID"), option.Path("binding_type", "Binding type"))
		dto.Get(admin, "/:id", controller.GetUser, option.Path("id", "User ID"))
		dto.PostB(admin, "/", controller.CreateUser)
		dto.PostB(admin, "/manage", controller.ManageUser)
		dto.PutB(admin, "/", controller.UpdateUser)
		dto.Delete(admin, "/:id", controller.DeleteUser, option.Path("id", "User ID"))
		dto.Delete(admin, "/:id/reset_passkey", controller.AdminResetPasskey, option.Path("id", "User ID"))

		// Admin 2FA routes
		admin2FA := admin.WithTag("Admin2FA")
		dto.Get(admin2FA, "/2fa/stats", controller.Admin2FAStats)
		dto.Delete(admin2FA, "/:id/2fa", controller.AdminDisable2FA, option.Path("id", "User ID"))

		// ---- Subscription routes ----
		subGroup := apiRouter.Group("/subscription", middleware.UserAuth())
		sub := dto.NewRouter(engine, subGroup, "Subscription", secDashboard())
		dto.Get(sub, "/plans", controller.GetSubscriptionPlans)
		dto.Get(sub, "/self", controller.GetSubscriptionSelf)
		dto.PutB(sub, "/self/preference", controller.UpdateSubscriptionPreference)

		subCritical := dto.NewRouter(engine, subGroup.Group("", middleware.CriticalRateLimit()), "SubscriptionPayment", secDashboard())
		dto.PostB(subCritical, "/epay/pay", controller.SubscriptionRequestEpay)
		dto.PostB(subCritical, "/stripe/pay", controller.SubscriptionRequestStripePay)
		dto.PostB(subCritical, "/creem/pay", controller.SubscriptionRequestCreemPay)

		subAdminGroup := apiRouter.Group("/subscription/admin", middleware.AdminAuth())
		subAdmin := dto.NewRouter(engine, subAdminGroup, "AdminSubscription", secDashboard())
		dto.Get(subAdmin, "/plans", controller.AdminListSubscriptionPlans)
		dto.PostB(subAdmin, "/plans", controller.AdminCreateSubscriptionPlan)
		dto.PutB(subAdmin, "/plans/:id", controller.AdminUpdateSubscriptionPlan, option.Path("id", "Plan ID"))
		dto.PatchB(subAdmin, "/plans/:id", controller.AdminUpdateSubscriptionPlanStatus, option.Path("id", "Plan ID"))
		dto.PostB(subAdmin, "/bind", controller.AdminBindSubscription)
		dto.Get(subAdmin, "/users/:id/subscriptions", controller.AdminListUserSubscriptions, option.Path("id", "User ID"))
		dto.PostB(subAdmin, "/users/:id/subscriptions", controller.AdminCreateUserSubscription, option.Path("id", "User ID"))
		dto.Post(subAdmin, "/user_subscriptions/:id/invalidate", controller.AdminInvalidateUserSubscription, option.Path("id", "Subscription ID"))
		dto.Delete(subAdmin, "/user_subscriptions/:id", controller.AdminDeleteUserSubscription, option.Path("id", "Subscription ID"))

		// Subscription payment callbacks (no auth, stay as *gin.Context -- raw writer/redirect)
		subPaymentPublic := dto.NewRouter(engine, apiRouter, "SubscriptionPayment", secPublic())
		subPaymentPublic.GinPost("/subscription/epay/notify", controller.SubscriptionEpayNotify, dto.GinResp[dto.MessageResponse]())
		subPaymentPublic.GinGet("/subscription/epay/notify", controller.SubscriptionEpayNotify, dto.GinResp[dto.MessageResponse]())
		subPaymentPublic.GinGet("/subscription/epay/return", controller.SubscriptionEpayReturn, dto.GinResp[dto.MessageResponse]())
		subPaymentPublic.GinPost("/subscription/epay/return", controller.SubscriptionEpayReturn, dto.GinResp[dto.MessageResponse]())

		// ---- Option routes (root only) ----
		optionGroup := apiRouter.Group("/option", middleware.RootAuth())
		opt := dto.NewRouter(engine, optionGroup, "Option", secDashboard())
		dto.Get(opt, "/", controller.GetOptions)
		dto.PutB(opt, "/", controller.UpdateOption)
		dto.Get(opt, "/channel_affinity_cache", controller.GetChannelAffinityCacheStats)
		dto.DeleteP(opt, "/channel_affinity_cache", controller.ClearChannelAffinityCache)
		dto.Post(opt, "/rest_model_ratio", controller.ResetModelRatio)
		dto.Post(opt, "/migrate_console_setting", controller.MigrateConsoleSetting)

		// ---- Custom OAuth provider management (root only) ----
		customOAuthGroup := apiRouter.Group("/custom-oauth-provider", middleware.RootAuth())
		customOAuth := dto.NewRouter(engine, customOAuthGroup, "CustomOAuth", secDashboard())
		dto.PostB(customOAuth, "/discovery", controller.FetchCustomOAuthDiscovery)
		dto.Get(customOAuth, "/", controller.GetCustomOAuthProviders)
		dto.Get(customOAuth, "/:id", controller.GetCustomOAuthProvider, option.Path("id", "Provider ID"))
		dto.PostB(customOAuth, "/", controller.CreateCustomOAuthProvider)
		dto.PutB(customOAuth, "/:id", controller.UpdateCustomOAuthProvider, option.Path("id", "Provider ID"))
		dto.Delete(customOAuth, "/:id", controller.DeleteCustomOAuthProvider, option.Path("id", "Provider ID"))

		// ---- Performance routes (root only) ----
		perfGroup := apiRouter.Group("/performance", middleware.RootAuth())
		perf := dto.NewRouter(engine, perfGroup, "Performance", secDashboard())
		dto.Get(perf, "/stats", controller.GetPerformanceStats)
		dto.Delete(perf, "/disk_cache", controller.ClearDiskCache)
		dto.Post(perf, "/reset_stats", controller.ResetPerformanceStats)
		dto.Post(perf, "/gc", controller.ForceGC)

		// ---- Ratio sync routes (root only) ----
		ratioSyncGroup := apiRouter.Group("/ratio_sync", middleware.RootAuth())
		ratioSync := dto.NewRouter(engine, ratioSyncGroup, "RatioSync", secDashboard())
		dto.Get(ratioSync, "/channels", controller.GetSyncableChannels)
		dto.PostB(ratioSync, "/fetch", controller.FetchUpstreamRatios)

		// ---- Channel routes (admin) ----
		channelGroup := apiRouter.Group("/channel", middleware.AdminAuth())
		ch := dto.NewRouter(engine, channelGroup, "Channel", secDashboard())
		dto.GetP(ch, "/", controller.GetAllChannels, dto.PageParams())
		dto.GetP(ch, "/search", controller.SearchChannels, dto.PageParams())
		dto.Get(ch, "/models", controller.ChannelListModels)
		dto.Get(ch, "/models_enabled", controller.EnabledListModels)
		dto.Get(ch, "/:id", controller.GetChannel, option.Path("id", "Channel ID"))
		dto.Get(ch, "/test", controller.TestAllChannels)
		dto.GetP(ch, "/test/:id", controller.TestChannel, option.Path("id", "Channel ID"))
		dto.Get(ch, "/update_balance", controller.UpdateAllChannelsBalance)
		dto.Get(ch, "/update_balance/:id", controller.UpdateChannelBalance, option.Path("id", "Channel ID"))
		dto.PostB(ch, "/", controller.AddChannel)
		dto.PutB(ch, "/", controller.UpdateChannel)
		dto.Delete(ch, "/disabled", controller.DeleteDisabledChannel)
		dto.PostB(ch, "/tag/disabled", controller.DisableTagChannels)
		dto.PostB(ch, "/tag/enabled", controller.EnableTagChannels)
		dto.PutB(ch, "/tag", controller.EditTagChannels)
		dto.Delete(ch, "/:id", controller.DeleteChannel, option.Path("id", "Channel ID"))
		dto.PostB(ch, "/batch", controller.DeleteChannelBatch)
		dto.Post(ch, "/fix", controller.FixChannelsAbilities)
		dto.Get(ch, "/fetch_models/:id", controller.FetchUpstreamModels, option.Path("id", "Channel ID"), dto.Resp[dto.ApiResponse]())
		dto.PostB(ch, "/fetch_models", controller.FetchModels)
		dto.Post(ch, "/codex/oauth/start", controller.StartCodexOAuth)
		dto.PostB(ch, "/codex/oauth/complete", controller.CompleteCodexOAuth)
		dto.Post(ch, "/:id/codex/oauth/start", controller.StartCodexOAuthForChannel, option.Path("id", "Channel ID"))
		dto.PostB(ch, "/:id/codex/oauth/complete", controller.CompleteCodexOAuthForChannel, option.Path("id", "Channel ID"))
		dto.Post(ch, "/:id/codex/refresh", controller.RefreshCodexChannelCredential, option.Path("id", "Channel ID"))
		dto.Get(ch, "/:id/codex/usage", controller.GetCodexChannelUsage, option.Path("id", "Channel ID"))
		dto.PostB(ch, "/ollama/pull", controller.OllamaPullModel)
		ch.GinPost("/ollama/pull/stream", controller.OllamaPullModelStream, dto.GinResp[dto.MessageResponse]())
		dto.DeleteB(ch, "/ollama/delete", controller.OllamaDeleteModel)
		dto.Get(ch, "/ollama/version/:id", controller.OllamaVersion, option.Path("id", "Channel ID"))
		dto.PostB(ch, "/batch/tag", controller.BatchSetChannelTag)
		dto.GetP(ch, "/tag/models", controller.GetTagModels)
		dto.PostP(ch, "/copy/:id", controller.CopyChannel, option.Path("id", "Channel ID"))
		dto.PostB(ch, "/multi_key/manage", controller.ManageMultiKeys, dto.Resp[dto.MultiKeyStatusResponse]())
		ch.GinPost("/upstream_updates/apply", controller.ApplyChannelUpstreamModelUpdates, dto.GinResp[dto.MessageResponse]())
		ch.GinPost("/upstream_updates/apply_all", controller.ApplyAllChannelUpstreamModelUpdates, dto.GinResp[dto.MessageResponse]())
		ch.GinPost("/upstream_updates/detect", controller.DetectChannelUpstreamModelUpdates, dto.GinResp[dto.MessageResponse]())
		ch.GinPost("/upstream_updates/detect_all", controller.DetectAllChannelUpstreamModelUpdates, dto.GinResp[dto.MessageResponse]())

		// Channel key route (root + extra middleware)
		chKey := dto.NewRouter(engine, channelGroup.Group("", middleware.RootAuth(), middleware.CriticalRateLimit(), middleware.DisableCache(), middleware.SecureVerificationRequired()), "Channel", secDashboard())
		dto.Post(chKey, "/:id/key", controller.GetChannelKey, option.Path("id", "Channel ID"))

		// ---- Token routes (user auth) ----
		tokenGroup := apiRouter.Group("/token", middleware.UserAuth())
		tok := dto.NewRouter(engine, tokenGroup, "Token", secDashboard())
		dto.Get(tok, "/", controller.GetAllTokens, dto.PageParams())
		dto.Get(tok, "/:id", controller.GetToken, option.Path("id", "Token ID"))
		dto.PostB(tok, "/", controller.AddToken)
		dto.PutBP(tok, "/", controller.UpdateToken)
		dto.Delete(tok, "/:id", controller.DeleteToken, option.Path("id", "Token ID"))
		dto.PostB(tok, "/batch", controller.DeleteTokenBatch)

		tokKey := dto.NewRouter(engine, tokenGroup.Group("", middleware.CriticalRateLimit(), middleware.DisableCache()), "Token", secDashboard())
		dto.Post(tokKey, "/:id/key", controller.GetTokenKey, option.Path("id", "Token ID"))

		tokSearch := dto.NewRouter(engine, tokenGroup.Group("", middleware.SearchRateLimit()), "Token", secDashboard())
		dto.GetP(tokSearch, "/search", controller.SearchTokens, dto.PageParams())

		// ---- Usage routes ----
		usageTokenGroup := apiRouter.Group("/usage/token", middleware.CORS(), middleware.CriticalRateLimit(), middleware.TokenAuthReadOnly())
		usageTok := dto.NewRouter(engine, usageTokenGroup, "Usage", secToken())
		dto.Get(usageTok, "/", controller.GetTokenUsage)

		// ---- Redemption routes (admin) ----
		redemptionGroup := apiRouter.Group("/redemption", middleware.AdminAuth())
		redemption := dto.NewRouter(engine, redemptionGroup, "Redemption", secDashboard())
		dto.Get(redemption, "/", controller.GetAllRedemptions, dto.PageParams())
		dto.GetP(redemption, "/search", controller.SearchRedemptions, dto.PageParams())
		dto.Get(redemption, "/:id", controller.GetRedemption, option.Path("id", "Redemption ID"))
		dto.PostB(redemption, "/", controller.AddRedemption)
		dto.PutBP(redemption, "/", controller.UpdateRedemption)
		dto.Delete(redemption, "/invalid", controller.DeleteInvalidRedemption)
		dto.Delete(redemption, "/:id", controller.DeleteRedemption, option.Path("id", "Redemption ID"))

		// ---- Log routes ----
		logGroup := apiRouter.Group("/log")

		logAdmin := dto.NewRouter(engine, logGroup.Group("", middleware.AdminAuth()), "Log", secDashboard())
		dto.GetP(logAdmin, "/", controller.GetAllLogs, dto.PageParams())
		dto.DeleteP(logAdmin, "/", controller.DeleteHistoryLogs)
		dto.GetP(logAdmin, "/stat", controller.GetLogsStat)
		dto.GetP(logAdmin, "/channel_affinity_usage_cache", controller.GetChannelAffinityUsageCacheStats)
		dto.Get(logAdmin, "/search", controller.SearchAllLogs)

		logUser := dto.NewRouter(engine, logGroup.Group("", middleware.UserAuth()), "Log", secDashboard())
		dto.GetP(logUser, "/self/stat", controller.GetLogsSelfStat)
		dto.GetP(logUser, "/self", controller.GetUserLogs, dto.PageParams())

		logUserSearch := dto.NewRouter(engine, logGroup.Group("", middleware.UserAuth(), middleware.SearchRateLimit()), "Log", secDashboard())
		dto.Get(logUserSearch, "/self/search", controller.SearchUserLogs)

		logToken := dto.NewRouter(engine, logGroup.Group("", middleware.CORS(), middleware.CriticalRateLimit(), middleware.TokenAuthReadOnly()), "Log", secToken())
		dto.Get(logToken, "/token", controller.GetLogByKey)

		// ---- Data routes ----
		dataAdmin := dto.NewRouter(engine, apiRouter.Group("/data", middleware.AdminAuth()), "Data", secDashboard())
		dto.GetP(dataAdmin, "/", controller.GetAllQuotaDates)

		dataUser := dto.NewRouter(engine, apiRouter.Group("/data", middleware.UserAuth()), "Data", secDashboard())
		dto.GetP(dataUser, "/self", controller.GetUserQuotaDates)

		// ---- Group routes (admin) ----
		grp := dto.NewRouter(engine, apiRouter.Group("/group", middleware.AdminAuth()), "Group", secDashboard())
		dto.Get(grp, "/", controller.GetGroups)

		// ---- Prefill group routes (admin) ----
		prefillGrp := dto.NewRouter(engine, apiRouter.Group("/prefill_group", middleware.AdminAuth()), "PrefillGroup", secDashboard())
		dto.GetP(prefillGrp, "/", controller.GetPrefillGroups)
		dto.PostB(prefillGrp, "/", controller.CreatePrefillGroup)
		dto.PutB(prefillGrp, "/", controller.UpdatePrefillGroup)
		dto.Delete(prefillGrp, "/:id", controller.DeletePrefillGroup, option.Path("id", "Prefill group ID"))

		// ---- Midjourney routes ----
		mjGroup := apiRouter.Group("/mj")
		mjUser := dto.NewRouter(engine, mjGroup.Group("", middleware.UserAuth()), "Midjourney", secDashboard())
		dto.GetP(mjUser, "/self", controller.GetUserMidjourney, dto.PageParams())
		mjAdmin := dto.NewRouter(engine, mjGroup.Group("", middleware.AdminAuth()), "Midjourney", secDashboard())
		dto.GetP(mjAdmin, "/", controller.GetAllMidjourney, dto.PageParams())

		// ---- Task routes ----
		taskGroup := apiRouter.Group("/task")
		taskUser := dto.NewRouter(engine, taskGroup.Group("", middleware.UserAuth()), "Task", secDashboard())
		dto.GetP(taskUser, "/self", controller.GetUserTask, dto.PageParams())
		taskAdmin := dto.NewRouter(engine, taskGroup.Group("", middleware.AdminAuth()), "Task", secDashboard())
		dto.GetP(taskAdmin, "/", controller.GetAllTask, dto.PageParams())

		// ---- Vendor routes (admin) ----
		vendorGroup := apiRouter.Group("/vendors", middleware.AdminAuth())
		vendor := dto.NewRouter(engine, vendorGroup, "Vendor", secDashboard())
		dto.Get(vendor, "/", controller.GetAllVendors, dto.PageParams())
		dto.GetP(vendor, "/search", controller.SearchVendors, dto.PageParams())
		dto.Get(vendor, "/:id", controller.GetVendorMeta, option.Path("id", "Vendor ID"))
		dto.PostB(vendor, "/", controller.CreateVendorMeta)
		dto.PutB(vendor, "/", controller.UpdateVendorMeta)
		dto.Delete(vendor, "/:id", controller.DeleteVendorMeta, option.Path("id", "Vendor ID"))

		// ---- Models routes (admin) ----
		modelsGroup := apiRouter.Group("/models", middleware.AdminAuth())
		models := dto.NewRouter(engine, modelsGroup, "ModelMeta", secDashboard())
		dto.GetP(models, "/sync_upstream/preview", controller.SyncUpstreamPreview)
		dto.PostB(models, "/sync_upstream", controller.SyncUpstreamModels)
		dto.Get(models, "/missing", controller.GetMissingModels)
		dto.Get(models, "/list", controller.GetAllModelsMeta, dto.PageParams())
		dto.GetP(models, "/search", controller.SearchModelsMeta, dto.PageParams())
		dto.Get(models, "/:id", controller.GetModelMeta, option.Path("id", "Model ID"))
		dto.PostB(models, "/", controller.CreateModelMeta)
		dto.PutBP(models, "/", controller.UpdateModelMeta)
		dto.Delete(models, "/:id", controller.DeleteModelMeta, option.Path("id", "Model ID"))

		// ---- Deployment routes (admin) ----
		deploymentsGroup := apiRouter.Group("/deployments", middleware.AdminAuth())
		deploy := dto.NewRouter(engine, deploymentsGroup, "Deployment", secDashboard())
		dto.Get(deploy, "/settings", controller.GetModelDeploymentSettings)
		dto.PostB(deploy, "/settings/test-connection", controller.TestIoNetConnection)
		dto.GetP(deploy, "/", controller.GetAllDeployments, dto.PageParams())
		dto.GetP(deploy, "/search", controller.SearchDeployments, dto.PageParams())
		dto.PostB(deploy, "/test-connection", controller.TestIoNetConnection)
		dto.Get(deploy, "/hardware-types", controller.GetHardwareTypes)
		dto.Get(deploy, "/locations", controller.GetLocations)
		dto.GetP(deploy, "/available-replicas", controller.GetAvailableReplicas)
		dto.PostB(deploy, "/price-estimation", controller.GetPriceEstimation)
		dto.GetP(deploy, "/check-name", controller.CheckClusterNameAvailability)
		dto.PostB(deploy, "/", controller.CreateDeployment)
		dto.Get(deploy, "/:id", controller.GetDeployment, option.Path("id", "Deployment ID"))
		dto.GetP(deploy, "/:id/logs", controller.GetDeploymentLogs, option.Path("id", "Deployment ID"))
		dto.Get(deploy, "/:id/containers", controller.ListDeploymentContainers, option.Path("id", "Deployment ID"))
		dto.Get(deploy, "/:id/containers/:container_id", controller.GetContainerDetails, option.Path("id", "Deployment ID"), option.Path("container_id", "Container ID"))
		dto.PutB(deploy, "/:id", controller.UpdateDeployment, option.Path("id", "Deployment ID"))
		dto.PutB(deploy, "/:id/name", controller.UpdateDeploymentName, option.Path("id", "Deployment ID"))
		dto.PostB(deploy, "/:id/extend", controller.ExtendDeployment, option.Path("id", "Deployment ID"))
		dto.Delete(deploy, "/:id", controller.DeleteDeployment, option.Path("id", "Deployment ID"))
	}
}
