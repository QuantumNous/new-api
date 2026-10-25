package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const maxCashbackCampaignRewardsPerUser = 100_000

// Payer scopes decide which orders a campaign rewards. The empty scope keeps
// the original every-order behavior for existing campaigns.
const (
	CashbackPayerScopeEveryOrder = ""
	CashbackPayerScopeFirstTopUp = "first_top_up"
)

// CashbackCampaign has an immutable scheduled window. Stopping it only
// shortens the eligibility window for payments not yet completed.
type CashbackCampaign struct {
	ID                int64  `json:"id" gorm:"primaryKey"`
	StartAt           int64  `json:"start_at" gorm:"type:bigint;not null;index"`
	EndAt             int64  `json:"end_at" gorm:"type:bigint;not null;index"`
	StoppedAt         int64  `json:"stopped_at" gorm:"type:bigint;not null;default:0"`
	MaxRewardsPerUser int    `json:"max_rewards_per_user" gorm:"not null"`
	PayerScope        string `json:"payer_scope" gorm:"type:varchar(32);not null;default:''"`
	CreatedBy         int    `json:"created_by" gorm:"not null"`
	StoppedBy         int    `json:"stopped_by"`
	CreatedAt         int64  `json:"created_at" gorm:"autoCreateTime;type:bigint"`
	Status            string `json:"status" gorm:"-"`
}

func (campaign CashbackCampaign) statusAt(now int64) string {
	if campaign.StoppedAt > 0 && now >= campaign.StoppedAt || now >= campaign.EndAt {
		return "ended"
	}
	if now < campaign.StartAt {
		return "planned"
	}
	return "active"
}

func (campaign CashbackCampaign) activeAt(now int64) bool {
	return campaign.StartAt <= now && now < campaign.EndAt && (campaign.StoppedAt == 0 || now < campaign.StoppedAt)
}

func (campaign *CashbackCampaign) BeforeCreate(_ *gorm.DB) error {
	if campaign.StartAt <= 0 || campaign.EndAt <= campaign.StartAt || campaign.MaxRewardsPerUser <= 0 || campaign.MaxRewardsPerUser > maxCashbackCampaignRewardsPerUser || campaign.CreatedBy <= 0 || campaign.StoppedAt != 0 {
		return ErrCashbackInvalidInput
	}
	return validCashbackPayerScope(campaign.PayerScope, campaign.MaxRewardsPerUser)
}

// A first-top-up campaign can reward each payer at most once by definition.
func validCashbackPayerScope(scope string, maxRewardsPerUser int) error {
	switch scope {
	case CashbackPayerScopeEveryOrder:
		return nil
	case CashbackPayerScopeFirstTopUp:
		if maxRewardsPerUser != 1 {
			return ErrCashbackInvalidInput
		}
		return nil
	default:
		return ErrCashbackInvalidInput
	}
}

// The version Option row serializes configuration and campaign mutations on
// MySQL/PostgreSQL. The upsert also takes a SQLite write lock before overlap reads.
func lockCashbackCampaignConfigTx(tx *gorm.DB) error {
	key := operation_setting.CashbackSettingName + ".version"
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&Option{Key: key, Value: "0"}).Error; err != nil {
		return err
	}
	var option Option
	return lockForUpdate(tx).Where(map[string]any{"key": key}).First(&option).Error
}

func CreateCashbackCampaign(startAt, endAt int64, maxRewardsPerUser, operatorID int, payerScope string) (CashbackCampaign, error) {
	var campaign CashbackCampaign
	if operatorID <= 0 || maxRewardsPerUser <= 0 || maxRewardsPerUser > maxCashbackCampaignRewardsPerUser || endAt <= startAt {
		return campaign, ErrCashbackInvalidInput
	}
	if err := validCashbackPayerScope(payerScope, maxRewardsPerUser); err != nil {
		return campaign, err
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockCashbackCampaignConfigTx(tx); err != nil {
			return err
		}
		now, err := getDBTimestampOnStrict(tx)
		if err != nil {
			return err
		}
		if startAt < now {
			return ErrCashbackInvalidInput
		}
		var overlap int64
		if err := tx.Model(&CashbackCampaign{}).
			Where("start_at < ? AND end_at > ? AND (stopped_at = 0 OR stopped_at > ?)", endAt, startAt, startAt).
			Count(&overlap).Error; err != nil {
			return err
		}
		if overlap > 0 {
			return fmt.Errorf("%w: campaign window overlaps", ErrCashbackInvalidState)
		}
		campaign = CashbackCampaign{StartAt: startAt, EndAt: endAt, MaxRewardsPerUser: maxRewardsPerUser, PayerScope: payerScope, CreatedBy: operatorID}
		return tx.Create(&campaign).Error
	})
	if err == nil {
		campaign.Status = campaign.statusAt(getDBTimestampOn(DB))
	}
	return campaign, err
}

func StopCashbackCampaign(id int64, operatorID int) (CashbackCampaign, error) {
	var campaign CashbackCampaign
	if id <= 0 || operatorID <= 0 {
		return campaign, ErrCashbackInvalidInput
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockCashbackCampaignConfigTx(tx); err != nil {
			return err
		}
		if err := lockForUpdate(tx).First(&campaign, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCashbackNotFound
			}
			return err
		}
		if campaign.StoppedAt != 0 {
			return nil
		}
		now, err := getDBTimestampOnStrict(tx)
		if err != nil {
			return err
		}
		if now >= campaign.EndAt {
			return ErrCashbackInvalidState
		}
		campaign.StoppedAt = now
		campaign.StoppedBy = operatorID
		return tx.Model(&campaign).Updates(map[string]any{"stopped_at": now, "stopped_by": operatorID}).Error
	})
	if err == nil {
		campaign.Status = campaign.statusAt(getDBTimestampOn(DB))
	}
	return campaign, err
}

func ListCashbackCampaigns() ([]CashbackCampaign, error) {
	var campaigns []CashbackCampaign
	err := DB.Order("id desc").Limit(500).Find(&campaigns).Error
	if err != nil {
		return nil, err
	}
	now := getDBTimestampOn(DB)
	for i := range campaigns {
		campaigns[i].Status = campaigns[i].statusAt(now)
	}
	return campaigns, nil
}
