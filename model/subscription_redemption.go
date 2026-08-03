package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const SubscriptionRedemptionPrefix = "MPS-"

// SubscriptionRedemption is a one-time bearer credential whose entitlement
// terms are frozen when the batch is created. A later edit to the plan must not
// change what an already-sold code grants.
type SubscriptionRedemption struct {
	Id        int `json:"id"`
	CreatedBy int `json:"created_by" gorm:"index"`

	KeyHash string `json:"-" gorm:"type:char(64);uniqueIndex;not null"`
	KeyHint string `json:"key_hint" gorm:"type:varchar(24);not null"`
	Status  int    `json:"status" gorm:"default:1;index"`

	BatchName string `json:"batch_name" gorm:"type:varchar(64);not null;index"`
	PlanId    int    `json:"plan_id" gorm:"index;not null"`
	PlanTitle string `json:"plan_title" gorm:"type:varchar(128);not null"`

	DurationUnit  string `json:"duration_unit" gorm:"type:varchar(16);not null"`
	DurationValue int    `json:"duration_value" gorm:"type:int;not null"`
	CustomSeconds int64  `json:"custom_seconds" gorm:"type:bigint;not null;default:0"`

	AmountTotal         int64  `json:"amount_total" gorm:"type:bigint;not null;default:0"`
	WeeklyAmount        int64  `json:"weekly_amount" gorm:"type:bigint;not null;default:0"`
	MaxPurchasePerUser  int    `json:"max_purchase_per_user" gorm:"type:int;default:0"`
	MaxActivePerUser    int    `json:"max_active_per_user" gorm:"type:int;default:0"`
	AllowWalletOverflow bool   `json:"allow_wallet_overflow"`
	UpgradeGroup        string `json:"upgrade_group" gorm:"type:varchar(64);default:''"`
	DowngradeGroup      string `json:"downgrade_group" gorm:"type:varchar(64);default:''"`

	QuotaResetPeriod        string `json:"quota_reset_period" gorm:"type:varchar(16);default:'never'"`
	QuotaResetCustomSeconds int64  `json:"quota_reset_custom_seconds" gorm:"type:bigint;default:0"`

	CreatedTime  int64 `json:"created_time" gorm:"bigint;index"`
	RedeemedTime int64 `json:"redeemed_time" gorm:"bigint"`
	UsedUserId   int   `json:"used_user_id" gorm:"index"`
	ExpiredTime  int64 `json:"expired_time" gorm:"bigint;index"`
}

type CreatedSubscriptionRedemptions struct {
	PlanId    int      `json:"plan_id"`
	PlanTitle string   `json:"plan_title"`
	BatchName string   `json:"batch_name"`
	Codes     []string `json:"codes"`
	ExpiresAt int64    `json:"expires_at"`
}

type SubscriptionRedemptionResult struct {
	PlanId       int               `json:"plan_id"`
	PlanTitle    string            `json:"plan_title"`
	Subscription *UserSubscription `json:"subscription"`
}

func normalizeSubscriptionRedemptionKey(key string) string {
	return strings.ToUpper(strings.TrimSpace(key))
}

func subscriptionRedemptionHash(key string) string {
	sum := sha256.Sum256([]byte(normalizeSubscriptionRedemptionKey(key)))
	return hex.EncodeToString(sum[:])
}

func IsSubscriptionRedemptionKey(key string) bool {
	return strings.HasPrefix(normalizeSubscriptionRedemptionKey(key), SubscriptionRedemptionPrefix)
}

func newSubscriptionRedemptionKey() (string, error) {
	raw := strings.ToUpper(strings.ReplaceAll(common.GetUUID(), "-", ""))
	if len(raw) < 24 {
		return "", errors.New("generated redemption entropy is too short")
	}
	return fmt.Sprintf("%s%s-%s-%s-%s", SubscriptionRedemptionPrefix, raw[0:6], raw[6:12], raw[12:18], raw[18:24]), nil
}

func subscriptionRedemptionHint(key string) string {
	normalized := normalizeSubscriptionRedemptionKey(key)
	if len(normalized) <= 10 {
		return normalized
	}
	return SubscriptionRedemptionPrefix + "...-" + normalized[len(normalized)-6:]
}

func snapshotSubscriptionRedemption(createdBy int, batchName string, plan *SubscriptionPlan, expiredTime int64) *SubscriptionRedemption {
	allowWalletOverflow := true
	if plan.AllowWalletOverflow != nil {
		allowWalletOverflow = *plan.AllowWalletOverflow
	}
	return &SubscriptionRedemption{
		CreatedBy:               createdBy,
		Status:                  common.RedemptionCodeStatusEnabled,
		BatchName:               strings.TrimSpace(batchName),
		PlanId:                  plan.Id,
		PlanTitle:               plan.Title,
		DurationUnit:            plan.DurationUnit,
		DurationValue:           plan.DurationValue,
		CustomSeconds:           plan.CustomSeconds,
		AmountTotal:             plan.TotalAmount,
		WeeklyAmount:            plan.WeeklyAmount,
		MaxPurchasePerUser:      plan.MaxPurchasePerUser,
		MaxActivePerUser:        plan.MaxActivePerUser,
		AllowWalletOverflow:     allowWalletOverflow,
		UpgradeGroup:            strings.TrimSpace(plan.UpgradeGroup),
		DowngradeGroup:          strings.TrimSpace(plan.DowngradeGroup),
		QuotaResetPeriod:        plan.QuotaResetPeriod,
		QuotaResetCustomSeconds: plan.QuotaResetCustomSeconds,
		CreatedTime:             common.GetTimestamp(),
		ExpiredTime:             expiredTime,
	}
}

