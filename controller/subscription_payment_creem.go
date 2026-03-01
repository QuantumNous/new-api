package controller

import (
	"log"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/go-fuego/fuego"
	"github.com/thanhpk/randstr"
)

func SubscriptionRequestCreemPay(c fuego.ContextWithBody[dto.SubscriptionCreemPayRequest]) (*dto.Response[dto.CreemPayData], error) {
	req, err := c.Body()
	if err != nil || req.PlanId <= 0 {
		return dto.Fail[dto.CreemPayData]("参数错误")
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		return dto.Fail[dto.CreemPayData](err.Error())
	}
	if !plan.Enabled {
		return dto.Fail[dto.CreemPayData]("套餐未启用")
	}
	if plan.CreemProductId == "" {
		return dto.Fail[dto.CreemPayData]("该套餐未配置 CreemProductId")
	}
	if setting.CreemWebhookSecret == "" && !setting.CreemTestMode {
		return dto.Fail[dto.CreemPayData]("Creem Webhook 未配置")
	}

	userId := dto.UserID(c)
	user, err := model.GetUserById(userId, false)
	if err != nil {
		return dto.Fail[dto.CreemPayData](err.Error())
	}
	if user == nil {
		return dto.Fail[dto.CreemPayData]("用户不存在")
	}

	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			return dto.Fail[dto.CreemPayData](err.Error())
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			return dto.Fail[dto.CreemPayData]("已达到该套餐购买上限")
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
		return dto.Fail[dto.CreemPayData]("创建订单失败")
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
	product := &dto.CreemProduct{
		ProductId: plan.CreemProductId,
		Name:      plan.Title,
		Price:     plan.PriceAmount,
		Currency:  currency,
		Quota:     0,
	}

	checkoutUrl, err := genCreemLink(referenceId, product, user.Email, user.Username)
	if err != nil {
		log.Printf("获取Creem支付链接失败: %v", err)
		return dto.Fail[dto.CreemPayData]("拉起支付失败")
	}

	return dto.Ok(dto.CreemPayData{
		CheckoutUrl: checkoutUrl,
		OrderId:     referenceId,
	})
}
