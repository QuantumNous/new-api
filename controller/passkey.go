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
	"github.com/QuantumNous/new-api/model"
	passkeysvc "github.com/QuantumNous/new-api/service/passkey"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/protocol"
	webauthnlib "github.com/go-webauthn/webauthn/webauthn"
)

type passkeyRPIDRequest struct {
	RPID string `json:"rp_id"`
}

func parsePasskeyRPIDHint(c *gin.Context) (string, error) {
	if c.Request.Body == nil || c.Request.ContentLength == 0 {
		return "", nil
	}
	var request passkeyRPIDRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		return "", err
	}
	return request.RPID, nil
}

func apiPasskeyError(c *gin.Context, err error) {
	if errors.Is(err, system_setting.ErrPasskeyRPIDInvalid) {
		common.ApiErrorI18n(c, i18n.MsgPasskeyRPIDInvalid)
		return
	}
	if errors.Is(err, system_setting.ErrPasskeyRPIDUnavailable) {
		common.ApiErrorI18n(c, i18n.MsgPasskeyRPIDUnavailable)
		return
	}
	common.ApiError(c, err)
}
func PasskeyRegisterBegin(c *gin.Context) {
	if !system_setting.PasskeySettingsSnapshot().Enabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未启用 Passkey 登录",
		})
		return
	}

	user, err := getSessionUser(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	if !requirePasskeyRegistrationVerification(c, user.Id) {
		return
	}

	credential, err := model.GetPasskeyByUserID(user.Id)
	if err != nil && !errors.Is(err, model.ErrPasskeyNotFound) {
		common.ApiError(c, err)
		return
	}
	if errors.Is(err, model.ErrPasskeyNotFound) {
		credential = nil
	}

	hint, err := parsePasskeyRPIDHint(c)
	if err != nil {
		common.ApiErrorMsg(c, "无效的 Passkey 验证请求")
		return
	}
	wa, rpIDs, err := passkeysvc.BuildLoginWebAuthn(c.Request, hint, "")
	if err != nil {
		apiPasskeyError(c, err)
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
		apiPasskeyError(c, err)
		return
	}

	if err := passkeysvc.SaveSessionDataWithRPID(c, passkeysvc.RegistrationSessionKey, wa.Config.RPID, sessionData); err != nil {
		apiPasskeyError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"options": creation,
			"rp_id":   wa.Config.RPID,
			"rp_ids":  rpIDs,
		},
	})
}

func PasskeyRegisterFinish(c *gin.Context) {
	if !system_setting.PasskeySettingsSnapshot().Enabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未启用 Passkey 登录",
		})
		return
	}

	user, err := getSessionUser(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	if !requirePasskeyRegistrationVerification(c, user.Id) {
		return
	}

	credentialRecord, err := model.GetPasskeyByUserID(user.Id)
	if err != nil && !errors.Is(err, model.ErrPasskeyNotFound) {
		common.ApiError(c, err)
		return
	}
	if errors.Is(err, model.ErrPasskeyNotFound) {
		credentialRecord = nil
	}

	sessionData, rpID, err := passkeysvc.PopSessionDataWithRPID(c, passkeysvc.RegistrationSessionKey)
	if err != nil {
		apiPasskeyError(c, err)
		return
	}
	wa, err := passkeysvc.BuildWebAuthnForRPID(c.Request, rpID)
	if err != nil {
		apiPasskeyError(c, err)
		return
	}

	waUser := passkeysvc.NewWebAuthnUser(user, credentialRecord)
	credential, err := wa.FinishRegistration(waUser, *sessionData, c.Request)
	if err != nil {
		apiPasskeyError(c, err)
		return
	}

	passkeyCredential := model.NewPasskeyCredentialFromWebAuthnWithRPID(user.Id, credential, rpID)
	if passkeyCredential == nil {
		common.ApiErrorMsg(c, "无法创建 Passkey 凭证")
		return
	}

	if err := model.UpsertPasskeyCredential(passkeyCredential); err != nil {
		apiPasskeyError(c, err)
		return
	}

	recordUserSecurityAudit(c, user.Id, "user.passkey_register", nil)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Passkey 注册成功",
	})
}

func PasskeyDelete(c *gin.Context) {
	user, err := getSessionUser(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	if !requirePasskeyDeleteVerification(c, user.Id) {
		return
	}

	if err := model.DeletePasskeyByUserID(user.Id); err != nil {
		common.ApiError(c, err)
		return
	}

	recordUserSecurityAudit(c, user.Id, "user.passkey_delete", nil)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Passkey 已解绑",
	})
}

