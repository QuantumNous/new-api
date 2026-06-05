package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// QuotaDebit records one external, idempotent debit of a user's quota — e.g.
// taluna converting a user's new-api quota into its own credits. external_id
// is the caller-supplied dedupe key; a retry with the same external_id never
// debits twice.
type QuotaDebit struct {
	Id         int    `json:"id"`
	UserId     int    `json:"user_id" gorm:"index"`
	Amount     int    `json:"amount"`
	ExternalId string `json:"external_id" gorm:"uniqueIndex;size:191"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint"`
}

// DebitResult is the outcome of a debit attempt.
type DebitResult struct {
	Code           string // "ok" | "insufficient"
	RemainingQuota int
}

// DebitUserQuotaIdempotent atomically debits `amount` from user `userId`'s
// quota, keyed by `externalId` for idempotency. Mirrors Redeem/Recharge safety:
// a single transaction with row locking, a sufficiency floor (never negative),
// and a unique dedupe row so a retry with the same externalId never debits
// twice. Insufficient quota is a result code (not an error) so callers map it
// to HTTP 402. Cross-DB safe (clause.Locking, not a raw FOR UPDATE string).
func DebitUserQuotaIdempotent(userId int, amount int, externalId string) (DebitResult, error) {
	if amount <= 0 {
		return DebitResult{}, errors.New("amount must be positive")
	}
	if externalId == "" {
		return DebitResult{}, errors.New("external_id required")
	}

	var res DebitResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		// 1) Idempotency: if this externalId already debited, replay its outcome.
		var prior QuotaDebit
		err := tx.Where("external_id = ?", externalId).First(&prior).Error
		if err == nil {
			var u User
			if err := tx.First(&u, prior.UserId).Error; err != nil {
				return err
			}
			res = DebitResult{Code: "ok", RemainingQuota: u.Quota}
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		// 2) Lock the user row (FOR UPDATE on PG/MySQL; serialized on SQLite).
		var u User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&u, userId).Error; err != nil {
			return err
		}

		// 3) Sufficiency floor — never go negative. No debit row on insufficient.
		if u.Quota < amount {
			res = DebitResult{Code: "insufficient", RemainingQuota: u.Quota}
			return nil
		}

		// 4) Atomic decrement.
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota - ?", amount)).Error; err != nil {
			return err
		}

		// 5) Record the debit (unique external_id). A concurrent duplicate hits
		// the unique index here and rolls the whole tx back; the retry then takes
		// the replay path above.
		if err := tx.Create(&QuotaDebit{
			UserId:     userId,
			Amount:     amount,
			ExternalId: externalId,
			CreatedAt:  common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}

		res = DebitResult{Code: "ok", RemainingQuota: u.Quota - amount}
		return nil
	})
	if err != nil {
		return DebitResult{}, err
	}

	// Best-effort cache sync (DB authoritative; matches new-api's pattern).
	if res.Code == "ok" {
		_ = cacheDecrUserQuota(userId, int64(amount))
	}
	return res, nil
}
