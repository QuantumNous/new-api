package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/middleware"
	"one-api/model"
	"one-api/setting"
	"one-api/setting/console_setting"
	"one-api/setting/operation_setting"
	"one-api/setting/system_setting"
	"strings"

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
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	// 获取用户角色信息（如果已登录）
	var userRole int = -1
	if role := c.GetInt("role"); role > 0 {
		userRole = role
	}

	data := gin.H{
		"version":                     common.Version,
		"start_time":                  common.StartTime,
		"email_verification":          common.EmailVerificationEnabled,
		"github_oauth":                common.GitHubOAuthEnabled,
		"github_client_id":            common.GitHubClientId,
		"linuxdo_oauth":               common.LinuxDOOAuthEnabled,
		"linuxdo_client_id":           common.LinuxDOClientId,
		"linuxdo_minimum_trust_level": common.LinuxDOMinimumTrustLevel,
		"telegram_oauth":              common.TelegramOAuthEnabled,
		"telegram_bot_name":           common.TelegramBotName,
		"system_name":                 common.SystemName,
		"logo":                        common.Logo,
		"footer_html":                 common.Footer,
		"wechat_qrcode":               common.WeChatAccountQRCodeImageURL,
		"wechat_login":                common.WeChatAuthEnabled,
		"server_address":              system_setting.ServerAddress,
		"turnstile_check":             common.TurnstileCheckEnabled,
		"turnstile_site_key":          common.TurnstileSiteKey,
		"top_up_link":                 common.TopUpLink,
		"docs_link":                   operation_setting.GetGeneralSetting().DocsLink,
		"quota_per_unit":              common.QuotaPerUnit,
		"display_in_currency":         common.DisplayInCurrencyEnabled,
		"enable_batch_update":         common.BatchUpdateEnabled,
		"enable_drawing":              common.DrawingEnabled,
		"enable_task":                 common.TaskEnabled,
		"enable_data_export":          common.DataExportEnabled,
		"data_export_default_time":    common.DataExportDefaultTime,
		"default_collapse_sidebar":    common.DefaultCollapseSidebar,
		"mj_notify_enabled":           setting.MjNotifyEnabled,
		"chats":                       setting.Chats,
		"demo_site_enabled":           operation_setting.DemoSiteEnabled,
		"self_use_mode_enabled":       operation_setting.SelfUseModeEnabled,
		"default_use_auto_group":      setting.DefaultUseAutoGroup,

		"usd_exchange_rate": operation_setting.USDExchangeRate,
		"price":             operation_setting.Price,
		"stripe_unit_price": setting.StripeUnitPrice,

		// 面板启用开关
		"api_info_enabled":      cs.ApiInfoEnabled,
		"uptime_kuma_enabled":   cs.UptimeKumaEnabled,
		"announcements_enabled": cs.AnnouncementsEnabled,
		"faq_enabled":           cs.FAQEnabled,

		// 模块管理配置 - 根据用户权限过滤
		"header_nav_modules": filterHeaderNavModulesForUser(common.OptionMap["HeaderNavModules"], userRole),

		"oidc_enabled":                system_setting.GetOIDCSettings().Enabled,
		"oidc_client_id":              system_setting.GetOIDCSettings().ClientId,
		"oidc_authorization_endpoint": system_setting.GetOIDCSettings().AuthorizationEndpoint,
		"setup":                       constant.Setup,
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
	email := c.Query("email")
	if err := common.Validate.Var(email, "required,email"); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
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
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "邮箱地址已被占用",
		})
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
	email := c.Query("email")
	if err := common.Validate.Var(email, "required,email"); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	if !model.IsEmailAlreadyTaken(email) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该邮箱地址未注册",
		})
		return
	}
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
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

type PasswordResetRequest struct {
	Email string `json:"email"`
	Token string `json:"token"`
}

