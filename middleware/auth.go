package middleware

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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

func disabledUserMessage(c *gin.Context, reason string) string {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return common.TranslateMessage(c, i18n.MsgAuthUserBanned)
	}
	return common.TranslateMessage(c, i18n.MsgUserDisabledWithReason, map[string]any{
		"Reason": reason,
	})
}

func disabledUserBusinessResponse(c *gin.Context, reason string, disabledUntil int64, userId int, username string) {
	reason = strings.TrimSpace(reason)
	message := disabledUserMessage(c, reason)
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": message,
		"data": gin.H{
			"error_type":     "user_disabled",
			"disable_reason": reason,
			"disabled_until": disabledUntil,
			"user_id":        userId,
			"username":       username,
		},
	})
	c.Abort()
}

func resolveTokenUsingGroup(userGroup, tokenGroup string, userUsableGroups map[string]string) (string, bool) {
	if tokenGroup == "" {
		return userGroup, true
	}
	if tokenGroup == "auto" {
		return tokenGroup, true
	}
	if _, ok := userUsableGroups[tokenGroup]; !ok {
		return "", false
	}
	return tokenGroup, true
}

func formatAvailableGroups(userUsableGroups map[string]string) string {
	if len(userUsableGroups) == 0 {
		return "无"
	}
	groups := make([]string, 0, len(userUsableGroups))
	for group := range userUsableGroups {
		groups = append(groups, group)
	}
	sort.Strings(groups)
	return strings.Join(groups, "、")
}

func requiresGitHubEmailRelogin(user *model.UserBase) bool {
	return user != nil &&
		strings.TrimSpace(user.GitHubId) != "" &&
		model.NormalizeEmail(user.Email) == ""
}

func clearGitHubEmailReloginSession(session sessions.Session) {
	session.Clear()
	if err := session.Save(); err != nil {
		common.SysLog("failed to clear GitHub email relogin session: " + err.Error())
	}
}

func sessionRequiresGitHubEmailRelogin(session sessions.Session, user *model.UserBase) bool {
	return requiresGitHubEmailRelogin(user)
}

func authHelper(c *gin.Context, minRole int) {
	session := sessions.Default(c)
	usernameValue := session.Get("username")
	roleValue := session.Get("role")
	idValue := session.Get("id")
	statusValue := session.Get("status")
	groupValue := session.Get("group")
	disableReason := ""
	disabledUntil := int64(0)
	useAccessToken := false
	if usernameValue == nil {
		// Check access token
		accessToken := c.Request.Header.Get("Authorization")
		if accessToken == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgAuthNotLoggedIn),
			})
			c.Abort()
			return
		}
		user, authErr := model.ValidateAccessToken(accessToken)
		if authErr != nil {
			if errors.Is(authErr, model.ErrDatabase) {
				common.SysLog("ValidateAccessToken database error: " + authErr.Error())
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": common.TranslateMessage(c, i18n.MsgDatabaseError),
				})
			} else {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": common.TranslateMessage(c, i18n.MsgAuthAccessTokenInvalid),
				})
			}
			c.Abort()
			return
		}
		if user != nil && user.Username != "" {
			if !validUserInfo(user.Username, user.Role) {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid),
				})
				c.Abort()
				return
			}
			// Token is valid
			usernameValue = user.Username
			roleValue = user.Role
			idValue = user.Id
			statusValue = user.Status
			groupValue = user.Group
			disableReason = user.DisableReason
			disabledUntil = user.DisabledUntil
			useAccessToken = true
		} else {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgAuthAccessTokenInvalid),
			})
			c.Abort()
			return
		}
	}
	username, ok := usernameValue.(string)
	if !ok {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid),
		})
		c.Abort()
		return
	}
	role, ok := roleValue.(int)
	if !ok {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid),
		})
		c.Abort()
		return
	}
	id, ok := idValue.(int)
	if !ok {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid),
		})
		c.Abort()
		return
	}
	status, ok := statusValue.(int)
	if !ok {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid),
		})
		c.Abort()
		return
	}
	group, _ := groupValue.(string)

	// get header New-Api-User
	apiUserIdStr := c.Request.Header.Get("New-Api-User")
	if apiUserIdStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthUserIdNotProvided),
		})
		c.Abort()
		return
	}
	apiUserId, err := strconv.Atoi(apiUserIdStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthUserIdFormatError),
		})
		c.Abort()
		return
	}
	if id != apiUserId {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthUserIdMismatch),
		})
		c.Abort()
		return
	}

	if !useAccessToken {
		userCache, err := model.GetUserCache(id)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusUnauthorized, gin.H{
					"success": false,
					"message": common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid),
				})
				c.Abort()
				return
			}
			common.SysLog(fmt.Sprintf("authHelper GetUserCache error for user %d: %v", id, err))
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgDatabaseError),
			})
			c.Abort()
			return
		}
		if sessionRequiresGitHubEmailRelogin(session, userCache) {
			clearGitHubEmailReloginSession(session)
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgAuthOAuthEmailRepair),
			})
			c.Abort()
			return
		}
		username = userCache.Username
		role = userCache.Role
		status = userCache.Status
		group = userCache.Group
		disableReason = userCache.DisableReason
		disabledUntil = userCache.DisabledUntil
	}

	if status == common.UserStatusDisabled {
		disabledUserBusinessResponse(c, disableReason, disabledUntil, id, username)
		return
	}
	if role < minRole {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege),
		})
		c.Abort()
		return
	}
	if !validUserInfo(username, role) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthUserInfoInvalid),
		})
		c.Abort()
		return
	}
	// 防止不同newapi版本冲突，导致数据不通用
	c.Header("Auth-Version", "864b7076dbcd0a3c01b5520316720ebf")
	c.Set("username", username)
	c.Set("role", role)
	c.Set("id", id)
	c.Set("group", group)
	c.Set("user_group", group)
	c.Set("use_access_token", useAccessToken)

	// 管理/root 写操作审计兜底：内聚在鉴权链路里，保证任何经过 AdminAuth/RootAuth
	// 的写接口都会自动留痕（无需在路由上单独挂审计中间件，避免漏挂）。
	// handler 内手动埋点者会设置 ContextKeyAuditLogged，finishAdminAudit 据此跳过。
	var auditWriter *auditResponseWriter
	if minRole >= common.RoleAdminUser {
		auditWriter = beginAdminAudit(c)
	}

	c.Next()

	finishAdminAudit(c, auditWriter)
}

func TryUserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		id, ok := session.Get("id").(int)
		if !ok || id <= 0 {
			c.Next()
			return
		}

		user, err := model.GetUserCache(id)
		if err == nil && sessionRequiresGitHubEmailRelogin(session, user) {
			clearGitHubEmailReloginSession(session)
			c.Next()
			return
		}
		if err == nil && user.Status == common.UserStatusEnabled && validUserInfo(user.Username, user.Role) {
			c.Set("id", user.Id)
			c.Set("username", user.Username)
			c.Set("role", user.Role)
			c.Set("group", user.Group)
			c.Set("user_group", user.Group)
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

func RequirePermission(permission authz.Permission) func(c *gin.Context) {
	return func(c *gin.Context) {
		role := c.GetInt("role")
		userID := c.GetInt("id")
		if authz.Can(userID, role, permission) {
			c.Next()
			return
		}
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege),
		})
		c.Abort()
	}
}

func WssAuth(c *gin.Context) {

}

// TokenOrUserAuth allows either session-based user auth or API token auth.
// Used for endpoints that need to be accessible from both the dashboard and API clients.
func TokenOrUserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		// Try session auth first (dashboard users)
		session := sessions.Default(c)
		if id, ok := session.Get("id").(int); ok && id > 0 {
			user, err := model.GetUserCache(id)
			if err == nil && sessionRequiresGitHubEmailRelogin(session, user) {
				clearGitHubEmailReloginSession(session)
				TokenAuth()(c)
				return
			}
			if err == nil && user.Status == common.UserStatusEnabled {
				c.Set("id", user.Id)
				c.Set("username", user.Username)
				c.Set("role", user.Role)
				c.Set("group", user.Group)
				c.Set("user_group", user.Group)
				c.Next()
				return
			}
			if err == nil && user.Status == common.UserStatusDisabled {
				disabledUserBusinessResponse(c, user.DisableReason, user.DisabledUntil, user.Id, user.Username)
				return
			}
		}
		// Fall back to token auth (API clients)
		TokenAuth()(c)
	}
}

