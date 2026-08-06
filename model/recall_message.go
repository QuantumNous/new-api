package model

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
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
	Id                  int64   `json:"id" gorm:"primaryKey"`
	RecipientId         int64   `json:"recipient_id" gorm:"uniqueIndex:idx_recall_recipient_stage,priority:1;index"`
	StageNo             int     `json:"stage_no" gorm:"uniqueIndex:idx_recall_recipient_stage,priority:2"`
	TemplateVersion     int     `json:"template_version"`
	TemplateSnapshot    string  `json:"-" gorm:"not null"`
	ScheduledAt         int64   `json:"scheduled_at" gorm:"index"`
	State               string  `json:"state" gorm:"type:varchar(24);not null;index"`
	StateVersion        int64   `json:"state_version"`
	AttemptCount        int     `json:"attempt_count"`
	PreSendAttemptCount int     `json:"pre_send_attempt_count" gorm:"not null;default:0"`
	NextAttemptAt       int64   `json:"next_attempt_at" gorm:"index"`
	LeaseOwner          string  `json:"-" gorm:"type:varchar(96);index"`
	LeaseExpiresAt      int64   `json:"-" gorm:"index"`
	ProviderMessageId   string  `json:"provider_message_id" gorm:"type:varchar(255)"`
	ClaimTokenHash      *string `json:"-" gorm:"type:char(64);uniqueIndex"`
	AcceptedAt          int64   `json:"accepted_at"`
	FailedAt            int64   `json:"failed_at"`
	LastErrorCode       string  `json:"last_error_code" gorm:"type:varchar(64)"`
	LastErrorMessage    string  `json:"last_error_message" gorm:"type:varchar(512)"`
	CreatedAt           int64   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt           int64   `json:"updated_at" gorm:"autoUpdateTime"`
}

type RecallEmailWorkItem struct {
	Message   RecallMessage
	Recipient RecallRecipient
	Campaign  RecallCampaign
	User      User
}

type RecallDueMessage struct {
	ID                   int64
	State                string
	EffectiveDueAt       int64
	PreviousLeaseExpires int64
}

type RecallMessageTransition struct {
	MessageID          int64
	RecipientID        int64
	CampaignID         int64
	StageNo            int
	From               string
	To                 string
	Owner              string
	ExpectedLeaseUntil int64
	Fields             map[string]any
	dueFence           *recallMessageDueFence
}

type recallMessageDueFence struct {
	State string
	Value int64
	Now   int64
}

type recallMessageStateEventPayload struct {
	MessageID   int64  `json:"message_id"`
	RecipientID int64  `json:"recipient_id"`
	StageNo     int    `json:"stage_no"`
	FromState   string `json:"from_state"`
	ToState     string `json:"to_state"`
	OccurredAt  int64  `json:"occurred_at"`
	FailureCode string `json:"failure_code,omitempty"`
}

func TransitionRecallMessageWithEvent(ctx context.Context, transition RecallMessageTransition) (bool, error) {
	transitioned := 0
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		count, err := TransitionRecallMessagesWithEventsTx(tx, []RecallMessageTransition{transition})
		transitioned = count
		return err
	})
	if err != nil {
		return false, err
	}
	return transitioned == 1, nil
}

func CreateRecallMessagesWithStateEventsTx(tx *gorm.DB, campaignID int64, messages []RecallMessage, occurredAt int64) error {
	if tx == nil {
		return fmt.Errorf("recall message state event creation requires a transaction")
	}
	if len(messages) == 0 {
		return nil
	}
	for i := range messages {
		messages[i].StateVersion = 1
		if strings.TrimSpace(messages[i].State) == "" {
			messages[i].State = RecallMessageScheduled
		}
	}
	if err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "recipient_id"}, {Name: "stage_no"}},
		DoNothing: true,
	}).CreateInBatches(&messages, recallRunBatchSize).Error; err != nil {
		return err
	}

	stored, err := selectRecallMessagesForStateEventCreation(tx, campaignID, messages)
	if err != nil {
		return err
	}
	for _, message := range stored {
		if message.StateVersion != 1 {
			continue
		}
		event, err := recallMessageStateEvent(message, "", message.State, 1, occurredAt)
		if err != nil {
			return err
		}
		if _, err := insertRecallMessageStateEvent(tx, &event); err != nil {
			return err
		}
	}
	return nil
}

