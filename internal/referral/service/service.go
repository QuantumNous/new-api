package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	referralmodel "github.com/QuantumNous/new-api/internal/referral/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type RewardConfig struct {
	Kind                string
	InviterAmount       int64
	InviteeAmount       int64
	MaxRewardsPerInvite int64
}

type Summary struct {
	InviteCode          string `json:"invite_code"`
	InviteLink          string `json:"invite_link"`
	SignedUpCount       int64  `json:"signed_up_count"`
	ConvertedCount      int64  `json:"converted_count"`
	RewardedCount       int64  `json:"rewarded_count"`
	BlockedCount        int64  `json:"blocked_count"`
	RewardKind          string `json:"reward_kind"`
	InviterRewardAmount int64  `json:"inviter_reward_amount"`
	InviteeRewardAmount int64  `json:"invitee_reward_amount"`
}

func CurrentRewardConfig() RewardConfig {
	kind := strings.TrimSpace(common.ReferralRewardKind)
	if kind == "" {
		kind = referralmodel.ReferralRewardKindQuota
	}
	maxRewards := int64(common.ReferralMaxRewardsPerInviter)
	if maxRewards < 0 {
		maxRewards = 0
	}
	return RewardConfig{
		Kind:                kind,
		InviterAmount:       int64(common.ReferralInviterRewardQuota),
		InviteeAmount:       int64(common.ReferralInviteeRewardQuota),
		MaxRewardsPerInvite: maxRewards,
	}
}

func RecordSignupTx(tx *gorm.DB, inviteeID int64, inviterID int64, inviteCode string) error {
	return referralmodel.RecordSignupTx(tx, inviteeID, inviterID, inviteCode)
}

func RecordSignup(db *gorm.DB, inviteeID int64, inviterID int64, inviteCode string) error {
	if db == nil {
		return errors.New("db is nil")
	}
	return db.Transaction(func(tx *gorm.DB) error {
		err := RecordSignupTx(tx, inviteeID, inviterID, inviteCode)
		if errors.Is(err, referralmodel.ErrSelfReferral) {
			return nil
		}
		return err
	})
}

