package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// Subscription duration units
const (
	SubscriptionDurationYear   = "year"
	SubscriptionDurationMonth  = "month"
	SubscriptionDurationDay    = "day"
	SubscriptionDurationHour   = "hour"
	SubscriptionDurationCustom = "custom"
)

// Subscription plan
type SubscriptionPlan struct {
	Id int `json:"id"`

	Title    string `json:"title" gorm:"type:varchar(128);not null"`
	Subtitle string `json:"subtitle" gorm:"type:varchar(255);default:''"`

	// Display money amount (follow existing code style: float64 for money)
	PriceAmount float64 `json:"price_amount" gorm:"type:double;not null;default:0"`
	Currency    string  `json:"currency" gorm:"type:varchar(8);not null;default:'USD'"`

	DurationUnit  string `json:"duration_unit" gorm:"type:varchar(16);not null;default:'month'"`
	DurationValue int    `json:"duration_value" gorm:"type:int;not null;default:1"`
	CustomSeconds int64  `json:"custom_seconds" gorm:"type:bigint;not null;default:0"`

	Enabled   bool `json:"enabled" gorm:"default:true"`
	SortOrder int  `json:"sort_order" gorm:"type:int;default:0"`

	StripePriceId string `json:"stripe_price_id" gorm:"type:varchar(128);default:''"`
	CreemProductId string `json:"creem_product_id" gorm:"type:varchar(128);default:''"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (p *SubscriptionPlan) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	p.CreatedAt = now
	p.UpdatedAt = now
	return nil
}

func (p *SubscriptionPlan) BeforeUpdate(tx *gorm.DB) error {
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

type SubscriptionPlanItem struct {
	Id     int `json:"id"`
	PlanId int `json:"plan_id" gorm:"index"`

	ModelName string `json:"model_name" gorm:"type:varchar(128);index"`
	// 0=按量(额度), 1=按次(次数)
	QuotaType int `json:"quota_type" gorm:"type:int;index"`

	// If quota_type=0 => amount in quota units; if quota_type=1 => request count.
	AmountTotal int64 `json:"amount_total" gorm:"type:bigint;not null;default:0"`
}

// Subscription order (payment -> webhook -> create UserSubscription)
type SubscriptionOrder struct {
	Id     int   `json:"id"`
	UserId int   `json:"user_id" gorm:"index"`
	PlanId int   `json:"plan_id" gorm:"index"`
	Money  float64 `json:"money"`

	TradeNo       string `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	PaymentMethod string `json:"payment_method" gorm:"type:varchar(50)"`
	Status        string `json:"status"`
	CreateTime    int64  `json:"create_time"`
	CompleteTime  int64  `json:"complete_time"`

	ProviderPayload string `json:"provider_payload" gorm:"type:text"`
}

func (o *SubscriptionOrder) Insert() error {
	if o.CreateTime == 0 {
		o.CreateTime = common.GetTimestamp()
	}
	return DB.Create(o).Error
}

func (o *SubscriptionOrder) Update() error {
	return DB.Save(o).Error
}

func GetSubscriptionOrderByTradeNo(tradeNo string) *SubscriptionOrder {
	if tradeNo == "" {
		return nil
	}
	var order SubscriptionOrder
	if err := DB.Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
		return nil
	}
	return &order
}

// User subscription instance
type UserSubscription struct {
	Id     int `json:"id"`
	UserId int `json:"user_id" gorm:"index"`
	PlanId int `json:"plan_id" gorm:"index"`

	StartTime int64  `json:"start_time" gorm:"bigint"`
	EndTime   int64  `json:"end_time" gorm:"bigint;index"`
	Status    string `json:"status" gorm:"type:varchar(32);index"` // active/expired/cancelled

	Source string `json:"source" gorm:"type:varchar(32);default:'order'"` // order/admin

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (s *UserSubscription) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	s.CreatedAt = now
	s.UpdatedAt = now
	return nil
}

func (s *UserSubscription) BeforeUpdate(tx *gorm.DB) error {
	s.UpdatedAt = common.GetTimestamp()
	return nil
}

type UserSubscriptionItem struct {
	Id                 int   `json:"id"`
	UserSubscriptionId int   `json:"user_subscription_id" gorm:"index"`
	ModelName          string `json:"model_name" gorm:"type:varchar(128);index"`
	QuotaType          int    `json:"quota_type" gorm:"type:int;index"`
	AmountTotal        int64  `json:"amount_total" gorm:"type:bigint;not null;default:0"`
	AmountUsed         int64  `json:"amount_used" gorm:"type:bigint;not null;default:0"`
}

type SubscriptionSummary struct {
	Subscription *UserSubscription      `json:"subscription"`
	Items        []UserSubscriptionItem `json:"items"`
}

