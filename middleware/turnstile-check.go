package middleware

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

type turnstileCheckResponse struct {
	Success bool `json:"success"`
}

const turnstileTokenMaxLength = 4096

var turnstileHTTPClient = &http.Client{Timeout: 5 * time.Second}

func getTurnstileToken(c *gin.Context) string {
	token := strings.TrimSpace(c.GetHeader("X-Turnstile-Token"))
	if token == "" {
		token = strings.TrimSpace(c.Query("turnstile"))
	}
	if len(token) > turnstileTokenMaxLength {
		return ""
	}
	return token
}

func TurnstileCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		if common.TurnstileCheckEnabled {
			response := getTurnstileToken(c)
			if response == "" {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "Turnstile token 为空",
				})
				c.Abort()
				return
			}
			verifyContext, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
			defer cancel()
			req, err := http.NewRequestWithContext(verifyContext, http.MethodPost, "https://challenges.cloudflare.com/turnstile/v0/siteverify", strings.NewReader(url.Values{
				"secret":   {common.TurnstileSecretKey},
				"response": {response},
				"remoteip": {c.ClientIP()},
			}.Encode()))
			if err != nil {
				common.SysError("create Turnstile verification request failed: " + err.Error())
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "Turnstile 服务暂时不可用，请稍后重试",
				})
				c.Abort()
				return
			}
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			rawRes, err := turnstileHTTPClient.Do(req)
			if err != nil {
				common.SysError("Turnstile verification request failed: " + err.Error())
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "Turnstile 服务暂时不可用，请稍后重试",
				})
				c.Abort()
				return
			}
			defer rawRes.Body.Close()
			if rawRes.StatusCode < http.StatusOK || rawRes.StatusCode >= http.StatusMultipleChoices {
				common.SysError("Turnstile verification returned status " + rawRes.Status)
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "Turnstile 服务暂时不可用，请稍后重试",
				})
				c.Abort()
				return
			}
			var res turnstileCheckResponse
			err = common.DecodeJson(rawRes.Body, &res)
			if err != nil {
				common.SysError("decode Turnstile verification response failed: " + err.Error())
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "Turnstile 服务暂时不可用，请稍后重试",
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
