package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const (
	orderStatusTypeAuto         = "auto"
	orderStatusTypeTopUp        = "topup"
	orderStatusTypeSubscription = "subscription"
)

func GetOrderStatus(c *gin.Context) {
	userId := c.GetInt("id")
	tradeNo := strings.TrimSpace(c.Query("trade_no"))
	queryType := strings.ToLower(strings.TrimSpace(c.DefaultQuery("type", orderStatusTypeAuto)))

	if tradeNo == "" {
		common.ApiErrorMsg(c, "订单号不能为空")
		return
	}

	switch queryType {
	case orderStatusTypeAuto:
		if topUp := model.GetTopUpByTradeNoAndUserId(tradeNo, userId); topUp != nil {
			common.ApiSuccess(c, buildTopUpOrderStatus(topUp))
			return
		}
		if order := model.GetSubscriptionOrderByTradeNoAndUserId(tradeNo, userId); order != nil {
			common.ApiSuccess(c, buildSubscriptionOrderStatus(order))
			return
		}
	case orderStatusTypeTopUp:
		if topUp := model.GetTopUpByTradeNoAndUserId(tradeNo, userId); topUp != nil {
			common.ApiSuccess(c, buildTopUpOrderStatus(topUp))
			return
		}
	case orderStatusTypeSubscription:
		if order := model.GetSubscriptionOrderByTradeNoAndUserId(tradeNo, userId); order != nil {
			common.ApiSuccess(c, buildSubscriptionOrderStatus(order))
			return
		}
	default:
		common.ApiErrorMsg(c, "订单类型无效")
		return
	}

	common.ApiErrorMsg(c, "订单不存在")
}

func buildTopUpOrderStatus(topUp *model.TopUp) gin.H {
	return gin.H{
		"order_type":       orderStatusTypeTopUp,
		"trade_no":         topUp.TradeNo,
		"status":           topUp.Status,
		"payment_method":   topUp.PaymentMethod,
		"payment_provider": topUp.PaymentProvider,
		"create_time":      topUp.CreateTime,
		"complete_time":    topUp.CompleteTime,
		"amount":           topUp.Amount,
		"money":            topUp.Money,
	}
}

func buildSubscriptionOrderStatus(order *model.SubscriptionOrder) gin.H {
	return gin.H{
		"order_type":       orderStatusTypeSubscription,
		"trade_no":         order.TradeNo,
		"status":           order.Status,
		"payment_method":   order.PaymentMethod,
		"payment_provider": order.PaymentProvider,
		"create_time":      order.CreateTime,
		"complete_time":    order.CompleteTime,
		"plan_id":          order.PlanId,
		"money":            order.Money,
	}
}
