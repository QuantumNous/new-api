package model

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	RecallDeliveryPolicyService    = "service"
	RecallDeliveryPolicyEngagement = "engagement"

	RecallLifecycleTriggerUserRegistered             = "user_registered"
	RecallLifecycleTriggerRegistrationUnused         = "registration_unused"
	RecallLifecycleTriggerQuotaLow                   = "quota_low"
	RecallLifecycleTriggerQuotaExhaustedUnpaid       = "quota_exhausted_unpaid"
	RecallLifecycleTriggerPaymentFailed              = "payment_failed"
	RecallLifecycleTriggerPaymentPending             = "payment_pending"
	RecallLifecycleTriggerPaymentSucceeded           = "payment_succeeded"
	RecallLifecycleEventPending                      = "pending"
	RecallLifecycleEventLeased                       = "leased"
	RecallLifecycleEventEnrolled                     = "enrolled"
	RecallLifecycleEventSkipped                      = "skipped"
	RecallLifecycleEventProcessed                    = "processed"
	RecallLifecycleEventSuppressed                   = "suppressed"
	RecallLifecycleEventFailed                       = "failed"
	recallLifecycleRegistrationUnusedDelay           = 7 * 24 * time.Hour
	recallLifecyclePaymentPendingDelay               = 24 * time.Hour
	recallContinuousTriggerSlotDefaultScanPeriod     = 60
	recallLifecycleBusinessKeyMaxLen                 = 160
	OptionKeyRecallLifecycleEventCollectionStartedAt = "recall_campaign_setting.lifecycle_event_collection_started_at"
)

