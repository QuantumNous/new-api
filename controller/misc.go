package controller

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/go-fuego/fuego"
)

func TestStatus(c fuego.ContextNoBody) (*dto.Response[dto.TestStatusData], error) {
	err := model.PingDB()
	if err != nil {
		return dto.Fail[dto.TestStatusData]("数据库连接失败")
	}
	// 获取HTTP统计信息
	httpStats := middleware.GetStats()
	return dto.Ok(dto.TestStatusData{HttpStats: httpStats})
}

func GetStatus(c fuego.ContextNoBody) (*dto.Response[dto.StatusData], error) {
	cs := console_setting.GetConsoleSetting()
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	passkeySetting := system_setting.GetPasskeySettings()
	legalSetting := system_setting.GetLegalSettings()

	data := dto.StatusData{
		Version:                    common.Version,
		StartTime:                  common.StartTime,
		EmailVerification:          common.EmailVerificationEnabled,
		GitHubOAuth:                common.GitHubOAuthEnabled,
		GitHubClientId:             common.GitHubClientId,
		DiscordOAuth:               system_setting.GetDiscordSettings().Enabled,
		DiscordClientId:            system_setting.GetDiscordSettings().ClientId,
		LinuxDOOAuth:               common.LinuxDOOAuthEnabled,
		LinuxDOClientId:            common.LinuxDOClientId,
		LinuxDOMinimumTrustLevel:   common.LinuxDOMinimumTrustLevel,
		TelegramOAuth:              common.TelegramOAuthEnabled,
		TelegramBotName:            common.TelegramBotName,
		SystemName:                 common.SystemName,
		Logo:                       common.Logo,
		FooterHtml:                 common.Footer,
		WeChatQrcode:               common.WeChatAccountQRCodeImageURL,
		WeChatLogin:                common.WeChatAuthEnabled,
		ServerAddress:              system_setting.ServerAddress,
		TurnstileCheck:             common.TurnstileCheckEnabled,
		TurnstileSiteKey:           common.TurnstileSiteKey,
		TopUpLink:                  common.TopUpLink,
		DocsLink:                   operation_setting.GetGeneralSetting().DocsLink,
		QuotaPerUnit:               common.QuotaPerUnit,
		// 兼容旧前端：保留 display_in_currency，同时提供新的 quota_display_type
		DisplayInCurrency:          operation_setting.IsCurrencyDisplay(),
		QuotaDisplayType:           operation_setting.GetQuotaDisplayType(),
		CustomCurrencySymbol:       operation_setting.GetGeneralSetting().CustomCurrencySymbol,
		CustomCurrencyExchangeRate: operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate,
		EnableBatchUpdate:          common.BatchUpdateEnabled,
		EnableDrawing:              common.DrawingEnabled,
		EnableTask:                 common.TaskEnabled,
		EnableDataExport:           common.DataExportEnabled,
		DataExportDefaultTime:      common.DataExportDefaultTime,
		DefaultCollapseSidebar:     common.DefaultCollapseSidebar,
		MjNotifyEnabled:            setting.MjNotifyEnabled,
		Chats:                      setting.Chats,
		DemoSiteEnabled:            operation_setting.DemoSiteEnabled,
		SelfUseModeEnabled:         operation_setting.SelfUseModeEnabled,
		DefaultUseAutoGroup:        setting.DefaultUseAutoGroup,
		UsdExchangeRate:            operation_setting.USDExchangeRate,
		Price:                      operation_setting.Price,
		StripeUnitPrice:            setting.StripeUnitPrice,
		// 面板启用开关
		ApiInfoEnabled:             cs.ApiInfoEnabled,
		UptimeKumaEnabled:          cs.UptimeKumaEnabled,
		AnnouncementsEnabled:       cs.AnnouncementsEnabled,
		FaqEnabled:                 cs.FAQEnabled,
		// 模块管理配置
		HeaderNavModules:           common.OptionMap["HeaderNavModules"],
		SidebarModulesAdmin:        common.OptionMap["SidebarModulesAdmin"],
		OidcEnabled:                system_setting.GetOIDCSettings().Enabled,
		OidcClientId:               system_setting.GetOIDCSettings().ClientId,
		OidcAuthorizationEndpoint:  system_setting.GetOIDCSettings().AuthorizationEndpoint,
		PasskeyLogin:               passkeySetting.Enabled,
		PasskeyDisplayName:         passkeySetting.RPDisplayName,
		PasskeyRpId:                passkeySetting.RPID,
		PasskeyOrigins:             passkeySetting.Origins,
		PasskeyAllowInsecure:       passkeySetting.AllowInsecureOrigin,
		PasskeyUserVerification:    passkeySetting.UserVerification,
		PasskeyAttachment:          passkeySetting.AttachmentPreference,
		Setup:                      constant.Setup,
		UserAgreementEnabled:       legalSetting.UserAgreement != "",
		PrivacyPolicyEnabled:       legalSetting.PrivacyPolicy != "",
		CheckinEnabled:             operation_setting.GetCheckinSetting().Enabled,
		QN:                         "new-api",
	}

	// 根据启用状态注入可选内容
	if cs.ApiInfoEnabled {
		data.ApiInfo = console_setting.GetApiInfo()
	}
	if cs.AnnouncementsEnabled {
		data.Announcements = console_setting.GetAnnouncements()
	}
	if cs.FAQEnabled {
		data.FAQ = console_setting.GetFAQ()
	}

	// Add enabled custom OAuth providers
	customProviders := oauth.GetEnabledCustomProviders()
	if len(customProviders) > 0 {
		providersInfo := make([]dto.CustomOAuthInfo, 0, len(customProviders))
		for _, p := range customProviders {
			config := p.GetConfig()
			providersInfo = append(providersInfo, dto.CustomOAuthInfo{
				Id:                    config.Id,
				Name:                  config.Name,
				Slug:                  config.Slug,
				Icon:                  config.Icon,
				ClientId:              config.ClientId,
				AuthorizationEndpoint: config.AuthorizationEndpoint,
				Scopes:                config.Scopes,
			})
		}
		data.CustomOAuthProviders = providersInfo
	}

	return dto.Ok(data)
}

