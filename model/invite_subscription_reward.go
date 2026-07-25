package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Subscription-mode invite rewards ("invite reward v2"): when
// common.InviteRewardSubscriptionMode is enabled, the trigger moves from the
// invitee's first top-up to their first successful subscription payment. The
// inviter gets a fixed QuotaForInviter reward, created locked and unlocking
// after a settle window (default 7 days) so refunds and card-testing
// chargebacks can claw it back first. The invitee's side is a flat
// InviteFirstSubDiscountUSD off their first payment, applied at checkout.
const (
	InviteSubRewardStatusPending = "pending"
	InviteSubRewardStatusGranted = "granted"
	InviteSubRewardStatusRevoked = "revoked"
	InviteSubRewardStatusBlocked = "blocked"

	InviteSubRewardReasonRefunded     = "refunded"
	InviteSubRewardReasonDisputed     = "disputed"
	InviteSubRewardReasonLimitReached = InviteRewardBlockReasonInviterLimitReached
)

type InviteSubscriptionReward struct {
	Id          int     `json:"id"`
	InviteeId   int     `json:"invitee_id" gorm:"uniqueIndex"`
	InviterId   int     `json:"inviter_id" gorm:"index"`
	OrderId     int     `json:"order_id" gorm:"index"`
	TradeNo     string  `json:"trade_no" gorm:"type:varchar(255);index"`
	OrderMoney  float64 `json:"order_money"`
	RewardQuota int     `json:"reward_quota" gorm:"default:0"`
	Status      string  `json:"status" gorm:"type:varchar(16);index"`
	UnlockAt    int64   `json:"unlock_at" gorm:"default:0;index"`
	GrantedAt   int64   `json:"granted_at" gorm:"default:0"`
	RevokedAt   int64   `json:"revoked_at" gorm:"default:0"`
	Reason      string  `json:"reason" gorm:"type:varchar(64);default:''"`
	CreatedAt   int64   `json:"created_at" gorm:"autoCreateTime;index"`
}

type inviteSubRewardCreateResult struct {
	handled     bool
	blocked     bool
	inviteeId   int
	inviterId   int
	rewardQuota int
	unlockAt    int64
}

// TryGrantInviteSubscriptionRewardAfterOrderCompleted creates the locked
// inviter reward for the invitee's first completed subscription order. It is a
// no-op when subscription reward mode is disabled, the payer has no inviter,
// or a reward for this invitee already exists (uniqueIndex on invitee_id makes
// webhook retries and duplicate orders idempotent). Errors are returned for
// logging only — callers must not fail the payment on reward errors.
func TryGrantInviteSubscriptionRewardAfterOrderCompleted(tradeNo string) error {
	if !common.InviteRewardSubscriptionMode {
		return nil
	}
	if tradeNo == "" {
		return errors.New("tradeNo is empty")
	}
	order := GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil {
		return fmt.Errorf("subscription order not found for invite reward: %s", tradeNo)
	}
	if order.Status != common.TopUpStatusSuccess {
		return nil
	}
	var result inviteSubRewardCreateResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		result, err = tryCreateInviteSubscriptionRewardInTx(tx, order)
		return err
	})
	if err != nil {
		return err
	}
	runInviteSubRewardPostCreateHooks(result)
	return nil
}

