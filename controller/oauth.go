package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	oauthAuthFlowTTL               = 10 * time.Minute
	domainOAuthBindingCookieName   = "__Host-yeschoy_oauth_binding"
	domainOAuthBindingCookieMaxAge = 15 * 60
)

type oauthStateRequest struct {
	Provider string          `json:"provider"`
	Intent   string          `json:"intent"`
	Aff      string          `json:"aff,omitempty"`
	Scope    string          `json:"scope,omitempty"`
	Context  json.RawMessage `json:"context,omitempty"`
}

type oauthFlowPayload struct {
	AffiliateCode          string                         `json:"affiliate_code,omitempty"`
	DomainID               int64                          `json:"domain_id,omitempty"`
	OriginHost             string                         `json:"origin_host,omitempty"`
	BrowserBindingHash     string                         `json:"browser_binding_hash,omitempty"`
	ExpectedAuthVersion    int64                          `json:"expected_auth_version,omitempty"`
	ExpectedSessionVersion int64                          `json:"expected_session_version,omitempty"`
	Verification           *service.OAuthVerificationFlow `json:"verification,omitempty"`
	Telegram               *oauth.TelegramOAuthFlow       `json:"telegram,omitempty"`
	SessionIdentity        *service.AuthIdentity          `json:"session_identity,omitempty"`
	Authorization          *model.AuthFlowAuthorization   `json:"authorization,omitempty"`
}

// providerParams returns the params of messages that name the OAuth provider.
func providerParams(name string) map[string]any {
	return map[string]any{"provider": name}
}

// GenerateOAuthCode generates a state code for OAuth CSRF protection
func GenerateOAuthCode(c *gin.Context) {
	var request oauthStateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	request.Provider = strings.TrimSpace(request.Provider)
	request.Intent = strings.TrimSpace(request.Intent)
	request.Aff = strings.TrimSpace(request.Aff)
	if oauth.GetProvider(request.Provider) == nil ||
		(request.Intent != model.AuthFlowIntentLogin && request.Intent != model.AuthFlowIntentBind && request.Intent != model.AuthFlowIntentVerify) ||
		len(request.Aff) > 32 ||
		(request.Intent != model.AuthFlowIntentLogin && request.Aff != "") ||
		(request.Intent != model.AuthFlowIntentVerify && (request.Scope != "" || len(request.Context) != 0)) {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	flowPayload := oauthFlowPayload{AffiliateCode: request.Aff}
	if request.Provider == "telegram" {
		telegramFlow, err := oauth.NewTelegramOAuthFlow()
		if err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		flowPayload.Telegram = telegramFlow
	}
	userID, sessionID := 0, ""
	bindingStarted := false
	if request.Intent == model.AuthFlowIntentBind || request.Intent == model.AuthFlowIntentVerify {
		identity, ok := middleware.GetSessionAuthIdentity(c)
		if !ok {
			writeAccountStatusError(c, http.StatusUnauthorized, "Sign in to bind an account")
			return
		}
		userID, sessionID = identity.UserID, identity.SessionID
		flowPayload.ExpectedAuthVersion = identity.UserAuthVersion
		flowPayload.ExpectedSessionVersion = identity.SessionVersion
		if request.Intent == model.AuthFlowIntentBind {
			defer func() {
				recordUserSecurityAudit(c, userID, "user.binding_start", map[string]any{"provider": request.Provider, "success": bindingStarted})
			}()
			context, err := common.Marshal(service.AccountBindingContext{Provider: request.Provider})
			if err != nil {
				writeSecurityOperationError(c, err)
				return
			}
			flowPayload.Authorization = middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAccountBind, Context: context})
			if flowPayload.Authorization == nil {
				return
			}
			flowPayload.SessionIdentity = &identity
		}
		if flowPayload.Telegram != nil {
			if _, _, err := service.ValidateLoginSession(identity); err != nil {
				writeSecurityOperationError(c, err)
				return
			}
			flowPayload.SessionIdentity = &identity
		}
		if request.Intent == model.AuthFlowIntentVerify {
			verification, err := service.StartOAuthVerification(identity, service.VerificationOperation{Scope: request.Scope, Context: request.Context}, request.Provider)
			if err != nil {
				writeSecurityOperationError(c, err)
				return
			}
			flowPayload.Verification = verification
		}
	}
	flowPayload.DomainID = customDomainIDFromContext(c)
	if domainContext, found := middleware.GetCustomDomainContext(c); found &&
		(domainContext.Kind == service.CustomDomainKindCustom ||
			(domainContext.Kind == service.CustomDomainKindMain && !domainContext.IsCallbackHost)) {
		flowPayload.OriginHost = domainContext.Host
		bindingHash, err := ensureDomainOAuthBrowserBinding(c)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		flowPayload.BrowserBindingHash = bindingHash
	}
	payload, err := common.Marshal(flowPayload)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	expiresAt := time.Now().Add(oauthAuthFlowTTL)
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose: model.AuthFlowPurposeOAuth, Provider: request.Provider, Intent: request.Intent,
		UserId: userID, SessionId: sessionID, Payload: string(payload), ExpiresAt: expiresAt,
	})
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	bindingStarted = request.Intent == model.AuthFlowIntentBind
	data := gin.H{"flow_token": state, "expires_at": expiresAt.Unix()}
	if flowPayload.Telegram != nil {
		data["authorization_url"] = flowPayload.Telegram.AuthorizationURL(state)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": data})
}

