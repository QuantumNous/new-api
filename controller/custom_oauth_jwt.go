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

	finalizeCustomOAuthIdentityLogin(c, provider, result, audit)
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
	return completeCustomOAuthIdentityLogin(
		c,
		providerConfig,
		provider,
		session,
		identity.User,
		identity.Group,
		identity.Role,
		audit,
	)
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
