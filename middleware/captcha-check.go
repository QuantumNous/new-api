package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// CaptchaCheck 图形验证码校验中间件。
// 与 Turnstile 互斥：当 Turnstile 启用时，图形验证码自动让位（Turnstile 优先）。
// 仅拦截匿名请求（注册、找回密码、注册邮件验证码）；已登录用户（如个人中心绑定邮箱）放行。
func CaptchaCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.RegisterCaptchaEnabled {
			c.Next()
			return
		}
		if common.TurnstileCheckEnabled {
			c.Next()
			return
		}
		session := sessions.Default(c)
		if session.Get("id") != nil {
			c.Next()
			return
		}
		captchaId := c.Query("captcha_id")
		captchaAnswer := c.Query("captcha_answer")
		if captchaId == "" || captchaAnswer == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "请输入图形验证码",
			})
			c.Abort()
			return
		}
		if !common.VerifyCaptcha(captchaId, captchaAnswer) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "图形验证码错误或已过期，请刷新重试",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
