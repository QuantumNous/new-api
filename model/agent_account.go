package model

import (
	"errors"
	"gorm.io/gorm"
)

const (
	DefaultAgentDailyCodeLimit  = 200
	AgentAccountStatusActive    = "active"
	AgentAccountStatusDisabled  = "disabled"
	AgentCreditEventAdminCredit = "admin_credit"
	AgentCreditEventAdminDebit  = "admin_debit"
	AgentCreditEventPurchase    = "purchase"
	AgentCreditEventRefund      = "refund"
)

var ErrAgentCreditLogImmutable = errors.New("agent credit log is immutable")

type AgentAccount struct {
	Id             int    `json:"id"`
	UserId         int    `json:"user_id" gorm:"uniqueIndex;not null"`
	Status         string `json:"status" gorm:"type:varchar(16);not null"`
	Balance        int64  `json:"-" gorm:"type:bigint;not null"`
	DailyCodeLimit int    `json:"daily_code_limit" gorm:"type:int;not null"`
	DailyCountDate string `json:"daily_count_date" gorm:"type:varchar(10);not null"`
	DailyCodeCount int    `json:"daily_code_count" gorm:"type:int;not null"`
	Version        int64  `json:"version" gorm:"type:bigint;not null"`
	CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (account *AgentAccount) BeforeCreate(*gorm.DB) error {
	if account.DailyCodeLimit == 0 {
		account.DailyCodeLimit = DefaultAgentDailyCodeLimit
	}
	return nil
}

type AgentCreditLog struct {
	Id             int    `json:"id" gorm:"index:idx_agent_credit_log_agent_user_id_id,priority:2"`
	AgentUserId    int    `json:"agent_user_id" gorm:"index;index:idx_agent_credit_log_agent_user_id_id,priority:1;not null"`
	Delta          int64  `json:"-" gorm:"type:bigint;not null"`
	BalanceBefore  int64  `json:"-" gorm:"type:bigint;not null"`
	BalanceAfter   int64  `json:"-" gorm:"type:bigint;not null"`
	EventType      string `json:"event_type" gorm:"type:varchar(32);uniqueIndex:idx_agent_credit_log_event_business;not null"`
	BusinessKey    string `json:"business_key" gorm:"type:varchar(128);uniqueIndex:idx_agent_credit_log_event_business;not null"`
	OrderId        int    `json:"order_id" gorm:"index"`
	RedemptionId   int    `json:"redemption_id" gorm:"index"`
	OperatorUserId int    `json:"operator_user_id" gorm:"index"`
	Remark         string `json:"remark" gorm:"type:varchar(255)"`
	CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

func (AgentCreditLog) BeforeUpdate(*gorm.DB) error { return ErrAgentCreditLogImmutable }
func (AgentCreditLog) BeforeDelete(*gorm.DB) error { return ErrAgentCreditLogImmutable }
