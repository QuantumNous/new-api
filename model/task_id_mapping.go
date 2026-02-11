package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TaskIDMapping struct {
	ID int64 `json:"id" gorm:"primary_key;AUTO_INCREMENT"`

	CreatedAt int64 `json:"created_at" gorm:"index"`

	LocalTaskID    string `json:"local_task_id" gorm:"type:varchar(191);uniqueIndex"`
	UpstreamTaskID string `json:"upstream_task_id" gorm:"type:text"`
}

func CreateTaskIDMapping(localTaskID, upstreamTaskID string) error {
	localTaskID = strings.TrimSpace(localTaskID)
	upstreamTaskID = strings.TrimSpace(upstreamTaskID)
	if localTaskID == "" || upstreamTaskID == "" {
		return fmt.Errorf("invalid task id mapping")
	}
	return DB.Create(&TaskIDMapping{
		LocalTaskID:    localTaskID,
		UpstreamTaskID: upstreamTaskID,
	}).Error
}

func NewLocalTaskIDWithChannel(channelID int) string {
	return fmt.Sprintf("tsk_%d_%s", channelID, strings.ReplaceAll(uuid.NewString(), "-", ""))
}

func CreateTaskIDMappingWithChannel(upstreamTaskID string, channelID int) (string, error) {
	upstreamTaskID = strings.TrimSpace(upstreamTaskID)
	if upstreamTaskID == "" {
		return "", fmt.Errorf("invalid upstream task id")
	}
	localTaskID := NewLocalTaskIDWithChannel(channelID)
	return localTaskID, CreateTaskIDMapping(localTaskID, upstreamTaskID)
}

func GetUpstreamTaskIDByLocalTaskID(localTaskID string) (string, bool, error) {
	localTaskID = strings.TrimSpace(localTaskID)
	if localTaskID == "" {
		return "", false, nil
	}

	var mapping TaskIDMapping
	err := DB.Where("local_task_id = ?", localTaskID).First(&mapping).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", false, nil
		}
		return "", false, err
	}
	return mapping.UpstreamTaskID, true, nil
}

func GetLocalTaskIDByUpstreamTaskID(upstreamTaskID string) (string, bool, error) {
	upstreamTaskID = strings.TrimSpace(upstreamTaskID)
	if upstreamTaskID == "" {
		return "", false, nil
	}

	var mapping TaskIDMapping
	err := DB.Where("upstream_task_id = ?", upstreamTaskID).First(&mapping).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", false, nil
		}
		return "", false, err
	}
	return mapping.LocalTaskID, true, nil
}