func TransitionRecallMessagesWithEventsTx(tx *gorm.DB, transitions []RecallMessageTransition) (int, error) {
	if tx == nil {
		return 0, fmt.Errorf("recall message state transition requires a transaction")
	}
	if len(transitions) == 0 {
		return 0, nil
	}
	occurredAt, err := getDBTimestamp(tx)
	if err != nil {
		return 0, err
	}
	transitionByID := make(map[int64]RecallMessageTransition, len(transitions))
	ids := make([]int64, 0, len(transitions))
	for _, transition := range transitions {
		if strings.TrimSpace(transition.From) == "" || strings.TrimSpace(transition.To) == "" {
			return 0, fmt.Errorf("recall message transition requires from and to states")
		}
		if _, err := recallMessageTransitionUpdates(transition); err != nil {
			return 0, err
		}
		if _, exists := transitionByID[transition.MessageID]; !exists {
			ids = append(ids, transition.MessageID)
		}
		transitionByID[transition.MessageID] = transition
	}
	transitioned := 0
	for start := 0; start < len(ids); start += recallRunBatchSize {
		end := start + recallRunBatchSize
		if end > len(ids) {
			end = len(ids)
		}
		rows, err := selectRecallMessagesForTransition(tx, ids[start:end])
		if err != nil {
			return transitioned, err
		}
		for _, row := range rows {
			transition := transitionByID[row.Id]
			if !recallMessageTransitionMatches(row.RecallMessage, transition) {
				continue
			}
			if row.StateVersion == 0 {
				baselined, err := insertInlineRecallMessageBaseline(tx, row, transition, occurredAt)
				if err != nil {
					return transitioned, err
				}
				if !baselined {
					continue
				}
				row.StateVersion = 1
			}
			updates, err := recallMessageTransitionUpdates(transition)
			if err != nil {
				return transitioned, err
			}
			nextVersion := row.StateVersion + 1
			updates["state"] = transition.To
			updates["state_version"] = nextVersion
			updateQuery := recallMessageTransitionQuery(tx.Model(&RecallMessage{}), row.RecallMessage, transition).
				Where("state_version = ?", row.StateVersion)
			updateQuery = applyRecallMessageDueFence(updateQuery, transition.dueFence)
			result := updateQuery.Updates(updates)
			if result.Error != nil {
				return transitioned, result.Error
			}
			if result.RowsAffected == 0 {
				continue
			}
			row.State = transition.To
			row.StateVersion = nextVersion
			applyRecallMessageTransitionEventFields(&row.RecallMessage, updates)
			if transition.CampaignID > 0 {
				row.CampaignID = transition.CampaignID
			}
			event, err := recallMessageStateEvent(row, transition.From, transition.To, nextVersion, occurredAt)
			if err != nil {
				return transitioned, err
			}
			inserted, err := insertRecallMessageStateEvent(tx, &event)
			if err != nil {
				return transitioned, err
			}
			if !inserted && tx.Migrator().HasTable(&RecallEvent{}) {
				return transitioned, fmt.Errorf("recall message state event was not inserted for message %d version %d", row.Id, nextVersion)
			}
			transitioned++
		}
	}
	return transitioned, nil
}

func recallMessageDueAcquireFence(state string, value int64, now int64) *recallMessageDueFence {
	return &recallMessageDueFence{State: state, Value: value, Now: now}
}

func recallDueCandidateFenceValue(candidate RecallDueMessage) int64 {
	if candidate.State == RecallMessageLeased {
		return candidate.PreviousLeaseExpires
	}
	return candidate.EffectiveDueAt
}

func recallMessageDueFenceValue(message RecallMessage) int64 {
	switch message.State {
	case RecallMessageScheduled:
		return message.ScheduledAt
	case RecallMessageRetryWait:
		return message.NextAttemptAt
	case RecallMessageLeased:
		return message.LeaseExpiresAt
	default:
		return 0
	}
}

func applyRecallMessageDueFence(query *gorm.DB, fence *recallMessageDueFence) *gorm.DB {
	if fence == nil {
		return query
	}
	switch fence.State {
	case RecallMessageScheduled:
		return query.Where("scheduled_at = ? AND scheduled_at <= ?", fence.Value, fence.Now)
	case RecallMessageRetryWait:
		return query.Where("next_attempt_at = ? AND next_attempt_at <= ?", fence.Value, fence.Now)
	case RecallMessageLeased:
		return query.Where("lease_expires_at = ? AND lease_expires_at < ?", fence.Value, fence.Now)
	default:
		return query
	}
}

