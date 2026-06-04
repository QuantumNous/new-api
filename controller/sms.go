package controller

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type adminTestSMSRequest struct {
	Phone string `json:"phone"`
	Scene string `json:"scene"`
	Code  string `json:"code"`
}

type smsRegisterRequest struct {
	Username         string `json:"username"`
	Password         string `json:"password"`
	Phone            string `json:"phone"`
	VerificationCode string `json:"verification_code"`
	AffCode          string `json:"aff_code"`
}

type smsRegisterCodeRequest struct {
	Phone string `json:"phone"`
}

type smsPhoneLoginRequest struct {
	Phone            string `json:"phone"`
	VerificationCode string `json:"verification_code"`
}

func SendSMSRegisterCode(c *gin.Context) {
	if !common.RegisterEnabled {
		common.ApiErrorMsg(c, "Register is disabled")
		return
	}
	if !common.SMSEnabled {
		common.ApiErrorMsg(c, "SMS is disabled")
		return
	}
	var req smsRegisterCodeRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	phone, err := common.NormalizePhone(req.Phone)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.CheckSMSRateLimitWithDB(model.DB, service.SMSRateLimitInput{
		Phone:     phone,
		IP:        c.ClientIP(),
		AccountID: smsRequestAccountID(c),
		Scene:     common.SMSSceneRegister,
	}, service.DefaultSMSRateLimitConfig()); err != nil {
		common.ApiError(c, err)
		return
	}

	code, err := common.GenerateSMSVerificationCode(6)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	content, err := common.RenderSMSVerificationContent(common.SMSVerificationContentInput{
		Scene: common.SMSSceneRegister,
		Code:  code,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	provider, err := common.NewSMSProvider(common.SMSProviderName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	startedAt := time.Now()
	result, err := provider.Send(c.Request.Context(), common.SMSProviderSendInput{
		Phone:   phone,
		Content: content,
	})
	recordSMSTestSendLog(phone, common.SMSSceneRegister, result, time.Since(startedAt).Milliseconds())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.RegisterVerificationCodeWithKey(phone, code, common.SMSVerificationPurpose(common.SMSSceneRegister))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"phone_masked":   common.MaskPhone(phone),
			"provider":       result.Provider,
			"provider_code":  result.ProviderCode,
			"template_scene": common.SMSSceneRegister,
		},
	})
}

func SMSPhoneLogin(c *gin.Context) {
	if !common.SMSEnabled {
		common.ApiErrorMsg(c, "SMS is disabled")
		return
	}
	var req smsPhoneLoginRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	phone, err := common.NormalizePhone(req.Phone)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	purpose := common.SMSVerificationPurpose(common.SMSSceneLogin)
	if !common.VerifyCodeWithKey(phone, req.VerificationCode, purpose) {
		common.ApiErrorMsg(c, "SMS verification code is invalid")
		return
	}
	user, err := service.FindUserByActivePhoneBinding(model.DB, phone)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.DeleteKey(phone, purpose)
	setupLoginWithOptionalTwoFA(user, c)
}

