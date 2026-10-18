package model

import (
	"errors"
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// Checkin 签到记录
type Checkin struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;uniqueIndex:idx_user_checkin_date"`
	CheckinDate  string `json:"checkin_date" gorm:"type:varchar(10);not null;uniqueIndex:idx_user_checkin_date"` // 格式: YYYY-MM-DD
	QuotaAwarded int    `json:"quota_awarded" gorm:"not null"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
}

// CheckinRecord 用于API返回的签到记录（不包含敏感字段）
type CheckinRecord struct {
	CheckinDate  string `json:"checkin_date"`
	QuotaAwarded int    `json:"quota_awarded"`
}

// GetUserCheckinRecords 获取用户在指定日期范围内的签到记录
func GetUserCheckinRecords(userId int, startDate, endDate string) ([]Checkin, error) {
	var records []Checkin
	err := DB.Where("user_id = ? AND checkin_date >= ? AND checkin_date <= ?",
		userId, startDate, endDate).
		Order("checkin_date DESC").
		Find(&records).Error
	return records, err
}

// HasCheckedInToday 检查用户今天是否已签到
func HasCheckedInToday(userId int) (bool, error) {
	today := time.Now().Format("2006-01-02")
	var count int64
	err := DB.Model(&Checkin{}).
		Where("user_id = ? AND checkin_date = ?", userId, today).
		Count(&count).Error
	return count > 0, err
}

// UserCheckin 执行用户签到，记录、钱包和入账证据在同一事务提交。
func UserCheckin(userId int) (*Checkin, error) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		return nil, common.NewMessage("Check-in feature is not enabled")
	}
	// 老配置和通用 Option 写入也可能包含负值。签到只能赠送额度，不能扣钱包。
	if setting.MinQuota < 0 || setting.MaxQuota < 0 || setting.MaxQuota < setting.MinQuota {
		return nil, errors.New("签到奖励配置无效：额度不能为负且最大额度不能小于最小额度")
	}
	// 在随机数计算之前限制范围，避免 MaxQuota-MinQuota+1 溢出。
	if setting.MaxQuota > common.MaxWalletQuota {
		return nil, errors.New("签到失败：钱包额度奖励超出上限")
	}

	// 检查今天是否已签到
	hasChecked, err := HasCheckedInToday(userId)
	if err != nil {
		return nil, err
	}
	if hasChecked {
		return nil, common.NewMessage("Already checked in today")
	}

	// 计算随机额度奖励
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

	fences, err := acquireUserQuotaMutationFences(userId)
	if err != nil {
		return nil, err
	}
	committed := false
	defer func() { finalizeUserQuotaMutationFences(fences, committed) }()
	result, err := userCheckinWithTransaction(checkin, userId, quotaAwarded, fences)
	if err != nil {
		return nil, err
	}
	committed = true
	if quotaAwarded > 0 {
		syncCreditUserQuotaCache(fences, userId, quotaAwarded, "checkin")
	}
	return result, nil
}

// userCheckinWithTransaction also works on SQLite: this is the outermost transaction.
func userCheckinWithTransaction(checkin *Checkin, userId int, quotaAwarded int, fences *userQuotaMutationFences) (*Checkin, error) {
	err := DB.Transaction(func(tx *gorm.DB) error {
		// 数据库有唯一约束 (user_id, checkin_date)，可以防止并发重复签到。
		if err := tx.Create(checkin).Error; err != nil {
			return common.NewMessage("Check-in failed, please try again later")
		}

		var user User
		if err := lockForUpdate(tx).Select("id", "quota").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if quotaAwarded > 0 {
			if quotaAwarded > common.MaxWalletQuota || user.Quota < 0 || user.Quota > common.MaxWalletQuota-quotaAwarded {
				return errors.New("签到失败：钱包额度超出上限或当前余额无效")
			}
			if err := recordWalletRefundCreditTx(tx, user, walletRefundNonrefundable, "checkin", int64(checkin.Id), int64(quotaAwarded), ""); err != nil {
				return err
			}
			result := tx.Model(&User{}).Where("id = ?", userId).
				Update("quota", gorm.Expr("quota + ?", quotaAwarded))
			if result.Error != nil || result.RowsAffected != 1 {
				return errors.New("签到失败：更新额度出错")
			}
		}
		return fences.verify()
	})
	if err != nil {
		return nil, err
	}
	return checkin, nil
}

// GetUserCheckinStats 获取用户签到统计信息
func GetUserCheckinStats(userId int, month string) (map[string]any, error) {
	// 获取指定月份的所有签到记录
	startDate := month + "-01"
	endDate := month + "-31"

	records, err := GetUserCheckinRecords(userId, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// 转换为不包含敏感字段的记录
	checkinRecords := make([]CheckinRecord, len(records))
	for i, r := range records {
		checkinRecords[i] = CheckinRecord{
			CheckinDate:  r.CheckinDate,
			QuotaAwarded: r.QuotaAwarded,
		}
	}

	// 检查今天是否已签到
	hasCheckedToday, _ := HasCheckedInToday(userId)

	// 获取用户所有时间的签到统计
	var totalCheckins int64
	var totalQuota int64
	DB.Model(&Checkin{}).Where("user_id = ?", userId).Count(&totalCheckins)
	DB.Model(&Checkin{}).Where("user_id = ?", userId).Select("COALESCE(SUM(quota_awarded), 0)").Scan(&totalQuota)

	return map[string]any{
		"total_quota":      totalQuota,      // 所有时间累计获得的额度
		"total_checkins":   totalCheckins,   // 所有时间累计签到次数
		"checkin_count":    len(records),    // 本月签到次数
		"checked_in_today": hasCheckedToday, // 今天是否已签到
		"records":          checkinRecords,  // 本月签到记录详情（不含id和user_id）
	}, nil
}
