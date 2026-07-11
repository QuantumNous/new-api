package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

// RefundWalletAndTokenQuota restores a wallet pre-consume and its matching
// token reservation in one database transaction. It deliberately bypasses the
// optional in-process batcher: financial refunds must be durable before the
// caller reports success.
func RefundWalletAndTokenQuota(
	userID int,
	walletQuota int,
	tokenID int,
	tokenKey string,
	tokenQuota int,
	isPlayground bool,
) error {
	if userID <= 0 || walletQuota < 0 || tokenQuota < 0 {
		return fmt.Errorf("invalid wallet/token refund arguments")
	}
	return AdjustWalletAndTokenQuota(userID, walletQuota, tokenID, tokenKey, tokenQuota, isPlayground)
}

// AdjustWalletAndTokenQuota changes wallet and token balances atomically.
// Positive deltas return quota; negative deltas reserve/consume quota.
func AdjustWalletAndTokenQuota(
	userID int,
	walletDelta int,
	tokenID int,
	tokenKey string,
	tokenDelta int,
	isPlayground bool,
) error {
	if userID <= 0 {
		return fmt.Errorf("invalid wallet/token adjustment arguments")
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if walletDelta != 0 {
			q := tx.Model(&User{}).Where("id = ?", userID)
			if walletDelta < 0 {
				q = q.Where("quota >= ?", -walletDelta)
			}
			res := q.
				Update("quota", gorm.Expr("quota + ?", walletDelta))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected != 1 {
				return fmt.Errorf("wallet refund user %d not found", userID)
			}
		}
		if tokenDelta != 0 && !isPlayground {
			q := tx.Model(&Token{}).Where("id = ?", tokenID)
			if tokenDelta < 0 {
				q = q.Where("unlimited_quota = ? OR remain_quota >= ?", true, -tokenDelta)
			}
			res := q.Updates(map[string]interface{}{
				"remain_quota":  gorm.Expr("remain_quota + ?", tokenDelta),
				"used_quota":    gorm.Expr("used_quota - ?", tokenDelta),
				"accessed_time": common.GetTimestamp(),
			})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected != 1 {
				return fmt.Errorf("token refund token %d not found", tokenID)
			}
		}
		return nil
	})
	if err != nil {
		return err
	}

	// Database state is authoritative. Cache updates happen only after commit.
	if common.RedisEnabled {
		if walletDelta != 0 {
			gopool.Go(func() {
				if err := cacheIncrUserQuota(userID, int64(walletDelta)); err != nil {
					common.SysLog("failed to update wallet adjustment cache: " + err.Error())
				}
			})
		}
		if tokenDelta != 0 && !isPlayground {
			gopool.Go(func() {
				if err := cacheIncrTokenQuota(tokenKey, int64(tokenDelta)); err != nil {
					common.SysLog("failed to update token adjustment cache: " + err.Error())
				}
			})
		}
	}
	return nil
}
