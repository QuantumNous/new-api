package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

func TestStatus(c *gin.Context) {
	err := model.PingDB()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "数据库连接失败",
		})
		return
	}
	// 获取HTTP统计信息
	httpStats := middleware.GetStats()
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"message":    "Server is running",
		"http_stats": httpStats,
	})
	return
}

func GetStatus(c *gin.Context) {
	cs := console_setting.GetConsoleSetting()
	passkeySetting := system_setting.PasskeySettingsSnapshot()
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	legalSetting := system_setting.GetLegalSettings()

	data := gin.H{
		"version":                               common.Version,
		"start_time":                            common.StartTime,
		"email_verification":                    common.EmailVerificationEnabled,
		"github_oauth":                          common.GitHubOAuthEnabled,
		"github_client_id":                      common.GitHubClientId,
		"discord_oauth":                         system_setting.GetDiscordSettings().Enabled,
		"discord_client_id":                     system_setting.GetDiscordSettings().ClientId,
		"linuxdo_oauth":                         common.LinuxDOOAuthEnabled,
		"linuxdo_client_id":                     common.LinuxDOClientId,
		"linuxdo_minimum_trust_level":           common.LinuxDOMinimumTrustLevel,
		"qq_oauth":                              common.QQOAuthEnabled,
		"qq_client_id":                          common.QQClientId,
		"telegram_oauth":                        common.TelegramOAuthEnabled,
		"telegram_bot_name":                     common.TelegramBotName,
		"steam_oauth":                           common.SteamOAuthEnabled,
		"theme":                                 getRequestFrontendTheme(c),
		"system_theme":                          system_setting.GetThemeSettings().Frontend,
		"system_name":                           common.SystemName,
		"logo":                                  common.Logo,
		"footer_html":                           common.Footer,
		"wechat_qrcode":                         common.WeChatAccountQRCodeImageURL,
		"wechat_login":                          common.WeChatAuthEnabled,
		"server_address":                        system_setting.ServerAddress,
		"turnstile_check":                       common.IsAnyTurnstileCheckEnabled(),
		"turnstile_login":                       common.TurnstileLoginEnabled,
		"turnstile_register":                    common.TurnstileRegisterEnabled,
		"turnstile_register_email_verification": common.TurnstileRegisterEmailVerificationEnabled,
		"turnstile_email_binding_verification":  common.TurnstileEmailBindingVerificationEnabled,
		"turnstile_password_reset":              common.TurnstilePasswordResetEnabled,
		"turnstile_checkin":                     common.TurnstileCheckinEnabled,
		"turnstile_sensitive_update":            common.TurnstileSensitiveUpdateEnabled,
		"turnstile_site_key":                    common.TurnstileSiteKey,
		"docs_link":                             operation_setting.GetGeneralSetting().DocsLink,
		"quota_per_unit":                        common.QuotaPerUnit,
		// 兼容旧前端：保留 display_in_currency，同时提供新的 quota_display_type
		"display_in_currency":               operation_setting.IsCurrencyDisplay(),
		"quota_display_type":                operation_setting.GetQuotaDisplayType(),
		"custom_currency_symbol":            operation_setting.GetGeneralSetting().CustomCurrencySymbol,
		"custom_currency_exchange_rate":     operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate,
		"enable_batch_update":               common.BatchUpdateEnabled,
		"enable_drawing":                    common.DrawingEnabled,
		"enable_task":                       common.TaskEnabled,
		"enable_data_export":                common.DataExportEnabled,
		"data_export_default_time":          common.DataExportDefaultTime,
		"default_collapse_sidebar":          common.DefaultCollapseSidebar,
		"mj_notify_enabled":                 setting.MjNotifyEnabled,
		"chats":                             setting.Chats,
		"demo_site_enabled":                 operation_setting.DemoSiteEnabled,
		"self_use_mode_enabled":             operation_setting.SelfUseModeEnabled,
		"register_enabled":                  common.RegisterEnabled,
		"oauth_register_enabled":            common.OAuthRegisterEnabled,
		"register_invite_code_required":     common.RegisterInviteCodeRequired,
		"password_register_enabled":         common.PasswordRegisterEnabled,
		"password_login_encryption_enabled": common.PasswordLoginEncryptionEnabled,
		"default_use_auto_group":            setting.DefaultUseAutoGroup,

		"usd_exchange_rate": operation_setting.USDExchangeRate,
		"price":             operation_setting.Price,
		"stripe_unit_price": setting.StripeUnitPrice,

		// 面板启用开关
		"api_info_enabled":      cs.ApiInfoEnabled,
		"uptime_kuma_enabled":   cs.UptimeKumaEnabled,
		"announcements_enabled": cs.AnnouncementsEnabled,
		"faq_enabled":           cs.FAQEnabled,
		"friend_links_enabled":  cs.FriendLinksEnabled,

		// 模块管理配置
		"HeaderNavModules":    common.OptionMap["HeaderNavModules"],
		"SidebarModulesAdmin": common.OptionMap["SidebarModulesAdmin"],

		"oidc_enabled":                system_setting.GetOIDCSettings().Enabled,
		"oidc_client_id":              system_setting.GetOIDCSettings().ClientId,
		"oidc_authorization_endpoint": system_setting.GetOIDCSettings().AuthorizationEndpoint,
		"passkey_login":               passkeySetting.Enabled,
		"passkey_display_name":        passkeySetting.RPDisplayName,
		"passkey_rp_id":               passkeySetting.EffectiveRPID(),
		"passkey_rp_ids":              passkeySetting.RelyingPartyIDs(),
		"passkey_origins":             passkeySetting.Origins,
		"passkey_allow_insecure":      passkeySetting.AllowInsecureOrigin,
		"passkey_user_verification":   passkeySetting.UserVerification,
		"passkey_attachment":          passkeySetting.AttachmentPreference,
		"setup":                       constant.Setup,
		"user_agreement_enabled":      legalSetting.UserAgreement != "",
		"privacy_policy_enabled":      legalSetting.PrivacyPolicy != "",
		"checkin_enabled":             operation_setting.GetCheckinSetting().Enabled,
	}

	// 根据启用状态注入可选内容
	if cs.ApiInfoEnabled {
		data["api_info"] = console_setting.GetApiInfo()
	}
	if cs.AnnouncementsEnabled {
		data["announcements"] = console_setting.GetAnnouncements()
	}
	if cs.FAQEnabled {
		data["faq"] = console_setting.GetFAQ()
	}
	if cs.FriendLinksEnabled {
		data["friend_links"] = console_setting.GetFriendLinks()
	}

	// Add enabled custom OAuth providers
	customProviders := oauth.GetEnabledCustomProviders()
	if len(customProviders) > 0 {
		type CustomOAuthInfo struct {
			Id                    int    `json:"id"`
			Name                  string `json:"name"`
			Slug                  string `json:"slug"`
			Icon                  string `json:"icon"`
			ClientId              string `json:"client_id"`
			AuthorizationEndpoint string `json:"authorization_endpoint"`
			Scopes                string `json:"scopes"`
		}
		providersInfo := make([]CustomOAuthInfo, 0, len(customProviders))
		for _, p := range customProviders {
			config := p.GetConfig()
			providersInfo = append(providersInfo, CustomOAuthInfo{
				Id:                    config.Id,
				Name:                  config.Name,
				Slug:                  config.Slug,
				Icon:                  config.Icon,
				ClientId:              config.ClientId,
				AuthorizationEndpoint: config.AuthorizationEndpoint,
				Scopes:                config.Scopes,
			})
		}
		data["custom_oauth_providers"] = providersInfo
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
	return
}

func getRequestFrontendTheme(c *gin.Context) string {
	theme, err := c.Cookie(common.FrontendThemeCookieName)
	if err == nil && (theme == common.FrontendThemeDefault || theme == common.FrontendThemeClassic) {
		return theme
	}
	return common.NormalizeFrontendTheme(system_setting.GetThemeSettings().Frontend)
}

func GetNotice(c *gin.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["Notice"],
	})
	return
}