func ensureDomainOAuthBrowserBinding(c *gin.Context) (string, error) {
	binding, err := c.Cookie(domainOAuthBindingCookieName)
	if err != nil || len(binding) < 32 || len(binding) > 128 {
		binding, err = common.GenerateRandomCharsKey(48)
		if err != nil {
			return "", err
		}
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     domainOAuthBindingCookieName,
		Value:    binding,
		Path:     "/",
		MaxAge:   domainOAuthBindingCookieMaxAge,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})
	return domainOAuthBindingHash(binding), nil
}

func domainOAuthBindingHash(binding string) string {
	return common.GenerateHMACWithKey([]byte("custom-domain-oauth-binding-v1:"+common.SessionSecret), binding)
}

// HandleOAuth handles OAuth callback for all standard OAuth providers
func HandleOAuth(c *gin.Context) {
	if !isCustomDomainCallbackRequest(c) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	providerName := c.Param("provider")
	provider := oauth.GetProvider(providerName)
	if provider == nil {
		writeAccountStatusError(c, http.StatusBadRequest, "Unknown OAuth provider")
		return
	}
	state := c.Query("state")
	pendingFlow, err := model.GetAuthFlow(state, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeOAuth, Provider: providerName})
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": common.NewMessage("State parameter is empty or mismatched").Error()})
		return
	}
	var payload oauthFlowPayload
	if pendingFlow.Payload != "" {
		if err := common.UnmarshalJsonStr(pendingFlow.Payload, &payload); err != nil && pendingFlow.Intent != model.AuthFlowIntentLogin {
			writeSecurityOperationError(c, model.ErrAuthFlowInvalid)
			return
		}
	}
	match := model.AuthFlowMatch{Purpose: model.AuthFlowPurposeOAuth, Provider: providerName, Intent: pendingFlow.Intent}
	bindSucceeded, notificationFailed := false, false
	if pendingFlow.Intent == model.AuthFlowIntentBind {
		defer func() {
			recordUserSecurityAudit(c, pendingFlow.UserId, "user.binding_bind", map[string]any{
				"provider": providerName, "success": bindSucceeded, "notification_failed": notificationFailed,
			})
		}()
	}
	var identity service.AuthIdentity
	deferDomainBind := false
	if pendingFlow.Intent == model.AuthFlowIntentBind || pendingFlow.Intent == model.AuthFlowIntentVerify {
		if payload.OriginHost != "" {
			// A proof must never be delivered to another Origin without a bound ceremony.
			if pendingFlow.Intent != model.AuthFlowIntentBind {
				c.JSON(http.StatusForbidden, gin.H{"success": false, "message": common.NewMessage("State parameter is empty or mismatched").Error()})
				return
			}
			targetHost, active, targetErr := resolveOAuthReturnTarget(payload)
			if targetErr != nil {
				common.ApiError(c, targetErr)
				return
			}
			if targetHost == "" || payload.BrowserBindingHash == "" || payload.ExpectedAuthVersion <= 0 || payload.ExpectedSessionVersion <= 0 {
				c.JSON(http.StatusForbidden, gin.H{"success": false, "message": common.NewMessage("State parameter is empty or mismatched").Error()})
				return
			}
			identity = service.AuthIdentity{
				UserID: pendingFlow.UserId, SessionID: pendingFlow.SessionId,
				UserAuthVersion: payload.ExpectedAuthVersion, SessionVersion: payload.ExpectedSessionVersion,
			}
			match.UserId, match.SessionId = identity.UserID, identity.SessionID
			if !active {
				if _, err := model.ConsumeAuthFlow(state, match); err != nil {
					c.JSON(http.StatusForbidden, gin.H{"success": false, "message": common.NewMessage("State parameter is empty or mismatched").Error()})
					return
				}
				writeDomainBindReturn(c, targetHost, providerName, "target_unavailable", common.NewMessage("State parameter is empty or mismatched").Error())
				return
			}
			if payload.SessionIdentity == nil || payload.SessionIdentity.SessionIdentity() != identity.SessionIdentity() {
				writeSecurityOperationError(c, model.ErrAuthFlowInvalid)
				return
			}
			if _, _, err := service.ValidateLoginSession(identity); err != nil {
				if _, consumeErr := model.ConsumeAuthFlow(state, match); consumeErr != nil {
					c.JSON(http.StatusForbidden, gin.H{"success": false, "message": common.NewMessage("State parameter is empty or mismatched").Error()})
					return
				}
				writeDomainBindReturn(c, targetHost, providerName, "failed", common.NewMessage("State parameter is empty or mismatched").Error())
				return
			}
			deferDomainBind = true
		} else {
			var ok bool
			identity, ok = middleware.GetSessionAuthIdentity(c)
			if !ok || identity.UserID != pendingFlow.UserId || identity.SessionID != pendingFlow.SessionId {
				c.JSON(http.StatusForbidden, gin.H{"success": false, "message": common.NewMessage("State parameter is empty or mismatched").Error()})
				return
			}
			match.UserId, match.SessionId = identity.UserID, identity.SessionID
		}
		if pendingFlow.Intent == model.AuthFlowIntentBind {
			context, err := common.Marshal(service.AccountBindingContext{Provider: providerName})
			if err != nil {
				writeSecurityOperationError(c, err)
				return
			}
			if err := service.ValidateFlowAuthorization(identity, service.VerificationOperation{Scope: service.VerificationScopeAccountBind, Context: context}, payload.Authorization); err != nil {
				writeSecurityOperationError(c, err)
				return
			}
		}
	} else if pendingFlow.Intent != model.AuthFlowIntentLogin {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if providerName == "telegram" {
		if err := oauth.TelegramConfigurationError(); err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		if payload.Telegram == nil {
			writeSecurityOperationError(c, model.ErrAuthFlowInvalid)
			return
		}
		if pendingFlow.Intent != model.AuthFlowIntentLogin {
			if payload.SessionIdentity == nil || payload.SessionIdentity.SessionIdentity() != identity.SessionIdentity() {
				writeSecurityOperationError(c, model.ErrAuthFlowInvalid)
				return
			}
			if _, _, err := service.ValidateLoginSession(identity); err != nil {
				writeSecurityOperationError(c, err)
				return
			}
		}
		c.Set(oauth.TelegramOAuthFlowContextKey, payload.Telegram)
	}
	if !provider.IsEnabled() {
		handleOAuthFlowMessage(c, common.NewMessage("{{provider}} login and registration has not been enabled by administrator", providerParams(provider.GetName())).Error(), pendingFlow.Intent, payload, providerName)
		return
	}
	if errorCode := c.Query("error"); errorCode != "" {
		flow, err := model.ConsumeAuthFlow(state, match)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": common.NewMessage("State parameter is empty or mismatched").Error()})
			return
		}
		errorDescription := c.Query("error_description")
		if errorDescription == "" {
			errorDescription = errorCode
		}
		result := "failed"
		if errorCode == "access_denied" {
			result = "cancelled"
		}
		if writeOAuthFlowFailure(c, flow.Intent, payload, providerName, result, errorDescription) {
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": errorDescription})
		return
	}
	token, err := provider.ExchangeToken(c.Request.Context(), c.Query("code"), c)
	if err != nil {
		if providerName == "telegram" && payload.OriginHost == "" {
			writeSecurityOperationError(c, err)
		} else {
			handleOAuthFlowError(c, err, pendingFlow.Intent, payload, providerName)
		}
		return
	}
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		if providerName == "telegram" && payload.OriginHost == "" {
			writeSecurityOperationError(c, err)
		} else {
			handleOAuthFlowError(c, err, pendingFlow.Intent, payload, providerName)
		}
		return
	}
	if pendingFlow.Intent == model.AuthFlowIntentBind {
		bindSucceeded, notificationFailed = handleOAuthBind(c, providerName, provider, oauthUser, pendingFlow, state, match, identity, payload, deferDomainBind)
		return
	}
	flow, err := model.ConsumeAuthFlow(state, match)
	if err != nil {
		writeAccountStatusError(c, http.StatusForbidden, "State parameter is empty or mismatched")
		return
	}
	switch flow.Intent {
	case model.AuthFlowIntentLogin:
		handleOAuthLogin(c, provider, oauthUser, token, flow)
	case model.AuthFlowIntentVerify:
		handleOAuthVerification(c, providerName, oauthUser, flow)
	}
}

