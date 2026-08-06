package model

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	RecallDeliveryPolicyService    = "service"
	RecallDeliveryPolicyEngagement = "engagement"

	RecallLifecycleTriggerUserRegistered         = "user_registered"
	RecallLifecycleTriggerRegistrationUnused     = "registration_unused"
	RecallLifecycleTriggerQuotaLow               = "quota_low"
	RecallLifecycleTriggerQuotaExhaustedUnpaid   = "quota_exhausted_unpaid"
	RecallLifecycleTriggerPaymentFailed          = "payment_failed"
	RecallLifecycleTriggerPaymentPending         = "payment_pending"
	RecallLifecycleTriggerPaymentSucceeded       = "payment_succeeded"
	RecallLifecycleEventPending                  = "pending"
	RecallLifecycleEventProcessed                = "processed"
	RecallLifecycleEventSuppressed               = "suppressed"
	RecallLifecycleEventFailed                   = "failed"
	recallLifecycleRegistrationUnusedDelay       = 7 * 24 * time.Hour
	recallLifecyclePaymentPendingDelay           = 24 * time.Hour
	recallContinuousTriggerSlotDefaultScanPeriod = 60
)

type RecallLifecycleEvent struct {
	Id                    int64  `json:"id" gorm:"primaryKey"`
	EventType             string `json:"event_type" gorm:"type:varchar(64);not null;uniqueIndex:idx_recall_lifecycle_occurrence,priority:1;index:idx_recall_lifecycle_due,priority:1"`
	OccurrenceKeyHash     string `json:"occurrence_key_hash" gorm:"type:char(64);not null;uniqueIndex:idx_recall_lifecycle_occurrence,priority:2"`
	RecipientIdentity     string `json:"recipient_identity" gorm:"type:varchar(80);index"`
	UserId                int    `json:"user_id" gorm:"index"`
	CampaignId            int64  `json:"campaign_id" gorm:"index"`
	RecipientId           int64  `json:"recipient_id" gorm:"index"`
	EventData             string `json:"event_data" gorm:"type:text;not null"`
	Disposition           string `json:"disposition" gorm:"type:varchar(24);not null;default:pending;index;index:idx_recall_lifecycle_due,priority:2"`
	DispositionReasonCode string `json:"disposition_reason_code" gorm:"type:varchar(64)"`
	LeaseOwner            string `json:"-" gorm:"type:varchar(96);index;index:idx_recall_lifecycle_due,priority:3"`
	LeaseExpiresAt        int64  `json:"-" gorm:"index;index:idx_recall_lifecycle_due,priority:4"`
	AttemptCount          int    `json:"attempt_count" gorm:"not null;default:0"`
	NextAttemptAt         int64  `json:"next_attempt_at" gorm:"index;index:idx_recall_lifecycle_due,priority:5"`
	ProcessingStartedAt   int64  `json:"processing_started_at"`
	ProcessedAt           int64  `json:"processed_at" gorm:"index"`
	CreatedAt             int64  `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt             int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type RecallContinuousTriggerSlot struct {
	Id             int64  `json:"id" gorm:"primaryKey"`
	Trigger        string `json:"trigger" gorm:"type:varchar(64);not null;uniqueIndex:idx_recall_continuous_trigger_slot"`
	DeliveryPolicy string `json:"delivery_policy" gorm:"type:varchar(16);not null"`
	DelaySeconds   int64  `json:"delay_seconds" gorm:"not null;default:0"`
	ScanPeriod     int64  `json:"scan_period" gorm:"not null;default:60"`
	LeaseOwner     string `json:"-" gorm:"type:varchar(96);index"`
	LeaseExpiresAt int64  `json:"-" gorm:"index"`
	LastScannedAt  int64  `json:"last_scanned_at"`
	NextScanAt     int64  `json:"next_scan_at" gorm:"index"`
	CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func RecallLifecycleTriggers() []string {
	return []string{
		RecallLifecycleTriggerUserRegistered,
		RecallLifecycleTriggerRegistrationUnused,
		RecallLifecycleTriggerQuotaLow,
		RecallLifecycleTriggerQuotaExhaustedUnpaid,
		RecallLifecycleTriggerPaymentFailed,
		RecallLifecycleTriggerPaymentPending,
		RecallLifecycleTriggerPaymentSucceeded,
	}
}

func RecallLifecycleTriggerDeliveryPolicy(trigger string) string {
	switch strings.TrimSpace(trigger) {
	case RecallLifecycleTriggerRegistrationUnused, RecallLifecycleTriggerPaymentPending:
		return RecallDeliveryPolicyEngagement
	default:
		return RecallDeliveryPolicyService
	}
}

func RecallLifecycleTriggerDelay(trigger string) time.Duration {
	switch strings.TrimSpace(trigger) {
	case RecallLifecycleTriggerRegistrationUnused:
		return recallLifecycleRegistrationUnusedDelay
	case RecallLifecycleTriggerPaymentPending:
		return recallLifecyclePaymentPendingDelay
	default:
		return 0
	}
}

func RecallLifecycleOccurrenceHash(value any) (string, error) {
	encoded, err := common.Marshal(value)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(encoded)
	return fmt.Sprintf("%x", sum), nil
}

func RecallLifecycleRecipientIdentity(eventType string, occurrenceHash string) string {
	eventType = strings.TrimSpace(eventType)
	occurrenceHash = strings.TrimSpace(occurrenceHash)
	if eventType == "" || occurrenceHash == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(eventType + "|" + occurrenceHash))
	return fmt.Sprintf("occ:%x", sum)
}

func (event *RecallLifecycleEvent) BeforeCreate(tx *gorm.DB) error {
	if event == nil {
		return fmt.Errorf("recall lifecycle event is required")
	}
	event.EventType = strings.TrimSpace(event.EventType)
	event.OccurrenceKeyHash = strings.TrimSpace(event.OccurrenceKeyHash)
	if event.EventType == "" || event.OccurrenceKeyHash == "" {
		return fmt.Errorf("recall lifecycle event requires event type and occurrence key hash")
	}
	if strings.TrimSpace(event.RecipientIdentity) == "" {
		event.RecipientIdentity = RecallLifecycleRecipientIdentity(event.EventType, event.OccurrenceKeyHash)
	}
	if strings.TrimSpace(event.EventData) == "" {
		event.EventData = `{}`
	}
	if strings.TrimSpace(event.Disposition) == "" {
		event.Disposition = RecallLifecycleEventPending
	}
	return nil
}

func TryInsertRecallLifecycleEventWithContext(ctx context.Context, event *RecallLifecycleEvent) (bool, error) {
	if event == nil {
		return false, fmt.Errorf("recall lifecycle event is required")
	}
	tx := DB.WithContext(ctx)
	var result *gorm.DB
	if tx.Dialector.Name() == "mysql" {
		result = tx.Clauses(clause.Insert{Modifier: "IGNORE"}).Create(event)
	} else {
		result = tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "event_type"}, {Name: "occurrence_key_hash"}},
			DoNothing: true,
		}).Create(event)
	}
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func SeedRecallContinuousTriggerSlotsWithContext(ctx context.Context) error {
	for _, trigger := range RecallLifecycleTriggers() {
		slot := RecallContinuousTriggerSlot{
			Trigger:        trigger,
			DeliveryPolicy: RecallLifecycleTriggerDeliveryPolicy(trigger),
			DelaySeconds:   int64(RecallLifecycleTriggerDelay(trigger).Seconds()),
			ScanPeriod:     recallContinuousTriggerSlotDefaultScanPeriod,
		}
		tx := DB.WithContext(ctx)
		if tx.Dialector.Name() == "mysql" {
			if err := tx.Clauses(clause.Insert{Modifier: "IGNORE"}).Create(&slot).Error; err != nil {
				return err
			}
		} else if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "trigger"}},
			DoNothing: true,
		}).Create(&slot).Error; err != nil {
			return err
		}
		if err := DB.WithContext(ctx).Model(&RecallContinuousTriggerSlot{}).
			Where("trigger = ?", trigger).
			Updates(map[string]any{
				"delivery_policy": RecallLifecycleTriggerDeliveryPolicy(trigger),
				"delay_seconds":   int64(RecallLifecycleTriggerDelay(trigger).Seconds()),
				"scan_period":     gorm.Expr("CASE WHEN scan_period = 0 THEN ? ELSE scan_period END", recallContinuousTriggerSlotDefaultScanPeriod),
			}).Error; err != nil {
			return err
		}
	}
	return nil
}
