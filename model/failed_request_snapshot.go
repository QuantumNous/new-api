package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type FailedRequestSnapshot struct {
	Id              int    `json:"id" gorm:"primaryKey"`
	RequestId       string `json:"request_id" gorm:"type:varchar(64);uniqueIndex;not null"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint;index"`
	UserId          int    `json:"user_id" gorm:"index"`
	TokenId         int    `json:"token_id" gorm:"index"`
	ModelName       string `json:"model_name" gorm:"index"`
	RequestPath     string `json:"request_path" gorm:"type:varchar(255);index"`
	Method          string `json:"method" gorm:"type:varchar(16)"`
	ContentType     string `json:"content_type" gorm:"type:varchar(255)"`
	Headers         string `json:"headers" gorm:"type:text"`
	Body            string `json:"body" gorm:"type:text"`
	BodySize        int64  `json:"body_size"`
	UseChannel      string `json:"use_channel" gorm:"type:text"`
	ErrorCode       string `json:"error_code" gorm:"index"`
	ErrorType       string `json:"error_type"`
	StatusCode      int    `json:"status_code" gorm:"index"`
	ErrorMessage    string `json:"error_message" gorm:"type:text"`
	RetryDecision   string `json:"retry_decision" gorm:"type:text"`
	RequestFormat   string `json:"request_format"`
	RelayMode       int    `json:"relay_mode"`
	RelayFormat     string `json:"relay_format" gorm:"type:varchar(64)"`
	LastChannelId   int    `json:"last_channel_id" gorm:"index"`
	LastChannelName string `json:"last_channel_name"`
}

func (FailedRequestSnapshot) TableName() string {
	return "failed_request_snapshots"
}

func SaveFailedRequestSnapshot(snapshot *FailedRequestSnapshot) error {
	if snapshot == nil {
		return errors.New("snapshot is nil")
	}
	snapshot.RequestId = strings.TrimSpace(snapshot.RequestId)
	if snapshot.RequestId == "" {
		return errors.New("request_id is empty")
	}
	if snapshot.CreatedAt == 0 {
		snapshot.CreatedAt = common.GetTimestamp()
	}
	return DB.Where("request_id = ?", snapshot.RequestId).
		Assign(snapshot).
		FirstOrCreate(snapshot).Error
}

func GetFailedRequestSnapshotByRequestId(requestId string) (*FailedRequestSnapshot, error) {
	requestId = strings.TrimSpace(requestId)
	if requestId == "" {
		return nil, errors.New("request_id is empty")
	}
	var snapshot FailedRequestSnapshot
	err := DB.Where("request_id = ?", requestId).First(&snapshot).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		return nil, err
	}
	return &snapshot, nil
}
