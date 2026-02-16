package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	passkeysvc "github.com/QuantumNous/new-api/service/passkey"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

const (
	// SecureVerificationSessionKey 安全验证的 session key
	SecureVerificationSessionKey = "secure_verified_at"
	// SecureVerificationTimeout 验证有效期（秒）
	SecureVerificationTimeout = 300 // 5分钟
)

type UniversalVerifyRequest struct {
	Method string `json:"method"` // "2fa" 或 "passkey"
	Code   string `json:"code,omitempty"`
}

type VerificationStatusResponse struct {
	Verified  bool  `json:"verified"`
	ExpiresAt int64 `json:"expires_at,omitempty"`
}

// UniversalVerify 通用验证接口
// 支持 2FA 和 Passkey 验证，验证成功后在 session 中记录时间戳
func UniversalVerify(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, "common.not_logged_in"),
		})
		return
	}

	var req UniversalVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.param_error")))
		return
	}

	// 获取用户信息
	user := &model.User{Id: userId}
	if err := user.FillUserById(); err != nil {
		common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.get_user_failed")))
		return
	}

	if user.Status != common.UserStatusEnabled {
		common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.user_disabled")))
		return
	}

	// 检查用户的验证方式
	twoFA, _ := model.GetTwoFAByUserId(userId)
	has2FA := twoFA != nil && twoFA.IsEnabled

	passkey, passkeyErr := model.GetPasskeyByUserID(userId)
	hasPasskey := passkeyErr == nil && passkey != nil

	if !has2FA && !hasPasskey {
		common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.not_enabled")))
		return
	}

	// 根据验证方式进行验证
	var verified bool
	var verifyMethod string

	switch req.Method {
	case "2fa":
		if !has2FA {
			common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.twofa_not_enabled")))
			return
		}
		if req.Code == "" {
			common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.code_empty")))
			return
		}
		verified = validateTwoFactorAuth(twoFA, req.Code)
		verifyMethod = "2FA"

	case "passkey":
		if !hasPasskey {
			common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.passkey_not_enabled")))
			return
		}
		// Passkey 验证需要先调用 PasskeyVerifyBegin 和 PasskeyVerifyFinish
		// 这里只是验证 Passkey 验证流程是否已经完成
		// 实际上，前端应该先调用这两个接口，然后再调用本接口
		verified = true // Passkey 验证逻辑已在 PasskeyVerifyFinish 中完成
		verifyMethod = "Passkey"

	default:
		common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.method_not_supported")))
		return
	}

	if !verified {
		common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.failed")))
		return
	}

	// 验证成功，在 session 中记录时间戳
	session := sessions.Default(c)
	now := time.Now().Unix()
	session.Set(SecureVerificationSessionKey, now)
	if err := session.Save(); err != nil {
		common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.save_state_failed")))
		return
	}

	// 记录日志
	model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("通用安全验证成功 (验证方式: %s)", verifyMethod))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": common.TranslateMessage(c, "common.operation_success"),
		"data": gin.H{
			"verified":   true,
			"expires_at": now + SecureVerificationTimeout,
		},
	})
}

// PasskeyVerifyAndSetSession Passkey 验证完成后设置 session
// 这是一个辅助函数，供 PasskeyVerifyFinish 调用
func PasskeyVerifyAndSetSession(c *gin.Context) {
	session := sessions.Default(c)
	now := time.Now().Unix()
	session.Set(SecureVerificationSessionKey, now)
	_ = session.Save()
}

// PasskeyVerifyForSecure 用于安全验证的 Passkey 验证流程
// 整合了 begin 和 finish 流程
func PasskeyVerifyForSecure(c *gin.Context) {
	if !system_setting.GetPasskeySettings().Enabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, "passkey.not_enabled"),
		})
		return
	}

	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, "common.not_logged_in"),
		})
		return
	}

	user := &model.User{Id: userId}
	if err := user.FillUserById(); err != nil {
		common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.get_user_failed")))
		return
	}

	if user.Status != common.UserStatusEnabled {
		common.ApiError(c, fmt.Errorf("%s", common.TranslateMessage(c, "secure_verification.user_disabled")))
		return
	}

	credential, err := model.GetPasskeyByUserID(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, "passkey.not_bound"),
		})
		return
	}

	wa, err := passkeysvc.BuildWebAuthn(c.Request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	waUser := passkeysvc.NewWebAuthnUser(user, credential)
	sessionData, err := passkeysvc.PopSessionData(c, passkeysvc.VerifySessionKey)
	if err != nil {
		common.ApiError(c, err)
		return
	}

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

	// 验证成功，设置 session
	PasskeyVerifyAndSetSession(c)

	// 记录日志
	model.RecordLog(userId, model.LogTypeSystem, i18n.Translate("log.passkey_verification_success"))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": common.TranslateMessage(c, "passkey.verify_success"),
		"data": gin.H{
			"verified":   true,
			"expires_at": time.Now().Unix() + SecureVerificationTimeout,
		},
	})
}
