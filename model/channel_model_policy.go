package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ChannelModelPolicy is the persisted routing policy for channel_id × requested_model (PRD §31 / §32).
type ChannelModelPolicy struct {
	ChannelID      int64  `json:"channel_id" gorm:"primaryKey;autoIncrement:false"`
	RequestedModel string `json:"requested_model" gorm:"size:191;primaryKey;autoIncrement:false"`
	ManualPriority int    `json:"manual_priority" gorm:"not null;default:0"`
	// Enabled is set in code / BeforeCreate; avoid gorm default:true (MySQL/PG AutoMigrate churn).
	Enabled   bool   `json:"enabled"`
	Source    string `json:"source" gorm:"size:32;not null;default:configured"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;not null"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint;not null"`
}

func (ChannelModelPolicy) TableName() string {
	return "channel_model_policy"
}

func (p *ChannelModelPolicy) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if p.CreatedAt == 0 {
		p.CreatedAt = now
	}
	if p.UpdatedAt == 0 {
		p.UpdatedAt = now
	}
	if p.Source == "" {
		p.Source = PolicySourceConfigured
	}
	// default enabled when creating via zero-value path; callers may set false explicitly
	return nil
}

func (p *ChannelModelPolicy) BeforeUpdate(_ *gorm.DB) error {
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

func (p *ChannelModelPolicy) PolicyKey() PolicyKey {
	return PolicyKey{ChannelID: p.ChannelID, RequestedModel: p.RequestedModel}
}

// GetChannelModelPolicy loads one policy row.
func GetChannelModelPolicy(channelID int64, requestedModel string) (*ChannelModelPolicy, error) {
	var p ChannelModelPolicy
	err := DB.Where("channel_id = ? AND requested_model = ?", channelID, requestedModel).First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ListChannelModelPoliciesByRequestedModel returns all policies for a requested_model.
func ListChannelModelPoliciesByRequestedModel(requestedModel string) ([]ChannelModelPolicy, error) {
	var rows []ChannelModelPolicy
	err := DB.Where("requested_model = ?", requestedModel).Find(&rows).Error
	return rows, err
}

// ListChannelModelPoliciesByChannel returns all policies for a channel.
func ListChannelModelPoliciesByChannel(channelID int64) ([]ChannelModelPolicy, error) {
	var rows []ChannelModelPolicy
	err := DB.Where("channel_id = ?", channelID).Find(&rows).Error
	return rows, err
}

// ListAllChannelModelPolicies returns every policy row.
func ListAllChannelModelPolicies() ([]ChannelModelPolicy, error) {
	var rows []ChannelModelPolicy
	err := DB.Find(&rows).Error
	return rows, err
}

// UpsertChannelModelPolicy inserts or updates a policy by primary key.
// On conflict, updates manual_priority / enabled / source / updated_at.
func UpsertChannelModelPolicy(p *ChannelModelPolicy) error {
	if p == nil {
		return errors.New("nil channel model policy")
	}
	now := common.GetTimestamp()
	if p.CreatedAt == 0 {
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	if p.Source == "" {
		p.Source = PolicySourceConfigured
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "channel_id"},
			{Name: "requested_model"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"manual_priority",
			"enabled",
			"source",
			"updated_at",
		}),
	}).Create(p).Error
}

// UpsertChannelModelPolicies batch-upserts policies.
func UpsertChannelModelPolicies(policies []ChannelModelPolicy) error {
	if len(policies) == 0 {
		return nil
	}
	now := common.GetTimestamp()
	for i := range policies {
		if policies[i].CreatedAt == 0 {
			policies[i].CreatedAt = now
		}
		policies[i].UpdatedAt = now
		if policies[i].Source == "" {
			policies[i].Source = PolicySourceConfigured
		}
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "channel_id"},
			{Name: "requested_model"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"manual_priority",
			"enabled",
			"source",
			"updated_at",
		}),
	}).CreateInBatches(policies, 100).Error
}

// UpdateChannelModelPolicyManualPriority updates only manual_priority.
func UpdateChannelModelPolicyManualPriority(channelID int64, requestedModel string, priority int) error {
	return DB.Model(&ChannelModelPolicy{}).
		Where("channel_id = ? AND requested_model = ?", channelID, requestedModel).
		Updates(map[string]interface{}{
			"manual_priority": priority,
			"updated_at":      common.GetTimestamp(),
		}).Error
}

// UpdateChannelModelPolicyEnabled updates only enabled.
func UpdateChannelModelPolicyEnabled(channelID int64, requestedModel string, enabled bool) error {
	return DB.Model(&ChannelModelPolicy{}).
		Where("channel_id = ? AND requested_model = ?", channelID, requestedModel).
		Updates(map[string]interface{}{
			"enabled":    enabled,
			"updated_at": common.GetTimestamp(),
		}).Error
}

// DeleteChannelModelPolicy removes one policy row.
func DeleteChannelModelPolicy(channelID int64, requestedModel string) error {
	return DB.Where("channel_id = ? AND requested_model = ?", channelID, requestedModel).
		Delete(&ChannelModelPolicy{}).Error
}

// EnsureChannelModelPolicy returns existing policy or creates a lazy default (PRD §5.3).
func EnsureChannelModelPolicy(channelID int64, requestedModel string, source string, manualPriority int) (*ChannelModelPolicy, error) {
	existing, err := GetChannelModelPolicy(channelID, requestedModel)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}
	if source == "" {
		source = PolicySourceLazyCreated
	}
	p := &ChannelModelPolicy{
		ChannelID:      channelID,
		RequestedModel: requestedModel,
		ManualPriority: manualPriority,
		Enabled:        true,
		Source:         source,
	}
	if err := UpsertChannelModelPolicy(p); err != nil {
		// race: another writer may have inserted
		return GetChannelModelPolicy(channelID, requestedModel)
	}
	return p, nil
}

