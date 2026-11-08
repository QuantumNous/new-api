package security

import (
	"errors"
	"fmt"
	"github.com/QuantumNous/new-api/internal/authtoken"
	"github.com/QuantumNous/new-api/internal/identity"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"net"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/internal/catalog"
	ratio_setting "github.com/QuantumNous/new-api/internal/catalog/configure_ratio"
	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/QuantumNous/new-api/internal/dbinfra"
	"github.com/QuantumNous/new-api/internal/i18n"
	"github.com/QuantumNous/new-api/internal/identity/policy"
	"github.com/QuantumNous/new-api/internal/logger"
	"github.com/QuantumNous/new-api/relaykit/types"
	"gorm.io/gorm"
)

type dashboardCredentialKind int

const (
	dashboardCredentialUnmatched dashboardCredentialKind = iota
	dashboardCredentialInternal
	dashboardCredentialPAT
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

func authHelper(c contract.Context, minRole int) {
	user, authID, useAccessToken, err := authenticateDashboardRequest(c)
	if err != nil {
		writeDashboardAuthError(c, err)
		return
	}
	if user.Status != common.UserStatusEnabled {
		c.AbortWithStatusJSON(http.StatusUnauthorized, common.H{"success": false, "code": "AUTH_USER_DISABLED", "message": common.TranslateCtxMessage(c, i18n.MsgAuthUserBanned)})
		return
	}
	if user.Role < minRole {
		c.AbortWithStatusJSON(http.StatusForbidden, common.H{"success": false, "code": "AUTH_INSUFFICIENT_PRIVILEGE", "message": common.TranslateCtxMessage(c, i18n.MsgAuthInsufficientPrivilege)})
		return
	}
	if !validUserInfo(user.Username, user.Role) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, common.H{"success": false, "code": "AUTH_USER_INVALID", "message": common.TranslateCtxMessage(c, i18n.MsgAuthUserInfoInvalid)})
		return
	}
	setDashboardAuthContext(c, user, authID, useAccessToken)

	// 管理/root 写操作审计兜底：内聚在鉴权链路里，保证任何经过 AdminAuth/RootAuth
	// 的写接口都会自动留痕（无需在路由上单独挂审计中间件，避免漏挂）。
	// handler 内手动埋点者会设置 ContextKeyAuditLogged，finishAdminAudit 据此跳过。
	var auditWriter contract.ResponseCapture
	if minRole >= common.RoleAdminUser {
		auditWriter = beginAdminAudit(c)
	}

	c.Next()

	finishAdminAudit(c, auditWriter)
}

func TryUserAuth() func(c contract.Context) {
	return func(c contract.Context) {
		user, authID, credentialKind, err := classifyDashboardCredential(c)
		if err != nil {
			writeDashboardAuthError(c, err)
			return
		}
		if credentialKind != dashboardCredentialUnmatched {
			setDashboardAuthContext(c, user, authID, credentialKind == dashboardCredentialPAT)
		}
		c.Next()
	}
}

func UserAuth() func(c contract.Context) {
	return func(c contract.Context) {
		authHelper(c, common.RoleCommonUser)
	}
}

func AdminAuth() func(c contract.Context) {
	return func(c contract.Context) {
		authHelper(c, common.RoleAdminUser)
	}
}

func RootAuth() func(c contract.Context) {
	return func(c contract.Context) {
		authHelper(c, common.RoleRootUser)
	}
}

// GetAuthIdentity returns a dashboard session identity. PAT-authenticated
// requests intentionally have no SessionID and cannot manage browser sessions.
//
// Both readers are thin wrappers over authtoken, which owns AuthIdentity and
// the context key. They stay exported here so existing security callers keep
// working; new domain code should call authtoken directly rather than
// depending on this package.
func GetAuthIdentity(c contract.Context) (authtoken.AuthIdentity, bool) {
	return authtoken.ReadAuthIdentity(c)
}

// GetSessionAuthIdentity returns only identities backed by a live dashboard
// session. PAT-authenticated requests intentionally fail this check.
func GetSessionAuthIdentity(c contract.Context) (authtoken.AuthIdentity, bool) {
	return authtoken.ReadSessionAuthIdentity(c)
}

