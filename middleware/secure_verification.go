package middleware

import (
	"net/http"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

const (
	// SecureVerificationSessionKey 安全验证的 session key（与 controller 保持一致）
	SecureVerificationSessionKey = "secure_verified_at"
	// SecureVerificationTimeout 验证有效期（秒）
	SecureVerificationTimeout = 300 // 5分钟
)

type SecureVerificationFailure struct {
	Status  int
	Code    string
	Message string
}

func CheckSecureVerification(c *gin.Context) *SecureVerificationFailure {
	// 检查用户是否已登录
	userId := c.GetInt("id")
	if userId == 0 {
		return &SecureVerificationFailure{
			Status:  http.StatusUnauthorized,
			Message: "未登录",
		}
	}

	// 检查 session 中的验证时间戳
	session := sessions.Default(c)
	verifiedAtRaw := session.Get(SecureVerificationSessionKey)

	if verifiedAtRaw == nil {
		return &SecureVerificationFailure{
			Status:  http.StatusForbidden,
			Message: "需要安全验证",
			Code:    "VERIFICATION_REQUIRED",
		}
	}

	verifiedAt, ok := verifiedAtRaw.(int64)
	if !ok {
		// session 数据格式错误
		session.Delete(SecureVerificationSessionKey)
		_ = session.Save()
		return &SecureVerificationFailure{
			Status:  http.StatusForbidden,
			Message: "验证状态异常，请重新验证",
			Code:    "VERIFICATION_INVALID",
		}
	}

	// 检查验证是否过期
	elapsed := time.Now().Unix() - verifiedAt
	if elapsed >= SecureVerificationTimeout {
		// 验证已过期，清除 session
		session.Delete(SecureVerificationSessionKey)
		_ = session.Save()
		return &SecureVerificationFailure{
			Status:  http.StatusForbidden,
			Message: "验证已过期，请重新验证",
			Code:    "VERIFICATION_EXPIRED",
		}
	}

	return nil
}

// SecureVerificationRequired 安全验证中间件
// 检查用户是否在有效时间内通过了安全验证
// 如果未验证或验证已过期，返回 401 错误
func SecureVerificationRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		if failure := CheckSecureVerification(c); failure != nil {
			response := gin.H{
				"success": false,
				"message": failure.Message,
			}
			if failure.Code != "" {
				response["code"] = failure.Code
			}
			c.JSON(failure.Status, response)
			c.Abort()
			return
		}

		// 验证有效，继续处理请求
		c.Next()
	}
}

// OptionalSecureVerification 可选的安全验证中间件
// 如果用户已验证，则在 context 中设置标记，但不阻止请求继续
// 用于某些需要区分是否已验证的场景
func OptionalSecureVerification() gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.GetInt("id")
		if userId == 0 {
			c.Set("secure_verified", false)
			c.Next()
			return
		}

		session := sessions.Default(c)
		verifiedAtRaw := session.Get(SecureVerificationSessionKey)

		if verifiedAtRaw == nil {
			c.Set("secure_verified", false)
			c.Next()
			return
		}

		verifiedAt, ok := verifiedAtRaw.(int64)
		if !ok {
			c.Set("secure_verified", false)
			c.Next()
			return
		}

		elapsed := time.Now().Unix() - verifiedAt
		if elapsed >= SecureVerificationTimeout {
			session.Delete(SecureVerificationSessionKey)
			_ = session.Save()
			c.Set("secure_verified", false)
			c.Next()
			return
		}

		c.Set("secure_verified", true)
		c.Set("secure_verified_at", verifiedAt)
		c.Next()
	}
}

// ClearSecureVerification 清除安全验证状态
// 用于用户登出或需要强制重新验证的场景
func ClearSecureVerification(c *gin.Context) {
	session := sessions.Default(c)
	session.Delete(SecureVerificationSessionKey)
	_ = session.Save()
}
