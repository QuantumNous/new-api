package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var ErrInviteCodeInvalid = errors.New("invitation code is invalid, used or expired")

// ConsumeInviteCodeWithTx 把一条启用中、未过期的兑换码标记为已使用。
// 不发放额度：邀请码只是注册门票。
func ConsumeInviteCodeWithTx(tx *gorm.DB, key string, userId int) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return ErrInviteCodeInvalid
	}
	if userId <= 0 {
		return errors.New("invalid user id")
	}

	keyCol := "`key`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		keyCol = `"key"`
	}

	now := common.GetTimestamp()
	result := tx.Model(&Redemption{}).
		Where(keyCol+" = ? AND status = ? AND (expired_time = 0 OR expired_time >= ?)",
			key, common.RedemptionCodeStatusEnabled, now).
		Updates(map[string]any{
			"status":        common.RedemptionCodeStatusUsed,
			"used_user_id":  userId,
			"redeemed_time": now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrInviteCodeInvalid
	}
	return nil
}
