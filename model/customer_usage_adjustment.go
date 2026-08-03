package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

const (
	CustomerUsageAdjustmentEventRefund           = "REFUND"
	CustomerUsageAdjustmentEventReversal         = "REVERSAL"
	CustomerUsageAdjustmentEventManualAdjustment = "MANUAL_ADJUSTMENT"
)

// CustomerUsageAdjustment is an explicit, append-only correction fact for the
// Customer Billing API. It intentionally does not derive data from LogTypeRefund:
// older refund logs lack a stable link to the original consumption transaction.
type CustomerUsageAdjustment struct {
	Id                  int    `json:"id"`
	AdjustmentID        string `json:"adjustment_id" gorm:"type:varchar(191);uniqueIndex"`
	CustomerID          int    `json:"customer_id" gorm:"index:idx_customer_usage_adjustments_customer_occurred_id,priority:1"`
	EventType           string `json:"event_type" gorm:"type:varchar(32)"`
	SourceTransactionID string `json:"source_transaction_id" gorm:"type:varchar(191);index"`
	AmountDeltaQuota    int64  `json:"amount_delta_quota"`
	ReasonCode          string `json:"reason_code" gorm:"type:varchar(64)"`
	OccurredAt          int64  `json:"occurred_at" gorm:"index:idx_customer_usage_adjustments_customer_occurred_id,priority:2"`
	CreatedAt           int64  `json:"created_at" gorm:"autoCreateTime"`
}

func CreateCustomerUsageAdjustment(adjustment *CustomerUsageAdjustment) error {
	if adjustment == nil || adjustment.CustomerID <= 0 || strings.TrimSpace(adjustment.AdjustmentID) == "" ||
		!isCustomerUsageAdjustmentEventType(adjustment.EventType) || strings.TrimSpace(adjustment.ReasonCode) == "" ||
		adjustment.OccurredAt <= 0 || adjustment.AmountDeltaQuota == 0 {
		return errors.New("invalid customer usage adjustment")
	}
	if err := validateCustomerUsageAdjustmentSource(adjustment); err != nil {
		return err
	}
	createErr := LOG_DB.Create(adjustment).Error
	if createErr == nil {
		return nil
	}

	// A producer may retry after an unknown result. The immutable adjustment ID
	// makes a byte-for-byte replay safe, while a conflicting duplicate is rejected.
	var existing CustomerUsageAdjustment
	if err := LOG_DB.Where("adjustment_id = ?", adjustment.AdjustmentID).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return createErr
		}
		return err
	}
	if sameCustomerUsageAdjustment(&existing, adjustment) {
		adjustment.Id = existing.Id
		return nil
	}
	return fmt.Errorf("customer usage adjustment id already exists with different immutable fields")
}

func isCustomerUsageAdjustmentEventType(eventType string) bool {
	switch eventType {
	case CustomerUsageAdjustmentEventRefund, CustomerUsageAdjustmentEventReversal, CustomerUsageAdjustmentEventManualAdjustment:
		return true
	default:
		return false
	}
}

func validateCustomerUsageAdjustmentSource(adjustment *CustomerUsageAdjustment) error {
	if strings.TrimSpace(adjustment.SourceTransactionID) == "" {
		return nil
	}
	sourceID, err := strconv.Atoi(adjustment.SourceTransactionID)
	if err != nil || sourceID <= 0 {
		return errors.New("invalid source transaction id")
	}
	var log Log
	err = LOG_DB.Where("id = ? AND user_id = ? AND type = ?", sourceID, adjustment.CustomerID, LogTypeConsume).First(&log).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return errors.New("source transaction does not belong to customer")
	}
	return err
}

func sameCustomerUsageAdjustment(a, b *CustomerUsageAdjustment) bool {
	return a.AdjustmentID == b.AdjustmentID &&
		a.CustomerID == b.CustomerID &&
		a.EventType == b.EventType &&
		a.SourceTransactionID == b.SourceTransactionID &&
		a.AmountDeltaQuota == b.AmountDeltaQuota &&
		a.ReasonCode == b.ReasonCode &&
		a.OccurredAt == b.OccurredAt
}

func QueryCustomerUsageAdjustmentsAfterCursor(customerID int, startUnix, endUnix int64, limit int, cursorOccurredAt int64, cursorID int) ([]*CustomerUsageAdjustment, error) {
	if customerID <= 0 {
		return nil, errors.New("customer id must be positive")
	}
	var adjustments []*CustomerUsageAdjustment
	err := LOG_DB.Where("customer_id = ? AND occurred_at >= ? AND occurred_at < ?", customerID, startUnix, endUnix).
		Where("occurred_at >= ?", cursorOccurredAt).
		Where("(occurred_at > ? OR (occurred_at = ? AND id > ?))", cursorOccurredAt, cursorOccurredAt, cursorID).
		Order("occurred_at asc, id asc").
		Limit(limit).
		Find(&adjustments).Error
	return adjustments, err
}

func IsCustomerUsageAdjustmentNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
