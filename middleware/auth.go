package middleware

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	authIdentityContextKey        = "auth_identity"
	accessTokenLookupContextKey   = "access_token_lookup"
	accessTokenIdentityContextKey = "access_token_identity"
	accessTokenSessionRequiredMsg = "a dashboard login session is required"
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

func authHelper(c *gin.Context, minRole int) {
	if _, started := c.Get(accessTokenAuditContextKey); !started {
		defer finishAccessTokenAudit(c)
	}
	user, identity, useAccessToken, err := authenticateDashboardRequest(c)
	if err != nil {
		writeDashboardAuthError(c, err)
		return
	}
	if user.Status != common.UserStatusEnabled {
		abortWithWebMessage(c, http.StatusUnauthorized, "AUTH_USER_DISABLED", common.NewMessage("User has been banned"))
		return
	}
	if user.Role < minRole {
		abortWithWebMessage(c, http.StatusForbidden, "AUTH_INSUFFICIENT_PRIVILEGE", common.NewMessage("Unauthorized, insufficient privileges"))
		return
	}
	var lookup *accessTokenLookup
	if useAccessToken {
		lookup = requestAccessTokenLookup(c)
		if !enforceAccessTokenRoute(c, lookup, true) {
			return
		}
	}
	if !validUserInfo(user.Username, user.Role) {
		abortWithWebMessage(c, http.StatusUnauthorized, "AUTH_USER_INVALID", common.NewMessage("Unauthorized, invalid user info"))
		return
	}
	setDashboardAuthContext(c, user, identity, useAccessToken)
	if lookup != nil {
		setAccessTokenContext(c, lookup)
	}

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
		if _, started := c.Get(accessTokenAuditContextKey); !started {
			defer finishAccessTokenAudit(c)
		}
		user, identity, credentialKind, err := classifyDashboardCredential(c)
		if errors.Is(err, model.ErrLegacyAccessTokenRetired) {
			// After the deadline no opaque value is looked up, so a retired
			// token is indistinguishable from any unknown value: anonymous.
			credentialKind, err = dashboardCredentialUnmatched, nil
		}
		if err != nil {
			writeDashboardAuthError(c, err)
			return
		}
		// Optional authentication never elevates a token beyond its grant: a
		// token the route would reject leaves the request anonymous.
		var lookup *accessTokenLookup
		if credentialKind == dashboardCredentialPAT {
			lookup = requestAccessTokenLookup(c)
			if user.Status != common.UserStatusEnabled || !enforceAccessTokenRoute(c, lookup, false) {
				credentialKind = dashboardCredentialUnmatched
			}
		}
		if credentialKind != dashboardCredentialUnmatched {
			setDashboardAuthContext(c, user, identity, credentialKind == dashboardCredentialPAT)
			if credentialKind == dashboardCredentialPAT {
				setAccessTokenContext(c, lookup)
			}
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

// GetAuthIdentity returns a dashboard session identity. PAT-authenticated
// requests intentionally have no SessionID and cannot manage browser sessions.
func GetAuthIdentity(c *gin.Context) (service.AuthIdentity, bool) {
	value, ok := c.Get(authIdentityContextKey)
	if !ok {
		return service.AuthIdentity{}, false
	}
	identity, ok := value.(service.AuthIdentity)
	return identity, ok
}

// GetSessionAuthIdentity returns only identities backed by a live dashboard
// session. PAT-authenticated requests intentionally fail this check.
func GetSessionAuthIdentity(c *gin.Context) (service.AuthIdentity, bool) {
	identity, ok := GetAuthIdentity(c)
	if !ok {
		identity = service.AuthIdentity{
			UserID:          c.GetInt("id"),
			SessionID:       c.GetString("session_id"),
			UserAuthVersion: c.GetInt64("auth_version"),
			SessionVersion:  c.GetInt64("session_version"),
		}
	}
	if identity.UserID <= 0 || identity.SessionID == "" || identity.UserAuthVersion <= 0 || identity.SessionVersion <= 0 {
		return service.AuthIdentity{}, false
	}
	return identity, true
}

// GetStepUpIdentity returns the identity that may request and consume
// security verification proofs: a browser session, or a scoped access token
// bound to its own pat:<id> session. Legacy access tokens have neither.
func GetStepUpIdentity(c *gin.Context) (service.AuthIdentity, bool) {
	if identity, ok := GetSessionAuthIdentity(c); ok {
		return identity, true
	}
	value, ok := c.Get(accessTokenIdentityContextKey)
	if !ok {
		return service.AuthIdentity{}, false
	}
	identity, ok := value.(service.AuthIdentity)
	return identity, ok && identity.UserID > 0 && identity.SessionID != ""
}

func authenticateDashboardRequest(c *gin.Context) (*model.UserBase, service.AuthIdentity, bool, error) {
	user, identity, credentialKind, err := classifyDashboardCredential(c)
	if err != nil {
		return nil, service.AuthIdentity{}, credentialKind == dashboardCredentialPAT, err
	}
	if credentialKind == dashboardCredentialUnmatched {
		return nil, service.AuthIdentity{}, false, service.ErrAuthTokenInvalid
	}
	return user, identity, credentialKind == dashboardCredentialPAT, nil
}

func classifyDashboardCredential(c *gin.Context) (*model.UserBase, service.AuthIdentity, dashboardCredentialKind, error) {
	raw, ok := authorizationToken(c.GetHeader("Authorization"))
	if !ok {
		return nil, service.AuthIdentity{}, dashboardCredentialUnmatched, nil
	}
	identity, internal, err := service.ParseDashboardAccessToken(raw)
	if internal {
		if err != nil {
			return nil, service.AuthIdentity{}, dashboardCredentialInternal, err
		}
		_, user, err := service.ValidateLoginSession(identity)
		if err != nil {
			return nil, service.AuthIdentity{}, dashboardCredentialInternal, err
		}
		return user, identity, dashboardCredentialInternal, nil
	}
	lookup := lookupAccessToken(c, raw)
	if lookup.user != nil {
		beginAccessTokenAudit(c, lookup.user, lookup.ref)
	}
	if lookup.err != nil {
		if errors.Is(lookup.err, model.ErrAccessTokenExpired) {
			setAccessTokenAuditParam(c, "failure_reason", "expired")
		}
		return nil, service.AuthIdentity{}, dashboardCredentialPAT, lookup.err
	}
	if lookup.user == nil {
		return nil, service.AuthIdentity{}, dashboardCredentialUnmatched, nil
	}
	return lookup.user, service.AuthIdentity{UserID: lookup.user.Id, UserAuthVersion: lookup.user.AuthVersion}, dashboardCredentialPAT, nil
}

// accessTokenLookup is the per-request result of resolving an opaque dashboard
// credential. A nil user with a nil err means the value is not a PAT.
type accessTokenLookup struct {
	ref    string
	legacy bool
	token  *model.UserAccessToken
	user   *model.UserBase
	err    error
}

// lookupAccessToken resolves raw once per request, so the access audit and
// authentication share one database lookup.
func lookupAccessToken(c *gin.Context, raw string) *accessTokenLookup {
	ref := model.AccessTokenFingerprint(raw)
	if cached := requestAccessTokenLookup(c); cached != nil && cached.ref == ref {
		return cached
	}
	lookup := &accessTokenLookup{ref: ref}
	c.Set(accessTokenLookupContextKey, lookup)
	if !strings.HasPrefix(raw, model.AccessTokenPrefix) {
		lookup.legacy = true
		legacyUser, err := model.ValidateAccessToken(raw)
		if err != nil || legacyUser == nil || legacyUser.Id <= 0 {
			lookup.err = err
			return lookup
		}
		lookup.user, lookup.err = model.GetUserCache(legacyUser.Id)
		return lookup
	}
	token, err := model.FindUserAccessTokenByHash(ref)
	if err != nil || token == nil {
		lookup.err = err
		return lookup
	}
	lookup.token = token
	lookup.user, lookup.err = model.GetUserCache(token.UserId)
	if lookup.err == nil && token.Expired(common.GetTimestamp()) {
		// Keep the owner so the rejected attempt is still audited.
		lookup.err = model.ErrAccessTokenExpired
	}
	return lookup
}

func requestAccessTokenLookup(c *gin.Context) *accessTokenLookup {
	value, _ := c.Get(accessTokenLookupContextKey)
	lookup, _ := value.(*accessTokenLookup)
	return lookup
}

// enforceAccessTokenRoute applies the route's access token rule (fail closed:
// scoped tokens cannot call undeclared routes). With abort set it writes the
// 403 response and records the reason in the access audit.
func enforceAccessTokenRoute(c *gin.Context, lookup *accessTokenLookup, abort bool) bool {
	key := c.Request.Method + " " + c.FullPath()
	rule, declared := AccessTokenRouteRule(key)
	code, reason := "", ""
	var message *common.Message
	switch {
	case declared && rule.kind == accessTokenRuleSession:
		code, reason, message = "AUTH_SESSION_REQUIRED", "session_required", common.NewMessage(accessTokenSessionRequiredMsg)
	case lookup.legacy:
		return true
	case !declared:
		common.SysError(common.LogText("access token route is not declared: %s", key))
		code, reason, message = "ACCESS_TOKEN_ROUTE_UNDECLARED", "route_undeclared", common.NewMessage("Unauthorized, insufficient privileges")
	case rule.kind == accessTokenRuleAny, service.AccessTokenScopeGranted(lookup.token.GetScopes(), rule.scope):
		return true
	default:
		code, reason, message = "ACCESS_TOKEN_SCOPE_DENIED", "scope_denied", common.NewMessage("The access token lacks the required permission: {{scope}}", map[string]any{"scope": rule.scope})
		if abort {
			setAccessTokenAuditParam(c, "required_scope", rule.scope)
		}
	}
	if abort {
		setAccessTokenAuditParam(c, "failure_reason", reason)
		abortWithWebMessage(c, http.StatusForbidden, code, message)
	}
	return false
}

// setAccessTokenContext exposes the token grant to handlers. Scoped tokens
// also get a step-up identity bound to the token instead of a browser session.
func setAccessTokenContext(c *gin.Context, lookup *accessTokenLookup) {
	_, alreadySet := c.Get(accessTokenIdentityContextKey)
	c.Set("access_token_legacy", lookup.legacy)
	// Security audit params identify the token the same way the access audit does.
	c.Set("access_token_ref", lookup.ref)
	if lookup.legacy {
		c.Set("access_token_id", 0)
		c.Set("access_token_scopes", []string{})
		return
	}
	c.Set("access_token_id", lookup.token.Id)
	c.Set("access_token_scopes", lookup.token.GetScopes())
	c.Set(accessTokenIdentityContextKey, service.AuthIdentity{
		UserID:          lookup.user.Id,
		SessionID:       model.AccessTokenSessionID(lookup.token.Id),
		UserAuthVersion: lookup.user.AuthVersion,
		SessionVersion:  model.AccessTokenSessionVersion,
	})
	if alreadySet {
		return
	}
	if err := model.TouchUserAccessToken(lookup.token.Id, c.ClientIP(), common.GetTimestamp()); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("access token last-use update failed (token_id=%d): %v", lookup.token.Id, err))
	}
}

