package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/paymentsecret"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const PaymentProviderWebMoney = "webmoney"

const WebMoneyPaymentLifetimeSeconds int64 = 30 * 60
const WebMoneyReconciliationWindowSeconds int64 = 7 * 24 * 60 * 60

// Immutable revisions keep in-flight orders bound to their original credentials.
type WebMoneyConfig struct {
	ID            int    `json:"id"`
	PreviousID    int    `json:"-" gorm:"uniqueIndex"`
	Enabled       bool   `json:"enabled"`
	WMID          string `json:"wmid" gorm:"type:varchar(12)"`
	Purse         string `json:"purse" gorm:"type:varchar(13)"`
	Description   string `json:"description" gorm:"type:varchar(255)"`
	Rate          string `json:"rate" gorm:"type:varchar(32)"`
	NotifyBaseURL string `json:"notify_base_url" gorm:"type:varchar(512)"`
	ReturnURL     string `json:"return_url" gorm:"type:varchar(512)"`
	MinTopUp      int64  `json:"min_topup"`
	Secret        string `json:"-" gorm:"-"`
	Ciphertext    string `json:"-" gorm:"type:text"`
}

func (c *WebMoneyConfig) BeforeCreate(_ *gorm.DB) error {
	c.Ciphertext = ""
	_, err := paymentsecret.Load()
	return err
}
func (c *WebMoneyConfig) BeforeUpdate(_ *gorm.DB) error {
	return errors.New("payment configuration revisions are immutable")
}
func (c *WebMoneyConfig) AfterCreate(tx *gorm.DB) error {
	ring, err := paymentsecret.Load()
	if err != nil {
		return err
	}
	c.Ciphertext, err = ring.Seal(c.Secret, fmt.Sprintf("webmoney/%d/secret", c.ID))
	if err != nil {
		return err
	}
	return tx.Session(&gorm.Session{NewDB: true, SkipHooks: true, Logger: logger.Discard}).Model(c).Where("id = ?", c.ID).Update("ciphertext", c.Ciphertext).Error
}
func (c *WebMoneyConfig) AfterFind(_ *gorm.DB) error {
	ring, err := paymentsecret.Load()
	if err != nil {
		return err
	}
	c.Secret, err = ring.Open(c.Ciphertext, fmt.Sprintf("webmoney/%d/secret", c.ID))
	return err
}
func CurrentWebMoneyConfig() (*WebMoneyConfig, error) {
	var c WebMoneyConfig
	err := DB.Order("id DESC").First(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &WebMoneyConfig{Rate: "1", MinTopUp: 1, Description: "HCAI"}, nil
	}
	return &c, err
}

type WebMoneyOrder struct {
	ReviewRequired  bool    `json:"review_required"`
	CheckedAt       int64   `json:"checked_at"`
	NextCheckAt     int64   `json:"-" gorm:"index"`
	LastError       string  `json:"-" gorm:"type:varchar(64)"`
	ID              int64   `json:"-"`
	TradeNo         string  `json:"trade_no" gorm:"type:varchar(64);uniqueIndex"`
	UserID          int     `json:"-" gorm:"uniqueIndex:idx_webmoney_request,priority:1"`
	RequestKey      string  `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_webmoney_request,priority:2"`
	RequestedAmount int64   `json:"-"`
	ConfigID        int     `json:"-"`
	Amount          string  `json:"amount" gorm:"type:varchar(32)"`
	CreditedQuota   int     `json:"credited_quota"`
	GatewayStatus   string  `json:"gateway_status" gorm:"type:varchar(64)"`
	Status          string  `json:"status" gorm:"type:varchar(24);index"`
	ProviderTradeNo *string `json:"-" gorm:"type:varchar(32);uniqueIndex"`
	CreatedAt       int64   `json:"created_at"`
	ExpiresAt       int64   `json:"expires_at"`
	CachePending    bool    `json:"-"`
	LogPending      bool    `json:"-"`
	CreditSequence  int64   `json:"-"`
}

func GetWebMoneyOrder(trade string) (*WebMoneyOrder, *WebMoneyConfig, error) {
	var o WebMoneyOrder
	var c WebMoneyConfig
	if err := DB.Where("trade_no = ?", trade).First(&o).Error; err != nil {
		return nil, nil, err
	}
	err := DB.First(&c, o.ConfigID).Error
	return &o, &c, err
}
func CreateWebMoneyOrder(o *WebMoneyOrder, top *TopUp) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(o).Error; err != nil {
			return err
		}
		if o.ID <= 0 || o.ID >= 999999999999999 {
			return errors.New("WebMoney payment number exhausted")
		}
		return tx.Create(top).Error
	})
}

