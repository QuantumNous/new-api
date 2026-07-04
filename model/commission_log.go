package model

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// CommissionLog 返佣记录表
type CommissionLog struct {
	Id               int64          `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID           int            `json:"user_id" gorm:"index;not null"`           // 被邀请人（消费者）
	InviterID        int            `json:"inviter_id" gorm:"index;not null"`        // 邀请人（获得返佣）
	Level            int            `json:"level" gorm:"not null;default:1"`         // 返佣层级（1=直接邀请，2=二级，3=三级）

	// 来源键：保证幂等（消费日志 "log:{logId}" 或订单 "order:{orderId}"）
	SourceKey        string         `json:"source_key" gorm:"size:80;not null;uniqueIndex:uk_source_inviter,priority:1"`

	// 订单信息
	OrderId          string         `json:"order_id" gorm:"index;size:64"`           // 关联订单ID
	LogId            int64          `json:"log_id" gorm:"index"`                     // 关联消费日志ID
	ModelName        string         `json:"model_name" gorm:"size:128"`              // 使用的模型

	// 金额信息
	ConsumptionQuota int            `json:"consumption_quota" gorm:"not null"`       // 消费金额（quota单位）
	CommissionRate   float64        `json:"commission_rate" gorm:"not null"`         // 返佣比例（如0.1=10%）
	CommissionQuota  int            `json:"commission_quota" gorm:"not null"`        // 返佣金额（quota单位）

	// 状态
	Status           string         `json:"status" gorm:"size:20;index;not null;default:pending"` // pending/settled/cancelled/refunded
	SettledAt        *time.Time     `json:"settled_at"`                              // 结算时间

	// 时间
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联
	User             User           `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Inviter          User           `json:"inviter,omitempty" gorm:"foreignKey:InviterID"`
}

func (CommissionLog) TableName() string {
	return "commission_logs"
}

// CreateCommissionLog 创建返佣记录
func CreateCommissionLog(log *CommissionLog) error {
	return DB.Create(log).Error
}

// GetCommissionLogById 根据ID获取返佣记录
func GetCommissionLogById(id int64) (*CommissionLog, error) {
	var log CommissionLog
	err := DB.First(&log, id).Error
	return &log, err
}

// GetUserCommissionLogs 获取用户的返佣记录（作为邀请人）
func GetUserCommissionLogs(userId int, status string, page, pageSize int) ([]CommissionLog, int64, error) {
	var logs []CommissionLog
	var total int64

	query := DB.Model(&CommissionLog{}).Where("inviter_id = ?", userId)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// 统计总数
	query.Count(&total)

	// 分页查询
	offset := (page - 1) * pageSize
	err := query.Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&logs).Error

	return logs, total, err
}

// GetUserConsumptionLogs 获取用户的消费记录（作为被邀请人）
func GetUserConsumptionLogs(userId int, page, pageSize int) ([]CommissionLog, int64, error) {
	var logs []CommissionLog
	var total int64

	query := DB.Model(&CommissionLog{}).Where("user_id = ?", userId)

	// 统计总数
	query.Count(&total)

	// 分页查询
	offset := (page - 1) * pageSize
	err := query.Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&logs).Error

	return logs, total, err
}

// GetCommissionLogByLogId 根据消费日志ID获取返佣记录
func GetCommissionLogByLogId(logId int64) ([]CommissionLog, error) {
	var logs []CommissionLog
	err := DB.Where("log_id = ?", logId).Find(&logs).Error
	return logs, err
}

// GetCommissionLogByOrderId 根据订单ID获取返佣记录
func GetCommissionLogByOrderId(orderId string) ([]CommissionLog, error) {
	var logs []CommissionLog
	err := DB.Where("order_id = ?", orderId).Find(&logs).Error
	return logs, err
}

// UpdateCommissionLogStatus 更新返佣记录状态
func UpdateCommissionLogStatus(id int64, status string) error {
	return DB.Model(&CommissionLog{}).
		Where("id = ?", id).
		Update("status", status).Error
}

// SettleCommissionLog 结算返佣记录
func SettleCommissionLog(id int64) error {
	now := time.Now()
	return DB.Model(&CommissionLog{}).
		Where("id = ? AND status = ?", id, "pending").
		Updates(map[string]interface{}{
			"status":     "settled",
			"settled_at": now,
		}).Error
}

// GetUserCommissionSummary 获取用户返佣汇总
func GetUserCommissionSummary(userId int) (map[string]interface{}, error) {
	var result struct {
		TotalCommission  int64 `json:"total_commission"`
		SettledCommission int64 `json:"settled_commission"`
		PendingCommission int64 `json:"pending_commission"`
		RefundedCommission int64 `json:"refunded_commission"`
	}

	// 统计总返佣
	err := DB.Model(&CommissionLog{}).
		Where("inviter_id = ?", userId).
		Select("COALESCE(SUM(commission_quota), 0) as total_commission").
		Scan(&result).Error
	if err != nil {
		return nil, err
	}

	// 统计已结算
	err = DB.Model(&CommissionLog{}).
		Where("inviter_id = ? AND status = ?", userId, "settled").
		Select("COALESCE(SUM(commission_quota), 0) as settled_commission").
		Scan(&result).Error
	if err != nil {
		return nil, err
	}

	// 统计待结算
	err = DB.Model(&CommissionLog{}).
		Where("inviter_id = ? AND status = ?", userId, "pending").
		Select("COALESCE(SUM(commission_quota), 0) as pending_commission").
		Scan(&result).Error
	if err != nil {
		return nil, err
	}

	// 统计已退款
	err = DB.Model(&CommissionLog{}).
		Where("inviter_id = ? AND status = ?", userId, "refunded").
		Select("COALESCE(SUM(commission_quota), 0) as refunded_commission").
		Scan(&result).Error
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_commission":    result.TotalCommission,
		"settled_commission":  result.SettledCommission,
		"pending_commission":  result.PendingCommission,
		"refunded_commission": result.RefundedCommission,
	}, nil
}

// GetUserCommissionStats 获取用户返佣统计（按层级）
func GetUserCommissionStats(userId int, period string) (map[string]interface{}, error) {
	type LevelStats struct {
		Count           int64 `json:"count"`
		TotalCommission int64 `json:"total_commission"`
	}

	stats := make(map[string]interface{})

	// 计算时间范围
	var startTime time.Time
	now := time.Now()
	switch period {
	case "daily":
		startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	case "weekly":
		weekday := now.Weekday()
		startTime = now.AddDate(0, 0, -int(weekday))
		startTime = time.Date(startTime.Year(), startTime.Month(), startTime.Day(), 0, 0, 0, 0, startTime.Location())
	case "monthly":
		startTime = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	default:
		startTime = time.Time{} // 全部
	}

	// 统计各级返佣
	for level := 1; level <= 3; level++ {
		var levelStat LevelStats
		query := DB.Model(&CommissionLog{}).
			Where("inviter_id = ? AND level = ? AND status = ?", userId, level, "settled")

		if !startTime.IsZero() {
			query = query.Where("created_at >= ?", startTime)
		}

		err := query.Select("COUNT(*) as count, COALESCE(SUM(commission_quota), 0) as total_commission").
			Scan(&levelStat).Error
		if err != nil {
			return nil, err
		}

		stats[fmt.Sprintf("level%d", level)] = levelStat
	}

	return stats, nil
}
