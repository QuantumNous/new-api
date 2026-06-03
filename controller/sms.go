package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type adminTestSMSRequest struct {
	Phone string `json:"phone"`
	Scene string `json:"scene"`
	Code  string `json:"code"`
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
