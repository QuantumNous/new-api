package model

import "time"

type AgentAuditLog struct {
	Id           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserId       int       `gorm:"index;not null" json:"user_id"`
	SessionId    int       `gorm:"index" json:"session_id"`
	ToolName     string    `gorm:"type:varchar(64);index;not null" json:"tool_name"`
	Args         string    `gorm:"type:text" json:"args"`
	Result       string    `gorm:"type:text" json:"result"`
	Status       string    `gorm:"type:varchar(16);index" json:"status"`
	ErrorMsg     string    `gorm:"type:varchar(255)" json:"error_msg"`
	NeedsConfirm bool      `gorm:"default:false" json:"needs_confirm"`
	Confirmed    bool      `gorm:"default:false" json:"confirmed"`
	DurationMs   int       `gorm:"default:0" json:"duration_ms"`
	CreatedAt    time.Time `gorm:"index" json:"created_at"`
}

func (AgentAuditLog) TableName() string {
	return "agent_audit_logs"
}
