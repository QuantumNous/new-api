package model

import (
	"errors"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Subscription-mode invite rewards ("invite reward v2"): when
// common.InviteRewardSubscriptionMode is enabled, the trigger moves from the
// invitee's first top-up to their first successful subscription payment. The
// inviter gets a fixed QuotaForInviter value as permanent subscription-discount
// credit immediately. The invitee's side is a flat InviteFirstSubDiscountUSD
// off their first payment, applied at checkout.
const (
	InviteSubRewardStatusPending = "pending"
	InviteSubRewardStatusGranted = "granted"
	InviteSubRewardStatusRevoked = "revoked"
	InviteSubRewardStatusBlocked = "blocked"

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
}

type inviteSubscriptionRewardLedgerSnapshot struct {
	QuotaForInviter int     `json:"quota_for_inviter"`
	QuotaPerUnit    float64 `json:"quota_per_unit"`
	USDMinor        int64   `json:"usd_minor"`
}

// TryGrantInviteSubscriptionRewardAfterOrderCompleted grants the inviter's
// subscription-discount credit after the invitee's paid order has already
// committed. Paid-order fulfillment should call this as an idempotent
// post-commit best-effort step; the invitee_id unique index keeps retries and
// reconciliation safe.
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
		result, err = grantInviteSubscriptionDiscountAfterPaidOrderTx(tx, order)
		return err
	})
	if err != nil {
		return err
	}
	runInviteSubRewardPostCreateHooks(result)
	return nil
}

func GrantInviteSubscriptionDiscountAfterPaidOrderTx(tx *gorm.DB, order *SubscriptionOrder) error {
	_, err := grantInviteSubscriptionDiscountAfterPaidOrderTx(tx, order)
	return err
}

func grantInviteSubscriptionDiscountAfterPaidOrderTx(tx *gorm.DB, order *SubscriptionOrder) (inviteSubRewardCreateResult, error) {
	if tx == nil {
		return inviteSubRewardCreateResult{}, errors.New("tx is nil")
	}
	if order == nil {
		return inviteSubRewardCreateResult{}, errors.New("subscription order is nil")
	}
	if !common.InviteRewardSubscriptionMode || order.Status != common.TopUpStatusSuccess {
		return inviteSubRewardCreateResult{}, nil
	}

	invitee, err := lockInviteSubscriptionRewardUserTx(tx, order.UserId)
	if err != nil {
		return inviteSubRewardCreateResult{}, err
	}
	if invitee == nil || invitee.InviterId <= 0 {
		return inviteSubRewardCreateResult{}, nil
	}
	inviter, err := lockInviteSubscriptionRewardUserTx(tx, invitee.InviterId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return inviteSubRewardCreateResult{}, nil
		}
		return inviteSubRewardCreateResult{}, err
	}
	if inviter == nil {
		return inviteSubRewardCreateResult{}, nil
	}

	now := common.GetTimestamp()
	rewardQuota := common.QuotaForInviter
	reward := InviteSubscriptionReward{
		InviteeId:   invitee.Id,
		InviterId:   inviter.Id,
		OrderId:     order.Id,
		TradeNo:     order.TradeNo,
		OrderMoney:  order.Money,
		RewardQuota: rewardQuota,
		Status:      InviteSubRewardStatusGranted,
		UnlockAt:    0,
		GrantedAt:   now,
	}
	insert := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&reward)
	if insert.Error != nil {
		return inviteSubRewardCreateResult{}, insert.Error
	}
	if insert.RowsAffected == 0 {
		return inviteSubRewardCreateResult{}, nil
	}

	result := inviteSubRewardCreateResult{
		handled:     true,
		inviteeId:   invitee.Id,
		inviterId:   inviter.Id,
		rewardQuota: rewardQuota,
	}
	if rewardQuota < 0 {
		return inviteSubRewardCreateResult{}, ErrSubscriptionDiscountInvalidAmount
	}
	if rewardQuota == 0 {
		if err := finalizeInviteSubscriptionRewardInviteeTx(tx, invitee.Id, now); err != nil {
			return inviteSubRewardCreateResult{}, err
		}
		return result, nil
	}

	capReached, err := claimInviteSubscriptionRewardCapSlotTx(tx, inviter.Id)
	if err != nil {
		return inviteSubRewardCreateResult{}, err
	}
	if capReached {
		if err := tx.Model(&InviteSubscriptionReward{}).
			Where("id = ? AND status = ?", reward.Id, InviteSubRewardStatusGranted).
			Updates(map[string]any{
				"status":       InviteSubRewardStatusBlocked,
				"reward_quota": 0,
				"unlock_at":    0,
				"granted_at":   0,
				"reason":       InviteSubRewardReasonLimitReached,
			}).Error; err != nil {
			return inviteSubRewardCreateResult{}, err
		}
		if err := finalizeInviteSubscriptionRewardInviteeTx(tx, invitee.Id, now); err != nil {
			return inviteSubRewardCreateResult{}, err
		}
		result.blocked = true
		result.rewardQuota = 0
		return result, nil
	}

	usdMinor, err := inviteSubscriptionRewardQuotaToUSDMinor(rewardQuota)
	if err != nil {
		return inviteSubRewardCreateResult{}, err
	}
	if rewardQuota > 0 && usdMinor == 0 {
		return inviteSubRewardCreateResult{}, ErrSubscriptionDiscountInvalidAmount
	}
	pricingSnapshot, err := inviteSubscriptionRewardPricingSnapshot(rewardQuota, usdMinor)
	if err != nil {
		return inviteSubRewardCreateResult{}, err
	}
	idempotencyKey := inviteSubscriptionRewardIdempotencyKey(invitee.Id)
	changed, err := GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
		UserID:          inviter.Id,
		USDMinor:        usdMinor,
		EntryType:       SubscriptionDiscountEntryTypeGrantInviter,
		SourceType:      "invite_subscription_reward",
		SourceKey:       idempotencyKey,
		IdempotencyKey:  idempotencyKey,
		PricingSnapshot: pricingSnapshot,
	})
	if err != nil {
		return inviteSubRewardCreateResult{}, err
	}
	if !changed {
		if err := validateExistingInviteSubscriptionRewardLedgerTx(tx, inviter.Id, rewardQuota, usdMinor, idempotencyKey); err != nil {
			return inviteSubRewardCreateResult{}, err
		}
		if err := finalizeInviteSubscriptionRewardInviteeTx(tx, invitee.Id, now); err != nil {
			return inviteSubRewardCreateResult{}, err
		}
		return result, nil
	}
	if err := finalizeInviteSubscriptionRewardInviteeTx(tx, invitee.Id, now); err != nil {
		return inviteSubRewardCreateResult{}, err
	}
	return result, nil
}