func calcPlanEndTime(start time.Time, plan *SubscriptionPlan) (int64, error) {
	if plan == nil {
		return 0, errors.New("plan is nil")
	}
	if plan.DurationValue <= 0 && plan.DurationUnit != SubscriptionDurationCustom {
		return 0, errors.New("duration_value must be > 0")
	}
	switch plan.DurationUnit {
	case SubscriptionDurationYear:
		return start.AddDate(plan.DurationValue, 0, 0).Unix(), nil
	case SubscriptionDurationMonth:
		return start.AddDate(0, plan.DurationValue, 0).Unix(), nil
	case SubscriptionDurationDay:
		return start.Add(time.Duration(plan.DurationValue) * 24 * time.Hour).Unix(), nil
	case SubscriptionDurationHour:
		return start.Add(time.Duration(plan.DurationValue) * time.Hour).Unix(), nil
	case SubscriptionDurationCustom:
		if plan.CustomSeconds <= 0 {
			return 0, errors.New("custom_seconds must be > 0")
		}
		return start.Add(time.Duration(plan.CustomSeconds) * time.Second).Unix(), nil
	default:
		return 0, fmt.Errorf("invalid duration_unit: %s", plan.DurationUnit)
	}
}

func GetSubscriptionPlanById(id int) (*SubscriptionPlan, error) {
	if id <= 0 {
		return nil, errors.New("invalid plan id")
	}
	var plan SubscriptionPlan
	if err := DB.Where("id = ?", id).First(&plan).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

func GetSubscriptionPlanItems(planId int) ([]SubscriptionPlanItem, error) {
	if planId <= 0 {
		return nil, errors.New("invalid plan id")
	}
	var items []SubscriptionPlanItem
	if err := DB.Where("plan_id = ?", planId).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func CreateUserSubscriptionFromPlanTx(tx *gorm.DB, userId int, plan *SubscriptionPlan, source string) (*UserSubscription, error) {
	if tx == nil {
		return nil, errors.New("tx is nil")
	}
	if plan == nil || plan.Id == 0 {
		return nil, errors.New("invalid plan")
	}
	if userId <= 0 {
		return nil, errors.New("invalid user id")
	}
	now := time.Now()
	endUnix, err := calcPlanEndTime(now, plan)
	if err != nil {
		return nil, err
	}
	sub := &UserSubscription{
		UserId:     userId,
		PlanId:     plan.Id,
		StartTime:  now.Unix(),
		EndTime:    endUnix,
		Status:     "active",
		Source:     source,
		CreatedAt:  common.GetTimestamp(),
		UpdatedAt:  common.GetTimestamp(),
	}
	if err := tx.Create(sub).Error; err != nil {
		return nil, err
	}
	items, err := GetSubscriptionPlanItems(plan.Id)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, errors.New("plan has no items")
	}
	userItems := make([]UserSubscriptionItem, 0, len(items))
	for _, it := range items {
		userItems = append(userItems, UserSubscriptionItem{
			UserSubscriptionId: sub.Id,
			ModelName:          it.ModelName,
			QuotaType:          it.QuotaType,
			AmountTotal:        it.AmountTotal,
			AmountUsed:         0,
		})
	}
	if err := tx.Create(&userItems).Error; err != nil {
		return nil, err
	}
	return sub, nil
}

// Complete a subscription order (idempotent). Creates a UserSubscription snapshot from the plan.
func CompleteSubscriptionOrder(tradeNo string, providerPayload string) error {
	if tradeNo == "" {
		return errors.New("tradeNo is empty")
	}
	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}
	var logUserId int
	var logPlanTitle string
	var logMoney float64
	var logPaymentMethod string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var order SubscriptionOrder
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(&order).Error; err != nil {
			return errors.New("subscription order not found")
		}
		if order.Status == common.TopUpStatusSuccess {
			return nil
		}
		if order.Status != common.TopUpStatusPending {
			return errors.New("subscription order status invalid")
		}
		plan, err := GetSubscriptionPlanById(order.PlanId)
		if err != nil {
			return err
		}
		if !plan.Enabled {
			// still allow completion for already purchased orders
		}
		_, err = CreateUserSubscriptionFromPlanTx(tx, order.UserId, plan, "order")
		if err != nil {
			return err
		}
		if err := upsertSubscriptionTopUpTx(tx, &order); err != nil {
			return err
		}
		order.Status = common.TopUpStatusSuccess
		order.CompleteTime = common.GetTimestamp()
		if providerPayload != "" {
			order.ProviderPayload = providerPayload
		}
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		logUserId = order.UserId
		logPlanTitle = plan.Title
		logMoney = order.Money
		logPaymentMethod = order.PaymentMethod
		return nil
	})
	if err != nil {
		return err
	}
	if logUserId > 0 {
		msg := fmt.Sprintf("订阅购买成功，套餐: %s，支付金额: %.2f，支付方式: %s", logPlanTitle, logMoney, logPaymentMethod)
		RecordLog(logUserId, LogTypeTopup, msg)
	}
	return nil
}

