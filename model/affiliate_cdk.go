package model

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	AffiliateCdkSourceType = "affiliate_cdk"

	AffiliateCdkOrderMaxQuantity = 100
)

var (
	ErrAffiliateCdkOrderNotFound      = errors.New("affiliate cdk order not found")
	ErrAffiliateCdkOrderStatusInvalid = errors.New("affiliate cdk order status invalid")
)

type AffiliateCdkOrder struct {
	Id                     int     `json:"id"`
	UserId                 int     `json:"user_id" gorm:"index"`
	TradeNo                string  `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	CodeAmount             int64   `json:"code_amount" gorm:"type:bigint;not null;default:0"`
	Quantity               int     `json:"quantity" gorm:"not null;default:0"`
	TotalAmount            int64   `json:"total_amount" gorm:"type:bigint;not null;default:0"`
	CodeQuota              int     `json:"code_quota" gorm:"not null;default:0"`
	TotalQuota             int     `json:"total_quota" gorm:"not null;default:0"`
	WalletPayAmount        float64 `json:"wallet_pay_amount" gorm:"type:decimal(10,2);not null;default:0"`
	PayAmount              float64 `json:"pay_amount" gorm:"type:decimal(10,2);not null;default:0"`
	CdkPurchaseDiscountBps int     `json:"cdk_purchase_discount_bps" gorm:"not null;default:0"`
	PaymentMethod          string  `json:"payment_method" gorm:"type:varchar(50)"`
	PaymentProvider        string  `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	Status                 string  `json:"status" gorm:"type:varchar(20);index"`
	CreateTime             int64   `json:"create_time" gorm:"index"`
	CompleteTime           int64   `json:"complete_time"`
	ProviderPayload        string  `json:"provider_payload" gorm:"type:text"`
}

type AffiliateCdkQuoteResult struct {
	Amount                 int64   `json:"amount"`
	Quantity               int     `json:"quantity"`
	TotalAmount            int64   `json:"total_amount"`
	CodeQuota              int     `json:"code_quota"`
	TotalQuota             int     `json:"total_quota"`
	UnitWalletPayAmount    float64 `json:"unit_wallet_pay_amount"`
	UnitPayAmount          float64 `json:"unit_pay_amount"`
	WalletPayAmount        float64 `json:"wallet_pay_amount"`
	PayAmount              float64 `json:"pay_amount"`
	CdkPurchaseDiscountBps int     `json:"cdk_purchase_discount_bps"`
	DiscountConfigured     bool    `json:"discount_configured"`
}

type AffiliateCdkOrderQuery struct {
	UserId int
	Status string
}

type AffiliateCdkCodeQuery struct {
	UserId int
	Status int
}

type AffiliateCdkCodeRecord struct {
	Id                int     `json:"id"`
	UserId            int     `json:"user_id"`
	Key               string  `json:"key"`
	Status            int     `json:"status"`
	Name              string  `json:"name"`
	Quota             int     `json:"quota"`
	SourceType        string  `json:"source_type"`
	SourceOrderId     int     `json:"source_order_id"`
	CreatedTime       int64   `json:"created_time"`
	RedeemedTime      int64   `json:"redeemed_time"`
	UsedUserId        int     `json:"used_user_id"`
	UsedUsername      string  `json:"used_username"`
	ExpiredTime       int64   `json:"expired_time"`
	CodeAmount        int64   `json:"code_amount"`
	OrderQuantity     int     `json:"order_quantity"`
	PayAmount         float64 `json:"pay_amount"`
	UnitPayAmount     float64 `json:"unit_pay_amount"`
	PaymentMethod     string  `json:"payment_method"`
	OrderCompleteTime int64   `json:"order_complete_time"`
}

func roundPaymentAmount(amount float64) float64 {
	return decimal.NewFromFloat(amount).Round(2).InexactFloat64()
}

func validateAffiliateCdkQuantity(quantity int) error {
	if quantity <= 0 {
		return errors.New("购买数量必须大于 0")
	}
	if quantity > AffiliateCdkOrderMaxQuantity {
		return fmt.Errorf("一次最多购买 %d 个 CDK", AffiliateCdkOrderMaxQuantity)
	}
	return nil
}

