package model

import "time"

type AgentUserQuota struct {
	UserId        int       `gorm:"primaryKey" json:"user_id"`
	FreeRemaining int       `gorm:"default:10" json:"free_remaining"`
	TotalUsed     int       `gorm:"default:0" json:"total_used"`
	LastResetAt   time.Time `json:"last_reset_at"`
	CreatedAt     time.Time `gorm:"index" json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (AgentUserQuota) TableName() string {
	return "agent_user_quota"
}
