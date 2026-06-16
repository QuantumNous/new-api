package model

import (
	"github.com/QuantumNous/new-api/common"
)

const DefaultPlaygroundConversationType = "chat"

func NormalizePlaygroundConversationType(conversationType string) string {
	switch conversationType {
	case "chat", "image", "video":
		return conversationType
	default:
		return DefaultPlaygroundConversationType
	}
}

type PlaygroundConversation struct {
	ID             int64     `json:"id" gorm:"primary_key;AUTO_INCREMENT"`
	UserID         int       `json:"user_id" gorm:"index;uniqueIndex:uk_playground_user_conversation"`
	ConversationID string    `json:"conversation_id" gorm:"type:varchar(64);not null;uniqueIndex:uk_playground_user_conversation"`
	Type           string    `json:"type" gorm:"type:varchar(16);not null;default:'chat'"`
	Title          string    `json:"title" gorm:"type:varchar(255);default:''"`
	Messages       JSONValue `json:"messages" gorm:"type:json"`
	CreatedAt      int64     `json:"created_at" gorm:"index"`
	UpdatedAt      int64     `json:"updated_at" gorm:"index"`
}

func ListUserPlaygroundConversations(userID int) ([]*PlaygroundConversation, error) {
	var conversations []*PlaygroundConversation
	err := DB.Where("user_id = ?", userID).
		Order("updated_at DESC").
		Find(&conversations).Error
	if err != nil {
		return nil, err
	}
	for _, conversation := range conversations {
		if conversation == nil {
			continue
		}
		conversation.Type = NormalizePlaygroundConversationType(conversation.Type)
	}
	return conversations, nil
}

func GetUserPlaygroundConversation(userID int, conversationID string) (*PlaygroundConversation, bool, error) {
	if userID == 0 || conversationID == "" {
		return nil, false, nil
	}
	var conversation PlaygroundConversation
	err := DB.Where("user_id = ? AND conversation_id = ?", userID, conversationID).
		First(&conversation).Error
	exist, err := RecordExist(err)
	if err != nil {
		return nil, false, err
	}
	conversation.Type = NormalizePlaygroundConversationType(conversation.Type)
	return &conversation, exist, nil
}

func UpsertUserPlaygroundConversation(userID int, conversationID, conversationType, title string, messages JSONValue, createdAt, updatedAt int64) (*PlaygroundConversation, error) {
	now := common.GetTimestamp()
	if createdAt <= 0 {
		createdAt = now
	}
	if updatedAt <= 0 {
		updatedAt = now
	}
	conversationType = NormalizePlaygroundConversationType(conversationType)

	conversation, exist, err := GetUserPlaygroundConversation(userID, conversationID)
	if err != nil {
		return nil, err
	}
	if !exist {
		conversation = &PlaygroundConversation{
			UserID:         userID,
			ConversationID: conversationID,
			Type:           conversationType,
			Title:          title,
			Messages:       messages,
			CreatedAt:      createdAt,
			UpdatedAt:      updatedAt,
		}
		return conversation, DB.Create(conversation).Error
	}

	conversation.Type = conversationType
	conversation.Title = title
	conversation.Messages = messages
	if createdAt > 0 {
		conversation.CreatedAt = createdAt
	}
	conversation.UpdatedAt = updatedAt
	return conversation, DB.Save(conversation).Error
}

func DeleteUserPlaygroundConversation(userID int, conversationID string) error {
	return DB.Where("user_id = ? AND conversation_id = ?", userID, conversationID).
		Delete(&PlaygroundConversation{}).Error
}