func GrantForConversion(db *gorm.DB, inviteeID int64, source string, reference string) (*referralmodel.ReferralRecord, bool, error) {
	if db == nil {
		return nil, false, errors.New("db is nil")
	}
	source = strings.TrimSpace(source)
	reference = strings.TrimSpace(reference)
	if inviteeID <= 0 || source == "" {
		return nil, false, nil
	}

	var awarded bool
	var saved referralmodel.ReferralRecord
	err := db.Transaction(func(tx *gorm.DB) error {
		var record referralmodel.ReferralRecord
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("invitee_id = ?", inviteeID).
			First(&record).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if record.Status == referralmodel.ReferralStatusBlocked {
			saved = record
			return nil
		}
		if record.RewardGrantedAt != nil {
			saved = record
			return nil
		}
		if record.InviterID <= 0 {
			now := time.Now().UTC()
			record.Status = referralmodel.ReferralStatusBlocked
			record.BlockedReason = referralmodel.ReferralBlockNoInviter
			record.ConvertedAt = &now
			record.ConversionSource = source
			record.ConversionReference = reference
			if err := tx.Save(&record).Error; err != nil {
				return err
			}
			saved = record
			return nil
		}
		if record.InviterID == record.InviteeID {
			now := time.Now().UTC()
			record.Status = referralmodel.ReferralStatusBlocked
			record.BlockedReason = referralmodel.ReferralBlockSelfReferral
			record.ConvertedAt = &now
			record.ConversionSource = source
			record.ConversionReference = reference
			if err := tx.Save(&record).Error; err != nil {
				return err
			}
			saved = record
			return nil
		}

		cfg := CurrentRewardConfig()
		if cfg.MaxRewardsPerInvite > 0 {
			var rewardedCount int64
			if err := tx.Model(&referralmodel.ReferralRecord{}).
				Where("inviter_id = ? AND status = ?", record.InviterID, referralmodel.ReferralStatusRewarded).
				Count(&rewardedCount).Error; err != nil {
				return err
			}
			if rewardedCount >= cfg.MaxRewardsPerInvite {
				now := time.Now().UTC()
				record.Status = referralmodel.ReferralStatusBlocked
				record.BlockedReason = referralmodel.ReferralBlockFraudCap
				record.ConvertedAt = &now
				record.ConversionSource = source
				record.ConversionReference = reference
				if err := tx.Save(&record).Error; err != nil {
					return err
				}
				saved = record
				return nil
			}
		}

		now := time.Now().UTC()
		record.Status = referralmodel.ReferralStatusRewarded
		record.ConvertedAt = &now
		record.ConversionSource = source
		record.ConversionReference = reference
		record.RewardKind = cfg.Kind
		record.InviterRewardAmount = cfg.InviterAmount
		record.InviteeRewardAmount = cfg.InviteeAmount
		record.RewardGrantedAt = &now
		if err := applyRewardTx(tx, int(record.InviterID), int(record.InviteeID), cfg); err != nil {
			return err
		}
		if err := tx.Save(&record).Error; err != nil {
			return err
		}
		awarded = true
		saved = record
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	if saved.ID == "" {
		return nil, false, nil
	}
	return &saved, awarded, nil
}

func applyRewardTx(tx *gorm.DB, inviterID int, inviteeID int, cfg RewardConfig) error {
	switch cfg.Kind {
	case referralmodel.ReferralRewardKindQuota, referralmodel.ReferralRewardKindSkill:
		if cfg.InviterAmount > 0 {
			if err := tx.Model(&platformmodel.User{}).
				Where("id = ?", inviterID).
				Update("quota", gorm.Expr("quota + ?", cfg.InviterAmount)).Error; err != nil {
				return err
			}
		}
		if cfg.InviteeAmount > 0 {
			if err := tx.Model(&platformmodel.User{}).
				Where("id = ?", inviteeID).
				Update("quota", gorm.Expr("quota + ?", cfg.InviteeAmount)).Error; err != nil {
				return err
			}
		}
		return nil
	case referralmodel.ReferralRewardKindPlusDays:
		return nil
	default:
		return fmt.Errorf("unsupported referral reward kind: %s", cfg.Kind)
	}
}

func GetSummary(db *gorm.DB, userID int64, baseURL string) (*Summary, error) {
	if db == nil {
		return nil, errors.New("db is nil")
	}
	if userID <= 0 {
		return nil, errors.New("user id is empty")
	}
	var user platformmodel.User
	if err := db.Select("id", "aff_code").Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}
	cfg := CurrentRewardConfig()
	summary := &Summary{
		InviteCode:          user.AffCode,
		InviteLink:          BuildInviteLink(baseURL, user.AffCode),
		RewardKind:          cfg.Kind,
		InviterRewardAmount: cfg.InviterAmount,
		InviteeRewardAmount: cfg.InviteeAmount,
	}
	countByStatus := func(statuses []string) (int64, error) {
		var count int64
		err := db.Model(&referralmodel.ReferralRecord{}).
			Where("inviter_id = ? AND status IN ?", userID, statuses).
			Count(&count).Error
		return count, err
	}
	var err error
	summary.SignedUpCount, err = countByStatus([]string{
		referralmodel.ReferralStatusSignedUp,
		referralmodel.ReferralStatusConverted,
		referralmodel.ReferralStatusRewarded,
	})
	if err != nil {
		return nil, err
	}
	summary.ConvertedCount, err = countByStatus([]string{
		referralmodel.ReferralStatusConverted,
		referralmodel.ReferralStatusRewarded,
	})
	if err != nil {
		return nil, err
	}
	summary.RewardedCount, err = countByStatus([]string{referralmodel.ReferralStatusRewarded})
	if err != nil {
		return nil, err
	}
	summary.BlockedCount, err = countByStatus([]string{referralmodel.ReferralStatusBlocked})
	if err != nil {
		return nil, err
	}
	return summary, nil
}

func BuildInviteLink(baseURL string, code string) string {
	code = strings.TrimSpace(code)
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if code == "" {
		return baseURL
	}
	if baseURL == "" {
		return "?aff=" + code
	}
	return baseURL + "/register?aff=" + code
}
