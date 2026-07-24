package model

import (
	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// RedemptionClaim 兑换限领记录。用于实现"同码一人一次"与"同标签(批次)一人一次"。
// 唯一性由应用层在 Redeem 事务内校验（兼容三库，SQLite 无部分唯一索引）：
//   - idx_rc_key_user (redemption_key, user_id)  普通索引，支撑同码限领查询
//   - idx_rc_tag_user (tag, user_id)             普通索引，支撑同标签限领查询
// 记录保留至该批次(tag)兑换码被删除时级联清理。
type RedemptionClaim struct {
	Id            int    `json:"id" gorm:"primaryKey"`
	UserId        int    `json:"user_id" gorm:"index:idx_rc_key_user,priority:2;index:idx_rc_tag_user,priority:2;not null"`
	RedemptionId  int    `json:"redemption_id" gorm:"default:0"`
	RedemptionKey string `json:"redemption_key" gorm:"type:varchar(64);index:idx_rc_key_user,priority:1"`
	Tag           string `json:"tag" gorm:"type:varchar(64);index:idx_rc_tag_user,priority:1"`
	ClaimedTime   int64  `json:"claimed_time" gorm:"bigint"`
}

// HasClaimedByKey 判断用户是否已兑换过某个具体兑换码。
func HasClaimedByKey(tx *gorm.DB, userId int, key string) (bool, error) {
	if tx == nil {
		tx = DB
	}
	var count int64
	err := tx.Model(&RedemptionClaim{}).
		Where("user_id = ? AND redemption_key = ?", userId, key).
		Count(&count).Error
	return count > 0, err
}

// HasClaimedByTag 判断用户是否已兑换过某批次(tag)下任一兑换码。tag 为空视为无批次限制。
func HasClaimedByTag(tx *gorm.DB, userId int, tag string) (bool, error) {
	if tag == "" {
		return false, nil
	}
	if tx == nil {
		tx = DB
	}
	var count int64
	err := tx.Model(&RedemptionClaim{}).
		Where("user_id = ? AND tag = ?", userId, tag).
		Count(&count).Error
	return count > 0, err
}

// insertRedemptionClaim 在事务内写入一条限领记录。
func insertRedemptionClaim(tx *gorm.DB, userId, redemptionId int, key, tag string) error {
	if tx == nil {
		tx = DB
	}
	claim := &RedemptionClaim{
		UserId:        userId,
		RedemptionId:  redemptionId,
		RedemptionKey: key,
		Tag:           tag,
		ClaimedTime:   common.GetTimestamp(),
	}
	return tx.Create(claim).Error
}

// DeleteRedemptionClaimsByTag 删除某批次(tag)的全部限领记录（随兑换码批次删除级联调用）。
func DeleteRedemptionClaimsByTag(tx *gorm.DB, tag string) error {
	if tag == "" {
		return nil
	}
	if tx == nil {
		tx = DB
	}
	return tx.Where("tag = ?", tag).Delete(&RedemptionClaim{}).Error
}

// DeleteRedemptionClaimsByKey 删除某兑换码的全部限领记录（单码删除级联调用）。
func DeleteRedemptionClaimsByKey(tx *gorm.DB, key string) error {
	if key == "" {
		return nil
	}
	if tx == nil {
		tx = DB
	}
	return tx.Where("redemption_key = ?", key).Delete(&RedemptionClaim{}).Error
}