func ResetPassword(c *gin.Context) {
	var req PasswordResetRequest
	err := json.NewDecoder(c.Request.Body).Decode(&req)
	if req.Email == "" || req.Token == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	if !common.VerifyCodeWithKey(req.Email, req.Token, common.PasswordResetPurpose) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "重置链接非法或已过期",
		})
		return
	}
	password := common.GenerateVerificationCode(12)
	err = model.ResetUserPasswordByEmail(req.Email, password)
	if err != nil {
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

// filterHeaderNavModulesForUser 根据用户权限过滤顶栏模块配置
func filterHeaderNavModulesForUser(headerNavModulesRaw interface{}, userRole int) interface{} {
	// 如果配置为空，返回原配置
	if headerNavModulesRaw == nil {
		return headerNavModulesRaw
	}

	headerNavModulesStr, ok := headerNavModulesRaw.(string)
	if !ok || headerNavModulesStr == "" {
		return headerNavModulesRaw
	}

	// 解析配置
	var config map[string]interface{}
	if err := json.Unmarshal([]byte(headerNavModulesStr), &config); err != nil {
		// 解析失败时返回空配置，采用安全优先策略
		return "{}"
	}

	// 对于所有用户（包括未登录用户），都需要移除被禁用的模块
	filteredConfig := make(map[string]interface{})
	for key, value := range config {
		// 首先检查模块是否启用
		if isHeaderNavModuleEnabled(key, value) {
			// 未登录用户：仅移除被禁用的模块，保留启用模块（包括 pricing，以便前端根据 requireAuth 决定跳转到 /login）
			if userRole == -1 {
				filteredConfig[key] = value
				continue
			}

			// 超级管理员可以看到所有启用的模块
			if userRole >= common.RoleRootUser {
				filteredConfig[key] = value
			} else {
				// 管理员和普通用户：进行权限检查
				if hasHeaderNavModulePermission(key, value, userRole) {
					filteredConfig[key] = value
				}
			}
		}
		// 被禁用的模块（isHeaderNavModuleEnabled返回false）不会被添加到filteredConfig中
	}

	// 转换回JSON字符串
	filteredBytes, err := json.Marshal(filteredConfig)
	if err != nil {
		return "{}"
	}

	return string(filteredBytes)
}

// FilterSidebarModulesAdminForUser 根据用户权限过滤侧边栏管理配置
func FilterSidebarModulesAdminForUser(sidebarModulesRaw interface{}, userRole int) interface{} {
	// 如果用户未登录，返回空配置以保护敏感信息
	if userRole == -1 {
		return "{}"
	}

	if sidebarModulesRaw == nil {
		return sidebarModulesRaw
	}

	sidebarModulesStr, ok := sidebarModulesRaw.(string)
	if !ok || sidebarModulesStr == "" {
		return sidebarModulesRaw
	}

	// 解析配置
	var config map[string]interface{}
	if err := json.Unmarshal([]byte(sidebarModulesStr), &config); err != nil {
		// 解析失败时返回空配置，采用安全优先策略
		return "{}"
	}



	// 对于所有用户，移除被禁用的模块
	filteredConfig := make(map[string]interface{})
	for sectionKey, sectionValue := range config {
		if sectionObj, ok := sectionValue.(map[string]interface{}); ok {
			// 检查区域是否启用
			sectionEnabledByConfig := true
			if enabled, hasEnabled := sectionObj["enabled"]; hasEnabled {
				if enabledBool, ok := enabled.(bool); ok && !enabledBool {
					sectionEnabledByConfig = false
				}
			}

			// 如果区域被配置为禁用，跳过整个区域（但console区域需要特殊处理，因为数据看板始终可访问）
			if !sectionEnabledByConfig && sectionKey != "console" {
				continue
			}

			filteredSection := make(map[string]interface{})
			hasValidModules := false // 标记区域是否有有效的模块

			// 复制区域配置
			for moduleKey, moduleValue := range sectionObj {
				// 检查用户是否有权限访问此模块
				modulePath := sectionKey + "." + moduleKey

				// 数据看板始终允许访问，强制设置为启用
				if modulePath == "console.detail" {
					filteredSection[moduleKey] = true
					hasValidModules = true
				} else if moduleKey == "enabled" {
					// 只有当区域启用时才复制enabled字段
					if sectionEnabledByConfig {
						filteredSection[moduleKey] = moduleValue
					}
				} else if sectionEnabledByConfig && hasModulePermissionForUser(userRole, modulePath, moduleValue) {
					// 处理嵌套权限（如admin.user.groupManagement）
					if moduleObj, ok := moduleValue.(map[string]interface{}); ok {
						filteredModule := make(map[string]interface{})

						// 首先检查模块本身是否启用
						if enabled, hasEnabled := moduleObj["enabled"]; hasEnabled {
							if enabledBool, ok := enabled.(bool); ok && !enabledBool {
								continue // 跳过被禁用的模块
							}
							filteredModule["enabled"] = enabled
						}

						// 过滤子模块
						for subKey, subValue := range moduleObj {
							if subKey == "enabled" {
								continue // enabled字段已经处理过了
							}

							subModulePath := modulePath + "." + subKey

							// 检查子模块是否启用
							if subValueBool, ok := subValue.(bool); ok && !subValueBool {
								continue // 跳过被禁用的子模块
							}

							if hasModulePermissionForUser(userRole, subModulePath, subValue) {
								filteredModule[subKey] = subValue
							}
						}

						// 只有当过滤后的模块不为空时才添加
						if len(filteredModule) > 0 {
							filteredSection[moduleKey] = filteredModule
							hasValidModules = true
						}
					} else {
						// 检查简单模块值是否启用
						if moduleValueBool, ok := moduleValue.(bool); ok && !moduleValueBool {
							continue // 跳过被禁用的简单模块
						}
						filteredSection[moduleKey] = moduleValue
						hasValidModules = true
					}
				}
			}

			// 只有当区域有有效模块时才添加到结果中
			if hasValidModules && len(filteredSection) > 0 {
				filteredConfig[sectionKey] = filteredSection
			}
		}
	}

	// 转换回JSON字符串
	filteredBytes, err := json.Marshal(filteredConfig)
	if err != nil {
		return "{}"
	}

	return string(filteredBytes)
}

// isHeaderNavModuleEnabled 检查顶栏模块是否启用
func isHeaderNavModuleEnabled(moduleKey string, moduleValue interface{}) bool {
	switch v := moduleValue.(type) {
	case bool:
		return v
	case map[string]interface{}:
		if enabled, hasEnabled := v["enabled"]; hasEnabled {
			if enabledBool, ok := enabled.(bool); ok {
				return enabledBool
			}
		}
		return true // 如果没有enabled字段，默认启用
	default:
		return true
	}
}

// hasHeaderNavModulePermission 检查用户是否有权限访问顶栏模块
func hasHeaderNavModulePermission(moduleKey string, moduleValue interface{}, userRole int) bool {
	// 对于模型广场，需要检查requireAuth配置
	if moduleKey == "pricing" {
		return checkPricingModulePermission(moduleValue, userRole)
	}

	// 未登录用户和普通用户只能访问基础模块
	if userRole < common.RoleAdminUser {
		allowedModules := map[string]bool{
			"home":    true,
			"console": true,
			"docs":    true, // 文档允许未登录用户访问
			"about":   true, // 关于页面允许未登录用户访问
		}
		return allowedModules[moduleKey]
	}

	// 管理员可以访问更多模块
	return true
}

// checkPricingModulePermission 检查模型广场模块的权限
func checkPricingModulePermission(moduleValue interface{}, userRole int) bool {
	// 如果是布尔值配置，默认不需要登录
	if boolValue, ok := moduleValue.(bool); ok {
		return boolValue // 简单的启用/禁用
	}

	// 如果是对象配置，检查requireAuth设置
	if objValue, ok := moduleValue.(map[string]interface{}); ok {
		// 检查模块是否启用
		if enabled, hasEnabled := objValue["enabled"]; hasEnabled {
			if enabledBool, ok := enabled.(bool); ok && !enabledBool {
				return false // 模块被禁用
			}
		}

		// 检查是否需要登录
		if requireAuth, hasRequireAuth := objValue["requireAuth"]; hasRequireAuth {
			if requireAuthBool, ok := requireAuth.(bool); ok && requireAuthBool {
				// 需要登录才能访问，未登录用户不能访问
				return userRole >= common.RoleCommonUser
			}
		}

		// 默认不需要登录
		return true
	}

	// 其他情况默认允许
	return true
}

// hasModulePermissionForUser 检查用户是否有权限访问指定模块
func hasModulePermissionForUser(userRole int, modulePath string, moduleValue interface{}) bool {
	// 数据看板始终允许访问，不受控制台区域开关影响
	if modulePath == "console.detail" {
		return true
	}

	// 普通用户只能访问基础功能
	if userRole < common.RoleAdminUser {
		return isUserModuleAllowedInFilter(modulePath)
	}

	// 管理员需要检查模块是否启用
	if userRole >= common.RoleAdminUser && userRole < common.RoleRootUser {
		// 检查模块值是否为启用状态
		switch v := moduleValue.(type) {
		case bool:
			return v
		case map[string]interface{}:
			if enabled, hasEnabled := v["enabled"]; hasEnabled {
				if enabledBool, ok := enabled.(bool); ok {
					return enabledBool
				}
			}
			return true // 如果没有enabled字段，默认启用
		default:
			return true
		}
	}

	return true
}

// isUserModuleAllowedInFilter 检查普通用户是否允许访问指定模块（用于过滤）
func isUserModuleAllowedInFilter(modulePath string) bool {
	// 数据看板始终允许访问，不受控制台区域开关影响
	if modulePath == "console.detail" {
		return true
	}

	// 普通用户允许访问的模块列表
	allowedModules := map[string]bool{
		"console.enabled":    true,
		"console.detail":     true,
		"console.token":      true,
		"console.log":        true,
		"console.midjourney": true,
		"console.task":       true,
		"personal.enabled":   true,
		"personal.topup":     true,
		"personal.personal":  true,
		"chat.enabled":       true,
		"chat.playground":    true,
		"chat.chat":          true,
	}

	return allowedModules[modulePath]
}