func tryCreateInviteSubscriptionRewardInTx(tx *gorm.DB, order *SubscriptionOrder) (inviteSubRewardCreateResult, error) {
	var invitee User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("id", "inviter_id", "invite_reward_status").
		Where("id = ?", order.UserId).
		First(&invitee).Error; err != nil {
		return inviteSubRewardCreateResult{}, err
	}
	if invitee.InviterId <= 0 {
		return inviteSubRewardCreateResult{}, nil
	}
	rewardQuota := common.QuotaForInviter
	if rewardQuota <= 0 {
		return inviteSubRewardCreateResult{}, nil
	}

	var inviter User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("id", "aff_count").
		Where("id = ?", invitee.InviterId).
		First(&inviter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return inviteSubRewardCreateResult{}, nil
		}
		return inviteSubRewardCreateResult{}, err
	}

	now := common.GetTimestamp()
	reward := InviteSubscriptionReward{
		InviteeId:   invitee.Id,
		InviterId:   inviter.Id,
		OrderId:     order.Id,
		TradeNo:     order.TradeNo,
		OrderMoney:  order.Money,
		RewardQuota: rewardQuota,
		Status:      InviteSubRewardStatusPending,
		UnlockAt:    now + common.InviteRewardUnlockDelaySeconds,
	}

	limitReached := common.QuotaForInviterMaxCount > 0 && inviter.AffCount >= common.QuotaForInviterMaxCount
	if limitReached {
		reward.Status = InviteSubRewardStatusBlocked
		reward.RewardQuota = 0
		reward.UnlockAt = 0
		reward.Reason = InviteSubRewardReasonLimitReached
	}

	insert := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&reward)
	if insert.Error != nil {
		return inviteSubRewardCreateResult{}, insert.Error
	}
	if insert.RowsAffected == 0 {
		return inviteSubRewardCreateResult{}, nil
	}

	if !limitReached {
		if err := tx.Model(&User{}).
			Where("id = ?", inviter.Id).
			Update("aff_count", gorm.Expr("aff_count + ?", 1)).Error; err != nil {
			return inviteSubRewardCreateResult{}, err
		}
	}

	// The invitee's conversion is complete regardless of whether the inviter
	// hit the reward cap; mark it so the invitation page stops showing pending.
	if err := tx.Model(&User{}).
		Where("id = ? AND invite_reward_status = ?", invitee.Id, InviteRewardStatusPending).
		Updates(map[string]any{
			"invite_reward_status":       InviteRewardStatusGranted,
			"invite_reward_granted_at":   now,
			"invite_reward_block_reason": "",
		}).Error; err != nil {
		return inviteSubRewardCreateResult{}, err
	}

	return inviteSubRewardCreateResult{
		handled:     true,
		blocked:     limitReached,
		inviteeId:   invitee.Id,
		inviterId:   inviter.Id,
		rewardQuota: reward.RewardQuota,
		unlockAt:    reward.UnlockAt,
	}, nil
}

func runInviteSubRewardPostCreateHooks(result inviteSubRewardCreateResult) {
	if !result.handled {
		return
	}
	if err := InvalidateUserCache(result.inviteeId); err != nil {
		common.SysLog(fmt.Sprintf("failed to invalidate invitee %d cache after invite sub reward: %v", result.inviteeId, err))
	}
	if result.blocked {
		RecordLog(result.inviterId, LogTypeSystem, "已达到邀请奖励上限，本次邀请不再获得奖励")
		return
	}
	unlockDays := common.InviteRewardUnlockDelaySeconds / 86400
	RecordLog(result.inviterId, LogTypeSystem,
		fmt.Sprintf("邀请好友订阅成功，奖励 %s 已入账，%d 天无退款后自动解锁", logger.LogQuota(result.rewardQuota), unlockDays))
}

// UnlockDueInviteSubscriptionRewards grants all pending rewards whose settle
// window has elapsed. Each reward is claimed with a conditional UPDATE inside
// its own transaction, so concurrent nodes running the unlocker cannot
// double-grant (Rule 11). Returns the number of rewards granted.
func UnlockDueInviteSubscriptionRewards(limit int) (int, error) {
	if limit <= 0 {
		limit = 100
	}
	now := common.GetTimestamp()
	var due []InviteSubscriptionReward
	if err := DB.Select("id", "inviter_id", "reward_quota").
		Where("status = ? AND unlock_at > 0 AND unlock_at <= ?", InviteSubRewardStatusPending, now).
		Order("unlock_at").
		Limit(limit).
		Find(&due).Error; err != nil {
		return 0, err
	}
	granted := 0
	for _, reward := range due {
		claimed := false
		err := DB.Transaction(func(tx *gorm.DB) error {
			claim := tx.Model(&InviteSubscriptionReward{}).
				Where("id = ? AND status = ?", reward.Id, InviteSubRewardStatusPending).
				Updates(map[string]any{
					"status":     InviteSubRewardStatusGranted,
					"granted_at": common.GetTimestamp(),
				})
			if claim.Error != nil {
				return claim.Error
			}
			if claim.RowsAffected == 0 {
				return nil
			}
			claimed = true
			return tx.Model(&User{}).
				Where("id = ?", reward.InviterId).
				Updates(map[string]any{
					"quota":       gorm.Expr("quota + ?", reward.RewardQuota),
					"aff_history": gorm.Expr("aff_history + ?", reward.RewardQuota),
				}).Error
		})
		if err != nil {
			return granted, err
		}
		if !claimed {
			continue
		}
		granted++
		if err := InvalidateUserCache(reward.InviterId); err != nil {
			common.SysLog(fmt.Sprintf("failed to invalidate inviter %d cache after invite sub reward unlock: %v", reward.InviterId, err))
		}
		RecordLog(reward.InviterId, LogTypeSystem,
			fmt.Sprintf("邀请奖励 %s 已解锁到账", logger.LogQuota(reward.RewardQuota)))
	}
	return granted, nil
}

