package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	passkeysvc "github.com/QuantumNous/new-api/service/passkey"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/protocol"
	webauthnlib "github.com/go-webauthn/webauthn/webauthn"
)

var (
	errPasskeySessionNotLoggedIn  = errors.New("passkey session not logged in")
	errPasskeySessionInvalid      = errors.New("passkey session invalid")
	errPasskeySessionUserDisabled = errors.New("passkey session user disabled")
)

func apiPasskeyError(c *gin.Context, err error) {
	if err == nil {
		return
	}
	switch {
	case errors.Is(err, model.ErrFriendlyPasskeyNotFound):
		common.ApiErrorI18n(c, i18n.MsgPasskeyVerifyFailed)
	case errors.Is(err, model.ErrPasskeySaveFailed):
		common.ApiErrorI18n(c, i18n.MsgPasskeySaveFailed)
	case errors.Is(err, model.ErrPasskeyDeleteFailed):
		common.ApiErrorI18n(c, i18n.MsgPasskeyDeleteFailed)
	case errors.Is(err, errPasskeySessionNotLoggedIn):
		common.ApiErrorI18n(c, i18n.MsgSecureNotLoggedIn)
	case errors.Is(err, errPasskeySessionInvalid):
		common.ApiErrorI18n(c, i18n.MsgAuthUserInfoInvalid)
	case errors.Is(err, errPasskeySessionUserDisabled):
		common.ApiErrorI18n(c, i18n.MsgUserDisabled)
	default:
		common.ApiError(c, err)
	}
}

func unauthorizedPasskeyError(c *gin.Context, err error) {
	message := i18n.T(c, i18n.MsgUnauthorized)
	switch {
	case errors.Is(err, errPasskeySessionNotLoggedIn):
		message = i18n.T(c, i18n.MsgSecureNotLoggedIn)
	case errors.Is(err, errPasskeySessionInvalid):
		message = i18n.T(c, i18n.MsgAuthUserInfoInvalid)
	case errors.Is(err, errPasskeySessionUserDisabled):
		message = i18n.T(c, i18n.MsgUserDisabled)
	}
	c.JSON(http.StatusUnauthorized, gin.H{
		"success": false,
		"message": message,
	})
}

func PasskeyRegisterBegin(c *gin.Context) {
	if !system_setting.GetPasskeySettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgPasskeyLoginDisabled)
		return
	}

	user, err := getSessionUser(c)
	if err != nil {
		unauthorizedPasskeyError(c, err)
		return
	}

	if !requirePasskeyRegistrationVerification(c, user.Id) {
		return
	}

	credential, err := model.GetPasskeyByUserID(user.Id)
	if err != nil && !errors.Is(err, model.ErrPasskeyNotFound) {
		apiPasskeyError(c, err)
		return
	}
	if errors.Is(err, model.ErrPasskeyNotFound) {
		credential = nil
	}

	wa, err := passkeysvc.BuildWebAuthn(c.Request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	waUser := passkeysvc.NewWebAuthnUser(user, credential)
	var options []webauthnlib.RegistrationOption
	if credential != nil {
		descriptor := credential.ToWebAuthnCredential().Descriptor()
		options = append(options, webauthnlib.WithExclusions([]protocol.CredentialDescriptor{descriptor}))
	}

	creation, sessionData, err := wa.BeginRegistration(waUser, options...)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if err := passkeysvc.SaveSessionData(c, passkeysvc.RegistrationSessionKey, sessionData); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"options": creation,
		},
	})
}

func PasskeyRegisterFinish(c *gin.Context) {
	if !system_setting.GetPasskeySettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgPasskeyLoginDisabled)
		return
	}

	user, err := getSessionUser(c)
	if err != nil {
		unauthorizedPasskeyError(c, err)
		return
	}

	if !requirePasskeyRegistrationVerification(c, user.Id) {
		return
	}

	wa, err := passkeysvc.BuildWebAuthn(c.Request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	credentialRecord, err := model.GetPasskeyByUserID(user.Id)
	if err != nil && !errors.Is(err, model.ErrPasskeyNotFound) {
		apiPasskeyError(c, err)
		return
	}
	if errors.Is(err, model.ErrPasskeyNotFound) {
		credentialRecord = nil
	}

	sessionData, err := passkeysvc.PopSessionData(c, passkeysvc.RegistrationSessionKey)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	waUser := passkeysvc.NewWebAuthnUser(user, credentialRecord)
	credential, err := wa.FinishRegistration(waUser, *sessionData, c.Request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	passkeyCredential := model.NewPasskeyCredentialFromWebAuthn(user.Id, credential)
	if passkeyCredential == nil {
		common.ApiErrorI18n(c, i18n.MsgPasskeyCreateFailed)
		return
	}

	if err := model.UpsertPasskeyCredential(passkeyCredential); err != nil {
		apiPasskeyError(c, err)
		return
	}

	recordUserSecurityAudit(c, user.Id, "user.passkey_register", nil)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgPasskeyRegisterSuccess),
	})
}

