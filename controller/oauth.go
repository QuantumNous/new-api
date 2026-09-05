package controller

import (
	"errors"
	"fmt"
	"net/http"
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
	Provider string `json:"provider"`
	Intent   string `json:"intent"`
	Aff      string `json:"aff,omitempty"`
}

type oauthFlowPayload struct {
	AffiliateCode          string `json:"affiliate_code,omitempty"`
	DomainID               int64  `json:"domain_id,omitempty"`
	OriginHost             string `json:"origin_host,omitempty"`
	BrowserBindingHash     string `json:"browser_binding_hash,omitempty"`
	ExpectedAuthVersion    int64  `json:"expected_auth_version,omitempty"`
	ExpectedSessionVersion int64  `json:"expected_session_version,omitempty"`
}

// providerParams returns map with Provider key for i18n templates
func providerParams(name string) map[string]any {
	return map[string]any{"Provider": name}
}

// GenerateOAuthCode generates a state code for OAuth CSRF protection
func GenerateOAuthCode(c *gin.Context) {
	var request oauthStateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	request.Provider = strings.TrimSpace(request.Provider)
	request.Intent = strings.TrimSpace(request.Intent)
	request.Aff = strings.TrimSpace(request.Aff)
	if oauth.GetProvider(request.Provider) == nil ||
		(request.Intent != model.AuthFlowIntentLogin && request.Intent != model.AuthFlowIntentBind) ||
		len(request.Aff) > 32 ||
		(request.Intent == model.AuthFlowIntentBind && request.Aff != "") {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	userID := 0
	sessionID := ""
	expectedAuthVersion := int64(0)
	expectedSessionVersion := int64(0)
	if request.Intent == model.AuthFlowIntentBind {
		identity, ok := middleware.GetSessionAuthIdentity(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "绑定操作需要登录"})
			return
		}
		userID = identity.UserID
		sessionID = identity.SessionID
		expectedAuthVersion = identity.UserAuthVersion
		expectedSessionVersion = identity.SessionVersion
	}
	domainID := customDomainIDFromContext(c)
	originHost := ""
	browserBindingHash := ""
	var err error
	if domainContext, found := middleware.GetCustomDomainContext(c); found &&
		(domainContext.Kind == service.CustomDomainKindCustom ||
			(domainContext.Kind == service.CustomDomainKindMain && !domainContext.IsCallbackHost)) {
		originHost = domainContext.Host
		browserBindingHash, err = ensureDomainOAuthBrowserBinding(c)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	payload, err := common.Marshal(oauthFlowPayload{
		AffiliateCode:          request.Aff,
		DomainID:               domainID,
		OriginHost:             originHost,
		BrowserBindingHash:     browserBindingHash,
		ExpectedAuthVersion:    expectedAuthVersion,
		ExpectedSessionVersion: expectedSessionVersion,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	expiresAt := time.Now().Add(oauthAuthFlowTTL)
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeOAuth,
		Provider:  request.Provider,
		Intent:    request.Intent,
		UserId:    userID,
		SessionId: sessionID,
		Payload:   string(payload),
		ExpiresAt: expiresAt,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"flow_token": state,
			"expires_at": expiresAt.Unix(),
		},
	})
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
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgOAuthUnknownProvider),
		})
		return
	}

	// 1. Validate state (CSRF protection)
	state := c.Query("state")
	pendingFlow, err := model.GetAuthFlow(state, model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeOAuth,
		Provider: providerName,
	})
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgOAuthStateInvalid),
		})
		return
	}
	var pendingPayload oauthFlowPayload
	if pendingFlow.Payload != "" {
		_ = common.UnmarshalJsonStr(pendingFlow.Payload, &pendingPayload)
	}

	consumeMatch := model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeOAuth,
		Provider: providerName,
		Intent:   pendingFlow.Intent,
	}
	deferDomainBind := false
	// 2. Bind flows are bound to the live dashboard Session that created them.
	if pendingFlow.Intent == model.AuthFlowIntentBind {
		identity, ok := middleware.GetSessionAuthIdentity(c)
		if pendingPayload.OriginHost != "" {
			targetHost, active, targetErr := resolveOAuthReturnTarget(pendingPayload)
			if targetErr != nil {
				common.ApiError(c, targetErr)
				return
			}
			if targetHost == "" || pendingPayload.BrowserBindingHash == "" || pendingPayload.ExpectedAuthVersion <= 0 || pendingPayload.ExpectedSessionVersion <= 0 {
				c.JSON(http.StatusForbidden, gin.H{
					"success": false,
					"message": i18n.T(c, i18n.MsgOAuthStateInvalid),
				})
				return
			}
			consumeMatch.UserId = pendingFlow.UserId
			consumeMatch.SessionId = pendingFlow.SessionId
			if !active {
				if _, err := model.ConsumeAuthFlow(state, consumeMatch); err != nil {
					c.JSON(http.StatusForbidden, gin.H{"success": false, "message": i18n.T(c, i18n.MsgOAuthStateInvalid)})
					return
				}
				writeDomainBindReturn(c, targetHost, providerName, "target_unavailable", i18n.T(c, i18n.MsgOAuthStateInvalid))
				return
			}
			if _, _, err := service.ValidateLoginSession(service.AuthIdentity{
				UserID:          pendingFlow.UserId,
				SessionID:       pendingFlow.SessionId,
				UserAuthVersion: pendingPayload.ExpectedAuthVersion,
				SessionVersion:  pendingPayload.ExpectedSessionVersion,
			}); err != nil {
				if _, consumeErr := model.ConsumeAuthFlow(state, consumeMatch); consumeErr != nil {
					c.JSON(http.StatusForbidden, gin.H{"success": false, "message": i18n.T(c, i18n.MsgOAuthStateInvalid)})
					return
				}
				writeDomainBindReturn(c, targetHost, providerName, "failed", i18n.T(c, i18n.MsgOAuthStateInvalid))
				return
			}
			deferDomainBind = true
		} else {
			if !ok || identity.UserID != pendingFlow.UserId || identity.SessionID != pendingFlow.SessionId {
				c.JSON(http.StatusForbidden, gin.H{
					"success": false,
					"message": i18n.T(c, i18n.MsgOAuthStateInvalid),
				})
				return
			}
			consumeMatch.UserId = identity.UserID
			consumeMatch.SessionId = identity.SessionID
		}
	} else if pendingFlow.Intent != model.AuthFlowIntentLogin {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// 3. Check if provider is enabled
	if !provider.IsEnabled() {
		handleOAuthFlowMessage(
			c,
			i18n.T(c, i18n.MsgOAuthNotEnabled, providerParams(provider.GetName())),
			pendingFlow.Intent,
			pendingPayload,
			providerName,
		)
		return
	}

	// 4. Handle error from provider
	errorCode := c.Query("error")
	if errorCode != "" {
		flow, err := model.ConsumeAuthFlow(state, consumeMatch)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": i18n.T(c, i18n.MsgOAuthStateInvalid)})
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
		if writeOAuthFlowFailure(c, flow.Intent, pendingPayload, providerName, result, errorDescription) {
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": errorDescription,
		})
		return
	}
	if pendingFlow.Intent == model.AuthFlowIntentBind {
		handleOAuthBind(c, provider, pendingFlow, state, pendingPayload, deferDomainBind)
		return
	}

	// 5. Exchange code for token
	code := c.Query("code")
	token, err := provider.ExchangeToken(c.Request.Context(), code, c)
	if err != nil {
		handleOAuthFlowError(c, err, pendingFlow.Intent, pendingPayload, providerName)
		return
	}

	// 6. Get user info
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		handleOAuthFlowError(c, err, pendingFlow.Intent, pendingPayload, providerName)
		return
	}
	flow, err := model.ConsumeAuthFlow(state, consumeMatch)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": i18n.T(c, i18n.MsgOAuthStateInvalid)})
		return
	}

	// 7. Find or create user
	var payload oauthFlowPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := findOrCreateOAuthUser(c, provider, oauthUser, payload.AffiliateCode, payload.DomainID)
	if err != nil {
		message := err.Error()
		if errors.Is(err, model.ErrEmailAlreadyTaken) {
			message = i18n.T(c, i18n.MsgUserEmailAlreadyTaken)
		} else {
			switch err.(type) {
			case *OAuthUserDeletedError:
				message = i18n.T(c, i18n.MsgOAuthUserDeleted)
			case *OAuthRegistrationDisabledError:
				message = i18n.T(c, i18n.MsgUserRegisterDisabled)
			case *OAuthEmailAlreadyTakenError:
				message = i18n.T(c, i18n.MsgUserEmailAlreadyTaken)
			}
		}
		handleOAuthFlowMessage(c, message, pendingFlow.Intent, payload, providerName)
		return
	}

	// 8. Check user status
	if user.Status != common.UserStatusEnabled {
		handleOAuthFlowMessage(c, i18n.T(c, i18n.MsgOAuthUserBanned), pendingFlow.Intent, payload, providerName)
		return
	}
	if issued, err := issueDomainLoginHandoff(c, user.Id, providerName, payload); err != nil {
		handleOAuthFlowError(c, err, pendingFlow.Intent, payload, providerName)
		return
	} else if issued {
		return
	}

	// 9. Setup login
	setupLogin(user, c)
}

