package model

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const recallEmailQuotaWindowSeconds int64 = 3600
const (
	recallEmailPacingScope      = "activity_email"
	recallEmailPacingHourMillis = int64(3_600_000)
)

type RecallEmailQuotaWindow struct {
	WindowStartedAt int64 `json:"window_started_at" gorm:"primaryKey;autoIncrement:false"`
	Attempts        int   `json:"attempts" gorm:"not null;default:0"`
	UpdatedAt       int64 `json:"updated_at" gorm:"autoUpdateTime"`
}

type RecallEmailPacingState struct {
	Scope               string `json:"scope" gorm:"primaryKey;size:64"`
	LastStartedAtMillis int64  `json:"last_started_at_millis" gorm:"not null;default:0"`
	UpdatedAt           int64  `json:"updated_at" gorm:"autoUpdateTime:milli"`
}

type RecallEmailQuotaStatus struct {
	Limit           int   `json:"limit"`
	Used            int   `json:"used"`
	Remaining       int   `json:"remaining"`
	WindowStartedAt int64 `json:"window_started_at"`
	ResetsAt        int64 `json:"resets_at"`
	Exhausted       bool  `json:"exhausted"`
}

type RecallEmailPacingStatus struct {
	Scope               string `json:"scope"`
	CheckedAtMillis     int64  `json:"checked_at_millis"`
	LastStartedAtMillis int64  `json:"last_started_at_millis"`
	NextAllowedAtMillis int64  `json:"next_allowed_at_millis"`
	IntervalMillis      int64  `json:"interval_millis"`
	Allowed             bool   `json:"allowed"`
}

type RecallEmailSMTPAttempt struct {
	Quota      RecallEmailQuotaStatus
	Pacing     RecallEmailPacingStatus
	Reserved   bool
	LeaseOwned bool
	Suppressed bool
	Email      string
}

var (
	recallEmailQuotaNow        = getDBTimestamp
	recallEmailPacingNowMillis = getDBTimestampMillis
	errRecallEmailPacingWait   = errors.New("recall email pacing wait")
	errRecallEmailQuotaWait    = errors.New("recall email quota exhausted")
	errRecallEmailCASLost      = errors.New("recall email CAS lost")
)

type RecallLifecycleSMTPGateInput struct {
	Message   RecallMessage
	Recipient RecallRecipient
}

type RecallLifecycleSMTPGateResult struct {
	Email      string
	Blocked    bool
	ReasonCode string
}

type RecallLifecycleSMTPGateFunc func(tx *gorm.DB, input RecallLifecycleSMTPGateInput) (RecallLifecycleSMTPGateResult, error)

var RecallLifecycleSMTPGate RecallLifecycleSMTPGateFunc

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
		if recipient.LifecycleEventId != nil && RecallLifecycleSMTPGate != nil {
			gate, err := RecallLifecycleSMTPGate(tx, RecallLifecycleSMTPGateInput{
				Message:   message,
				Recipient: recipient,
			})
			if err != nil {
				return err
			}
			if gate.Blocked {
				attempt.Suppressed = true
				cancelled, err := cancelSuppressedRecallEmailFlowTx(tx, message.Id, recipient.Id, owner, expectedLeaseUntil, gate.ReasonCode)
				if err != nil {
					return err
				}
				if !cancelled {
					return nil
				}
				return nil
			}
			if gate.Email != "" && gate.Email != recipient.EmailSnapshot {
				result := tx.Model(&RecallRecipient{}).
					Where("id = ?", recipient.Id).
					Update("email_snapshot", gate.Email)
				if result.Error != nil {
					return result.Error
				}
				if result.RowsAffected != 1 {
					return errRecallEmailCASLost
				}
				recipient.EmailSnapshot = gate.Email
			}
		}
		attempt.Email = recipient.EmailSnapshot

		nowMillis, err := recallEmailPacingNowMillis(tx)
		if err != nil {
			return err
		}
		pacing, admitted, err := reserveRecallEmailPacing(tx, limit, nowMillis)
		if err != nil {
			return err
		}
		attempt.Pacing = pacing
		if !admitted {
			return errRecallEmailPacingWait
		}

		status, reserved, err := reserveRecallEmailQuotaAt(tx, limit, nowMillis/1000)
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
	if errors.Is(err, errRecallEmailPacingWait) {
		return attempt, nil
	}
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
	return reserveRecallEmailQuotaAt(db, limit, now)
}

func reserveRecallEmailQuotaAt(db *gorm.DB, limit int, now int64) (RecallEmailQuotaStatus, bool, error) {
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

func GetRecallEmailPacingStatusWithContext(ctx context.Context, limit int) (RecallEmailPacingStatus, error) {
	if ctx == nil {
		return RecallEmailPacingStatus{}, errors.New("context is nil")
	}
	db := DB.WithContext(ctx)
	nowMillis, err := recallEmailPacingNowMillis(db)
	if err != nil {
		return RecallEmailPacingStatus{}, err
	}
	return getRecallEmailPacingStatus(db, limit, nowMillis)
}

func reserveRecallEmailPacing(db *gorm.DB, limit int, nowMillis int64) (RecallEmailPacingStatus, bool, error) {
	intervalMillis := recallEmailPacingIntervalMillis(limit)
	state := RecallEmailPacingState{Scope: recallEmailPacingScope}
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&state).Error; err != nil {
		return RecallEmailPacingStatus{}, false, err
	}

	result := db.Model(&RecallEmailPacingState{}).
		Where("scope = ? AND (last_started_at_millis = 0 OR last_started_at_millis <= ?)", recallEmailPacingScope, nowMillis-intervalMillis).
		Update("last_started_at_millis", nowMillis)
	if result.Error != nil {
		return RecallEmailPacingStatus{}, false, result.Error
	}

	status, err := getRecallEmailPacingStatus(db, limit, nowMillis)
	if err != nil {
		return RecallEmailPacingStatus{}, false, err
	}
	admitted := result.RowsAffected == 1
	if admitted {
		status.Allowed = true
	}
	return status, admitted, nil
}

func getRecallEmailPacingStatus(db *gorm.DB, limit int, checkedAtMillis int64) (RecallEmailPacingStatus, error) {
	intervalMillis := recallEmailPacingIntervalMillis(limit)
	var state RecallEmailPacingState
	result := db.Where("scope = ?", recallEmailPacingScope).Limit(1).Find(&state)
	if result.Error != nil && !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return RecallEmailPacingStatus{}, result.Error
	}

	nextAllowedAtMillis := int64(0)
	allowed := true
	if state.LastStartedAtMillis > 0 {
		nextAllowedAtMillis = state.LastStartedAtMillis + intervalMillis
		allowed = checkedAtMillis >= nextAllowedAtMillis
	}
	return RecallEmailPacingStatus{
		Scope:               recallEmailPacingScope,
		CheckedAtMillis:     checkedAtMillis,
		LastStartedAtMillis: state.LastStartedAtMillis,
		NextAllowedAtMillis: nextAllowedAtMillis,
		IntervalMillis:      intervalMillis,
		Allowed:             allowed,
	}, nil
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

func recallEmailPacingIntervalMillis(limit int) int64 {
	if limit <= 0 {
		return recallEmailPacingHourMillis
	}
	return (recallEmailPacingHourMillis + int64(limit) - 1) / int64(limit)
}