func authorizationToken(header string) (string, bool) {
	header = strings.TrimSpace(header)
	if header == "" {
		return "", false
	}
	parts := strings.Fields(header)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		header = parts[1]
	} else if len(parts) != 1 {
		return "", false
	}
	return header, header != ""
}

func setDashboardAuthContext(c *gin.Context, user *model.UserBase, identity service.AuthIdentity, useAccessToken bool) {
	c.Header("Auth-Version", "864b7076dbcd0a3c01b5520316720ebf")
	c.Set("username", user.Username)
	c.Set("role", user.Role)
	c.Set("id", user.Id)
	c.Set("group", user.Group)
	c.Set("user_group", user.Group)
	c.Set("use_access_token", useAccessToken)
	c.Set("session_id", identity.SessionID)
	c.Set("auth_version", identity.UserAuthVersion)
	c.Set("session_version", identity.SessionVersion)
	c.Set(authIdentityContextKey, identity)
	user.WriteContext(c)
}

// abortWithWebMessage answers a web console request; the web console
// translates the message, and code, when set, stays a stable error code.
func abortWithWebMessage(c *gin.Context, status int, code string, message *common.Message) {
	body := message.Fields()
	body["success"] = false
	body["message"] = message.Error()
	if code != "" {
		body["code"] = code
	}
	c.AbortWithStatusJSON(status, body)
}

