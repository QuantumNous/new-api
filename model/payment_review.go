package model

import (
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// PaymentReview records manual disposition without changing payment evidence,
// wallet balances or subscription entitlement. Entries are append-only.
type PaymentReview struct {
	ID        int64  `json:"id"`
	TradeNo   string `json:"-" gorm:"type:varchar(64);index:idx_payment_review_order,priority:1"`
	Provider  string `json:"-" gorm:"type:varchar(24);index:idx_payment_review_order,priority:2"`
	ActorID   int    `json:"actor_id"`
	Note      string `json:"note" gorm:"type:text"`
	CreatedAt int64  `json:"created_at"`
}

func RecordPaymentReview(order *SiteOrder, actorID int, note string) error {
	note = strings.TrimSpace(note)
	if actorID <= 0 || utf8.RuneCountInString(note) < 5 || utf8.RuneCountInString(note) > 500 {
		return errors.New("invalid payment review")
	}
	var target any
	switch order.PaymentProvider {
	case PaymentProviderAlipay:
		target = &AlipayOrder{}
	case PaymentProviderWechatPay:
		target = &WechatPayOrder{}
	case PaymentProviderMixPay:
		target = &MixPayOrder{}
	case PaymentProviderWebMoney:
		target = &WebMoneyOrder{}
	case PaymentProviderAntom:
		target = &AntomOrder{}
	default:
		return ErrPaymentMethodMismatch
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var current struct{ ReviewRequired bool }
		if err := lockForUpdate(tx.Model(target)).Where("trade_no = ?", order.TradeNo).Take(&current).Error; err != nil {
			return err
		}
		if !current.ReviewRequired {
			return errors.New("payment does not require review")
		}
		return tx.Create(&PaymentReview{TradeNo: order.TradeNo, Provider: order.PaymentProvider, ActorID: actorID, Note: note, CreatedAt: common.GetTimestamp()}).Error
	})
}
