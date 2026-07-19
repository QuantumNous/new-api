package controller

import (
	"crypto/subtle"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const oauthStateTTL = 10 * time.Minute

var errOAuthStateInvalid = errors.New("invalid OAuth state")

type oauthRegistrationState struct {
	AffCode        string
	InvitationCode string
}

type oauthStateRequest struct {
	AffCode        string `json:"aff"`
	Provider       string `json:"provider"`
	InvitationCode string `json:"invitation_code"`
}

// providerParams returns map with Provider key for i18n templates
func providerParams(name string) map[string]any {
	return map[string]any{"Provider": name}
}

func builtInOAuthIdentityProviderKey(providerName string, provider oauth.Provider) (string, bool) {
	if _, custom := provider.(*oauth.GenericOAuthProvider); custom {
		return "", false
	}
	providerKey := strings.ToLower(strings.TrimSpace(providerName))
	return providerKey, providerKey != ""
}

func findOAuthUserBySubject(providerName string, provider oauth.Provider, providerSubject string) (*model.User, error) {
	if providerSubject == "" {
		return nil, gorm.ErrRecordNotFound
	}
	if providerKey, builtIn := builtInOAuthIdentityProviderKey(providerName, provider); builtIn {
		user, err := model.GetUserByAuthIdentity(providerKey, providerSubject)
		if err == nil {
			return user, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if !provider.IsUserIDTaken(providerSubject) {
			return nil, gorm.ErrRecordNotFound
		}
		legacyUser := &model.User{}
		if err := provider.FillUserByProviderID(legacyUser, providerSubject); err != nil {
			return nil, err
		}
		if legacyUser.Id == 0 {
			return nil, &OAuthUserDeletedError{}
		}
		if err := model.EnsureAuthIdentity(legacyUser.Id, providerKey, providerSubject); err != nil {
			if errors.Is(err, model.ErrAuthIdentityAlreadyBound) {
				return model.GetUserByAuthIdentity(providerKey, providerSubject)
			}
			return nil, err
		}
		return legacyUser, nil
	}

	if !provider.IsUserIDTaken(providerSubject) {
		return nil, gorm.ErrRecordNotFound
	}
	user := &model.User{}
	if err := provider.FillUserByProviderID(user, providerSubject); err != nil {
		return nil, err
	}
	if user.Id == 0 {
		return nil, &OAuthUserDeletedError{}
	}
	return user, nil
}

func generateOAuthUsername(prefix string) (string, error) {
	const randomLength = 10
	prefix = strings.ToLower(strings.TrimSpace(prefix))
	if prefix == "" {
		prefix = "oauth_"
	}
	maxPrefixLength := model.UserNameMaxLength - randomLength
	if len(prefix) > maxPrefixLength {
		prefix = prefix[:maxPrefixLength]
	}
	randomPart, err := common.GenerateRandomCharsKey(randomLength)
	if err != nil {
		return "", err
	}
	return prefix + strings.ToLower(randomPart), nil
}

// GenerateOAuthCode generates a state code for OAuth CSRF protection
func GenerateOAuthCode(c *gin.Context) {
	session := sessions.Default(c)
	request, err := parseOAuthStateRequest(c)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	providerName := strings.ToLower(strings.TrimSpace(request.Provider))
	invitationCode := strings.TrimSpace(request.InvitationCode)
	if providerName == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if utf8.RuneCountInString(invitationCode) > common.InvitationCodeMaxLength {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	state, err := common.GenerateRandomCharsKey(48)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	affCode := request.AffCode
	createdAt := time.Now().UTC()
	if err := model.CreateOAuthStateGrant(state, providerName, createdAt.Add(oauthStateTTL)); err != nil {
		common.ApiError(c, err)
		return
	}
	session.Delete("aff")
	if affCode != "" {
		session.Set("aff", affCode)
	}
	session.Delete("oauth_provider")
	session.Delete("oauth_invitation_code")
	session.Delete("oauth_invitation_created_at")
	if providerName != "" {
		session.Set("oauth_provider", providerName)
	}
	if invitationCode != "" {
		session.Set("oauth_invitation_code", invitationCode)
		session.Set("oauth_invitation_created_at", createdAt.Unix())
	}
	session.Set("oauth_state", state)
	session.Set("oauth_state_created_at", createdAt.Unix())
	err = session.Save()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    state,
	})
}

func parseOAuthStateRequest(c *gin.Context) (oauthStateRequest, error) {
	if _, present := c.Request.URL.Query()["invitation_code"]; present {
		return oauthStateRequest{}, errors.New("invitation code must be sent in the request body")
	}
	if c.Request.Method == http.MethodGet {
		// Keep the legacy, invitation-free GET flow for login/binding clients. An
		// invitation code must travel in a POST body so it cannot be copied into
		// browser history, reverse-proxy access logs, or referrer URLs.
		return oauthStateRequest{
			AffCode:  c.Query("aff"),
			Provider: c.Query("provider"),
		}, nil
	}
	if c.Request.Method != http.MethodPost {
		return oauthStateRequest{}, errors.New("unsupported OAuth state request method")
	}

	request := oauthStateRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		return oauthStateRequest{}, err
	}
	return request, nil
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

	session := sessions.Default(c)

	// 1. Validate and consume state (CSRF protection)
	state := c.Query("state")
	registrationState, err := takeOAuthRegistrationState(session, state, providerName, common.GetTimestamp())
	if errors.Is(err, errOAuthStateInvalid) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgOAuthStateInvalid),
		})
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 2. Check if user is already logged in (bind flow)
	username := session.Get("username")
	if username != nil {
		handleOAuthBind(c, provider)
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
		errorDescription := c.Query("error_description")
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": errorDescription,
		})
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

	// 7. Find or create user
	user, err := findOrCreateOAuthUser(providerName, provider, oauthUser, registrationState)
	if err != nil {
		if errors.Is(err, service.ErrInvitationCodeRejected) {
			common.ApiErrorI18n(c, i18n.MsgInvitationInvalid)
			return
		}
		if errors.Is(err, service.ErrRegistrationTemporarilyUnavailable) {
			common.SysError("OAuth registration temporarily unavailable: " + err.Error())
			common.ApiErrorI18n(c, i18n.MsgRetryLater)
			return
		}
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

func takeOAuthRegistrationState(session sessions.Session, state string, providerName string, now int64) (oauthRegistrationState, error) {
	storedState, ok := session.Get("oauth_state").(string)
	if state == "" || !ok || subtle.ConstantTimeCompare([]byte(state), []byte(storedState)) != 1 {
		return oauthRegistrationState{}, errOAuthStateInvalid
	}
	createdAt, validTimestamp := oauthStateCreatedAt(session.Get("oauth_state_created_at"))
	if !validTimestamp || now < createdAt || now-createdAt > int64(oauthStateTTL/time.Second) {
		clearOAuthRegistrationState(session)
		if err := session.Save(); err != nil {
			return oauthRegistrationState{}, err
		}
		return oauthRegistrationState{}, errOAuthStateInvalid
	}

	pending := oauthRegistrationState{}
	if affCode, ok := session.Get("aff").(string); ok {
		pending.AffCode = affCode
	}
	storedProvider, _ := session.Get("oauth_provider").(string)
	normalizedProvider := strings.ToLower(strings.TrimSpace(providerName))
	if normalizedProvider == "" || storedProvider == "" || storedProvider != normalizedProvider {
		return oauthRegistrationState{}, errOAuthStateInvalid
	}

	if invitationCode, ok := session.Get("oauth_invitation_code").(string); ok && invitationCode != "" {
		createdAt, validTimestamp := oauthInvitationCreatedAt(session.Get("oauth_invitation_created_at"))
		if validTimestamp && now >= createdAt && now-createdAt <= int64(oauthStateTTL/time.Second) {
			pending.InvitationCode = invitationCode
		}
	}
	if err := model.ClaimOAuthStateGrant(state, normalizedProvider, time.Unix(now, 0)); err != nil {
		if errors.Is(err, model.ErrOAuthStateGrantInvalid) {
			return oauthRegistrationState{}, errOAuthStateInvalid
		}
		return oauthRegistrationState{}, err
	}

	clearOAuthRegistrationState(session)
	if err := session.Save(); err != nil {
		// The database grant has already been atomically consumed, so a stale
		// client cookie cannot replay it even if clearing the cookie fails.
		common.SysError("failed to clear consumed OAuth state from session: " + err.Error())
	}
	return pending, nil
}

func clearOAuthRegistrationState(session sessions.Session) {
	session.Delete("oauth_state")
	session.Delete("oauth_state_created_at")
	session.Delete("oauth_provider")
	session.Delete("oauth_invitation_code")
	session.Delete("oauth_invitation_created_at")
	session.Delete("aff")
}

func oauthStateCreatedAt(value any) (int64, bool) {
	return oauthInvitationCreatedAt(value)
}

func oauthInvitationCreatedAt(value any) (int64, bool) {
	switch timestamp := value.(type) {
	case int64:
		return timestamp, true
	case int:
		return int64(timestamp), true
	case float64:
		return int64(timestamp), true
	default:
		return 0, false
	}
}

// handleOAuthBind handles binding OAuth account to existing user
func handleOAuthBind(c *gin.Context, provider oauth.Provider) {
	if !provider.IsEnabled() {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams(provider.GetName()))
		return
	}

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

	// Get current user from session
	session := sessions.Default(c)
	id := session.Get("id")
	user := model.User{Id: id.(int)}
	err = user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// Handle binding based on provider type. Built-in identities are claimed in
	// the same database transaction as their legacy user-column update.
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		// Custom provider: use user_oauth_bindings table
		if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
			common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
			return
		}
		err = model.UpdateUserOAuthBinding(user.Id, genericProvider.GetProviderId(), oauthUser.ProviderUserID)
	} else {
		providerKey, _ := builtInOAuthIdentityProviderKey(c.Param("provider"), provider)
		if owner, ownerErr := findOAuthUserBySubject(c.Param("provider"), provider, oauthUser.ProviderUserID); ownerErr == nil {
			if owner.Id != user.Id {
				common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
				return
			}
		} else if !errors.Is(ownerErr, gorm.ErrRecordNotFound) {
			common.ApiError(c, ownerErr)
			return
		}
		if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && strings.TrimSpace(legacyID) != "" {
			if owner, ownerErr := findOAuthUserBySubject(c.Param("provider"), provider, legacyID); ownerErr == nil {
				if owner.Id != user.Id {
					common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
					return
				}
			} else if !errors.Is(ownerErr, gorm.ErrRecordNotFound) {
				common.ApiError(c, ownerErr)
				return
			}
		}
		err = model.SetBuiltInAuthIdentity(&user, providerKey, oauthUser.ProviderUserID)
	}
	if err != nil {
		if errors.Is(err, model.ErrAuthIdentityAlreadyBound) {
			common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
			return
		}
		common.ApiError(c, err)
		return
	}

	common.ApiSuccessI18n(c, i18n.MsgOAuthBindSuccess, gin.H{
		"action": "bind",
	})
}