func validateAffiliateCdkAmount(amount int64) error {
	if amount <= 0 {
		return errors.New("CDK 面额必须大于 0")
	}
	amountOptions := operation_setting.GetPaymentSetting().AmountOptions
	if len(amountOptions) == 0 {
		return errors.New("管理员未配置可购买的 CDK 面额")
	}
	for _, option := range amountOptions {
		if int64(option) == amount {
			return nil
		}
	}
	return errors.New("CDK 面额必须来自钱包金额选项")
}

func validateAffiliateCdkAmountPositive(amount int64) error {
	if amount <= 0 {
		return errors.New("CDK 面额必须大于 0")
	}
	return nil
}

func validateAffiliateCdkDiscount(discountBps int) error {
	if discountBps <= 0 {
		return errors.New("管理员未配置代理 CDK 采购折扣")
	}
	if discountBps >= 10000 {
		return errors.New("代理 CDK 采购折扣必须低于钱包价格")
	}
	return nil
}

func calculateAffiliateCdkQuote(userId int, amount int64, quantity int) (AffiliateCdkQuoteResult, error) {
	if userId <= 0 {
		return AffiliateCdkQuoteResult{}, errors.New("用户 ID 参数无效")
	}
	if err := validateAffiliateCdkAmountPositive(amount); err != nil {
		return AffiliateCdkQuoteResult{}, err
	}
	if err := validateAffiliateCdkQuantity(quantity); err != nil {
		return AffiliateCdkQuoteResult{}, err
	}
	if err := validateAffiliateCdkAmount(amount); err != nil {
		return AffiliateCdkQuoteResult{}, err
	}

	distribution := operation_setting.GetDistributionSetting()
	if err := validateAffiliateCdkDiscount(distribution.CdkPurchaseDiscountBps); err != nil {
		return AffiliateCdkQuoteResult{
			Amount:                 amount,
			Quantity:               quantity,
			TotalAmount:            amount * int64(quantity),
			CdkPurchaseDiscountBps: distribution.CdkPurchaseDiscountBps,
			DiscountConfigured:     false,
		}, err
	}

	totalAmount := amount * int64(quantity)
	if totalAmount < MinTopUpAmountForDisplay() {
		return AffiliateCdkQuoteResult{}, fmt.Errorf("购买总额不能小于 %d", MinTopUpAmountForDisplay())
	}
	storageAmount := NormalizeTopUpAmountForStorage(amount)
	codeQuota := calculateQuotaFromAmount(storageAmount)
	if codeQuota <= 0 {
		return AffiliateCdkQuoteResult{}, errors.New("CDK 兑换额度过低")
	}
	totalQuota64 := int64(codeQuota) * int64(quantity)
	if totalQuota64 > int64(math.MaxInt) {
		return AffiliateCdkQuoteResult{}, errors.New("CDK 兑换额度过大")
	}

	group, err := GetUserGroup(userId, true)
	if err != nil {
		return AffiliateCdkQuoteResult{}, err
	}
	unitWalletPayAmount := roundPaymentAmount(CalculateTopUpPayMoney(amount, group))
	if unitWalletPayAmount <= 0.01 {
		return AffiliateCdkQuoteResult{}, errors.New("购买金额过低")
	}
	walletPayAmount := roundPaymentAmount(decimal.NewFromFloat(unitWalletPayAmount).
		Mul(decimal.NewFromInt(int64(quantity))).
		InexactFloat64())
	if walletPayAmount <= 0.01 {
		return AffiliateCdkQuoteResult{}, errors.New("购买金额过低")
	}
	unitPayAmount := roundPaymentAmount(decimal.NewFromFloat(unitWalletPayAmount).
		Mul(decimal.NewFromInt(int64(distribution.CdkPurchaseDiscountBps))).
		Div(decimal.NewFromInt(10000)).
		InexactFloat64())
	if unitPayAmount <= 0 {
		return AffiliateCdkQuoteResult{}, errors.New("代理 CDK 采购金额过低")
	}
	payAmount := roundPaymentAmount(decimal.NewFromFloat(unitPayAmount).
		Mul(decimal.NewFromInt(int64(quantity))).
		InexactFloat64())
	if payAmount <= 0 {
		return AffiliateCdkQuoteResult{}, errors.New("代理 CDK 采购金额过低")
	}
	if payAmount >= walletPayAmount {
		return AffiliateCdkQuoteResult{}, errors.New("代理 CDK 采购价必须低于钱包价格")
	}

	return AffiliateCdkQuoteResult{
		Amount:                 amount,
		Quantity:               quantity,
		TotalAmount:            totalAmount,
		CodeQuota:              codeQuota,
		TotalQuota:             int(totalQuota64),
		UnitWalletPayAmount:    unitWalletPayAmount,
		UnitPayAmount:          unitPayAmount,
		WalletPayAmount:        walletPayAmount,
		PayAmount:              payAmount,
		CdkPurchaseDiscountBps: distribution.CdkPurchaseDiscountBps,
		DiscountConfigured:     true,
	}, nil
}

