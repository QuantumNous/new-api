package controller

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
	"github.com/waffo-com/waffo-go/types/subscription"
)

type SubscriptionWaffoPayRequest struct {
	PlanId        int    `json:"plan_id"`
	PayMethodType string `json:"pay_method_type,omitempty"`
}

func SubscriptionRequestWaffoPay(c *gin.Context) {
	c.JSON(200, gin.H{"message": "error", "data": "订阅功能暂不支持，敬请期待"})
	return
	if !setting.WaffoEnabled {
		c.JSON(200, gin.H{"message": "error", "data": "Waffo 支付未启用"})
		return
	}

	var req SubscriptionWaffoPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": err.Error()})
		return
	}
	if !plan.Enabled {
		c.JSON(200, gin.H{"message": "error", "data": "套餐未启用"})
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": err.Error()})
		return
	}
	if user == nil {
		c.JSON(200, gin.H{"message": "error", "data": "用户不存在"})
		return
	}

	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			c.JSON(200, gin.H{"message": "error", "data": err.Error()})
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			c.JSON(200, gin.H{"message": "error", "data": "已达到该套餐购买上限"})
			return
		}
	}

	subscriptionRequest := fmt.Sprintf("SR-%d-%d-%s", userId, time.Now().UnixMilli(), randstr.String(6))
	merchantSubscriptionId := fmt.Sprintf("SUB-%d-%d-%s", userId, time.Now().UnixMilli(), randstr.String(4))

	order := &model.SubscriptionOrder{
		UserId:        userId,
		PlanId:        plan.Id,
		Money:         plan.PriceAmount,
		TradeNo:       merchantSubscriptionId,
		PaymentMethod: "waffo",
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	sdk, err := getWaffoSDK()
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "支付配置错误"})
		return
	}

	callbackAddr := service.GetCallbackAddress()
	notifyUrl := callbackAddr + "/api/waffo/webhook"
	if setting.WaffoNotifyUrl != "" {
		notifyUrl = setting.WaffoNotifyUrl
	}
	returnUrl := system_setting.ServerAddress + "/console/topup?show_history=true"
	if setting.WaffoSubscriptionReturnUrl != "" {
		returnUrl = setting.WaffoSubscriptionReturnUrl
	} else if setting.WaffoReturnUrl != "" {
		returnUrl = setting.WaffoReturnUrl
	}

	periodType, periodInterval, err := mapSubscriptionPeriod(plan.DurationUnit, plan.DurationValue)
	if err != nil {
		log.Printf("Waffo 订阅周期不支持: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": err.Error()})
		return
	}

	currency := plan.Currency
	if currency == "" {
		currency = getWaffoCurrency()
	}
	amount := formatWaffoAmount(plan.PriceAmount, currency)
	description := fmt.Sprintf("Subscription: %s", plan.Title)
	userEmail := getWaffoUserEmail(user)

	log.Printf("Waffo 订阅请求 - PlanId: %d, Currency: %s, Amount: %s, Period: %s/%s, NotifyUrl: %s", plan.Id, currency, amount, periodType, periodInterval, notifyUrl)

	params := &subscription.CreateSubscriptionParams{
		SubscriptionRequest:    subscriptionRequest,
		MerchantSubscriptionID: merchantSubscriptionId,
		Currency:               currency,
		Amount:                 amount,
		ProductInfo: &subscription.ProductInfo{
			Description:    description,
			PeriodType:     periodType,
			PeriodInterval: periodInterval,
		},
		MerchantInfo: &subscription.SubscriptionMerchantInfo{
			MerchantID: setting.WaffoMerchantId,
		},
		UserInfo: &subscription.SubscriptionUserInfo{
			UserID:       strconv.Itoa(user.Id),
			UserEmail:    userEmail,
			UserTerminal: "WEB",
		},
		NotifyURL:                 notifyUrl,
		SuccessRedirectURL:        returnUrl,
		FailedRedirectURL:         returnUrl,
		CancelRedirectURL:         returnUrl,
		SubscriptionManagementURL: returnUrl,
		RequestedAt:               time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		PaymentInfo: &subscription.SubscriptionPaymentInfo{
			ProductName:   "SUBSCRIPTION",
			PayMethodType: getSubscriptionPayMethodType(req.PayMethodType),
		},
		GoodsInfo: &subscription.SubscriptionGoodsInfo{
			GoodsName:     plan.Title,
			GoodsID:       strconv.Itoa(plan.Id),
			GoodsQuantity: 1,
		},
	}
	if debugJSON, err := json.MarshalIndent(params, "", "  "); err == nil {
		log.Printf("Waffo 订阅请求完整参数:\n%s", string(debugJSON))
	}
	resp, err := sdk.Subscription().Create(c.Request.Context(), params, nil)
	if err != nil {
		log.Printf("Waffo 创建订阅失败: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	if !resp.IsSuccess() {
		log.Printf("Waffo 创建订阅业务失败: [%s] %s, 完整响应: %+v", resp.Code, resp.Message, resp)
		c.JSON(200, gin.H{"message": "error", "data": fmt.Sprintf("拉起支付失败: [%s] %s", resp.Code, resp.Message)})
		return
	}

	subData := resp.GetData()
	paymentUrl := subData.FetchRedirectURL()
	if paymentUrl == "" {
		paymentUrl = subData.SubscriptionAction
	}

	c.JSON(200, gin.H{
		"message": "success",
		"data": gin.H{
			"payment_url": paymentUrl,
			"order_id":    merchantSubscriptionId,
		},
	})
}

// getSubscriptionPayMethodType returns the PayMethodType to pass to Waffo.
// If the frontend specified one, use it directly; otherwise concatenate all default payment methods.
func getSubscriptionPayMethodType(requestType string) string {
	if requestType != "" {
		return requestType
	}
	types := make([]string, 0, len(constant.DefaultWaffoPayMethods))
	for _, m := range constant.DefaultWaffoPayMethods {
		types = append(types, m.PayMethodType)
	}
	return strings.Join(types, ",")
}

// mapSubscriptionPeriod 将订阅计划的 DurationUnit/DurationValue 映射为 Waffo 的 PeriodType/PeriodInterval。
// Waffo 支持 DAILY / WEEKLY / MONTHLY，不支持 YEARLY；年度计划按 MONTHLY × 12 折算。
// hour 和 custom 类型不支持 Waffo 订阅。
func mapSubscriptionPeriod(durationUnit string, durationValue int) (periodType string, periodInterval string, err error) {
	switch durationUnit {
	case model.SubscriptionDurationDay:
		return "DAILY", strconv.Itoa(durationValue), nil
	case model.SubscriptionDurationMonth:
		return "MONTHLY", strconv.Itoa(durationValue), nil
	case model.SubscriptionDurationYear:
		return "MONTHLY", strconv.Itoa(durationValue * 12), nil
	default:
		return "", "", fmt.Errorf("Waffo 订阅不支持 %s 类型的周期", durationUnit)
	}
}