func ReconcileRecallMessageStateEventBaseline(ctx context.Context, limit int) (int, error) {
	if limit <= 0 {
		return 0, nil
	}
	reconciled := 0
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		pending := 0
		candidateIDs := make([]int64, 0, limit)
		if err := tx.Model(&RecallMessage{}).
			Select("recall_messages.id").
			Joins("JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id").
			Where("recall_messages.state_version IS NULL OR recall_messages.state_version = 0 OR NOT EXISTS (?)", recallMessageStateEventExistsSubquery(tx)).
			Order("recall_messages.id ASC").
			Limit(limit).
			Find(&candidateIDs).Error; err != nil {
			return err
		}
		if len(candidateIDs) == 0 {
			return nil
		}
		rows := make([]recallMessageWithCampaign, 0, len(candidateIDs))
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Model(&RecallMessage{}).
			Select("recall_messages.*, recall_recipients.campaign_id").
			Joins("JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id").
			Where("recall_messages.id IN ?", candidateIDs).
			Order("recall_messages.id ASC").
			Find(&rows).Error; err != nil {
			return err
		}
		occurredAt, err := getDBTimestamp(tx)
		if err != nil {
			return err
		}
		for _, row := range rows {
			version := row.StateVersion
			if row.StateVersion == 0 {
				result := tx.Model(&RecallMessage{}).
					Where("id = ? AND (state_version IS NULL OR state_version = 0)", row.Id).
					Update("state_version", 1)
				if result.Error != nil {
					return result.Error
				}
				if result.RowsAffected == 0 {
					continue
				}
				row.StateVersion = 1
				version = 1
			}
			event, err := recallMessageStateEvent(row, "", row.State, version, occurredAt)
			if err != nil {
				return err
			}
			inserted, err := insertRecallMessageStateEvent(tx, &event)
			if err != nil {
				return err
			}
			if !inserted && tx.Migrator().HasTable(&RecallEvent{}) {
				exists, existsErr := recallMessageStateEventExists(tx, event)
				if existsErr != nil {
					return fmt.Errorf("check existing recall message baseline event for message %d: %w", row.Id, existsErr)
				}
				if !exists {
					return fmt.Errorf("recall message baseline event was not inserted for message %d", row.Id)
				}
				continue
			}
			pending++
		}
		reconciled = pending
		return nil
	})
	if err != nil {
		return 0, err
	}
	return reconciled, err
}

func CountUnbaselinedRecallMessagesForCampaign(ctx context.Context, campaignID int64) (int64, error) {
	var count int64
	db := DB.WithContext(ctx)
	err := db.Model(&RecallMessage{}).
		Joins("JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id").
		Where("recall_recipients.campaign_id = ?", campaignID).
		Where("recall_messages.state_version IS NULL OR recall_messages.state_version = 0 OR NOT EXISTS (?)", recallMessageStateEventExistsSubquery(db)).
		Count(&count).Error
	return count, err
}

func recallMessageStateEventExistsSubquery(db *gorm.DB) *gorm.DB {
	return db.Model(&RecallEvent{}).
		Select("1").
		Where("recall_events.campaign_id = recall_recipients.campaign_id").
		Where("recall_events.message_id = recall_messages.id").
		Where("recall_events.event_type = ? AND recall_events.source = ?", "message_state_changed", "message_state")
}

type recallMessageWithCampaign struct {
	RecallMessage
	CampaignID int64 `gorm:"column:campaign_id"`
}

func selectRecallMessagesForStateEventCreation(tx *gorm.DB, campaignID int64, messages []RecallMessage) ([]recallMessageWithCampaign, error) {
	stored := make([]recallMessageWithCampaign, 0, len(messages))
	for start := 0; start < len(messages); start += recallRunBatchSize {
		end := start + recallRunBatchSize
		if end > len(messages) {
			end = len(messages)
		}
		batch := messages[start:end]
		recipientIDs := make([]int64, 0, len(batch))
		stageNos := make([]int, 0, len(batch))
		requested := make(map[recallMessageCreationKey]struct{}, len(batch))
		for _, message := range batch {
			recipientIDs = append(recipientIDs, message.RecipientId)
			stageNos = append(stageNos, message.StageNo)
			requested[recallMessageCreationKey{RecipientID: message.RecipientId, StageNo: message.StageNo}] = struct{}{}
		}
		query := tx.Model(&RecallMessage{}).
			Select("recall_messages.*, recall_recipients.campaign_id").
			Joins("JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id").
			Where("recall_messages.recipient_id IN ? AND recall_messages.stage_no IN ?", recipientIDs, stageNos)
		if campaignID > 0 {
			query = query.Where("recall_recipients.campaign_id = ?", campaignID)
		}
		var rows []recallMessageWithCampaign
		if err := query.Order("recall_messages.id ASC").Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			key := recallMessageCreationKey{RecipientID: row.RecipientId, StageNo: row.StageNo}
			if _, ok := requested[key]; !ok {
				continue
			}
			stored = append(stored, row)
		}
	}
	return stored, nil
}

type recallMessageCreationKey struct {
	RecipientID int64
	StageNo     int
}

