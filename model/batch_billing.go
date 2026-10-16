package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	BatchBillingStatusPending   = "pending"
	BatchBillingStatusSucceeded = "succeeded"
)

// BatchBillingRecord makes batch platform charges idempotent: a request_id is
// charged at most once. A pending record marks a charge that is in progress
// (or was interrupted after the funds were reserved) and is never retried.
type BatchBillingRecord struct {
	Id            int    `json:"id"`
	RequestId     string `json:"request_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId        int    `json:"user_id" gorm:"index"`
	TokenId       int    `json:"token_id" gorm:"index"`
	ModelName     string `json:"model_name" gorm:"type:varchar(255)"`
	Quota         int    `json:"quota"`
	BillingSource string `json:"billing_source" gorm:"type:varchar(32)"`
	Status        string `json:"status" gorm:"type:varchar(16)"`
	OperatorId    int    `json:"operator_id"`
	CreatedAt     int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt     int64  `json:"updated_at" gorm:"bigint"`
}

// ClaimBatchBillingRecord inserts record as pending. When its request_id was
// already claimed it returns the existing record and claimed=false. The
// unique index decides ownership; the duplicate is read back instead of
// parsing driver-specific duplicate-key errors.
func ClaimBatchBillingRecord(record *BatchBillingRecord) (existing *BatchBillingRecord, claimed bool, err error) {
	now := common.GetTimestamp()
	record.Status = BatchBillingStatusPending
	record.CreatedAt = now
	record.UpdatedAt = now
	createErr := DB.Create(record).Error
	if createErr == nil {
		return record, true, nil
	}
	var found BatchBillingRecord
	if err := DB.Where("request_id = ?", record.RequestId).First(&found).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, createErr
		}
		return nil, false, err
	}
	return &found, false, nil
}

// CompleteBatchBillingRecord marks a claimed record as charged.
func CompleteBatchBillingRecord(record *BatchBillingRecord) error {
	record.Status = BatchBillingStatusSucceeded
	record.UpdatedAt = common.GetTimestamp()
	return DB.Model(&BatchBillingRecord{}).Where("id = ? AND status = ?", record.Id, BatchBillingStatusPending).Updates(map[string]any{
		"status":         record.Status,
		"quota":          record.Quota,
		"billing_source": record.BillingSource,
		"updated_at":     record.UpdatedAt,
	}).Error
}

// ReleaseBatchBillingRecord removes a pending claim whose charge was rejected
// before any funds moved, so the platform may retry the same request_id.
func ReleaseBatchBillingRecord(id int) error {
	return DB.Where("id = ? AND status = ?", id, BatchBillingStatusPending).Delete(&BatchBillingRecord{}).Error
}