func writeDashboardAuthError(c *gin.Context, err error) {
	if errors.Is(err, model.ErrAccessTokenExpired) {
		abortWithWebMessage(c, http.StatusUnauthorized, "ACCESS_TOKEN_EXPIRED", common.NewMessage("Unauthorized, the access token has expired"))
		return
	}
	if errors.Is(err, model.ErrLegacyAccessTokenRetired) {
		abortWithWebMessage(c, http.StatusUnauthorized, "ACCESS_TOKEN_LEGACY_RETIRED", common.NewMessage("Legacy access tokens have been retired. Create a new access token in security settings"))
		return
	}
	if errors.Is(err, service.ErrAuthTokenExpired) {
		abortWithWebMessage(c, http.StatusUnauthorized, "AUTH_TOKEN_EXPIRED", common.NewMessage("Unauthorized, not logged in and no access token provided"))
		return
	}
	if errors.Is(err, service.ErrLoginSessionRevoked) || errors.Is(err, gorm.ErrRecordNotFound) {
		abortWithWebMessage(c, http.StatusUnauthorized, "AUTH_SESSION_REVOKED", common.NewMessage("Unauthorized, not logged in and no access token provided"))
		return
	}
	if errors.Is(err, service.ErrAuthTokenInvalid) {
		abortWithWebMessage(c, http.StatusUnauthorized, "AUTH_UNAUTHORIZED", common.NewMessage("Unauthorized, invalid access token"))
		return
	}
	common.SysLog(common.LogText("dashboard authentication error: %s", err.Error()))
	abortWithWebMessage(c, http.StatusInternalServerError, "AUTH_INTERNAL_ERROR", common.NewMessage("Database error, please contact the administrator"))
}

