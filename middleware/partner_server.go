package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const (
	partnerServerPrincipalKey = "partner_server_principal"

	// Per-partner budgets. One partner backend serves all of its users, so the
	// general budget is generous; key reads and usage queries get their own.
	PartnerServerClientRateLimit     = 3000
	PartnerServerCredentialRateLimit = 120
	PartnerServerUsageRateLimit      = 60
	partnerServerRateWindow          = 60
)

// StripPartnerServerCORS removes cross-origin response headers. Partner
// server endpoints are for servers only; a browser that calls them with an
// embedded secret then cannot read the response, so the mistake shows up
// during integration.
func StripPartnerServerCORS(c *gin.Context) {
	header := c.Writer.Header()
	for _, name := range []string{"Access-Control-Allow-Origin", "Access-Control-Allow-Credentials", "Access-Control-Expose-Headers", "Access-Control-Allow-Headers", "Access-Control-Allow-Methods", "Access-Control-Max-Age"} {
		header.Del(name)
	}
}

// PartnerServerRejectPreflight answers CORS preflight requests with 403.
func PartnerServerRejectPreflight(c *gin.Context) {
	StripPartnerServerCORS(c)
	c.AbortWithStatus(http.StatusForbidden)
}

// partnerServerAuditAllowed reports whether another audit entry for this
// partner and outcome may be written in the current minute, so a flood of
// refused requests cannot flood the authorization log.
func partnerServerAuditAllowed(c *gin.Context, clientID, outcome string) bool {
	subject := clientID + ":" + outcome
	if common.RedisEnabled {
		allowed, _, _, err := redisFixedWindowTake(c.Request.Context(), redisIPRateLimitKey("PSV-AUDIT", subject), 1, 60)
		return err == nil && allowed
	}
	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
	return inMemoryRateLimiter.Request("PSV-AUDIT"+subject, 1, 60)
}

// RecordPartnerServerThrottledLog writes an authorization log entry at most
// once a minute per partner and action/reason.
func RecordPartnerServerThrottledLog(c *gin.Context, entry model.PartnerOauthAuthorizationLog) {
	if entry.ClientId == "" || !partnerServerAuditAllowed(c, entry.ClientId, entry.Action+":"+entry.Reason) {
		return
	}
	model.RecordPartnerOAuthAuthorizationLog(c, entry)
}

// PartnerServerBearer authenticates a partner server access token and applies
// the per-partner request budget.
func PartnerServerBearer() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.URL.Query().Has("access_token") {
			writePartnerIntegrationError(c, http.StatusBadRequest, "invalid_request", "access_token must not be sent in the query", "")
			return
		}
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		if header == "" {
			c.Header("WWW-Authenticate", `Bearer realm="partner"`)
			c.Status(http.StatusUnauthorized)
			c.Abort()
			return
		}
		parts := strings.Fields(header)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
			writePartnerIntegrationError(c, http.StatusUnauthorized, "invalid_token", "access token is invalid", `Bearer realm="partner", error="invalid_token"`)
			return
		}
		principal, reason, clientID, err := service.AuthenticatePartnerServerAccessToken(parts[1], c.ClientIP())
		if err != nil {
			typed := service.AsPartnerOAuthError(err)
			if typed == nil {
				logger.LogError(c.Request.Context(), common.LogText("partner server authentication failed (request_id=%s): database error", c.GetString(common.RequestIdKey)))
				writePartnerIntegrationError(c, http.StatusInternalServerError, "server_error", "please try again later", "")
				return
			}
			RecordPartnerServerThrottledLog(c, model.PartnerOauthAuthorizationLog{Action: "partner_server.auth_denied", Success: false,
				ClientId: clientID, Reason: reason, Status: typed.Status})
			writePartnerIntegrationError(c, typed.Status, typed.Code, typed.Description, typed.WWWAuth)
			return
		}
		if !partnerOAuthRateTake(c, "PSV-CLIENT", principal.Partner.ClientId, PartnerServerClientRateLimit, partnerServerRateWindow, partnerOAuthRateStyleIntegration) {
			return
		}
		c.Set(partnerServerPrincipalKey, principal)
		c.Next()
	}
}

// PartnerServerRateLimit applies an extra per-partner budget to one group of
// endpoints. A refusal is audited (throttled) with the given action.
func PartnerServerRateLimit(mark string, max int, auditAction string) gin.HandlerFunc {
	return func(c *gin.Context) {
		principal := PartnerServerPrincipalFrom(c)
		if principal == nil {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		if partnerOAuthRateTake(c, mark, principal.Partner.ClientId, max, partnerServerRateWindow, partnerOAuthRateStyleIntegration) {
			return
		}
		if auditAction != "" {
			RecordPartnerServerThrottledLog(c, model.PartnerOauthAuthorizationLog{Action: auditAction, Success: false,
				ClientId: principal.Partner.ClientId, Reason: "rate_limited", Status: http.StatusTooManyRequests})
		}
	}
}

func PartnerServerPrincipalFrom(c *gin.Context) *service.PartnerServerPrincipal {
	value, ok := c.Get(partnerServerPrincipalKey)
	if !ok {
		return nil
	}
	principal, _ := value.(*service.PartnerServerPrincipal)
	return principal
}
