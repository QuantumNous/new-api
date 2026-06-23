/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package middleware

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// ESACaptchaCheck 验证阿里云 ESA AI 验证码。
//
// 两种验证模式：
//
//  1. 严格模式（ESAStrictModeEnabled=true）：
//     ESA 边缘节点在请求到达后端之前完成验签，验证通过后注入
//     X-Captcha-Verify-Code: T001 请求头。后端只需检查该头即可。
//     要求所有受保护请求必须经过 ESA 边缘节点。
//
//  2. 普通模式（ESAStrictModeEnabled=false，ESACaptchaEnabled=true）：
//     前端 ESA SDK 验证通过后获得 captcha_verify_param，
//     后端调用阿里云 ESA API 服务端验证该参数的真实性。
//     不依赖 ESA 边缘节点，适用于替换 Turnstile 的场景。
func ESACaptchaCheck(scene string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.ESACaptchaEnabled {
			c.Next()
			return
		}

		sceneId := getESACaptchaSceneId(scene)
		if sceneId == "" {
			c.Next()
			return
		}

		session := sessions.Default(c)
		sessionKey := "esa_captcha:" + scene + ":" + c.FullPath()
		if session.Get(sessionKey) != nil {
			c.Next()
			return
		}

		// --- 严格模式：依赖 ESA 边缘注入的头 ---
		if common.ESAStrictModeEnabled {
			if c.GetHeader("X-Captcha-Verify-Code") == "T001" {
				session.Set(sessionKey, true)
				if err := session.Save(); err != nil {
					c.JSON(http.StatusOK, gin.H{
						"success": false,
						"message": "无法保存会话信息，请重试",
					})
					c.Abort()
					return
				}
				c.Next()
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "人机验证未通过，请刷新页面后重试",
			})
			c.Abort()
			return
		}

		// --- 普通模式：服务端验证 captcha_verify_param ---
		captchaVerifyParam := c.Query("captcha_verify_param")
		if captchaVerifyParam == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "人机验证未通过",
			})
			c.Abort()
			return
		}

		verified, err := verifyESACaptcha(captchaVerifyParam)
		if err != nil {
			common.SysLog(fmt.Sprintf("ESA captcha server-side verify error: %v", err))
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "人机验证服务异常，请稍后重试",
			})
			c.Abort()
			return
		}
		if !verified {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "人机验证未通过",
			})
			c.Abort()
			return
		}

		session.Set(sessionKey, true)
		if err := session.Save(); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法保存会话信息，请重试",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// getESACaptchaSceneId returns the configured Aliyun ESA scene ID for a
// protected business action. Empty scene IDs mean the action is not protected.
func getESACaptchaSceneId(scene string) string {
	switch scene {
	case "login":
		return common.ESACaptchaLoginSceneId
	case "verification":
		return common.ESACaptchaVerificationSceneId
	case "reset_password":
		return common.ESACaptchaResetPasswordSceneId
	case "change_password":
		return common.ESACaptchaChangePasswordSceneId
	case "delete_account":
		return common.ESACaptchaDeleteAccountSceneId
	case "checkin":
		return common.ESACaptchaCheckinSceneId
	default:
		return ""
	}
}

// verifyESACaptcha 调用阿里云 ESA 服务端 API 验证 captcha_verify_param 的真伪。
// 使用与前端 SDK 相同的 ESA 验证服务器地址。
func verifyESACaptcha(captchaVerifyParam string) (bool, error) {
	region := common.ESARegion
	if region == "" {
		region = "cn"
	}

	var baseURL string
	switch region {
	case "sgp":
		baseURL = "https://captcha-esa-open-b.aliyuncs.com"
	default:
		baseURL = "https://captcha-esa-open.aliyuncs.com"
	}

	verifyURL := fmt.Sprintf("%s/esa/api/check/%s?captcha_verify_param=%s",
		baseURL,
		url.PathEscape(common.ESAPrefix),
		url.QueryEscape(captchaVerifyParam),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, verifyURL, nil)
	if err != nil {
		return false, fmt.Errorf("create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("http call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("API status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("read response: %w", err)
	}

	var result struct {
		Success bool `json:"success"`
	}
	if err := common.Unmarshal(body, &result); err != nil {
		return false, fmt.Errorf("parse response: %w, body=%s", err, string(body))
	}

	return result.Success, nil
}