func QuoteAffiliateCdkOrder(userId int, amount int64, quantity int) (AffiliateCdkQuoteResult, error) {
	return calculateAffiliateCdkQuote(userId, amount, quantity)
}

func BuildAffiliateCdkOrder(userId int, amount int64, quantity int, tradeNo string, paymentMethod string) (*AffiliateCdkOrder, AffiliateCdkQuoteResult, error) {
	quote, err := calculateAffiliateCdkQuote(userId, amount, quantity)
	if err != nil {
		return nil, quote, err
	}
	paymentMethod = strings.TrimSpace(paymentMethod)
	if paymentMethod == "" {
		return nil, quote, errors.New("支付方式不能为空")
	}
	if strings.TrimSpace(tradeNo) == "" {
		return nil, quote, errors.New("订单号不能为空")
	}

	order := &AffiliateCdkOrder{
		UserId:                 userId,
		TradeNo:                strings.TrimSpace(tradeNo),
		CodeAmount:             quote.Amount,
		Quantity:               quote.Quantity,
		TotalAmount:            quote.TotalAmount,
		CodeQuota:              quote.CodeQuota,
		TotalQuota:             quote.TotalQuota,
		WalletPayAmount:        quote.WalletPayAmount,
		PayAmount:              quote.PayAmount,
		CdkPurchaseDiscountBps: quote.CdkPurchaseDiscountBps,
		PaymentMethod:          paymentMethod,
		PaymentProvider:        PaymentProviderEpay,
		Status:                 common.TopUpStatusPending,
		CreateTime:             common.GetTimestamp(),
	}
	return order, quote, nil
}

func (order *AffiliateCdkOrder) Insert() error {
	if order == nil {
		return errors.New("CDK 订单不能为空")
	}
	return DB.Create(order).Error
}

func buildAffiliateCdkOrderQuery(db *gorm.DB, query AffiliateCdkOrderQuery) *gorm.DB {
	if query.UserId > 0 {
		db = db.Where("user_id = ?", query.UserId)
	}
	if strings.TrimSpace(query.Status) != "" {
		db = db.Where("status = ?", strings.TrimSpace(query.Status))
	}
	return db
}

func ListAffiliateCdkOrders(query AffiliateCdkOrderQuery, pageInfo *common.PageInfo) (orders []*AffiliateCdkOrder, total int64, err error) {
	db := buildAffiliateCdkOrderQuery(DB.Model(&AffiliateCdkOrder{}), query)
	if err = db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	selectQuery := buildAffiliateCdkOrderQuery(DB.Model(&AffiliateCdkOrder{}), query).Order("id desc")
	if pageInfo != nil {
		selectQuery = selectQuery.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx())
	}
	err = selectQuery.Find(&orders).Error
	return orders, total, err
}

func ListAffiliateCdkOrderCodes(userId int, orderId int) ([]*Redemption, error) {
	if userId <= 0 || orderId <= 0 {
		return nil, errors.New("订单参数无效")
	}
	var order AffiliateCdkOrder
	if err := DB.Where("id = ? AND user_id = ?", orderId, userId).First(&order).Error; err != nil {
		return nil, ErrAffiliateCdkOrderNotFound
	}
	if order.Status != common.TopUpStatusSuccess {
		return nil, errors.New("CDK 订单尚未支付成功")
	}
	var codes []*Redemption
	if err := DB.Where("source_type = ? AND source_order_id = ? AND user_id = ?", AffiliateCdkSourceType, order.Id, userId).
		Order("id asc").
		Find(&codes).Error; err != nil {
		return nil, err
	}
	return codes, nil
}

