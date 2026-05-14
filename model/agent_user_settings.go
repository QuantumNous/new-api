package model

import "time"

type AgentUserSetting struct {
	UserId      int       `gorm:"primaryKey" json:"user_id"`
	ExtraPrompt string    `gorm:"type:text" json:"extra_prompt"`
	Language    string    `gorm:"type:varchar(16);default:'zh-CN'" json:"language"`
	CreatedAt   time.Time `gorm:"index" json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (AgentUserSetting) TableName() string {
	return "agent_user_settings"
}
