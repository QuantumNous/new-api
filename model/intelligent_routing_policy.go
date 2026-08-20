package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

const (
	IntelligentRoutingPolicyDraft    = "draft"
	IntelligentRoutingPolicyActive   = "active"
	IntelligentRoutingPolicyArchived = "archived"

	IntelligentRoutingModeShadow = "shadow"
	IntelligentRoutingModeLive   = "live"
)

var (
	ErrIntelligentRoutingPolicyNotFound   = errors.New("intelligent routing policy not found")
	ErrIntelligentRoutingPolicyImmutable  = errors.New("published intelligent routing policy is immutable")
	ErrIntelligentRoutingRevisionConflict = errors.New("intelligent routing revision conflict")
)

type IntelligentRoutingPolicy struct {
	Id            int64      `json:"id" gorm:"primaryKey"`
	Version       int        `json:"version" gorm:"index"`
	Status        string     `json:"status" gorm:"type:varchar(16);index"`
	Config        string     `json:"config" gorm:"type:text"`
	Checksum      string     `json:"checksum" gorm:"type:varchar(64)"`
	SourceVersion int        `json:"source_version"`
	ChangeNote    string     `json:"change_note" gorm:"type:varchar(500)"`
	CreatedBy     int        `json:"created_by"`
	PublishedBy   int        `json:"published_by"`
	PublishedAt   *time.Time `json:"published_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type IntelligentRoutingRollout struct {
	Id             int64      `json:"id" gorm:"primaryKey"`
	Revision       int64      `json:"revision"`
	PolicyVersion  int        `json:"policy_version"`
	Enabled        bool       `json:"enabled"`
	Mode           string     `json:"mode" gorm:"type:varchar(16)"`
	TrafficPercent int        `json:"traffic_percent"`
	UserGroups     string     `json:"user_groups" gorm:"type:text"`
	TokenGroups    string     `json:"token_groups" gorm:"type:text"`
	UpdatedBy      int        `json:"updated_by"`
	StartedAt      *time.Time `json:"started_at"`
	EndedAt        *time.Time `json:"ended_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

func CreateIntelligentRoutingDraft(policy IntelligentRoutingPolicy) (IntelligentRoutingPolicy, error) {
	policy.Id = 0
	policy.Version = 0
	policy.Status = IntelligentRoutingPolicyDraft
	policy.PublishedBy = 0
	policy.PublishedAt = nil
	err := DB.Create(&policy).Error
	return policy, err
}

func UpdateIntelligentRoutingDraft(id int64, updatedAt time.Time, config, checksum string) (IntelligentRoutingPolicy, error) {
	var policy IntelligentRoutingPolicy
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("id = ?", id).First(&policy).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrIntelligentRoutingPolicyNotFound
			}
			return err
		}
		if policy.Status != IntelligentRoutingPolicyDraft {
			return ErrIntelligentRoutingPolicyImmutable
		}
		result := tx.Model(&IntelligentRoutingPolicy{}).
			Where("id = ? AND status = ? AND updated_at = ?", id, IntelligentRoutingPolicyDraft, updatedAt).
			Updates(map[string]any{"config": config, "checksum": checksum})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrIntelligentRoutingRevisionConflict
		}
		return tx.Where("id = ?", id).First(&policy).Error
	})
	return policy, err
}

func ListIntelligentRoutingPolicies(offset, limit int) ([]IntelligentRoutingPolicy, int64, error) {
	var policies []IntelligentRoutingPolicy
	var total int64
	if err := DB.Model(&IntelligentRoutingPolicy{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := DB.Order("id DESC").Offset(offset).Limit(limit).Find(&policies).Error
	return policies, total, err
}

func GetIntelligentRoutingPolicy(id int64) (IntelligentRoutingPolicy, error) {
	var policy IntelligentRoutingPolicy
	err := DB.Where("id = ?", id).First(&policy).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = ErrIntelligentRoutingPolicyNotFound
	}
	return policy, err
}

func GetActiveIntelligentRoutingPolicy() (IntelligentRoutingPolicy, error) {
	var policy IntelligentRoutingPolicy
	err := DB.Where("status = ?", IntelligentRoutingPolicyActive).Order("version DESC").First(&policy).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = ErrIntelligentRoutingPolicyNotFound
	}
	return policy, err
}

