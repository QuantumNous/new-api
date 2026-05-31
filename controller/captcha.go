package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

// GetCaptcha 生成图形验证码，返回验证码 id 与 base64 图片
func GetCaptcha(c *gin.Context) {
	if !common.RegisterCaptchaEnabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "图形验证码未启用",
		})
		return
	}
	id, b64, err := common.GenerateCaptcha()
	if err != nil {
		common.SysLog("failed to generate captcha: " + err.Error())
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "验证码生成失败，请重试",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"captcha_id":    id,
			"captcha_image": b64,
		},
	})
}
