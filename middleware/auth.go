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
	var fields []gin.H
	if code != "" {
		fields = append(fields, gin.H{"code": code})
	}
	common.ApiErrorStatus(c, status, message, fields...)
	c.Abort()
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

