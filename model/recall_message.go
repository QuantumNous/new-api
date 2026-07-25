package model

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	RecallMessageScheduled = "scheduled"
	RecallMessageLeased    = "leased"
	RecallMessageSending   = "sending"
	RecallMessageAccepted  = "accepted"
	RecallMessageRetryWait = "retry_wait"
	RecallMessageUncertain = "uncertain"
	RecallMessageFailed    = "failed"
	RecallMessageCancelled = "cancelled"
)

type RecallMessage struct {
	Id                int64   `json:"id" gorm:"primaryKey"`
	RecipientId       int64   `json:"recipient_id" gorm:"uniqueIndex:idx_recall_recipient_stage,priority:1;index"`
	StageNo           int     `json:"stage_no" gorm:"uniqueIndex:idx_recall_recipient_stage,priority:2"`
	TemplateVersion   int     `json:"template_version"`
	TemplateSnapshot  string  `json:"-" gorm:"type:text;not null"`
	ScheduledAt       int64   `json:"scheduled_at" gorm:"index"`
	State             string  `json:"state" gorm:"type:varchar(24);not null;index"`
	AttemptCount      int     `json:"attempt_count"`
	NextAttemptAt     int64   `json:"next_attempt_at" gorm:"index"`
	LeaseOwner        string  `json:"-" gorm:"type:varchar(96);index"`
	LeaseExpiresAt    int64   `json:"-" gorm:"index"`
	ProviderMessageId string  `json:"provider_message_id" gorm:"type:varchar(255)"`
	ClaimTokenHash    *string `json:"-" gorm:"type:char(64);uniqueIndex"`
	AcceptedAt        int64   `json:"accepted_at"`
	FailedAt          int64   `json:"failed_at"`
	LastErrorCode     string  `json:"last_error_code" gorm:"type:varchar(64)"`
	LastErrorMessage  string  `json:"last_error_message" gorm:"type:varchar(512)"`
	CreatedAt         int64   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         int64   `json:"updated_at" gorm:"autoUpdateTime"`
}

type RecallEmailWorkItem struct {
	Message   RecallMessage
	Recipient RecallRecipient
	Campaign  RecallCampaign
	User      User
}

func ListDueRecallMessageIDs(now int64, limit int) ([]int64, error) {
	ids := make([]int64, 0)
	if limit <= 0 {
		return ids, nil
	}
	err := DB.Model(&RecallMessage{}).
		Where(
			"(state = ? AND scheduled_at <= ?) OR (state = ? AND next_attempt_at <= ?) OR (state = ? AND lease_expires_at < ?)",
			RecallMessageScheduled,
			now,
			RecallMessageRetryWait,
			now,
			RecallMessageLeased,
			now,
		).
		Order("id ASC").
		Limit(limit).
		Pluck("id", &ids).Error
	return ids, err
}

