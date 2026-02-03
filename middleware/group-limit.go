package middleware

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// GroupLimitContext 用于在请求上下文中存储限流相关信息
type GroupLimitContext struct {
	UserID            int
	ConcurrencyLocked bool // 是否已获取并发锁
}

const groupLimitContextKey = "group_limit_context"

// GroupLimit 用户组限制中间件
// 检查并发数、RPM 限制
// TPM 和 TPD 限制需要在请求完成后检查（因为需要知道使用的令牌数）
func GroupLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 检查功能是否启用
		if !setting.GroupLimitEnabled {
			c.Next()
			return
		}

		// 安全地执行限流检查，任何错误都不影响原有功能
		defer func() {
			if r := recover(); r != nil {
				common.SysLog("GroupLimit panic recovered: " + toString(r))
				c.Next()
			}
		}()

		// 获取用户ID
		userID := c.GetInt("id")
		if userID == 0 {
			// 未登录用户，跳过限流
			c.Next()
			return
		}

		// 获取用户组
		group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
		if group == "" {
			group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
		}
		if group == "" {
			// 无法获取用户组，跳过限流
			c.Next()
			return
		}

		// 获取用户组限制配置
		config := setting.GetGroupLimitConfig(group)

		// 如果所有限制都为0，跳过检查
		if config.Concurrency == 0 && config.RPM == 0 && config.RPD == 0 && config.TPD == 0 && config.TPM == 0 {
			c.Next()
			return
		}

		limiter := common.GetGroupLimiter()
		ctx := &GroupLimitContext{
			UserID:            userID,
			ConcurrencyLocked: false,
		}

		// 检查 RPM 限制
		if config.RPM > 0 {
			allowed, err := limiter.CheckRPM(userID, config.RPM)
			if err != nil {
				common.SysLog("GroupLimit CheckRPM error: " + err.Error())
				// 错误时允许通过
			} else if !allowed {
				abortWithGroupLimitError(c, "rpm", config.RPM)
				return
			}
		}

		// 检查 RPD 限制
		if config.RPD > 0 {
			allowed, err := limiter.CheckRPD(userID, config.RPD)
			if err != nil {
				common.SysLog("GroupLimit CheckRPD error: " + err.Error())
				// 错误时允许通过
			} else if !allowed {
				abortWithGroupLimitError(c, "rpd", config.RPD)
				return
			}
		}

		// 检查并发数限制
		if config.Concurrency > 0 {
			allowed, err := limiter.CheckConcurrency(userID, config.Concurrency)
			if err != nil {
				common.SysLog("GroupLimit CheckConcurrency error: " + err.Error())
				// 错误时允许通过
			} else if !allowed {
				abortWithGroupLimitError(c, "concurrency", config.Concurrency)
				return
			}
			ctx.ConcurrencyLocked = true
		}

		// 存储上下文信息
		c.Set(groupLimitContextKey, ctx)

		// 处理请求
		c.Next()

		// 释放并发锁
		if ctx.ConcurrencyLocked {
			if err := limiter.ReleaseConcurrency(userID); err != nil {
				common.SysLog("GroupLimit ReleaseConcurrency error: " + err.Error())
			}
		}
	}
}

// RecordGroupLimitTokens 记录使用的令牌数（在请求完成后调用）
// 这个函数应该在 relay 处理完成后调用
// 同时记录 TPM、TPD 和 RPD
func RecordGroupLimitTokens(c *gin.Context, tokens int64) {
	if !setting.GroupLimitEnabled {
		return
	}

	// 安全地执行，任何错误都不影响原有功能
	defer func() {
		if r := recover(); r != nil {
			common.SysLog("RecordGroupLimitTokens panic recovered: " + toString(r))
		}
	}()

	userID := c.GetInt("id")
	if userID == 0 {
		return
	}

	limiter := common.GetGroupLimiter()

	// 记录 TPM
	if err := limiter.RecordTokens(userID, tokens); err != nil {
		common.SysLog("RecordGroupLimitTokens RecordTokens error: " + err.Error())
	}

	// 记录 TPD
	if err := limiter.RecordTPD(userID, tokens); err != nil {
		common.SysLog("RecordGroupLimitTokens RecordTPD error: " + err.Error())
	}

	// 记录 RPD
	if err := limiter.RecordRPD(userID); err != nil {
		common.SysLog("RecordGroupLimitTokens RecordRPD error: " + err.Error())
	}
}

