package commission

import (
	"errors"
	"fmt"
	"math"

	"gorm.io/gorm"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// PreviewQuota returns the wallet quota the user would receive if they
// redeemed commissionCents right now. Used both by the /quota-preview
// endpoint and internally by Redeem so the two never disagree on the math.
// Returns (quota, rate, quotaPerUnit, error).
func PreviewQuota(commissionCents int64) (int64, float64, int64, error) {
	if commissionCents <= 0 {
		return 0, 0, 0, errors.New("金额 must be positive")
	}
	rate := operation_setting.USDExchangeRate
	qpu := int64(common.QuotaPerUnit)
	if rate <= 0 || qpu <= 0 {
		return 0, rate, qpu, errors.New("汇率未设置，请联系管理员")
	}
	quota := int64(math.Floor(float64(commissionCents) / 100.0 / rate * float64(qpu)))
	return quota, rate, qpu, nil
}

// Redeem converts commissionCents from the user's commission balance into
// wallet quota. Snapshots the current rate and QuotaPerUnit so later operator
// adjustments do not rewrite historical accounting. The entire counter/quota
// movement runs in a single transaction under a per-row lock.
func Redeem(userID int, commissionCents int64) (int64, error) {
	quotaCredited, rate, qpu, err := PreviewQuota(commissionCents)
	if err != nil {
		return 0, err
	}
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		if err := model.RedeemFromBalance(tx, userID, commissionCents); err != nil {
			return err
		}
		res := tx.Model(&model.User{}).Where("id = ?", userID).
			Update("quota", gorm.Expr("quota + ?", quotaCredited))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("user not found")
		}
		redemption := &model.CommissionRedemption{
			UserId:          userID,
			CommissionCents: commissionCents,
			USDExchangeRate: rate,
			QuotaPerUnit:    qpu,
			QuotaCredited:   quotaCredited,
		}
		if err := model.InsertCommissionRedemption(tx, redemption); err != nil {
			return err
		}
		model.RecordLog(userID, model.LogTypeTopup,
			common.NewMessage("Commission {{commission}} transferred to account balance, credited {{quota}} quota at exchange rate {{rate}}", map[string]any{
				"commission": fmt.Sprintf("¥%.2f", float64(commissionCents)/100.0),
				"quota":      quotaCredited,
				"rate":       fmt.Sprintf("%.4f", rate),
			}))
		return nil
	})
	if err != nil {
		return 0, err
	}
	return quotaCredited, nil
}
