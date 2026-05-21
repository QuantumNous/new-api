package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type Tenant struct {
	Id        int            `json:"id"`
	Name      string         `json:"name" gorm:"type:varchar(128);not null;uniqueIndex"`
	Status    int            `json:"status" gorm:"type:int;default:1;index"`
	Remark    string         `json:"remark,omitempty" gorm:"type:varchar(255)"`
	CreatedAt int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

func (tenant *Tenant) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	tenant.CreatedAt = now
	tenant.UpdatedAt = now
	return nil
}

func (tenant *Tenant) BeforeUpdate(tx *gorm.DB) error {
	tenant.UpdatedAt = common.GetTimestamp()
	return nil
}