func authenticateDashboardRequest(c contract.Context) (*identity.UserBase, authtoken.AuthIdentity, bool, error) {
	user, authID, credentialKind, err := classifyDashboardCredential(c)
	if err != nil {
		return nil, authtoken.AuthIdentity{}, credentialKind == dashboardCredentialPAT, err
	}
	if credentialKind == dashboardCredentialUnmatched {
		return nil, authtoken.AuthIdentity{}, false, authtoken.ErrAuthTokenInvalid
	}
	return user, authID, credentialKind == dashboardCredentialPAT, nil
}

// GeoGateRole reports the role of the account owning the request's dashboard
// credential (access token or personal access token), or -1 when the request
// carries no valid dashboard credential.
//
// The geographic gate runs before the regular auth middlewares and never needs
// the full auth context: it only asks "is this request an administrator's?".
// Relay API keys deliberately do not resolve here — a blocked region stays
// blocked for relay traffic regardless of role, so a leaked admin key cannot
// punch a hole through the region block.
func GeoGateRole(c contract.Context) int {
	user, _, kind, err := classifyDashboardCredential(c)
	if err != nil || kind == dashboardCredentialUnmatched || user == nil {
		return -1
	}
	return user.Role
}

func classifyDashboardCredential(c contract.Context) (*identity.UserBase, authtoken.AuthIdentity, dashboardCredentialKind, error) {
	raw, ok := authorizationToken(c.Header("Authorization"))
	if !ok {
		return nil, authtoken.AuthIdentity{}, dashboardCredentialUnmatched, nil
	}
	authID, internal, err := identity.ParseDashboardAccessToken(raw)
	if internal {
		if err != nil {
			return nil, authtoken.AuthIdentity{}, dashboardCredentialInternal, err
		}
		_, user, err := identity.ValidateLoginSession(authID)
		if err != nil {
			return nil, authtoken.AuthIdentity{}, dashboardCredentialInternal, err
		}
		return user, authID, dashboardCredentialInternal, nil
	}
	patUser, patToken, err := identity.AuthenticateAccessToken(raw)
	if err != nil {
		return nil, authtoken.AuthIdentity{}, dashboardCredentialPAT, err
	}
	if patUser == nil || patUser.Id <= 0 {
		return nil, authtoken.AuthIdentity{}, dashboardCredentialUnmatched, nil
	}
	user, err := identity.GetUserCache(patUser.Id)
	if err != nil {
		return nil, authtoken.AuthIdentity{}, dashboardCredentialPAT, err
	}
	authID = authtoken.AuthIdentity{UserID: user.Id, UserAuthVersion: user.AuthVersion}
	// Scoped PATs carry their token id in the session slot ("pat:<id>", the
	// upstream convention). Browser session IDs are UUIDs and can never carry
	// this prefix; legacy unscoped tokens leave it empty and keep full access.
	if patToken != nil {
		authID.SessionID = identity.AccessTokenSessionID(patToken.Id)
	}
	return user, authID, dashboardCredentialPAT, nil
}

// authorizationToken delegates to the identity capability so the credential
// parsing rule has a single implementation.
func authorizationToken(header string) (string, bool) {
	return ParseBearerCredential(header)
}

func setDashboardAuthContext(c contract.Context, user *identity.UserBase, authID authtoken.AuthIdentity, useAccessToken bool) {
	c.SetHeader("Auth-Version", "864b7076dbcd0a3c01b5520316720ebf")
	c.Set("username", user.Username)
	c.Set("role", user.Role)
	c.Set("id", user.Id)
	c.Set("group", user.Group)
	c.Set("user_group", user.Group)
	c.Set("use_access_token", useAccessToken)
	c.Set("session_id", authID.SessionID)
	c.Set("auth_version", authID.UserAuthVersion)
	c.Set("session_version", authID.SessionVersion)
	c.Set(authtoken.AuthIdentityContextKey, authID)
	user.WriteContext(c)
}