func LeaseRecallMessage(id int64, owner string, now int64, leaseUntil int64) (bool, error) {
	result := DB.Model(&RecallMessage{}).
		Where(
			"id = ? AND ((state = ? AND scheduled_at <= ?) OR (state = ? AND next_attempt_at <= ?) OR (state = ? AND lease_expires_at < ?))",
			id,
			RecallMessageScheduled,
			now,
			RecallMessageRetryWait,
			now,
			RecallMessageLeased,
			now,
		).
		Updates(map[string]any{
			"state":            RecallMessageLeased,
			"lease_owner":      owner,
			"lease_expires_at": leaseUntil,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func CompleteRecallMessageLease(id int64, owner string, expectedLeaseUntil int64, from string, to string, fields map[string]any) (bool, error) {
	allowedFields := map[string]struct{}{
		"accepted_at":         {},
		"failed_at":           {},
		"provider_message_id": {},
		"claim_token_hash":    {},
		"attempt_count":       {},
		"next_attempt_at":     {},
		"last_error_code":     {},
		"last_error_message":  {},
	}
	updates := make(map[string]any, len(fields)+3)
	for key, value := range fields {
		if _, ok := allowedFields[key]; !ok {
			return false, fmt.Errorf("unsupported recall message completion field %q", key)
		}
		updates[key] = value
	}
	updates["state"] = to
	updates["lease_owner"] = ""
	updates["lease_expires_at"] = int64(0)
	result := DB.Model(&RecallMessage{}).
		Where("id = ? AND lease_owner = ? AND lease_expires_at = ? AND state = ?", id, owner, expectedLeaseUntil, from).
		Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func MarkRecallMessageSendingWithContext(ctx context.Context, id int64, owner string, expectedLeaseUntil int64) (bool, error) {
	result := DB.WithContext(ctx).Model(&RecallMessage{}).
		Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ?", id, RecallMessageLeased, owner, expectedLeaseUntil).
		Update("state", RecallMessageSending)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func GetRecallEmailWorkItemForLeaseWithContext(ctx context.Context, id int64, owner string) (*RecallEmailWorkItem, error) {
	return getRecallEmailWorkItemForLeaseWithContext(ctx, id, owner, 0, false)
}

func GetRecallEmailWorkItemForLeaseEpochWithContext(ctx context.Context, id int64, owner string, expectedLeaseUntil int64) (*RecallEmailWorkItem, error) {
	return getRecallEmailWorkItemForLeaseWithContext(ctx, id, owner, expectedLeaseUntil, true)
}

func getRecallEmailWorkItemForLeaseWithContext(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, exactEpoch bool) (*RecallEmailWorkItem, error) {
	item := &RecallEmailWorkItem{}
	messageQuery := DB.WithContext(ctx).Where("id = ? AND state = ? AND lease_owner = ?", id, RecallMessageLeased, owner)
	if exactEpoch {
		messageQuery = messageQuery.Where("lease_expires_at = ?", expectedLeaseUntil)
	} else {
		messageQuery = messageQuery.Where("lease_expires_at > 0")
	}
	if err := messageQuery.First(&item.Message).Error; err != nil {
		return nil, err
	}
	if err := DB.WithContext(ctx).First(&item.Recipient, item.Message.RecipientId).Error; err != nil {
		return nil, err
	}
	if err := DB.WithContext(ctx).First(&item.Campaign, item.Recipient.CampaignId).Error; err != nil {
		return nil, err
	}
	if item.Recipient.UserId > 0 {
		if err := DB.WithContext(ctx).First(&item.User, item.Recipient.UserId).Error; err != nil {
			return nil, err
		}
	}
	return item, nil
}

func EnsureRecallMessageProviderIDWithContext(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, providerMessageID string) (string, bool, error) {
	providerMessageID = strings.TrimSpace(providerMessageID)
	if providerMessageID == "" {
		return "", false, fmt.Errorf("recall email Message-ID must not be empty")
	}
	result := DB.WithContext(ctx).Model(&RecallMessage{}).
		Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ? AND provider_message_id = ''", id, RecallMessageLeased, owner, expectedLeaseUntil).
		Update("provider_message_id", providerMessageID)
	if result.Error != nil {
		return "", false, result.Error
	}
	if result.RowsAffected == 1 {
		return providerMessageID, true, nil
	}
	var message RecallMessage
	if err := DB.WithContext(ctx).
		Select("provider_message_id").
		Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ?", id, RecallMessageLeased, owner, expectedLeaseUntil).
		First(&message).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", false, nil
		}
		return "", false, err
	}
	if strings.TrimSpace(message.ProviderMessageId) == "" {
		return "", false, nil
	}
	return message.ProviderMessageId, true, nil
}

func AcceptRecallMessageAndScheduleNextWithContext(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, acceptedAt int64, next *RecallMessage) (bool, error) {
	accepted := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var message RecallMessage
		if err := tx.Select("recipient_id").
			Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ?", id, RecallMessageSending, owner, expectedLeaseUntil).
			First(&message).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		result := tx.Model(&RecallMessage{}).
			Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ?", id, RecallMessageSending, owner, expectedLeaseUntil).
			Updates(map[string]any{
				"state":              RecallMessageAccepted,
				"accepted_at":        acceptedAt,
				"attempt_count":      gorm.Expr("attempt_count + ?", 1),
				"next_attempt_at":    int64(0),
				"lease_owner":        "",
				"lease_expires_at":   int64(0),
				"last_error_code":    "",
				"last_error_message": "",
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}
		if err := tx.Model(&RecallRecipient{}).
			Where("id = ?", message.RecipientId).
			Updates(map[string]any{
				"first_sent_at": gorm.Expr("CASE WHEN first_sent_at = 0 THEN ? ELSE first_sent_at END", acceptedAt),
				"last_sent_at":  acceptedAt,
			}).Error; err != nil {
			return err
		}
		if next != nil {
			next.RecipientId = message.RecipientId
			next.State = RecallMessageScheduled
			next.ClaimTokenHash = nil
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "recipient_id"}, {Name: "stage_no"}},
				DoNothing: true,
			}).Create(next).Error; err != nil {
				return err
			}
		}
		accepted = true
		return nil
	})
	return accepted, err
}

func CancelRecallEmailFlowWithContext(ctx context.Context, id int64, recipientID int64, owner string, expectedLeaseUntil int64, reasonCode string, now int64) (bool, error) {
	cancelled := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&RecallMessage{}).
			Where("id = ? AND recipient_id = ? AND state IN ? AND lease_owner = ? AND lease_expires_at = ?", id, recipientID, []string{RecallMessageLeased, RecallMessageSending}, owner, expectedLeaseUntil).
			Updates(map[string]any{
				"state":              RecallMessageCancelled,
				"next_attempt_at":    int64(0),
				"lease_owner":        "",
				"lease_expires_at":   int64(0),
				"failed_at":          now,
				"last_error_code":    reasonCode,
				"last_error_message": "",
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}
		cancelled = true
		return tx.Model(&RecallMessage{}).
			Where("recipient_id = ? AND state IN ?", recipientID, []string{RecallMessageScheduled, RecallMessageRetryWait, RecallMessageLeased, RecallMessageSending}).
			Updates(map[string]any{
				"state":              RecallMessageCancelled,
				"next_attempt_at":    int64(0),
				"lease_owner":        "",
				"lease_expires_at":   int64(0),
				"failed_at":          now,
				"last_error_code":    reasonCode,
				"last_error_message": "",
			}).Error
	})
	return cancelled, err
}