func (r *SubscriptionRedemption) planSnapshot() *SubscriptionPlan {
	allowWalletOverflow := r.AllowWalletOverflow
	return &SubscriptionPlan{
		Id:                      r.PlanId,
		Title:                   r.PlanTitle,
		DurationUnit:            r.DurationUnit,
		DurationValue:           r.DurationValue,
		CustomSeconds:           r.CustomSeconds,
		Enabled:                 true,
		AllowWalletOverflow:     &allowWalletOverflow,
		MaxPurchasePerUser:      r.MaxPurchasePerUser,
		MaxActivePerUser:        r.MaxActivePerUser,
		UpgradeGroup:            r.UpgradeGroup,
		DowngradeGroup:          r.DowngradeGroup,
		TotalAmount:             r.AmountTotal,
		WeeklyAmount:            r.WeeklyAmount,
		QuotaResetPeriod:        r.QuotaResetPeriod,
		QuotaResetCustomSeconds: r.QuotaResetCustomSeconds,
	}
}

func CreateSubscriptionRedemptions(createdBy int, batchName string, planId int, count int, expiredTime int64) (*CreatedSubscriptionRedemptions, error) {
	if createdBy <= 0 || planId <= 0 || count <= 0 {
		return nil, errors.New("invalid subscription redemption arguments")
	}
	if strings.TrimSpace(batchName) == "" {
		return nil, errors.New("batch name is required")
	}
	if expiredTime != 0 && expiredTime < common.GetTimestamp() {
		return nil, errors.New("expiration time is in the past")
	}
	plan, err := GetSubscriptionPlanById(planId)
	if err != nil {
		return nil, err
	}
	if !plan.Enabled {
		return nil, errors.New("subscription plan is disabled")
	}

	codes := make([]string, 0, count)
	err = DB.Transaction(func(tx *gorm.DB) error {
		for i := 0; i < count; i++ {
			code, err := newSubscriptionRedemptionKey()
			if err != nil {
				return err
			}
			row := snapshotSubscriptionRedemption(createdBy, batchName, plan, expiredTime)
			row.KeyHash = subscriptionRedemptionHash(code)
			row.KeyHint = subscriptionRedemptionHint(code)
			if err := tx.Create(row).Error; err != nil {
				return err
			}
			codes = append(codes, code)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &CreatedSubscriptionRedemptions{
		PlanId:    plan.Id,
		PlanTitle: plan.Title,
		BatchName: strings.TrimSpace(batchName),
		Codes:     codes,
		ExpiresAt: expiredTime,
	}, nil
}

func RedeemSubscription(key string, userId int) (*SubscriptionRedemptionResult, error) {
	if !IsSubscriptionRedemptionKey(key) || userId <= 0 {
		return nil, ErrRedeemFailed
	}

	var redemption SubscriptionRedemption
	var subscription *UserSubscription
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("key_hash = ?", subscriptionRedemptionHash(key)).First(&redemption).Error; err != nil {
			return errors.New("invalid subscription redemption code")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("subscription redemption code is not enabled")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("subscription redemption code has expired")
		}

		result := tx.Model(&SubscriptionRedemption{}).
			Where("id = ? AND status = ?", redemption.Id, common.RedemptionCodeStatusEnabled).
			Updates(map[string]interface{}{
				"redeemed_time": common.GetTimestamp(),
				"status":        common.RedemptionCodeStatusUsed,
				"used_user_id":  userId,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("subscription redemption code was already used")
		}

		plan := redemption.planSnapshot()
		var err error
		subscription, err = CreateUserSubscriptionFromPlanWithRefTx(
			tx,
			userId,
			plan,
			"redemption",
			fmt.Sprintf("subscription_redemption:%d", redemption.Id),
		)
		return err
	})
	if err != nil {
		common.SysError("subscription redemption failed: " + err.Error())
		return nil, ErrRedeemFailed
	}

	if redemption.UpgradeGroup != "" {
		_ = UpdateUserGroupCache(userId, redemption.UpgradeGroup)
	}
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("subscription activated by redemption code, plan %s, code ID %d", redemption.PlanTitle, redemption.Id))
	return &SubscriptionRedemptionResult{
		PlanId:       redemption.PlanId,
		PlanTitle:    redemption.PlanTitle,
		Subscription: subscription,
	}, nil
}

func DisableSubscriptionRedemptions(keys []string) (int64, error) {
	if len(keys) == 0 {
		return 0, errors.New("no subscription redemption codes provided")
	}
	hashes := make([]string, 0, len(keys))
	for _, key := range keys {
		if !IsSubscriptionRedemptionKey(key) {
			return 0, errors.New("invalid subscription redemption code")
		}
		hashes = append(hashes, subscriptionRedemptionHash(key))
	}
	result := DB.Model(&SubscriptionRedemption{}).
		Where("key_hash IN ? AND status = ?", hashes, common.RedemptionCodeStatusEnabled).
		Update("status", common.RedemptionCodeStatusDisabled)
	return result.RowsAffected, result.Error
}
