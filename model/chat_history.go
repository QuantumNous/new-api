/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// ChatSession represents a playground chat session
type ChatSession struct {
	ID           string `json:"id" gorm:"primaryKey;type:varchar(36)"`
	UserID       int    `json:"user_id" gorm:"index;not null"`
	Title        string `json:"title" gorm:"type:varchar(255);not null;default:''"`
	Model        string `json:"model" gorm:"type:varchar(100);not null;default:''"`
	GroupName    string `json:"group_name" gorm:"type:varchar(100);default:''"`
	MessageCount int    `json:"message_count" gorm:"default:0"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt    int64  `json:"updated_at" gorm:"bigint"`
}

func (ChatSession) TableName() string {
	return "chat_sessions"
}

// ChatMessage represents a single message within a chat session
type ChatMessage struct {
	ID        string `json:"id" gorm:"primaryKey;type:varchar(36)"`
	SessionID string `json:"session_id" gorm:"index;type:varchar(36);not null"`
	Role      string `json:"role" gorm:"type:varchar(20);not null"`
	Content   string `json:"content" gorm:"type:text;not null"`
	ImageURLs string `json:"image_urls,omitempty" gorm:"type:text;default:''"`
	Reasoning string `json:"reasoning,omitempty" gorm:"type:text;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
}

func (ChatMessage) TableName() string {
	return "chat_messages"
}

// GetChatSessionsByUserID returns all chat sessions for a user
func GetChatSessionsByUserID(userID int) ([]ChatSession, error) {
	var sessions []ChatSession
	err := DB.Where("user_id = ?", userID).
		Order("updated_at DESC").
		Find(&sessions).Error
	return sessions, err
}

// GetChatSessionByID returns a chat session by its ID
func GetChatSessionByID(id string, userID int) (*ChatSession, error) {
	var session ChatSession
	err := DB.Where("id = ? AND user_id = ?", id, userID).First(&session).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// CreateChatSession creates a new chat session
func CreateChatSession(session *ChatSession) error {
	return DB.Create(session).Error
}

// UpdateChatSession updates a chat session
func UpdateChatSession(session *ChatSession) error {
	return DB.Save(session).Error
}

// UpdateChatSessionTitle updates just the title
func UpdateChatSessionTitle(id string, userID int, title string) error {
	return DB.Model(&ChatSession{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("title", title).Error
}

// DeleteChatSession deletes a chat session and its messages
func DeleteChatSession(id string, userID int) error {
	// Verify ownership
	var session ChatSession
	err := DB.Where("id = ? AND user_id = ?", id, userID).First(&session).Error
	if err != nil {
		return err
	}

	// Delete messages first
	if err := DB.Where("session_id = ?", id).Delete(&ChatMessage{}).Error; err != nil {
		return err
	}

	// Delete session
	return DB.Delete(&session).Error
}

// GetChatMessagesBySessionID returns all messages for a session
func GetChatMessagesBySessionID(sessionID string, userID int) ([]ChatMessage, error) {
	// Verify ownership
	var session ChatSession
	err := DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error
	if err != nil {
		return nil, err
	}

	var messages []ChatMessage
	err = DB.Where("session_id = ?", sessionID).
		Order("created_at ASC").
		Find(&messages).Error
	return messages, err
}

// CreateChatMessage creates a new message and updates session
func CreateChatMessage(message *ChatMessage, userID int) error {
	// Verify session ownership
	var session ChatSession
	err := DB.Where("id = ? AND user_id = ?", message.SessionID, userID).First(&session).Error
	if err != nil {
		return err
	}

	// Create message
	if err := DB.Create(message).Error; err != nil {
		return err
	}

	// Update session message count and timestamp
	now := common.GetTimestamp()
	return DB.Model(&ChatSession{}).
		Where("id = ?", message.SessionID).
		Updates(map[string]interface{}{
			"message_count": gorm.Expr("message_count + 1"),
			"updated_at":    now,
		}).Error
}

// GetImageURLsForSession returns all image URLs in a session (for R2 cleanup)
func GetImageURLsForSession(sessionID string) ([]string, error) {
	var messages []ChatMessage
	err := DB.Where("session_id = ? AND image_urls != ''", sessionID).
		Select("image_urls").
		Find(&messages).Error
	if err != nil {
		return nil, err
	}
	var urls []string
	for _, m := range messages {
		if m.ImageURLs != "" {
			urls = append(urls, m.ImageURLs)
		}
	}
	return urls, nil
}
