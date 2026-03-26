package controller

import (
	"fmt"
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

	result, audit, err := completeCustomOAuthJWTLogin(
		c,
		providerConfig,
		provider,
		session,
		sessionState,
		selectJWTLoginCredential(providerConfig, req),
		req.Ticket,
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
			audit.FailureReason = oauthAuditFailureReason(err)
			recordCustomOAuthJWTAudit(audit)
			handleCustomOAuthJWTLoginError(c, err)
			return
		}
	}

	if !setupLoginWithResult(result.User, c) {
		audit.FailureReason = "session_save_failed"
		recordCustomOAuthJWTAudit(audit)
		return
	}
	recordCustomOAuthJWTAudit(audit)
}

func loadCustomJWTDirectProvider(c *gin.Context) (*model.CustomOAuthProvider, *oauth.JWTDirectProvider) {
	providerName := c.Param("provider")
	providerConfig, err := model.GetCustomOAuthProviderBySlug(providerName)
	if err != nil || providerConfig == nil || !providerConfig.IsJWTDirect() {
		common.ApiErrorI18n(c, i18n.MsgOAuthUnknownProvider)
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
	state string,
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
			return nil, audit, oauth.NewOAuthError(i18n.MsgOAuthTicketMissing, nil)
		}
	} else if rawToken == "" {
		if audit != nil {
			audit.FailureReason = "missing_jwt_token"
		}
		return nil, audit, oauth.NewOAuthError(i18n.MsgOAuthJWTMissing, nil)
	}

	callbackURL := ""
	if providerConfig.RequiresTicketAcquire() {
		validatedCallbackURL, callbackErr := buildCustomOAuthJWTCallbackURL(providerConfig.Slug, state)
		if callbackErr != nil {
			if audit != nil {
				audit.FailureReason = "invalid_callback_url"
			}
			return nil, audit, oauth.NewOAuthError(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": providerConfig.Name})
		}
		callbackURL = validatedCallbackURL
	}

	identity, err := provider.ResolveIdentityFromInput(
		c.Request.Context(),
		rawToken,
		ticket,
		callbackURL,
		state,
	)
	if err != nil {
		return nil, audit, err
	}
	if audit != nil {
		audit.ExternalID = redactOAuthAuditID(identity.User.ProviderUserID)
		audit.GroupResult = safeOAuthAuditValue(identity.Group)
		audit.RoleResult = oauthRoleLabel(identity.Role)
	}

	if session.Get("username") != nil {
		if audit != nil {
			if sessionUserID, ok := session.Get("id").(int); ok {
				audit.TargetUserID = sessionUserID
			}
		}
		currentUser, currentUserErr := getSessionUser(c)
		if currentUserErr != nil {
			if audit != nil {
				if strings.TrimSpace(currentUserErr.Error()) == "该用户已被禁用" {
					audit.FailureReason = "user_disabled"
				} else {
					audit.FailureReason = oauthAuditFailureReason(currentUserErr)
				}
			}
			if strings.TrimSpace(currentUserErr.Error()) == "该用户已被禁用" {
				return nil, audit, oauth.NewOAuthError(i18n.MsgOAuthUserBanned, nil)
			}
			return nil, audit, currentUserErr
		}
		if currentUser.Status != common.UserStatusEnabled {
			if audit != nil {
				audit.FailureReason = "user_disabled"
			}
			return nil, audit, oauth.NewOAuthError(i18n.MsgOAuthUserBanned, nil)
		}
		if err := bindOAuthIdentityToCurrentUser(c, provider, identity.User); err != nil {
			return nil, audit, err
		}
		if audit != nil {
			audit.Action = "bind"
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

func buildCustomOAuthJWTCallbackURL(providerSlug string, state string) (string, error) {
	baseURL := strings.TrimSpace(system_setting.ServerAddress)
	if baseURL == "" {
		return "", fmt.Errorf("server address is empty")
	}
	callbackURL, err := url.Parse(baseURL)
	if err != nil {
		return "", fmt.Errorf("invalid server address: %w", err)
	}
	if callbackURL == nil || strings.TrimSpace(callbackURL.Host) == "" {
		return "", fmt.Errorf("server address host is empty")
	}
	if callbackURL.Scheme != "http" && callbackURL.Scheme != "https" {
		return "", fmt.Errorf("server address scheme must be http or https")
	}

	callbackURL.RawQuery = ""
	callbackURL.Fragment = ""
	callbackURL.Path = strings.TrimRight(callbackURL.Path, "/") + "/oauth/" + providerSlug
	if strings.TrimSpace(state) != "" {
		query := callbackURL.Query()
		query.Set("state", state)
		callbackURL.RawQuery = query.Encode()
	}
	return callbackURL.String(), nil
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

func selectJWTLoginCredential(providerConfig *model.CustomOAuthProvider, req customOAuthJWTLoginRequest) string {
	if providerConfig != nil && providerConfig.GetJWTIdentityMode() == model.CustomJWTIdentityModeUserInfo {
		return firstNonEmpty(req.Token, req.IDToken, req.JWT)
	}
	return firstNonEmpty(req.IDToken, req.JWT, req.Token)
}

func oauthAuditFailureReason(err error) string {
	if err == nil {
		return ""
	}

	switch e := err.(type) {
	case *oauth.OAuthError:
		return "oauth_error:" + safeOAuthAuditValue(e.MsgKey)
	case *oauth.AccessDeniedError:
		return "access_denied"
	case *oauth.TrustLevelError:
		return "trust_level_denied"
	case *OAuthAlreadyBoundError:
		return "oauth_already_bound"
	case *OAuthUserDeletedError:
		return "oauth_user_deleted"
	case *OAuthRegistrationDisabledError, *OAuthAutoRegisterDisabledError:
		return "registration_disabled"
	default:
		return "internal_error"
	}
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

func redactOAuthAuditID(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	return "hmac_sha256:" + common.GenerateHMAC(value)
}
