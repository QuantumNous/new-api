package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 签到额度当日有效：次日清算，回收当天签到发放中未被消耗的部分。
//
// 设计取舍：users.quota 是单一标量，无法区分「签到来的钱」和「充值来的钱」，
// 因此这里不改动余额结构，而是把已有的 checkins 表当作发放台账，
// 按天结算并在 checkins 上标记，避免重复回收。
//
// 与上游（Futureppo）的差异：回收基准使用 NetCredited（奖励 - 贷款自动还款）
// 而非 QuotaAwarded——被还款抵扣的部分从未进入用户余额，不应参与回收。
// 老数据 NetCredited=0，清算时回收量为 0，自然跳过历史积压。
// ---------------------------------------------------------------------------

// OldestUnsettledCheckinDate 返回早于 today 且仍有未清算记录的最早日期。
// 没有待清算数据时返回空串。
func OldestUnsettledCheckinDate(today string) (string, error) {
	var dates []string
	err := DB.Model(&Checkin{}).
		// 补签记录不参与当日过期回收：补签额度在发放时其"签到日"早已结束，
		// 无法按"当日有效"语义追溯清算；is_makeup 守卫同时保护修复前遗留的
		// 未清算补签行，避免被追溯扣款。
		Where("settled_at = 0 AND is_makeup = ? AND checkin_date < ?", false, today).
		Limit(1).
		Pluck("checkin_date", &dates).Error
	if err != nil {
		return "", err
	}
	if len(dates) == 0 {
		return "", nil
	}
	return dates[0], nil
}

// checkinDaySpent 统计这批用户在指定日期内的消费额度。
// 全额回收模式下无需统计，直接返回空表。
func checkinDaySpent(date string, mode string, rows []Checkin) (map[int]int64, error) {
	spent := make(map[int]int64, len(rows))
	if mode == operation_setting.CheckinExpireModeAll {
		return spent, nil
	}
	start, end, err := checkinDateRange(date)
	if err != nil {
		return nil, err
	}
	userIds := make([]int, 0, len(rows))
	for _, r := range rows {
		userIds = append(userIds, r.UserId)
	}
	var agg []struct {
		UserId int   `gorm:"column:user_id"`
		Total  int64 `gorm:"column:total"`
	}
	// 只统计消费日志。退款(LogTypeRefund)不在此抵扣：回收量最终仍受用户实际余额约束，
	// 少算只会让回收更保守，不会多扣用户的钱。
	if err := LOG_DB.Model(&Log{}).
		Select("user_id, COALESCE(SUM(quota), 0) AS total").
		Where("type = ? AND created_at >= ? AND created_at < ? AND user_id IN ?",
			LogTypeConsume, start, end, userIds).
		Group("user_id").
		Scan(&agg).Error; err != nil {
		return nil, err
	}
	for _, a := range agg {
		spent[a.UserId] = a.Total
	}
	return spent, nil
}

// reclaimUserQuotaInTx 在事务内从用户余额扣减至多 want 的额度，返回实际扣减量。
// 永远不会把余额扣成负数。与标记已清算是同一事务，避免扣了余额但标记失败导致重复回收。
func reclaimUserQuotaInTx(tx *gorm.DB, userId int, want int64) (int64, error) {
	if want <= 0 {
		return 0, nil
	}
	// 先尝试全额扣减（余额足够时一步完成）
	res := tx.Model(&User{}).Where("id = ? AND quota >= ?", userId, want).
		Update("quota", gorm.Expr("quota - ?", want))
	if res.Error != nil {
		return 0, res.Error
	}
	if res.RowsAffected > 0 {
		return want, nil
	}
	// 余额不足：重读当前余额，扣到 0 为止
	var current int64
	if err := tx.Model(&User{}).Where("id = ?", userId).
		Select("quota").Scan(&current).Error; err != nil {
		return 0, err
	}
	if current <= 0 {
		return 0, nil
	}
	res = tx.Model(&User{}).Where("id = ? AND quota >= ?", userId, current).
		Update("quota", gorm.Expr("quota - ?", current))
	if res.Error != nil {
		return 0, res.Error
	}
	if res.RowsAffected > 0 {
		return current, nil
	}
	return 0, nil
}

// SettleCheckinDate 清算指定日期的签到额度，单次最多处理 limit 条。
// 返回已清算记录数和实际回收的额度总量。
func SettleCheckinDate(date string, mode string, limit int) (int, int64, error) {
	if limit <= 0 {
		limit = 200
	}
	var rows []Checkin
	if err := DB.Where("checkin_date = ? AND settled_at = 0 AND is_makeup = ?", date, false).
		Order("id asc").Limit(limit).Find(&rows).Error; err != nil {
		return 0, 0, err
	}
	if len(rows) == 0 {
		return 0, 0, nil
	}

	spent, err := checkinDaySpent(date, mode, rows)
	if err != nil {
		return 0, 0, err
	}

	settled := 0
	var reclaimedTotal int64
	now := common.GetTimestamp()
	for _, row := range rows {
		// 回收基准是实际入账净额：被贷款还款抵扣的部分从未进入余额
		want := int64(row.NetCredited)
		if mode != operation_setting.CheckinExpireModeAll {
			want -= spent[row.UserId]
		}
		if want < 0 {
			want = 0
		}

		// 扣余额 + 标记已清算必须在同一事务：标记失败则回滚扣减，不会重复回收
		var reclaimed int64
		err := DB.Transaction(func(tx *gorm.DB) error {
			var err error
			reclaimed, err = reclaimUserQuotaInTx(tx, row.UserId, want)
			if err != nil {
				return err
			}
			return tx.Model(&Checkin{}).
				Where("id = ? AND settled_at = 0", row.Id).
				Updates(map[string]interface{}{
					"settled_at":    now,
					"expired_quota": reclaimed,
				}).Error
		})
		if err != nil {
			return settled, reclaimedTotal, err
		}
		settled++
		reclaimedTotal += reclaimed
		if reclaimed > 0 {
			_ = InvalidateUserCache(row.UserId)
			RecordLog(row.UserId, LogTypeSystem, fmt.Sprintf(
				"签到额度当日有效：%s 入账 %s，已消耗后回收 %s",
				date, logger.LogQuota(row.NetCredited), logger.LogQuota(int(reclaimed))))
		}
	}
	return settled, reclaimedTotal, nil
}