func RequirePermission(permission authz.Permission) func(c *gin.Context) {
	return func(c *gin.Context) {
		role := c.GetInt("role")
		userID := c.GetInt("id")
		if authz.Can(userID, role, permission) {
			c.Next()
			return
		}
		abortWithWebMessage(c, http.StatusForbidden, "", common.NewMessage("Unauthorized, insufficient privileges"))
	}
}

func WssAuth(c *gin.Context) {

}

// TokenOrUserAuth allows either session-based user auth or API token auth.
// Used for endpoints that need to be accessible from both the dashboard and API clients.
func TokenOrUserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		raw, ok := authorizationToken(c.GetHeader("Authorization"))
		if ok {
			identity, internal, err := service.ParseDashboardAccessToken(raw)
			if !internal {
				TokenAuth()(c)
				return
			}
			if err != nil {
				writeDashboardAuthError(c, err)
				return
			}
			_, user, err := service.ValidateLoginSession(identity)
			if err != nil {
				writeDashboardAuthError(c, err)
				return
			}
			setDashboardAuthContext(c, user, identity, false)
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
func TokenAuthReadOnly() func(c *gin.Context) {
	return func(c *gin.Context) {
		key := c.Request.Header.Get("Authorization")
		if key == "" {
			abortWithWebMessage(c, http.StatusUnauthorized, "", common.NewMessage("Token not provided"))
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
				abortWithWebMessage(c, http.StatusUnauthorized, "", common.NewMessage("Invalid token"))
			} else {
				common.SysLog(common.LogText("TokenAuthReadOnly GetTokenByKey database error: %s", err.Error()))
				abortWithWebMessage(c, http.StatusInternalServerError, "", common.NewMessage("Database error, please contact the administrator"))
			}
			return
		}

		// TokenAuthReadOnly must keep allowing other token states to query read-only
		// data, such as token usage logs; only explicitly disabled tokens are denied.
		if token.Status == common.TokenStatusDisabled {
			abortWithWebMessage(c, http.StatusUnauthorized, "", common.NewMessage("This token status is unavailable"))
			return
		}

		userCache, err := model.GetUserCache(token.UserId)
		if err != nil {
			common.SysLog(common.LogText("TokenAuthReadOnly GetUserCache error for user %d: %v", token.UserId, err))
			abortWithWebMessage(c, http.StatusInternalServerError, "", common.NewMessage("Database error, please contact the administrator"))
			return
		}
		if userCache.Status != common.UserStatusEnabled {
			abortWithWebMessage(c, http.StatusForbidden, "", common.NewMessage("User has been banned"))
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
		applyWebSocketSubprotocolAuthorization(c.Request.Header)
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
				common.SysLog(common.LogText("TokenAuth ValidateUserToken database error: %s", err.Error()))
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
				abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgAuthClientIPUnresolved))
				return
			}
			if common.IsIpInCIDRList(ip, allowIps) == false {
				abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgAuthTokenIPNotAllowed), types.ErrorCodeAccessDenied)
				return
			}
			logger.LogDebug(c, "Client IP %s passed the token IP restrictions check", clientIp)
		}

		userCache, err := model.GetUserCache(token.UserId)
		if err != nil {
			common.SysLog(common.LogText("TokenAuth GetUserCache error for user %d: %v", token.UserId, err))
			abortWithOpenAiMessage(c, http.StatusInternalServerError,
				common.TranslateMessage(c, i18n.MsgDatabaseError))
			return
		}
		userEnabled := userCache.Status == common.UserStatusEnabled
		if !userEnabled {
			abortWithOpenAiMessage(c, http.StatusForbidden, common.TranslateMessage(c, i18n.MsgAuthUserBanned))
			return
		}

		userCache.WriteContext(c)

		userGroup := userCache.Group
		tokenGroup := token.Group
		if tokenGroup != "" {
			// check common.UserUsableGroups[userGroup]
			if _, ok := service.GetUserUsableGroups(userGroup)[tokenGroup]; !ok {
				abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgAuthTokenGroupForbidden, map[string]any{"Group": tokenGroup}))
				return
			}
			// check group in common.GroupRatio
			if !ratio_setting.ContainsGroupRatio(tokenGroup) {
				if tokenGroup != "auto" {
					abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgAuthTokenGroupDeprecated, map[string]any{"Group": tokenGroup}))
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

