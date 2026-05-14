package model

import "time"

type AgentSession struct {
	Id                  int       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserId              int       `gorm:"index;not null" json:"user_id"`
	Title               string    `gorm:"type:varchar(128)" json:"title"`
	LastMessage         string    `gorm:"type:text" json:"last_message"`
	Status              string    `gorm:"type:varchar(16);default:'active';index" json:"status"`
	TokenCost           int64     `gorm:"default:0" json:"token_cost"`
	PendingConfirmToken string    `gorm:"type:varchar(64);index" json:"pending_confirm_token"`
	CreatedAt           time.Time `gorm:"index" json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

func (AgentSession) TableName() string {
	return "agent_sessions"
}
