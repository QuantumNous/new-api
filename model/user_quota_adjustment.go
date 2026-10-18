package model

import (
	"crypto/rand"
	"encoding/hex"
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var (
	ErrInvalidUserQuotaAdjustment = errors.New("invalid user quota adjustment")
	ErrUserQuotaPermission        = errors.New("cannot adjust quota for this user role")
)

// UserQuotaAdjustment is the immutable database snapshot of a committed manual
// adjustment. Pending relay deductions in the quota cache are not part of it.
type UserQuotaAdjustment struct {
	UserID   int
	Username string
	Before   int
	After    int
}

func AdjustUserQuota(userID, operatorID, operatorRole int, mode string, value int, cnyCents *int64) (*UserQuotaAdjustment, error) {
	if userID <= 0 || operatorID <= 0 || (mode != "add" && mode != "subtract" && mode != "override") || (cnyCents != nil && (mode != "add" || *cnyCents <= 0 || *cnyCents > common.MaxWalletQuota)) {
		return nil, ErrInvalidUserQuotaAdjustment
	}
	if mode != "override" && value <= 0 {
		return nil, ErrInvalidUserQuotaAdjustment
	}
	if value > common.MaxWalletQuota || value < -common.MaxWalletQuota {
		return nil, ErrWalletQuotaLimitExceeded
	}

	var adjustment UserQuotaAdjustment
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).First(&user, userID).Error; err != nil {
			return err
		}
		if operatorRole != common.RoleRootUser && operatorRole <= user.Role {
			return ErrUserQuotaPermission
		}
		if user.Quota > common.MaxWalletQuota || user.Quota < -common.MaxWalletQuota {
			return ErrWalletQuotaLimitExceeded
		}
		quota := decimal.NewFromInt(int64(value))
		switch mode {
		case "add":
			quota = decimal.NewFromInt(int64(user.Quota)).Add(quota)
		case "subtract":
			quota = decimal.NewFromInt(int64(user.Quota)).Sub(quota)
		}
		after, err := common.WalletQuotaFromDecimalStrict(quota)
		if err != nil {
			return ErrWalletQuotaLimitExceeded
		}
		// An unchanged override is a successful operation, including on MySQL
		// configurations that count only changed rows in RowsAffected.
		if after != user.Quota {
			result := tx.Model(&User{}).Where("id = ?", userID).Update("quota", after)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return gorm.ErrRecordNotFound
			}
		}
		// Generate the key after locking the user. The evidence and wallet
		// mutation commit or roll back together; no CNY face value is inferred.
		var key [32]byte
		if _, err := rand.Read(key[:]); err != nil {
			return err
		}
		if mode == "add" {
			creditedAt, err := getDBTimestampOnStrict(tx)
			if err != nil {
				return err
			}
			evidence := AdminQuotaCreditEvidence{
				EventKey: hex.EncodeToString(key[:]), UserID: int64(user.Id), OperatorID: int64(operatorID),
				CreditedQuota: int64(value), CNYCents: cnyCents, CreditedAt: creditedAt,
			}
			if err := tx.Create(&evidence).Error; err != nil {
				return err
			}
			if err := recordWalletRefundCreditTx(tx, user, walletRefundPurchase, "admin_add", evidence.ID, int64(value), ""); err != nil {
				return err
			}
		} else if err := recordWalletRefundCreditTx(tx, user, walletRefundException, "admin_adjustment", 0, 0, hex.EncodeToString(key[:])); err != nil {
			return err
		}
		adjustment = UserQuotaAdjustment{UserID: user.Id, Username: user.Username, Before: user.Quota, After: after}
		return nil
	})
	if err != nil {
		return nil, err
	}

	// Apply only the committed difference, preserving outstanding reservations.
	// Both balances are bounded above, so their difference fits in int64.
	delta := int64(adjustment.After) - int64(adjustment.Before)
	if delta != 0 {
		if err := cacheIncrUserQuota(userID, delta); err != nil {
			common.SysError(common.LogText("failed to sync manual quota adjustment for user %d: %s", userID, err))
		}
	}
	return &adjustment, nil
}
