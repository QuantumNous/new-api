package controller

import (
	"errors"
	"fmt"
	"net/http"
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

const oauthAuthFlowTTL = 10 * time.Minute

type oauthStateRequest struct {
	Provider       string `json:"provider"`
	Intent         string `json:"intent"`
	Aff            string `json:"aff,omitempty"`
	InvitationCode string `json:"invitation_code,omitempty"`
}

type oauthFlowPayload struct {
	AffiliateCode      string `json:"affiliate_code,omitempty"`
	InvitationSupplied bool   `json:"invitation_supplied,omitempty"`
	InvitationCodeID   int    `json:"invitation_code_id,omitempty"`
}

func providerParams(name string) map[string]any {
	return map[string]any{"Provider": name}
}

func oauthIdentityProviderKey(providerName string, provider oauth.Provider) (string, error) {
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		return model.AuthIdentityProviderKeyForCustomOAuth(genericProvider.GetProviderId())
	}
	providerKey := strings.ToLower(strings.TrimSpace(providerName))
	switch providerKey {
	case model.AuthIdentityProviderGitHub,
		model.AuthIdentityProviderDiscord,
		model.AuthIdentityProviderOIDC,
		model.AuthIdentityProviderLinuxDO:
		return providerKey, nil
	default:
		return "", errors.New("unsupported OAuth identity provider")
	}
}

func findOAuthUserBySubject(providerName string, provider oauth.Provider, providerSubject string) (*model.User, error) {
	if strings.TrimSpace(providerSubject) == "" {
		return nil, gorm.ErrRecordNotFound
	}
	providerKey, err := oauthIdentityProviderKey(providerName, provider)
	if err != nil {
		return nil, err
	}
	return model.GetUserByAuthIdentity(providerKey, providerSubject)
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

// GenerateOAuthCode creates the one-time AuthFlow used as OAuth state.
func GenerateOAuthCode(c *gin.Context) {
	if _, present := c.Request.URL.Query()["invitation_code"]; present {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	var request oauthStateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	request.Provider = strings.ToLower(strings.TrimSpace(request.Provider))
	request.Intent = strings.ToLower(strings.TrimSpace(request.Intent))
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
	payload := oauthFlowPayload{AffiliateCode: request.Aff}
	if request.Intent == model.AuthFlowIntentBind {
		identity, ok := middleware.GetSessionAuthIdentity(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "绑定操作需要登录"})
			return
		}
		userID = identity.UserID
		sessionID = identity.SessionID
	} else {
		invitationCode := strings.TrimSpace(request.InvitationCode)
		payload.InvitationSupplied = invitationCode != ""
		if payload.InvitationSupplied {
			invitationCodeID, err := model.ResolveInvitationCodeReference(invitationCode)
			if err != nil {
				common.ApiError(c, err)
				return
			}
			payload.InvitationCodeID = invitationCodeID
		}
	}

	payloadBytes, err := common.Marshal(payload)
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
		Payload:   string(payloadBytes),
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

// HandleOAuth handles OAuth callbacks for built-in and custom providers.
func HandleOAuth(c *gin.Context) {
	providerName := strings.ToLower(strings.TrimSpace(c.Param("provider")))
	provider := oauth.GetProvider(providerName)
	if provider == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgOAuthUnknownProvider),
		})
		return
	}

	state := c.Query("state")
	pendingFlow, err := model.GetAuthFlow(state, model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeOAuth,
		Provider: providerName,
	})
	if err != nil {
		if !errors.Is(err, model.ErrAuthFlowInvalid) &&
			!errors.Is(err, model.ErrAuthFlowExpired) &&
			!errors.Is(err, model.ErrAuthFlowConsumed) {
			common.ApiError(c, err)
			return
		}
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

	flow, err := model.ConsumeAuthFlow(state, consumeMatch)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": i18n.T(c, i18n.MsgOAuthStateInvalid)})
		return
	}
	if !provider.IsEnabled() {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams(provider.GetName()))
		return
	}

	if errorCode := c.Query("error"); errorCode != "" {
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
	if flow.Intent == model.AuthFlowIntentBind {
		handleOAuthBind(c, providerName, provider, flow)
		return
	}

	code := c.Query("code")
	token, err := provider.ExchangeToken(c.Request.Context(), code, c)
	if err != nil {
		handleOAuthError(c, err)
		return
	}
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		handleOAuthError(c, err)
		return
	}
	var payload oauthFlowPayload
	if strings.TrimSpace(flow.Payload) != "" {
		if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	user, err := findOrCreateOAuthUser(providerName, provider, oauthUser, payload)
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
	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}
	setupLogin(user, c)
}