// Called only after signature, live mode, recipient and frozen amount validation.
func RecordWebMoneyPayment(o *WebMoneyOrder, transaction string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var current WebMoneyOrder
		if err := lockForUpdate(tx).First(&current, o.ID).Error; err != nil {
			return err
		}
		if current.ProviderTradeNo != nil {
			if *current.ProviderTradeNo != transaction {
				return errors.New("conflicting WebMoney transaction")
			}
			return nil
		}
		if current.Status != "pending" && current.Status != "expired" {
			return ErrTopUpStatusInvalid
		}
		updates := map[string]any{"status": "paid", "next_check_at": 0, "provider_trade_no": transaction}
		if !current.ReviewRequired {
			updates["gateway_status"] = "success"
		}
		return tx.Model(&current).Updates(updates).Error
	})
}
func CompleteWebMoneyOrder(trade string) error {
	if strings.HasPrefix(trade, "SUBWM") {
		return completeDirectSubscriptionPayment(trade, PaymentProviderWebMoney)
	}
	initial, _, err := GetWebMoneyOrder(trade)
	if err != nil {
		return err
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := lockSubscriptionBuyer(tx, initial.UserID); err != nil {
			return err
		}
		var o WebMoneyOrder
		if err := lockForUpdate(tx).First(&o, initial.ID).Error; err != nil {
			return err
		}
		if o.Status == "success" {
			return nil
		}
		if o.ReviewRequired {
			return ErrPaymentReviewRequired
		}
		if o.Status != "paid" || o.ProviderTradeNo == nil {
			return ErrTopUpStatusInvalid
		}
		var user User
		if err := tx.First(&user, o.UserID).Error; err != nil {
			return err
		}
		if user.Status != common.UserStatusEnabled {
			return errors.New("payment buyer unavailable")
		}
		var top TopUp
		if err := lockForUpdate(tx).Where("trade_no = ?", trade).First(&top).Error; err != nil {
			return err
		}
		if top.UserId != o.UserID || top.PaymentProvider != PaymentProviderWebMoney || (top.Status != "pending" && top.Status != "expired") || top.CompleteTime != 0 {
			return ErrPaymentMethodMismatch
		}
		if o.CreditedQuota <= 0 || user.AlipayCredit < 0 || user.AlipayCredit > common.MaxWalletQuota-int64(o.CreditedQuota) {
			return ErrInvalidTopUpQuota
		}
		seq := user.AlipayCredit + int64(o.CreditedQuota)
		if err := creditTopUpQuota(tx, o.UserID, o.CreditedQuota, map[string]any{"alipay_credit": seq}); err != nil {
			return err
		}
		top.Status = "success"
		top.CompleteTime = common.GetTimestamp()
		top.PaymentReceipt = PaymentReceipt{ReceiptCurrency: "WMT", ReceiptAmount: o.Amount, ReceiptTradeNo: *o.ProviderTradeNo}
		if err := tx.Save(&top).Error; err != nil {
			return err
		}
		return tx.Model(&o).Updates(map[string]any{"status": "success", "cache_pending": true, "log_pending": true, "credit_sequence": seq}).Error
	})
	if err != nil {
		return err
	}
	o, _, err := GetWebMoneyOrder(trade)
	if err != nil {
		return err
	}
	if o.CachePending {
		if err := syncDirectPaymentQuotaCache(o.UserID, o.CreditSequence); err != nil {
			return err
		}
		if err := DB.Model(o).Update("cache_pending", false).Error; err != nil {
			return err
		}
	}
	if o.LogPending {
		entry := Log{UserId: o.UserID, CreatedAt: common.GetTimestamp(), Type: LogTypeTopup, RequestId: "webmoney:" + trade, Content: fmt.Sprintf("WebMoney order %s fulfilled (WMT %s)", trade, o.Amount)}
		if LOG_DB == nil {
			return errors.New("audit database unavailable")
		}
		if err := createLog(&entry); err != nil {
			return err
		}
		return DB.Model(o).Update("log_pending", false).Error
	}
	return nil
}

// ExpireWebMoneyOrder stops local acceptance; it is not a provider cancellation.
// Retain the order and its scheduled checks so already-authorized payments can
// still be recorded. Subscription fulfillment revalidates eligibility on receipt.
func ExpireWebMoneyOrder(id int64) error {
	var initial WebMoneyOrder
	if err := DB.Select("id", "user_id").First(&initial, id).Error; err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := lockSubscriptionBuyer(tx, initial.UserID); err != nil {
			return err
		}
		var order WebMoneyOrder
		if err := lockForUpdate(tx).First(&order, id).Error; err != nil {
			return err
		}
		if order.Status != "pending" || order.ExpiresAt > common.GetTimestamp() {
			return nil
		}
		var business any = &TopUp{}
		if strings.HasPrefix(order.TradeNo, "SUBWM") {
			business = &SubscriptionOrder{}
		}
		if err := tx.Model(business).Where("trade_no = ? AND payment_provider = ? AND status = ?", order.TradeNo, PaymentProviderWebMoney, "pending").Update("status", "expired").Error; err != nil {
			return err
		}
		return tx.Model(&order).Update("status", "expired").Error
	})
}

// Old schedules get one local cleanup pass, never another remote inquiry.
// Paid receipts and fulfillment retries remain recoverable beyond the unpaid window.
func WebMoneyOrdersRequiringReconciliation(db *gorm.DB, now int64) *gorm.DB {
	reviewOrders := db.Session(&gorm.Session{NewDB: true}).Model(&SubscriptionOrder{}).Select("trade_no").Where("status IN ?", []string{SubscriptionOrderPaidReview, PaymentOrderReviewClosed})
	return db.Model(&WebMoneyOrder{}).
		Where("status IN ? OR (status = ? AND (expires_at > ? OR next_check_at > 0)) OR cache_pending = ? OR log_pending = ?", []string{"pending", "paid"}, "expired", now-WebMoneyReconciliationWindowSeconds, true, true).
		Where("trade_no NOT IN (?)", reviewOrders).
		Where("COALESCE(review_required, ?) = ? OR status = ?", false, false, "success")
}
