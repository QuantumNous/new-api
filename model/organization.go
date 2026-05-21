package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type Organization struct {
	Id                    int            `json:"id"`
	TenantId              int            `json:"tenant_id" gorm:"index;default:1"`
	Name                  string         `json:"name" gorm:"type:varchar(128);not null;index"`
	Status                int            `json:"status" gorm:"type:int;default:1;index"`
	DistributionChannelId int            `json:"distribution_channel_id" gorm:"index;default:0"`
	Remark                string         `json:"remark,omitempty" gorm:"type:varchar(255)"`
	CreatedAt             int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt             int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt             gorm.DeletedAt `gorm:"index"`
}

func (organization *Organization) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	organization.CreatedAt = now
	organization.UpdatedAt = now
	return nil
}

func (organization *Organization) BeforeUpdate(tx *gorm.DB) error {
	organization.UpdatedAt = common.GetTimestamp()
	return nil
}