func PasskeyStatus(c *gin.Context) {
	user, err := getSessionUser(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	credential, err := model.GetPasskeyByUserID(user.Id)
	if errors.Is(err, model.ErrPasskeyNotFound) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data": gin.H{
				"enabled": false,
				"rp_ids":  system_setting.PasskeySettingsSnapshot().RelyingPartyIDs(),
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
		"rp_id":        credential.RPID,
		"rp_ids":       system_setting.PasskeySettingsSnapshot().RelyingPartyIDs(),
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
}

func PasskeyLoginBegin(c *gin.Context) {
	if !system_setting.PasskeySettingsSnapshot().Enabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未启用 Passkey 登录",
		})
		return
	}

	hint, err := parsePasskeyRPIDHint(c)
	if err != nil {
		common.ApiErrorMsg(c, "无效的 Passkey 验证请求")
		return
	}
	wa, rpIDs, err := passkeysvc.BuildLoginWebAuthn(c.Request, hint, "")
	if err != nil {
		apiPasskeyError(c, err)
		return
	}

	assertion, sessionData, err := wa.BeginDiscoverableLogin()
	if err != nil {
		apiPasskeyError(c, err)
		return
	}

	if err := passkeysvc.SaveSessionDataWithRPID(c, passkeysvc.LoginSessionKey, wa.Config.RPID, sessionData); err != nil {
		apiPasskeyError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"options": assertion,
			"rp_id":   wa.Config.RPID,
			"rp_ids":  rpIDs,
		},
	})
}

func PasskeyLoginFinish(c *gin.Context) {
	if !system_setting.PasskeySettingsSnapshot().Enabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未启用 Passkey 登录",
		})
		return
	}

	sessionData, rpID, err := passkeysvc.PopSessionDataWithRPID(c, passkeysvc.LoginSessionKey)
	if err != nil {
		apiPasskeyError(c, err)
		return
	}
	wa, err := passkeysvc.BuildWebAuthnForRPID(c.Request, rpID)
	if err != nil {
		apiPasskeyError(c, err)
		return
	}

	var storedCredential *model.PasskeyCredential
	handler := func(rawID, userHandle []byte) (webauthnlib.User, error) {
		// 首先通过凭证ID查找用户
		credential, err := model.GetPasskeyByCredentialID(rawID)
		if err != nil {
			return nil, fmt.Errorf("未找到 Passkey 凭证: %w", err)
		}
		storedCredential = credential
		if credential.RPID != nil && strings.TrimSpace(*credential.RPID) != "" && !strings.EqualFold(strings.TrimSpace(*credential.RPID), rpID) {
			return nil, passkeysvc.ErrRPIDUnavailable
		}

		// 通过凭证获取用户
		user := &model.User{Id: credential.UserID}
		if err := user.FillUserById(); err != nil {
			return nil, fmt.Errorf("用户信息获取失败: %w", err)
		}

		if user.Status != common.UserStatusEnabled {
			return nil, errors.New(disabledUserMessage(c, user))
		}

		if len(userHandle) > 0 {
			userID, parseErr := strconv.Atoi(string(userHandle))
			if parseErr != nil {
				// 记录异常但继续验证，因为某些客户端可能使用非数字格式
				common.SysLog(fmt.Sprintf("PasskeyLogin: userHandle parse error for credential, length: %d", len(userHandle)))
			} else if userID != user.Id {
				return nil, errors.New("用户句柄与凭证不匹配")
			}
		}

		return passkeysvc.NewWebAuthnUser(user, credential), nil
	}

	waUser, credential, err := wa.FinishPasskeyLogin(handler, *sessionData, c.Request)
	if err != nil {
		apiPasskeyError(c, err)
		return
	}

	userWrapper, ok := waUser.(*passkeysvc.WebAuthnUser)
	if !ok {
		common.ApiErrorMsg(c, "Passkey 登录状态异常")
		return
	}

	modelUser := userWrapper.ModelUser()
	if modelUser == nil {
		common.ApiErrorMsg(c, "Passkey 登录状态异常")
		return
	}

	if !refreshExpiredUserBan(c, modelUser) {
		return
	}
	if modelUser.Status != common.UserStatusEnabled {
		apiDisabledUser(c, modelUser)
		return
	}

	// 更新凭证信息
	updatedCredential := model.NewPasskeyCredentialFromWebAuthnWithRPID(modelUser.Id, credential, rpID)
	if updatedCredential == nil {
		common.ApiErrorMsg(c, "Passkey 凭证更新失败")
		return
	}
	if storedCredential != nil && (storedCredential.RPID == nil || strings.TrimSpace(*storedCredential.RPID) == "") {
		if err := model.BindPasskeyRPIDIfEmpty(storedCredential.ID, rpID); err != nil {
			apiPasskeyError(c, err)
			return
		}
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
		common.ApiErrorMsg(c, "无效的用户 ID")
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
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "该用户尚未绑定 Passkey",
			})
			return
		}
		common.ApiError(c, err)
		return
	}

	if err := model.DeletePasskeyByUserID(user.Id); err != nil {
		common.ApiError(c, err)
		return
	}

	recordManageAuditFor(c, user.Id, "user.reset_passkey", map[string]interface{}{
		"username": user.Username,
		"id":       user.Id,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Passkey 已重置",
	})
}