// TokenAuthReadOnly 宽松版本的令牌认证中间件，用于只读查询接口。
// 只验证令牌 key 是否存在，不检查令牌状态、过期时间和额度。
// 即使令牌已过期、已耗尽或已禁用，也允许访问。
// 仍然检查用户是否被封禁。
func TokenAuthReadOnly() func(c *gin.Context) {
	return func(c *gin.Context) {
		key := c.Request.Header.Get("Authorization")
		if key == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgTokenNotProvided),
			})
			c.Abort()
			return
		}
		if strings.HasPrefix(key, "Bearer ") || strings.HasPrefix(key, "bearer ") {
			key = strings.TrimSpace(key[7:])
		}
		key = strings.TrimPrefix(key, "sk-")
		parts := strings.Split(key, "-")
		key = parts[0]

		token, err := model.GetTokenByKey(key, false)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusUnauthorized, gin.H{
					"success": false,
					"message": common.TranslateMessage(c, i18n.MsgTokenInvalid),
				})
			} else {
				common.SysLog("TokenAuthReadOnly GetTokenByKey database error: " + err.Error())
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": common.TranslateMessage(c, i18n.MsgDatabaseError),
				})
			}
			c.Abort()
			return
		}

		// TokenAuthReadOnly must keep allowing other token states to query read-only
		// data, such as token usage logs; only explicitly disabled tokens are denied.
		if token.Status == common.TokenStatusDisabled {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgTokenStatusUnavailable),
			})
			c.Abort()
			return
		}

		userCache, err := model.GetUserCache(token.UserId)
		if err != nil {
			common.SysLog(fmt.Sprintf("TokenAuthReadOnly GetUserCache error for user %d: %v", token.UserId, err))
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgDatabaseError),
			})
			c.Abort()
			return
		}
		if userCache.Status != common.UserStatusEnabled {
			disabledUserBusinessResponse(c, userCache.DisableReason, userCache.DisabledUntil, token.UserId, userCache.Username)
			return
		}

		c.Set("id", token.UserId)
		c.Set("token_id", token.Id)
		c.Set("token_key", token.Key)
		c.Next()
	}
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
		// 检查path包含/v1/messages 或 /v1/models
		if strings.Contains(c.Request.URL.Path, "/v1/messages") || strings.Contains(c.Request.URL.Path, "/v1/models") {
			anthropicKey := c.Request.Header.Get("x-api-key")
			if anthropicKey != "" {
				c.Request.Header.Set("Authorization", "Bearer "+anthropicKey)
			}
		}
		// gemini api 从query中获取key
		if c.Request.URL.Path == "/v1/models" ||
			strings.HasPrefix(c.Request.URL.Path, "/v1beta/models") ||
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
		if strings.HasPrefix(key, "Bearer ") || strings.HasPrefix(key, "bearer ") {
			key = strings.TrimSpace(key[7:])
		}
		if key == "" || key == "midjourney-proxy" {
			key = c.Request.Header.Get("mj-api-secret")
			if strings.HasPrefix(key, "Bearer ") || strings.HasPrefix(key, "bearer ") {
				key = strings.TrimSpace(key[7:])
			}
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
			if errors.Is(err, model.ErrDatabase) {
				common.SysLog("TokenAuth ValidateUserToken database error: " + err.Error())
				abortWithOpenAiMessage(c, http.StatusInternalServerError,
					common.TranslateMessage(c, i18n.MsgDatabaseError))
			} else {
				abortWithOpenAiMessage(c, http.StatusUnauthorized,
					common.TranslateMessage(c, i18n.MsgTokenInvalid))
			}
			return
		}

		allowIps := token.GetIpLimits()
		if len(allowIps) > 0 {
			clientIp := c.ClientIP()
			logger.LogDebug(c, "Token has IP restrictions, checking client IP %s", clientIp)
			ip := net.ParseIP(clientIp)
			if ip == nil {
				abortWithOpenAiMessage(c, http.StatusForbidden, "无法解析客户端 IP 地址")
				return
			}
			if common.IsIpInCIDRList(ip, allowIps) == false {
				abortWithOpenAiMessage(c, http.StatusForbidden, "您的 IP 不在令牌允许访问的列表中", types.ErrorCodeAccessDenied)
				return
			}
			logger.LogDebug(c, "Client IP %s passed the token IP restrictions check", clientIp)
		}

		userCache, err := model.GetUserCache(token.UserId)
		if err != nil {
			common.SysLog(fmt.Sprintf("TokenAuth GetUserCache error for user %d: %v", token.UserId, err))
			abortWithOpenAiMessage(c, http.StatusInternalServerError,
				common.TranslateMessage(c, i18n.MsgDatabaseError))
			return
		}
		userEnabled := userCache.Status == common.UserStatusEnabled
		if !userEnabled {
			abortWithOpenAiMessage(c, http.StatusForbidden, disabledUserMessage(c, userCache.DisableReason))
			return
		}

		userCache.WriteContext(c)

		userGroup := userCache.Group
		tokenGroup := token.Group
		if tokenGroup != "" {
			var ok bool
			userUsableGroups := service.GetUserUsableGroups(userGroup)
			userGroup, ok = resolveTokenUsingGroup(userGroup, tokenGroup, userUsableGroups)
			if !ok {
				abortWithOpenAiMessage(c, http.StatusForbidden, fmt.Sprintf("当前用户无此分组，可用分组：%s", formatAvailableGroups(userUsableGroups)))
				return
			}
			// check group in common.GroupRatio
			if !ratio_setting.ContainsGroupRatio(tokenGroup) {
				if tokenGroup != "auto" {
					abortWithOpenAiMessage(c, http.StatusForbidden, fmt.Sprintf("分组 %s 已被弃用", tokenGroup))
					return
				}
			}
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
	c.Set("token_rate_limit", token.RateLimit)
	c.Set("token_ip_rate_limit", token.IpRateLimit)
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
	common.SetContextKey(c, constant.ContextKeyTokenGroup, token.Group)
	common.SetContextKey(c, constant.ContextKeyTokenCrossGroupRetry, token.CrossGroupRetry)
	if len(parts) > 1 {
		if model.IsAdmin(token.UserId) {
			c.Set("specific_channel_id", parts[1])
		} else {
			c.Header("specific_channel_version", "701e3ae1dc3f7975556d354e0675168d004891c8")
			abortWithOpenAiMessage(c, http.StatusForbidden, "普通用户不支持指定渠道")
			return fmt.Errorf("普通用户不支持指定渠道")
		}
	}
	return nil
}
