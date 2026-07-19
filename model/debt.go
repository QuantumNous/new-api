package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// GetUserDebt 返回用户当前欠额（debt）。debt > 0 表示上次结算实际消耗超过余额，
// 需在下次充值时优先抵扣，且在抵扣清零前阻止新的计费请求。
func GetUserDebt(id int) (debt int, err error) {
	err = DB.Model(&User{}).Where("id = ?", id).Select("debt").Find(&debt).Error
	return debt, err
}

// SettleWalletChargeWithDebt 在一个事务内原子地从钱包扣除 charge：
//   - 余额足够：quota -= charge，debt 不变
//   - 余额不足：quota 置 0，不足部分累加到 debt（余额永不为负）
//
// 返回本次实际转入 debt 的数量（shortfall），供调用方记录/审计。
// charge 必须 >= 0（FR-008：写入的额度值必须为正）。
func SettleWalletChargeWithDebt(id int, charge int) (shortfall int, err error) {
	if charge < 0 {
		return 0, errors.New("charge 不能为负数")
	}
	if charge == 0 {
		return 0, nil
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Where("id = ?", id).First(&user).Error; err != nil {
			return err
		}
		if user.Quota >= charge {
			return tx.Model(&User{}).Where("id = ?", id).
				Update("quota", gorm.Expr("quota - ?", charge)).Error
		}
		// 余额不足：余额清零，不足部分记入 debt
		shortfall = charge - user.Quota
		return tx.Model(&User{}).Where("id = ?", id).
			Updates(map[string]interface{}{
				"quota": 0,
				"debt":  gorm.Expr("debt + ?", shortfall),
			}).Error
	})
	if err != nil {
		shortfall = 0
		return shortfall, err
	}
	// 同步 Redis 缓存：仅扣减真正从 quota 里扣掉的部分（charge - shortfall）。
	if quotaDecreased := charge - shortfall; quotaDecreased > 0 {
		if cacheErr := cacheDecrUserQuota(id, int64(quotaDecreased)); cacheErr != nil {
			common.SysLog("failed to sync user quota cache after debt settle: " + cacheErr.Error())
		}
	}
	return shortfall, nil
}

// applyTopUpWithDebtTx 在给定事务内把入账 amount 优先抵扣 user.Debt，剩余部分进入 quota。
// 返回真正进入 quota 的净额（net）与抵扣掉的 debt（repaid）。
// 该函数不开启新事务、不同步缓存 —— 调用方负责在事务提交后按 net 同步 Redis 缓存
// （见 syncTopUpQuotaCache）。amount 必须为正。
func applyTopUpWithDebtTx(tx *gorm.DB, userId int, amount int) (net int, repaid int, err error) {
	if amount <= 0 {
		return 0, 0, errors.New("amount 必须为正数")
	}
	var user User
	if err := lockForUpdate(tx).Where("id = ?", userId).First(&user).Error; err != nil {
		return 0, 0, err
	}
	if user.Debt <= 0 {
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", amount)).Error; err != nil {
			return 0, 0, err
		}
		return amount, 0, nil
	}
	if amount >= user.Debt {
		repaid = user.Debt
		net = amount - user.Debt
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Updates(map[string]interface{}{
				"debt":  0,
				"quota": gorm.Expr("quota + ?", net),
			}).Error; err != nil {
			return 0, 0, err
		}
		return net, repaid, nil
	}
	// amount < debt：全部用于偿还 debt，quota 不变
	if err := tx.Model(&User{}).Where("id = ?", userId).
		Update("debt", gorm.Expr("debt - ?", amount)).Error; err != nil {
		return 0, 0, err
	}
	return 0, amount, nil
}

// syncTopUpQuotaCache 在入账事务提交后同步 Redis 缓存：仅增加真正进入 quota 的净额。
func syncTopUpQuotaCache(userId int, net int) {
	if net <= 0 {
		return
	}
	if cacheErr := cacheIncrUserQuota(userId, int64(net)); cacheErr != nil {
		common.SysLog("failed to sync user quota cache after topup: " + cacheErr.Error())
	}
}

// OffsetUserDebtOnTopUp 在充值时优先抵扣 debt：
//   - amount 先偿还 debt，剩余部分才进入 quota
//   - 返回实际进入 quota 的净额（net）与抵扣掉的 debt（repaid）
//
// 该函数原子执行并同步缓存，供充值/兑换/管理员加额等入账路径调用。
// 注意：此函数仅用于「入账」路径，不可用于失败退款（退款不应被 debt 吞掉）。
func OffsetUserDebtOnTopUp(id int, amount int) (net int, repaid int, err error) {
	err = DB.Transaction(func(tx *gorm.DB) error {
		net, repaid, err = applyTopUpWithDebtTx(tx, id, amount)
		return err
	})
	if err != nil {
		return 0, 0, err
	}
	syncTopUpQuotaCache(id, net)
	return net, repaid, nil
}
