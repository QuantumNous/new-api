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

const PaymentProviderAntom = "antom"

// Immutable revisions keep in-flight orders bound to their original credentials.
type AntomConfig struct {
	ID                 int    `json:"id"`
	PreviousID         int    `json:"-" gorm:"uniqueIndex"`
	Enabled            bool   `json:"enabled"`
	Sandbox            bool   `json:"sandbox"`
	ClientID           string `json:"client_id" gorm:"type:varchar(64)"`
	Region             string `json:"region" gorm:"type:varchar(8)"`
	PublicKey          string `json:"public_key" gorm:"type:text"`
	SettlementCurrency string `json:"settlement_currency" gorm:"type:varchar(3)"`
	Description        string `json:"description" gorm:"type:varchar(255)"`
	NotifyBaseURL      string `json:"notify_base_url" gorm:"type:varchar(512)"`
	ReturnURL          string `json:"return_url" gorm:"type:varchar(512)"`
	MinTopUp           int64  `json:"min_topup"`
	Secret             string `json:"-" gorm:"-"`
	Ciphertext         string `json:"-" gorm:"type:text"`
}

func (c *AntomConfig) BeforeCreate(_ *gorm.DB) error {
	c.Ciphertext = ""
	_, err := paymentsecret.Load()
	return err
}
func (c *AntomConfig) BeforeUpdate(_ *gorm.DB) error {
	return errors.New("payment configuration revisions are immutable")
}
func (c *AntomConfig) AfterCreate(tx *gorm.DB) error {
	ring, err := paymentsecret.Load()
	if err != nil {
		return err
	}
	c.Ciphertext, err = ring.Seal(c.Secret, fmt.Sprintf("antom/%d/secret", c.ID))
	if err != nil {
		return err
	}
	return tx.Session(&gorm.Session{NewDB: true, SkipHooks: true, Logger: logger.Discard}).Model(c).Where("id = ?", c.ID).Update("ciphertext", c.Ciphertext).Error
}
func (c *AntomConfig) AfterFind(_ *gorm.DB) error {
	ring, err := paymentsecret.Load()
	if err != nil {
		return err
	}
	c.Secret, err = ring.Open(c.Ciphertext, fmt.Sprintf("antom/%d/secret", c.ID))
	return err
}
func CurrentAntomConfig() (*AntomConfig, error) {
	var c AntomConfig
	err := DB.Order("id DESC").First(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &AntomConfig{Sandbox: true, Region: "SG", SettlementCurrency: "USD", MinTopUp: 1, Description: "Wallet top-up"}, nil
	}
	return &c, err
}

type AntomOrder struct {
	SessionCiphertext string `json:"-" gorm:"type:text"`
	SessionID         string `json:"-" gorm:"type:varchar(64)"`
	CheckedAt         int64  `json:"checked_at"`
	NextCheckAt       int64  `json:"-" gorm:"index"`
	LastError         string `json:"-" gorm:"type:varchar(64)"`

	ID              int64   `json:"-"`
	TradeNo         string  `json:"trade_no" gorm:"type:varchar(64);uniqueIndex"`
	UserID          int     `json:"-" gorm:"uniqueIndex:idx_antom_request,priority:1"`
	RequestKey      string  `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_antom_request,priority:2"`
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

func GetAntomOrder(trade string) (*AntomOrder, *AntomConfig, error) {
	var o AntomOrder
	var c AntomConfig
	if err := DB.Where("trade_no = ?", trade).First(&o).Error; err != nil {
		return nil, nil, err
	}
	err := DB.First(&c, o.ConfigID).Error
	return &o, &c, err
}
func CreateAntomOrder(o *AntomOrder, top *TopUp) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(o).Error; err != nil {
			return err
		}

		return tx.Create(top).Error
	})
}

// Called only after signature, environment, order identity and frozen amount validation.
func RecordAntomPayment(o *AntomOrder, transaction string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var current AntomOrder
		if err := lockForUpdate(tx).First(&current, o.ID).Error; err != nil {
			return err
		}
		if current.ProviderTradeNo != nil {
			if *current.ProviderTradeNo != transaction {
				return errors.New("conflicting Antom transaction")
			}
			return nil
		}
		if current.Status != "pending" || current.GatewayStatus == "CANCEL_REQUESTED" {
			return ErrTopUpStatusInvalid
		}
		return tx.Model(&current).Updates(map[string]any{"status": "paid", "gateway_status": "SUCCESS", "provider_trade_no": transaction, "last_error": "", "checked_at": common.GetTimestamp()}).Error
	})
}
func CompleteAntomOrder(trade string) error {
	if strings.HasPrefix(trade, "SUBANT") {
		return completeDirectSubscriptionPayment(trade, PaymentProviderAntom)
	}
	initial, _, err := GetAntomOrder(trade)
	if err != nil {
		return err
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := lockSubscriptionBuyer(tx, initial.UserID); err != nil {
			return err
		}
		var o AntomOrder
		if err := lockForUpdate(tx).First(&o, initial.ID).Error; err != nil {
			return err
		}
		if o.Status == "success" {
			return tx.Model(&o).Update("next_check_at", 0).Error
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
		if top.UserId != o.UserID || top.PaymentProvider != PaymentProviderAntom || top.Status != "pending" || top.CompleteTime != 0 {
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
		top.PaymentReceipt = PaymentReceipt{ReceiptCurrency: "USD", ReceiptAmount: o.Amount, ReceiptTradeNo: *o.ProviderTradeNo}
		if err := tx.Save(&top).Error; err != nil {
			return err
		}
		return tx.Model(&o).Updates(map[string]any{"status": "success", "next_check_at": 0, "cache_pending": true, "log_pending": true, "credit_sequence": seq}).Error
	})
	if err != nil {
		return err
	}
	o, _, err := GetAntomOrder(trade)
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
		entry := Log{UserId: o.UserID, CreatedAt: common.GetTimestamp(), Type: LogTypeTopup, RequestId: "antom:" + trade, Content: fmt.Sprintf("Antom order %s fulfilled (USD %s)", trade, o.Amount)}
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

// Close only an unpaid order; a concurrent verified payment always wins.
func CloseAntomOrder(id int64, gatewayStatus string) error {
	if gatewayStatus != "FAIL" && gatewayStatus != "CANCELLED" {
		return errors.New("invalid Antom terminal status")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var o AntomOrder
		if err := lockForUpdate(tx).First(&o, id).Error; err != nil {
			return err
		}
		if o.Status != "pending" {
			return nil
		}
		var target any = &TopUp{}
		if strings.HasPrefix(o.TradeNo, "SUBANT") {
			target = &SubscriptionOrder{}
		}
		if err := tx.Model(target).Where("trade_no = ? AND payment_provider = ? AND status = ?", o.TradeNo, PaymentProviderAntom, "pending").Update("status", "expired").Error; err != nil {
			return err
		}
		return tx.Model(&o).Updates(map[string]any{"status": "expired", "gateway_status": gatewayStatus, "checked_at": common.GetTimestamp(), "next_check_at": 0, "last_error": ""}).Error
	})
}

// Reserve cancellation under the same row lock as verified payment recording.
func RequestAntomCancellation(id int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var o AntomOrder
		if err := lockForUpdate(tx).First(&o, id).Error; err != nil {
			return err
		}
		if o.Status != "pending" || o.ProviderTradeNo != nil {
			return ErrTopUpStatusInvalid
		}
		return tx.Model(&o).Updates(map[string]any{"gateway_status": "CANCEL_REQUESTED", "next_check_at": common.GetTimestamp() + 120}).Error
	})
}