func selectRecallMessagesForTransition(tx *gorm.DB, ids []int64) ([]recallMessageWithCampaign, error) {
	rows := make([]recallMessageWithCampaign, 0, len(ids))
	query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Model(&RecallMessage{}).
		Where("recall_messages.id IN ?", ids).
		Order("recall_messages.id ASC")
	if tx.Migrator().HasTable(&RecallRecipient{}) {
		query = query.Select("recall_messages.*, recall_recipients.campaign_id").
			Joins("LEFT JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id")
	} else {
		query = query.Select("recall_messages.*")
	}
	if err := query.Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func recallMessageTransitionMatches(message RecallMessage, transition RecallMessageTransition) bool {
	if message.State != transition.From {
		return false
	}
	if transition.RecipientID > 0 && message.RecipientId != transition.RecipientID {
		return false
	}
	if transition.StageNo > 0 && message.StageNo != transition.StageNo {
		return false
	}
	if transition.Owner != "" || transition.ExpectedLeaseUntil != 0 {
		return message.LeaseOwner == transition.Owner && message.LeaseExpiresAt == transition.ExpectedLeaseUntil
	}
	return true
}

func recallMessageTransitionQuery(query *gorm.DB, message RecallMessage, transition RecallMessageTransition) *gorm.DB {
	query = query.Where("id = ? AND state = ?", message.Id, transition.From)
	if transition.RecipientID > 0 {
		query = query.Where("recipient_id = ?", transition.RecipientID)
	}
	if transition.StageNo > 0 {
		query = query.Where("stage_no = ?", transition.StageNo)
	}
	if transition.Owner != "" || transition.ExpectedLeaseUntil != 0 {
		query = query.Where("lease_owner = ? AND lease_expires_at = ?", transition.Owner, transition.ExpectedLeaseUntil)
	}
	return query
}

func insertInlineRecallMessageBaseline(tx *gorm.DB, row recallMessageWithCampaign, transition RecallMessageTransition, occurredAt int64) (bool, error) {
	query := recallMessageTransitionQuery(tx.Model(&RecallMessage{}), row.RecallMessage, transition).
		Where("state_version IS NULL OR state_version = 0")
	query = applyRecallMessageDueFence(query, transition.dueFence)
	result := query.Update("state_version", int64(1))
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 0 {
		return false, nil
	}
	if transition.CampaignID > 0 {
		row.CampaignID = transition.CampaignID
	}
	event, err := recallMessageStateEvent(row, "", row.State, 1, occurredAt)
	if err != nil {
		return false, err
	}
	inserted, err := insertRecallMessageStateEvent(tx, &event)
	if err != nil {
		return false, err
	}
	if !inserted && tx.Migrator().HasTable(&RecallEvent{}) {
		exists, existsErr := recallMessageStateEventExists(tx, event)
		if existsErr != nil {
			return false, fmt.Errorf("check existing recall message baseline event for message %d: %w", row.Id, existsErr)
		}
		if !exists {
			return false, fmt.Errorf("recall message baseline event was not inserted for message %d", row.Id)
		}
	}
	return true, nil
}

func recallMessageTransitionUpdates(transition RecallMessageTransition) (map[string]any, error) {
	allowedFields := recallMessageTransitionAllowedFields()
	updates := make(map[string]any, len(transition.Fields)+2)
	for key, value := range transition.Fields {
		if _, ok := allowedFields[key]; !ok {
			return nil, fmt.Errorf("unsupported recall message transition field %q", key)
		}
		updates[key] = value
	}
	return updates, nil
}

func applyRecallMessageTransitionEventFields(message *RecallMessage, updates map[string]any) {
	if message == nil {
		return
	}
	if value, ok := updates["last_error_code"]; ok {
		if code, ok := value.(string); ok {
			message.LastErrorCode = strings.TrimSpace(code)
		}
	}
	if value, ok := updates["failed_at"]; ok {
		switch failedAt := value.(type) {
		case int64:
			message.FailedAt = failedAt
		case int:
			message.FailedAt = int64(failedAt)
		}
	}
}

func recallMessageTransitionAllowedFields() map[string]struct{} {
	return map[string]struct{}{
		"accepted_at":            {},
		"failed_at":              {},
		"provider_message_id":    {},
		"claim_token_hash":       {},
		"attempt_count":          {},
		"pre_send_attempt_count": {},
		"next_attempt_at":        {},
		"last_error_code":        {},
		"last_error_message":     {},
		"lease_owner":            {},
		"lease_expires_at":       {},
	}
}

func recallMessageStateEventFailureCode(to string, code string) string {
	switch to {
	case RecallMessageFailed, RecallMessageCancelled:
		return sanitizeRecallErrorCode(code)
	default:
		return ""
	}
}

func recallMessageStateEvent(message any, from string, to string, version int64, occurredAt int64) (RecallEvent, error) {
	var id int64
	var recipientID int64
	var campaignID int64
	var stageNo int
	var failureCode string
	switch row := message.(type) {
	case RecallMessage:
		id = row.Id
		recipientID = row.RecipientId
		stageNo = row.StageNo
		failureCode = row.LastErrorCode
	case recallMessageWithCampaign:
		id = row.Id
		recipientID = row.RecipientId
		campaignID = row.CampaignID
		stageNo = row.StageNo
		failureCode = row.LastErrorCode
	default:
		return RecallEvent{}, fmt.Errorf("unsupported recall message state event row")
	}
	payload, err := common.Marshal(recallMessageStateEventPayload{
		MessageID:   id,
		RecipientID: recipientID,
		StageNo:     stageNo,
		FromState:   from,
		ToState:     to,
		OccurredAt:  occurredAt,
		FailureCode: recallMessageStateEventFailureCode(to, failureCode),
	})
	if err != nil {
		return RecallEvent{}, err
	}
	return RecallEvent{
		CampaignId:    campaignID,
		RecipientId:   recipientID,
		EventType:     "message_state_changed",
		Source:        "message_state",
		MessageId:     id,
		SourceEventId: fmt.Sprintf("%d:%d", id, version),
		EventData:     string(payload),
		CreatedAt:     occurredAt,
	}, nil
}

func insertRecallMessageStateEvent(tx *gorm.DB, event *RecallEvent) (bool, error) {
	if !tx.Migrator().HasTable(&RecallEvent{}) {
		return false, nil
	}
	result := insertRecallRunEvent(tx, event)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func recallMessageStateEventExists(tx *gorm.DB, event RecallEvent) (bool, error) {
	var count int64
	err := tx.Model(&RecallEvent{}).
		Where("campaign_id = ? AND event_type = ? AND source = ? AND message_id = ? AND source_event_id = ?", event.CampaignId, event.EventType, event.Source, event.MessageId, event.SourceEventId).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func ListDueRecallMessages(now int64, limit int) ([]RecallDueMessage, error) {
	due := make([]RecallDueMessage, 0)
	if limit <= 0 {
		return due, nil
	}
	scheduled, err := listDueRecallMessagesForState(RecallMessageScheduled, "scheduled_at", "scheduled_at <= ?", now, limit)
	if err != nil {
		return nil, err
	}
	retryWait, err := listDueRecallMessagesForState(RecallMessageRetryWait, "next_attempt_at", "next_attempt_at <= ?", now, limit)
	if err != nil {
		return nil, err
	}
	leased, err := listDueRecallMessagesForState(RecallMessageLeased, "lease_expires_at", "lease_expires_at < ?", now, limit)
	if err != nil {
		return nil, err
	}
	return mergeDueRecallMessages(limit, scheduled, retryWait, leased), nil
}

func listDueRecallMessagesForState(state string, dueColumn string, duePredicate string, now int64, limit int) ([]RecallDueMessage, error) {
	due := make([]RecallDueMessage, 0, limit)
	err := DB.Model(&RecallMessage{}).
		Select("id, state, lease_expires_at AS previous_lease_expires, "+dueColumn+" AS effective_due_at").
		Where("state = ?", state).
		Where(duePredicate, now).
		Order(dueColumn + " ASC").
		Order("id ASC").
		Limit(limit).
		Find(&due).Error
	return due, err
}

func mergeDueRecallMessages(limit int, sources ...[]RecallDueMessage) []RecallDueMessage {
	total := 0
	for _, source := range sources {
		total += len(source)
	}
	due := make([]RecallDueMessage, 0, total)
	for _, source := range sources {
		due = append(due, source...)
	}
	sort.SliceStable(due, func(i int, j int) bool {
		if due[i].EffectiveDueAt != due[j].EffectiveDueAt {
			return due[i].EffectiveDueAt < due[j].EffectiveDueAt
		}
		return due[i].ID < due[j].ID
	})
	if len(due) > limit {
		due = due[:limit]
	}
	return due
}

func LeaseDueRecallMessage(candidate RecallDueMessage, owner string, now int64, leaseUntil int64) (bool, error) {
	won := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND state = ?", candidate.ID, candidate.State)
		switch candidate.State {
		case RecallMessageScheduled:
			query = query.Where("scheduled_at = ? AND scheduled_at <= ?", candidate.EffectiveDueAt, now)
		case RecallMessageRetryWait:
			query = query.Where("next_attempt_at = ? AND next_attempt_at <= ?", candidate.EffectiveDueAt, now)
		case RecallMessageLeased:
			query = query.Where("lease_expires_at = ? AND lease_expires_at < ?", candidate.PreviousLeaseExpires, now)
		default:
			return nil
		}
		var message RecallMessage
		if err := query.First(&message).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		count, err := TransitionRecallMessagesWithEventsTx(tx, []RecallMessageTransition{{
			MessageID: message.Id,
			From:      candidate.State,
			To:        RecallMessageLeased,
			dueFence:  recallMessageDueAcquireFence(candidate.State, recallDueCandidateFenceValue(candidate), now),
			Fields: map[string]any{
				"lease_owner":      owner,
				"lease_expires_at": leaseUntil,
			},
		}})
		if err != nil {
			return err
		}
		won = count == 1
		return nil
	})
	return won, err
}

func ReleaseRecallMessageLeaseWithContext(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, candidate RecallDueMessage) (bool, error) {
	return releaseRecallMessageLeaseWithContext(ctx, id, owner, expectedLeaseUntil, candidate, expectedLeaseUntil, false)
}

func ReleaseRecallMessageLeaseForRetryWithContext(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, candidate RecallDueMessage, retryAt int64) (bool, error) {
	return releaseRecallMessageLeaseWithContext(ctx, id, owner, expectedLeaseUntil, candidate, retryAt, true)
}

func releaseRecallMessageLeaseWithContext(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, candidate RecallDueMessage, retryAt int64, forceRetry bool) (bool, error) {
	restoredState := candidate.State
	updates := map[string]any{
		"state":            restoredState,
		"lease_owner":      "",
		"lease_expires_at": int64(0),
	}
	if forceRetry || candidate.State == RecallMessageLeased {
		updates["state"] = RecallMessageRetryWait
		updates["next_attempt_at"] = retryAt
	}
	to := updates["state"].(string)
	delete(updates, "state")
	won, err := TransitionRecallMessageWithEvent(ctx, RecallMessageTransition{
		MessageID:          id,
		From:               RecallMessageLeased,
		To:                 to,
		Owner:              owner,
		ExpectedLeaseUntil: expectedLeaseUntil,
		Fields:             updates,
	})
	return won, err
}

func DeferRecallMessageLeaseWithContext(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, deferUntil int64) (bool, error) {
	result := DB.WithContext(ctx).Model(&RecallMessage{}).
		Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ?", id, RecallMessageLeased, owner, expectedLeaseUntil).
		Update("lease_expires_at", deferUntil)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func ListDueRecallMessageIDs(now int64, limit int) ([]int64, error) {
	ids := make([]int64, 0)
	if limit <= 0 {
		return ids, nil
	}
	due, err := ListDueRecallMessages(now, limit)
	if err != nil {
		return nil, err
	}
	for _, candidate := range due {
		ids = append(ids, candidate.ID)
	}
	return ids, nil
}

func LeaseRecallMessage(id int64, owner string, now int64, leaseUntil int64) (bool, error) {
	won := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var message RecallMessage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where(
				"id = ? AND ((state = ? AND scheduled_at <= ?) OR (state = ? AND next_attempt_at <= ?) OR (state = ? AND lease_expires_at < ?))",
				id,
				RecallMessageScheduled,
				now,
				RecallMessageRetryWait,
				now,
				RecallMessageLeased,
				now,
			).First(&message).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		count, err := TransitionRecallMessagesWithEventsTx(tx, []RecallMessageTransition{{
			MessageID: message.Id,
			From:      message.State,
			To:        RecallMessageLeased,
			dueFence:  recallMessageDueAcquireFence(message.State, recallMessageDueFenceValue(message), now),
			Fields: map[string]any{
				"lease_owner":      owner,
				"lease_expires_at": leaseUntil,
			},
		}})
		if err != nil {
			return err
		}
		won = count == 1
		return nil
	})
	return won, err
}

