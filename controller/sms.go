package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
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
	result, err := provider.Send(c.Request.Context(), common.SMSProviderSendInput{
		Phone:   phone,
		Content: content,
	})
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
