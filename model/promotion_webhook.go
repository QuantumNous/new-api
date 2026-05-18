package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	PromotionWebhookStatusPending = "pending"
	PromotionWebhookStatusSuccess = "success"
	PromotionWebhookStatusFailed  = "failed"
)

type PromotionWebhookLog struct {
	Id           int    `json:"id"`
	EventID      string `json:"event_id" gorm:"type:varchar(64);uniqueIndex"`
	EventType    string `json:"event_type" gorm:"type:varchar(64);index"`
	DedupeKey    string `json:"dedupe_key" gorm:"type:varchar(128);uniqueIndex"`
	NewAPIUserID string `json:"newapi_user_id" gorm:"type:varchar(64);index"`
	WebhookURL   string `json:"webhook_url" gorm:"type:text"`
	Payload      string `json:"payload" gorm:"type:text"`
	Status       string `json:"status" gorm:"type:varchar(20);index"`
	Attempts     int    `json:"attempts"`
	NextRetryAt  int64  `json:"next_retry_at" gorm:"bigint;index"`
	LastSentAt   int64  `json:"last_sent_at" gorm:"bigint;index"`
	HTTPStatus   int    `json:"http_status"`
	ResponseBody string `json:"response_body" gorm:"type:text"`
	Error        string `json:"error" gorm:"type:text"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt    int64  `json:"updated_at" gorm:"bigint"`
}

type PromotionWebhookLogQueryParams struct {
	EventType      string
	Status         string
	NewAPIUserID   string
	DedupeKey      string
	StartTimestamp int64
	EndTimestamp   int64
}

func applyPromotionWebhookLogFilters(queryParams PromotionWebhookLogQueryParams) *gorm.DB {
	query := DB.Model(&PromotionWebhookLog{})
	if queryParams.EventType != "" {
		query = query.Where("event_type = ?", queryParams.EventType)
	}
	if queryParams.Status != "" {
		query = query.Where("status = ?", queryParams.Status)
	}
	if queryParams.NewAPIUserID != "" {
		query = query.Where("new_api_user_id = ?", queryParams.NewAPIUserID)
	}
	if queryParams.DedupeKey != "" {
		query = query.Where("dedupe_key LIKE ?", "%"+queryParams.DedupeKey+"%")
	}
	if queryParams.StartTimestamp > 0 {
		query = query.Where("created_at >= ?", queryParams.StartTimestamp)
	}
	if queryParams.EndTimestamp > 0 {
		query = query.Where("created_at <= ?", queryParams.EndTimestamp)
	}
	return query
}

func GetPromotionWebhookLogs(startIdx int, num int, queryParams PromotionWebhookLogQueryParams) []*PromotionWebhookLog {
	var logs []*PromotionWebhookLog
	if err := applyPromotionWebhookLogFilters(queryParams).Order("id desc").Limit(num).Offset(startIdx).Find(&logs).Error; err != nil {
		common.SysLog("failed to get promotion webhook logs: " + err.Error())
		return nil
	}
	return logs
}

func CountPromotionWebhookLogs(queryParams PromotionWebhookLogQueryParams) int64 {
	var total int64
	if err := applyPromotionWebhookLogFilters(queryParams).Count(&total).Error; err != nil {
		common.SysLog("failed to count promotion webhook logs: " + err.Error())
		return 0
	}
	return total
}

func CreatePromotionWebhookLog(log *PromotionWebhookLog) error {
	_, err := CreatePromotionWebhookLogOnce(log)
	return err
}

func CreatePromotionWebhookLogOnce(log *PromotionWebhookLog) (bool, error) {
	var existing PromotionWebhookLog
	if err := DB.Where("dedupe_key = ?", log.DedupeKey).First(&existing).Error; err == nil {
		*log = existing
		return false, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, err
	}

	now := common.GetTimestamp()
	log.CreatedAt = now
	log.UpdatedAt = now
	if log.Status == "" {
		log.Status = PromotionWebhookStatusPending
	}
	err := DB.Create(log).Error
	if err == nil {
		return true, nil
	}
	if findErr := DB.Where("dedupe_key = ?", log.DedupeKey).First(&existing).Error; findErr == nil {
		*log = existing
		return false, nil
	}
	return false, err
}

func UpdatePromotionWebhookLogResult(id int, status string, attempts int, httpStatus int, responseBody string, errMessage string, nextRetryAt int64, lastSentAt int64) error {
	return DB.Model(&PromotionWebhookLog{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":        status,
		"attempts":      attempts,
		"next_retry_at": nextRetryAt,
		"last_sent_at":  lastSentAt,
		"http_status":   httpStatus,
		"response_body": responseBody,
		"error":         errMessage,
		"updated_at":    common.GetTimestamp(),
	}).Error
}

func GetPromotionWebhookLogByID(id int) (*PromotionWebhookLog, error) {
	var log PromotionWebhookLog
	if err := DB.First(&log, id).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

func GetDuePromotionWebhookLogs(now int64, limit int) ([]*PromotionWebhookLog, error) {
	var logs []*PromotionWebhookLog
	err := DB.Where("status IN ? AND attempts < ? AND next_retry_at <= ?", []string{PromotionWebhookStatusPending, PromotionWebhookStatusFailed}, 3, now).
		Order("next_retry_at asc, id asc").
		Limit(limit).
		Find(&logs).Error
	return logs, err
}

func ResetPromotionWebhookLogForResend(id int) (*PromotionWebhookLog, error) {
	log, err := GetPromotionWebhookLogByID(id)
	if err != nil {
		return nil, err
	}
	if log.Id == 0 {
		return nil, errors.New("promotion webhook log not found")
	}
	if err := DB.Model(&PromotionWebhookLog{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":        PromotionWebhookStatusPending,
		"attempts":      0,
		"next_retry_at": int64(0),
		"http_status":   0,
		"response_body": "",
		"error":         "",
		"updated_at":    common.GetTimestamp(),
	}).Error; err != nil {
		return nil, err
	}
	return GetPromotionWebhookLogByID(id)
}