// CheckGroupLimitTPM 检查 TPM 限制（在请求开始前调用，用于预估检查）
// estimatedTokens 是预估的令牌数，可以基于请求内容估算
func CheckGroupLimitTPM(c *gin.Context, estimatedTokens int64) bool {
	if !setting.GroupLimitEnabled {
		return true
	}

	// 安全地执行，任何错误都不影响原有功能
	defer func() {
		if r := recover(); r != nil {
			common.SysLog("CheckGroupLimitTPM panic recovered: " + toString(r))
		}
	}()

	userID := c.GetInt("id")
	if userID == 0 {
		return true
	}

	// 获取用户组
	group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	if group == "" {
		group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	}
	if group == "" {
		return true
	}

	config := setting.GetGroupLimitConfig(group)
	if config.TPM == 0 {
		return true
	}

	limiter := common.GetGroupLimiter()
	allowed, err := limiter.CheckTPM(userID, config.TPM, estimatedTokens)
	if err != nil {
		common.SysLog("CheckGroupLimitTPM error: " + err.Error())
		return true // 错误时允许通过
	}

	if !allowed {
		abortWithGroupLimitError(c, "tpm", int(config.TPM))
		return false
	}

	return true
}

// CheckGroupLimitTPD 检查 TPD 限制（在请求开始前调用，用于预估检查）
// estimatedTokens 是预估的令牌数，可以基于请求内容估算
func CheckGroupLimitTPD(c *gin.Context, estimatedTokens int64) bool {
	if !setting.GroupLimitEnabled {
		return true
	}

	// 安全地执行，任何错误都不影响原有功能
	defer func() {
		if r := recover(); r != nil {
			common.SysLog("CheckGroupLimitTPD panic recovered: " + toString(r))
		}
	}()

	userID := c.GetInt("id")
	if userID == 0 {
		return true
	}

	// 获取用户组
	group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	if group == "" {
		group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	}
	if group == "" {
		return true
	}

	config := setting.GetGroupLimitConfig(group)
	if config.TPD == 0 {
		return true
	}

	limiter := common.GetGroupLimiter()
	allowed, err := limiter.CheckTPD(userID, config.TPD, estimatedTokens)
	if err != nil {
		common.SysLog("CheckGroupLimitTPD error: " + err.Error())
		return true // 错误时允许通过
	}

	if !allowed {
		abortWithGroupLimitError(c, "tpd", int(config.TPD))
		return false
	}

	return true
}

// abortWithGroupLimitError 返回限流错误响应
func abortWithGroupLimitError(c *gin.Context, limitType string, limit int) {
	var message string
	switch limitType {
	case "concurrency":
		message = "您已达到并发请求数限制：最多同时进行 " + strconv.Itoa(limit) + " 个请求"
	case "rpm":
		message = "您已达到每分钟请求数限制：每分钟最多 " + strconv.Itoa(limit) + " 次请求"
	case "rpd":
		message = "您已达到每日请求数限制：每天最多 " + strconv.Itoa(limit) + " 次请求"
	case "tpd":
		message = "您已达到每日令牌数限制：每天最多使用 " + strconv.Itoa(limit) + " 个令牌"
	case "tpm":
		message = "您已达到每分钟令牌数限制：每分钟最多使用 " + strconv.Itoa(limit) + " 个令牌"
	default:
		message = "请求频率超限，请稍后再试"
	}

	c.JSON(http.StatusTooManyRequests, gin.H{
		"error": gin.H{
			"message": message,
			"type":    "rate_limit_error",
			"code":    "rate_limit_exceeded",
		},
	})
	c.Abort()
}

// toString 安全地将 interface{} 转换为字符串
func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case error:
		return val.Error()
	default:
		return ""
	}
}