func GetNotice(c fuego.ContextNoBody) (*dto.Response[string], error) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return dto.Ok(common.Interface2String(common.OptionMap["Notice"]))
}

func GetAbout(c fuego.ContextNoBody) (*dto.Response[string], error) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return dto.Ok(common.Interface2String(common.OptionMap["About"]))
}

func GetUserAgreement(c fuego.ContextNoBody) (*dto.Response[string], error) {
	return dto.Ok(system_setting.GetLegalSettings().UserAgreement)
}

func GetPrivacyPolicy(c fuego.ContextNoBody) (*dto.Response[string], error) {
	return dto.Ok(system_setting.GetLegalSettings().PrivacyPolicy)
}

func GetMidjourney(c fuego.ContextNoBody) (*dto.Response[string], error) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return dto.Ok(common.Interface2String(common.OptionMap["Midjourney"]))
}

func GetHomePageContent(c fuego.ContextNoBody) (*dto.Response[string], error) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return dto.Ok(common.Interface2String(common.OptionMap["HomePageContent"]))
}

func SendEmailVerification(c fuego.ContextWithParams[dto.EmailParams]) (dto.MessageResponse, error) {
	p, err := dto.ParseParams[dto.EmailParams](c)
	if err != nil {
		return dto.FailMsg("无效的参数")
	}
	if err := common.Validate.Var(p.Email, "required,email"); err != nil {
		return dto.FailMsg("无效的参数")
	}
	parts := strings.Split(p.Email, "@")
	if len(parts) != 2 {
		return dto.FailMsg("无效的邮箱地址")
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
			return dto.FailMsg("The administrator has enabled the email domain name whitelist, and your email address is not allowed due to special symbols or it's not in the whitelist.")
		}
	}
	if common.EmailAliasRestrictionEnabled {
		containsSpecialSymbols := strings.Contains(localPart, "+") || strings.Contains(localPart, ".")
		if containsSpecialSymbols {
			return dto.FailMsg("管理员已启用邮箱地址别名限制，您的邮箱地址由于包含特殊符号而被拒绝。")
		}
	}

	if model.IsEmailAlreadyTaken(p.Email) {
		return dto.FailMsg("邮箱地址已被占用")
	}
	code := common.GenerateVerificationCode(6)
	common.RegisterVerificationCodeWithKey(p.Email, code, common.EmailVerificationPurpose)
	subject := fmt.Sprintf("%s邮箱验证邮件", common.SystemName)
	content := fmt.Sprintf("<p>您好，你正在进行%s邮箱验证。</p>"+
		"<p>您的验证码为: <strong>%s</strong></p>"+
		"<p>验证码 %d 分钟内有效，如果不是本人操作，请忽略。</p>", common.SystemName, code, common.VerificationValidMinutes)
	err = common.SendEmail(subject, p.Email, content)
	if err != nil {
		common.SysError("failed to send email verification: " + err.Error())
		return dto.FailMsg("发送邮件失败，请稍后再试")
	}
	return dto.Msg("")
}

