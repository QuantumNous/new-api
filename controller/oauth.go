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
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const oauthAuthFlowTTL = 10 * time.Minute

type oauthStateRequest struct {
	Provider string `json:"provider"`
	Intent   string `json:"intent"`
	Aff      string `json:"aff,omitempty"`
}

type oauthFlowPayload struct {
	AffiliateCode string `json:"affiliate_code,omitempty"`
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
	if request.Intent == model.AuthFlowIntentBind {
		identity, ok := middleware.GetSessionAuthIdentity(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "绑定操作需要登录"})
			return
		}
		userID = identity.UserID
		sessionID = identity.SessionID
	}
	payload, err := common.Marshal(oauthFlowPayload{AffiliateCode: request.Aff})
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

// HandleOAuth handles OAuth callback for all standard OAuth providers
func HandleOAuth(c *gin.Context) {
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

	consumeMatch := model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeOAuth,
		Provider: providerName,
		Intent:   pendingFlow.Intent,
	}
	// 2. Bind flows are bound to the live dashboard Session that created them.
	if pendingFlow.Intent == model.AuthFlowIntentBind {
		identity, ok := middleware.GetSessionAuthIdentity(c)
		if !ok || identity.UserID != pendingFlow.UserId || identity.SessionID != pendingFlow.SessionId {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": i18n.T(c, i18n.MsgOAuthStateInvalid),
			})
			return
		}
		consumeMatch.UserId = identity.UserID
		consumeMatch.SessionId = identity.SessionID
	} else if pendingFlow.Intent != model.AuthFlowIntentLogin {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// 3. Check if provider is enabled
	if !provider.IsEnabled() {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams(provider.GetName()))
		return
	}

	// 4. Handle error from provider
	errorCode := c.Query("error")
	if errorCode != "" {
		if _, err := model.ConsumeAuthFlow(state, consumeMatch); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": i18n.T(c, i18n.MsgOAuthStateInvalid)})
			return
		}
		errorDescription := c.Query("error_description")
		if errorDescription == "" {
			errorDescription = errorCode
		}
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": errorDescription,
		})
		return
	}
	if pendingFlow.Intent == model.AuthFlowIntentBind {
		handleOAuthBind(c, provider, pendingFlow, state)
		return
	}

	// 5. Exchange code for token
	code := c.Query("code")
	token, err := provider.ExchangeToken(c.Request.Context(), code, c)
	if err != nil {
		handleOAuthError(c, err)
		return
	}

	// 6. Get user info
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		handleOAuthError(c, err)
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
	user, err := findOrCreateOAuthUser(c, provider, oauthUser, payload.AffiliateCode)
	if err != nil {
		if errors.Is(err, model.ErrEmailAlreadyTaken) {
			common.ApiErrorI18n(c, i18n.MsgUserEmailAlreadyTaken)
			return
		}
		switch err.(type) {
		case *OAuthUserDeletedError:
			common.ApiErrorI18n(c, i18n.MsgOAuthUserDeleted)
		case *OAuthRegistrationDisabledError:
			common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
		case *OAuthEmailAlreadyTakenError:
			common.ApiErrorI18n(c, i18n.MsgUserEmailAlreadyTaken)
		case *OAuthRegistrationCodeRequiredError:
			startOAuthRegistrationFlow(c, providerName, err.(*OAuthRegistrationCodeRequiredError))
		default:
			common.ApiError(c, err)
		}
		return
	}

	// 8. Check user status
	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}

	// 9. Setup login
	setupLogin(user, c)
}