func PasskeyDelete(c *gin.Context) {
	user, err := getSessionUser(c)
	if err != nil {
		unauthorizedPasskeyError(c, err)
		return
	}

	if !requirePasskeyDeleteVerification(c, user.Id) {
		return
	}

	if err := model.DeletePasskeyByUserID(user.Id); err != nil {
		apiPasskeyError(c, err)
		return
	}

	recordUserSecurityAudit(c, user.Id, "user.passkey_delete", nil)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgPasskeyUnbound),
	})
}

func PasskeyStatus(c *gin.Context) {
	user, err := getSessionUser(c)
	if err != nil {
		unauthorizedPasskeyError(c, err)
		return
	}

	credential, err := model.GetPasskeyByUserID(user.Id)
	if errors.Is(err, model.ErrPasskeyNotFound) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data": gin.H{
				"enabled": false,
			},
		})
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	data := gin.H{
		"enabled":      true,
		"last_used_at": credential.LastUsedAt,
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
}

func PasskeyLoginBegin(c *gin.Context) {
	if !system_setting.GetPasskeySettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgPasskeyLoginDisabled)
		return
	}

	wa, err := passkeysvc.BuildWebAuthn(c.Request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	assertion, sessionData, err := wa.BeginDiscoverableLogin()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if err := passkeysvc.SaveSessionData(c, passkeysvc.LoginSessionKey, sessionData); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"options": assertion,
		},
	})
}

func PasskeyLoginFinish(c *gin.Context) {
	if !system_setting.GetPasskeySettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgPasskeyLoginDisabled)
		return
	}

	wa, err := passkeysvc.BuildWebAuthn(c.Request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	sessionData, err := passkeysvc.PopSessionData(c, passkeysvc.LoginSessionKey)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	handler := func(rawID, userHandle []byte) (webauthnlib.User, error) {
		// 首先通过凭证ID查找用户
		credential, err := model.GetPasskeyByCredentialID(rawID)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", i18n.T(c, i18n.MsgPasskeyCredentialNotFound), err)
		}

		// 通过凭证获取用户
		user := &model.User{Id: credential.UserID}
		if err := user.FillUserById(); err != nil {
			return nil, errors.New(i18n.T(c, i18n.MsgPasskeyUserInfoFailed, map[string]any{"Error": err.Error()}))
		}

		if user.Status != common.UserStatusEnabled {
			return nil, errors.New(i18n.T(c, i18n.MsgUserDisabled))
		}

		if len(userHandle) > 0 {
			userID, parseErr := strconv.Atoi(string(userHandle))
			if parseErr != nil {
				// 记录异常但继续验证，因为某些客户端可能使用非数字格式
				common.SysLog(fmt.Sprintf("PasskeyLogin: userHandle parse error for credential, length: %d", len(userHandle)))
			} else if userID != user.Id {
				return nil, errors.New(i18n.T(c, i18n.MsgPasskeyUserHandleMismatch))
			}
		}

		return passkeysvc.NewWebAuthnUser(user, credential), nil
	}

	waUser, credential, err := wa.FinishPasskeyLogin(handler, *sessionData, c.Request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	userWrapper, ok := waUser.(*passkeysvc.WebAuthnUser)
	if !ok {
		common.ApiErrorI18n(c, i18n.MsgPasskeyLoginAbnormal)
		return
	}

	modelUser := userWrapper.ModelUser()
	if modelUser == nil {
		common.ApiErrorI18n(c, i18n.MsgPasskeyLoginAbnormal)
		return
	}

	if modelUser.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserDisabled)
		return
	}

	// 更新凭证信息
	updatedCredential := model.NewPasskeyCredentialFromWebAuthn(modelUser.Id, credential)
	if updatedCredential == nil {
		common.ApiErrorI18n(c, i18n.MsgPasskeyUpdateFailed)
		return
	}
	now := time.Now()
	updatedCredential.LastUsedAt = &now
	if err := model.UpsertPasskeyCredential(updatedCredential); err != nil {
		apiPasskeyError(c, err)
		return
	}

	setupLogin(modelUser, c)
}

func AdminResetPasskey(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgPasskeyInvalidUserId)
		return
	}

	user := &model.User{Id: id}
	if err := user.FillUserById(); err != nil {
		common.ApiError(c, err)
		return
	}
	myRole := c.GetInt("role")
	if !canManageTargetRole(myRole, user.Role) {
		common.ApiErrorMsg(c, "no permission")
		return
	}

	if _, err := model.GetPasskeyByUserID(user.Id); err != nil {
		if errors.Is(err, model.ErrPasskeyNotFound) {
			common.ApiErrorI18n(c, i18n.MsgPasskeyNotBound)
			return
		}
		apiPasskeyError(c, err)
		return
	}

	if err := model.DeletePasskeyByUserID(user.Id); err != nil {
		apiPasskeyError(c, err)
		return
	}

	recordManageAuditFor(c, user.Id, "user.reset_passkey", map[string]interface{}{
		"username": user.Username,
		"id":       user.Id,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgPasskeyReset),
	})
}

