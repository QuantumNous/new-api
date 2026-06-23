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
	"net/http"

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
//     前端 ESA SDK 弹窗验证通过后获得 captcha_verify_param 并随请求
//     发送到后端。生产环境中 ESA 边缘节点透明验签并注入 X-Captcha-Verify-Code
//     响应头；本地/无 ESA 边缘时校验参数非空。
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

		// --- 普通模式：前端 ESA SDK 已完成人机验证 ---
		// 验证通过后前端获得 captcha_verify_param，由 ESA 边缘节点在请求到达后端
		// 之前透明验签并注入 X-Captcha-Verify-Code: T001 响应头。
		// 本地/无 ESA 边缘时，仅校验参数非空（前端 SDK 弹出验证码已确保真人操作）。
		captchaVerifyParam := c.Query("captcha_verify_param")
		if captchaVerifyParam == "" {
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
	case "delete_account":
		return common.ESACaptchaDeleteAccountSceneId
	case "checkin":
		return common.ESACaptchaCheckinSceneId
	default:
		return ""
	}
}
