package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type DistributionChannel struct {
	Id             int            `json:"id"`
	TenantId       int            `json:"tenant_id" gorm:"index;default:1"`
	Name           string         `json:"name" gorm:"type:varchar(128);not null;index"`
	Code           string         `json:"code" gorm:"type:varchar(64);not null;uniqueIndex"`
	Status         int            `json:"status" gorm:"type:int;default:1;index"`
	ParentId       int            `json:"parent_id" gorm:"index;default:0"`
	OwnerUserId    int            `json:"owner_user_id" gorm:"index;default:0"`
	CommissionRate float64        `json:"commission_rate" gorm:"type:decimal(10,6);default:0"`
	Remark         string         `json:"remark,omitempty" gorm:"type:varchar(255)"`
	CreatedAt      int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt      int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt      gorm.DeletedAt `gorm:"index"`
}

func (channel *DistributionChannel) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	channel.CreatedAt = now
	channel.UpdatedAt = now
	return nil
}

func (channel *DistributionChannel) BeforeUpdate(tx *gorm.DB) error {
	channel.UpdatedAt = common.GetTimestamp()
	return nil
}
