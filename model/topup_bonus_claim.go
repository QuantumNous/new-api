package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TopUpBonusClaim 记录某用户在某充值档位（Tier=充值金额）已领取的第 Seq 次赠送。
// (UserId, Tier, Seq) 唯一索引是并发防刷的核心：同一时刻多笔支付成功想插入相同
// Seq 时，数据库只允许一笔成功，其余冲突即视为竞争失败、不发放。这避免了 count
// 读后写的 TOCTOU 漏洞（与 StripeBonusClaim 同款思路）。
type TopUpBonusClaim struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	UserId      int    `json:"user_id" gorm:"uniqueIndex:idx_topup_bonus_user_tier_seq"`
	Tier        int    `json:"tier" gorm:"uniqueIndex:idx_topup_bonus_user_tier_seq"`
	Seq         int    `json:"seq" gorm:"uniqueIndex:idx_topup_bonus_user_tier_seq"`
	TradeNo     string `json:"trade_no" gorm:"type:varchar(255);index"`
	BonusAmount int64  `json:"bonus_amount"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
}

// claimTopUpBonusInTx 尝试在事务 tx 内为 (userId, tier) 占用一次赠送名额。
// limit<=0 表示不限次。返回 true 表示本次应发放赠送、false 表示不发。
// 必须在调用方的入账事务内调用，与额度写入同事务保证一致性。
func claimTopUpBonusInTx(tx *gorm.DB, userId, tier int, bonusAmount int64, limit int, tradeNo string) (bool, error) {
	var used int64
	if err := tx.Model(&TopUpBonusClaim{}).
		Where("user_id = ? AND tier = ?", userId, tier).Count(&used).Error; err != nil {
		return false, err
	}
	if limit > 0 && used >= int64(limit) {
		return false, nil
	}
	claim := &TopUpBonusClaim{
		UserId:      userId,
		Tier:        tier,
		Seq:         int(used) + 1,
		TradeNo:     tradeNo,
		BonusAmount: bonusAmount,
		CreatedTime: common.GetTimestamp(),
	}
	// 唯一索引冲突（DoNothing）→ RowsAffected==0 → 本次竞争失败，不发放。
	res := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(claim)
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

// applyTopUpBonusInTx 在入账事务内决定是否发放该订单的赠送。
// limit 为该档位每用户可享次数（<=0 不限）。返回应追加到 quota 的赠送额度（已 × QuotaPerUnit）。
// 若未发放（超限或并发竞争失败），把 topUp.BonusAmount 归零并落库，使历史展示 = 实际发放。
func applyTopUpBonusInTx(tx *gorm.DB, topUp *TopUp, limit int) (int64, error) {
	if topUp.BonusAmount <= 0 {
		return 0, nil
	}
	granted, err := claimTopUpBonusInTx(tx, topUp.UserId, topUp.BonusTier, topUp.BonusAmount, limit, topUp.TradeNo)
	if err != nil {
		return 0, err
	}
	if !granted {
		topUp.BonusAmount = 0
		if err := tx.Model(&TopUp{}).Where("id = ?", topUp.Id).Update("bonus_amount", 0).Error; err != nil {
			return 0, err
		}
		return 0, nil
	}
	bonusQuota := decimal.NewFromInt(topUp.BonusAmount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	return bonusQuota, nil
}

// topUpBonusLimitFor 读取某档位的每用户可享次数（0 = 不限）。
func topUpBonusLimitFor(tier int) int {
	return operation_setting.GetPaymentSetting().AmountBonusLimit[tier]
}
