package model

import "time"

type AgentPaymentIntent struct {
	Id        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserId    int       `gorm:"index;not null" json:"user_id"`
	SessionId int       `gorm:"index" json:"session_id"`
	AmountCNY float64   `gorm:"default:0" json:"amount_cny"`
	IntentId  string    `gorm:"type:varchar(128);index" json:"intent_id"`
	Status    string    `gorm:"type:varchar(20);index" json:"status"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (AgentPaymentIntent) TableName() string {
	return "agent_payment_intents"
}