func validateExistingInviteSubscriptionRewardLedgerTx(tx *gorm.DB, inviterId int, rewardQuota int, usdMinor int64, idempotencyKey string) error {
	var entry SubscriptionDiscountEntry
	if err := tx.Where("idempotency_key = ?", idempotencyKey).First(&entry).Error; err != nil {
		return ErrSubscriptionDiscountInvalidAccountState
	}
	if entry.UserID != inviterId ||
		entry.EntryType != SubscriptionDiscountEntryTypeGrantInviter ||
		entry.ReservedDeltaUSDMinor != 0 ||
		entry.SourceType != "invite_subscription_reward" ||
		entry.SourceKey != idempotencyKey ||
		entry.IdempotencyKey != idempotencyKey {
		return ErrSubscriptionDiscountInvalidAccountState
	}
	var snapshot inviteSubscriptionRewardLedgerSnapshot
	if err := common.Unmarshal([]byte(entry.PricingSnapshot), &snapshot); err != nil {
		return ErrSubscriptionDiscountInvalidAccountState
	}
	if snapshot.QuotaForInviter != rewardQuota ||
		snapshot.USDMinor <= 0 ||
		entry.AvailableDeltaUSDMinor != snapshot.USDMinor {
		return ErrSubscriptionDiscountInvalidAccountState
	}
	return nil
}

