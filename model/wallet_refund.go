package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// WalletRefundStatusCompleted marks a wallet refund whose credit is committed.
const WalletRefundStatusCompleted = "completed"

// WalletRefundRecord is the persistent idempotency record for a wallet
// pre-consume refund. RequestId stores the refund attempt key and is unique. It
// is claimed inside the same transaction that credits the wallet, so a retried
// execution of one refund or two concurrent refund paths credit that
// reservation at most once. The key carries the relay request id plus a
// per-attempt nonce, because a retried task pre-consumes a new reservation under
// the same relay request id and each reservation must be refundable.
type WalletRefundRecord struct {
	Id        int    `json:"id"`
	RequestId string `json:"request_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId    int    `json:"user_id" gorm:"index"`
	Amount    int    `json:"amount" gorm:"not null;default:0"`
	Status    string `json:"status" gorm:"type:varchar(32);index"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint;index"`
}

func (r *WalletRefundRecord) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	r.CreatedAt = now
	r.UpdatedAt = now
	return nil
}

func (r *WalletRefundRecord) BeforeUpdate(tx *gorm.DB) error {
	r.UpdatedAt = common.GetTimestamp()
	return nil
}

// RefundWalletPreConsume credits a pre-consumed wallet amount exactly once for
// refundKey. The unique request_id and the quota increment commit together, so
// either both land or neither does; a replayed call finds the committed record
// and returns success without touching the balance again.
func RefundWalletPreConsume(refundKey string, userId int, amount int) error {
	if userId <= 0 {
		return errors.New("invalid userId")
	}
	if strings.TrimSpace(refundKey) == "" {
		return errors.New("refundKey is empty")
	}
	if amount <= 0 {
		return errors.New("amount must be > 0")
	}
	if err := common.ValidateWalletQuota(amount); err != nil {
		return err
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
		record := &WalletRefundRecord{
			RequestId: refundKey,
			UserId:    userId,
			Amount:    amount,
			Status:    WalletRefundStatusCompleted,
		}
		if err := tx.Create(record).Error; err != nil {
			return err
		}
		return increaseUserQuotaTx(tx, userId, amount)
	})
	if err != nil {
		// A committed record for this request id proves the credit already
		// landed, whether it came from an earlier retry or a concurrent call.
		var record WalletRefundRecord
		findErr := DB.Where("request_id = ?", refundKey).Limit(1).Find(&record).Error
		if findErr == nil && record.Id > 0 && record.Status == WalletRefundStatusCompleted {
			return nil
		}
		return err
	}
	syncCreditUserQuotaCache(userId, amount, common.LogText("wallet refund"))
	return nil
}
