package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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

func singlePrimaryAPIKeyWarning() string {
	if !common.SinglePrimaryAPIKeyEnabled {
		return ""
	}
	if common.EmailDefaultTokenEnabled {
		return "单主 API Key 模式与旧的邮件发送完整 Key 配置冲突"
	}
	if !common.SMTPConfigured() {
		return "单主 API Key 模式依赖 SMTP 邮件服务，当前配置不完整"
	}
	return ""
}

func GetStatus(c *gin.Context) {

	cs := console_setting.GetConsoleSetting()
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	passkeySetting := system_setting.GetPasskeySettings()
	legalSetting := system_setting.GetLegalSettings()

	data := gin.H{
		"version":                     common.Version,
		"start_time":                  common.StartTime,
		"email_verification":          common.EmailVerificationEnabled,
		"github_oauth":                common.GitHubOAuthEnabled,
		"github_client_id":            common.GitHubClientId,
		"discord_oauth":               system_setting.GetDiscordSettings().Enabled,
		"discord_client_id":           system_setting.GetDiscordSettings().ClientId,
		"linuxdo_oauth":               common.LinuxDOOAuthEnabled,
		"linuxdo_client_id":           common.LinuxDOClientId,
		"linuxdo_minimum_trust_level": common.LinuxDOMinimumTrustLevel,
		"telegram_oauth":              common.TelegramOAuthEnabled,
		"telegram_bot_name":           common.TelegramBotName,
		"theme":                       "default",
		"system_name":                 common.SystemName,
		"logo":                        common.Logo,
		"footer_html":                 common.Footer,
		"wechat_qrcode":               common.WeChatAccountQRCodeImageURL,
		"wechat_login":                common.WeChatAuthEnabled,
		"server_address":              system_setting.ServerAddress,
		"turnstile_check":             common.TurnstileCheckEnabled,
		"turnstile_site_key":          common.TurnstileSiteKey,
		"docs_link":                   operation_setting.GetGeneralSetting().DocsLink,
		"quota_per_unit":              common.QuotaPerUnit,
		// 兼容旧前端：保留 display_in_currency，同时提供新的 quota_display_type
		"display_in_currency":            operation_setting.IsCurrencyDisplay(),
		"quota_display_type":             operation_setting.GetQuotaDisplayType(),
		"custom_currency_symbol":         operation_setting.GetGeneralSetting().CustomCurrencySymbol,
		"custom_currency_exchange_rate":  operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate,
		"enable_batch_update":            common.BatchUpdateEnabled,
		"enable_drawing":                 common.DrawingEnabled,
		"enable_task":                    common.TaskEnabled,
		"enable_data_export":             common.DataExportEnabled,
		"data_export_default_time":       common.DataExportDefaultTime,
		"default_collapse_sidebar":       common.DefaultCollapseSidebar,
		"mj_notify_enabled":              setting.MjNotifyEnabled,
		"chats":                          setting.Chats,
		"demo_site_enabled":              operation_setting.DemoSiteEnabled,
		"self_use_mode_enabled":          operation_setting.SelfUseModeEnabled,
		"register_enabled":               common.RegisterEnabled,
		"password_login_enabled":         common.PasswordLoginEnabled,
		"password_register_enabled":      common.PasswordRegisterEnabled,
		"api_key_login_enabled":          common.APIKeyLoginEnabled || common.SinglePrimaryAPIKeyEnabled,
		"email_default_token_enabled":    common.EmailDefaultTokenEnabled,
		"single_primary_api_key_enabled": common.SinglePrimaryAPIKeyEnabled,
		"single_primary_api_key_ready":   !common.SinglePrimaryAPIKeyEnabled || (common.SMTPConfigured() && !common.EmailDefaultTokenEnabled),
		"single_primary_api_key_warning": singlePrimaryAPIKeyWarning(),
		"default_use_auto_group":         setting.DefaultUseAutoGroup,

		"usd_exchange_rate": operation_setting.USDExchangeRate,
		"price":             operation_setting.Price,
		"stripe_unit_price": setting.StripeUnitPrice,

		// 面板启用开关
		"api_info_enabled":      cs.ApiInfoEnabled,
		"uptime_kuma_enabled":   cs.UptimeKumaEnabled,
		"announcements_enabled": cs.AnnouncementsEnabled,
		"faq_enabled":           cs.FAQEnabled,

		// 模块管理配置
		"HeaderNavModules":    common.OptionMap["HeaderNavModules"],
		"SidebarModulesAdmin": common.OptionMap["SidebarModulesAdmin"],

		"oidc_enabled":                system_setting.GetOIDCSettings().Enabled,
		"oidc_client_id":              system_setting.GetOIDCSettings().ClientId,
		"oidc_authorization_endpoint": system_setting.GetOIDCSettings().AuthorizationEndpoint,
		"oidc_display_name":           system_setting.GetOIDCSettings().GetEffectiveDisplayName(),
		"passkey_login":               passkeySetting.Enabled,
		"passkey_display_name":        passkeySetting.RPDisplayName,
		"passkey_rp_id":               passkeySetting.RPID,
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

func SendEmailVerification(c *gin.Context) {
	email := model.NormalizeEmail(c.Query("email"))
	if err := common.Validate.Var(email, "required,email"); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的邮箱地址",
		})
		return
	}
	localPart := parts[0]
	domainPart := parts[1]
	if common.EmailDomainRestrictionEnabled {
		allowed := false
		for _, domain := range common.EmailDomainWhitelist {
			if domainPart == domain {
				allowed = true
				break
			}
		}
		if !allowed {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "The administrator has enabled the email domain name whitelist, and your email address is not allowed due to special symbols or it's not in the whitelist.",
			})
			return
		}
	}
	if common.EmailAliasRestrictionEnabled {
		containsSpecialSymbols := strings.Contains(localPart, "+") || strings.Contains(localPart, ".")
		if containsSpecialSymbols {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "管理员已启用邮箱地址别名限制，您的邮箱地址由于包含特殊符号而被拒绝。",
			})
			return
		}
	}

	if model.IsEmailAlreadyTaken(email) {
		common.ApiErrorI18n(c, i18n.MsgUserEmailAlreadyTaken)
		return
	}
	code := common.GenerateVerificationCode(6)
	common.RegisterVerificationCodeWithKey(email, code, common.EmailVerificationPurpose)
	subject := fmt.Sprintf("%s邮箱验证邮件", common.SystemName)
	content := fmt.Sprintf("<p>您好，你正在进行%s邮箱验证。</p>"+
		"<p>您的验证码为: <strong>%s</strong></p>"+
		"<p>验证码 %d 分钟内有效，如果不是本人操作，请忽略。</p>", common.SystemName, code, common.VerificationValidMinutes)
	err := common.SendEmail(subject, email, content)
	if err != nil {
		// Do not leave a usable verification code behind when delivery failed.
		common.DeleteKey(email, common.EmailVerificationPurpose)
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func SendPasswordResetEmail(c *gin.Context) {
	email := model.NormalizeEmail(c.Query("email"))
	if err := common.Validate.Var(email, "required,email"); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if _, err := model.GetUniqueUserByEmail(email); err == nil {
		code := common.GenerateVerificationCode(0)
		common.RegisterVerificationCodeWithKey(email, code, common.PasswordResetPurpose)
		link := fmt.Sprintf("%s/user/reset?email=%s&token=%s", system_setting.ServerAddress, email, code)
		subject := fmt.Sprintf("%s密码重置", common.SystemName)
		content := fmt.Sprintf("<p>您好，你正在进行%s密码重置。</p>"+
			"<p>点击 <a href='%s'>此处</a> 进行密码重置。</p>"+
			"<p>如果链接无法点击，请尝试点击下面的链接或将其复制到浏览器中打开：<br> %s </p>"+
			"<p>重置链接 %d 分钟内有效，如果不是本人操作，请忽略。</p>", common.SystemName, link, link, common.VerificationValidMinutes)
		err := common.SendEmail(subject, email, content)
		if err != nil {
			// A failed delivery must not leave a password-reset token usable.
			common.DeleteKey(email, common.PasswordResetPurpose)
			logger.LogError(c.Request.Context(), fmt.Sprintf("failed to send password reset email to %s: %s", email, err.Error()))
		}
	} else if err != nil && !errors.Is(err, model.ErrEmailNotFound) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("skip password reset email for %s: %s", email, err.Error()))
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

// SendAPIKeyResetEmail starts a short-lived, single-use API key recovery flow.
// The response is intentionally identical for known and unknown addresses.
func SendAPIKeyResetEmail(c *gin.Context) {
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0")
	c.Header("Pragma", "no-cache")
	started := time.Now()
	defer func() {
		// Keep the negative path from being trivially distinguishable from the
		// database lookup path. SMTP latency can still exceed this floor.
		const responseFloor = 50 * time.Millisecond
		if elapsed := time.Since(started); elapsed < responseFloor {
			time.Sleep(responseFloor - elapsed)
		}
	}()
	email := model.NormalizeEmail(c.Query("email"))
	if err := common.Validate.Var(email, "required,email"); err == nil && common.SinglePrimaryAPIKeyEnabled {
		if user, err := model.GetUniqueUserByEmail(email); err == nil && user.Status == common.UserStatusEnabled && user.Role == common.RoleCommonUser {
			token, flow, allowed, flowErr := model.CreateAPIKeyResetFlow(user.Id, time.Now().Add(time.Duration(common.VerificationValidMinutes)*time.Minute))
			if flowErr == nil && allowed {
				link := fmt.Sprintf("%s/reset-api-key?email=%s&token=%s", strings.TrimRight(system_setting.ServerAddress, "/"), url.QueryEscape(email), url.QueryEscape(token))
				content := fmt.Sprintf("<p>您好，您正在重置 %s API Key。</p><p>点击 <a href='%s'>此处</a> 完成重置。</p><p>如果链接无法点击，请复制以下地址：<br>%s</p><p>链接 %d 分钟内有效；完成后旧 Key 将立即失效。</p>", common.SystemName, link, link, common.VerificationValidMinutes)
				if err := common.SendEmail(fmt.Sprintf("%s API Key 重置", common.SystemName), email, content); err != nil {
					_ = model.InvalidateAuthFlow(flow.Id)
					logger.LogWarn(c.Request.Context(), fmt.Sprintf("failed to send API key reset email: %v", err))
					model.RecordOperationAuditLog(user.Id, "API key recovery email delivery failed", c.ClientIP(), "user.api_key_recovery_delivery_failed", map[string]interface{}{"user_id": user.Id}, nil, nil)
				}
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

type APIKeyResetRequest struct {
	Email string `json:"email"`
	Token string `json:"token"`
}

// RotatePrimaryAPIKey rotates an authenticated ordinary user's sole API key.
// A live dashboard session alone is insufficient: callers must first present a
// short-lived 2FA/Passkey security proof bound to that session.
func RotatePrimaryAPIKey(c *gin.Context) {
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0")
	if !common.SinglePrimaryAPIKeyEnabled || c.GetInt("role") != common.RoleCommonUser {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "当前账户不支持主 API Key 轮换"})
		return
	}
	if !middleware.RequireSecurityProof(c, securityProofScopePrimaryKeyRotate, []string{secureVerificationMethod2FA, secureVerificationMethodPasskey}) {
		return
	}
	userID := c.GetInt("id")
	token, err := model.RotatePrimaryTokenByUserID(userID)
	if err != nil {
		var deliveryErr *model.PrimaryTokenRotationDeliveryError
		if errors.As(err, &deliveryErr) && deliveryErr.FullKey() != "" {
			model.RecordOperationAuditLog(userID, "Primary API key rotation committed with delivery warning", c.ClientIP(), "user.primary_api_key_rotation_delivery_warning", map[string]interface{}{"user_id": userID}, nil, nil)
			c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{
				"full_key": primaryAPIKeyForUser(deliveryErr.FullKey()),
				"warning":  deliveryErr.Warning(),
			}})
			return
		}
		if token != nil && token.GetFullKey() != "" {
			model.RecordOperationAuditLog(userID, "Primary API key rotation committed with unknown delivery warning", c.ClientIP(), "user.primary_api_key_rotation_delivery_warning", map[string]interface{}{"user_id": userID}, nil, nil)
			c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{
				"full_key": primaryAPIKeyForUser(token.GetFullKey()),
				"warning":  "API Key 已生成，但安全同步尚未完成；请保存此 Key 并重新登录。如无法登录，请使用邮箱找回。",
			}})
			return
		}
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{"full_key": primaryAPIKeyForUser(token.GetFullKey())}})
}