func applyWebSocketSubprotocolAuthorization(header http.Header) bool {
	key, ok := apiKeyFromWebSocketSubprotocol(strings.Join(header.Values("Sec-WebSocket-Protocol"), ","))
	if !ok {
		return false
	}
	header.Set("Authorization", "Bearer "+key)
	return true
}

func apiKeyFromWebSocketSubprotocol(protocols string) (string, bool) {
	if protocols == "" {
		return "", false
	}
	const insecureAPIKeyPrefix = "openai-insecure-api-key."
	for part := range strings.SplitSeq(protocols, ",") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, insecureAPIKeyPrefix) {
			key := strings.TrimPrefix(part, insecureAPIKeyPrefix)
			return key, key != ""
		}
	}
	return "", false
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
	common.SetContextKey(c, constant.ContextKeyTokenGroup, token.Group)
	common.SetContextKey(c, constant.ContextKeyTokenCrossGroupRetry, token.CrossGroupRetry)
	if token.AutoGroups != "" {
		autoGroups, err := token.GetAutoGroups()
		if err != nil {
			common.SysError(common.LogText("failed to parse auto groups for token %d: %v", token.Id, err))
			autoGroups = []string{}
			common.SetContextKey(c, constant.ContextKeyTokenAutoGroups, autoGroups)
		} else if len(autoGroups) > 0 {
			common.SetContextKey(c, constant.ContextKeyTokenAutoGroups, autoGroups)
		}
	}
	if len(parts) > 1 {
		if model.IsAdmin(token.UserId) {
			id, err := strconv.Atoi(parts[1])
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidChannelId))
				return fmt.Errorf("invalid specific channel id")
			}
			service.GetChannelConstraints(c).AddPin(dto.ChannelPin{
				ChannelId: id,
				Source:    dto.PinSourceToken,
				Rank:      dto.PinRankToken,
				RetryMode: dto.PinRetrySingleAttempt,
			})
		} else {
			c.Header("specific_channel_version", "701e3ae1dc3f7975556d354e0675168d004891c8")
			abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgAuthChannelSelectForbidden))
			return errors.New("regular users cannot specify a channel")
		}
	}
	return nil
}
