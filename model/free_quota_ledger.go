package model

import (
	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// FreeQuotaNeverExpire 是"不过期免费额度"的过期时间哨兵值（约公元 2286 年）。
// 所有免费明细统一按 expired_time 存储/排序/索引：不过期项写此哨兵值，
// 因值极大自然排到扣减顺序最后，过期扫描 WHERE expired_time < now 永不误伤。
const FreeQuotaNeverExpire int64 = 9999999999

// 免费明细状态
const (
	FreeLedgerStatusActive    = 1 // 有剩余且未过期
	FreeLedgerStatusExhausted = 2 // 剩余为 0（扣光）
	FreeLedgerStatusExpired   = 3 // 过期回收
)

// 免费额度来源
const (
	FreeQuotaSourceCheckin    = "checkin"     // 签到奖励
	FreeQuotaSourceTopupGift  = "topup_gift"  // 充值赠送
	FreeQuotaSourceRedemption = "redemption"  // 免费兑换码
	FreeQuotaSourceAdmin      = "admin"       // 管理员发放
)

// FreeQuotaLedger 免费钱包明细。每一笔免费额度入账写一条 active 记录，
// 扣减更新 remaining（减到 0 转 exhausted），过期转 expired 并从 user.FreeQuota 扣掉 remaining。
type FreeQuotaLedger struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	UserId      int    `json:"user_id" gorm:"index:idx_fql_user_expire,priority:1;not null"`
	Source      string `json:"source" gorm:"type:varchar(32);index"` // checkin / topup_gift / redemption / admin
	SourceRefId int    `json:"source_ref_id" gorm:"default:0"`        // 关联 topup.id / redemption.id / checkin.id / admin userId
	Amount      int    `json:"amount" gorm:"not null"`                // 入账原始额度（不变）
	Remaining   int    `json:"remaining" gorm:"not null"`             // 剩余可用（扣减/过期时更新）
	ExpiredTime int64  `json:"expired_time" gorm:"index:idx_fql_user_expire,priority:2"` // 过期时间戳（秒）；不过期 = FreeQuotaNeverExpire
	Status      int    `json:"status" gorm:"type:int;default:1;index"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
}

// IsExpiring 是否为"会过期"的明细（用于三级扣减第一/第三级划分）。
func (l *FreeQuotaLedger) IsExpiring() bool {
	return l.ExpiredTime < FreeQuotaNeverExpire
}

// GetActiveFreeQuotaLedgers 返回用户当前有效（active 且未过期）的免费明细，
// 按三级扣减顺序排序：会过期项按 expired_time 升序在前，不过期项（哨兵值）按 created_time 升序在后。
// 因不过期项 expired_time = 哨兵值（极大），单一 ORDER BY expired_time, created_time 即天然满足两级顺序。
func GetActiveFreeQuotaLedgers(tx *gorm.DB, userId int, now int64) ([]FreeQuotaLedger, error) {
	if tx == nil {
		tx = DB
	}
	var ledgers []FreeQuotaLedger
	err := tx.Where("user_id = ? AND status = ? AND remaining > 0 AND expired_time > ?",
		userId, FreeLedgerStatusActive, now).
		Order("expired_time asc, created_time asc, id asc").
		Find(&ledgers).Error
	return ledgers, err
}

// GetExpiredActiveFreeQuotaLedgers 返回用户已过期但仍为 active 且有剩余的明细（待回收）。
func GetExpiredActiveFreeQuotaLedgers(tx *gorm.DB, userId int, now int64) ([]FreeQuotaLedger, error) {
	if tx == nil {
		tx = DB
	}
	var ledgers []FreeQuotaLedger
	err := tx.Where("user_id = ? AND status = ? AND remaining > 0 AND expired_time <= ?",
		userId, FreeLedgerStatusActive, now).
		Find(&ledgers).Error
	return ledgers, err
}

// SumActiveFreeQuota 汇总用户未过期免费明细的 remaining（INV-2 校验用，真值口径）。
func SumActiveFreeQuota(tx *gorm.DB, userId int, now int64) (int, error) {
	if tx == nil {
		tx = DB
	}
	var sum int64
	err := tx.Model(&FreeQuotaLedger{}).
		Where("user_id = ? AND status = ? AND remaining > 0 AND expired_time > ?",
			userId, FreeLedgerStatusActive, now).
		Select("COALESCE(SUM(remaining), 0)").Scan(&sum).Error
	return int(sum), err
}

// ListFreeQuotaLedgers 返回用户全部免费明细（前端明细列表用），按创建时间倒序。
func ListFreeQuotaLedgers(userId int) ([]FreeQuotaLedger, error) {
	var ledgers []FreeQuotaLedger
	err := DB.Where("user_id = ?", userId).Order("created_time desc, id desc").Find(&ledgers).Error
	return ledgers, err
}

// insertFreeQuotaLedger 在给定事务内插入一条 active 明细。
func insertFreeQuotaLedger(tx *gorm.DB, userId, amount int, source string, refId int, expiredTime int64) (*FreeQuotaLedger, error) {
	if tx == nil {
		tx = DB
	}
	if expiredTime <= 0 {
		expiredTime = FreeQuotaNeverExpire
	}
	ledger := &FreeQuotaLedger{
		UserId:      userId,
		Source:      source,
		SourceRefId: refId,
		Amount:      amount,
		Remaining:   amount,
		ExpiredTime: expiredTime,
		Status:      FreeLedgerStatusActive,
		CreatedTime: common.GetTimestamp(),
	}
	if err := tx.Create(ledger).Error; err != nil {
		return nil, err
	}
	return ledger, nil
}
