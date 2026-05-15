package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

// SubscriptionWaffoPancakePayRequest is the request body for the subscription
// purchase endpoint. The buyer picks a plan in the wallet UI; the only thing
// the backend needs to know is which plan to mint a checkout session for.
type SubscriptionWaffoPancakePayRequest struct {
	PlanId int `json:"plan_id"`
}

// SubscriptionRequestWaffoPancakePay creates a Pancake checkout session for
// a subscription plan purchase. Mirrors the Stripe and Creem subscription
// flows: validate plan + gateway config, create a SubscriptionOrder row
// (status = pending) keyed by a uniquely-prefixed trade_no, then ask the
// Pancake SDK for a hosted-checkout URL with a PriceSnapshot override
// pinned to the plan's current PriceAmount (USD).
//
// The webhook handler (WaffoPancakeWebhook) tries CompleteSubscriptionOrder
// before falling back to RechargeWaffoPancake, so the same /webhook/:env
// endpoint handles both subscription and top-up completions.
func SubscriptionRequestWaffoPancakePay(c *gin.Context) {
	var req SubscriptionWaffoPancakePayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "套餐未启用")
		return
	}
	if strings.TrimSpace(plan.WaffoPancakeProductId) == "" {
		common.ApiErrorMsg(c, "该套餐未配置 WaffoPancakeProductId")
		return
	}
	// Gateway must be fully configured. We don't gate on WaffoPancakeProductID
	// from settings here — the plan can target its own Pancake product, but
	// MerchantID + PrivateKey are still required to authenticate the call.
	if strings.TrimSpace(setting.WaffoPancakeMerchantID) == "" ||
		strings.TrimSpace(setting.WaffoPancakePrivateKey) == "" {
		common.ApiErrorMsg(c, "Waffo Pancake 未配置或密钥无效")
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorMsg(c, "用户不存在")
		return
	}

	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, "已达到该套餐购买上限")
			return
		}
	}

	// Distinct prefix from the top-up flow (which uses WAFFO_PANCAKE-…) so the
	// webhook handler can tell which table to look up.
	tradeNo := fmt.Sprintf("WAFFO_PANCAKE_SUB-%d-%d-%s", userId, time.Now().UnixMilli(), randstr.String(6))

	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodWaffoPancake,
		PaymentProvider: model.PaymentProviderWaffoPancake,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Waffo Pancake 订阅订单创建失败 user_id=%d plan_id=%d trade_no=%s error=%q", userId, plan.Id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	expiresInSeconds := 45 * 60
	session, err := service.CreateWaffoPancakeCheckoutSession(c.Request.Context(), &service.WaffoPancakeCreateSessionParams{
		ProductID:     plan.WaffoPancakeProductId,
		BuyerIdentity: service.WaffoPancakeBuyerIdentityFromUserID(user.Id),
		PriceSnapshot: &service.WaffoPancakePriceSnapshot{
			Amount:      decimal.NewFromFloat(plan.PriceAmount).StringFixed(2),
			TaxCategory: "saas",
		},
		BuyerEmail:       getWaffoPancakeBuyerEmail(user),
		ExpiresInSeconds: &expiresInSeconds,
	})
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Waffo Pancake 订阅结账会话创建失败 user_id=%d plan_id=%d trade_no=%s error=%q", userId, plan.Id, tradeNo, err.Error()))
		order.Status = common.TopUpStatusFailed
		_ = order.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Waffo Pancake 订阅订单创建成功 user_id=%d plan_id=%d trade_no=%s session_id=%s money=%.2f", userId, plan.Id, tradeNo, session.SessionID, plan.PriceAmount))

	// Match the field-name convention used by the wallet Pancake flow
	// (checkout_url) so the frontend can share its response-shape handling.
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"checkout_url":     session.CheckoutURL,
			"session_id":       session.SessionID,
			"expires_at":       session.ExpiresAt,
			"order_id":         tradeNo,
			"token":            session.Token,
			"token_expires_at": session.TokenExpiresAt,
		},
	})
}