// handleOAuthBind handles binding OAuth account to existing user
func handleOAuthBind(c *gin.Context, provider oauth.Provider, pendingFlow *model.AuthFlow, flowToken string, statePayload oauthFlowPayload, deferDomainBind bool) {
	// Exchange code for token
	code := c.Query("code")
	token, err := provider.ExchangeToken(c.Request.Context(), code, c)
	if err != nil {
		handleOAuthFlowError(c, err, pendingFlow.Intent, statePayload, pendingFlow.Provider)
		return
	}

	// Get user info
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		handleOAuthFlowError(c, err, pendingFlow.Intent, statePayload, pendingFlow.Provider)
		return
	}

	// Check if this OAuth account is already bound (check both new ID and legacy ID)
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		handleOAuthFlowMessage(
			c,
			i18n.T(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName())),
			pendingFlow.Intent,
			statePayload,
			pendingFlow.Provider,
		)
		return
	}
	// Also check legacy ID to prevent duplicate bindings during migration period
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && legacyID != "" {
		if provider.IsUserIDTaken(legacyID) {
			handleOAuthFlowMessage(
				c,
				i18n.T(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName())),
				pendingFlow.Intent,
				statePayload,
				pendingFlow.Provider,
			)
			return
		}
	}
	if deferDomainBind {
		if _, err := model.ConsumeAuthFlow(flowToken, model.AuthFlowMatch{
			Purpose:   model.AuthFlowPurposeOAuth,
			Provider:  pendingFlow.Provider,
			Intent:    model.AuthFlowIntentBind,
			UserId:    pendingFlow.UserId,
			SessionId: pendingFlow.SessionId,
		}); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": i18n.T(c, i18n.MsgOAuthStateInvalid)})
			return
		}
		if err := issueDomainBindHandoff(c, provider, oauthUser, pendingFlow, statePayload); err != nil {
			handleOAuthFlowError(c, err, pendingFlow.Intent, statePayload, pendingFlow.Provider)
		}
		return
	}

	if _, err := model.ConsumeAuthFlow(flowToken, model.AuthFlowMatch{
		Purpose:   model.AuthFlowPurposeOAuth,
		Provider:  pendingFlow.Provider,
		Intent:    model.AuthFlowIntentBind,
		UserId:    pendingFlow.UserId,
		SessionId: pendingFlow.SessionId,
	}); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": i18n.T(c, i18n.MsgOAuthStateInvalid)})
		return
	}

	userId := pendingFlow.UserId

	// Handle binding based on provider type
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		// Custom provider: use user_oauth_bindings table
		err = model.UpdateUserOAuthBinding(userId, genericProvider.GetProviderId(), oauthUser.ProviderUserID)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		// Built-in provider: 只更新绑定列。完整快照的 user.Update 会把读取时刻的
		// role/status/group 一并写回，覆盖并发发生的封禁、降权或分组变更。
		err = model.UpdateUserBindColumn(userId, provider.ProviderUserIDColumn(), oauthUser.ProviderUserID)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}

	common.ApiSuccessI18n(c, i18n.MsgOAuthBindSuccess, gin.H{
		"action": "bind",
	})
}