func buildAffiliateCdkCodeQuery(db *gorm.DB, query AffiliateCdkCodeQuery) *gorm.DB {
	if query.UserId > 0 {
		db = db.Where("user_id = ?", query.UserId)
	}
	if query.Status > 0 {
		db = db.Where("status = ?", query.Status)
	}
	return db.Where("source_type = ?", AffiliateCdkSourceType)
}

func ListAffiliateCdkCodes(query AffiliateCdkCodeQuery, pageInfo *common.PageInfo) (codes []*AffiliateCdkCodeRecord, total int64, err error) {
	if query.UserId <= 0 {
		return nil, 0, errors.New("用户 ID 参数无效")
	}

	db := buildAffiliateCdkCodeQuery(DB.Model(&Redemption{}), query)
	if err = db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var redemptions []*Redemption
	selectQuery := buildAffiliateCdkCodeQuery(DB.Model(&Redemption{}), query).Order("id desc")
	if pageInfo != nil {
		selectQuery = selectQuery.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx())
	}
	if err = selectQuery.Find(&redemptions).Error; err != nil {
		return nil, 0, err
	}
	if len(redemptions) == 0 {
		return []*AffiliateCdkCodeRecord{}, total, nil
	}

	orderIdSet := make(map[int]struct{}, len(redemptions))
	orderIds := make([]int, 0, len(redemptions))
	for _, redemption := range redemptions {
		if redemption.SourceOrderId <= 0 {
			continue
		}
		if _, ok := orderIdSet[redemption.SourceOrderId]; ok {
			continue
		}
		orderIdSet[redemption.SourceOrderId] = struct{}{}
		orderIds = append(orderIds, redemption.SourceOrderId)
	}

	ordersById := make(map[int]AffiliateCdkOrder, len(orderIds))
	if len(orderIds) > 0 {
		var orders []AffiliateCdkOrder
		if err = DB.Where("id IN ? AND user_id = ? AND status = ?", orderIds, query.UserId, common.TopUpStatusSuccess).Find(&orders).Error; err != nil {
			return nil, 0, err
		}
		for _, order := range orders {
			ordersById[order.Id] = order
		}
	}

	usedUserIdSet := make(map[int]struct{}, len(redemptions))
	usedUserIds := make([]int, 0, len(redemptions))
	for _, redemption := range redemptions {
		if redemption.UsedUserId <= 0 {
			continue
		}
		if _, ok := usedUserIdSet[redemption.UsedUserId]; ok {
			continue
		}
		usedUserIdSet[redemption.UsedUserId] = struct{}{}
		usedUserIds = append(usedUserIds, redemption.UsedUserId)
	}

	usedUsernamesById := make(map[int]string, len(usedUserIds))
	if len(usedUserIds) > 0 {
		var users []User
		if err = DB.Select("id", "username", "display_name").Where("id IN ?", usedUserIds).Find(&users).Error; err != nil {
			return nil, 0, err
		}
		for _, user := range users {
			displayName := strings.TrimSpace(user.DisplayName)
			if displayName == "" {
				displayName = strings.TrimSpace(user.Username)
			}
			usedUsernamesById[user.Id] = displayName
		}
	}

	codes = make([]*AffiliateCdkCodeRecord, 0, len(redemptions))
	for _, redemption := range redemptions {
		order, ok := ordersById[redemption.SourceOrderId]
		if !ok {
			continue
		}
		unitPayAmount := order.PayAmount
		if order.Quantity > 0 {
			unitPayAmount = roundPaymentAmount(order.PayAmount / float64(order.Quantity))
		}
		codes = append(codes, &AffiliateCdkCodeRecord{
			Id:                redemption.Id,
			UserId:            redemption.UserId,
			Key:               redemption.Key,
			Status:            redemption.Status,
			Name:              redemption.Name,
			Quota:             redemption.Quota,
			SourceType:        redemption.SourceType,
			SourceOrderId:     redemption.SourceOrderId,
			CreatedTime:       redemption.CreatedTime,
			RedeemedTime:      redemption.RedeemedTime,
			UsedUserId:        redemption.UsedUserId,
			UsedUsername:      usedUsernamesById[redemption.UsedUserId],
			ExpiredTime:       redemption.ExpiredTime,
			CodeAmount:        order.CodeAmount,
			OrderQuantity:     order.Quantity,
			PayAmount:         order.PayAmount,
			UnitPayAmount:     unitPayAmount,
			PaymentMethod:     order.PaymentMethod,
			OrderCompleteTime: order.CompleteTime,
		})
	}
	return codes, total, nil
}