func writeDashboardAuthError(c contract.Context, err error) {
	if errors.Is(err, authtoken.ErrAuthTokenExpired) || errors.Is(err, identity.ErrAccessTokenExpired) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, common.H{"success": false, "code": "AUTH_TOKEN_EXPIRED", "message": common.TranslateCtxMessage(c, i18n.MsgAuthNotLoggedIn)})
		return
	}
	if errors.Is(err, identity.ErrLoginSessionRevoked) || errors.Is(err, gorm.ErrRecordNotFound) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, common.H{"success": false, "code": "AUTH_SESSION_REVOKED", "message": common.TranslateCtxMessage(c, i18n.MsgAuthNotLoggedIn)})
		return
	}
	if errors.Is(err, authtoken.ErrAuthTokenInvalid) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, common.H{"success": false, "code": "AUTH_UNAUTHORIZED", "message": common.TranslateCtxMessage(c, i18n.MsgAuthAccessTokenInvalid)})
		return
	}
	common.SysLog("dashboard authentication error: " + err.Error())
	c.AbortWithStatusJSON(http.StatusInternalServerError, common.H{"success": false, "code": "AUTH_INTERNAL_ERROR", "message": common.TranslateCtxMessage(c, i18n.MsgDatabaseError)})
}

// patRequestScopes returns the scope grant of the PAT that authenticated the
// request. Legacy unscoped tokens and browser sessions return nil (no scope
// restriction is applied on top of the role checks).
func patRequestScopes(c contract.Context) []string {
	authID, ok := authtoken.ReadAuthIdentity(c)
	if !ok {
		return nil
	}
	tokenID, ok := identity.ParseAccessTokenSessionID(authID.SessionID)
	if !ok {
		return nil
	}
	token, err := identity.GetUserAccessToken(authID.UserID, tokenID)
	if err != nil || token == nil {
		return nil
	}
	return token.GetScopes()
}