func handleOAuthVerification(c *gin.Context, provider string, oauthUser *oauth.OAuthUser, flow *model.AuthFlow) {
	var payload oauthFlowPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	identity, _ := middleware.GetSessionAuthIdentity(c)
	proof, err := service.FinishOAuthVerification(identity, provider, oauthUser.ProviderUserID, payload.Verification)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	recordUserSecurityAudit(c, identity.UserID, "user.security_verify", map[string]any{"method": proof.Method, "scope": proof.Scope, "provider": provider})
	common.ApiSuccess(c, proof)
}

func handleOAuthLogin(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser, token *oauth.OAuthToken, flow *model.AuthFlow) {
	var payload oauthFlowPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	user, migration, err := findOrCreateOAuthUser(c, provider, oauthUser, token, payload.AffiliateCode, payload.DomainID)
	if err != nil {
		if flow.Provider == "telegram" && payload.OriginHost == "" {
			writeSecurityOperationError(c, err)
			return
		}
		message := err.Error()
		switch {
		case errors.Is(err, model.ErrEmailAlreadyTaken):
			message = common.NewMessage("Email address is already in use").Error()
		default:
			switch err.(type) {
			case *OAuthUserDeletedError:
				message = common.NewMessage("User has been deleted").Error()
			case *OAuthRegistrationDisabledError:
				message = common.NewMessage("New user registration has been disabled by administrator").Error()
			case *OAuthEmailAlreadyTakenError:
				message = common.NewMessage("Email address is already in use").Error()
			case *OAuthLegacyBindingNotConfirmedError:
				message = common.NewMessage("This {{provider}} account cannot be linked to an existing account automatically, please sign in or register another way and then link {{provider}} in account settings", providerParams(provider.GetName())).Error()
			}
		}
		handleOAuthFlowMessage(c, message, flow.Intent, payload, flow.Provider)
		return
	}
	if user.Status != common.UserStatusEnabled {
		handleOAuthFlowMessage(c, common.NewMessage("User has been banned").Error(), flow.Intent, payload, flow.Provider)
		return
	}
	if payload.OriginHost != "" {
		// The origin-side ticket directly creates a session. Until the second-factor
		// ceremony can be transferred across Hosts, never allow it to bypass MFA.
		state, err := model.GetUserVerificationState(user.Id)
		if err != nil || state.HasTwoFA || state.HasPasskey || migration != nil {
			handleOAuthFlowMessage(c, common.NewMessage("State parameter is empty or mismatched").Error(), flow.Intent, payload, flow.Provider)
			return
		}
	}
	if issued, err := issueDomainLoginHandoff(c, user.Id, flow.Provider, payload); err != nil {
		handleOAuthFlowError(c, err, flow.Intent, payload, flow.Provider)
		return
	} else if issued {
		return
	}
	setupLogin(user, migration, c)
}

