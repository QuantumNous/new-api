package model

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const PaymentProviderAlipay = "alipay"
const PaymentMethodAlipayDirect = "alipay_direct"

// Immutable revisions retain credentials for pending orders after rotation.
// PrivateKey is deliberately excluded from every JSON response.
type AlipayConfig struct {
	PreviousID    int    `json:"-" gorm:"uniqueIndex"`
	ID            int    `json:"id"`
	Enabled       bool   `json:"enabled"`
	Sandbox       bool   `json:"sandbox"`
	AppID         string `json:"app_id" gorm:"type:varchar(32)"`
	SellerID      string `json:"seller_id" gorm:"type:varchar(32)"`
	PrivateKey    string `json:"-" gorm:"type:text"`
	PublicKey     string `json:"public_key" gorm:"type:text"`
	NotifyBaseURL string `json:"notify_base_url" gorm:"type:text"`
	ReturnURL     string `json:"return_url" gorm:"type:text"`
	UnitPrice     string `json:"unit_price" gorm:"type:varchar(32)"`
	MinTopUp      int64  `json:"min_topup"`
	PagePay       bool   `json:"page_pay"`
	WapPay        bool   `json:"wap_pay"`
	CreatedAt     int64  `json:"created_at"`
}

type AlipayOrder struct {
	DirectPaymentLifecycle
	ID            int    `json:"id"`
	TradeNo       string `json:"trade_no" gorm:"type:varchar(64);uniqueIndex"`
	ConfigID      int    `json:"-" gorm:"index"`
	UserID        int    `json:"-" gorm:"index"`
	AmountFen     int64  `json:"amount_fen"`
	CreditedQuota int    `json:"credited_quota"`
	// NULL permits multiple unpaid orders on every supported database.
	ProviderTradeNo *string `json:"provider_trade_no,omitempty" gorm:"type:varchar(64);uniqueIndex"`
	Status          string  `json:"status" gorm:"type:varchar(24);index"`
	CancelRequested bool    `json:"cancel_requested"`
	ExpiresAt       int64   `json:"expires_at"`
	NextCheckAt     int64   `json:"-" gorm:"index"`
	CachePending    bool    `json:"-"`
	CreditSequence  int64   `json:"-"`
	LastError       string  `json:"last_error,omitempty" gorm:"type:varchar(64)"`
}

func CurrentAlipayConfig() (*AlipayConfig, error) {
	var config AlipayConfig
	err := DB.Order("id DESC").First(&config).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &AlipayConfig{Sandbox: true, UnitPrice: "7", MinTopUp: 1, PagePay: true}, nil
	}
	return &config, err
}

func GetAlipayOrder(tradeNo string) (*AlipayOrder, *AlipayConfig, error) {
	var order AlipayOrder
	if err := DB.Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
		return nil, nil, err
	}
	var config AlipayConfig
	if err := DB.First(&config, order.ConfigID).Error; err != nil {
		return nil, nil, err
	}
	return &order, &config, nil
}

func CreateAlipayOrder(topUp *TopUp, order *AlipayOrder) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(topUp).Error; err != nil {
			return err
		}
		return tx.Create(order).Error
	})
}

// RecordAlipayPayment persists verified payment evidence before crediting the wallet.
// A full wallet or transient database error must never erase evidence of payment.
func RecordAlipayPayment(tradeNo, providerTradeNo string, amountFen int64) error {
	if providerTradeNo == "" || len(providerTradeNo) > 64 {
		return errors.New("invalid Alipay transaction")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var order AlipayOrder
		if err := lockForUpdate(tx).Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
			return err
		}
		if order.AmountFen != amountFen {
			return errors.New("Alipay amount mismatch")
		}
		if order.ProviderTradeNo != nil && *order.ProviderTradeNo != providerTradeNo {
			return errors.New("Alipay transaction mismatch")
		}
		if order.Status == common.TopUpStatusSuccess || order.Status == "paid" {
			return nil
		}
		if order.Status != common.TopUpStatusPending && order.Status != common.TopUpStatusExpired {
			return ErrTopUpStatusInvalid
		}
		result := tx.Model(&AlipayOrder{}).Where("id = ? AND status = ?", order.ID, order.Status).
			Updates(map[string]any{"status": "paid", "provider_trade_no": providerTradeNo, "next_check_at": 0})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrTopUpStatusInvalid
		}
		return nil
	})
}

// A cumulative credit watermark makes retries and out-of-order delivery safe.
// The separate watermark also corrects cache hydration from a pre-commit user snapshot.
func SyncAlipayQuotaCache(order *AlipayOrder) error {
	if err := syncDirectPaymentQuotaCache(order.UserID, order.CreditSequence); err != nil {
		return err
	}
	return DB.Model(&AlipayOrder{}).Where("id = ? AND status = ?", order.ID, common.TopUpStatusSuccess).Update("cache_pending", false).Error
}