func PasskeyVerifyBegin(c *gin.Context) {
	if !system_setting.PasskeySettingsSnapshot().Enabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未启用 Passkey 登录",
		})
		return
	}

	user, err := getSessionUser(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	credential, err := model.GetPasskeyByUserID(user.Id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该用户尚未绑定 Passkey",
		})
		return
	}

	hint, err := parsePasskeyRPIDHint(c)
	if err != nil {
		common.ApiErrorMsg(c, "无效的 Passkey 验证请求")
		return
	}
	credentialRPID := ""
	if credential.RPID != nil {
		credentialRPID = *credential.RPID
	}
	wa, rpIDs, err := passkeysvc.BuildLoginWebAuthn(c.Request, hint, credentialRPID)
	if err != nil {
		apiPasskeyError(c, err)
		return
	}

	waUser := passkeysvc.NewWebAuthnUser(user, credential)
	assertion, sessionData, err := wa.BeginLogin(waUser)
	if err != nil {
		apiPasskeyError(c, err)
		return
	}

	if err := passkeysvc.SaveSessionDataWithRPID(c, passkeysvc.VerifySessionKey, wa.Config.RPID, sessionData); err != nil {
		apiPasskeyError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"options": assertion,
			"rp_id":   wa.Config.RPID,
			"rp_ids":  rpIDs,
		},
	})
}

func PasskeyVerifyFinish(c *gin.Context) {
	if !system_setting.PasskeySettingsSnapshot().Enabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未启用 Passkey 登录",
		})
		return
	}

	user, err := getSessionUser(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	credential, err := model.GetPasskeyByUserID(user.Id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该用户尚未绑定 Passkey",
		})
		return
	}

	sessionData, rpID, err := passkeysvc.PopSessionDataWithRPID(c, passkeysvc.VerifySessionKey)
	if err != nil {
		apiPasskeyError(c, err)
		return
	}
	wa, err := passkeysvc.BuildWebAuthnForRPID(c.Request, rpID)
	if err != nil {
		apiPasskeyError(c, err)
		return
	}

	waUser := passkeysvc.NewWebAuthnUser(user, credential)
	_, err = wa.FinishLogin(waUser, *sessionData, c.Request)
	if err != nil {
		apiPasskeyError(c, err)
		return
	}

	if credential.RPID == nil || strings.TrimSpace(*credential.RPID) == "" {
		if err := model.BindPasskeyRPIDIfEmpty(credential.ID, rpID); err != nil {
			apiPasskeyError(c, err)
			return
		}
		rpID = strings.TrimSpace(rpID)
		credential.RPID = &rpID
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
		common.ApiError(c, fmt.Errorf("保存验证状态失败: %v", err))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Passkey 验证成功",
	})
}

func getSessionUser(c *gin.Context) (*model.User, error) {
	session := sessions.Default(c)
	idRaw := session.Get("id")
	if idRaw == nil {
		return nil, errors.New("未登录")
	}
	id, ok := idRaw.(int)
	if !ok {
		return nil, errors.New("无效的会话信息")
	}
	user := &model.User{Id: id}
	if err := user.FillUserById(); err != nil {
		return nil, err
	}
	if user.Status != common.UserStatusEnabled {
		return nil, errors.New(disabledUserMessage(c, user))
	}
	return user, nil
}

func requirePasskeyRegistrationVerification(c *gin.Context, userID int) bool {
	twoFA, err := model.GetTwoFAByUserId(userID)
	if err != nil {
		common.ApiError(c, err)
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
		common.ApiError(c, err)
		return false
	}
	if twoFA != nil && twoFA.IsEnabled {
		return requireSecureVerificationMethod(c, secureVerificationMethod2FA)
	}

	_, err = model.GetPasskeyByUserID(userID)
	if err != nil {
		if errors.Is(err, model.ErrPasskeyNotFound) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "该用户尚未绑定 Passkey",
			})
			return false
		}
		common.ApiError(c, err)
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
		common.ApiErrorMsg(c, "请先完成安全验证")
		return false
	}

	if verifiedMethod, ok := session.Get(secureVerificationMethodSessionKey).(string); !ok || verifiedMethod != method {
		common.ApiErrorMsg(c, "请先完成对应的安全验证")
		return false
	}

	return true
}