func CompleteRecallMessageLease(id int64, owner string, expectedLeaseUntil int64, from string, to string, fields map[string]any) (bool, error) {
	allowedFields := map[string]struct{}{
		"accepted_at":            {},
		"failed_at":              {},
		"provider_message_id":    {},
		"claim_token_hash":       {},
		"attempt_count":          {},
		"pre_send_attempt_count": {},
		"next_attempt_at":        {},
		"last_error_code":        {},
		"last_error_message":     {},
	}
	updates := make(map[string]any, len(fields)+3)
	for key, value := range fields {
		if _, ok := allowedFields[key]; !ok {
			return false, fmt.Errorf("unsupported recall message completion field %q", key)
		}
		updates[key] = value
	}
	updates["lease_owner"] = ""
	updates["lease_expires_at"] = int64(0)
	completed := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := serializeRecallSQLiteWriterTx(tx, "UPDATE recall_messages SET id = id WHERE id = ?", id); err != nil {
			return err
		}
		var message RecallMessage
		if err := tx.Select("id", "recipient_id").
			Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ?", id, from, owner, expectedLeaseUntil).
			First(&message).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		var recipient RecallRecipient
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", message.RecipientId).
			First(&recipient).Error; err != nil {
			return err
		}
		count, err := TransitionRecallMessagesWithEventsTx(tx, []RecallMessageTransition{{
			MessageID:          id,
			RecipientID:        recipient.Id,
			From:               from,
			To:                 to,
			Owner:              owner,
			ExpectedLeaseUntil: expectedLeaseUntil,
			Fields:             updates,
		}})
		if err != nil {
			return err
		}
		completed = count == 1
		return nil
	})
	return completed, err
}

