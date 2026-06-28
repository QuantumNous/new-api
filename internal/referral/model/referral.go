package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	ReferralStatusSignedUp  = "signed_up"
	ReferralStatusConverted = "converted"
	ReferralStatusRewarded  = "rewarded"
	ReferralStatusBlocked   = "blocked"

	ReferralRewardKindQuota    = "quota"
	ReferralRewardKindSkill    = "skill_credit"
	ReferralRewardKindPlusDays = "plus_days"

	ReferralConversionTopUp        = "topup"
	ReferralConversionSubscription = "subscription"
	ReferralConversionSkill        = "skill_purchase"

	ReferralBlockSelfReferral = "self_referral"
	ReferralBlockNoInviter    = "no_inviter"
	ReferralBlockFraudCap     = "fraud_cap"
)

type ReferralRecord struct {
	ID                  string     `gorm:"column:id;type:char(36);primaryKey;not null" json:"id"`
	InviterID           int64      `gorm:"column:inviter_id;type:bigint;not null;index" json:"inviter_id"`
	InviteeID           int64      `gorm:"column:invitee_id;type:bigint;not null;uniqueIndex" json:"invitee_id"`
	InviteCode          string     `gorm:"column:invite_code;type:varchar(32);not null;index" json:"invite_code"`
	Status              string     `gorm:"column:status;type:varchar(32);not null;default:signed_up;index" json:"status"`
	SignupAt            time.Time  `gorm:"column:signup_at;not null" json:"signup_at"`
	ConvertedAt         *time.Time `gorm:"column:converted_at" json:"converted_at,omitempty"`
	ConversionSource    string     `gorm:"column:conversion_source;type:varchar(64);default:'';index" json:"conversion_source"`
	ConversionReference string     `gorm:"column:conversion_reference;type:varchar(128);default:'';index" json:"conversion_reference"`
	RewardKind          string     `gorm:"column:reward_kind;type:varchar(32);default:''" json:"reward_kind"`
	InviterRewardAmount int64      `gorm:"column:inviter_reward_amount;type:bigint;not null;default:0" json:"inviter_reward_amount"`
	InviteeRewardAmount int64      `gorm:"column:invitee_reward_amount;type:bigint;not null;default:0" json:"invitee_reward_amount"`
	RewardGrantedAt     *time.Time `gorm:"column:reward_granted_at" json:"reward_granted_at,omitempty"`
	BlockedReason       string     `gorm:"column:blocked_reason;type:varchar(64);default:'';index" json:"blocked_reason"`
	CreatedAt           time.Time  `gorm:"column:created_at;not null;autoCreateTime" json:"created_at"`
	UpdatedAt           time.Time  `gorm:"column:updated_at;not null;autoUpdateTime" json:"updated_at"`
}

func (ReferralRecord) TableName() string { return "referral_records" }

func (r *ReferralRecord) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	if r.SignupAt.IsZero() {
		r.SignupAt = time.Now().UTC()
	}
	if r.Status == "" {
		r.Status = ReferralStatusSignedUp
	}
	return nil
}

func MigrateReferrals(db *gorm.DB) error {
	if err := db.AutoMigrate(&ReferralRecord{}); err != nil {
		return fmt.Errorf("AutoMigrate referral records: %w", err)
	}
	return nil
}

var ErrSelfReferral = errors.New("self referral is not allowed")

func RecordSignupTx(tx *gorm.DB, inviteeID int64, inviterID int64, inviteCode string) error {
	if tx == nil {
		return errors.New("db is nil")
	}
	inviteCode = strings.TrimSpace(inviteCode)
	if inviteeID <= 0 || inviterID <= 0 {
		return nil
	}
	status := ReferralStatusSignedUp
	blockedReason := ""
	if inviteeID == inviterID {
		status = ReferralStatusBlocked
		blockedReason = ReferralBlockSelfReferral
	}
	record := ReferralRecord{
		InviterID:     inviterID,
		InviteeID:     inviteeID,
		InviteCode:    inviteCode,
		Status:        status,
		BlockedReason: blockedReason,
		SignupAt:      time.Now().UTC(),
	}
	err := tx.Where("invitee_id = ?", inviteeID).FirstOrCreate(&record).Error
	if err != nil {
		return err
	}
	if blockedReason != "" {
		return ErrSelfReferral
	}
	return nil
}