func lockInviteSubscriptionRewardUserTx(tx *gorm.DB, userId int) (*User, error) {
	if userId <= 0 {
		return nil, nil
	}
	if common.UsingSQLite {
		if err := retrySQLiteBusy(func() error {
			return tx.Model(&User{}).
				Where("id = ?", userId).
				Update("id", gorm.Expr("id")).Error
		}); err != nil {
			return nil, err
		}
		var user User
		if err := tx.Select("id", "inviter_id", "invite_reward_status").
			Where("id = ?", userId).First(&user).Error; err != nil {
			return nil, err
		}
		return &user, nil
	}
	query := tx
	if common.UsingMySQL || common.UsingPostgreSQL {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var user User
	if err := query.Select("id", "inviter_id", "invite_reward_status").
		Where("id = ?", userId).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func claimInviteSubscriptionRewardCapSlotTx(tx *gorm.DB, inviterId int) (bool, error) {
	if common.QuotaForInviterMaxCount <= 0 {
		return false, tx.Model(&User{}).
			Where("id = ?", inviterId).
			Update("aff_count", gorm.Expr("aff_count + ?", 1)).Error
	}
	claim := tx.Model(&User{}).
		Where("id = ? AND aff_count < ?", inviterId, common.QuotaForInviterMaxCount).
		Update("aff_count", gorm.Expr("aff_count + ?", 1))
	if claim.Error != nil {
		return false, claim.Error
	}
	return claim.RowsAffected == 0, nil
}

func finalizeInviteSubscriptionRewardInviteeTx(tx *gorm.DB, inviteeId int, now int64) error {
	return tx.Model(&User{}).
		Where("id = ? AND invite_reward_status = ?", inviteeId, InviteRewardStatusPending).
		Updates(map[string]any{
			"invite_reward_status":       InviteRewardStatusGranted,
			"invite_reward_granted_at":   now,
			"invite_reward_block_reason": "",
		}).Error
}

func inviteSubscriptionRewardQuotaToUSDMinor(rewardQuota int) (int64, error) {
	if rewardQuota < 0 || math.IsNaN(common.QuotaPerUnit) || math.IsInf(common.QuotaPerUnit, 0) || common.QuotaPerUnit <= 0 {
		return 0, ErrSubscriptionDiscountInvalidAmount
	}
	minor := decimal.NewFromInt(int64(rewardQuota)).
		Div(decimal.NewFromFloat(common.QuotaPerUnit)).
		Mul(decimal.NewFromInt(100)).
		Round(0)
	return minor.IntPart(), nil
}

func inviteSubscriptionRewardIdempotencyKey(inviteeId int) string {
	return fmt.Sprintf("inviter:%d:first-paid-subscription", inviteeId)
}

func inviteSubscriptionRewardPricingSnapshot(rewardQuota int, usdMinor int64) (string, error) {
	payload := map[string]any{
		"quota_for_inviter": rewardQuota,
		"quota_per_unit":    common.QuotaPerUnit,
		"usd_minor":         usdMinor,
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(data), nil
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
	RecordLog(result.inviterId, LogTypeSystem,
		fmt.Sprintf("邀请好友订阅成功，奖励 %s 已进入套餐抵扣账户", logger.LogQuota(result.rewardQuota)))
}

// UnlockDueInviteSubscriptionRewards is retained only for compatibility with older callers.
// Subscription invitation value is settled synchronously into the package-discount
// ledger; pending historical rows are migrated manually by
// MigrateLegacyInvitationValueToSubscriptionDiscount.
func UnlockDueInviteSubscriptionRewards(limit int) (int, error) {
	return 0, nil
}

// RevokeInviteSubscriptionRewardByTradeNo is retained only for compatibility
// with older callers. The first subscription-credit version deliberately does
// not claw back inviter rewards or restore consumed invitee package credit when
// a purchase is refunded or disputed.
func RevokeInviteSubscriptionRewardByTradeNo(tradeNo string, reason string) (bool, error) {
	if tradeNo == "" {
		return false, errors.New("tradeNo is empty")
	}
	return false, nil
}

// claimInviteFirstSubDiscountTx atomically determines the invitee
// first-subscription discount inside the caller's transaction. It locks the
// invitee's user row (FOR UPDATE) so concurrent purchase attempts - including
// cross-node ones - serialize on the claim, then treats both successful
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
// Claim-lookup failures degrade to a full-price order - never block checkout.
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
// subscription orders whose invited payer has no reward row. The master-node
// scheduler runs this as a 15-minute all-history bounded scan; TryGrant... is
// idempotent (invitee_id unique), so re-scanning is safe.
func ReconcileMissedInviteSubscriptionRewards(sinceSeconds int64, limit int) (int, error) {
	if !common.InviteRewardSubscriptionMode {
		return 0, nil
	}
	if limit <= 0 {
		limit = 100
	}
	query := DB.Model(&SubscriptionOrder{}).
		Select("subscription_orders.trade_no").
		Joins("JOIN users ON users.id = subscription_orders.user_id AND users.inviter_id > 0").
		Joins("LEFT JOIN invite_subscription_rewards ON invite_subscription_rewards.invitee_id = subscription_orders.user_id").
		Where("subscription_orders.status = ? AND invite_subscription_rewards.id IS NULL",
			common.TopUpStatusSuccess)
	if sinceSeconds > 0 {
		query = query.Where("subscription_orders.complete_time >= ?", common.GetTimestamp()-sinceSeconds)
	}
	var tradeNos []string
	if err := query.
		Order("subscription_orders.complete_time asc, subscription_orders.id asc").
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