// handleOAuthBind rechecks the proof after the provider round trip and
// atomically consumes a same-origin flow with its binding mutation.
func handleOAuthBind(c *gin.Context, providerName string, provider oauth.Provider, oauthUser *oauth.OAuthUser, flow *model.AuthFlow, state string, match model.AuthFlowMatch, identity service.AuthIdentity, payload oauthFlowPayload, deferDomainBind bool) (bool, bool) {
	context, err := common.Marshal(service.AccountBindingContext{Provider: providerName})
	if err != nil {
		writeSecurityOperationError(c, err)
		return false, false
	}
	if err := service.ValidateFlowAuthorization(identity, service.VerificationOperation{Scope: service.VerificationScopeAccountBind, Context: context}, payload.Authorization); err != nil {
		writeSecurityOperationError(c, err)
		return false, false
	}
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		handleOAuthFlowMessage(c, common.NewMessage("This {{provider}} account has already been bound", providerParams(provider.GetName())).Error(), flow.Intent, payload, providerName)
		return false, false
	}
	if deferDomainBind {
		if _, err := model.ConsumeAuthFlow(state, match); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": common.NewMessage("State parameter is empty or mismatched").Error()})
			return false, false
		}
		if err := issueDomainBindHandoff(c, provider, oauthUser, flow, payload); err != nil {
			handleOAuthFlowError(c, err, flow.Intent, payload, providerName)
		}
		return false, false
	}
	_, err = model.ConsumeAuthFlowWithAction(state, match, func(tx *gorm.DB, _ *model.AuthFlow) error {
		if providerName == "telegram" {
			return model.BindTelegramForSessionWithTx(tx, identity.SessionIdentity(), oauthUser.ProviderUserID)
		}
		if custom, ok := provider.(*oauth.GenericOAuthProvider); ok {
			return model.UpdateUserOAuthBindingForSessionWithTx(tx, identity.SessionIdentity(), custom.GetProviderId(), oauthUser.ProviderUserID)
		}
		return model.UpdateUserBindColumnForSessionWithTx(tx, identity.SessionIdentity(), provider.ProviderUserIDColumn(), oauthUser.ProviderUserID)
	})
	if err != nil {
		writeSecurityOperationError(c, err)
		return false, false
	}
	user, err := model.GetUserById(identity.UserID, false)
	if err != nil {
		writeSecurityOperationError(c, err)
		return true, true
	}
	notificationFailed := service.NotifyAccountSecurityChange(service.AccountMailLanguage(c, user.Id), user.Email, i18n.MsgSecurityEventLoginLinked, map[string]any{"Provider": provider.GetName()}) != nil
	common.ApiSuccessT(c, "Binding successful", gin.H{"action": "bind", "notification_warning": notificationFailed})
	return true, notificationFailed
}

