package controller

import (
	"bytes"
	"io"
	"log"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

type SubscriptionCreemPayRequest struct {
	PlanId int `json:"plan_id"`
}

func SubscriptionRequestCreemPay(c *gin.Context) {
	var req SubscriptionCreemPayRequest

	// Keep body for debugging consistency (like RequestCreemPay)
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("read subscription creem pay req body err: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "read query error"})
		return
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		c.JSON(200, gin.H{"message": "error", "data": common.TranslateMessage(c, "common.invalid_params")})
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, common.TranslateMessage(c, "subscription.not_enabled"))
		return
	}
	if plan.CreemProductId == "" {
		common.ApiErrorMsg(c, common.TranslateMessage(c, "payment.product_config_error"))
		return
	}
	if setting.CreemWebhookSecret == "" && !setting.CreemTestMode {
		common.ApiErrorMsg(c, common.TranslateMessage(c, "payment.webhook_not_configured"))
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorMsg(c, common.TranslateMessage(c, "user.not_exists"))
		return
	}

	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, common.TranslateMessage(c, "subscription.purchase_max"))
			return
		}
	}

	reference := "sub-creem-ref-" + randstr.String(6)
	referenceId := "sub_ref_" + common.Sha1([]byte(reference+time.Now().String()+user.Username))

	// create pending order first
	order := &model.SubscriptionOrder{
		UserId:        userId,
		PlanId:        plan.Id,
		Money:         plan.PriceAmount,
		TradeNo:       referenceId,
		PaymentMethod: PaymentMethodCreem,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		c.JSON(200, gin.H{"message": "error", "data": common.TranslateMessage(c, "payment.create_failed")})
		return
	}

	// Reuse Creem checkout generator by building a lightweight product reference.
	currency := "USD"
	switch operation_setting.GetGeneralSetting().QuotaDisplayType {
	case operation_setting.QuotaDisplayTypeCNY:
		currency = "CNY"
	case operation_setting.QuotaDisplayTypeUSD:
		currency = "USD"
	default:
		currency = "USD"
	}
	product := &CreemProduct{
		ProductId: plan.CreemProductId,
		Name:      plan.Title,
		Price:     plan.PriceAmount,
		Currency:  currency,
		Quota:     0,
	}

	checkoutUrl, err := genCreemLink(referenceId, product, user.Email, user.Username)
	if err != nil {
		log.Println(i18n.Translate("topup.get_creem_pay_link_failed", map[string]any{"Error": err.Error()}))
		c.JSON(200, gin.H{"message": "error", "data": common.TranslateMessage(c, "payment.start_failed")})
		return
	}

	c.JSON(200, gin.H{
		"message": "success",
		"data": gin.H{
			"checkout_url": checkoutUrl,
			"order_id":     referenceId,
		},
	})
}