func CompleteAlipayTopUp(tradeNo string) error {
	if isDirectSubscriptionOrder(tradeNo) {
		return completeDirectSubscriptionPayment(tradeNo, PaymentProviderAlipay)
	}
	var order AlipayOrder
	completed := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
			return err
		}
		if order.Status == common.TopUpStatusSuccess {
			return nil
		}
		if order.ReviewRequired {
			return ErrPaymentReviewRequired
		}
		if order.Status != "paid" || order.ProviderTradeNo == nil {
			return ErrTopUpStatusInvalid
		}
		var topUp TopUp
		if err := lockForUpdate(tx).Where("trade_no = ?", tradeNo).First(&topUp).Error; err != nil {
			return err
		}
		if topUp.PaymentProvider != PaymentProviderAlipay || topUp.UserId != order.UserID {
			return ErrPaymentMethodMismatch
		}
		if (topUp.Status != common.TopUpStatusPending && topUp.Status != common.TopUpStatusExpired) || topUp.CompleteTime != 0 || topUp.PaymentReceipt.ReceiptTradeNo != "" || topUp.PaymentReceipt.ReceiptAmount != "" || topUp.PaymentReceipt.ReceiptCurrency != "" {
			return ErrTopUpStatusInvalid
		}
		var user User
		if err := lockForUpdate(tx).First(&user, order.UserID).Error; err != nil {
			return err
		}
		if order.CreditedQuota <= 0 || user.AlipayCredit < 0 || user.AlipayCredit > common.MaxWalletQuota-int64(order.CreditedQuota) {
			return ErrInvalidTopUpQuota
		}
		order.CreditSequence = user.AlipayCredit + int64(order.CreditedQuota)
		result := tx.Model(&AlipayOrder{}).Where("id = ? AND status = ?", order.ID, "paid").
			Updates(map[string]any{"status": common.TopUpStatusSuccess, "cache_pending": true, "last_error": "", "credit_sequence": order.CreditSequence})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrTopUpStatusInvalid
		}
		if err := creditTopUpQuota(tx, order.UserID, order.CreditedQuota, map[string]any{"alipay_credit": order.CreditSequence}); err != nil {
			return err
		}
		if err := tx.Model(&topUp).Updates(map[string]any{"status": common.TopUpStatusSuccess, "complete_time": common.GetTimestamp()}).Error; err != nil {
			return err
		}
		completed = true
		return nil
	})
	if err != nil {
		_ = DB.Model(&AlipayOrder{}).Where("trade_no = ? AND status = ?", tradeNo, "paid").Updates(map[string]any{"last_error": "credit_pending", "next_check_at": time.Now().Add(time.Minute).Unix()}).Error
		return err
	}
	if completed {
		RecordTopupLog(order.UserID, fmt.Sprintf("Alipay payment %s credited %d quota (CNY %.2f)", tradeNo, order.CreditedQuota, float64(order.AmountFen)/100), "", PaymentMethodAlipayDirect, PaymentProviderAlipay)
	}
	return SyncAlipayQuotaCache(&order)
}

func CloseAlipayOrder(tradeNo string) error {
	return ConfirmDirectOrderClosed(tradeNo, PaymentProviderAlipay)
}

// PopulateAlipayTopUpQuotas exposes the immutable credit rather than the legacy
// integer USD amount, which cannot represent fractional currency conversions.
func PopulateAlipayTopUpQuotas(topups []*TopUp) error {
	tradeNos := make([]string, 0, len(topups))
	for _, topup := range topups {
		if topup.PaymentProvider == PaymentProviderAlipay {
			tradeNos = append(tradeNos, topup.TradeNo)
		}
	}
	if len(tradeNos) == 0 {
		return nil
	}
	var orders []AlipayOrder
	if err := DB.Select("trade_no", "credited_quota").Where("trade_no IN ?", tradeNos).Find(&orders).Error; err != nil {
		return err
	}
	quotas := make(map[string]int, len(orders))
	for _, order := range orders {
		quotas[order.TradeNo] = order.CreditedQuota
	}
	for _, topup := range topups {
		if topup.PaymentProvider == PaymentProviderAlipay {
			topup.CreditedQuota = quotas[topup.TradeNo]
		}
	}
	return nil
}

// Both direct payment providers share the existing cumulative AlipayCredit watermark.
// Keeping the persisted/cache names preserves compatibility with existing balances.
func syncDirectPaymentQuotaCache(userID int, creditSequence int64) error {
	if common.RedisEnabled {
		const script = `
local target = tonumber(ARGV[1])
local floor = tonumber(redis.call('GET', KEYS[2]) or '0')
if target > floor then redis.call('SET', KEYS[2], ARGV[1]) end
if redis.call('HEXISTS', KEYS[1], 'Quota') == 1 then
 local current = tonumber(redis.call('HGET', KEYS[1], 'AlipayCredit') or '0')
 if target > current then
  redis.call('HINCRBY', KEYS[1], 'Quota', string.format('%.0f', target-current))
  redis.call('HSET', KEYS[1], 'AlipayCredit', ARGV[1])
 end
end
return 1`
		if err := common.RDB.Eval(context.Background(), script, []string{getUserCacheKey(userID), fmt.Sprintf("alipay:credit:%d", userID)}, creditSequence).Err(); err != nil {
			return err
		}
	}
	return nil
}
