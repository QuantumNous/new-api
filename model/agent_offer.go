package model

import "gorm.io/gorm"

const DefaultAgentCodeValidDays = 365

type AgentPlanOffer struct {
	Id            int   `json:"id"`
	PlanId        int   `json:"plan_id" gorm:"uniqueIndex;not null"`
	Enabled       bool  `json:"enabled" gorm:"not null"`
	UnitPrice     int64 `json:"-" gorm:"type:bigint;not null"`
	CodeValidDays int   `json:"code_valid_days" gorm:"type:int;not null"`
	RefundFeeBps  int   `json:"refund_fee_bps" gorm:"type:int;not null"`
	CreatedAt     int64 `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     int64 `json:"updated_at" gorm:"autoUpdateTime"`
}

func (offer *AgentPlanOffer) BeforeCreate(*gorm.DB) error {
	if offer.CodeValidDays == 0 {
		offer.CodeValidDays = DefaultAgentCodeValidDays
	}
	return nil
}
