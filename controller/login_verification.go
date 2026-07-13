package controller

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

const (
	legacyPendingLoginUsernameSessionKey = "pending_username"
	pendingLoginUserIDSessionKey         = "pending_user_id"
	pendingLoginCreatedAtSessionKey      = "pending_login_created_at"
	pendingLoginSourceSessionKey         = "pending_login_source"
	pendingLoginAllow2FASessionKey       = "pending_login_allow_2fa"
	pendingLoginAllowPasskeySessionKey   = "pending_login_allow_passkey"
	pendingPasskeyUserIDSessionKey       = "pending_passkey_login_user_id"
	loginMethodContextKey                = "login_method"
	pendingLoginTimeout                  = 5 * time.Minute
	pendingLoginFutureSkew               = 30 * time.Second
)

var errPendingLoginUnavailable = errors.New("登录验证会话不存在或已过期，请重新登录")

type pendingLogin struct {
	UserID       int
	CreatedAt    int64
	Source       string
	Allow2FA     bool
	AllowPasskey bool
}

type pendingLoginResponse struct {
	RequireVerification bool  `json:"require_verification"`
	Require2FA          bool  `json:"require_2fa"`
	RequirePasskey      bool  `json:"require_passkey"`
	ExpiresAt           int64 `json:"expires_at"`
}

func completeExternalLogin(user *model.User, c *gin.Context, source string) {
	if user == nil || user.Id == 0 {
		common.ApiErrorMsg(c, "用户不存在")
		return
	}
	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}

	twoFA, err := model.GetTwoFAByUserId(user.Id)
	if err != nil {
		common.SysLog(fmt.Sprintf("External login failed to load 2FA status for user %d: %v", user.Id, err))
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}
	has2FA := twoFA != nil && twoFA.IsEnabled

	hasPasskey := false
	// A bound Passkey is an active login factor only while Passkey login is enabled globally.
	if system_setting.GetPasskeySettings().Enabled {
		credential, err := model.GetPasskeyByUserID(user.Id)
		switch {
		case err == nil:
			hasPasskey = credential != nil
		case errors.Is(err, model.ErrPasskeyNotFound):
		case err != nil:
			common.SysLog(fmt.Sprintf("External login failed to load Passkey status for user %d: %v", user.Id, err))
			common.ApiErrorI18n(c, i18n.MsgDatabaseError)
			return
		}
	}

	if !has2FA && !hasPasskey {
		c.Set(loginMethodContextKey, source)
		setupLogin(user, c)
		return
	}

	pending, err := startPendingLogin(c, user, source, has2FA, hasPasskey)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserSessionSaveFailed)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "需要完成登录安全验证",
		"data":    pending.response(),
	})
}

func startPendingLogin(c *gin.Context, user *model.User, source string, allow2FA, allowPasskey bool) (*pendingLogin, error) {
	if user == nil || user.Id == 0 || source == "" || (!allow2FA && !allowPasskey) {
		return nil, errors.New("无效的登录验证状态")
	}

	session := sessions.Default(c)
	session.Clear()
	pending := &pendingLogin{
		UserID:       user.Id,
		CreatedAt:    time.Now().Unix(),
		Source:       source,
		Allow2FA:     allow2FA,
		AllowPasskey: allowPasskey,
	}
	session.Set(pendingLoginUserIDSessionKey, pending.UserID)
	session.Set(pendingLoginCreatedAtSessionKey, pending.CreatedAt)
	session.Set(pendingLoginSourceSessionKey, pending.Source)
	session.Set(pendingLoginAllow2FASessionKey, pending.Allow2FA)
	session.Set(pendingLoginAllowPasskeySessionKey, pending.AllowPasskey)
	if err := session.Save(); err != nil {
		return nil, err
	}
	return pending, nil
}

func getPendingLogin(c *gin.Context) (*pendingLogin, error) {
	session := sessions.Default(c)
	pending, ok := pendingLoginFromSession(session)
	if !ok {
		clearPendingLogin(session)
		_ = session.Save()
		return nil, errPendingLoginUnavailable
	}

	now := time.Now().Unix()
	if pending.CreatedAt > now+int64(pendingLoginFutureSkew/time.Second) ||
		now-pending.CreatedAt >= int64(pendingLoginTimeout/time.Second) {
		clearPendingLogin(session)
		_ = session.Save()
		return nil, errPendingLoginUnavailable
	}
	return pending, nil
}

func pendingLoginFromSession(session sessions.Session) (*pendingLogin, bool) {
	userID, userIDOK := session.Get(pendingLoginUserIDSessionKey).(int)
	createdAt, createdAtOK := session.Get(pendingLoginCreatedAtSessionKey).(int64)
	source, sourceOK := session.Get(pendingLoginSourceSessionKey).(string)
	allow2FA, allow2FAOK := session.Get(pendingLoginAllow2FASessionKey).(bool)
	allowPasskey, allowPasskeyOK := session.Get(pendingLoginAllowPasskeySessionKey).(bool)
	if !userIDOK || userID == 0 || !createdAtOK || !sourceOK || source == "" || !allow2FAOK || !allowPasskeyOK ||
		(!allow2FA && !allowPasskey) {
		return nil, false
	}
	return &pendingLogin{
		UserID:       userID,
		CreatedAt:    createdAt,
		Source:       source,
		Allow2FA:     allow2FA,
		AllowPasskey: allowPasskey,
	}, true
}

func (p *pendingLogin) response() pendingLoginResponse {
	return pendingLoginResponse{
		RequireVerification: true,
		Require2FA:          p.Allow2FA,
		RequirePasskey:      p.AllowPasskey,
		ExpiresAt:           p.CreatedAt + int64(pendingLoginTimeout/time.Second),
	}
}

func clearPendingLogin(session sessions.Session) {
	session.Delete(legacyPendingLoginUsernameSessionKey)
	session.Delete(pendingLoginUserIDSessionKey)
	session.Delete(pendingLoginCreatedAtSessionKey)
	session.Delete(pendingLoginSourceSessionKey)
	session.Delete(pendingLoginAllow2FASessionKey)
	session.Delete(pendingLoginAllowPasskeySessionKey)
	session.Delete(pendingPasskeyUserIDSessionKey)
}

func completePendingLogin(c *gin.Context, pending *pendingLogin, user *model.User, factor string) {
	if pending == nil || user == nil || pending.UserID != user.Id {
		common.ApiError(c, fmt.Errorf("登录验证用户不匹配"))
		return
	}
	if user.Status != common.UserStatusEnabled {
		common.ApiErrorMsg(c, "该用户已被禁用")
		return
	}
	c.Set(loginMethodContextKey, pending.Source+"+"+factor)
	setupLogin(user, c)
}

func GetPendingLoginVerification(c *gin.Context) {
	pending, err := getPendingLogin(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, pending.response())
}
