package model

import (
	"errors"
	"gorm.io/gorm"
)

var ErrAgentRefundRequestImmutable = errors.New("agent refund request is immutable")

type AgentRefundRequest struct {
	Id                    int    `json:"id"`
	AgentUserId           int    `json:"agent_user_id" gorm:"index;uniqueIndex:idx_agent_refund_request_idempotency;not null"`
	IdempotencyKey        string `json:"idempotency_key" gorm:"type:varchar(128);uniqueIndex:idx_agent_refund_request_idempotency;not null"`
	RequestHash           string `json:"request_hash" gorm:"type:varchar(64);not null"`
	RedemptionIDsSnapshot string `json:"redemption_ids_snapshot" gorm:"type:text;not null"`
	FeeTotal              int64  `json:"-" gorm:"type:bigint;not null"`
	RefundTotal           int64  `json:"-" gorm:"type:bigint;not null"`
	BalanceAfter          int64  `json:"-" gorm:"type:bigint;not null"`
	CreatedAt             int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (AgentRefundRequest) BeforeUpdate(*gorm.DB) error { return ErrAgentRefundRequestImmutable }
func (AgentRefundRequest) BeforeDelete(*gorm.DB) error { return ErrAgentRefundRequestImmutable }