// findOrCreateOAuthUser finds existing user or creates new user
func findOrCreateOAuthUser(providerName string, provider oauth.Provider, oauthUser *oauth.OAuthUser, registrationState oauthRegistrationState) (*model.User, error) {
	user, err := findOAuthUserBySubject(providerName, provider, oauthUser.ProviderUserID)
	if err == nil {
		if user.Id == 0 || user.DeletedAt.Valid {
			return nil, &OAuthUserDeletedError{}
		}
		return user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// Try to find user with legacy ID (for GitHub migration from login to numeric ID)
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && legacyID != "" {
		legacyUser, legacyErr := findOAuthUserBySubject(providerName, provider, legacyID)
		if legacyErr == nil {
			if legacyUser.Id == 0 || legacyUser.DeletedAt.Valid {
				return nil, &OAuthUserDeletedError{}
			}
			if providerKey, builtIn := builtInOAuthIdentityProviderKey(providerName, provider); builtIn {
				common.SysLog(fmt.Sprintf("[OAuth] Migrating user %d from legacy_id=%s to new_id=%s",
					legacyUser.Id, legacyID, oauthUser.ProviderUserID))
				if err := model.SetBuiltInAuthIdentity(legacyUser, providerKey, oauthUser.ProviderUserID); err != nil {
					return nil, err
				}
			}
			return legacyUser, nil
		}
		if !errors.Is(legacyErr, gorm.ErrRecordNotFound) {
			return nil, legacyErr
		}
	}

	// User doesn't exist, create new user if registration is enabled
	if !common.RegisterEnabled {
		return nil, &OAuthRegistrationDisabledError{}
	}

	// Set up new user. The fallback name uses cryptographic randomness instead
	// of MAX(id)+1, so concurrent registrations do not generate the same name.
	user = &model.User{}
	user.Username, err = generateOAuthUsername(provider.GetProviderPrefix())
	if err != nil {
		return nil, err
	}

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
	inviterId := 0
	if registrationState.AffCode != "" {
		inviterId, _ = model.GetUserIdByAffCode(registrationState.AffCode)
	}

	registrationMethod := invitationMethodForOAuthProvider(providerName, provider)
	registration := service.NewUserRegistration{
		User:           user,
		InviterID:      inviterId,
		Method:         registrationMethod,
		InvitationCode: registrationState.InvitationCode,
	}
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		registration.CreateRelated = func(tx *gorm.DB, createdUser *model.User) error {
			binding := &model.UserOAuthBinding{
				UserId:         createdUser.Id,
				ProviderId:     genericProvider.GetProviderId(),
				ProviderUserId: oauthUser.ProviderUserID,
			}
			return model.CreateUserOAuthBindingWithTx(tx, binding)
		}
	} else {
		providerKey, _ := builtInOAuthIdentityProviderKey(providerName, provider)
		registration.CreateRelated = func(tx *gorm.DB, createdUser *model.User) error {
			return model.CreateBuiltInAuthIdentityWithTx(tx, createdUser, providerKey, oauthUser.ProviderUserID)
		}
	}
	if err := service.RegisterNewUser(registration); err != nil {
		if errors.Is(err, model.ErrAuthIdentityAlreadyBound) {
			winner, winnerErr := findOAuthUserBySubject(providerName, provider, oauthUser.ProviderUserID)
			if winnerErr == nil && winner.Id != 0 && !winner.DeletedAt.Valid {
				return winner, nil
			}
		}
		return nil, err
	}

	return user, nil
}

func invitationMethodForOAuthProvider(providerName string, provider oauth.Provider) string {
	if _, ok := provider.(*oauth.GenericOAuthProvider); ok {
		return common.InvitationRegistrationMethodCustomOAuth
	}
	switch strings.ToLower(strings.TrimSpace(providerName)) {
	case common.InvitationRegistrationMethodGitHub:
		return common.InvitationRegistrationMethodGitHub
	case common.InvitationRegistrationMethodDiscord:
		return common.InvitationRegistrationMethodDiscord
	case common.InvitationRegistrationMethodLinuxDO:
		return common.InvitationRegistrationMethodLinuxDO
	case common.InvitationRegistrationMethodOIDC:
		return common.InvitationRegistrationMethodOIDC
	default:
		return providerName
	}
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