// findOrCreateOAuthUser keeps the upstream legacy-binding verification while
// applying the fork's promotion-domain inviter to new accounts.
func findOrCreateOAuthUser(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser, token *oauth.OAuthToken, affiliateCode string, domainID int64) (*model.User, *service.LegacyGitHubMigration, error) {
	user := &model.User{}
	if provider.ProviderUserIDColumn() == "telegram_id" {
		err := provider.FillUserByProviderID(user, oauthUser.ProviderUserID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, oauth.ErrTelegramAccountNotBound
		}
		return user, nil, err
	}

	// Check if user already exists with new ID
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		err := provider.FillUserByProviderID(user, oauthUser.ProviderUserID)
		if err != nil {
			return nil, nil, err
		}
		// Check if user has been deleted
		if user.Id == 0 {
			return nil, nil, &OAuthUserDeletedError{}
		}
		return user, nil, nil
	}

	// Legacy GitHub bindings stored the login name, which only points at a
	// candidate account. Values that are all digits are already numeric account
	// IDs and never take part in the comparison.
	legacyID, _ := oauthUser.Extra["legacy_id"].(string)
	if strings.ContainsFunc(legacyID, func(r rune) bool { return r < '0' || r > '9' }) && provider.IsUserIDTaken(legacyID) {
		if err := provider.FillUserByProviderID(user, legacyID); err != nil {
			return nil, nil, err
		}
		if user.Id != 0 {
			state, err := model.GetUserVerificationState(user.Id)
			if err != nil {
				return nil, nil, err
			}
			if state.HasTwoFA || state.HasPasskey {
				// The rewrite is written in the transaction that issues the session
				// once the login verification completes.
				return user, &service.LegacyGitHubMigration{GitHubID: oauthUser.ProviderUserID, LegacyID: legacyID}, nil
			}
			// Without a second factor, one of the addresses the provider has
			// confirmed must match the account email. The list is fetched only here
			// and never recorded.
			reason, matched := "no_matching_evidence", false
			if emailProvider, ok := provider.(oauth.VerifiedEmailProvider); ok && user.Email != "" {
				emails, err := emailProvider.GetVerifiedEmails(c.Request.Context(), token)
				if err != nil {
					common.SysError(common.LogText("[OAuth] Failed to load verified emails for user %d: %s", user.Id, err.Error()))
					reason = "verified_emails_unavailable"
				}
				accountEmail := model.NormalizeEmail(user.Email)
				matched = slices.ContainsFunc(emails, func(email string) bool { return model.NormalizeEmail(email) == accountEmail })
			}
			if !matched {
				recordLegacyGitHubBindingAudit(c, user, false, map[string]any{"legacy_id": legacyID, "provider_user_id": oauthUser.ProviderUserID, "reason": reason})
				return nil, nil, &OAuthLegacyBindingNotConfirmedError{}
			}
			written := false
			err = model.DB.Transaction(func(tx *gorm.DB) error {
				var err error
				written, err = model.MigrateLegacyGitHubBindingWithTx(tx, user.Id, legacyID, oauthUser.ProviderUserID)
				return err
			})
			if err != nil {
				return nil, nil, err
			}
			if written {
				user.GitHubId = oauthUser.ProviderUserID
				notificationFailed := service.NotifyAccountSecurityChange(service.AccountMailLanguage(c, user.Id), user.Email, i18n.MsgSecurityEventLoginLinked, map[string]any{"Provider": provider.GetName()}) != nil
				recordLegacyGitHubBindingAudit(c, user, true, map[string]any{
					"legacy_id": legacyID, "provider_user_id": oauthUser.ProviderUserID,
					"verified_email_matched": true, "notification_failed": notificationFailed,
				})
			}
			return user, nil, nil
		}
	}

	// User doesn't exist, create new user if registration is enabled
	if !common.RegisterEnabled {
		return nil, nil, &OAuthRegistrationDisabledError{}
	}

	// Set up new user
	user.Username = provider.GetProviderPrefix() + strconv.Itoa(model.GetMaxUserId()+1)

	if oauthUser.Username != "" {
		if exists, err := model.CheckUserExistOrDeleted(oauthUser.Username, ""); err == nil && !exists {
			// 防止索引退化
			if len(oauthUser.Username) <= model.UserNameMaxLength {
				user.Username = oauthUser.Username
			}
		}
	}

	if oauthUser.DisplayName != "" {
		user.DisplayName = oauthUser.DisplayName
	} else if oauthUser.Username != "" {
		user.DisplayName = oauthUser.Username
	} else {
		user.DisplayName = provider.GetName() + " User"
	}
	if oauthUser.Email != "" {
		user.Email = model.NormalizeEmail(oauthUser.Email)
		if err := model.EnsureEmailAvailable(user.Email, 0); err != nil {
			if errors.Is(err, model.ErrEmailAlreadyTaken) {
				return nil, nil, &OAuthEmailAlreadyTakenError{}
			}
			return nil, nil, err
		}
	}
	user.Role = common.RoleCommonUser
	user.Status = common.UserStatusEnabled

	// Handle affiliate code
	inviterId, err := service.ResolveRegistrationInviter(affiliateCode, domainID)
	if err != nil {
		return nil, nil, err
	}
	user.InviterId = inviterId

	// Use transaction to ensure user creation and OAuth binding are atomic
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		// Custom provider: create user and binding in a transaction
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			// Create user
			if err := user.InsertWithTx(tx, inviterId); err != nil {
				return err
			}

			// Create OAuth binding
			binding := &model.UserOAuthBinding{
				UserId:         user.Id,
				ProviderId:     genericProvider.GetProviderId(),
				ProviderUserId: oauthUser.ProviderUserID,
			}
			if err := model.CreateUserOAuthBindingWithTx(tx, binding); err != nil {
				return err
			}

			return nil
		})
		if err != nil {
			return nil, nil, err
		}

		// Perform post-transaction tasks (logs, sidebar config, inviter rewards)
		user.FinalizeOAuthUserCreation(inviterId)
	} else {
		// Built-in provider: create user and update provider ID in a transaction
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			// Create user
			if err := user.InsertWithTx(tx, inviterId); err != nil {
				return err
			}

			// Set the provider user ID on the user model and update
			provider.SetProviderUserID(user, oauthUser.ProviderUserID)
			if err := tx.Model(user).Updates(map[string]any{
				"github_id":   user.GitHubId,
				"discord_id":  user.DiscordId,
				"oidc_id":     user.OidcId,
				"linux_do_id": user.LinuxDOId,
				"wechat_id":   user.WeChatId,
				"telegram_id": user.TelegramId,
			}).Error; err != nil {
				return err
			}

			return nil
		})
		if err != nil {
			return nil, nil, err
		}

		// Perform post-transaction tasks
		user.FinalizeOAuthUserCreation(inviterId)
	}

	return user, nil, nil
}