// findOrCreateOAuthUser finds existing user or creates new user
func findOrCreateOAuthUser(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser, affiliateCode string, domainID int64) (*model.User, error) {
	user := &model.User{}

	// Check if user already exists with new ID
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		err := provider.FillUserByProviderID(user, oauthUser.ProviderUserID)
		if err != nil {
			return nil, err
		}
		// Check if user has been deleted
		if user.Id == 0 {
			return nil, &OAuthUserDeletedError{}
		}
		return user, nil
	}

	// Try to find user with legacy ID (for GitHub migration from login to numeric ID)
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && legacyID != "" {
		if provider.IsUserIDTaken(legacyID) {
			err := provider.FillUserByProviderID(user, legacyID)
			if err != nil {
				return nil, err
			}
			if user.Id != 0 {
				// Found user with legacy ID, migrate to new ID
				common.SysLog(fmt.Sprintf("[OAuth] Migrating user %d from legacy_id=%s to new_id=%s",
					user.Id, legacyID, oauthUser.ProviderUserID))
				if err := user.UpdateGitHubId(oauthUser.ProviderUserID); err != nil {
					common.SysError(fmt.Sprintf("[OAuth] Failed to migrate user %d: %s", user.Id, err.Error()))
					// Continue with login even if migration fails
				}
				return user, nil
			}
		}
	}

	// User doesn't exist, create new user if registration is enabled
	if !common.RegisterEnabled {
		return nil, &OAuthRegistrationDisabledError{}
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
				return nil, &OAuthEmailAlreadyTakenError{}
			}
			return nil, err
		}
	}
	user.Role = common.RoleCommonUser
	user.Status = common.UserStatusEnabled

	// Handle affiliate code
	inviterId, err := service.ResolveRegistrationInviter(affiliateCode, domainID)
	if err != nil {
		return nil, err
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
			return nil, err
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
			if err := tx.Model(user).Updates(map[string]interface{}{
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
			return nil, err
		}

		// Perform post-transaction tasks
		user.FinalizeOAuthUserCreation(inviterId)
	}

	return user, nil
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

func handleOAuthFlowError(c *gin.Context, err error, intent string, statePayload oauthFlowPayload, provider string) {
	handleOAuthFlowMessage(c, oauthErrorMessage(c, err), intent, statePayload, provider)
}

func handleOAuthFlowMessage(c *gin.Context, message, intent string, statePayload oauthFlowPayload, provider string) {
	if writeOAuthFlowFailure(c, intent, statePayload, provider, "failed", message) {
		return
	}
	common.ApiErrorMsg(c, message)
}

func oauthErrorMessage(c *gin.Context, err error) string {
	switch e := err.(type) {
	case *oauth.OAuthError:
		if e.Params != nil {
			return i18n.T(c, e.MsgKey, e.Params)
		}
		return i18n.T(c, e.MsgKey)
	case *oauth.AccessDeniedError:
		return e.Message
	case *oauth.TrustLevelError:
		return i18n.T(c, i18n.MsgOAuthTrustLevelLow)
	default:
		return err.Error()
	}
}
