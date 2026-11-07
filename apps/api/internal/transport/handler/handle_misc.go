package handler

import (
	billing "github.com/QuantumNous/new-api/internal/billing"
	"github.com/QuantumNous/new-api/internal/catalog"
	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/QuantumNous/new-api/internal/dbinfra"
	"github.com/QuantumNous/new-api/internal/egress"
	"github.com/QuantumNous/new-api/internal/homestats"
	"github.com/QuantumNous/new-api/internal/security"
	"github.com/QuantumNous/new-api/internal/security/oauth"
	"github.com/QuantumNous/new-api/internal/settings"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/middleware"
	"github.com/QuantumNous/new-api/internal/usage"
	"net/http"
	"time"
)

func TestStatus(c contract.Context) {
	err := dbinfra.PingDB()
	if err != nil {
		_ = c.JSON(http.StatusServiceUnavailable, common.H{
			"success": false,
			"message": "数据库连接失败",
		})
		return
	}
	// 获取HTTP统计信息
	httpStats := middleware.GetStats()
	_ = c.JSON(http.StatusOK, common.H{
		"success":    true,
		"message":    "Server is running",
		"http_stats": httpStats,
	})
	return
}

func GetStatus(c contract.Context) {

	cs := usage.GetConsoleSetting()
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	passkeySetting := security.GetPasskeySettings()
	legalSetting := security.GetLegalSettings()

	data := common.H{
		"version":                     common.Version,
		"start_time":                  common.StartTime,
		"email_verification":          common.EmailVerificationEnabled,
		"github_oauth":                common.GitHubOAuthEnabled,
		"github_client_id":            common.GitHubClientId,
		"discord_oauth":               security.GetDiscordSettings().Enabled,
		"discord_client_id":           security.GetDiscordSettings().ClientId,
		"linuxdo_oauth":               common.LinuxDOOAuthEnabled,
		"linuxdo_client_id":           common.LinuxDOClientId,
		"linuxdo_minimum_trust_level": common.LinuxDOMinimumTrustLevel,
		"telegram_oauth":              common.TelegramOAuthEnabled,
		"telegram_bot_name":           common.TelegramBotName,
		"theme":                       "default",
		// Pinned theme panel, written by admins through /api/option. Empty means
		// nothing is pinned and the client keeps its own defaults.
		"theme_customization":           common.OptionMap[settings.ThemeCustomizationOptionKey],
		"system_name":                   common.SystemName,
		"logo":                          common.Logo,
		"footer_html":                   common.Footer,
		"wechat_qrcode":                 common.WeChatAccountQRCodeImageURL,
		"wechat_login":                  common.WeChatAuthEnabled,
		"server_address":                egress.ServerAddress,
		"turnstile_check":               common.TurnstileCheckEnabled,
		"turnstile_site_key":            common.TurnstileSiteKey,
		"docs_link":                     billing.GetGeneralSetting().DocsLink,
		"display_in_currency":           billing.IsCurrencyDisplay(),
		"quota_display_type":            billing.GetQuotaDisplayType(),
		"custom_currency_symbol":        billing.GetGeneralSetting().CustomCurrencySymbol,
		"custom_currency_exchange_rate": billing.GetGeneralSetting().CustomCurrencyExchangeRate,
		"amount_name":                   billing.GetGeneralSetting().AmountName,
		"amount_unit":                   billing.GetGeneralSetting().AmountUnitEffective(),
		"inviter_reward_display":        billing.QuotaToDisplayAmount(common.QuotaForInviter),
		"invitee_reward_display":        billing.QuotaToDisplayAmount(common.QuotaForInvitee),
		"display_group_ratio_table":     common.DisplayGroupRatioTable,
		"enable_drawing":                common.DrawingEnabled,
		"enable_task":                   common.TaskEnabled,
		"enable_data_export":            common.DataExportEnabled,
		"data_export_default_time":      common.DataExportDefaultTime,
		"default_collapse_sidebar":      common.DefaultCollapseSidebar,
		"mj_notify_enabled":             usage.MjNotifyEnabled,
		"chats":                         usage.Chats,
		"demo_site_enabled":             channel.DemoSiteEnabled,
		"self_use_mode_enabled":         channel.SelfUseModeEnabled,
		"register_enabled":              common.RegisterEnabled,
		"password_login_enabled":        common.PasswordLoginEnabled,
		"password_register_enabled":     common.PasswordRegisterEnabled,
		"default_use_auto_group":        channel.DefaultUseAutoGroup,

		"usd_exchange_rate": billing.USDExchangeRate,
		"price":             billing.Price,
		"stripe_unit_price": billing.StripeUnitPrice,

		// 面板启用开关
		"api_info_enabled":      cs.ApiInfoEnabled,
		"uptime_kuma_enabled":   cs.UptimeKumaEnabled,
		"announcements_enabled": cs.AnnouncementsEnabled,
		"faq_enabled":           cs.FAQEnabled,

		// 模块管理配置
		"HeaderNavModules":    common.OptionMap["HeaderNavModules"],
		"SidebarModulesAdmin": common.OptionMap["SidebarModulesAdmin"],

		"oidc_enabled":                security.GetOIDCSettings().Enabled,
		"oidc_client_id":              security.GetOIDCSettings().ClientId,
		"oidc_authorization_endpoint": security.GetOIDCSettings().AuthorizationEndpoint,
		"oidc_display_name":           security.GetOIDCSettings().GetEffectiveDisplayName(),
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
		"checkin_enabled":             billing.GetCheckinSetting().Enabled,
		"empty_response_multiplier":   billing.GetQuotaSetting().EmptyResponseMultiplier,
	}

	// 根据启用状态注入可选内容
	if cs.ApiInfoEnabled {
		data["api_info"] = usage.GetApiInfo()
	}
	if cs.AnnouncementsEnabled {
		data["announcements"] = usage.GetAnnouncements()
	}
	if cs.FAQEnabled {
		data["faq"] = usage.GetFAQ()
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

	_ = c.JSON(http.StatusOK, common.H{
		"success": true,
		"message": "",
		"data":    data,
	})
	return
}

func GetNotice(c contract.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	_ = c.JSON(http.StatusOK, common.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["Notice"],
	})
	return
}

func GetAbout(c contract.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	_ = c.JSON(http.StatusOK, common.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["About"],
	})
	return
}

func GetUserAgreement(c contract.Context) {
	_ = c.JSON(http.StatusOK, common.H{
		"success": true,
		"message": "",
		"data":    security.GetLegalSettings().UserAgreement,
	})
	return
}

func GetPrivacyPolicy(c contract.Context) {
	_ = c.JSON(http.StatusOK, common.H{
		"success": true,
		"message": "",
		"data":    security.GetLegalSettings().PrivacyPolicy,
	})
	return
}

func GetMidjourney(c contract.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	_ = c.JSON(http.StatusOK, common.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["Midjourney"],
	})
	return
}

func GetHomePageContent(c contract.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	_ = c.JSON(http.StatusOK, common.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["HomePageContent"],
	})
	return
}

func GetHomeStats(c contract.Context) {
	stats, found := homestats.Latest(c.Context())
	if !found {
		yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		stats = homestats.HomeStats{StatDate: yesterday}
	}
	_ = c.JSON(http.StatusOK, common.H{
		"success": true,
		"data":    stats,
	})
	return
}
