package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// BalanceResponse 余额查询响应结构
type BalanceResponse struct {
	Name         string  `json:"name"`
	RemainQuota  int64   `json:"remain_quota"`
	RemainAmount float64 `json:"remain_amount"`
	Unlimited    bool    `json:"unlimited"`
	ExpiredTime  int64   `json:"expired_time"`
	Status       int     `json:"status"`
	StatusText   string  `json:"status_text"`
}

// GetTokenBalance 获取 Token 余额信息
// GET /usage/api/balance
func GetTokenBalance(c *gin.Context) {
	// 从中间件设置的 context 中获取 token_id（由 TokenAuth 中间件设置）
	tokenId := c.GetInt("token_id")
	if tokenId == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Invalid token",
		})
		return
	}

	// 从数据库获取最新的 token 信息（与 GetSubscription 保持一致）
	token, err := model.GetTokenById(tokenId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 计算 remain_amount
	remainAmount := float64(token.RemainQuota) / common.QuotaPerUnit

	// 获取状态文本
	statusText := getTokenStatusText(token.Status)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": BalanceResponse{
			Name:         token.Name,
			RemainQuota:  int64(token.RemainQuota),
			RemainAmount: remainAmount,
			Unlimited:    token.UnlimitedQuota,
			ExpiredTime:  token.ExpiredTime,
			Status:       token.Status,
			StatusText:   statusText,
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