func MarkRecallMessageSendingWithContext(ctx context.Context, id int64, owner string, expectedLeaseUntil int64) (bool, error) {
	won := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := serializeRecallSQLiteWriterTx(tx, "UPDATE recall_messages SET id = id WHERE id = ?", id); err != nil {
			return err
		}
		var message RecallMessage
		if err := tx.Select("id", "recipient_id").
			Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ?", id, RecallMessageLeased, owner, expectedLeaseUntil).
			First(&message).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		var recipient RecallRecipient
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", message.RecipientId).
			First(&recipient).Error; err != nil {
			return err
		}
		suppressed, _, err := hasPersistentRecallCampaignExclusionTx(tx, recipient)
		if err != nil || suppressed {
			return err
		}
		count, err := TransitionRecallMessagesWithEventsTx(tx, []RecallMessageTransition{{
			MessageID:          id,
			RecipientID:        recipient.Id,
			From:               RecallMessageLeased,
			To:                 RecallMessageSending,
			Owner:              owner,
			ExpectedLeaseUntil: expectedLeaseUntil,
		}})
		if err != nil {
			return err
		}
		won = count == 1
		return nil
	})
	return won, err
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
		if err := serializeRecallSQLiteWriterTx(tx, "UPDATE recall_messages SET id = id WHERE id = ?", id); err != nil {
			return err
		}
		pendingAccepted := false
		var message RecallMessage
		if err := tx.Select("id", "recipient_id").
			Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ?", id, RecallMessageSending, owner, expectedLeaseUntil).
			First(&message).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		var recipient RecallRecipient
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", message.RecipientId).
			First(&recipient).Error; err != nil {
			return err
		}
		suppressed, _, err := hasPersistentRecallCampaignExclusionTx(tx, recipient)
		if err != nil {
			return err
		}
		count, err := TransitionRecallMessagesWithEventsTx(tx, []RecallMessageTransition{{
			MessageID:          id,
			From:               RecallMessageSending,
			To:                 RecallMessageAccepted,
			Owner:              owner,
			ExpectedLeaseUntil: expectedLeaseUntil,
			Fields: map[string]any{
				"accepted_at":        acceptedAt,
				"attempt_count":      gorm.Expr("attempt_count + ?", 1),
				"next_attempt_at":    int64(0),
				"lease_owner":        "",
				"lease_expires_at":   int64(0),
				"last_error_code":    "",
				"last_error_message": "",
			},
		}})
		if err != nil {
			return err
		}
		if count == 0 {
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
		if next != nil && !suppressed {
			next.RecipientId = message.RecipientId
			next.State = RecallMessageScheduled
			next.ClaimTokenHash = nil
			if err := CreateRecallMessagesWithStateEventsTx(tx, 0, []RecallMessage{*next}, acceptedAt); err != nil {
				return err
			}
		}
		pendingAccepted = true
		accepted = pendingAccepted
		return nil
	})
	if err != nil {
		return false, err
	}
	return accepted, err
}