// RevokeInviteSubscriptionRewardByTradeNo claws back the reward tied to a
// refunded or disputed subscription order. A pending reward is simply revoked;
// a granted reward also deducts the quota from the inviter (balance may go
// negative — acceptable, it blocks further API use). Idempotent via the
// conditional status update.
func RevokeInviteSubscriptionRewardByTradeNo(tradeNo string, reason string) (bool, error) {
	if tradeNo == "" {
		return false, errors.New("tradeNo is empty")
	}
	var reward InviteSubscriptionReward
	revoked := false
	deducted := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("trade_no = ? AND status IN ?", tradeNo,
				[]string{InviteSubRewardStatusPending, InviteSubRewardStatusGranted}).
			First(&reward).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		wasGranted := reward.Status == InviteSubRewardStatusGranted
		update := tx.Model(&InviteSubscriptionReward{}).
			Where("id = ? AND status = ?", reward.Id, reward.Status).
			Updates(map[string]any{
				"status":     InviteSubRewardStatusRevoked,
				"revoked_at": common.GetTimestamp(),
				"reason":     reason,
			})
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected == 0 {
			return nil
		}
		revoked = true
		if wasGranted && reward.RewardQuota > 0 {
			deducted = reward.RewardQuota
			return tx.Model(&User{}).
				Where("id = ?", reward.InviterId).
				Updates(map[string]any{
					"quota":       gorm.Expr("quota - ?", reward.RewardQuota),
					"aff_history": gorm.Expr("aff_history - ?", reward.RewardQuota),
				}).Error
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	if !revoked {
		return false, nil
	}
	if err := InvalidateUserCache(reward.InviterId); err != nil {
		common.SysLog(fmt.Sprintf("failed to invalidate inviter %d cache after invite sub reward revoke: %v", reward.InviterId, err))
	}
	if deducted > 0 {
		RecordLog(reward.InviterId, LogTypeSystem,
			fmt.Sprintf("被邀请好友的订阅已退款，邀请奖励 %s 已扣回", logger.LogQuota(deducted)))
	} else {
		RecordLog(reward.InviterId, LogTypeSystem, "被邀请好友的订阅已退款，待解锁的邀请奖励已取消")
	}
	return true, nil
}

// claimInviteFirstSubDiscountTx atomically determines the invitee
// first-subscription discount inside the caller's transaction. It locks the
// invitee's user row (FOR UPDATE) so concurrent purchase attempts — including
// cross-node ones — serialize on the claim, then treats both successful
// orders AND live discounted orders (pending/success with discount_usd > 0)
// as consuming the one-time slot. Failed/expired discounted orders release
// the slot automatically by dropping out of that status set.
//
// The returned discount is clamped so the charged amount never drops below
// minCharge (amount-based gateways such as epay cannot start a zero-amount
// payment; pass 0 for gateways that can).
func claimInviteFirstSubDiscountTx(tx *gorm.DB, userId int, planPrice float64, minCharge float64) (float64, error) {
	if userId <= 0 {
		return 0, errors.New("invalid userId")
	}
	if !common.InviteRewardSubscriptionMode || common.InviteFirstSubDiscountUSD <= 0 {
		return 0, nil
	}
	var invitee User
	query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("id", "inviter_id").Where("id = ?", userId).Limit(1).Find(&invitee)
	if query.Error != nil {
		return 0, query.Error
	}
	if query.RowsAffected == 0 || invitee.InviterId <= 0 {
		return 0, nil
	}
	var count int64
	if err := tx.Model(&SubscriptionOrder{}).
		Where("user_id = ? AND (status = ? OR (discount_usd > 0 AND status IN ?))",
			userId, common.TopUpStatusSuccess,
			[]string{common.TopUpStatusPending, common.TopUpStatusSuccess}).
		Count(&count).Error; err != nil {
		return 0, err
	}
	if count > 0 {
		return 0, nil
	}
	discount := common.InviteFirstSubDiscountUSD
	maxDiscount := planPrice - minCharge
	if discount > maxDiscount {
		discount = maxDiscount
	}
	if discount < 0 {
		discount = 0
	}
	return discount, nil
}

// CreateSubscriptionOrderWithInviteDiscount claims the invitee
// first-subscription discount and creates the order in one transaction, so
// concurrent checkout attempts cannot each acquire the discount. The order's
// Money/DiscountUSD are filled from the claim (Money = planPrice - discount).
// Claim-lookup failures degrade to a full-price order — never block checkout.
func CreateSubscriptionOrderWithInviteDiscount(order *SubscriptionOrder, planPrice float64, minCharge float64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		discount, err := claimInviteFirstSubDiscountTx(tx, order.UserId, planPrice, minCharge)
		if err != nil {
			common.SysLog("查询被邀首订折扣失败，按无折扣处理: " + err.Error())
			discount = 0
		}
		order.Money = planPrice - discount
		order.DiscountUSD = discount
		if order.CreateTime == 0 {
			order.CreateTime = common.GetTimestamp()
		}
		return tx.Create(order).Error
	})
}