func handleOAuthBind(c *gin.Context, providerName string, provider oauth.Provider, flow *model.AuthFlow) {
	code := c.Query("code")
	token, err := provider.ExchangeToken(c.Request.Context(), code, c)
	if err != nil {
		handleOAuthError(c, err)
		return
	}
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		handleOAuthError(c, err)
		return
	}
	user := model.User{Id: flow.UserId}
	if err := user.FillUserById(); err != nil {
		common.ApiError(c, err)
		return
	}
	for _, providerSubject := range oauthIdentitySubjects(oauthUser) {
		owner, ownerErr := findOAuthUserBySubject(providerName, provider, providerSubject)
		if ownerErr == nil {
			if owner.Id != user.Id {
				common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
				return
			}
			continue
		}
		if !errors.Is(ownerErr, gorm.ErrRecordNotFound) {
			common.ApiError(c, ownerErr)
			return
		}
	}

	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		err = model.UpdateUserOAuthBinding(user.Id, genericProvider.GetProviderId(), oauthUser.ProviderUserID)
	} else {
		providerKey, providerKeyErr := oauthIdentityProviderKey(providerName, provider)
		if providerKeyErr != nil {
			common.ApiError(c, providerKeyErr)
			return
		}
		err = model.SetBuiltInAuthIdentity(&user, providerKey, oauthUser.ProviderUserID)
	}
	if err != nil {
		if errors.Is(err, model.ErrAuthIdentityAlreadyBound) || errors.Is(err, model.ErrAuthIdentityProviderAlreadyBound) {
			common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessI18n(c, i18n.MsgOAuthBindSuccess, gin.H{"action": "bind"})
}

func oauthIdentitySubjects(oauthUser *oauth.OAuthUser) []string {
	if oauthUser == nil {
		return nil
	}
	subjects := []string{oauthUser.ProviderUserID}
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && strings.TrimSpace(legacyID) != "" && legacyID != oauthUser.ProviderUserID {
		subjects = append(subjects, legacyID)
	}
	return subjects
}

func findOrCreateOAuthUser(providerName string, provider oauth.Provider, oauthUser *oauth.OAuthUser, payload oauthFlowPayload) (*model.User, error) {
	if oauthUser == nil || strings.TrimSpace(oauthUser.ProviderUserID) == "" {
		return nil, errors.New("OAuth provider returned an empty user identity")
	}
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

	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && strings.TrimSpace(legacyID) != "" {
		legacyUser, legacyErr := findOAuthUserBySubject(providerName, provider, legacyID)
		if legacyErr == nil {
			if legacyUser.Id == 0 || legacyUser.DeletedAt.Valid {
				return nil, &OAuthUserDeletedError{}
			}
			if genericProvider, custom := provider.(*oauth.GenericOAuthProvider); custom {
				if err := model.UpdateUserOAuthBinding(legacyUser.Id, genericProvider.GetProviderId(), oauthUser.ProviderUserID); err != nil {
					return nil, err
				}
			} else {
				providerKey, providerKeyErr := oauthIdentityProviderKey(providerName, provider)
				if providerKeyErr != nil {
					return nil, providerKeyErr
				}
				if err := model.SetBuiltInAuthIdentity(legacyUser, providerKey, oauthUser.ProviderUserID); err != nil {
					return nil, err
				}
			}
			common.SysLog(fmt.Sprintf("[OAuth] migrated legacy identity for provider %s and user %d", providerName, legacyUser.Id))
			return legacyUser, nil
		}
		if !errors.Is(legacyErr, gorm.ErrRecordNotFound) {
			return nil, legacyErr
		}
	}

	if !common.RegisterEnabled {
		return nil, &OAuthRegistrationDisabledError{}
	}
	user = &model.User{}
	user.Username, err = generateOAuthUsername(provider.GetProviderPrefix())
	if err != nil {
		return nil, err
	}
	if oauthUser.Username != "" {
		if exists, checkErr := model.CheckUserExistOrDeleted(oauthUser.Username, ""); checkErr == nil && !exists && len(oauthUser.Username) <= model.UserNameMaxLength {
			user.Username = oauthUser.Username
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

	inviterID := 0
	if payload.AffiliateCode != "" {
		inviterID, _ = model.GetUserIdByAffCode(payload.AffiliateCode)
	}
	providerKey, err := oauthIdentityProviderKey(providerName, provider)
	if err != nil {
		return nil, err
	}
	createRelated := func(tx *gorm.DB, createdUser *model.User) error {
		if _, custom := provider.(*oauth.GenericOAuthProvider); custom {
			return model.CreateAuthIdentityWithTx(tx, createdUser.Id, providerKey, oauthUser.ProviderUserID)
		}
		return model.CreateBuiltInAuthIdentityWithTx(tx, createdUser, providerKey, oauthUser.ProviderUserID)
	}
	err = registerOAuthUser(user, inviterID, invitationMethodForOAuthProvider(providerName, provider), payload, createRelated)
	if err != nil {
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

func registerOAuthUser(user *model.User, inviterID int, method string, payload oauthFlowPayload, createRelated func(*gorm.DB, *model.User) error) error {
	baseUser := *user
	attemptUser := baseUser
	err := model.WithInvitationCodeSettingsTransaction(func(tx *gorm.DB, settings common.InvitationCodeSettings) error {
		attemptUser.InviterId = inviterID
		if err := attemptUser.InsertWithTx(tx, inviterID); err != nil {
			return err
		}
		if settings.Requires(method) {
			if !payload.InvitationSupplied || payload.InvitationCodeID <= 0 {
				return service.ErrInvitationCodeRejected
			}
			if _, err := model.ConsumeInvitationCodeReferenceWithTx(tx, payload.InvitationCodeID, attemptUser.Id); err != nil {
				if isOAuthInvitationRejected(err) {
					return service.ErrInvitationCodeRejected
				}
				return err
			}
		}
		if createRelated != nil {
			return createRelated(tx, &attemptUser)
		}
		return nil
	})
	if err != nil {
		if model.IsSQLiteBusyError(err) || errors.Is(err, model.ErrInvitationCodeSettingsUnavailable) {
			return fmt.Errorf("%w: %v", service.ErrRegistrationTemporarilyUnavailable, err)
		}
		return err
	}
	*user = attemptUser
	user.FinishInsert(inviterID)
	return nil
}

func isOAuthInvitationRejected(err error) bool {
	return errors.Is(err, model.ErrInvitationCodeNotProvided) ||
		errors.Is(err, model.ErrInvitationCodeInvalid) ||
		errors.Is(err, model.ErrInvitationCodeUsed) ||
		errors.Is(err, model.ErrInvitationCodeExpired) ||
		errors.Is(err, model.ErrInvitationCodeDisabled)
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