// handleOAuthBind handles binding OAuth account to existing user
func handleOAuthBind(c *gin.Context, provider oauth.Provider, pendingFlow *model.AuthFlow, flowToken string) {
	// Exchange code for token
	code := c.Query("code")
	token, err := provider.ExchangeToken(c.Request.Context(), code, c)
	if err != nil {
		handleOAuthError(c, err)
		return
	}

	// Get user info
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		handleOAuthError(c, err)
		return
	}

	// Check if this OAuth account is already bound (check both new ID and legacy ID)
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
		return
	}
	// Also check legacy ID to prevent duplicate bindings during migration period
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && legacyID != "" {
		if provider.IsUserIDTaken(legacyID) {
			common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
			return
		}
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

	user := model.User{Id: pendingFlow.UserId}
	err = user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// Handle binding based on provider type
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		// Custom provider: use user_oauth_bindings table
		err = model.UpdateUserOAuthBinding(user.Id, genericProvider.GetProviderId(), oauthUser.ProviderUserID)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		// Built-in provider: update user record directly
		provider.SetProviderUserID(&user, oauthUser.ProviderUserID)
		err = user.Update(false)
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
func findOrCreateOAuthUser(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser, affiliateCode string) (*model.User, error) {
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

	// When registration codes are required, defer user creation until the code
	// is submitted via CompleteOAuthRegistration. Existing users never reach here.
	if common.RegistrationCodeEnabled {
		return nil, &OAuthRegistrationCodeRequiredError{
			OAuthUser:     oauthUser,
			AffiliateCode: affiliateCode,
		}
	}

	// Handle affiliate code
	inviterId := 0
	if affiliateCode != "" {
		inviterId, _ = model.GetUserIdByAffCode(affiliateCode)
	}

	err := model.DB.Transaction(func(tx *gorm.DB) error {
		return createOAuthUserWithTx(tx, provider, oauthUser, user, inviterId)
	})
	if err != nil {
		return nil, err
	}

	// Perform post-transaction tasks (logs, sidebar config, inviter rewards)
	user.FinalizeOAuthUserCreation(inviterId)

	return user, nil
}

// createOAuthUserWithTx populates user and creates it together with its OAuth
// binding inside the caller's transaction. Callers must run
// user.FinalizeOAuthUserCreation(inviterId) after the transaction commits.
func createOAuthUserWithTx(tx *gorm.DB, provider oauth.Provider, oauthUser *oauth.OAuthUser, user *model.User, inviterId int) error {
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
				return &OAuthEmailAlreadyTakenError{}
			}
			return err
		}
	}
	user.Role = common.RoleCommonUser
	user.Status = common.UserStatusEnabled

	if err := user.InsertWithTx(tx, inviterId); err != nil {
		return err
	}

	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		// Custom provider: use user_oauth_bindings table
		binding := &model.UserOAuthBinding{
			UserId:         user.Id,
			ProviderId:     genericProvider.GetProviderId(),
			ProviderUserId: oauthUser.ProviderUserID,
		}
		return model.CreateUserOAuthBindingWithTx(tx, binding)
	}

	// Built-in provider: set the provider user ID on the user record directly
	provider.SetProviderUserID(user, oauthUser.ProviderUserID)
	return tx.Model(user).Updates(map[string]interface{}{
		"github_id":   user.GitHubId,
		"discord_id":  user.DiscordId,
		"oidc_id":     user.OidcId,
		"linux_do_id": user.LinuxDOId,
		"wechat_id":   user.WeChatId,
		"telegram_id": user.TelegramId,
	}).Error
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

// OAuthRegistrationCodeRequiredError signals that the OAuth identity is new
// and must submit a registration code before the account is created.
type OAuthRegistrationCodeRequiredError struct {
	OAuthUser     *oauth.OAuthUser
	AffiliateCode string
}

func (e *OAuthRegistrationCodeRequiredError) Error() string {
	return "registration code is required"
}

// oauthRegisterFlowPayload is persisted in the pending oauth_register auth
// flow between the OAuth callback and registration code submission.
type oauthRegisterFlowPayload struct {
	ProviderUserID string `json:"provider_user_id"`
	Username       string `json:"username,omitempty"`
	DisplayName    string `json:"display_name,omitempty"`
	Email          string `json:"email,omitempty"`
	AffiliateCode  string `json:"affiliate_code,omitempty"`
}

