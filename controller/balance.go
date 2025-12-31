package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetTokenBalance 获取 Token 余额信息
// GET /usage/api/balance
// 与 GetTokenUsage 保持完全一致的实现方式
func GetTokenBalance(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "No Authorization header",
		})
		return
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Invalid Bearer token",
		})
		return
	}
	tokenKey := parts[1]

	// 强制从数据库读取，确保余额数据准确（不使用 Redis 缓存）
	token, err := model.GetTokenByKey(strings.TrimPrefix(tokenKey, "sk-"), true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 计算 remain_amount: remain_quota / QuotaPerUnit (500000)
	remainAmount := float64(token.RemainQuota) / common.QuotaPerUnit

	// 获取状态文本
	statusText := getTokenStatusText(token.Status)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"name":          token.Name,
			"remain_quota":  token.RemainQuota,
			"remain_amount": remainAmount,
			"unlimited":     token.UnlimitedQuota,
			"expired_time":  token.ExpiredTime,
			"status":        token.Status,
			"status_text":   statusText,
		},
	})
}

// getTokenStatusText 根据状态码返回状态文本
func getTokenStatusText(status int) string {
	switch status {
	case common.TokenStatusEnabled:
		return "enabled"
	case common.TokenStatusDisabled:
		return "disabled"
	case common.TokenStatusExpired:
		return "expired"
	case common.TokenStatusExhausted:
		return "exhausted"
	default:
		return "unknown"
	}
}