func hasPersistentRecallCampaignExclusionTx(tx *gorm.DB, recipient RecallRecipient) (bool, string, error) {
	identity := strings.TrimSpace(recipient.RecipientIdentity)
	if identity == "" {
		identity = RecallRecipientIdentityForUser(recipient.UserId)
	}
	if identity == "" || recipient.CampaignId <= 0 {
		return false, "", nil
	}
	var exclusion RecallCampaignExclusion
	result := tx.Where("campaign_id = ? AND recipient_identity = ? AND persistent = ?", recipient.CampaignId, identity, true).
		Limit(1).
		Find(&exclusion)
	if result.Error != nil {
		return false, "", result.Error
	}
	if result.RowsAffected == 0 {
		return false, "", nil
	}
	reason := sanitizeRecallErrorCode(exclusion.PersistentReasonCode)
	if reason == "" {
		reason = "persistent_exclusion"
	}
	return true, reason, nil
}

func cancelSuppressedRecallEmailFlowTx(tx *gorm.DB, id int64, recipientID int64, owner string, expectedLeaseUntil int64, reasonCode string) (bool, error) {
	now, err := getDBTimestamp(tx)
	if err != nil {
		return false, err
	}
	count, err := TransitionRecallMessagesWithEventsTx(tx, []RecallMessageTransition{{
		MessageID:          id,
		RecipientID:        recipientID,
		From:               RecallMessageLeased,
		To:                 RecallMessageCancelled,
		Owner:              owner,
		ExpectedLeaseUntil: expectedLeaseUntil,
		Fields: map[string]any{
			"next_attempt_at":    int64(0),
			"lease_owner":        "",
			"lease_expires_at":   int64(0),
			"failed_at":          now,
			"last_error_code":    reasonCode,
			"last_error_message": "",
		},
	}})
	if err != nil {
		return false, err
	}
	if count == 0 {
		return false, nil
	}
	_, err = cancelRecallMessagesInBatches(tx, func(afterID int64) *gorm.DB {
		return tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("recipient_id = ? AND id > ? AND (state IN ? OR (state = ? AND lease_owner = ? AND lease_expires_at = ?))", recipientID, afterID, []string{
				RecallMessageScheduled,
				RecallMessageRetryWait,
			}, RecallMessageLeased, owner, expectedLeaseUntil)
	}, 0, reasonCode, now)
	return true, err
}

func CancelRecallEmailFlowWithContext(ctx context.Context, id int64, recipientID int64, owner string, expectedLeaseUntil int64, reasonCode string, now int64) (bool, error) {
	cancelled := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		pendingCancelled := false
		var current RecallMessage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND recipient_id = ? AND state IN ? AND lease_owner = ? AND lease_expires_at = ?", id, recipientID, []string{RecallMessageLeased, RecallMessageSending}, owner, expectedLeaseUntil).
			First(&current).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		count, err := TransitionRecallMessagesWithEventsTx(tx, []RecallMessageTransition{{
			MessageID:          current.Id,
			RecipientID:        recipientID,
			From:               current.State,
			To:                 RecallMessageCancelled,
			Owner:              owner,
			ExpectedLeaseUntil: expectedLeaseUntil,
			Fields: map[string]any{
				"next_attempt_at":    int64(0),
				"lease_owner":        "",
				"lease_expires_at":   int64(0),
				"failed_at":          now,
				"last_error_code":    reasonCode,
				"last_error_message": "",
			},
		}})
		if err != nil {
			return err
		}
		if count == 0 {
			return nil
		}
		pendingCancelled = true
		_, err = cancelRecallMessagesInBatches(tx, func(afterID int64) *gorm.DB {
			return tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("recipient_id = ? AND id > ? AND state IN ?", recipientID, afterID, cancellableRecallMessageStates())
		}, 0, reasonCode, now)
		if err != nil {
			return err
		}
		cancelled = pendingCancelled
		return nil
	})
	if err != nil {
		return false, err
	}
	return cancelled, err
}