// startOAuthRegistrationFlow stores the resolved OAuth identity in a pending
// auth flow and asks the client for a registration code.
func startOAuthRegistrationFlow(c *gin.Context, providerName string, e *OAuthRegistrationCodeRequiredError) {
	payload, err := common.Marshal(oauthRegisterFlowPayload{
		ProviderUserID: e.OAuthUser.ProviderUserID,
		Username:       e.OAuthUser.Username,
		DisplayName:    e.OAuthUser.DisplayName,
		Email:          e.OAuthUser.Email,
		AffiliateCode:  e.AffiliateCode,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	flowToken, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeOAuthRegister,
		Provider:  providerName,
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(oauthAuthFlowTTL),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": i18n.T(c, i18n.MsgRegistrationCodeRequired),
		"data": gin.H{
			"registration_code_required": true,
			"flow_token":                 flowToken,
		},
	})
}

// CompleteOAuthRegistration finishes a pending OAuth registration by consuming
// the auth flow, creating the user and consuming the registration code in one
// transaction. On failure the flow stays unconsumed so the user can retry.
func CompleteOAuthRegistration(c *gin.Context) {
	var request struct {
		FlowToken        string `json:"flow_token"`
		RegistrationCode string `json:"registration_code"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	request.FlowToken = strings.TrimSpace(request.FlowToken)
	request.RegistrationCode = strings.TrimSpace(request.RegistrationCode)
	if request.FlowToken == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if request.RegistrationCode == "" {
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeRequired)
		return
	}

	user := &model.User{}
	inviterId := 0
	_, err := model.ConsumeAuthFlowWithAction(request.FlowToken, model.AuthFlowMatch{
		Purpose: model.AuthFlowPurposeOAuthRegister,
	}, func(tx *gorm.DB, flow *model.AuthFlow) error {
		var payload oauthRegisterFlowPayload
		if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil {
			return err
		}
		provider := oauth.GetProvider(flow.Provider)
		if provider == nil || !provider.IsEnabled() {
			return model.ErrAuthFlowInvalid
		}
		// Re-check the outer registration gate: turning it off must also stop
		// pending OAuth registrations.
		if !common.RegisterEnabled {
			return &OAuthRegistrationDisabledError{}
		}
		// The same OAuth account may have completed registration in another
		// flow meanwhile.
		if provider.IsUserIDTaken(payload.ProviderUserID) {
			return model.ErrAuthFlowInvalid
		}
		if payload.AffiliateCode != "" {
			inviterId, _ = model.GetUserIdByAffCode(payload.AffiliateCode)
		}
		oauthUser := &oauth.OAuthUser{
			ProviderUserID: payload.ProviderUserID,
			Username:       payload.Username,
			DisplayName:    payload.DisplayName,
			Email:          payload.Email,
		}
		if err := createOAuthUserWithTx(tx, provider, oauthUser, user, inviterId); err != nil {
			return err
		}
		return model.ConsumeRegistrationCodeWithTx(tx, request.RegistrationCode, user.Id)
	})
	if err != nil {
		switch {
		case errors.Is(err, model.ErrAuthFlowInvalid), errors.Is(err, model.ErrAuthFlowExpired), errors.Is(err, model.ErrAuthFlowConsumed):
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": i18n.T(c, i18n.MsgOAuthStateInvalid)})
		default:
			switch err.(type) {
			case *OAuthRegistrationDisabledError:
				common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
			case *OAuthEmailAlreadyTakenError:
				common.ApiErrorI18n(c, i18n.MsgUserEmailAlreadyTaken)
			default:
				apiErrorRegistrationCode(c, err)
			}
		}
		return
	}

	user.FinalizeOAuthUserCreation(inviterId)

	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}

	setupLogin(user, c)
}

// handleOAuthError handles OAuth errors and returns translated message
func handleOAuthError(c *gin.Context, err error) {
	switch e := err.(type) {
	case *oauth.OAuthError:
		if e.Params != nil {
			common.ApiErrorI18n(c, e.MsgKey, e.Params)
		} else {
			common.ApiErrorI18n(c, e.MsgKey)
		}
	case *oauth.AccessDeniedError:
		common.ApiErrorMsg(c, e.Message)
	case *oauth.TrustLevelError:
		common.ApiErrorI18n(c, i18n.MsgOAuthTrustLevelLow)
	default:
		common.ApiError(c, err)
	}
}