func ManualRetryRecallMessageWithContext(ctx context.Context, id int64, acknowledgeUncertain bool, now int64) (bool, error) {
	query := DB.WithContext(ctx).Model(&RecallMessage{}).
		Where("id = ? AND state = ?", id, RecallMessageFailed)
	if acknowledgeUncertain {
		query = DB.WithContext(ctx).Model(&RecallMessage{}).
			Where("id = ? AND (state IN ? OR (state = ? AND lease_expires_at > 0 AND lease_expires_at < ?))", id, []string{RecallMessageFailed, RecallMessageUncertain}, RecallMessageSending, now)
	}
	result := query.Updates(map[string]any{
		"state":              RecallMessageRetryWait,
		"next_attempt_at":    now,
		"failed_at":          int64(0),
		"lease_owner":        "",
		"lease_expires_at":   int64(0),
		"last_error_code":    "",
		"last_error_message": "",
	})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func ListRecallMessagesForRecipientIDsWithContext(ctx context.Context, recipientIDs []int64) ([]RecallMessage, error) {
	messages := make([]RecallMessage, 0)
	if len(recipientIDs) == 0 {
		return messages, nil
	}
	if err := DB.WithContext(ctx).
		Where("recipient_id IN ?", recipientIDs).
		Order("recipient_id ASC").
		Order("id DESC").
		Find(&messages).Error; err != nil {
		return nil, err
	}
	return messages, nil
}

func ListRecallMessagesForRecipientWithContext(ctx context.Context, recipientID int64) ([]RecallMessage, error) {
	return ListRecallMessagesForRecipientIDsWithContext(ctx, []int64{recipientID})
}

func ManualRetryRecallMessageAndAdminEventWithContext(ctx context.Context, id int64, expectedState string, expectedUpdatedAt int64, now int64, event RecallEvent) (bool, error) {
	if event.CampaignId <= 0 || event.RecipientId <= 0 {
		return false, fmt.Errorf("recall message admin event target is required")
	}
	if err := validateRecallAdminEvent(&event); err != nil {
		return false, err
	}
	retried := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		won, err := manualRetryRecallMessageState(tx, id, event.RecipientId, expectedState, expectedUpdatedAt, now)
		if err != nil {
			return err
		}
		if !won {
			return nil
		}
		retried = true
		return insertRequiredRecallAdminEvent(tx, &event)
	})
	if err != nil {
		return false, err
	}
	return retried, nil
}

func manualRetryRecallMessageState(db *gorm.DB, id int64, recipientID int64, expectedState string, expectedUpdatedAt int64, now int64) (bool, error) {
	if expectedState != RecallMessageFailed && expectedState != RecallMessageUncertain && expectedState != RecallMessageSending {
		return false, fmt.Errorf("recall message %d is not manually retryable", id)
	}
	query := db.Model(&RecallMessage{}).
		Where("id = ? AND state = ? AND updated_at = ?", id, expectedState, expectedUpdatedAt)
	if expectedState == RecallMessageSending {
		query = query.Where("lease_expires_at > 0 AND lease_expires_at < ?", now)
	}
	if recipientID > 0 {
		query = query.Where("recipient_id = ?", recipientID)
	}
	result := query.
		Updates(map[string]any{
			"state":              RecallMessageRetryWait,
			"next_attempt_at":    now,
			"failed_at":          int64(0),
			"lease_owner":        "",
			"lease_expires_at":   int64(0),
			"last_error_code":    "",
			"last_error_message": "",
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func ScheduleNextRecallStages(recipientID int64, messages []RecallMessage) error {
	if len(messages) == 0 {
		return nil
	}
	for i := range messages {
		messages[i].RecipientId = recipientID
	}
	return DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "recipient_id"}, {Name: "stage_no"}},
		DoNothing: true,
	}).Create(&messages).Error
}

func CancelPendingRecallMessages(recipientID int64, reasonCode string, now int64) (int64, error) {
	result := DB.Model(&RecallMessage{}).
		Where("recipient_id = ? AND state IN ?", recipientID, []string{
			RecallMessageScheduled,
			RecallMessageRetryWait,
			RecallMessageLeased,
			RecallMessageSending,
		}).
		Updates(map[string]any{
			"state":              RecallMessageCancelled,
			"next_attempt_at":    int64(0),
			"lease_owner":        "",
			"lease_expires_at":   int64(0),
			"last_error_code":    reasonCode,
			"last_error_message": "",
			"failed_at":          now,
		})
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}