// ResetAPIKey consumes a recovery flow and rotates the user's primary key.
// The full key is returned only in this one response and never sent by email.
func ResetAPIKey(c *gin.Context) {
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0")
	c.Header("Pragma", "no-cache")
	var req APIKeyResetRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	req.Email = model.NormalizeEmail(req.Email)
	if req.Email == "" || req.Token == "" || !common.SinglePrimaryAPIKeyEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserPasswordResetLinkInvalid)
		return
	}
	var rotated *model.Token
	var err error
	flow, err := model.ConsumeAuthFlowWithAction(req.Token, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeAPIKeyReset}, func(tx *gorm.DB, flow *model.AuthFlow) error {
		var user model.User
		if err := tx.Where("id = ? AND LOWER(email) = ?", flow.UserId, req.Email).First(&user).Error; err != nil || user.Status != common.UserStatusEnabled || user.Role != common.RoleCommonUser {
			return model.ErrAuthFlowInvalid
		}
		rotated, err = model.RotatePrimaryTokenByUserIDTx(tx, user.Id)
		if err != nil {
			return err
		}
		_, err = model.IncrementUserAuthVersionWithTx(tx, user.Id)
		return err
	})
	if err != nil || flow == nil || rotated == nil {
		common.ApiErrorI18n(c, i18n.MsgUserPasswordResetLinkInvalid)
		return
	}
	deliveryWarning := ""
	if err := model.FinalizePrimaryTokenRotation(flow.UserId, rotated, "api_key_reset"); err != nil {
		var deliveryErr *model.PrimaryTokenRotationDeliveryError
		if errors.As(err, &deliveryErr) && deliveryErr.FullKey() != "" {
			deliveryWarning = deliveryErr.Warning()
		} else {
			deliveryWarning = "API Key 已生成，但安全同步尚未完成；请保存此 Key 并重新登录。如无法登录，请使用邮箱找回。"
		}
		model.RecordOperationAuditLog(flow.UserId, "API key reset committed with delivery warning", c.ClientIP(), "user.api_key_reset_delivery_warning", map[string]interface{}{"user_id": flow.UserId}, nil, nil)
	}
	model.RecordOperationAuditLog(flow.UserId, "Reset primary API key", c.ClientIP(), "user.api_key_reset", map[string]interface{}{"user_id": flow.UserId}, nil, nil)
	if user, err := model.GetUserById(flow.UserId, false); err == nil && user.Email != "" {
		if err := common.SendEmail(fmt.Sprintf("%s API Key 已重置", common.SystemName), user.Email, "<p>您的 API Key 已重置，旧 Key 已立即失效。如非本人操作，请立即联系管理员。</p>"); err != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("failed to send API key reset notification: %v", err))
		}
	}
	data := gin.H{"full_key": primaryAPIKeyForUser(rotated.GetFullKey())}
	if deliveryWarning != "" {
		data["warning"] = deliveryWarning
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": data})
}
