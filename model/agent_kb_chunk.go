package model

import "time"

type AgentKBChunk struct {
	Id         int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	DocId      int       `gorm:"index;not null" json:"doc_id"`
	Content    string    `gorm:"type:text;not null" json:"content"`
	Embedding  string    `gorm:"type:text" json:"embedding"`
	TokenCount int       `gorm:"default:0" json:"token_count"`
	CreatedAt  time.Time `gorm:"index" json:"created_at"`
}

func (AgentKBChunk) TableName() string {
	return "agent_kb_chunks"
}