type RecallLifecycleEvent struct {
	Id                    int64  `json:"id" gorm:"primaryKey;index:idx_recall_lifecycle_due,priority:5"`
	EventType             string `json:"event_type" gorm:"type:varchar(64);not null;uniqueIndex:idx_recall_lifecycle_occurrence,priority:1;index:idx_recall_lifecycle_due,priority:1"`
	OccurrenceKeyHash     string `json:"occurrence_key_hash" gorm:"type:char(64);not null;uniqueIndex:idx_recall_lifecycle_occurrence,priority:2"`
	ScopeType             string `json:"scope_type" gorm:"type:varchar(32);index"`
	ScopeId               string `json:"scope_id" gorm:"type:varchar(128);index"`
	BusinessKey           string `json:"business_key" gorm:"type:varchar(160);index"`
	RecipientIdentity     string `json:"recipient_identity" gorm:"type:varchar(80);index"`
	UserId                int    `json:"user_id" gorm:"index"`
	CampaignId            int64  `json:"campaign_id" gorm:"index"`
	RecipientId           int64  `json:"recipient_id" gorm:"index"`
	EventData             string `json:"event_data" gorm:"type:text;not null"`
	Disposition           string `json:"disposition" gorm:"type:varchar(24);not null;default:pending;index;index:idx_recall_lifecycle_due,priority:2"`
	DispositionReasonCode string `json:"disposition_reason_code" gorm:"type:varchar(64)"`
	OccurredAt            int64  `json:"occurred_at" gorm:"index;index:idx_recall_lifecycle_due,priority:4"`
	AvailableAt           int64  `json:"available_at" gorm:"index;index:idx_recall_lifecycle_due,priority:3"`
	SchemaVersion         int    `json:"schema_version" gorm:"not null;default:1"`
	LeaseOwner            string `json:"-" gorm:"type:varchar(96);index"`
	LeaseExpiresAt        int64  `json:"-" gorm:"index"`
	LeaseEpoch            int64  `json:"-"`
	AttemptCount          int    `json:"attempt_count" gorm:"not null;default:0"`
	NextAttemptAt         int64  `json:"next_attempt_at" gorm:"index"`
	ProcessingStartedAt   int64  `json:"processing_started_at"`
	ProcessedAt           int64  `json:"processed_at" gorm:"index"`
	LastErrorCode         string `json:"last_error_code" gorm:"type:varchar(64)"`
	ResolvedAt            int64  `json:"resolved_at" gorm:"index"`
	CreatedAt             int64  `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt             int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type RecallLifecycleEventEnrollmentResolution struct {
	EventID              int64
	Owner                string
	LeaseEpoch           int64
	ExpectedLeaseExpires int64
	CampaignID           int64
	RecipientID          int64
	ResolvedAt           int64
}

type RecallLifecycleEventDeferral struct {
	EventID              int64
	Owner                string
	LeaseEpoch           int64
	ExpectedLeaseExpires int64
	ErrorCode            string
}

type RecallContinuousTriggerSlot struct {
	Trigger        string `json:"trigger" gorm:"type:varchar(64);primaryKey"`
	CampaignId     int64  `json:"campaign_id" gorm:"index;not null;default:0"`
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

type RecallLifecycleOccurrence struct {
	Canonical string
	Hash      string
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

func ValidateRecallLifecycleTrigger(trigger string) error {
	switch strings.TrimSpace(trigger) {
	case RecallLifecycleTriggerUserRegistered,
		RecallLifecycleTriggerRegistrationUnused,
		RecallLifecycleTriggerQuotaLow,
		RecallLifecycleTriggerQuotaExhaustedUnpaid,
		RecallLifecycleTriggerPaymentFailed,
		RecallLifecycleTriggerPaymentPending,
		RecallLifecycleTriggerPaymentSucceeded:
		return nil
	default:
		return fmt.Errorf("unsupported recall lifecycle trigger %q", strings.TrimSpace(trigger))
	}
}

func RecallLifecycleTriggerDeliveryPolicy(trigger string) (string, error) {
	trigger = strings.TrimSpace(trigger)
	if err := ValidateRecallLifecycleTrigger(trigger); err != nil {
		return "", err
	}
	switch trigger {
	case RecallLifecycleTriggerRegistrationUnused, RecallLifecycleTriggerPaymentPending:
		return RecallDeliveryPolicyEngagement, nil
	default:
		return RecallDeliveryPolicyService, nil
	}
}

func RecallLifecycleTriggerDelay(trigger string) (time.Duration, error) {
	trigger = strings.TrimSpace(trigger)
	if err := ValidateRecallLifecycleTrigger(trigger); err != nil {
		return 0, err
	}
	switch trigger {
	case RecallLifecycleTriggerRegistrationUnused:
		return recallLifecycleRegistrationUnusedDelay, nil
	case RecallLifecycleTriggerPaymentPending:
		return recallLifecyclePaymentPendingDelay, nil
	default:
		return 0, nil
	}
}

func recallLifecycleOccurrenceHash(canonical string) string {
	sum := sha256.Sum256([]byte(canonical))
	return fmt.Sprintf("%x", sum)
}

func NewRecallLifecycleUserOccurrence(trigger string, userID int) (RecallLifecycleOccurrence, error) {
	trigger = strings.TrimSpace(trigger)
	if trigger != RecallLifecycleTriggerUserRegistered && trigger != RecallLifecycleTriggerRegistrationUnused {
		return RecallLifecycleOccurrence{}, fmt.Errorf("unsupported user lifecycle trigger %q", trigger)
	}
	if userID <= 0 {
		return RecallLifecycleOccurrence{}, fmt.Errorf("user lifecycle occurrence requires a positive user id")
	}
	return newRecallLifecycleOccurrence(fmt.Sprintf("v1|%s|user:%d", trigger, userID)), nil
}

func NewRecallLifecycleQuotaOccurrence(trigger string, scopeType string, scopeID string, cycle string, userID int) (RecallLifecycleOccurrence, error) {
	trigger = strings.TrimSpace(trigger)
	if trigger != RecallLifecycleTriggerQuotaLow && trigger != RecallLifecycleTriggerQuotaExhaustedUnpaid {
		return RecallLifecycleOccurrence{}, fmt.Errorf("unsupported quota lifecycle trigger %q", trigger)
	}
	scopeType = strings.TrimSpace(scopeType)
	scopeID = strings.TrimSpace(scopeID)
	cycle = strings.TrimSpace(cycle)
	if scopeType == "" || scopeID == "" || cycle == "" || userID <= 0 {
		return RecallLifecycleOccurrence{}, fmt.Errorf("quota lifecycle occurrence requires scope type/id, cycle, and positive user id")
	}
	return newRecallLifecycleOccurrence(fmt.Sprintf("v1|%s|%s:%s|cycle:%s|user:%d", trigger, scopeType, scopeID, cycle, userID)), nil
}

func NewRecallLifecyclePurchaseOccurrence(trigger string, purchaseKind string, tradeNo string, sourceTable string, sourceID int64, userID int) (RecallLifecycleOccurrence, error) {
	_ = userID
	trigger = strings.TrimSpace(trigger)
	switch trigger {
	case RecallLifecycleTriggerPaymentFailed, RecallLifecycleTriggerPaymentPending, RecallLifecycleTriggerPaymentSucceeded:
	default:
		return RecallLifecycleOccurrence{}, fmt.Errorf("unsupported purchase lifecycle trigger %q", trigger)
	}
	purchaseKind = strings.TrimSpace(purchaseKind)
	tradeNo = strings.TrimSpace(tradeNo)
	sourceTable = strings.TrimSpace(sourceTable)
	if purchaseKind == "" {
		return RecallLifecycleOccurrence{}, fmt.Errorf("purchase lifecycle occurrence requires purchase kind")
	}
	if tradeNo != "" {
		return newRecallLifecycleOccurrence(fmt.Sprintf("v1|%s|%s|trade:%s", trigger, purchaseKind, tradeNo)), nil
	}
	if sourceTable == "" || sourceID <= 0 {
		return RecallLifecycleOccurrence{}, fmt.Errorf("purchase lifecycle occurrence requires trade number or stable source reference")
	}
	return newRecallLifecycleOccurrence(fmt.Sprintf("v1|%s|%s|source:%s:%d", trigger, purchaseKind, sourceTable, sourceID)), nil
}

func newRecallLifecycleOccurrence(canonical string) RecallLifecycleOccurrence {
	return RecallLifecycleOccurrence{
		Canonical: canonical,
		Hash:      recallLifecycleOccurrenceHash(canonical),
	}
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
	event.BusinessKey = strings.TrimSpace(event.BusinessKey)
	if strings.TrimSpace(event.EventType) == "" || strings.TrimSpace(event.OccurrenceKeyHash) == "" {
		return fmt.Errorf("recall lifecycle event requires event type and occurrence key hash")
	}
	if event.EventType != strings.TrimSpace(event.EventType) {
		return fmt.Errorf("recall lifecycle event type must be canonical")
	}
	if err := ValidateRecallLifecycleTrigger(event.EventType); err != nil {
		return err
	}
	if err := validateRecallLifecycleOccurrenceHash(event.OccurrenceKeyHash); err != nil {
		return err
	}
	if len(event.BusinessKey) > recallLifecycleBusinessKeyMaxLen {
		return fmt.Errorf("recall lifecycle event business key exceeds %d characters", recallLifecycleBusinessKeyMaxLen)
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
	if event.SchemaVersion == 0 {
		event.SchemaVersion = 1
	}
	return nil
}

func validateRecallLifecycleOccurrenceHash(hash string) error {
	if len(hash) != 64 {
		return fmt.Errorf("recall lifecycle event occurrence key hash must be exactly 64 lowercase hexadecimal characters")
	}
	for _, char := range hash {
		if (char < '0' || char > '9') && (char < 'a' || char > 'f') {
			return fmt.Errorf("recall lifecycle event occurrence key hash must be exactly 64 lowercase hexadecimal characters")
		}
	}
	return nil
}

func TryInsertRecallLifecycleEventWithContext(ctx context.Context, event *RecallLifecycleEvent) (bool, error) {
	if event == nil {
		return false, fmt.Errorf("recall lifecycle event is required")
	}
	result := insertRecallLifecycleEvent(DB.WithContext(ctx), event)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func ListDueRecallLifecycleEvents(ctx context.Context, now int64, limit int) ([]RecallLifecycleEvent, error) {
	events := make([]RecallLifecycleEvent, 0)
	if ctx == nil {
		return events, fmt.Errorf("context is nil")
	}
	if limit <= 0 {
		return events, nil
	}
	marker, err := GetRecallLifecycleEventCollectionStartedAtWithContext(ctx)
	if err != nil {
		return events, err
	}
	err = DB.WithContext(ctx).
		Model(&RecallLifecycleEvent{}).
		Select("recall_lifecycle_events.*").
		Joins("JOIN recall_continuous_trigger_slots ON recall_continuous_trigger_slots.trigger = recall_lifecycle_events.event_type").
		Joins("JOIN recall_campaigns ON recall_campaigns.id = recall_continuous_trigger_slots.campaign_id").
		Where("recall_campaigns.execution_mode = ? AND recall_campaigns.status = ?", "continuous", RecallCampaignRunning).
		Where("recall_campaigns.lifecycle_trigger = recall_lifecycle_events.event_type").
		Where("recall_lifecycle_events.occurred_at >= ?", marker).
		Where("recall_lifecycle_events.available_at >= recall_campaigns.processing_start_at").
		Where("recall_lifecycle_events.available_at <= ?", now).
		Where("(recall_lifecycle_events.next_attempt_at = 0 OR recall_lifecycle_events.next_attempt_at <= ?)", now).
		Where("(recall_lifecycle_events.disposition = ? OR (recall_lifecycle_events.disposition = ? AND recall_lifecycle_events.lease_expires_at > 0 AND recall_lifecycle_events.lease_expires_at < ?))",
			RecallLifecycleEventPending, RecallLifecycleEventLeased, now).
		Order("recall_lifecycle_events.available_at ASC").
		Order("recall_lifecycle_events.occurred_at ASC").
		Order("recall_lifecycle_events.id ASC").
		Limit(limit).
		Find(&events).Error
	return events, err
}

func ClaimDueRecallLifecycleEvent(ctx context.Context, id int64, owner string, now int64, leaseUntil int64) (*RecallLifecycleEvent, bool, error) {
	owner = strings.TrimSpace(owner)
	if ctx == nil {
		return nil, false, fmt.Errorf("context is nil")
	}
	if id <= 0 || owner == "" || leaseUntil <= now {
		return nil, false, fmt.Errorf("recall lifecycle event claim requires id, owner, and future lease")
	}
	var claimed RecallLifecycleEvent
	won := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var event RecallLifecycleEvent
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND ((disposition = ? AND available_at <= ? AND (next_attempt_at = 0 OR next_attempt_at <= ?)) OR (disposition = ? AND lease_expires_at > 0 AND lease_expires_at < ?))",
				id, RecallLifecycleEventPending, now, now, RecallLifecycleEventLeased, now).
			First(&event).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		result := tx.Model(&RecallLifecycleEvent{}).
			Where("id = ? AND disposition = ? AND lease_epoch = ?", event.Id, event.Disposition, event.LeaseEpoch).
			Updates(map[string]any{
				"disposition":           RecallLifecycleEventLeased,
				"lease_owner":           owner,
				"lease_expires_at":      leaseUntil,
				"lease_epoch":           gorm.Expr("lease_epoch + ?", 1),
				"attempt_count":         gorm.Expr("attempt_count + ?", 1),
				"processing_started_at": now,
				"last_error_code":       "",
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return nil
		}
		if err := tx.First(&claimed, event.Id).Error; err != nil {
			return err
		}
		won = true
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	if !won {
		return nil, false, nil
	}
	return &claimed, true, nil
}

func ResolveRecallLifecycleEventEnrollment(ctx context.Context, resolution RecallLifecycleEventEnrollmentResolution) (bool, error) {
	if ctx == nil {
		return false, fmt.Errorf("context is nil")
	}
	if resolution.EventID <= 0 || strings.TrimSpace(resolution.Owner) == "" || resolution.LeaseEpoch <= 0 || resolution.ExpectedLeaseExpires <= 0 || resolution.CampaignID <= 0 || resolution.RecipientID <= 0 {
		return false, fmt.Errorf("recall lifecycle event enrollment resolution requires event, owner, epoch, campaign, and recipient")
	}
	resolved := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		dbNow, err := getDBTimestamp(tx)
		if err != nil {
			return err
		}
		result := tx.Model(&RecallLifecycleEvent{}).
			Where("id = ? AND disposition = ? AND lease_owner = ? AND lease_epoch = ? AND lease_expires_at = ? AND lease_expires_at > ?",
				resolution.EventID, RecallLifecycleEventLeased, strings.TrimSpace(resolution.Owner), resolution.LeaseEpoch, resolution.ExpectedLeaseExpires, dbNow).
			Updates(map[string]any{
				"disposition":             RecallLifecycleEventEnrolled,
				"disposition_reason_code": "",
				"campaign_id":             resolution.CampaignID,
				"recipient_id":            resolution.RecipientID,
				"processed_at":            resolution.ResolvedAt,
				"resolved_at":             resolution.ResolvedAt,
				"lease_owner":             "",
				"lease_expires_at":        int64(0),
				"last_error_code":         "",
			})
		if result.Error != nil {
			return result.Error
		}
		resolved = result.RowsAffected == 1
		return nil
	})
	if err != nil {
		return false, err
	}
	return resolved, nil
}

func SkipRecallLifecycleEvent(ctx context.Context, id int64, owner string, leaseEpoch int64, expectedLeaseExpires int64, reasonCode string) (bool, error) {
	reasonCode = sanitizeRecallErrorCode(reasonCode)
	if reasonCode == "" {
		reasonCode = "lifecycle_skipped"
	}
	skipped := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		dbNow, err := getDBTimestamp(tx)
		if err != nil {
			return err
		}
		result := tx.Model(&RecallLifecycleEvent{}).
			Where("id = ? AND disposition = ? AND lease_owner = ? AND lease_epoch = ? AND lease_expires_at = ? AND lease_expires_at > ?",
				id, RecallLifecycleEventLeased, strings.TrimSpace(owner), leaseEpoch, expectedLeaseExpires, dbNow).
			Updates(map[string]any{
				"disposition":             RecallLifecycleEventSkipped,
				"disposition_reason_code": reasonCode,
				"last_error_code":         reasonCode,
				"resolved_at":             dbNow,
				"lease_owner":             "",
				"lease_expires_at":        int64(0),
			})
		if result.Error != nil {
			return result.Error
		}
		skipped = result.RowsAffected == 1
		return nil
	})
	if err != nil {
		return false, err
	}
	return skipped, nil
}

func DeferRecallLifecycleEvent(ctx context.Context, deferral RecallLifecycleEventDeferral) (bool, error) {
	if ctx == nil {
		return false, fmt.Errorf("context is nil")
	}
	if deferral.EventID <= 0 || strings.TrimSpace(deferral.Owner) == "" || deferral.LeaseEpoch <= 0 || deferral.ExpectedLeaseExpires <= 0 {
		return false, fmt.Errorf("recall lifecycle event deferral requires event, owner, epoch, and expected lease")
	}
	errorCode := sanitizeRecallErrorCode(deferral.ErrorCode)
	if errorCode == "" {
		errorCode = "lifecycle_retry"
	}
	deferred := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		dbNow, err := getDBTimestamp(tx)
		if err != nil {
			return err
		}
		var event RecallLifecycleEvent
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND disposition = ? AND lease_owner = ? AND lease_epoch = ? AND lease_expires_at = ? AND lease_expires_at > ?",
				deferral.EventID, RecallLifecycleEventLeased, strings.TrimSpace(deferral.Owner), deferral.LeaseEpoch, deferral.ExpectedLeaseExpires, dbNow).
			First(&event).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		nextAttemptAt := dbNow + recallLifecycleRetryBackoffSeconds(event.AttemptCount)
		result := tx.Model(&RecallLifecycleEvent{}).
			Where("id = ? AND disposition = ? AND lease_owner = ? AND lease_epoch = ? AND lease_expires_at = ? AND lease_expires_at > ?",
				event.Id, RecallLifecycleEventLeased, strings.TrimSpace(deferral.Owner), deferral.LeaseEpoch, deferral.ExpectedLeaseExpires, dbNow).
			Updates(map[string]any{
				"disposition":      RecallLifecycleEventPending,
				"lease_owner":      "",
				"lease_expires_at": int64(0),
				"next_attempt_at":  nextAttemptAt,
				"last_error_code":  errorCode,
			})
		if result.Error != nil {
			return result.Error
		}
		deferred = result.RowsAffected == 1
		return nil
	})
	if err != nil {
		return false, err
	}
	return deferred, nil
}

func recallLifecycleRetryBackoffSeconds(attemptCount int) int64 {
	if attemptCount < 1 {
		attemptCount = 1
	}
	backoff := int64(60)
	for i := 1; i < attemptCount && backoff < 3600; i++ {
		backoff *= 2
	}
	if backoff > 3600 {
		return 3600
	}
	return backoff
}

func insertRecallLifecycleEvent(tx *gorm.DB, event *RecallLifecycleEvent) *gorm.DB {
	if tx.Dialector.Name() == "mysql" {
		return tx.Clauses(clause.OnConflict{
			DoUpdates: clause.Assignments(map[string]any{
				"id": gorm.Expr("id"),
			}),
		}).Create(event)
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "event_type"}, {Name: "occurrence_key_hash"}},
		DoNothing: true,
	}).Create(event)
}

func newRecallContinuousTriggerSlot(trigger string) (*RecallContinuousTriggerSlot, error) {
	trigger = strings.TrimSpace(trigger)
	if trigger == "" {
		return nil, fmt.Errorf("recall continuous trigger slot repair requires a trigger")
	}
	if err := ValidateRecallLifecycleTrigger(trigger); err != nil {
		return nil, err
	}
	deliveryPolicy, err := RecallLifecycleTriggerDeliveryPolicy(trigger)
	if err != nil {
		return nil, err
	}
	delay, err := RecallLifecycleTriggerDelay(trigger)
	if err != nil {
		return nil, err
	}
	return &RecallContinuousTriggerSlot{
		Trigger:        trigger,
		CampaignId:     0,
		DeliveryPolicy: deliveryPolicy,
		DelaySeconds:   int64(delay.Seconds()),
		ScanPeriod:     recallContinuousTriggerSlotDefaultScanPeriod,
	}, nil
}

func insertRecallContinuousTriggerSlot(tx *gorm.DB, slot *RecallContinuousTriggerSlot) *gorm.DB {
	if tx.Dialector.Name() == "mysql" {
		return tx.Clauses(clause.OnConflict{
			DoUpdates: clause.Assignments(map[string]any{
				"trigger": gorm.Expr("`trigger`"),
			}),
		}).Create(slot)
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "trigger"}},
		DoNothing: true,
	}).Create(slot)
}

func SeedRecallContinuousTriggerSlotsWithContext(ctx context.Context) error {
	for _, trigger := range RecallLifecycleTriggers() {
		if err := EnsureRecallContinuousTriggerSlotTx(DB.WithContext(ctx), trigger); err != nil {
			return err
		}
	}
	return nil
}

func GetRecallLifecycleEventCollectionStartedAtWithContext(ctx context.Context) (int64, error) {
	if ctx == nil {
		return 0, fmt.Errorf("context is nil")
	}
	var option Option
	if err := DB.WithContext(ctx).First(&option, "key = ?", OptionKeyRecallLifecycleEventCollectionStartedAt).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return 0, fmt.Errorf("recall lifecycle event collection marker is missing")
		}
		return 0, err
	}
	startedAt, err := strconv.ParseInt(strings.TrimSpace(option.Value), 10, 64)
	if err != nil || startedAt <= 0 {
		return 0, fmt.Errorf("recall lifecycle event collection marker is malformed")
	}
	return startedAt, nil
}

func InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(ctx context.Context) (int64, error) {
	if ctx == nil {
		return 0, fmt.Errorf("context is nil")
	}
	var startedAt int64
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		dbNow, err := getDBTimestamp(tx)
		if err != nil {
			return err
		}
		option := &Option{
			Key:   OptionKeyRecallLifecycleEventCollectionStartedAt,
			Value: strconv.FormatInt(dbNow, 10),
		}
		if err := insertRecallLifecycleCollectionMarker(tx, option).Error; err != nil {
			return err
		}
		var stored Option
		if err := tx.First(&stored, "key = ?", OptionKeyRecallLifecycleEventCollectionStartedAt).Error; err != nil {
			return err
		}
		parsed, parseErr := strconv.ParseInt(strings.TrimSpace(stored.Value), 10, 64)
		if parseErr != nil || parsed <= 0 {
			return fmt.Errorf("recall lifecycle event collection marker is malformed")
		}
		startedAt = parsed
		return nil
	})
	return startedAt, err
}

func insertRecallLifecycleCollectionMarker(tx *gorm.DB, option *Option) *gorm.DB {
	if tx.Dialector.Name() == "mysql" {
		return tx.Clauses(clause.OnConflict{
			DoUpdates: clause.Assignments(map[string]any{
				"key": gorm.Expr("`key`"),
			}),
		}).Create(option)
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoNothing: true,
	}).Create(option)
}

func EnsureRecallContinuousTriggerSlotTx(tx *gorm.DB, trigger string) error {
	if tx == nil {
		return fmt.Errorf("recall continuous trigger slot repair requires a transaction")
	}
	slot, err := newRecallContinuousTriggerSlot(trigger)
	if err != nil {
		return err
	}
	if err := insertRecallContinuousTriggerSlot(tx, slot).Error; err != nil {
		return err
	}
	return tx.Model(&RecallContinuousTriggerSlot{}).
		Where("trigger = ?", slot.Trigger).
		Updates(map[string]any{
			"delivery_policy": slot.DeliveryPolicy,
			"delay_seconds":   slot.DelaySeconds,
			"scan_period":     gorm.Expr("CASE WHEN scan_period = 0 THEN ? ELSE scan_period END", recallContinuousTriggerSlotDefaultScanPeriod),
		}).Error
}

func ClaimRecallContinuousTriggerSlotTx(tx *gorm.DB, trigger string, campaignID int64) (bool, error) {
	claimed, _, err := ClaimRecallContinuousTriggerSlotOwnershipTx(tx, trigger, campaignID)
	return claimed, err
}

func ClaimRecallContinuousTriggerSlotOwnershipTx(tx *gorm.DB, trigger string, campaignID int64) (bool, bool, error) {
	if tx == nil {
		return false, false, fmt.Errorf("recall continuous trigger slot claim requires a transaction")
	}
	if campaignID <= 0 {
		return false, false, fmt.Errorf("recall continuous trigger slot claim requires a campaign")
	}
	if err := EnsureRecallContinuousTriggerSlotTx(tx, trigger); err != nil {
		return false, false, err
	}
	var slot RecallContinuousTriggerSlot
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&slot, "trigger = ?", strings.TrimSpace(trigger)).Error; err != nil {
		return false, false, err
	}
	if slot.CampaignId == campaignID {
		return true, false, nil
	}
	if slot.CampaignId != 0 {
		return false, false, nil
	}
	result := tx.Model(&RecallContinuousTriggerSlot{}).
		Where("trigger = ? AND campaign_id = 0", slot.Trigger).
		Update("campaign_id", campaignID)
	if result.Error != nil {
		return false, false, result.Error
	}
	if result.RowsAffected == 1 {
		return true, true, nil
	}
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&slot, "trigger = ?", strings.TrimSpace(trigger)).Error; err != nil {
		return false, false, err
	}
	return slot.CampaignId == campaignID, false, nil
}

func ReleaseRecallContinuousTriggerSlotTx(tx *gorm.DB, trigger string, campaignID int64) error {
	if tx == nil {
		return fmt.Errorf("recall continuous trigger slot release requires a transaction")
	}
	if campaignID <= 0 {
		return fmt.Errorf("recall continuous trigger slot release requires a campaign")
	}
	return tx.Model(&RecallContinuousTriggerSlot{}).
		Where("trigger = ? AND campaign_id = ?", strings.TrimSpace(trigger), campaignID).
		Update("campaign_id", int64(0)).Error
}
