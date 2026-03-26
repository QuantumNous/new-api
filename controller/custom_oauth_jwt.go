package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type customOAuthJWTLoginRequest struct {
	State   string `json:"state" form:"state"`
	Token   string `json:"token" form:"token"`
	IDToken string `json:"id_token" form:"id_token"`
	JWT     string `json:"jwt" form:"jwt"`
	Ticket  string `json:"ticket" form:"ticket"`
}

type customOAuthJWTLoginResult struct {
	Action                string
	User                  *model.User
	BindAfterStatusCheck  bool
	ProviderUserID        string
	AutoRegisterTriggered bool
	EmailMergeTriggered   bool
	GroupResult           string
	RoleResult            int
}

type customOAuthJWTAuditInfo struct {
	ProviderSlug          string
	ProviderKind          string
	ExternalID            string
	TargetUserID          int
	Action                string
	AutoRegisterTriggered bool
	EmailMergeTriggered   bool
	GroupResult           string
	RoleResult            string
	FailureReason         string
}

func HandleCustomOAuthJWTLogin(c *gin.Context) {
	providerConfig, provider := loadCustomJWTDirectProvider(c)
	if provider == nil {
		return
	}
	audit := newCustomOAuthJWTAuditInfo(providerConfig)

	var req customOAuthJWTLoginRequest
	if err := c.ShouldBind(&req); err != nil {
		audit.FailureReason = "invalid_request"
		recordCustomOAuthJWTAudit(audit)
		common.ApiErrorMsg(c, "无效的请求参数: "+err.Error())
		return
	}

	session := sessions.Default(c)
	state := strings.TrimSpace(req.State)
	if state == "" || session.Get("oauth_state") == nil || state != session.Get("oauth_state").(string) {
		audit.FailureReason = "invalid_state"
		recordCustomOAuthJWTAudit(audit)
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgOAuthStateInvalid),
		})
		return
	}

	result, audit, err := completeCustomOAuthJWTLogin(
		c,
		providerConfig,
		provider,
		session,
		firstNonEmpty(req.Token, req.IDToken, req.JWT),
		req.Ticket,
		audit,
	)
	if err != nil {
		if audit != nil && audit.FailureReason == "" {
			audit.FailureReason = err.Error()
		}
		recordCustomOAuthJWTAudit(audit)
		handleCustomOAuthJWTLoginError(c, err)
		return
	}

	if result.Action == "bind" {
		recordCustomOAuthJWTAudit(audit)
		common.ApiSuccessI18n(c, i18n.MsgOAuthBindSuccess, gin.H{
			"action": "bind",
		})
		return
	}

	if result.User.Status != common.UserStatusEnabled {
		audit.FailureReason = "user_disabled"
		recordCustomOAuthJWTAudit(audit)
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}
	if result.BindAfterStatusCheck {
		if err := bindOAuthIdentityToUser(result.User, provider, result.ProviderUserID); err != nil {
			audit.FailureReason = err.Error()
			recordCustomOAuthJWTAudit(audit)
			common.ApiError(c, err)
			return
		}
	}

	recordCustomOAuthJWTAudit(audit)
	setupLogin(result.User, c)
}

func loadCustomJWTDirectProvider(c *gin.Context) (*model.CustomOAuthProvider, *oauth.JWTDirectProvider) {
	providerName := c.Param("provider")
	providerConfig, err := model.GetCustomOAuthProviderBySlug(providerName)
	if err != nil || providerConfig == nil || !providerConfig.IsJWTDirect() {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgOAuthUnknownProvider),
		})
		return nil, nil
	}
	if !providerConfig.Enabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams(providerConfig.Name))
		return nil, nil
	}
	return providerConfig, oauth.NewJWTDirectProvider(providerConfig)
}