func CompleteAffiliateCdkOrder(tradeNo string, providerPayload string, expectedPaymentProvider string, actualPaymentMethod string) error {
	if strings.TrimSpace(tradeNo) == "" {
		return errors.New("tradeNo is empty")
	}
	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}
	var logUserId int
	var logQuantity int
	var logCodeQuota int
	var logPayAmount float64
	var logPaymentMethod string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var order AffiliateCdkOrder
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(&order).Error; err != nil {
			return ErrAffiliateCdkOrderNotFound
		}
		if expectedPaymentProvider != "" && order.PaymentProvider != expectedPaymentProvider {
			return ErrPaymentMethodMismatch
		}
		if order.Status == common.TopUpStatusSuccess {
			return nil
		}
		if order.Status != common.TopUpStatusPending {
			return ErrAffiliateCdkOrderStatusInvalid
		}
		if order.Quantity <= 0 || order.Quantity > AffiliateCdkOrderMaxQuantity || order.CodeQuota <= 0 {
			return errors.New("CDK 订单数据无效")
		}

		var existingCount int64
		if err := tx.Model(&Redemption{}).
			Where("source_type = ? AND source_order_id = ?", AffiliateCdkSourceType, order.Id).
			Count(&existingCount).Error; err != nil {
			return err
		}
		if existingCount > 0 {
			return errors.New("CDK 订单已存在生成的兑换码，请联系管理员处理")
		}

		now := common.GetTimestamp()
		codes := make([]Redemption, 0, order.Quantity)
		for i := 0; i < order.Quantity; i++ {
			codes = append(codes, Redemption{
				UserId:        order.UserId,
				Name:          fmt.Sprintf("affiliate-cdk-%d", order.Id),
				Key:           common.GetUUID(),
				Status:        common.RedemptionCodeStatusEnabled,
				Quota:         order.CodeQuota,
				SourceType:    AffiliateCdkSourceType,
				SourceOrderId: order.Id,
				CreatedTime:   now,
			})
		}
		if err := tx.Create(&codes).Error; err != nil {
			return err
		}

		order.Status = common.TopUpStatusSuccess
		order.CompleteTime = now
		if providerPayload != "" {
			order.ProviderPayload = providerPayload
		}
		if strings.TrimSpace(actualPaymentMethod) != "" && order.PaymentMethod != actualPaymentMethod {
			order.PaymentMethod = actualPaymentMethod
		}
		if err := tx.Save(&order).Error; err != nil {
			return err
		}

		logUserId = order.UserId
		logQuantity = order.Quantity
		logCodeQuota = order.CodeQuota
		logPayAmount = order.PayAmount
		logPaymentMethod = order.PaymentMethod
		return nil
	})
	if err != nil {
		return err
	}
	if logUserId > 0 {
		RecordLog(logUserId, LogTypeTopup, fmt.Sprintf("代理购买 CDK 成功，数量：%d，单码额度：%s，支付金额：%.2f，支付方式：%s", logQuantity, logger.FormatQuota(logCodeQuota), logPayAmount, logPaymentMethod))
	}
	return nil
}

func ExpireAffiliateCdkOrder(tradeNo string, expectedPaymentProvider string) error {
	if strings.TrimSpace(tradeNo) == "" {
		return errors.New("tradeNo is empty")
	}
	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var order AffiliateCdkOrder
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(&order).Error; err != nil {
			return ErrAffiliateCdkOrderNotFound
		}
		if expectedPaymentProvider != "" && order.PaymentProvider != expectedPaymentProvider {
			return ErrPaymentMethodMismatch
		}
		if order.Status != common.TopUpStatusPending {
			return nil
		}
		order.Status = common.TopUpStatusExpired
		order.CompleteTime = common.GetTimestamp()
		return tx.Save(&order).Error
	})
}
