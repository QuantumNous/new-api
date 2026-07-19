package middleware

import (
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// turnstileVerifyFunc allows tests to mock Cloudflare siteverify.
var turnstileVerifyFunc = defaultTurnstileVerify

func defaultTurnstileVerify(secret, response, remoteIP string) (bool, error) {
	rawRes, err := http.PostForm("https://challenges.cloudflare.com/turnstile/v0/siteverify", url.Values{
		"secret":   {secret},
		"response": {response},
		"remoteip": {remoteIP},
	})
	if err != nil {
		return false, err
	}
	defer rawRes.Body.Close()
	var res turnstileCheckResponse
	if err := json.NewDecoder(rawRes.Body).Decode(&res); err != nil {
		return false, err
	}
	return res.Success, nil
}

// TurnstileCheckStrict 每次请求都向 Cloudflare 校验，不使用 session 缓存。
// 全局 Turnstile 关闭时直接放行。
func TurnstileCheckStrict() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.TurnstileCheckEnabled {
			c.Next()
			return
		}
		response := c.Query("turnstile")
		if response == "" {
			response = c.GetHeader("X-Turnstile-Token")
		}
		if response == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "Turnstile token 为空",
			})
			c.Abort()
			return
		}
		ok, err := turnstileVerifyFunc(common.TurnstileSecretKey, response, c.ClientIP())
		if err != nil {
			common.SysLog(err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			c.Abort()
			return
		}
		if !ok {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "Turnstile 校验失败，请刷新重试！",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