func completeCustomOAuthJWTLogin(
	c *gin.Context,
	providerConfig *model.CustomOAuthProvider,
	provider *oauth.JWTDirectProvider,
	session sessions.Session,
	rawToken string,
	ticket string,
	audit *customOAuthJWTAuditInfo,
) (*customOAuthJWTLoginResult, *customOAuthJWTAuditInfo, error) {
	rawToken = strings.TrimSpace(rawToken)
	ticket = strings.TrimSpace(ticket)
	if providerConfig.RequiresTicketAcquire() {
		if ticket == "" {
			if audit != nil {
				audit.FailureReason = "missing_exchange_ticket"
			}
			return nil, audit, fmt.Errorf("未提供票据")
		}
	} else if rawToken == "" {
		if audit != nil {
			audit.FailureReason = "missing_jwt_token"
		}
		return nil, audit, fmt.Errorf("未提供 JWT 令牌")
	}

	identity, err := provider.ResolveIdentityFromInput(
		c.Request.Context(),
		rawToken,
		ticket,
		buildCustomOAuthJWTCallbackURL(c, providerConfig.Slug, session.Get("oauth_state").(string)),
		session.Get("oauth_state").(string),
	)
	if err != nil {
		return nil, audit, err
	}
	if audit != nil {
		audit.ExternalID = identity.User.ProviderUserID
		audit.GroupResult = safeOAuthAuditValue(identity.Group)
		audit.RoleResult = oauthRoleLabel(identity.Role)
	}

	if session.Get("username") != nil {
		currentUser, currentUserErr := getSessionUser(c)
		if currentUserErr != nil {
			if audit != nil {
				audit.FailureReason = currentUserErr.Error()
			}
			return nil, audit, currentUserErr
		}
		if err := bindOAuthIdentityToCurrentUser(c, provider, identity.User); err != nil {
			return nil, audit, err
		}
		if audit != nil {
			audit.Action = "bind"
			audit.TargetUserID = currentUser.Id
		}
		return &customOAuthJWTLoginResult{Action: "bind"}, audit, nil
	}

	resolvedUser, err := findOrCreateOAuthUserWithOptions(c, provider, identity.User, session, oauthFindOrCreateOptions{
		AllowAutoRegister:     providerConfig.AutoRegister,
		AllowAutoMergeByEmail: providerConfig.AutoMergeByEmail,
		InitialRole:           identity.Role,
		InitialGroup:          identity.Group,
	})
	if err != nil {
		return nil, audit, err
	}

	if resolvedUser.User.Status == common.UserStatusEnabled {
		if err := syncOAuthUserLoginAttributes(
			resolvedUser.User,
			providerConfig.Name,
			identity.Group,
			providerConfig.SyncGroupOnLogin,
			identity.Role,
			providerConfig.SyncRoleOnLogin,
		); err != nil {
			return nil, audit, err
		}
	}

	result := &customOAuthJWTLoginResult{
		Action:                "login",
		User:                  resolvedUser.User,
		BindAfterStatusCheck:  resolvedUser.BindAfterStatusCheck,
		ProviderUserID:        identity.User.ProviderUserID,
		AutoRegisterTriggered: resolvedUser.AutoRegisterTriggered,
		EmailMergeTriggered:   resolvedUser.EmailMergeTriggered,
		GroupResult:           identity.Group,
		RoleResult:            identity.Role,
	}
	if audit != nil {
		audit.Action = result.Action
		audit.TargetUserID = result.User.Id
		audit.AutoRegisterTriggered = result.AutoRegisterTriggered
		audit.EmailMergeTriggered = result.EmailMergeTriggered
	}
	return result, audit, nil
}

func buildCustomOAuthJWTCallbackURL(c *gin.Context, providerSlug string, state string) string {
	baseURL := strings.TrimSpace(system_setting.ServerAddress)
	var callbackURL *url.URL
	if baseURL != "" {
		parsedBaseURL, err := url.Parse(baseURL)
		if err == nil && parsedBaseURL != nil && strings.TrimSpace(parsedBaseURL.Host) != "" &&
			(parsedBaseURL.Scheme == "http" || parsedBaseURL.Scheme == "https") {
			callbackURL, _ = url.Parse(strings.TrimRight(baseURL, "/") + "/oauth/" + providerSlug)
		}
	}
	if callbackURL == nil {
		scheme := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto"))
		if scheme != "" {
			scheme = strings.TrimSpace(strings.Split(scheme, ",")[0])
		}
		if scheme == "" {
			if c.Request.TLS != nil {
				scheme = "https"
			} else {
				scheme = "http"
			}
		}

		host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
		if host != "" {
			host = strings.TrimSpace(strings.Split(host, ",")[0])
		}
		if host == "" {
			host = strings.TrimSpace(c.Request.Host)
		}
		if host == "" {
			return ""
		}

		callbackURL = &url.URL{
			Scheme: scheme,
			Host:   host,
			Path:   "/oauth/" + providerSlug,
		}
	}
	if callbackURL == nil {
		return ""
	}
	if strings.TrimSpace(state) != "" {
		query := callbackURL.Query()
		query.Set("state", state)
		callbackURL.RawQuery = query.Encode()
	}
	return callbackURL.String()
}

func handleCustomOAuthJWTLoginError(c *gin.Context, err error) {
	if boundErr, ok := err.(*OAuthAlreadyBoundError); ok {
		common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(boundErr.Provider))
		return
	}
	switch err.(type) {
	case *oauth.OAuthError, *oauth.AccessDeniedError, *oauth.TrustLevelError:
		handleOAuthError(c, err)
	default:
		handleOAuthUserError(c, err)
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func newCustomOAuthJWTAuditInfo(providerConfig *model.CustomOAuthProvider) *customOAuthJWTAuditInfo {
	if providerConfig == nil {
		return &customOAuthJWTAuditInfo{}
	}
	return &customOAuthJWTAuditInfo{
		ProviderSlug: providerConfig.Slug,
		ProviderKind: providerConfig.GetKind(),
	}
}

func recordCustomOAuthJWTAudit(audit *customOAuthJWTAuditInfo) {
	if audit == nil {
		return
	}

	content := fmt.Sprintf(
		"企业认证审计 provider_slug=%s provider_kind=%s action=%s external_id=%s target_user_id=%d auto_register=%t email_merge=%t group_result=%s role_result=%s failure_reason=%s",
		safeOAuthAuditValue(audit.ProviderSlug),
		safeOAuthAuditValue(audit.ProviderKind),
		safeOAuthAuditValue(audit.Action),
		safeOAuthAuditValue(audit.ExternalID),
		audit.TargetUserID,
		audit.AutoRegisterTriggered,
		audit.EmailMergeTriggered,
		safeOAuthAuditValue(audit.GroupResult),
		safeOAuthAuditValue(audit.RoleResult),
		safeOAuthAuditValue(audit.FailureReason),
	)
	common.SysLog("[EnterpriseAuth] " + content)
	if audit.TargetUserID > 0 {
		model.RecordLog(audit.TargetUserID, model.LogTypeSystem, content)
	}
}