func GetAbout(c *gin.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["About"],
	})
	return
}

func GetUserAgreement(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    system_setting.GetLegalSettings().UserAgreement,
	})
	return
}

func GetPrivacyPolicy(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    system_setting.GetLegalSettings().PrivacyPolicy,
	})
	return
}

func GetMidjourney(c *gin.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["Midjourney"],
	})
	return
}

func GetHomePageContent(c *gin.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["HomePageContent"],
	})
	return
}

const (
	emailVerificationPurposeRegister = "register"
	emailVerificationPurposeBind     = "bind"
)

func isEmailDomainRestrictionEnabledForPurpose(purpose string) bool {
	switch purpose {
	case emailVerificationPurposeBind:
		return common.EmailDomainRestrictionForBindingEnabled
	default:
		return common.EmailDomainRestrictionEnabled
	}
}

func validateEmailDomainPolicy(email string, restrictDomain bool) error {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return errors.New("无效的邮箱地址")
	}
	localPart := parts[0]
	domainPart := parts[1]
	if restrictDomain && !isEmailDomainAllowed(domainPart, common.EmailDomainWhitelist) {
		return errors.New("管理员已启用邮箱域名白名单，您的邮箱地址因包含特殊符号或不在白名单中而被拒绝。")
	}
	if common.EmailAliasRestrictionEnabled {
		containsSpecialSymbols := strings.Contains(localPart, "+") || strings.Contains(localPart, ".")
		if containsSpecialSymbols {
			return errors.New("管理员已启用邮箱地址别名限制，您的邮箱地址由于包含特殊符号而被拒绝。")
		}
	}
	return nil
}

