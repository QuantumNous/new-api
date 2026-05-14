package model

import "time"

type AgentToolSetting struct {
	ToolName  string    `gorm:"primaryKey;type:varchar(64)" json:"tool_name"`
	Enabled   bool      `gorm:"default:true" json:"enabled"`
	UpdatedAt time.Time `json:"updated_at"`
	CreatedAt time.Time `json:"created_at"`
}

func (AgentToolSetting) TableName() string {
	return "agent_tool_settings"
}