// GetInviteSubscriptionRewardsByInviteeIds returns the v2 reward rows for the
// invitation page overlay, keyed by invitee id.
func GetInviteSubscriptionRewardsByInviteeIds(inviterId int, inviteeIds []int) (map[int]InviteSubscriptionReward, error) {
	rewards := make(map[int]InviteSubscriptionReward, len(inviteeIds))
	if len(inviteeIds) == 0 {
		return rewards, nil
	}
	var rows []InviteSubscriptionReward
	if err := DB.Where("inviter_id = ? AND invitee_id IN ?", inviterId, inviteeIds).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		rewards[row.InviteeId] = row
	}
	return rewards, nil
}

// SumLockedInviteSubscriptionRewardQuota sums an inviter's pending (locked)
// reward quota for the invitation page summary.
func SumLockedInviteSubscriptionRewardQuota(inviterId int) (int64, error) {
	var total int64
	err := DB.Model(&InviteSubscriptionReward{}).
		Where("inviter_id = ? AND status = ?", inviterId, InviteSubRewardStatusPending).
		Select("COALESCE(SUM(reward_quota), 0)").
		Scan(&total).Error
	return total, err
}

// ReconcileMissedInviteSubscriptionRewards backfills rewards for successful
// subscription orders whose invited payer has no reward row — the durable
// compensation for grant paths that run after their order transaction commits
// (balance purchases, or a crash between order commit and reward creation).
// TryGrant... is idempotent (invitee_id unique), so re-scanning is safe.
func ReconcileMissedInviteSubscriptionRewards(sinceSeconds int64, limit int) (int, error) {
	if !common.InviteRewardSubscriptionMode {
		return 0, nil
	}
	if limit <= 0 {
		limit = 100
	}
	since := common.GetTimestamp() - sinceSeconds
	var tradeNos []string
	if err := DB.Model(&SubscriptionOrder{}).
		Select("subscription_orders.trade_no").
		Joins("JOIN users ON users.id = subscription_orders.user_id AND users.inviter_id > 0").
		Joins("LEFT JOIN invite_subscription_rewards ON invite_subscription_rewards.invitee_id = subscription_orders.user_id").
		Where("subscription_orders.status = ? AND subscription_orders.complete_time >= ? AND invite_subscription_rewards.id IS NULL",
			common.TopUpStatusSuccess, since).
		Limit(limit).
		Pluck("subscription_orders.trade_no", &tradeNos).Error; err != nil {
		return 0, err
	}
	granted := 0
	for _, tradeNo := range tradeNos {
		if err := TryGrantInviteSubscriptionRewardAfterOrderCompleted(tradeNo); err != nil {
			common.SysError(fmt.Sprintf("invite subscription reward reconcile failed for order %s: %v", tradeNo, err))
			continue
		}
		granted++
	}
	return granted, nil
}

// StartInviteSubscriptionRewardUnlocker runs the settle-window unlocker on the
// master node. Claims are per-row conditional updates, so overlap with another
// node is safe; master-only gating just avoids redundant scans.
func StartInviteSubscriptionRewardUnlocker() {
	if !common.IsMasterNode {
		return
	}
	gopool.Go(func() {
		for {
			time.Sleep(10 * time.Minute)
			if !common.InviteRewardSubscriptionMode {
				continue
			}
			for {
				granted, err := UnlockDueInviteSubscriptionRewards(100)
				if err != nil {
					common.SysError(fmt.Sprintf("invite subscription reward unlock failed: %v", err))
					break
				}
				if granted < 100 {
					break
				}
			}
			// 漏发对账：余额购等「事务后发奖」路径若在提交与发奖之间崩溃，
			// 由这里按成功订单幂等补建（扫最近 7 天）。
			if _, err := ReconcileMissedInviteSubscriptionRewards(7*24*3600, 100); err != nil {
				common.SysError(fmt.Sprintf("invite subscription reward reconcile scan failed: %v", err))
			}
		}
	})
}