func upsertSubscriptionTopUpTx(tx *gorm.DB, order *SubscriptionOrder) error {
	if tx == nil || order == nil {
		return errors.New("invalid subscription order")
	}
	now := common.GetTimestamp()
	var topup TopUp
	if err := tx.Where("trade_no = ?", order.TradeNo).First(&topup).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			topup = TopUp{
				UserId:        order.UserId,
				Amount:        0,
				Money:         order.Money,
				TradeNo:       order.TradeNo,
				PaymentMethod: order.PaymentMethod,
				CreateTime:    order.CreateTime,
				CompleteTime:  now,
				Status:        common.TopUpStatusSuccess,
			}
			return tx.Create(&topup).Error
		}
		return err
	}
	topup.Money = order.Money
	if topup.PaymentMethod == "" {
		topup.PaymentMethod = order.PaymentMethod
	}
	if topup.CreateTime == 0 {
		topup.CreateTime = order.CreateTime
	}
	topup.CompleteTime = now
	topup.Status = common.TopUpStatusSuccess
	return tx.Save(&topup).Error
}

func ExpireSubscriptionOrder(tradeNo string) error {
	if tradeNo == "" {
		return errors.New("tradeNo is empty")
	}
	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var order SubscriptionOrder
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(&order).Error; err != nil {
			return errors.New("subscription order not found")
		}
		if order.Status != common.TopUpStatusPending {
			return nil
		}
		order.Status = common.TopUpStatusExpired
		order.CompleteTime = common.GetTimestamp()
		return tx.Save(&order).Error
	})
}

// Admin bind (no payment). Creates a UserSubscription from a plan.
func AdminBindSubscription(userId int, planId int, sourceNote string) error {
	if userId <= 0 || planId <= 0 {
		return errors.New("invalid userId or planId")
	}
	plan, err := GetSubscriptionPlanById(planId)
	if err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		_, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "admin")
		return err
	})
}

// GetAllActiveUserSubscriptions returns all active subscriptions for a user.
func GetAllActiveUserSubscriptions(userId int) ([]SubscriptionSummary, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	now := common.GetTimestamp()
	var subs []UserSubscription
	err := DB.Where("user_id = ? AND status = ? AND end_time > ?", userId, "active", now).
		Order("end_time desc, id desc").
		Find(&subs).Error
	if err != nil {
		return nil, err
	}
	result := make([]SubscriptionSummary, 0, len(subs))
	for _, sub := range subs {
		var items []UserSubscriptionItem
		if err := DB.Where("user_subscription_id = ?", sub.Id).Find(&items).Error; err != nil {
			continue
		}
		subCopy := sub
		result = append(result, SubscriptionSummary{Subscription: &subCopy, Items: items})
	}
	return result, nil
}

// GetAllUserSubscriptions returns all subscriptions (active and expired) for a user.
func GetAllUserSubscriptions(userId int) ([]SubscriptionSummary, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	var subs []UserSubscription
	err := DB.Where("user_id = ?", userId).
		Order("end_time desc, id desc").
		Find(&subs).Error
	if err != nil {
		return nil, err
	}
	result := make([]SubscriptionSummary, 0, len(subs))
	for _, sub := range subs {
		var items []UserSubscriptionItem
		if err := DB.Where("user_subscription_id = ?", sub.Id).Find(&items).Error; err != nil {
			continue
		}
		subCopy := sub
		result = append(result, SubscriptionSummary{Subscription: &subCopy, Items: items})
	}
	return result, nil
}

// ---- Admin helpers for managing user subscriptions ----

// AdminListUserSubscriptions lists all subscriptions (including expired) for a user.
func AdminListUserSubscriptions(userId int) ([]SubscriptionSummary, error) {
	return GetAllUserSubscriptions(userId)
}

// AdminInvalidateUserSubscription marks a user subscription as cancelled and ends it immediately.
func AdminInvalidateUserSubscription(userSubscriptionId int) error {
	if userSubscriptionId <= 0 {
		return errors.New("invalid userSubscriptionId")
	}
	now := common.GetTimestamp()
	return DB.Model(&UserSubscription{}).
		Where("id = ?", userSubscriptionId).
		Updates(map[string]interface{}{
			"status":     "cancelled",
			"end_time":   now,
			"updated_at": now,
		}).Error
}

