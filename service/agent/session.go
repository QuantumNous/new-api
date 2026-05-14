package agent

import (
	"context"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func LoadOrCreateSession(ctx context.Context, userId int, sessionId int, firstMessage string) (*model.AgentSession, error) {
	if sessionId > 0 {
		var session model.AgentSession
		if err := model.DB.Where("id = ? AND user_id = ?", sessionId, userId).First(&session).Error; err != nil {
			return nil, err
		}
		return &session, nil
	}
	title := strings.TrimSpace(firstMessage)
	if len(title) > 60 {
		title = title[:60]
	}
	if title == "" {
		title = "New chat"
	}
	session := &model.AgentSession{
		UserId:      userId,
		Title:       title,
		LastMessage: firstMessage,
		Status:      constant.AgentSessionActive,
	}
	if err := model.DB.WithContext(ctx).Create(session).Error; err != nil {
		return nil, err
	}
	return session, nil
}

func ListSessions(ctx context.Context, userId int, limit int) ([]model.AgentSession, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var sessions []model.AgentSession
	err := model.DB.WithContext(ctx).Where("user_id = ?", userId).Order("updated_at desc").Limit(limit).Find(&sessions).Error
	return sessions, err
}

func GetSessionMessages(ctx context.Context, userId int, sessionId int) (*SessionWithMessages, error) {
	var session model.AgentSession
	if err := model.DB.WithContext(ctx).Where("id = ? AND user_id = ?", sessionId, userId).First(&session).Error; err != nil {
		return nil, err
	}
	var messages []model.AgentMessage
	if err := model.DB.WithContext(ctx).Where("session_id = ? AND user_id = ?", sessionId, userId).Order("id asc").Find(&messages).Error; err != nil {
		return nil, err
	}
	return &SessionWithMessages{Session: &session, Messages: messages}, nil
}

func DeleteSession(ctx context.Context, userId int, sessionId int) error {
	return model.DB.WithContext(ctx).Model(&model.AgentSession{}).Where("id = ? AND user_id = ?", sessionId, userId).Update("status", constant.AgentSessionArchived).Error
}

func AppendMessage(ctx context.Context, userId int, sessionId int, role string, content string, toolName string, toolCalls string) error {
	if role != constant.AgentRoleUser && role != constant.AgentRoleAssistant && role != constant.AgentRoleTool {
		role = constant.AgentRoleAssistant
	}
	message := model.AgentMessage{
		SessionId: sessionId,
		UserId:    userId,
		Role:      role,
		Content:   Sanitize(content),
		ToolName:  toolName,
		ToolCalls: Sanitize(toolCalls),
	}
	if err := model.DB.WithContext(ctx).Create(&message).Error; err != nil {
		return err
	}
	return model.DB.WithContext(ctx).Model(&model.AgentSession{}).Where("id = ? AND user_id = ?", sessionId, userId).Updates(map[string]interface{}{
		"last_message": Sanitize(content),
	}).Error
}