func SMSRegister(c *gin.Context) {
	if !common.RegisterEnabled {
		common.ApiErrorMsg(c, "Register is disabled")
		return
	}
	if !common.SMSEnabled {
		common.ApiErrorMsg(c, "SMS is disabled")
		return
	}
	var req smsRegisterRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	phone, err := common.NormalizePhone(req.Phone)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !common.VerifyCodeWithKey(phone, req.VerificationCode, common.SMSVerificationPurpose(common.SMSSceneRegister)) {
		common.ApiErrorMsg(c, "SMS verification code is invalid")
		return
	}

	user := model.User{
		Username: req.Username,
		Password: req.Password,
	}
	if err := common.Validate.Struct(&user); err != nil {
		common.ApiError(c, err)
		return
	}
	exist, err := model.CheckUserExistOrDeleted(user.Username, "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if exist {
		common.ApiErrorMsg(c, "user exists")
		return
	}
	if err := rejectExistingActiveSMSPhoneBinding(model.DB, phone); err != nil {
		common.ApiError(c, err)
		return
	}

	inviteCtx, err := resolveAffiliateInviteContextForRegistration(model.DB, affiliateRegistrationAttributionInput{
		InviteCode:     req.AffCode,
		RegisterMethod: service.AffiliateRegisterMethodSMS,
		Provider:       common.SMSProviderName,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	inviterId := 0
	if inviteCtx != nil {
		inviterId = inviteCtx.InviterUserId
	}
	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.Username,
		InviterId:   inviterId,
		Role:        common.RoleCommonUser,
	}
	inviteeQuota := affiliateInviteeQuotaForContext(inviteCtx)
	inviterQuota := affiliateInviterQuotaForContext(inviteCtx)
	if err := cleanUser.InsertWithInviteQuotas(inviterId, inviteeQuota, inviterQuota); err != nil {
		common.ApiError(c, err)
		return
	}

	var insertedUser model.User
	if err := model.DB.Where("username = ?", cleanUser.Username).First(&insertedUser).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	if _, err := service.BindUserPhone(model.DB, service.UserPhoneBindingInput{
		UserID:   insertedUser.Id,
		Phone:    phone,
		Provider: common.SMSProviderName,
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	if _, err := recordAffiliateInviteAttributionForRegistration(model.DB, inviteCtx, affiliateRegistrationAttributionInput{
		InviteeUserId:  insertedUser.Id,
		RegisterMethod: service.AffiliateRegisterMethodSMS,
		Provider:       common.SMSProviderName,
		InitialQuota:   affiliateInviteInitialQuotaForContext(inviteCtx),
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	common.DeleteKey(phone, common.SMSVerificationPurpose(common.SMSSceneRegister))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func rejectExistingActiveSMSPhoneBinding(db *gorm.DB, phone string) error {
	if db == nil {
		return errors.New("nil db")
	}
	phoneHash := service.HashPhoneForBinding(phone)
	if phoneHash == "" {
		return errors.New("invalid phone")
	}
	var existing model.UserPhoneBinding
	err := db.
		Where("phone_hash = ? AND status = ?", phoneHash, model.UserPhoneBindingStatusActive).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	return errors.New("phone already bound")
}

func AdminTestSMS(c *gin.Context) {
	if !common.SMSEnabled {
		common.ApiErrorMsg(c, "SMS is disabled")
		return
	}
	var req adminTestSMSRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	phone, err := common.NormalizePhone(req.Phone)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.CheckSMSRateLimitWithDB(model.DB, service.SMSRateLimitInput{
		Phone:     phone,
		IP:        c.ClientIP(),
		AccountID: smsRequestAccountID(c),
		Scene:     req.Scene,
	}, service.DefaultSMSRateLimitConfig()); err != nil {
		common.ApiError(c, err)
		return
	}
	content, err := common.RenderSMSVerificationContent(common.SMSVerificationContentInput{
		Scene: req.Scene,
		Code:  req.Code,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	provider, err := common.NewSMSProvider(common.SMSProviderName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	startedAt := time.Now()
	result, err := provider.Send(c.Request.Context(), common.SMSProviderSendInput{
		Phone:   phone,
		Content: content,
	})
	recordSMSTestSendLog(phone, req.Scene, result, time.Since(startedAt).Milliseconds())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"phone_masked":   common.MaskPhone(phone),
			"provider":       result.Provider,
			"provider_code":  result.ProviderCode,
			"template_scene": req.Scene,
		},
	})
}

func recordSMSTestSendLog(phone string, scene string, result common.SMSProviderSendResult, durationMs int64) {
	if model.DB == nil {
		return
	}
	provider := result.Provider
	if provider == "" {
		provider = common.SMSProviderName
	}
	if _, err := service.RecordSMSSendLog(model.DB, service.SMSSendLogInput{
		Phone:           phone,
		Scene:           scene,
		Provider:        provider,
		TemplateVersion: common.SMSVerificationTemplateVersion(scene),
		ProviderCode:    result.ProviderCode,
		DurationMs:      durationMs,
	}); err != nil {
		common.SysLog("failed to record SMS send log: " + err.Error())
	}
}

func smsRequestAccountID(c *gin.Context) string {
	id := c.GetInt("id")
	if id <= 0 {
		return ""
	}
	return strconv.Itoa(id)
}

func AdminGetSMSStatus(c *gin.Context) {
	if !common.SMSEnabled {
		common.ApiErrorMsg(c, "SMS is disabled")
		return
	}
	provider, err := common.NewSMSProvider(common.SMSProviderName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	statusChecker, ok := provider.(common.SMSProviderStatusChecker)
	if !ok {
		common.ApiErrorMsg(c, "SMS provider does not support status check")
		return
	}
	result, err := statusChecker.CheckStatus(c.Request.Context())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"provider":        result.Provider,
			"provider_code":   result.ProviderCode,
			"sent_count":      result.SentCount,
			"remaining_count": result.RemainingCount,
		},
	})
}
