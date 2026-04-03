package controller

import (
	"fmt"
	"net/http"
	"regexp"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/common/sms"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

var phoneRegex = regexp.MustCompile(`^\+?[1-9]\d{6,14}$`)

type SmsRequest struct {
	Phone string `json:"phone"`
}

type SmsLoginRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

func SendSmsVerification(c *gin.Context) {
	smsSettings := system_setting.GetSmsSettings()
	if !smsSettings.Enabled {
		common.ApiErrorI18n(c, i18n.MsgSmsLoginDisabled)
		return
	}

	var req SmsRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	if req.Phone == "" {
		common.ApiErrorI18n(c, i18n.MsgSmsPhoneRequired)
		return
	}

	if !phoneRegex.MatchString(req.Phone) {
		common.ApiErrorI18n(c, i18n.MsgSmsPhoneInvalid)
		return
	}

	code := common.GenerateVerificationCode(6)
	common.RegisterVerificationCodeWithKey(req.Phone, code, common.SmsVerificationPurpose)

	sender, err := sms.NewSender()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgSmsProviderNotConfig)
		return
	}

	if err := sender.SendCode(req.Phone, code); err != nil {
		common.SysLog("SMS send failed: " + err.Error())
		common.ApiErrorI18n(c, i18n.MsgSmsSendFailed)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": i18n.T(c, i18n.MsgSmsSendSuccess),
	})
}

func SmsLogin(c *gin.Context) {
	smsSettings := system_setting.GetSmsSettings()
	if !smsSettings.Enabled {
		common.ApiErrorI18n(c, i18n.MsgSmsLoginDisabled)
		return
	}

	var req SmsLoginRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	if req.Phone == "" {
		common.ApiErrorI18n(c, i18n.MsgSmsPhoneRequired)
		return
	}

	if req.Code == "" {
		common.ApiErrorI18n(c, i18n.MsgSmsCodeRequired)
		return
	}

	if !phoneRegex.MatchString(req.Phone) {
		common.ApiErrorI18n(c, i18n.MsgSmsPhoneInvalid)
		return
	}

	if !common.VerifyCodeWithKey(req.Phone, req.Code, common.SmsVerificationPurpose) {
		common.ApiErrorI18n(c, i18n.MsgSmsVerificationCodeErr)
		return
	}

	common.DeleteKey(req.Phone, common.SmsVerificationPurpose)

	user := model.User{Phone: req.Phone}
	err := user.FillUserByPhone()
	if err != nil || user.Id == 0 {
		// User not found - auto register
		if !common.RegisterEnabled {
			common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
			return
		}

		nextId := model.GetMaxUserId() + 1
		username := fmt.Sprintf("sms_%d", nextId)
		displayName := maskPhone(req.Phone)

		randPassword, err := common.GenerateKey()
		if err != nil {
			common.ApiErrorI18n(c, i18n.MsgUserRegisterFailed)
			return
		}

		newUser := model.User{
			Username:    username,
			Password:    randPassword,
			DisplayName: displayName,
			Phone:       req.Phone,
			Role:        common.RoleCommonUser,
		}

		inviterId := 0
		affCode := c.Query("aff")
		if affCode != "" {
			inviterId, _ = model.GetUserIdByAffCode(affCode)
		}

		if err := newUser.Insert(inviterId); err != nil {
			common.ApiErrorI18n(c, i18n.MsgUserRegisterFailed)
			return
		}

		// Generate default token
		if constant.GenerateDefaultToken {
			var insertedUser model.User
			if err := model.DB.Where("username = ?", newUser.Username).First(&insertedUser).Error; err == nil {
				key, err := common.GenerateKey()
				if err == nil {
					token := model.Token{
						UserId:             insertedUser.Id,
						Name:               insertedUser.Username + "的初始令牌",
						Key:                key,
						CreatedTime:        common.GetTimestamp(),
						AccessedTime:       common.GetTimestamp(),
						ExpiredTime:        -1,
						RemainQuota:        500000,
						UnlimitedQuota:     true,
						ModelLimitsEnabled: false,
					}
					if setting.DefaultUseAutoGroup {
						token.Group = "auto"
					}
					_ = token.Insert()
				}
			}
		}

		// Fetch the newly created user for login
		user = model.User{Phone: req.Phone}
		if err := user.FillUserByPhone(); err != nil || user.Id == 0 {
			common.ApiErrorI18n(c, i18n.MsgUserRegisterFailed)
			return
		}
	}

	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserDisabled)
		return
	}

	// Check 2FA
	if model.IsTwoFAEnabled(user.Id) {
		session := sessions.Default(c)
		session.Set("pending_username", user.Username)
		session.Set("pending_user_id", user.Id)
		if err := session.Save(); err != nil {
			common.ApiErrorI18n(c, i18n.MsgUserSessionSaveFailed)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": i18n.T(c, i18n.MsgUserRequire2FA),
			"success": true,
			"data": map[string]interface{}{
				"require_2fa": true,
			},
		})
		return
	}

	setupLogin(&user, c)
}

func maskPhone(phone string) string {
	runes := []rune(phone)
	length := len(runes)
	if length <= 4 {
		return phone
	}
	// Show first 3 and last 4, mask the middle
	if length >= 11 {
		return string(runes[:3]) + "****" + string(runes[length-4:])
	}
	// For shorter numbers, show first 2 and last 2
	return string(runes[:2]) + "****" + string(runes[length-2:])
}