// recordLegacyGitHubBindingAudit records the outcome of a legacy GitHub binding
// rewrite as an account binding event. No session exists yet on the login path,
// so the row carries the user's own role instead of the request context.
func recordLegacyGitHubBindingAudit(c *gin.Context, user *model.User, success bool, params map[string]any) {
	params["provider"], params["legacy_migration"], params["success"] = "github", true, success
	model.RecordOperationAuditLog(user.Id, user.Role, auditContentEN("user.binding_bind", params), c.ClientIP(), "user.binding_bind", params, nil, &model.AuditRequestInfo{
		Method: c.Request.Method, Route: c.FullPath(), Path: c.FullPath(), Status: c.Writer.Status(), Success: success,
	}, c)
}

// Error types for OAuth
type OAuthUserDeletedError struct{}

func (e *OAuthUserDeletedError) Error() string {
	return "user has been deleted"
}

type OAuthRegistrationDisabledError struct{}

func (e *OAuthRegistrationDisabledError) Error() string {
	return "registration is disabled"
}

type OAuthEmailAlreadyTakenError struct{}

func (e *OAuthEmailAlreadyTakenError) Error() string {
	return "email is already in use"
}

// OAuthLegacyBindingNotConfirmedError rejects an unconfirmed historical GitHub identity.
type OAuthLegacyBindingNotConfirmedError struct{}

func (e *OAuthLegacyBindingNotConfirmedError) Error() string {
	return "legacy binding was not confirmed"
}

func handleOAuthFlowError(c *gin.Context, err error, intent string, payload oauthFlowPayload, provider string) {
	handleOAuthFlowMessage(c, oauthErrorMessage(c, err), intent, payload, provider)
}

func handleOAuthFlowMessage(c *gin.Context, message, intent string, payload oauthFlowPayload, provider string) {
	if writeOAuthFlowFailure(c, intent, payload, provider, "failed", message) {
		return
	}
	common.ApiErrorMsg(c, message)
}

func oauthErrorMessage(c *gin.Context, err error) string {
	switch e := err.(type) {
	case *oauth.OAuthError:
		return e.Message.Error()
	case *oauth.AccessDeniedError:
		return e.Message
	case *oauth.TrustLevelError:
		return common.NewMessage("Linux DO trust level does not meet the minimum required by administrator").Error()
	default:
		return common.NewMessage("State parameter is empty or mismatched").Error()
	}
}
