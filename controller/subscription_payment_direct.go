package controller

import (
	"errors"
	"math"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// Subscription prices are charged once; CNY conversion never uses recharge
// discounts or wallet credit ratios.
func quoteDirectSubscription(planID int) (*model.SubscriptionPlan, int64, error) {
	plan, err := model.GetSubscriptionPlanById(planID)
	if err != nil {
		return nil, 0, err
	}
	if !plan.Enabled || math.IsNaN(plan.PriceAmount) || math.IsInf(plan.PriceAmount, 0) || plan.PriceAmount <= 0 {
		return nil, 0, errors.New("套餐未启用或价格无效")
	}
	amount := decimal.NewFromFloat(plan.PriceAmount)
	switch plan.Currency {
	case "USD":
		rate := operation_setting.USDExchangeRate
		if rate <= 0 || math.IsNaN(rate) || math.IsInf(rate, 0) {
			return nil, 0, errors.New("人民币汇率无效")
		}
		amount = amount.Mul(decimal.NewFromFloat(rate))
	case "CNY":
	default:
		return nil, 0, errors.New("此套餐币种不支持支付宝或微信支付")
	}
	fen, err := service.AlipayAmountFen(amount.Round(2).StringFixed(2))
	return plan, fen, err
}

func QuoteSubscriptionDirectPay(c *gin.Context) {
	var req struct {
		PlanID        int    `json:"plan_id"`
		PaymentMethod string `json:"payment_method"`
	}
	if c.ShouldBindJSON(&req) != nil || req.PlanID <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if !requirePaymentCompliance(c) {
		return
	}
	enabled := false
	switch req.PaymentMethod {
	case model.PaymentMethodAlipayDirect:
		config, err := model.CurrentAlipayConfig()
		enabled = err == nil && config.Enabled
	case model.PaymentMethodWechatPay:
		config, err := model.CurrentWechatPayConfig()
		enabled = err == nil && config.Enabled
	}
	if !enabled {
		common.ApiErrorMsg(c, "支付方式未启用")
		return
	}
	_, fen, err := quoteDirectSubscription(req.PlanID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": decimal.NewFromInt(fen).Div(decimal.NewFromInt(100)).StringFixed(2)})
}