func PublishIntelligentRoutingPolicy(id int64, administratorID int, changeNote string) (IntelligentRoutingPolicy, error) {
	var published IntelligentRoutingPolicy
	err := DB.Transaction(func(tx *gorm.DB) error {
		var draft IntelligentRoutingPolicy
		if err := lockForUpdate(tx).Where("id = ?", id).First(&draft).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrIntelligentRoutingPolicyNotFound
			}
			return err
		}
		if draft.Status != IntelligentRoutingPolicyDraft {
			return ErrIntelligentRoutingPolicyImmutable
		}

		var latest IntelligentRoutingPolicy
		latestErr := lockForUpdate(tx).Order("version DESC").First(&latest).Error
		if latestErr != nil && !errors.Is(latestErr, gorm.ErrRecordNotFound) {
			return latestErr
		}
		nextVersion := latest.Version + 1
		if err := tx.Model(&IntelligentRoutingPolicy{}).
			Where("status = ?", IntelligentRoutingPolicyActive).
			Update("status", IntelligentRoutingPolicyArchived).Error; err != nil {
			return err
		}
		now := time.Now()
		updates := map[string]any{
			"version": nextVersion, "status": IntelligentRoutingPolicyActive, "change_note": changeNote,
			"published_by": administratorID, "published_at": &now,
		}
		result := tx.Model(&IntelligentRoutingPolicy{}).
			Where("id = ? AND status = ?", id, IntelligentRoutingPolicyDraft).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrIntelligentRoutingRevisionConflict
		}
		return tx.Where("id = ?", id).First(&published).Error
	})
	return published, err
}

func RollbackIntelligentRoutingPolicy(sourceVersion int, administratorID int, changeNote string) (IntelligentRoutingPolicy, error) {
	var rolledBack IntelligentRoutingPolicy
	err := DB.Transaction(func(tx *gorm.DB) error {
		var source IntelligentRoutingPolicy
		if err := lockForUpdate(tx).Where("version = ?", sourceVersion).First(&source).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrIntelligentRoutingPolicyNotFound
			}
			return err
		}
		var latest IntelligentRoutingPolicy
		latestErr := lockForUpdate(tx).Order("version DESC").First(&latest).Error
		if latestErr != nil && !errors.Is(latestErr, gorm.ErrRecordNotFound) {
			return latestErr
		}
		if err := tx.Model(&IntelligentRoutingPolicy{}).
			Where("status = ?", IntelligentRoutingPolicyActive).
			Update("status", IntelligentRoutingPolicyArchived).Error; err != nil {
			return err
		}
		now := time.Now()
		rolledBack = IntelligentRoutingPolicy{
			Version: latest.Version + 1, Status: IntelligentRoutingPolicyActive, Config: source.Config,
			Checksum: source.Checksum, SourceVersion: sourceVersion, ChangeNote: changeNote,
			CreatedBy: administratorID, PublishedBy: administratorID, PublishedAt: &now,
		}
		return tx.Create(&rolledBack).Error
	})
	return rolledBack, err
}

func GetIntelligentRoutingRollout() (IntelligentRoutingRollout, error) {
	var rollout IntelligentRoutingRollout
	err := DB.First(&rollout, 1).Error
	return rollout, err
}

func UpdateIntelligentRoutingRollout(expectedRevision int64, next IntelligentRoutingRollout) (IntelligentRoutingRollout, error) {
	var stored IntelligentRoutingRollout
	err := DB.Transaction(func(tx *gorm.DB) error {
		var current IntelligentRoutingRollout
		err := lockForUpdate(tx).First(&current, 1).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if expectedRevision != 0 {
				return ErrIntelligentRoutingRevisionConflict
			}
			next.Id = 1
			next.Revision = 1
			if err := tx.Create(&next).Error; err != nil {
				return err
			}
			stored = next
			return nil
		}
		if err != nil {
			return err
		}
		if current.Revision != expectedRevision {
			return ErrIntelligentRoutingRevisionConflict
		}
		updates := map[string]any{
			"revision": expectedRevision + 1, "policy_version": next.PolicyVersion, "enabled": next.Enabled,
			"mode": next.Mode, "traffic_percent": next.TrafficPercent, "user_groups": next.UserGroups,
			"token_groups": next.TokenGroups, "updated_by": next.UpdatedBy, "started_at": next.StartedAt, "ended_at": next.EndedAt,
		}
		result := tx.Model(&IntelligentRoutingRollout{}).Where("id = ? AND revision = ?", current.Id, expectedRevision).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrIntelligentRoutingRevisionConflict
		}
		return tx.First(&stored, current.Id).Error
	})
	return stored, err
}
