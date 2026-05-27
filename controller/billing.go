package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type displaySubscriptionResponse struct {
	Object             string `json:"object"`
	HasPaymentMethod   bool   `json:"has_payment_method"`
	SoftLimitUSD       string `json:"soft_limit_usd"`
	HardLimitUSD       string `json:"hard_limit_usd"`
	SystemHardLimitUSD string `json:"system_hard_limit_usd"`
	AccessUntil        int64  `json:"access_until"`
}

type displayUsageResponse struct {
	Object     string `json:"object"`
	TotalUsage string `json:"total_usage"` // unit: 0.01 dollar
}

func formatBillingDisplayAmount(quota int64, unlimited bool) string {
	if unlimited {
		return "100000000"
	}
	amount := decimal.NewFromInt(quota)
	switch operation_setting.GetQuotaDisplayType() {
	case operation_setting.QuotaDisplayTypeCNY:
		amount = amount.Div(decimal.NewFromFloat(common.QuotaPerUnit)).Mul(decimal.NewFromFloat(operation_setting.USDExchangeRate))
	case operation_setting.QuotaDisplayTypeTokens:
		// Keep raw token/quota units.
	default:
		amount = amount.Div(decimal.NewFromFloat(common.QuotaPerUnit))
	}
	return amount.String()
}

func GetSubscription(c *gin.Context) {
	var remainQuota int64
	var usedQuota int64
	var err error
	var token *model.Token
	var expiredTime int64
	if common.DisplayTokenStatEnabled {
		tokenId := c.GetInt("token_id")
		token, err = model.GetTokenById(tokenId)
		expiredTime = token.ExpiredTime
		remainQuota = token.RemainQuota
		usedQuota = token.UsedQuota
	} else {
		userId := c.GetInt("id")
		remainQuota, err = model.GetUserQuota(userId, false)
		usedQuota, err = model.GetUserUsedQuota(userId)
	}
	if expiredTime <= 0 {
		expiredTime = 0
	}
	if err != nil {
		openAIError := types.OpenAIError{
			Message: err.Error(),
			Type:    "upstream_error",
		}
		c.JSON(200, gin.H{
			"error": openAIError,
		})
		return
	}
	quota := remainQuota + usedQuota
	amount := formatBillingDisplayAmount(quota, token != nil && token.UnlimitedQuota)
	subscription := displaySubscriptionResponse{
		Object:             "billing_subscription",
		HasPaymentMethod:   true,
		SoftLimitUSD:       amount,
		HardLimitUSD:       amount,
		SystemHardLimitUSD: amount,
		AccessUntil:        expiredTime,
	}
	c.JSON(200, subscription)
	return
}

func GetUsage(c *gin.Context) {
	var quota int64
	var err error
	var token *model.Token
	if common.DisplayTokenStatEnabled {
		tokenId := c.GetInt("token_id")
		token, err = model.GetTokenById(tokenId)
		quota = token.UsedQuota
	} else {
		userId := c.GetInt("id")
		quota, err = model.GetUserUsedQuota(userId)
	}
	if err != nil {
		openAIError := types.OpenAIError{
			Message: err.Error(),
			Type:    "new_api_error",
		}
		c.JSON(200, gin.H{
			"error": openAIError,
		})
		return
	}
	amount := formatBillingDisplayAmount(quota, false)
	usage := displayUsageResponse{
		Object:     "list",
		TotalUsage: decimal.RequireFromString(amount).Mul(decimal.NewFromInt(100)).String(),
	}
	c.JSON(200, usage)
	return
}
