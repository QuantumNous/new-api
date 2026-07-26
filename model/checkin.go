package model

import (
	"errors"
	"fmt"
	"math/rand"
	"strings"
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
	Ip           string `json:"ip" gorm:"type:varchar(64);default:''"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
}

// CheckinRecord 用于API返回的签到记录（不包含敏感字段）
type CheckinRecord struct {
	CheckinDate  string `json:"checkin_date"`
	QuotaAwarded int    `json:"quota_awarded"`
}

func (Checkin) TableName() string {
	return "checkins"
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

// UserCheckin 执行用户签到
// MySQL 和 PostgreSQL 使用事务保证原子性
// SQLite 不支持嵌套事务，使用顺序操作 + 手动回滚
func UserCheckin(userId int, clientIp string) (*Checkin, string, error) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		return nil, "", errors.New("签到功能未启用")
	}

	// 检查今天是否已签到
	hasChecked, err := HasCheckedInToday(userId)
	if err != nil {
		return nil, "", err
	}
	if hasChecked {
		return nil, "", errors.New("今日已签到")
	}

	// IP 段风控检查：当日其他用户同 IP 前三段则触发
	var quotaAwarded int
	var riskDetail string
	isRisk, riskUserIds := checkTodayIpSegmentRisk(userId, clientIp)
	if isRisk {
		quotaAwarded = 5000 // $0.01 固定额度
	} else {
		quotaAwarded = setting.MinQuota
		if setting.MaxQuota > setting.MinQuota {
			quotaAwarded = setting.MinQuota + rand.Intn(setting.MaxQuota-setting.MinQuota+1)
		}
	}

	today := time.Now().Format("2006-01-02")
	checkin := &Checkin{
		UserId:       userId,
		CheckinDate:  today,
		QuotaAwarded: quotaAwarded,
		Ip:           clientIp,
		CreatedAt:    time.Now().Unix(),
	}

	var result *Checkin
	// 根据数据库类型选择不同的策略
	if common.UsingSQLite {
		// SQLite 不支持嵌套事务，使用顺序操作 + 手动回滚
		result, err = userCheckinWithoutTransaction(checkin, userId, quotaAwarded)
	} else {
		// MySQL 和 PostgreSQL 支持事务，使用事务保证原子性
		result, err = userCheckinWithTransaction(checkin, userId, quotaAwarded)
	}
	if err != nil {
		return nil, "", err
	}

	// 签到成功后执行风控打标
	if isRisk {
		riskDetail = tagHighRiskUsers(riskUserIds, userId, clientIp)
	}
	return result, riskDetail, nil
}

// userCheckinWithTransaction 使用事务执行签到（适用于 MySQL 和 PostgreSQL）
func userCheckinWithTransaction(checkin *Checkin, userId int, quotaAwarded int) (*Checkin, error) {
	// 签到额度有效期（进免费钱包）
	validDays := operation_setting.GetCheckinValidDays()
	expiredTime := common.GetTimestamp() + int64(validDays)*86400

	err := DB.Transaction(func(tx *gorm.DB) error {
		// 步骤1: 创建签到记录
		// 数据库有唯一约束 (user_id, checkin_date)，可以防止并发重复签到
		if err := tx.Create(checkin).Error; err != nil {
			return errors.New("签到失败，请稍后重试")
		}

		// 步骤2: 双钱包拆分——签到额度进免费钱包（带过期明细），不再进充值钱包。
		if err := AddFreeQuota(tx, userId, quotaAwarded, FreeQuotaSourceCheckin, checkin.Id, expiredTime); err != nil {
			return errors.New("签到失败：更新额度出错")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return checkin, nil
}

// userCheckinWithoutTransaction 不使用事务执行签到（适用于 SQLite）
func userCheckinWithoutTransaction(checkin *Checkin, userId int, quotaAwarded int) (*Checkin, error) {
	// 步骤1: 创建签到记录
	// 数据库有唯一约束 (user_id, checkin_date)，可以防止并发重复签到
	if err := DB.Create(checkin).Error; err != nil {
		return nil, errors.New("签到失败，请稍后重试")
	}

	// 步骤2: 双钱包拆分——签到额度进免费钱包（带过期明细）。
	validDays := operation_setting.GetCheckinValidDays()
	expiredTime := common.GetTimestamp() + int64(validDays)*86400
	if err := AddFreeQuota(nil, userId, quotaAwarded, FreeQuotaSourceCheckin, checkin.Id, expiredTime); err != nil {
		// 如果增加额度失败，需要回滚签到记录
		DB.Delete(checkin)
		return nil, errors.New("签到失败：更新额度出错")
	}

	return checkin, nil
}

// GetUserCheckinStats 获取用户签到统计信息
func GetUserCheckinStats(userId int, month string) (map[string]interface{}, error) {
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

	return map[string]interface{}{
		"total_quota":      totalQuota,      // 所有时间累计获得的额度
		"total_checkins":   totalCheckins,   // 所有时间累计签到次数
		"checkin_count":    len(records),    // 本月签到次数
		"checked_in_today": hasCheckedToday, // 今天是否已签到
		"records":          checkinRecords,  // 本月签到记录详情（不含id和user_id）
	}, nil
}

// extractIpPrefix 提取 IP 前三段
func extractIpPrefix(ip string) string {
	parts := strings.Split(ip, ".")
	if len(parts) >= 3 {
		return parts[0] + "." + parts[1] + "." + parts[2]
	}
	return ip
}

// getTodayCheckinIps 从签到表查今日签到记录，返回 userId → ip
func getTodayCheckinIps() (map[int]string, error) {
	today := time.Now().Format("2006-01-02")
	var records []Checkin
	err := DB.Where("checkin_date = ? AND ip != ''", today).
		Select("user_id, ip").
		Find(&records).Error
	if err != nil {
		return nil, err
	}
	result := make(map[int]string)
	for _, r := range records {
		result[r.UserId] = strings.TrimSpace(r.Ip)
	}
	return result, nil
}

// checkTodayIpSegmentRisk 检查当天是否有其他用户同 IP 前三段签到
func checkTodayIpSegmentRisk(currentUserId int, clientIp string) (isRisk bool, riskUserIds []int) {
	if clientIp == "" {
		return
	}

	ipPrefix := extractIpPrefix(clientIp)
	todayIps, err := getTodayCheckinIps()
	if err != nil {
		common.SysLog("checkTodayIpSegmentRisk: failed to get today checkin ips: " + err.Error())
		return
	}

	for userId, ip := range todayIps {
		if userId == currentUserId {
			continue
		}
		if extractIpPrefix(ip) == ipPrefix {
			riskUserIds = append(riskUserIds, userId)
		}
	}

	if len(riskUserIds) > 0 {
		isRisk = true
	}
	return
}

// tagHighRiskUsers 给同 IP 段用户打标签，返回风险详情字符串（用于写入日志）
func tagHighRiskUsers(riskUserIds []int, currentUserId int, clientIp string) string {
	allUserIds := append([]int{currentUserId}, riskUserIds...)

	var users []User
	if err := DB.Select("id, username").Where("id IN ?", allUserIds).Find(&users).Error; err != nil {
		common.SysLog("tagHighRiskUsers: failed to query users: " + err.Error())
		return ""
	}

	usernames := make([]string, len(users))
	for i, u := range users {
		usernames[i] = u.Username
	}

	ipPrefix := extractIpPrefix(clientIp)
	detail := fmt.Sprintf("[签到高风险] 关联: %s | IP段: %s", strings.Join(usernames, ","), ipPrefix)

	if err := DB.Model(&User{}).Where("id IN ?", allUserIds).Update("tag", "签到高风险").Error; err != nil {
		common.SysLog("tagHighRiskUsers: failed to update users: " + err.Error())
	}

	return detail
}
