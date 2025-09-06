package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/model"
	"one-api/setting"
	"one-api/setting/ratio_setting"
	"strconv"
	"strings"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

func validUserInfo(username string, role int) bool {
	// check username is empty
	if strings.TrimSpace(username) == "" {
		return false
	}
	if !common.IsValidateRole(role) {
		return false
	}
	return true
}

func authHelper(c *gin.Context, minRole int) {
	session := sessions.Default(c)
	username := session.Get("username")
	role := session.Get("role")
	id := session.Get("id")
	status := session.Get("status")
	useAccessToken := false
	if username == nil {
		// Check access token
		accessToken := c.Request.Header.Get("Authorization")
		if accessToken == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "无权进行此操作，未登录且未提供 access token",
			})
			c.Abort()
			return
		}
		user := model.ValidateAccessToken(accessToken)
		if user != nil && user.Username != "" {
			if !validUserInfo(user.Username, user.Role) {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "无权进行此操作，用户信息无效",
				})
				c.Abort()
				return
			}
			// Token is valid
			username = user.Username
			role = user.Role
			id = user.Id
			status = user.Status
			useAccessToken = true
		} else {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无权进行此操作，access token 无效",
			})
			c.Abort()
			return
		}
	}
	// get header New-Api-User
	apiUserIdStr := c.Request.Header.Get("New-Api-User")
	if apiUserIdStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "无权进行此操作，未提供 New-Api-User",
		})
		c.Abort()
		return
	}
	apiUserId, err := strconv.Atoi(apiUserIdStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "无权进行此操作，New-Api-User 格式错误",
		})
		c.Abort()
		return

	}
	if id != apiUserId {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "无权进行此操作，New-Api-User 与登录用户不匹配",
		})
		c.Abort()
		return
	}
	if status.(int) == common.UserStatusDisabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户已被封禁",
		})
		c.Abort()
		return
	}
	if role.(int) < minRole {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无权进行此操作，权限不足",
		})
		c.Abort()
		return
	}
	if !validUserInfo(username.(string), role.(int)) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无权进行此操作，用户信息无效",
		})
		c.Abort()
		return
	}
	c.Set("username", username)
	c.Set("role", role)
	c.Set("id", id)
	c.Set("group", session.Get("group"))
	c.Set("user_group", session.Get("group"))
	c.Set("use_access_token", useAccessToken)

	//userCache, err := model.GetUserCache(id.(int))
	//if err != nil {
	//	c.JSON(http.StatusOK, gin.H{
	//		"success": false,
	//		"message": err.Error(),
	//	})
	//	c.Abort()
	//	return
	//}
	//userCache.WriteContext(c)

	c.Next()
}

func TryUserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		id := session.Get("id")
		if id != nil {
			c.Set("id", id)
		}
		c.Next()
	}
}

func UserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleCommonUser)
	}
}

func AdminAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleAdminUser)
	}
}

func RootAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleRootUser)
	}
}

func WssAuth(c *gin.Context) {

}

