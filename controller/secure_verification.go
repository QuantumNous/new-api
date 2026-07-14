package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

const (
	// SecureVerificationSessionKey means the user has fully passed secure verification.
	SecureVerificationSessionKey       = "secure_verified_at"
	secureVerificationMethodSessionKey = "secure_verified_method"
	secureVerificationMethod2FA        = "2fa"
	secureVerificationMethodPasskey    = "passkey"
	// PasskeyReadySessionKey means WebAuthn finished and /api/verify can finalize step-up verification.
	PasskeyReadySessionKey = "secure_passkey_ready_at"
	// SecureVerificationTimeout 验证有效期（秒）
	SecureVerificationTimeout = 300 // 5分钟
	// PasskeyReadyTimeout passkey ready 标记有效期（秒）
	PasskeyReadyTimeout = 60
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
			"message": i18n.T(c, i18n.MsgSecureNotLoggedIn),
		})
		return
	}

	var req UniversalVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgSecureInvalidParams, map[string]any{"Error": err.Error()})
		return
	}

	// 获取用户信息
	user := &model.User{Id: userId}
	if err := user.FillUserById(); err != nil {
		common.ApiErrorI18n(c, i18n.MsgSecureUserInfoFailed, map[string]any{"Error": err.Error()})
		return
	}

	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserDisabled)
		return
	}

	// 检查用户的验证方式
	twoFA, _ := model.GetTwoFAByUserId(userId)
	has2FA := twoFA != nil && twoFA.IsEnabled

	passkey, passkeyErr := model.GetPasskeyByUserID(userId)
	hasPasskey := passkeyErr == nil && passkey != nil

	if !has2FA && !hasPasskey {
		common.ApiErrorI18n(c, i18n.MsgSecureNoMethodEnabled)
		return
	}

	// 根据验证方式进行验证
	var verified bool
	var verifyMethod string
	var err error

	switch req.Method {
	case "2fa":
		if !has2FA {
			common.ApiErrorI18n(c, i18n.MsgSecureTwoFANotEnabled)
			return
		}
		if req.Code == "" {
			common.ApiErrorI18n(c, i18n.MsgSecureCodeRequired)
			return
		}
		verified = validateTwoFactorAuth(twoFA, req.Code)
		verifyMethod = "2FA"

	case "passkey":
		if !hasPasskey {
			common.ApiErrorI18n(c, i18n.MsgSecurePasskeyNotEnabled)
			return
		}
		// Passkey branch only trusts the short-lived marker written by PasskeyVerifyFinish.
		verified, err = consumePasskeyReady(c)
		if err != nil {
			common.ApiErrorI18n(c, i18n.MsgSecurePasskeyStateInvalid, map[string]any{"Error": err.Error()})
			return
		}
		if !verified {
			common.ApiErrorI18n(c, i18n.MsgSecurePasskeyVerificationFirst)
			return
		}
		verifyMethod = "Passkey"

	default:
		common.ApiErrorI18n(c, i18n.MsgSecureUnsupportedMethod, map[string]any{"Method": req.Method})
		return
	}

	if !verified {
		common.ApiErrorI18n(c, i18n.MsgSecureVerificationFailed)
		return
	}

	// 验证成功，在 session 中记录时间戳
	now, err := setSecureVerificationSession(c, req.Method)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgSecureSaveFailed, map[string]any{"Error": err.Error()})
		return
	}

	// 记录日志
	model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("通用安全验证成功 (验证方式: %s)", verifyMethod))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgSecureSuccess),
		"data": gin.H{
			"verified":   true,
			"expires_at": now + SecureVerificationTimeout,
		},
	})
}

func setSecureVerificationSession(c *gin.Context, method string) (int64, error) {
	session := sessions.Default(c)
	session.Delete(PasskeyReadySessionKey)
	now := time.Now().Unix()
	session.Set(SecureVerificationSessionKey, now)
	session.Set(secureVerificationMethodSessionKey, method)
	if err := session.Save(); err != nil {
		return 0, err
	}
	return now, nil
}

func consumePasskeyReady(c *gin.Context) (bool, error) {
	session := sessions.Default(c)
	readyAtRaw := session.Get(PasskeyReadySessionKey)
	if readyAtRaw == nil {
		return false, nil
	}

	readyAt, ok := readyAtRaw.(int64)
	if !ok {
		session.Delete(PasskeyReadySessionKey)
		_ = session.Save()
		return false, fmt.Errorf("invalid passkey verification state")
	}
	session.Delete(PasskeyReadySessionKey)
	if err := session.Save(); err != nil {
		return false, err
	}
	// Expired ready markers cannot be reused.
	if time.Now().Unix()-readyAt >= PasskeyReadyTimeout {
		return false, nil
	}
	return true, nil
}
