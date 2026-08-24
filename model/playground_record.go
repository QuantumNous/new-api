package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
)

type PlaygroundLargeText string

func (PlaygroundLargeText) GormDataType() string {
	return "text"
}

func (PlaygroundLargeText) GormDBDataType(db *gorm.DB, _ *schema.Field) string {
	if db.Dialector.Name() == "mysql" {
		return "LONGTEXT"
	}
	return "TEXT"
}

const (
	PlaygroundRecordTypeTurn  = "turn"
	PlaygroundRecordTypeClear = "clear"

	PlaygroundStatusComplete = "complete"
	PlaygroundStatusError    = "error"
	PlaygroundStatusStopped  = "stopped"
	PlaygroundStatusCleared  = "cleared"
)

type PlaygroundRecord struct {
	ID                int64               `json:"id" gorm:"primaryKey"`
	UserID            int                 `json:"user_id" gorm:"not null;uniqueIndex:idx_playground_user_record,priority:1;index:idx_playground_restore,priority:1;index:idx_playground_conversation,priority:1"`
	RecordID          string              `json:"record_id" gorm:"type:varchar(64);not null;uniqueIndex:idx_playground_user_record,priority:2"`
	RecordType        string              `json:"record_type" gorm:"type:varchar(16);not null"`
	ConversationID    string              `json:"conversation_id" gorm:"type:varchar(64);not null;index:idx_playground_conversation,priority:2"`
	UserMessage       PlaygroundLargeText `json:"user_message"`
	RequestMessages   PlaygroundLargeText `json:"request_messages"`
	AssistantMessage  PlaygroundLargeText `json:"assistant_message"`
	ReasoningContent  PlaygroundLargeText `json:"reasoning_content"`
	InputText         PlaygroundLargeText `json:"input_text"`
	OutputText        PlaygroundLargeText `json:"output_text"`
	ModelName         string              `json:"model_name" gorm:"type:varchar(255)"`
	GroupName         string              `json:"group_name" gorm:"type:varchar(64)"`
	Parameters        PlaygroundLargeText `json:"parameters"`
	Status            string              `json:"status" gorm:"type:varchar(16);not null"`
	ErrorCode         string              `json:"error_code" gorm:"type:varchar(128)"`
	ErrorMessage      PlaygroundLargeText `json:"error_message"`
	RelayRequestID    string              `json:"relay_request_id" gorm:"type:varchar(64);index"`
	PromptTokens      int                 `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens  int                 `json:"completion_tokens" gorm:"default:0"`
	TotalTokens       int                 `json:"total_tokens" gorm:"default:0"`
	LatencyMS         int64               `json:"latency_ms" gorm:"default:0"`
	MessagesSnapshot  PlaygroundLargeText `json:"messages_snapshot"`
	IsLatest          bool                `json:"is_latest" gorm:"not null;default:false;index:idx_playground_restore,priority:3"`
	IsCurrent         bool                `json:"is_current" gorm:"not null;default:false;index:idx_playground_restore,priority:2"`
	ClientCompletedAt int64               `json:"client_completed_at" gorm:"not null;default:0"`
	CreatedAt         time.Time           `json:"created_at" gorm:"index:idx_playground_conversation,priority:3"`
	UpdatedAt         time.Time           `json:"updated_at"`
}

func SavePlaygroundRecord(record *PlaygroundRecord) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := lockPlaygroundUser(tx, record.UserID); err != nil {
			return err
		}

		var existing PlaygroundRecord
		err := tx.Where("user_id = ? AND record_id = ?", record.UserID, record.RecordID).First(&existing).Error
		if err == nil {
			return updateExistingPlaygroundRecord(tx, &existing, record)
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var latest PlaygroundRecord
		err = tx.Where(
			"user_id = ? AND conversation_id = ? AND is_latest = ?",
			record.UserID,
			record.ConversationID,
			true,
		).Order("client_completed_at DESC").Order("record_id DESC").First(&latest).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		newer := latest.ID == 0 || record.ClientCompletedAt > latest.ClientCompletedAt ||
			(record.ClientCompletedAt == latest.ClientCompletedAt && record.RecordID > latest.RecordID)
		blockedByClear := latest.RecordType == PlaygroundRecordTypeClear
		if !newer || blockedByClear {
			record.IsLatest = false
			record.IsCurrent = false
			record.MessagesSnapshot = ""
			return tx.Create(record).Error
		}

		if err := tx.Model(&PlaygroundRecord{}).
			Where("user_id = ? AND is_current = ?", record.UserID, true).
			Update("is_current", false).Error; err != nil {
			return err
		}
		if err := tx.Model(&PlaygroundRecord{}).
			Where(
				"user_id = ? AND conversation_id = ? AND is_latest = ?",
				record.UserID,
				record.ConversationID,
				true,
			).
			Updates(map[string]interface{}{
				"is_latest":         false,
				"messages_snapshot": "",
			}).Error; err != nil {
			return err
		}

		record.IsLatest = true
		record.IsCurrent = true
		return tx.Create(record).Error
	})
}

func GetCurrentPlaygroundRecord(userID int) (*PlaygroundRecord, error) {
	var record PlaygroundRecord
	err := DB.Where(
		"user_id = ? AND is_current = ? AND is_latest = ?",
		userID,
		true,
		true,
	).Order("client_completed_at DESC").Order("record_id DESC").First(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func ClearPlaygroundConversation(userID int, recordID, conversationID string, clientCompletedAt int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := lockPlaygroundUser(tx, userID); err != nil {
			return err
		}

		var existing PlaygroundRecord
		err := tx.Where("user_id = ? AND record_id = ?", userID, recordID).First(&existing).Error
		if err == nil {
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var latest PlaygroundRecord
		err = tx.Where(
			"user_id = ? AND conversation_id = ? AND is_latest = ?",
			userID,
			conversationID,
			true,
		).Order("client_completed_at DESC").Order("record_id DESC").First(&latest).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		newer := latest.ID == 0 || clientCompletedAt > latest.ClientCompletedAt ||
			(clientCompletedAt == latest.ClientCompletedAt && recordID > latest.RecordID)
		if !newer {
			return tx.Create(&PlaygroundRecord{
				UserID:            userID,
				RecordID:          recordID,
				RecordType:        PlaygroundRecordTypeClear,
				ConversationID:    conversationID,
				Status:            PlaygroundStatusCleared,
				IsLatest:          false,
				IsCurrent:         false,
				ClientCompletedAt: clientCompletedAt,
			}).Error
		}

		if latest.IsCurrent {
			if err := tx.Model(&PlaygroundRecord{}).
				Where("user_id = ? AND conversation_id = ? AND is_current = ?", userID, conversationID, true).
				Update("is_current", false).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&PlaygroundRecord{}).
			Where(
				"user_id = ? AND conversation_id = ? AND is_latest = ?",
				userID,
				conversationID,
				true,
			).
			Update("is_latest", false).Error; err != nil {
			return err
		}

		return tx.Create(&PlaygroundRecord{
			UserID:            userID,
			RecordID:          recordID,
			RecordType:        PlaygroundRecordTypeClear,
			ConversationID:    conversationID,
			Status:            PlaygroundStatusCleared,
			IsLatest:          true,
			IsCurrent:         false,
			ClientCompletedAt: clientCompletedAt,
		}).Error
	})
}

func lockPlaygroundUser(tx *gorm.DB, userID int) error {
	var user User
	return tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").First(&user, userID).Error
}

func updateExistingPlaygroundRecord(tx *gorm.DB, existing, record *PlaygroundRecord) error {
	messagesSnapshot := PlaygroundLargeText("")
	if existing.IsLatest {
		messagesSnapshot = record.MessagesSnapshot
	}

	return tx.Model(existing).Updates(map[string]interface{}{
		"user_message":        record.UserMessage,
		"request_messages":    record.RequestMessages,
		"assistant_message":   record.AssistantMessage,
		"reasoning_content":   record.ReasoningContent,
		"input_text":          record.InputText,
		"output_text":         record.OutputText,
		"model_name":          record.ModelName,
		"group_name":          record.GroupName,
		"parameters":          record.Parameters,
		"status":              record.Status,
		"error_code":          record.ErrorCode,
		"error_message":       record.ErrorMessage,
		"relay_request_id":    record.RelayRequestID,
		"prompt_tokens":       record.PromptTokens,
		"completion_tokens":   record.CompletionTokens,
		"total_tokens":        record.TotalTokens,
		"latency_ms":          record.LatencyMS,
		"messages_snapshot":   messagesSnapshot,
		"client_completed_at": record.ClientCompletedAt,
	}).Error
}
