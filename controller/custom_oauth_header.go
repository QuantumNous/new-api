package controller

import (
	"net"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type customOAuthHeaderLoginRequest struct {
	State string `json:"state" form:"state"`
}

func HandleCustomOAuthHeaderLogin(c *gin.Context) {
	providerConfig, provider := loadCustomTrustedHeaderProvider(c)
	if provider == nil {
		return
	}
	audit := newCustomOAuthJWTAuditInfo(providerConfig)

	var req customOAuthHeaderLoginRequest
	if err := c.ShouldBind(&req); err != nil {
		audit.FailureReason = "invalid_request"
		recordCustomOAuthJWTAudit(audit)
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	session := sessions.Default(c)
	state := strings.TrimSpace(req.State)
	sessionState, ok := session.Get("oauth_state").(string)
	if state == "" || !ok || strings.TrimSpace(sessionState) == "" || state != sessionState {
		audit.FailureReason = "invalid_state"
		recordCustomOAuthJWTAudit(audit)
		common.ApiErrorI18n(c, i18n.MsgOAuthStateInvalid)
		return
	}

	if !isTrustedHeaderRequestSource(c, providerConfig) {
		audit.FailureReason = "untrusted_proxy_source"
		recordCustomOAuthJWTAudit(audit)
		common.ApiErrorI18n(c, i18n.MsgOAuthTrustedProxyDenied)
		return
	}

	identity, err := provider.ResolveIdentityFromHeaders(c.Request.Header)
	if err != nil {
		audit.FailureReason = "missing_trusted_header_identity"
		recordCustomOAuthJWTAudit(audit)
		handleCustomOAuthJWTLoginError(c, oauth.NewOAuthError(i18n.MsgOAuthTrustedHeaderMissing, nil))
		return
	}

	result, audit, err := completeCustomOAuthIdentityLogin(
		c,
		providerConfig,
		provider,
		session,
		identity.User,
		identity.Group,
		identity.Role,
		audit,
	)
	if err != nil {
		if audit != nil && audit.FailureReason == "" {
			audit.FailureReason = oauthAuditFailureReason(err)
		}
		recordCustomOAuthJWTAudit(audit)
		handleCustomOAuthJWTLoginError(c, err)
		return
	}

	finalizeCustomOAuthIdentityLogin(c, provider, result, audit)
}

func loadCustomTrustedHeaderProvider(c *gin.Context) (*model.CustomOAuthProvider, *oauth.TrustedHeaderProvider) {
	providerName := c.Param("provider")
	providerConfig, err := model.GetCustomOAuthProviderBySlug(providerName)
	if err != nil || providerConfig == nil || !providerConfig.IsTrustedHeader() {
		common.ApiErrorI18n(c, i18n.MsgOAuthUnknownProvider)
		return nil, nil
	}
	if !providerConfig.Enabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams(providerConfig.Name))
		return nil, nil
	}
	return providerConfig, oauth.NewTrustedHeaderProvider(providerConfig)
}

func isTrustedHeaderRequestSource(c *gin.Context, providerConfig *model.CustomOAuthProvider) bool {
	if providerConfig == nil {
		return false
	}
	peerIP, err := extractRequestPeerIP(c.Request.RemoteAddr)
	if err != nil || peerIP == nil {
		return false
	}
	return common.IsIpInCIDRList(peerIP, providerConfig.GetTrustedProxyCIDRs())
}

func extractRequestPeerIP(remoteAddr string) (net.IP, error) {
	remoteAddr = strings.TrimSpace(remoteAddr)
	if remoteAddr == "" {
		return nil, net.InvalidAddrError("remote address is empty")
	}
	host := remoteAddr
	if parsedHost, _, err := net.SplitHostPort(remoteAddr); err == nil {
		host = parsedHost
	}
	host = strings.Trim(host, "[]")
	ip := net.ParseIP(host)
	if ip == nil {
		return nil, net.InvalidAddrError("remote address does not contain an IP")
	}
	return ip, nil
}