func SendEmailVerification(c *gin.Context) {
	email := c.Query("email")
	purpose := strings.ToLower(strings.TrimSpace(c.DefaultQuery("purpose", emailVerificationPurposeRegister)))
	if err := common.Validate.Var(email, "required,email"); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := validateEmailDomainPolicy(email, isEmailDomainRestrictionEnabledForPurpose(purpose)); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	if model.IsEmailAlreadyTaken(email) {
		common.ApiErrorI18n(c, i18n.MsgUserEmailAlreadyTaken)
		return
	}
	if err := common.CheckEmailVerificationDailyLimit(email); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	ok, release := common.TryAcquireEmailVerificationSendLock(email)
	if !ok {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "验证码已发送，请 5 分钟后再试",
		})
		return
	}
	code := common.GenerateVerificationCode(6)
	common.RegisterVerificationCodeWithKey(email, code, common.EmailVerificationPurpose)
	err := service.SendTemplatedEmail(
		service.EmailTemplateEventVerification,
		i18n.GetLangFromContext(c),
		email,
		map[string]string{
			"code":                 code,
			"valid_minutes":        fmt.Sprintf("%d", common.VerificationValidMinutes),
			"verification_purpose": purpose,
		},
	)
	if err != nil {
		if errors.Is(err, common.ErrDuplicateEmailSuppressed) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "验证码已发送，请 5 分钟后再试",
			})
			return
		}
		release()
		common.ApiError(c, err)
		return
	}
	common.IncrEmailVerificationDailyCount(email)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

// isEmailDomainAllowed reports whether domain matches any whitelist entry.
// An entry without "*" must match exactly. An entry containing "*" segments
// matches only a domain with the same number of labels, where each "*" matches
// exactly one label (DNS-style: "*.edu.cn" matches "buaa.edu.cn" but not
// "a.b.edu.cn"; "*.*.edu.cn" matches the latter). Matching is case-insensitive.
func isEmailDomainAllowed(domain string, whitelist []string) bool {
	domain = strings.ToLower(strings.TrimSpace(domain))
	domainLabels := strings.Split(domain, ".")
	for _, entry := range whitelist {
		entry = strings.ToLower(strings.TrimSpace(entry))
		if entry == "" {
			continue
		}
		if !strings.Contains(entry, "*") {
			if domain == entry {
				return true
			}
			continue
		}
		patternLabels := strings.Split(entry, ".")
		if len(patternLabels) != len(domainLabels) {
			continue
		}
		matched := true
		for i, pl := range patternLabels {
			if pl == "*" {
				continue
			}
			if domainLabels[i] != pl {
				matched = false
				break
			}
		}
		if matched {
			return true
		}
	}
	return false
}

func SendPasswordResetEmail(c *gin.Context) {
	email := model.NormalizeEmail(c.Query("email"))
	if err := common.Validate.Var(email, "required,email"); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	ok, release := common.TryAcquirePasswordResetSendLock(email)
	if !ok {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
		})
		return
	}
	if user, err := model.GetUniqueUserByEmail(email); err == nil {
		code := common.GenerateVerificationCode(0)
		common.RegisterVerificationCodeWithKey(email, code, common.PasswordResetPurpose)
		link := fmt.Sprintf("%s/user/reset?email=%s&token=%s", strings.TrimRight(system_setting.ServerAddress, "/"), url.QueryEscape(email), url.QueryEscape(code))
		if err := service.SendTemplatedEmail(
			service.EmailTemplateEventPasswordReset,
			user.GetSetting().Language,
			email,
			map[string]string{
				"reset_url":     link,
				"valid_minutes": fmt.Sprintf("%d", common.VerificationValidMinutes),
			},
		); err != nil {
			release()
			logger.LogError(c.Request.Context(), fmt.Sprintf("failed to send password reset email to %s: %s", email, err.Error()))
		}
	} else if err != nil && !errors.Is(err, model.ErrEmailNotFound) {
		release()
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("skip password reset email for %s: %s", email, err.Error()))
	} else {
		release()
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

type PasswordResetRequest struct {
	Email string `json:"email"`
	Token string `json:"token"`
}

func ResetPassword(c *gin.Context) {
	var req PasswordResetRequest
	err := json.NewDecoder(c.Request.Body).Decode(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	req.Email = model.NormalizeEmail(req.Email)
	if req.Email == "" || req.Token == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !common.VerifyCodeWithKey(req.Email, req.Token, common.PasswordResetPurpose) {
		common.ApiErrorI18n(c, i18n.MsgUserPasswordResetLinkInvalid)
		return
	}
	password := common.GenerateVerificationCode(12)
	err = model.ResetUserPasswordByEmail(req.Email, password)
	if err != nil {
		if errors.Is(err, model.ErrEmailNotFound) || errors.Is(err, model.ErrEmailAmbiguous) {
			common.ApiErrorI18n(c, i18n.MsgUserPasswordResetLinkInvalid)
			return
		}
		common.ApiError(c, err)
		return
	}
	common.DeleteKey(req.Email, common.PasswordResetPurpose)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    password,
	})
	return
}
