package middleware

import (
	"crypto/subtle"
	"net/http"
	"net/url"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

type turnstileCheckResponse struct {
	Success bool `json:"success"`
}

// chimera: 桌面客户端凭证豁免。带预共享密钥头的请求跳过 Turnstile 人机验证，
// 供 Chimera 桌面端等一方客户端登录使用（网页端防护不受影响）。
// 经 DESKTOP_CLIENT_SECRET 环境变量配置；为空时豁免通道关闭。
// 速率限制（CriticalRateLimit 等）对豁免流量仍然生效，密钥可随时轮换。
var desktopClientSecret = common.GetEnvOrDefaultString("DESKTOP_CLIENT_SECRET", "")

func isTrustedDesktopClient(c *gin.Context) bool {
	if desktopClientSecret == "" {
		return false
	}
	header := c.GetHeader("X-Chimera-Desktop-Secret")
	if header == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(header), []byte(desktopClientSecret)) == 1
}

func TurnstileCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		if common.TurnstileCheckEnabled {
			if isTrustedDesktopClient(c) {
				c.Next()
				return
			}
			response := c.Query("turnstile")
			if response == "" {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "Turnstile token 为空",
				})
				c.Abort()
				return
			}
			rawRes, err := http.PostForm("https://challenges.cloudflare.com/turnstile/v0/siteverify", url.Values{
				"secret":   {common.TurnstileSecretKey},
				"response": {response},
				"remoteip": {c.ClientIP()},
			})
			if err != nil {
				common.SysLog(err.Error())
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
				})
				c.Abort()
				return
			}
			defer rawRes.Body.Close()
			var res turnstileCheckResponse
			err = common.DecodeJson(rawRes.Body, &res)
			if err != nil {
				common.SysLog(err.Error())
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
				})
				c.Abort()
				return
			}
			if !res.Success {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "Turnstile 校验失败，请刷新重试！",
				})
				c.Abort()
				return
			}
		}
		c.Next()
	}
}