// ModuleAuth 检查用户是否有权限访问特定功能模块
func ModuleAuth(modulePath string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 优先从上游鉴权放入的上下文读取
		userRole := c.GetInt("role")
		userId := c.GetInt("id")
		if userRole == 0 || userId == 0 {
			// 兼容旧流程：再从 session 兜底
			sess := sessions.Default(c)
			if v, ok := sess.Get("role").(int); ok {
				userRole = v
			}
			if v, ok := sess.Get("id").(int); ok {
				userId = v
			}
		}
		// 如果用户未登录，先进行基础认证
		if userRole == 0 || userId == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "未登录，无权访问",
			})
			c.Abort()
			return
		}

		// 超级管理员始终允许访问所有功能
		if userRole >= common.RoleRootUser {
			c.Next()
			return
		}

		// 检查用户是否有权限访问指定模块
		if !hasModulePermission(userRole, userId, modulePath) {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "无权访问此功能模块",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// hasModulePermission 检查用户是否有权限访问指定模块
func hasModulePermission(userRole int, userId int, modulePath string) bool {
	// 普通用户只能访问基础功能
	if userRole < common.RoleAdminUser {
		return isUserModuleAllowed(modulePath)
	}

	// 管理员需要检查侧边栏管理配置
	if userRole >= common.RoleAdminUser && userRole < common.RoleRootUser {
		return isAdminModuleAllowed(modulePath)
	}

	return true
}

// isUserModuleAllowed 检查普通用户是否允许访问指定模块
func isUserModuleAllowed(modulePath string) bool {
	// 数据看板始终允许访问，不受控制台区域开关影响
	if modulePath == "console.detail" {
		return true
	}

	// 普通用户允许访问的模块列表
	allowedModules := map[string]bool{
		"console.detail":     true,
		"console.token":      true,
		"console.log":        true,
		"console.midjourney": true,
		"console.task":       true,
		"personal.topup":     true,
		"personal.personal":  true,
		"chat.playground":    true,
		"chat.chat":          true,
	}

	return allowedModules[modulePath]
}

// isAdminModuleAllowed 检查管理员是否允许访问指定模块
func isAdminModuleAllowed(modulePath string) bool {
	// 数据看板始终允许访问，不受控制台区域开关影响
	if modulePath == "console.detail" {
		return true
	}

	// 获取侧边栏管理配置
	common.OptionMapRWMutex.RLock()
	sidebarConfig, exists := common.OptionMap["SidebarModulesAdmin"]
	common.OptionMapRWMutex.RUnlock()

	if !exists || sidebarConfig == "" {
		// 如果没有配置，默认允许管理员访问所有功能（除了系统设置）
		if modulePath == "admin.setting" {
			return false
		}
		return true
	}

	// 解析配置
	var config map[string]interface{}
	if err := json.Unmarshal([]byte(sidebarConfig), &config); err != nil {
		// 解析失败时采用安全优先策略，拒绝访问
		common.SysLog("解析侧边栏配置失败: " + err.Error())
		return false
	}

	// 检查嵌套权限
	return checkNestedPermission(config, modulePath)
}

// checkNestedPermission 检查嵌套权限路径
func checkNestedPermission(config map[string]interface{}, modulePath string) bool {
	parts := strings.Split(modulePath, ".")
	current := config

	for i, part := range parts {
		if current == nil {
			return false
		}

		value, exists := current[part]
		if !exists {
			return false
		}

		// 如果是最后一个部分，检查布尔值
		if i == len(parts)-1 {
			if boolVal, ok := value.(bool); ok {
				return boolVal
			}
			// 如果是对象且有enabled字段，检查enabled
			if objVal, ok := value.(map[string]interface{}); ok {
				if enabled, hasEnabled := objVal["enabled"]; hasEnabled {
					if enabledBool, ok := enabled.(bool); ok {
						return enabledBool
					}
				}
				// 如果没有enabled字段，默认为true
				return true
			}
			return false
		}

		// 中间路径必须是对象
		if objVal, ok := value.(map[string]interface{}); ok {
			// 检查区域是否启用
			if enabled, hasEnabled := objVal["enabled"]; hasEnabled {
				if enabledBool, ok := enabled.(bool); ok && !enabledBool {
					return false
				}
			}
			current = objVal
		} else {
			return false
		}
	}

	return false
}

func TokenAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		// 先检测是否为ws
		if c.Request.Header.Get("Sec-WebSocket-Protocol") != "" {
			// Sec-WebSocket-Protocol: realtime, openai-insecure-api-key.sk-xxx, openai-beta.realtime-v1
			// read sk from Sec-WebSocket-Protocol
			key := c.Request.Header.Get("Sec-WebSocket-Protocol")
			parts := strings.Split(key, ",")
			for _, part := range parts {
				part = strings.TrimSpace(part)
				if strings.HasPrefix(part, "openai-insecure-api-key") {
					key = strings.TrimPrefix(part, "openai-insecure-api-key.")
					break
				}
			}
			c.Request.Header.Set("Authorization", "Bearer "+key)
		}
		// 检查path包含/v1/messages
		if strings.Contains(c.Request.URL.Path, "/v1/messages") {
			anthropicKey := c.Request.Header.Get("x-api-key")
			if anthropicKey != "" {
				c.Request.Header.Set("Authorization", "Bearer "+anthropicKey)
			}
		}
		// gemini api 从query中获取key
		if strings.HasPrefix(c.Request.URL.Path, "/v1beta/models") ||
			strings.HasPrefix(c.Request.URL.Path, "/v1beta/openai/models") ||
			strings.HasPrefix(c.Request.URL.Path, "/v1/models/") {
			skKey := c.Query("key")
			if skKey != "" {
				c.Request.Header.Set("Authorization", "Bearer "+skKey)
			}
			// 从x-goog-api-key header中获取key
			xGoogKey := c.Request.Header.Get("x-goog-api-key")
			if xGoogKey != "" {
				c.Request.Header.Set("Authorization", "Bearer "+xGoogKey)
			}
		}
		key := c.Request.Header.Get("Authorization")
		parts := make([]string, 0)
		key = strings.TrimPrefix(key, "Bearer ")
		if key == "" || key == "midjourney-proxy" {
			key = c.Request.Header.Get("mj-api-secret")
			key = strings.TrimPrefix(key, "Bearer ")
			key = strings.TrimPrefix(key, "sk-")
			parts = strings.Split(key, "-")
			key = parts[0]
		} else {
			key = strings.TrimPrefix(key, "sk-")
			parts = strings.Split(key, "-")
			key = parts[0]
		}
		token, err := model.ValidateUserToken(key)
		if token != nil {
			id := c.GetInt("id")
			if id == 0 {
				c.Set("id", token.UserId)
			}
		}
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusUnauthorized, err.Error())
			return
		}

		allowIpsMap := token.GetIpLimitsMap()
		if len(allowIpsMap) != 0 {
			clientIp := c.ClientIP()
			if _, ok := allowIpsMap[clientIp]; !ok {
				abortWithOpenAiMessage(c, http.StatusForbidden, "您的 IP 不在令牌允许访问的列表中")
				return
			}
		}

		userCache, err := model.GetUserCache(token.UserId)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, err.Error())
			return
		}
		userEnabled := userCache.Status == common.UserStatusEnabled
		if !userEnabled {
			abortWithOpenAiMessage(c, http.StatusForbidden, "用户已被封禁")
			return
		}

		userCache.WriteContext(c)

		userGroup := userCache.Group
		tokenGroup := token.Group
		if tokenGroup != "" {
			// check common.UserUsableGroups[userGroup]
			if _, ok := setting.GetUserUsableGroups(userGroup)[tokenGroup]; !ok {
				abortWithOpenAiMessage(c, http.StatusForbidden, fmt.Sprintf("令牌分组 %s 已被禁用", tokenGroup))
				return
			}
			// check group in common.GroupRatio
			if !ratio_setting.ContainsGroupRatio(tokenGroup) {
				if tokenGroup != "auto" {
					abortWithOpenAiMessage(c, http.StatusForbidden, fmt.Sprintf("分组 %s 已被弃用", tokenGroup))
					return
				}
			}
			userGroup = tokenGroup
		}
		common.SetContextKey(c, constant.ContextKeyUsingGroup, userGroup)

		err = SetupContextForToken(c, token, parts...)
		if err != nil {
			return
		}
		c.Next()
	}
}

func SetupContextForToken(c *gin.Context, token *model.Token, parts ...string) error {
	if token == nil {
		return fmt.Errorf("token is nil")
	}
	c.Set("id", token.UserId)
	c.Set("token_id", token.Id)
	c.Set("token_key", token.Key)
	c.Set("token_name", token.Name)
	c.Set("token_unlimited_quota", token.UnlimitedQuota)
	if !token.UnlimitedQuota {
		c.Set("token_quota", token.RemainQuota)
	}
	if token.ModelLimitsEnabled {
		c.Set("token_model_limit_enabled", true)
		c.Set("token_model_limit", token.GetModelLimitsMap())
	} else {
		c.Set("token_model_limit_enabled", false)
	}
	c.Set("token_group", token.Group)
	if len(parts) > 1 {
		if model.IsAdmin(token.UserId) {
			c.Set("specific_channel_id", parts[1])
		} else {
			abortWithOpenAiMessage(c, http.StatusForbidden, "普通用户不支持指定渠道")
			return fmt.Errorf("普通用户不支持指定渠道")
		}
	}
	return nil
}
