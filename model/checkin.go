package model

import (
	"errors"
	"math/rand/v2"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

var (
	ErrCheckinDisabled     = errors.New("checkin.disabled")
	ErrCheckinAlreadyToday = errors.New("checkin.already_today")
	ErrCheckinFailed       = errors.New("checkin.failed")
	ErrCheckinQuotaFailed  = errors.New("checkin.quota_failed")
	ErrCheckinInvalidMonth = errors.New("checkin.invalid_month")
)

// checkinNow is overridable in tests so date-sensitive flows stay deterministic.
var checkinNow = time.Now

// Checkin 签到记录
type Checkin struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;uniqueIndex:idx_user_checkin_date"`
	CheckinDate  string `json:"checkin_date" gorm:"type:varchar(10);not null;uniqueIndex:idx_user_checkin_date"` // YYYY-MM-DD
	QuotaAwarded int    `json:"quota_awarded" gorm:"not null"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
}

// CheckinRecord is the public check-in row returned by APIs.
type CheckinRecord struct {
	CheckinDate  string `json:"checkin_date"`
	QuotaAwarded int    `json:"quota_awarded"`
}

// CheckinMonthStats is the public monthly check-in summary.
type CheckinMonthStats struct {
	TotalQuota     int64           `json:"total_quota"`
	TotalCheckins  int64           `json:"total_checkins"`
	CheckinCount   int             `json:"checkin_count"`
	CheckedInToday bool            `json:"checked_in_today"`
	Records        []CheckinRecord `json:"records"`
}

func (Checkin) TableName() string {
	return "checkins"
}

func todayCheckinDate() string {
	return checkinNow().Format("2006-01-02")
}

func parseCheckinMonth(month string) (startDate, endDate string, err error) {
	month = strings.TrimSpace(month)
	if month == "" {
		month = checkinNow().Format("2006-01")
	}
	parsed, err := time.Parse("2006-01", month)
	if err != nil {
		return "", "", ErrCheckinInvalidMonth
	}
	start := time.Date(parsed.Year(), parsed.Month(), 1, 0, 0, 0, 0, parsed.Location())
	end := start.AddDate(0, 1, -1)
	return start.Format("2006-01-02"), end.Format("2006-01-02"), nil
}

func awardCheckinQuota(setting *operation_setting.CheckinSetting) int {
	minQuota, maxQuota := setting.QuotaRange()
	if maxQuota <= minQuota {
		return minQuota
	}
	return minQuota + rand.IntN(maxQuota-minQuota+1)
}

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "duplicate")
}

// GetUserCheckinRecords returns a user's check-in rows in [startDate, endDate].
func GetUserCheckinRecords(userId int, startDate, endDate string) ([]Checkin, error) {
	var records []Checkin
	err := DB.Where("user_id = ? AND checkin_date >= ? AND checkin_date <= ?",
		userId, startDate, endDate).
		Order("checkin_date DESC").
		Find(&records).Error
	return records, err
}

// HasCheckedInToday reports whether the user already checked in on the server's current date.
func HasCheckedInToday(userId int) (bool, error) {
	var count int64
	err := DB.Model(&Checkin{}).
		Where("user_id = ? AND checkin_date = ?", userId, todayCheckinDate()).
		Count(&count).Error
	return count > 0, err
}

// UserCheckin records today's check-in and credits quota atomically.
func UserCheckin(userId int) (*Checkin, error) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		return nil, ErrCheckinDisabled
	}

	hasChecked, err := HasCheckedInToday(userId)
	if err != nil {
		return nil, err
	}
	if hasChecked {
		return nil, ErrCheckinAlreadyToday
	}

	quotaAwarded := awardCheckinQuota(setting)
	checkin := &Checkin{
		UserId:       userId,
		CheckinDate:  todayCheckinDate(),
		QuotaAwarded: quotaAwarded,
		CreatedAt:    checkinNow().Unix(),
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(checkin).Error; err != nil {
			if isDuplicateKeyError(err) {
				return ErrCheckinAlreadyToday
			}
			return ErrCheckinFailed
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", quotaAwarded)).Error; err != nil {
			return ErrCheckinQuotaFailed
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	gopool.Go(func() {
		_ = cacheIncrUserQuota(userId, int64(quotaAwarded))
	})
	return checkin, nil
}

// GetUserCheckinStats returns lifetime totals plus the requested month's records.
func GetUserCheckinStats(userId int, month string) (*CheckinMonthStats, error) {
	startDate, endDate, err := parseCheckinMonth(month)
	if err != nil {
		return nil, err
	}

	records, err := GetUserCheckinRecords(userId, startDate, endDate)
	if err != nil {
		return nil, err
	}

	checkinRecords := make([]CheckinRecord, len(records))
	for i, r := range records {
		checkinRecords[i] = CheckinRecord{
			CheckinDate:  r.CheckinDate,
			QuotaAwarded: r.QuotaAwarded,
		}
	}

	hasCheckedToday, err := HasCheckedInToday(userId)
	if err != nil {
		return nil, err
	}

	var totalCheckins int64
	if err := DB.Model(&Checkin{}).Where("user_id = ?", userId).Count(&totalCheckins).Error; err != nil {
		return nil, err
	}

	var totalQuota int64
	if err := DB.Model(&Checkin{}).
		Where("user_id = ?", userId).
		Select("COALESCE(SUM(quota_awarded), 0)").
		Scan(&totalQuota).Error; err != nil {
		return nil, err
	}

	return &CheckinMonthStats{
		TotalQuota:     totalQuota,
		TotalCheckins:  totalCheckins,
		CheckinCount:   len(records),
		CheckedInToday: hasCheckedToday,
		Records:        checkinRecords,
	}, nil
}