// AdminDeleteUserSubscription hard-deletes a user subscription and its items.
func AdminDeleteUserSubscription(userSubscriptionId int) error {
	if userSubscriptionId <= 0 {
		return errors.New("invalid userSubscriptionId")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_subscription_id = ?", userSubscriptionId).Delete(&UserSubscriptionItem{}).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", userSubscriptionId).Delete(&UserSubscription{}).Error; err != nil {
			return err
		}
		return nil
	})
}

type SubscriptionPreConsumeResult struct {
	UserSubscriptionId int
	ItemId             int
	QuotaType          int
	PreConsumed        int64
	AmountTotal        int64
	AmountUsedBefore   int64
	AmountUsedAfter    int64
}

// PreConsumeUserSubscription finds a valid active subscription item and increments amount_used.
// quotaType=0 => consume quota units; quotaType=1 => consume request count (usually 1).
func PreConsumeUserSubscription(userId int, modelName string, quotaType int, amount int64) (*SubscriptionPreConsumeResult, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	if modelName == "" {
		return nil, errors.New("modelName is empty")
	}
	if amount <= 0 {
		return nil, errors.New("amount must be > 0")
	}
	now := common.GetTimestamp()

	returnValue := &SubscriptionPreConsumeResult{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var item UserSubscriptionItem
		// lock item row; join to ensure subscription still active
		q := tx.Set("gorm:query_option", "FOR UPDATE").
			Table("user_subscription_items").
			Select("user_subscription_items.*").
			Joins("JOIN user_subscriptions ON user_subscriptions.id = user_subscription_items.user_subscription_id").
			Where("user_subscriptions.user_id = ? AND user_subscriptions.status = ? AND user_subscriptions.end_time > ?", userId, "active", now).
			Where("user_subscription_items.model_name = ? AND user_subscription_items.quota_type = ?", modelName, quotaType).
			Order("user_subscriptions.end_time desc, user_subscriptions.id desc, user_subscription_items.id desc")
		if err := q.First(&item).Error; err != nil {
			return errors.New("no active subscription item for this model")
		}
		usedBefore := item.AmountUsed
		remain := item.AmountTotal - usedBefore
		if remain < amount {
			return fmt.Errorf("subscription quota insufficient, remain=%d need=%d", remain, amount)
		}
		item.AmountUsed += amount
		if err := tx.Save(&item).Error; err != nil {
			return err
		}
		returnValue.UserSubscriptionId = item.UserSubscriptionId
		returnValue.ItemId = item.Id
		returnValue.QuotaType = item.QuotaType
		returnValue.PreConsumed = amount
		returnValue.AmountTotal = item.AmountTotal
		returnValue.AmountUsedBefore = usedBefore
		returnValue.AmountUsedAfter = item.AmountUsed
		return nil
	})
	if err != nil {
		return nil, err
	}
	return returnValue, nil
}

type SubscriptionPlanInfo struct {
	PlanId    int
	PlanTitle string
}

func GetSubscriptionPlanInfoByUserSubscriptionId(userSubscriptionId int) (*SubscriptionPlanInfo, error) {
	if userSubscriptionId <= 0 {
		return nil, errors.New("invalid userSubscriptionId")
	}
	var sub UserSubscription
	if err := DB.Where("id = ?", userSubscriptionId).First(&sub).Error; err != nil {
		return nil, err
	}
	var plan SubscriptionPlan
	if err := DB.Where("id = ?", sub.PlanId).First(&plan).Error; err != nil {
		return nil, err
	}
	return &SubscriptionPlanInfo{
		PlanId:    sub.PlanId,
		PlanTitle: plan.Title,
	}, nil
}

func GetSubscriptionPlanInfoBySubscriptionItemId(itemId int) (*SubscriptionPlanInfo, error) {
	if itemId <= 0 {
		return nil, errors.New("invalid itemId")
	}
	var item UserSubscriptionItem
	if err := DB.Where("id = ?", itemId).First(&item).Error; err != nil {
		return nil, err
	}
	return GetSubscriptionPlanInfoByUserSubscriptionId(item.UserSubscriptionId)
}

// Update subscription used amount by delta (positive consume more, negative refund).
func PostConsumeUserSubscriptionDelta(itemId int, delta int64) error {
	if itemId <= 0 {
		return errors.New("invalid itemId")
	}
	if delta == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var item UserSubscriptionItem
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", itemId).First(&item).Error; err != nil {
			return err
		}
		newUsed := item.AmountUsed + delta
		if newUsed < 0 {
			newUsed = 0
		}
		if newUsed > item.AmountTotal {
			return fmt.Errorf("subscription used exceeds total, used=%d total=%d", newUsed, item.AmountTotal)
		}
		item.AmountUsed = newUsed
		return tx.Save(&item).Error
	})
}