func ManualRetryRecallMessageWithContext(ctx context.Context, id int64, acknowledgeUncertain bool, now int64) (bool, error) {
	retried := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		pendingRetried := false
		query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND state = ?", id, RecallMessageFailed)
		if acknowledgeUncertain {
			query = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("id = ? AND (state IN ? OR (state = ? AND lease_expires_at > 0 AND lease_expires_at < ?))", id, []string{RecallMessageFailed, RecallMessageUncertain}, RecallMessageSending, now)
		}
		var message RecallMessage
		if err := query.First(&message).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		count, err := TransitionRecallMessagesWithEventsTx(tx, []RecallMessageTransition{{
			MessageID: message.Id,
			From:      message.State,
			To:        RecallMessageRetryWait,
			Fields: map[string]any{
				"next_attempt_at":    now,
				"failed_at":          int64(0),
				"lease_owner":        "",
				"lease_expires_at":   int64(0),
				"last_error_code":    "",
				"last_error_message": "",
			},
		}})
		if err != nil {
			return err
		}
		pendingRetried = count == 1
		retried = pendingRetried
		return nil
	})
	if err != nil {
		return false, err
	}
	return retried, err
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
	var message RecallMessage
	if err := query.Clauses(clause.Locking{Strength: "UPDATE"}).First(&message).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return false, nil
		}
		return false, err
	}
	count, err := TransitionRecallMessagesWithEventsTx(db, []RecallMessageTransition{{
		MessageID:   message.Id,
		RecipientID: recipientID,
		From:        message.State,
		To:          RecallMessageRetryWait,
		Fields: map[string]any{
			"next_attempt_at":    now,
			"failed_at":          int64(0),
			"lease_owner":        "",
			"lease_expires_at":   int64(0),
			"last_error_code":    "",
			"last_error_message": "",
		},
	}})
	if err != nil {
		return false, err
	}
	return count == 1, nil
}

func ScheduleNextRecallStages(recipientID int64, messages []RecallMessage) error {
	if len(messages) == 0 {
		return nil
	}
	for i := range messages {
		messages[i].RecipientId = recipientID
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		now, err := getDBTimestamp(tx)
		if err != nil {
			return err
		}
		return CreateRecallMessagesWithStateEventsTx(tx, 0, messages, now)
	})
}

func CancelPendingRecallMessages(recipientID int64, reasonCode string, now int64) (int64, error) {
	cancelled := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		count, err := cancelRecallMessagesInBatches(tx, func(afterID int64) *gorm.DB {
			return tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("recipient_id = ? AND id > ? AND state IN ?", recipientID, afterID, cancellableRecallMessageStates())
		}, 0, reasonCode, now)
		if err != nil {
			return err
		}
		cancelled = count
		return nil
	})
	if err != nil {
		return 0, err
	}
	return int64(cancelled), err
}

func cancellableRecallMessageStates() []string {
	return []string{
		RecallMessageScheduled,
		RecallMessageRetryWait,
		RecallMessageLeased,
		RecallMessageSending,
	}
}

func cancelRecallMessagesInBatches(tx *gorm.DB, buildQuery func(afterID int64) *gorm.DB, campaignID int64, reasonCode string, now int64) (int, error) {
	cancelled := 0
	afterID := int64(0)
	for {
		messages := make([]RecallMessage, 0, recallRunBatchSize)
		if err := buildQuery(afterID).
			Order("recall_messages.id ASC").
			Limit(recallRunBatchSize).
			Find(&messages).Error; err != nil {
			return cancelled, err
		}
		if len(messages) == 0 {
			return cancelled, nil
		}
		transitions := make([]RecallMessageTransition, 0, len(messages))
		for _, message := range messages {
			transitions = append(transitions, RecallMessageTransition{
				MessageID:   message.Id,
				RecipientID: message.RecipientId,
				CampaignID:  campaignID,
				From:        message.State,
				To:          RecallMessageCancelled,
				Fields: map[string]any{
					"next_attempt_at":    int64(0),
					"lease_owner":        "",
					"lease_expires_at":   int64(0),
					"last_error_code":    reasonCode,
					"last_error_message": "",
					"failed_at":          now,
				},
			})
			afterID = message.Id
		}
		count, err := TransitionRecallMessagesWithEventsTx(tx, transitions)
		if err != nil {
			return cancelled, err
		}
		cancelled += count
	}
}
