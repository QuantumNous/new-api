package model

import (
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// Checkin check-in record
type Checkin struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;uniqueIndex:idx_user_checkin_date"`
	CheckinDate  string `json:"checkin_date" gorm:"type:varchar(10);not null;uniqueIndex:idx_user_checkin_date"` // Format: YYYY-MM-DD
	QuotaAwarded int    `json:"quota_awarded" gorm:"not null"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
}

// CheckinRecord is used for the check-in record returned by the API (excluding sensitive fields)
type CheckinRecord struct {
	CheckinDate  string `json:"checkin_date"`
	QuotaAwarded int    `json:"quota_awarded"`
}

func (Checkin) TableName() string {
	return "checkins"
}

// GetUserCheckinRecords Gets the user's check-in records within the specified date range
func GetUserCheckinRecords(userId int, startDate, endDate string) ([]Checkin, error) {
	var records []Checkin
	err := DB.Where("user_id = ? AND checkin_date >= ? AND checkin_date <= ?",
		userId, startDate, endDate).
		Order("checkin_date DESC").
		Find(&records).Error
	return records, err
}

// HasCheckedInToday checks whether the user has checked in today
func HasCheckedInToday(userId int) (bool, error) {
	today := time.Now().Format("2006-01-02")
	var count int64
	err := DB.Model(&Checkin{}).
		Where("user_id = ? AND checkin_date = ?", userId, today).
		Count(&count).Error
	return count > 0, err
}

// UserCheckin performs user check-in
// MySQL and PostgreSQL use transactions to guarantee atomicity
// SQLite does not support nested transactions, use sequential operations + manual rollback
func UserCheckin(userId int) (*Checkin, error) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		return nil, common.NewMessage("Check-in feature is not enabled")
	}

	// Check if you have checked in today
	hasChecked, err := HasCheckedInToday(userId)
	if err != nil {
		return nil, err
	}
	if hasChecked {
		return nil, common.NewMessage("Already checked in today")
	}

	// Calculate random amount of rewards
	quotaAwarded := setting.MinQuota
	if setting.MaxQuota > setting.MinQuota {
		quotaAwarded = setting.MinQuota + rand.Intn(setting.MaxQuota-setting.MinQuota+1)
	}

	today := time.Now().Format("2006-01-02")
	checkin := &Checkin{
		UserId:       userId,
		CheckinDate:  today,
		QuotaAwarded: quotaAwarded,
		CreatedAt:    time.Now().Unix(),
	}

	// Choose different strategies based on database type
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		// SQLite does not support nested transactions, use sequential operations + manual rollback
		return userCheckinWithoutTransaction(checkin, userId, quotaAwarded)
	}

	// MySQL and PostgreSQL support transactions and use transactions to ensure atomicity
	return userCheckinWithTransaction(checkin, userId, quotaAwarded)
}

// userCheckinWithTransaction performs check-ins using transactions (available for MySQL and PostgreSQL)
func userCheckinWithTransaction(checkin *Checkin, userId int, quotaAwarded int) (*Checkin, error) {
	err := DB.Transaction(func(tx *gorm.DB) error {
		// Step 1: Create a check-in record
		// The database has unique constraints (user_id, checkin_date), which can prevent concurrent and repeated check-ins.
		if err := tx.Create(checkin).Error; err != nil {
			return common.NewMessage("Check-in failed, please try again later")
		}

		// Step 2: Increase user quota in transaction
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", quotaAwarded)).Error; err != nil {
			return common.NewMessage("Check-in failed: quota update error")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// After the transaction is successful, the cache is updated asynchronously
	go func() {
		_ = cacheIncrUserQuota(userId, int64(quotaAwarded))
	}()

	return checkin, nil
}

// userCheckinWithoutTransaction performs check-in without using transaction (applies to SQLite)
func userCheckinWithoutTransaction(checkin *Checkin, userId int, quotaAwarded int) (*Checkin, error) {
	// Step 1: Create a check-in record
	// The database has unique constraints (user_id, checkin_date), which can prevent concurrent and repeated check-ins.
	if err := DB.Create(checkin).Error; err != nil {
		return nil, common.NewMessage("Check-in failed, please try again later")
	}

	// Step 2: Increase user quota
	// Use db=true to force direct writing to the database without using batch updates
	if err := IncreaseUserQuota(userId, quotaAwarded, true); err != nil {
		// If the quota increase fails, the check-in record needs to be rolled back
		DB.Delete(checkin)
		return nil, common.NewMessage("Check-in failed: quota update error")
	}

	return checkin, nil
}

// GetUserCheckinStats Get user check-in statistics
func GetUserCheckinStats(userId int, month string) (map[string]any, error) {
	// Get all check-in records for a specified month
	startDate := month + "-01"
	endDate := month + "-31"

	records, err := GetUserCheckinRecords(userId, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// Convert to records that do not contain sensitive fields
	checkinRecords := make([]CheckinRecord, len(records))
	for i, r := range records {
		checkinRecords[i] = CheckinRecord{
			CheckinDate:  r.CheckinDate,
			QuotaAwarded: r.QuotaAwarded,
		}
	}

	// Check if you have checked in today
	hasCheckedToday, _ := HasCheckedInToday(userId)

	// Get the user's check-in statistics for all time
	var totalCheckins int64
	var totalQuota int64
	DB.Model(&Checkin{}).Where("user_id = ?", userId).Count(&totalCheckins)
	DB.Model(&Checkin{}).Where("user_id = ?", userId).Select("COALESCE(SUM(quota_awarded), 0)").Scan(&totalQuota)

	return map[string]any{
		"total_quota":      totalQuota,      // The cumulative amount earned over all time
		"total_checkins":   totalCheckins,   // Total number of check-ins at all times
		"checkin_count":    len(records),    // Number of check-ins this month
		"checked_in_today": hasCheckedToday, // Have you checked in today?
		"records":          checkinRecords,  // Check-in record details for this month (excluding id and user_id)
	}, nil
}
