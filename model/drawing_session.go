package model

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const defaultDrawingSessionTitlePrefix = "新会话"

type DrawingSession struct {
	ID         int64  `json:"id" gorm:"primary_key;AUTO_INCREMENT"`
	SessionID  string `json:"session_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId     int    `json:"user_id" gorm:"index"`
	Title      string `json:"title" gorm:"type:varchar(200)"`
	CreatedAt  int64  `json:"created_at"`
	UpdatedAt  int64  `json:"updated_at"`
	ImageCount int    `json:"image_count" gorm:"-"`
}

func (DrawingSession) TableName() string {
	return "drawing_sessions"
}

type DrawingMessage struct {
	ID         int64           `json:"id" gorm:"primary_key;AUTO_INCREMENT"`
	SessionID  string          `json:"session_id" gorm:"type:varchar(64);index"`
	UserId     int             `json:"user_id" gorm:"index"`
	Role       string          `json:"role" gorm:"type:varchar(20)"`
	Prompt     string          `json:"prompt" gorm:"type:text"`
	Model      string          `json:"model" gorm:"type:varchar(50)"`
	Size       string          `json:"size" gorm:"type:varchar(20)"`
	Quality    string          `json:"quality" gorm:"type:varchar(20)"`
	ImageUrls  json.RawMessage `json:"image_urls" gorm:"type:json"`
	ResultData json.RawMessage `json:"result_data" gorm:"type:json"`
	TaskID     string          `json:"task_id" gorm:"type:varchar(64);index"`
	Status     string          `json:"status" gorm:"type:varchar(20)"`
	FailReason string          `json:"fail_reason" gorm:"type:text"`
	CreatedAt  int64           `json:"created_at"`
}

func (DrawingMessage) TableName() string {
	return "drawing_messages"
}

func GenerateSessionID() string {
	key, _ := common.GenerateRandomCharsKey(32)
	return "sess_" + key
}

func CreateDrawingSession(userId int, title string) (*DrawingSession, error) {
	title = strings.TrimSpace(title)
	if title == "" || title == defaultDrawingSessionTitlePrefix {
		defaultTitle, err := GetNextDrawingSessionTitle(userId)
		if err != nil {
			return nil, err
		}
		title = defaultTitle
	}

	now := time.Now().Unix()
	session := &DrawingSession{
		SessionID: GenerateSessionID(),
		UserId:    userId,
		Title:     title,
		CreatedAt: now,
		UpdatedAt: now,
	}
	err := DB.Create(session).Error
	return session, err
}

func GetNextDrawingSessionTitle(userId int) (string, error) {
	var titles []string
	err := DB.Model(&DrawingSession{}).Where("user_id = ?", userId).Pluck("title", &titles).Error
	if err != nil {
		return "", err
	}
	return nextDrawingSessionTitle(titles), nil
}

func nextDrawingSessionTitle(titles []string) string {
	used := make(map[int]bool, len(titles))
	for _, title := range titles {
		trimmedTitle := strings.TrimSpace(title)
		suffix := strings.TrimPrefix(trimmedTitle, defaultDrawingSessionTitlePrefix)
		if suffix == trimmedTitle || suffix == "" {
			continue
		}

		index, err := strconv.Atoi(suffix)
		if err == nil && index > 0 {
			used[index] = true
		}
	}

	for index := 1; ; index++ {
		if !used[index] {
			return fmt.Sprintf("%s%d", defaultDrawingSessionTitlePrefix, index)
		}
	}
}

func GetDrawingSessionsByUserId(userId int) ([]*DrawingSession, error) {
	var sessions []*DrawingSession
	err := DB.Where("user_id = ?", userId).Order("updated_at DESC").Find(&sessions).Error
	if err != nil {
		return nil, err
	}

	imageCounts, err := GetDrawingSessionImageCountsByUserId(userId)
	if err != nil {
		return nil, err
	}
	for _, session := range sessions {
		session.ImageCount = imageCounts[session.SessionID]
	}
	return sessions, nil
}

func GetDrawingSessionImageCountsByUserId(userId int) (map[string]int, error) {
	type messageResult struct {
		SessionID  string          `json:"session_id"`
		ResultData json.RawMessage `json:"result_data"`
	}

	var results []messageResult
	err := DB.Model(&DrawingMessage{}).
		Select("session_id, result_data").
		Where("user_id = ? AND status = ? AND result_data IS NOT NULL", userId, "success").
		Find(&results).Error
	if err != nil {
		return nil, err
	}

	counts := make(map[string]int)
	for _, result := range results {
		var images []any
		if err := common.Unmarshal(result.ResultData, &images); err != nil {
			continue
		}
		counts[result.SessionID] += len(images)
	}
	return counts, nil
}

func GetDrawingSession(sessionId string, userId int) (*DrawingSession, error) {
	var session DrawingSession
	err := DB.Where("session_id = ? AND user_id = ?", sessionId, userId).First(&session).Error
	return &session, err
}

func DeleteDrawingSession(sessionId string, userId int) error {
	tx := DB.Begin()
	if err := tx.Where("session_id = ? AND user_id = ?", sessionId, userId).Delete(&DrawingSession{}).Error; err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Where("session_id = ? AND user_id = ?", sessionId, userId).Delete(&DrawingMessage{}).Error; err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit().Error
}

func UpdateDrawingSessionTime(sessionId string) {
	DB.Model(&DrawingSession{}).Where("session_id = ?", sessionId).Update("updated_at", time.Now().Unix())
}

func UpdateDrawingSessionTitle(sessionId string, userId int, title string) error {
	return DB.Model(&DrawingSession{}).Where("session_id = ? AND user_id = ?", sessionId, userId).Updates(map[string]interface{}{
		"title":      title,
		"updated_at": time.Now().Unix(),
	}).Error
}

func CreateDrawingMessage(msg *DrawingMessage) error {
	msg.CreatedAt = time.Now().Unix()
	return DB.Create(msg).Error
}

func GetDrawingMessagesBySessionId(sessionId string, userId int) ([]*DrawingMessage, error) {
	var messages []*DrawingMessage
	err := DB.Where("session_id = ? AND user_id = ?", sessionId, userId).Order("id ASC").Find(&messages).Error
	return messages, err
}

func CountDrawingMessagesBySessionId(sessionId string, userId int) (int64, error) {
	var count int64
	err := DB.Model(&DrawingMessage{}).Where("session_id = ? AND user_id = ?", sessionId, userId).Count(&count).Error
	return count, err
}

func GetLatestDrawingMessage(sessionId string, userId int) (*DrawingMessage, error) {
	var msg DrawingMessage
	err := DB.Where("session_id = ? AND user_id = ?", sessionId, userId).Order("id DESC").First(&msg).Error
	return &msg, err
}

func GetAdjacentDrawingMessage(sessionId string, userId int, currentId int64, direction string) (*DrawingMessage, error) {
	var msg DrawingMessage
	query := DB.Where("session_id = ? AND user_id = ?", sessionId, userId)
	if direction == "next" {
		query = query.Where("id > ?", currentId).Order("id ASC")
	} else {
		query = query.Where("id < ?", currentId).Order("id DESC")
	}
	err := query.First(&msg).Error
	return &msg, err
}

func GetDrawingMessagePosition(sessionId string, userId int, messageId int64) (int64, error) {
	var position int64
	err := DB.Model(&DrawingMessage{}).
		Where("session_id = ? AND user_id = ? AND id <= ?", sessionId, userId, messageId).
		Count(&position).Error
	return position, err
}

func GetDrawingMessageById(id string, sessionId string, userId int) (*DrawingMessage, error) {
	var msg DrawingMessage
	err := DB.Where("id = ? AND session_id = ? AND user_id = ?", id, sessionId, userId).First(&msg).Error
	return &msg, err
}

func GetDrawingMessageByTaskId(taskId string) (*DrawingMessage, error) {
	var msg DrawingMessage
	err := DB.Where("task_id = ?", taskId).First(&msg).Error
	return &msg, err
}

func UpdateDrawingMessageStatus(taskId string, status string, resultData json.RawMessage, failReason string) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if resultData != nil {
		updates["result_data"] = resultData
	}
	if failReason != "" {
		updates["fail_reason"] = failReason
	}
	return DB.Model(&DrawingMessage{}).Where("task_id = ?", taskId).Updates(updates).Error
}