func SendPasswordResetEmail(c fuego.ContextWithParams[dto.EmailParams]) (dto.MessageResponse, error) {
	p, err := dto.ParseParams[dto.EmailParams](c)
	if err != nil {
		return dto.FailMsg("无效的参数")
	}
	if err := common.Validate.Var(p.Email, "required,email"); err != nil {
		return dto.FailMsg("无效的参数")
	}
	if !model.IsEmailAlreadyTaken(p.Email) {
		return dto.FailMsg("该邮箱地址未注册")
	}
	code := common.GenerateVerificationCode(0)
	common.RegisterVerificationCodeWithKey(p.Email, code, common.PasswordResetPurpose)
	link := fmt.Sprintf("%s/user/reset?email=%s&token=%s", system_setting.ServerAddress, url.QueryEscape(p.Email), url.QueryEscape(code))
	subject := fmt.Sprintf("%s密码重置", common.SystemName)
	content := fmt.Sprintf("<p>您好，你正在进行%s密码重置。</p>"+
		"<p>点击 <a href='%s'>此处</a> 进行密码重置。</p>"+
		"<p>如果链接无法点击，请尝试点击下面的链接或将其复制到浏览器中打开：<br> %s </p>"+
		"<p>重置链接 %d 分钟内有效，如果不是本人操作，请忽略。</p>", common.SystemName, link, link, common.VerificationValidMinutes)
	err = common.SendEmail(subject, p.Email, content)
	if err != nil {
		common.SysError("failed to send password reset email: " + err.Error())
		return dto.FailMsg("发送邮件失败，请稍后再试")
	}
	return dto.Msg("")
}

func ResetPassword(c fuego.ContextWithBody[dto.PasswordResetRequest]) (*dto.Response[string], error) {
	req, err := c.Body()
	if err != nil || req.Email == "" || req.Token == "" {
		return dto.Fail[string]("无效的参数")
	}
	if !common.VerifyCodeWithKey(req.Email, req.Token, common.PasswordResetPurpose) {
		return dto.Fail[string]("重置链接非法或已过期")
	}
	password := common.GenerateVerificationCode(12)
	err = model.ResetUserPasswordByEmail(req.Email, password)
	if err != nil {
		common.SysError("failed to reset password for " + req.Email + ": " + err.Error())
		return dto.Fail[string]("重置密码失败，请稍后再试")
	}
	common.DeleteKey(req.Email, common.PasswordResetPurpose)
	return dto.Ok(password)
}
