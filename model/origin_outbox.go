package model

import (
	"errors"
	"fmt"
	"runtime"
	"strings"
	"time"

	"gorm.io/gorm"
)

var ErrOriginAttemptNotInProgress = errors.New("Origin request attempt is not in progress")

const (
	OriginAttemptInProgress     = "IN_PROGRESS"
	OriginAttemptSucceeded      = "SUCCEEDED"
	OriginAttemptFailed         = "FAILED"
	OriginAttemptDisconnected   = "DISCONNECTED"
	OriginAttemptReconciliation = "RECONCILIATION_REQUIRED"

	OriginContactNotContacted = "NOT_CONTACTED"
	OriginContactContacted    = "CONTACTED"
	OriginContactUnknown      = "OUTCOME_UNKNOWN"
	OriginContactCompleted    = "COMPLETED"

	OriginOutboxPending = "PENDING"
	OriginOutboxSending = "SENDING"
	OriginOutboxFailed  = "FAILED"
	OriginOutboxSent    = "SENT"
	OriginOutboxDead    = "DEAD"
)

type OriginRequestAttempt struct {
	ID              string     `gorm:"type:varchar(36);primaryKey"`
	RequestID       string     `gorm:"type:varchar(36);not null;index:idx_origin_attempt_request"`
	ReservationID   string     `gorm:"type:varchar(36);not null;index:idx_origin_attempt_reservation"`
	TenantID        string     `gorm:"type:varchar(36);not null"`
	ProjectID       string     `gorm:"type:varchar(36);not null"`
	APIKeyID        string     `gorm:"type:varchar(36);not null"`
	CatalogVersion  int64      `gorm:"not null"`
	RouteID         string     `gorm:"type:varchar(160);not null"`
	PlatformModel   string     `gorm:"type:varchar(120);not null"`
	Operation       string     `gorm:"type:varchar(24);not null;default:responses"`
	UpstreamModelID string     `gorm:"type:varchar(160);not null"`
	ChannelID       int        `gorm:"not null"`
	AttemptNumber   int        `gorm:"not null"`
	Stream          bool       `gorm:"not null"`
	Status          string     `gorm:"type:varchar(32);not null;index:idx_origin_attempt_status"`
	ContactState    string     `gorm:"type:varchar(24);not null"`
	LeaseOwner      string     `gorm:"type:varchar(100)"`
	LeaseUntil      *time.Time `gorm:"index:idx_origin_attempt_lease"`
	StartedAt       time.Time  `gorm:"not null"`
	CompletedAt     *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type OriginUsageOutbox struct {
	ID            string     `gorm:"type:varchar(36);primaryKey"`
	AttemptID     string     `gorm:"type:varchar(36);not null;uniqueIndex:idx_origin_outbox_attempt"`
	RequestID     string     `gorm:"type:varchar(36);not null;index:idx_origin_outbox_request"`
	ReservationID string     `gorm:"type:varchar(36);not null;index:idx_origin_outbox_reservation"`
	Topic         string     `gorm:"type:varchar(160);not null"`
	PartitionKey  string     `gorm:"type:varchar(160);not null"`
	Payload       string     `gorm:"type:text;not null"`
	Status        string     `gorm:"type:varchar(16);not null;index:idx_origin_outbox_claim,priority:1"`
	Attempts      int        `gorm:"not null"`
	LeaseOwner    string     `gorm:"type:varchar(100)"`
	LeaseUntil    *time.Time `gorm:"index:idx_origin_outbox_claim,priority:3"`
	NextAttemptAt *time.Time `gorm:"index:idx_origin_outbox_claim,priority:2"`
	LastErrorCode string     `gorm:"type:varchar(80)"`
	SentAt        *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func CreateOriginRequestAttempt(db *gorm.DB, attempt *OriginRequestAttempt) error {
	if db == nil || attempt == nil {
		return errors.New("Origin request attempt database or value is nil")
	}
	return db.Create(attempt).Error
}

func FinalizeOriginRequestAttempt(db *gorm.DB, attemptID, status, contactState string, completedAt time.Time, outbox *OriginUsageOutbox) error {
	if db == nil || attemptID == "" || outbox == nil {
		return errors.New("invalid Origin attempt finalization")
	}
	return db.Transaction(func(tx *gorm.DB) error {
		var attempt OriginRequestAttempt
		if err := lockForUpdate(tx).Where("id = ?", attemptID).First(&attempt).Error; err != nil {
			return err
		}
		result := tx.Model(&OriginRequestAttempt{}).
			Where("id = ? AND status = ?", attemptID, OriginAttemptInProgress).
			Updates(map[string]any{
				"status":        status,
				"contact_state": contactState,
				"completed_at":  completedAt,
				"lease_owner":   "",
				"lease_until":   nil,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrOriginAttemptNotInProgress
		}
		if outbox.AttemptID != attemptID {
			return errors.New("Origin usage outbox attempt mismatch")
		}
		if outbox.Status == "" {
			outbox.Status = OriginOutboxPending
		}
		return tx.Create(outbox).Error
	})
}

func ListStaleOriginRequestAttempts(db *gorm.DB, expiredBefore time.Time, limit int) ([]OriginRequestAttempt, error) {
	if db == nil || expiredBefore.IsZero() || limit <= 0 {
		return nil, errors.New("invalid stale Origin attempt query")
	}
	if limit > 1000 {
		limit = 1000
	}
	var attempts []OriginRequestAttempt
	err := db.Where("status = ? AND ((lease_until IS NOT NULL AND lease_until <= ?) OR (lease_until IS NULL AND started_at <= ?))", OriginAttemptInProgress, expiredBefore, expiredBefore).
		Order("started_at ASC").Order("id ASC").Limit(limit).Find(&attempts).Error
	return attempts, err
}

func ExtendOriginRequestAttemptLease(db *gorm.DB, attemptID, owner string, leaseUntil time.Time) error {
	if db == nil || attemptID == "" || owner == "" || leaseUntil.IsZero() {
		return errors.New("invalid Origin request attempt lease")
	}
	result := db.Model(&OriginRequestAttempt{}).
		Where("id = ? AND status = ? AND lease_owner = ?", attemptID, OriginAttemptInProgress, owner).
		Updates(map[string]any{"lease_until": leaseUntil, "updated_at": time.Now().UTC()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrOriginAttemptNotInProgress
	}
	return nil
}

func ClaimOriginUsageOutbox(db *gorm.DB, worker string, now time.Time, lease time.Duration, limit int) ([]OriginUsageOutbox, error) {
	if db == nil || worker == "" || lease <= 0 || limit <= 0 {
		return nil, errors.New("invalid Origin outbox claim")
	}
	if limit > 1000 {
		limit = 1000
	}
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		rows, err := claimOriginUsageOutboxOnce(db, worker, now, lease, limit)
		if err == nil {
			return rows, nil
		}
		lastErr = err
		message := strings.ToLower(err.Error())
		if !strings.Contains(message, "locked") && !strings.Contains(message, "busy") {
			return nil, err
		}
		runtime.Gosched()
	}
	return nil, lastErr
}

func claimOriginUsageOutboxOnce(db *gorm.DB, worker string, now time.Time, lease time.Duration, limit int) ([]OriginUsageOutbox, error) {
	claimed := make([]OriginUsageOutbox, 0, limit)
	err := db.Transaction(func(tx *gorm.DB) error {
		var candidates []OriginUsageOutbox
		eligible := "((status IN ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)) OR (status = ? AND lease_until <= ?))"
		if err := lockForUpdate(tx).
			Where(eligible, []string{OriginOutboxPending, OriginOutboxFailed}, now, OriginOutboxSending, now).
			Order("created_at ASC").Order("id ASC").Limit(limit).Find(&candidates).Error; err != nil {
			return err
		}
		leaseUntil := now.Add(lease)
		for _, candidate := range candidates {
			result := tx.Model(&OriginUsageOutbox{}).
				Where("id = ?", candidate.ID).
				Where(eligible, []string{OriginOutboxPending, OriginOutboxFailed}, now, OriginOutboxSending, now).
				Updates(map[string]any{
					"status":      OriginOutboxSending,
					"lease_owner": worker,
					"lease_until": leaseUntil,
					"attempts":    gorm.Expr("attempts + ?", 1),
					"updated_at":  now,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				continue
			}
			var row OriginUsageOutbox
			if err := tx.Where("id = ?", candidate.ID).First(&row).Error; err != nil {
				return err
			}
			claimed = append(claimed, row)
		}
		return nil
	})
	return claimed, err
}

func MarkOriginUsageOutboxPublished(db *gorm.DB, id, worker string, sentAt time.Time) error {
	result := db.Model(&OriginUsageOutbox{}).
		Where("id = ? AND status = ? AND lease_owner = ?", id, OriginOutboxSending, worker).
		Updates(map[string]any{
			"status":          OriginOutboxSent,
			"sent_at":         sentAt,
			"lease_owner":     "",
			"lease_until":     nil,
			"next_attempt_at": nil,
			"last_error_code": "",
			"updated_at":      sentAt,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 1 {
		return nil
	}
	var row OriginUsageOutbox
	if err := db.Select("status").Where("id = ?", id).First(&row).Error; err != nil {
		return err
	}
	if row.Status == OriginOutboxSent {
		return nil
	}
	return errors.New("Origin outbox publish lease lost")
}

func MarkOriginUsageOutboxFailure(db *gorm.DB, id, worker, errorCode string, failedAt time.Time, maxAttempts int, retryDelay time.Duration) error {
	if maxAttempts < 1 {
		return errors.New("Origin outbox max attempts must be positive")
	}
	var row OriginUsageOutbox
	return db.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("id = ?", id).First(&row).Error; err != nil {
			return err
		}
		if row.Status != OriginOutboxSending || row.LeaseOwner != worker {
			return errors.New("Origin outbox failure lease lost")
		}
		status := OriginOutboxFailed
		var nextAttemptAt *time.Time
		if row.Attempts >= maxAttempts {
			status = OriginOutboxDead
		} else {
			next := failedAt.Add(retryDelay)
			nextAttemptAt = &next
		}
		result := tx.Model(&OriginUsageOutbox{}).
			Where("id = ? AND status = ? AND lease_owner = ?", id, OriginOutboxSending, worker).
			Updates(map[string]any{
				"status":          status,
				"lease_owner":     "",
				"lease_until":     nil,
				"next_attempt_at": nextAttemptAt,
				"last_error_code": errorCode,
				"updated_at":      failedAt,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("Origin outbox failure update lost")
		}
		return nil
	})
}

func RecoverDeadOriginUsageOutbox(db *gorm.DB, id string, now time.Time) error {
	result := db.Model(&OriginUsageOutbox{}).
		Where("id = ? AND status = ?", id, OriginOutboxDead).
		Updates(map[string]any{
			"status":          OriginOutboxFailed,
			"attempts":        0,
			"lease_owner":     "",
			"lease_until":     nil,
			"next_attempt_at": now,
			"last_error_code": "",
			"updated_at":      now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return fmt.Errorf("Origin DEAD outbox row %s not found", id)
	}
	return nil
}
