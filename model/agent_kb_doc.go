package model

import "time"

type AgentKBDoc struct {
	Id          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Title       string    `gorm:"type:varchar(255);not null" json:"title"`
	Source      string    `gorm:"type:varchar(255)" json:"source"`
	Status      string    `gorm:"type:varchar(20);index;default:'ready'" json:"status"`
	ChunksCount int       `gorm:"default:0" json:"chunks_count"`
	CreatedAt   time.Time `gorm:"index" json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (AgentKBDoc) TableName() string {
	return "agent_kb_docs"
}