func PasskeyVerifyBegin(c *gin.Context) {
	if !system_setting.GetPasskeySettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgPasskeyLoginDisabled)
		return
	}

	user, err := getSessionUser(c)
	if err != nil {
		unauthorizedPasskeyError(c, err)
		return
	}

	credential, err := model.GetPasskeyByUserID(user.Id)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgPasskeyNotBound)
		return
	}

	wa, err := passkeysvc.BuildWebAuthn(c.Request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	waUser := passkeysvc.NewWebAuthnUser(user, credential)
	assertion, sessionData, err := wa.BeginLogin(waUser)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if err := passkeysvc.SaveSessionData(c, passkeysvc.VerifySessionKey, sessionData); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"options": assertion,
		},
	})
}

func PasskeyVerifyFinish(c *gin.Context) {
	if !system_setting.GetPasskeySettings().Enabled {
		common.ApiErrorI18n(c, i18n.MsgPasskeyLoginDisabled)
		return
	}

	user, err := getSessionUser(c)
	if err != nil {
		unauthorizedPasskeyError(c, err)
		return
	}

	wa, err := passkeysvc.BuildWebAuthn(c.Request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	credential, err := model.GetPasskeyByUserID(user.Id)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgPasskeyNotBound)
		return
	}

	sessionData, err := passkeysvc.PopSessionData(c, passkeysvc.VerifySessionKey)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	waUser := passkeysvc.NewWebAuthnUser(user, credential)
	_, err = wa.FinishLogin(waUser, *sessionData, c.Request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 更新凭证的最后使用时间
	now := time.Now()
	credential.LastUsedAt = &now
	if err := model.UpsertPasskeyCredential(credential); err != nil {
		common.ApiError(c, err)
		return
	}

	session := sessions.Default(c)
	// Mark passkey as ready; /api/verify will convert this into the final secure verification session.
	session.Set(PasskeyReadySessionKey, time.Now().Unix())
	session.Delete(SecureVerificationSessionKey)
	session.Delete(secureVerificationMethodSessionKey)
	if err := session.Save(); err != nil {
		common.ApiErrorI18n(c, i18n.MsgSecureSaveFailed, map[string]any{"Error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgPasskeyVerified),
	})
}

func getSessionUser(c *gin.Context) (*model.User, error) {
	session := sessions.Default(c)
	idRaw := session.Get("id")
	if idRaw == nil {
		return nil, errPasskeySessionNotLoggedIn
	}
	id, ok := idRaw.(int)
	if !ok {
		return nil, errPasskeySessionInvalid
	}
	user := &model.User{Id: id}
	if err := user.FillUserById(); err != nil {
		return nil, err
	}
	if user.Status != common.UserStatusEnabled {
		return nil, errPasskeySessionUserDisabled
	}
	return user, nil
}

func requirePasskeyRegistrationVerification(c *gin.Context, userID int) bool {
	twoFA, err := model.GetTwoFAByUserId(userID)
	if err != nil {
		apiTwoFAError(c, err)
		return false
	}
	if twoFA == nil || !twoFA.IsEnabled {
		return true
	}
	return requireSecureVerificationMethod(c, secureVerificationMethod2FA)
}

func requirePasskeyDeleteVerification(c *gin.Context, userID int) bool {
	twoFA, err := model.GetTwoFAByUserId(userID)
	if err != nil {
		apiTwoFAError(c, err)
		return false
	}
	if twoFA != nil && twoFA.IsEnabled {
		return requireSecureVerificationMethod(c, secureVerificationMethod2FA)
	}

	_, err = model.GetPasskeyByUserID(userID)
	if err != nil {
		if errors.Is(err, model.ErrPasskeyNotFound) {
			common.ApiErrorI18n(c, i18n.MsgPasskeyNotBound)
			return false
		}
		apiPasskeyError(c, err)
		return false
	}

	return requireSecureVerificationMethod(c, secureVerificationMethodPasskey)
}

func requireSecureVerificationMethod(c *gin.Context, method string) bool {
	session := sessions.Default(c)
	verifiedAt, ok := session.Get(SecureVerificationSessionKey).(int64)
	if !ok || time.Now().Unix()-verifiedAt >= SecureVerificationTimeout {
		session.Delete(SecureVerificationSessionKey)
		session.Delete(secureVerificationMethodSessionKey)
		_ = session.Save()
		common.ApiErrorI18n(c, i18n.MsgPasskeyVerificationRequired)
		return false
	}

	if verifiedMethod, ok := session.Get(secureVerificationMethodSessionKey).(string); !ok || verifiedMethod != method {
		common.ApiErrorI18n(c, i18n.MsgPasskeyMethodVerificationRequired)
		return false
	}

	return true
}