func RequirePermission(permission policy.Permission) func(c contract.Context) {
	return func(c contract.Context) {
		role := c.GetInt("role")
		userID := c.GetInt("id")
		if !policy.Can(userID, role, permission) {
			_ = c.JSON(http.StatusForbidden, common.H{
				"success": false,
				"message": common.TranslateCtxMessage(c, i18n.MsgAuthInsufficientPrivilege),
			})
			c.Abort()
			return
		}
		// A scoped PAT must also carry the matching grant. Legacy unscoped
		// tokens (no token row) are unrestricted, preserving existing callers.
		if scopes := patRequestScopes(c); scopes != nil &&
			!identity.AccessTokenAllows(scopes, permission.Resource+":"+permission.Action) {
			_ = c.JSON(http.StatusForbidden, common.H{
				"success": false,
				"code":    "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
				"message": "访问令牌缺少所需权限：" + permission.Resource + ":" + permission.Action,
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// TokenOrUserAuth allows either session-based user auth or API token auth.
// Used for endpoints that need to be accessible from both the dashboard and API clients.
func TokenOrUserAuth() func(c contract.Context) {
	return func(c contract.Context) {
		raw, ok := authorizationToken(c.Header("Authorization"))
		if ok {
			authID, internal, err := identity.ParseDashboardAccessToken(raw)
			if !internal {
				TokenAuth()(c)
				return
			}
			if err != nil {
				writeDashboardAuthError(c, err)
				return
			}
			_, user, err := identity.ValidateLoginSession(authID)
			if err != nil {
				writeDashboardAuthError(c, err)
				return
			}
			setDashboardAuthContext(c, user, authID, false)
			c.Next()
			return
		}
		// Opaque credentials are relay API keys here, never dashboard PATs.
		TokenAuth()(c)
	}
}

// TokenAuthReadOnly 宽松版本的令牌认证中间件，用于只读查询接口。
// 只验证令牌 key 是否存在，不检查令牌状态、过期时间和额度。
// 即使令牌已过期、已耗尽或已禁用，也允许访问。
// 仍然检查用户是否被封禁。
func TokenAuthReadOnly() func(c contract.Context) {
	return func(c contract.Context) {
		key := c.Headers().Get("Authorization")
		if key == "" {
			_ = c.JSON(http.StatusUnauthorized, common.H{
				"success": false,
				"message": common.TranslateCtxMessage(c, i18n.MsgTokenNotProvided),
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

		token, err := identity.GetTokenByKey(key, false)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				_ = c.JSON(http.StatusUnauthorized, common.H{
					"success": false,
					"message": common.TranslateCtxMessage(c, i18n.MsgTokenInvalid),
				})
			} else {
				common.SysLog("TokenAuthReadOnly GetTokenByKey database error: " + err.Error())
				_ = c.JSON(http.StatusInternalServerError, common.H{
					"success": false,
					"message": common.TranslateCtxMessage(c, i18n.MsgDatabaseError),
				})
			}
			c.Abort()
			return
		}

		// TokenAuthReadOnly must keep allowing other token states to query read-only
		// data, such as token usage logs; only explicitly disabled tokens are denied.
		if token.Status == common.TokenStatusDisabled {
			_ = c.JSON(http.StatusUnauthorized, common.H{
				"success": false,
				"message": common.TranslateCtxMessage(c, i18n.MsgTokenStatusUnavailable),
			})
			c.Abort()
			return
		}

		userCache, err := identity.GetUserCache(token.UserId)
		if err != nil {
			common.SysLog(fmt.Sprintf("TokenAuthReadOnly GetUserCache error for user %d: %v", token.UserId, err))
			_ = c.JSON(http.StatusInternalServerError, common.H{
				"success": false,
				"message": common.TranslateCtxMessage(c, i18n.MsgDatabaseError),
			})
			c.Abort()
			return
		}
		if userCache.Status != common.UserStatusEnabled {
			_ = c.JSON(http.StatusForbidden, common.H{
				"success": false,
				"message": common.TranslateCtxMessage(c, i18n.MsgAuthUserBanned),
			})
			c.Abort()
			return
		}

		c.Set("id", token.UserId)
		c.Set("token_id", token.Id)
		c.Set("token_key", token.Key)
		c.Next()
	}
}

func TokenAuth() func(c contract.Context) {
	return func(c contract.Context) {
		// 先检测是否为ws
		if c.Headers().Get("Sec-WebSocket-Protocol") != "" {
			// Sec-WebSocket-Protocol: realtime, openai-insecure-api-key.sk-xxx, openai-beta.realtime-v1
			// read sk from Sec-WebSocket-Protocol
			key := c.Headers().Get("Sec-WebSocket-Protocol")
			parts := strings.Split(key, ",")
			for _, part := range parts {
				part = strings.TrimSpace(part)
				if strings.HasPrefix(part, "openai-insecure-api-key") {
					key = strings.TrimPrefix(part, "openai-insecure-api-key.")
					break
				}
			}
			c.Headers().Set("Authorization", "Bearer "+key)
		}
		// 检查path包含/v1/messages 或 /v1/models
		if strings.Contains(c.Path(), "/v1/messages") || strings.Contains(c.Path(), "/v1/models") {
			anthropicKey := c.Headers().Get("x-api-key")
			if anthropicKey != "" {
				c.Headers().Set("Authorization", "Bearer "+anthropicKey)
			}
		}
		// gemini api 从query中获取key
		if strings.HasPrefix(c.Path(), "/v1beta/models") ||
			strings.HasPrefix(c.Path(), "/v1beta/openai/models") ||
			strings.HasPrefix(c.Path(), "/v1/models/") {
			skKey := c.Query("key")
			if skKey != "" {
				c.Headers().Set("Authorization", "Bearer "+skKey)
			}
			// 从x-goog-api-key header中获取key
			xGoogKey := c.Headers().Get("x-goog-api-key")
			if xGoogKey != "" {
				c.Headers().Set("Authorization", "Bearer "+xGoogKey)
			}
		}
		key := c.Headers().Get("Authorization")
		parts := make([]string, 0)
		if strings.HasPrefix(key, "Bearer ") || strings.HasPrefix(key, "bearer ") {
			key = strings.TrimSpace(key[7:])
		}
		if key == "" || key == "midjourney-proxy" {
			key = c.Headers().Get("mj-api-secret")
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
		token, err := identity.ValidateUserToken(key)
		if token != nil {
			id := c.GetInt("id")
			if id == 0 {
				c.Set("id", token.UserId)
			}
		}
		if err != nil {
			if errors.Is(err, dbinfra.ErrDatabase) {
				common.SysLog("TokenAuth ValidateUserToken database error: " + err.Error())
				abortWithOpenAiMessage(c, http.StatusInternalServerError,
					common.TranslateCtxMessage(c, i18n.MsgDatabaseError))
			} else {
				abortWithOpenAiMessage(c, http.StatusUnauthorized,
					common.TranslateCtxMessage(c, i18n.MsgTokenInvalid))
			}
			return
		}

		allowIps := token.GetIpLimits()
		if len(allowIps) > 0 {
			clientIp := c.ClientIP()
			logger.LogDebug(c.Context(), "Token has IP restrictions, checking client IP %s", clientIp)
			ip := net.ParseIP(clientIp)
			if ip == nil {
				abortWithOpenAiMessage(c, http.StatusForbidden, "无法解析客户端 IP 地址")
				return
			}
			if common.IsIpInCIDRList(ip, allowIps) == false {
				abortWithOpenAiMessage(c, http.StatusForbidden, "您的 IP 不在令牌允许访问的列表中", types.ErrorCodeAccessDenied)
				return
			}
			logger.LogDebug(c.Context(), "Client IP %s passed the token IP restrictions check", clientIp)
		}

		userCache, err := identity.GetUserCache(token.UserId)
		if err != nil {
			common.SysLog(fmt.Sprintf("TokenAuth GetUserCache error for user %d: %v", token.UserId, err))
			abortWithOpenAiMessage(c, http.StatusInternalServerError,
				common.TranslateCtxMessage(c, i18n.MsgDatabaseError))
			return
		}
		userEnabled := userCache.Status == common.UserStatusEnabled
		if !userEnabled {
			abortWithOpenAiMessage(c, http.StatusForbidden, common.TranslateCtxMessage(c, i18n.MsgAuthUserBanned))
			return
		}

		userCache.WriteContext(c)

		userGroup := userCache.Group
		tokenGroup := token.Group
		if tokenGroup != "" {
			// check common.UserUsableGroups[userGroup]
			if _, ok := channel.GetUserUsableGroups(userGroup)[tokenGroup]; !ok {
				abortWithOpenAiMessage(c, http.StatusForbidden, fmt.Sprintf("无权访问 %s 分组", tokenGroup))
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
		common.SetCtxKey(c, constant.ContextKeyUsingGroup, userGroup)

		err = SetupContextForToken(c, token, parts...)
		if err != nil {
			return
		}
		c.Next()
	}
}

func SetupContextForToken(c contract.Context, token *identity.Token, parts ...string) error {
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
	common.SetCtxKey(c, constant.ContextKeyTokenGroup, token.Group)
	common.SetCtxKey(c, constant.ContextKeyTokenCrossGroupRetry, token.CrossGroupRetry)
	if token.AutoGroups != "" {
		autoGroups, err := token.GetAutoGroups()
		if err != nil {
			common.SysError(fmt.Sprintf("failed to parse auto groups for token %d: %v", token.Id, err))
			autoGroups = []string{}
			common.SetCtxKey(c, constant.ContextKeyTokenAutoGroups, autoGroups)
		} else if len(autoGroups) > 0 {
			common.SetCtxKey(c, constant.ContextKeyTokenAutoGroups, autoGroups)
		}
	}
	if len(parts) > 1 {
		if identity.IsAdmin(token.UserId) {
			c.Set("specific_channel_id", parts[1])
		} else {
			c.SetHeader("specific_channel_version", "701e3ae1dc3f7975556d354e0675168d004891c8")
			abortWithOpenAiMessage(c, http.StatusForbidden, "普通用户不支持指定渠道")
			return fmt.Errorf("普通用户不支持指定渠道")
		}
	}
	return nil
}
