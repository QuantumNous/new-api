package model

import "time"

type AgentMessage struct {
	Id        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	SessionId int       `gorm:"index;not null" json:"session_id"`
	UserId    int       `gorm:"index;not null" json:"user_id"`
	Role      string    `gorm:"type:varchar(16);not null" json:"role"`
	Content   string    `gorm:"type:text" json:"content"`
	ToolCalls string    `gorm:"type:text" json:"tool_calls"`
	ToolName  string    `gorm:"type:varchar(64);index" json:"tool_name"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

func (AgentMessage) TableName() string {
	return "agent_messages"
}
