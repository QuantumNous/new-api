package model

import (
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TemporaryChannelModelSpend accumulates the spend of a single model served over
// "temporary" channels (stopgap relay suppliers not yet on a direct supply chain).
// When one model's cumulative spend crosses the configured threshold it proves real
// demand, and an alert is fired to drive the supply-chain side to find cheaper
// direct resources. LastAlertAt gates the fire-once-per-window alert in the same row.
//
// Multi-node safe: the accumulate is an atomic `quota = quota + ?` upsert, and the
// alert claim is a single conditional UPDATE guarded by a row lock (see below), so
// concurrent router replicas neither lose spend nor double-fire the alert.
type TemporaryChannelModelSpend struct {
	ModelName   string `gorm:"primaryKey;type:varchar(255);autoIncrement:false" json:"model_name"`
	Quota       int64  `gorm:"not null;default:0" json:"quota"`
	Count       int64  `gorm:"not null;default:0" json:"count"`
	LastAlertAt int64  `gorm:"not null;default:0" json:"last_alert_at"`
	UpdatedTime int64  `gorm:"not null;default:0" json:"updated_time"`
}

// AddTemporaryChannelModelSpend atomically adds quota to a model's temporary-channel
// spend and returns the new cumulative total (quota units). A no-op (returns 0) when
// disabled or given empty/non-positive input.
func AddTemporaryChannelModelSpend(modelName string, quota int64, nowUnix int64) (int64, error) {
	modelName = strings.TrimSpace(modelName)
	if DB == nil || modelName == "" || quota <= 0 {
		return 0, nil
	}
	var total int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		var e error
		total, e = AddTemporaryChannelModelSpendTx(tx, modelName, quota, nowUnix)
		return e
	})
	if err != nil {
		return 0, err
	}
	return total, nil
}

func AddTemporaryChannelModelSpendTx(tx *gorm.DB, modelName string, quota int64, nowUnix int64) (int64, error) {
	modelName = strings.TrimSpace(modelName)
	if tx == nil || modelName == "" || quota <= 0 {
		return 0, nil
	}
	seed := &TemporaryChannelModelSpend{ModelName: modelName, UpdatedTime: nowUnix}
	if e := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(seed).Error; e != nil {
		return 0, e
	}
	if e := tx.Model(&TemporaryChannelModelSpend{}).
		Where("model_name = ?", modelName).
		Updates(map[string]interface{}{
			"quota":        gorm.Expr("quota + ?", quota),
			"count":        gorm.Expr("count + ?", 1),
			"updated_time": nowUnix,
		}).Error; e != nil {
		return 0, e
	}
	var record TemporaryChannelModelSpend
	if e := tx.Select("quota").Where("model_name = ?", modelName).First(&record).Error; e != nil {
		return 0, e
	}
	return record.Quota, nil
}

// TryClaimTemporaryChannelSpendAlert atomically claims the right to fire one alert for
// modelName, returning true to exactly one caller per cooldown window. The conditional
// UPDATE (`WHERE last_alert_at < cutoff`) takes a row lock on MySQL/PostgreSQL and is
// the single writer on SQLite, so concurrent replicas cannot both claim: the first
// commit moves last_alert_at past the cutoff and the rest match zero rows.
func TryClaimTemporaryChannelSpendAlert(modelName string, cooldownSeconds int64, nowUnix int64) (bool, error) {
	modelName = strings.TrimSpace(modelName)
	if DB == nil || modelName == "" {
		return false, nil
	}
	if cooldownSeconds < 0 {
		cooldownSeconds = 0
	}
	// row is guaranteed to exist here (AddTemporaryChannelModelSpend seeds it), but
	// seed defensively in case the alert path is ever reached first.
	seed := &TemporaryChannelModelSpend{ModelName: modelName, UpdatedTime: nowUnix}
	if e := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(seed).Error; e != nil {
		return false, e
	}
	// A never-alerted row (last_alert_at = 0) is always claimable on first crossing;
	// afterwards the cooldown window applies. Encoding both cases keeps the claim
	// correct regardless of the clock (a negative cutoff must not block the first fire).
	cutoff := nowUnix - cooldownSeconds
	res := DB.Model(&TemporaryChannelModelSpend{}).
		Where("model_name = ? AND (last_alert_at = 0 OR last_alert_at < ?)", modelName, cutoff).
		Update("last_alert_at", nowUnix)
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected == 1, nil
}
