package model

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const recallEmailQuotaWindowSeconds int64 = 3600

type RecallEmailQuotaWindow struct {
	WindowStartedAt int64 `json:"window_started_at" gorm:"primaryKey;autoIncrement:false"`
	Attempts        int   `json:"attempts" gorm:"not null;default:0"`
	UpdatedAt       int64 `json:"updated_at" gorm:"autoUpdateTime"`
}

type RecallEmailQuotaStatus struct {
	Limit           int   `json:"limit"`
	Used            int   `json:"used"`
	Remaining       int   `json:"remaining"`
	WindowStartedAt int64 `json:"window_started_at"`
	ResetsAt        int64 `json:"resets_at"`
	Exhausted       bool  `json:"exhausted"`
}

type RecallEmailSMTPAttempt struct {
	Quota      RecallEmailQuotaStatus
	Reserved   bool
	LeaseOwned bool
	Suppressed bool
}

var (
	recallEmailQuotaNow     = getDBTimestamp
	errRecallEmailQuotaWait = errors.New("recall email quota exhausted")
	errRecallEmailCASLost   = errors.New("recall email CAS lost")
)

func ReserveRecallEmailQuotaWithContext(ctx context.Context, limit int) (RecallEmailQuotaStatus, bool, error) {
	return reserveRecallEmailQuota(DB.WithContext(ctx), limit)
}

func BeginRecallEmailSMTPAttemptWithContext(
	ctx context.Context,
	messageID int64,
	owner string,
	expectedLeaseUntil int64,
	limit int,
) (RecallEmailSMTPAttempt, error) {
	attempt := RecallEmailSMTPAttempt{}
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := serializeRecallSQLiteWriterTx(tx, "UPDATE recall_messages SET id = id WHERE id = ?", messageID); err != nil {
			return err
		}
		var message RecallMessage
		if err := tx.Select("id", "recipient_id").
			Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ?", messageID, RecallMessageLeased, owner, expectedLeaseUntil).
			First(&message).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		attempt.LeaseOwned = true

		var recipient RecallRecipient
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", message.RecipientId).
			First(&recipient).Error; err != nil {
			return err
		}
		suppressed, reason, err := hasPersistentRecallCampaignExclusionTx(tx, recipient)
		if err != nil {
			return err
		}
		if suppressed {
			attempt.Suppressed = true
			cancelled, err := cancelSuppressedRecallEmailFlowTx(tx, message.Id, recipient.Id, owner, expectedLeaseUntil, reason)
			if err != nil {
				return err
			}
			if !cancelled {
				return nil
			}
			return nil
		}

		status, reserved, err := reserveRecallEmailQuota(tx, limit)
		if err != nil {
			return err
		}
		attempt.Quota = status
		attempt.Reserved = reserved
		if !reserved {
			return errRecallEmailQuotaWait
		}
		count, err := TransitionRecallMessagesWithEventsTx(tx, []RecallMessageTransition{{
			MessageID:          messageID,
			RecipientID:        recipient.Id,
			From:               RecallMessageLeased,
			To:                 RecallMessageSending,
			Owner:              owner,
			ExpectedLeaseUntil: expectedLeaseUntil,
			Fields: map[string]any{
				"pre_send_attempt_count": 0,
			},
		}})
		if err != nil {
			return err
		}
		if count != 1 {
			attempt.LeaseOwned = false
			attempt.Reserved = false
			return errRecallEmailCASLost
		}
		return nil
	})
	if errors.Is(err, errRecallEmailQuotaWait) {
		return attempt, nil
	}
	if errors.Is(err, errRecallEmailCASLost) {
		return attempt, nil
	}
	return attempt, err
}

func serializeRecallSQLiteWriterTx(tx *gorm.DB, sql string, args ...any) error {
	if tx.Dialector.Name() != "sqlite" {
		return nil
	}
	return tx.Exec(sql, args...).Error
}

func reserveRecallEmailQuota(db *gorm.DB, limit int) (RecallEmailQuotaStatus, bool, error) {
	now, err := recallEmailQuotaNow(db)
	if err != nil {
		return RecallEmailQuotaStatus{}, false, err
	}
	windowStartedAt := recallEmailQuotaWindowStart(now)
	window := RecallEmailQuotaWindow{WindowStartedAt: windowStartedAt}
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&window).Error; err != nil {
		return RecallEmailQuotaStatus{}, false, err
	}

	result := db.Model(&RecallEmailQuotaWindow{}).
		Where("window_started_at = ? AND attempts < ?", windowStartedAt, limit).
		Update("attempts", gorm.Expr("attempts + ?", 1))
	if result.Error != nil {
		return RecallEmailQuotaStatus{}, false, result.Error
	}

	status, err := getRecallEmailQuotaStatus(db, windowStartedAt, limit)
	if err != nil {
		return RecallEmailQuotaStatus{}, false, err
	}
	return status, result.RowsAffected == 1, nil
}

func GetRecallEmailQuotaStatusWithContext(ctx context.Context, limit int) (RecallEmailQuotaStatus, error) {
	db := DB.WithContext(ctx)
	now, err := recallEmailQuotaNow(db)
	if err != nil {
		return RecallEmailQuotaStatus{}, err
	}
	return getRecallEmailQuotaStatus(db, recallEmailQuotaWindowStart(now), limit)
}

func getRecallEmailQuotaStatus(db *gorm.DB, windowStartedAt int64, limit int) (RecallEmailQuotaStatus, error) {
	var window RecallEmailQuotaWindow
	result := db.Where("window_started_at = ?", windowStartedAt).Limit(1).Find(&window)
	if result.Error != nil && !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return RecallEmailQuotaStatus{}, result.Error
	}

	used := window.Attempts
	remaining := limit - used
	if remaining < 0 {
		remaining = 0
	}
	return RecallEmailQuotaStatus{
		Limit:           limit,
		Used:            used,
		Remaining:       remaining,
		WindowStartedAt: windowStartedAt,
		ResetsAt:        windowStartedAt + recallEmailQuotaWindowSeconds,
		Exhausted:       used >= limit,
	}, nil
}

func recallEmailQuotaWindowStart(timestamp int64) int64 {
	return timestamp / recallEmailQuotaWindowSeconds * recallEmailQuotaWindowSeconds
}
