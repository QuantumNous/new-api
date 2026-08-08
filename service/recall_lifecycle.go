package service

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const recallLifecycleLeaseTTL = 5 * time.Minute
const recallLifecyclePreviewSampleLimit = 5

var errRecallLifecycleFenceLost = errors.New("recall lifecycle lease fence lost")

type RecallLifecyclePreview struct {
	ProcessingStartAt int64                   `json:"processing_start_at"`
	CollectionStartAt int64                   `json:"collection_start_at"`
	EarliestAvailable int64                   `json:"earliest_available_at"`
	EstimatedCount    int64                   `json:"estimated_count"`
	DueCount          int64                   `json:"due_count"`
	Samples           []RecallLifecycleSample `json:"samples"`
}

type RecallLifecycleSample struct {
	ID                    int64  `json:"id"`
	EventType             string `json:"event_type"`
	User                  string `json:"user"`
	ScopeType             string `json:"scope_type"`
	Scope                 string `json:"scope"`
	BusinessKey           string `json:"business_key"`
	RecipientIdentity     string `json:"recipient_identity"`
	Disposition           string `json:"disposition"`
	DispositionReasonCode string `json:"disposition_reason_code,omitempty"`
	OccurredAt            int64  `json:"occurred_at"`
	AvailableAt           int64  `json:"available_at"`
	AttemptCount          int    `json:"attempt_count"`
	LastErrorCode         string `json:"last_error_code,omitempty"`
}

type RecallLifecycleMetrics struct {
	CollectionStartAt           int64            `json:"collection_start_at"`
	ProcessingStartAt           int64            `json:"processing_start_at"`
	EventTotal                  int64            `json:"event_total"`
	PendingNotDueCount          int64            `json:"pending_not_due_count"`
	DueBacklogCount             int64            `json:"due_backlog_count"`
	LeasedCount                 int64            `json:"leased_count"`
	EnrolledCount               int64            `json:"enrolled_count"`
	SkippedCount                int64            `json:"skipped_count"`
	FailedCount                 int64            `json:"failed_count"`
	MessagesQueuedCount         int64            `json:"messages_queued_count"`
	MessagesSMTPAcceptedCount   int64            `json:"messages_smtp_accepted_count"`
	MessagesUncertainCount      int64            `json:"messages_uncertain_count"`
	MessagesFailedCount         int64            `json:"messages_failed_count"`
	MessagesCancelledCount      int64            `json:"messages_cancelled_count"`
	SkipReasonCounts            map[string]int64 `json:"skip_reason_counts"`
	SendBlockedReasonCounts     map[string]int64 `json:"send_blocked_reason_counts"`
	ErrorCodeCounts             map[string]int64 `json:"error_code_counts"`
	RetriedEventCount           int64            `json:"retried_event_count"`
	LeaseRecoveryCount          int64            `json:"lease_recovery_count"`
	LastProcessedAt             int64            `json:"last_processed_at"`
	MaxProcessingLatencySeconds int64            `json:"max_processing_latency_seconds"`
}

type RecallLifecycleWorker struct {
	owner string
	now   func() time.Time
}

func NewRecallLifecycleWorker(owner string) *RecallLifecycleWorker {
	owner = strings.TrimSpace(owner)
	if owner == "" {
		owner = common.GetReplicaID()
	}
	return &RecallLifecycleWorker{
		owner: owner,
		now:   time.Now,
	}
}

func (s *RecallCampaignService) PreviewLifecycle(ctx context.Context, id int64) (*RecallLifecyclePreview, error) {
	if err := validateRecallCampaignContext(ctx); err != nil {
		return nil, err
	}
	var preview *RecallLifecyclePreview
	err := model.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		campaign, marker, dbNow, ok, err := recallLifecycleCampaignBoundaryDB(ctx, tx, id)
		if err != nil || !ok {
			return err
		}
		query := func() *gorm.DB {
			return recallLifecycleBoundaryQueryDB(tx, campaign, marker)
		}
		var estimatedCount int64
		if err := query().Count(&estimatedCount).Error; err != nil {
			return err
		}
		var dueCount int64
		if err := query().
			Where("available_at <= ?", dbNow).
			Where("(next_attempt_at = 0 OR next_attempt_at <= ?)", dbNow).
			Where("(disposition = ? OR (disposition = ? AND lease_expires_at > 0 AND lease_expires_at < ?))",
				model.RecallLifecycleEventPending, model.RecallLifecycleEventLeased, dbNow).
			Count(&dueCount).Error; err != nil {
			return err
		}
		var earliest struct {
			Value int64
		}
		if err := query().Select("MIN(available_at) AS value").Scan(&earliest).Error; err != nil {
			return err
		}
		events := make([]model.RecallLifecycleEvent, 0, recallLifecyclePreviewSampleLimit)
		if err := query().
			Order("available_at ASC").
			Order("occurred_at ASC").
			Order("id ASC").
			Limit(recallLifecyclePreviewSampleLimit).
			Find(&events).Error; err != nil {
			return err
		}
		samples := make([]RecallLifecycleSample, 0, len(events))
		for _, event := range events {
			samples = append(samples, recallLifecycleSample(event))
		}
		preview = &RecallLifecyclePreview{
			ProcessingStartAt: campaign.ProcessingStartAt,
			CollectionStartAt: marker,
			EarliestAvailable: earliest.Value,
			EstimatedCount:    estimatedCount,
			DueCount:          dueCount,
			Samples:           samples,
		}
		return nil
	})
	return preview, err
}

func GetRecallLifecycleMetrics(ctx context.Context, campaignID int64) (*RecallLifecycleMetrics, error) {
	campaign, marker, dbNow, ok, err := recallLifecycleCampaignBoundary(ctx, campaignID)
	if err != nil || !ok {
		return nil, err
	}
	metrics := &RecallLifecycleMetrics{
		CollectionStartAt:       marker,
		ProcessingStartAt:       campaign.ProcessingStartAt,
		SkipReasonCounts:        map[string]int64{},
		SendBlockedReasonCounts: map[string]int64{},
		ErrorCodeCounts:         map[string]int64{},
	}
	base := func() *gorm.DB {
		return recallLifecycleBoundaryQuery(ctx, campaign, marker)
	}
	if err := base().Count(&metrics.EventTotal).Error; err != nil {
		return nil, err
	}
	if err := base().Where("disposition = ? AND (available_at > ? OR next_attempt_at > ?)", model.RecallLifecycleEventPending, dbNow, dbNow).Count(&metrics.PendingNotDueCount).Error; err != nil {
		return nil, err
	}
	if err := base().Where("available_at <= ?", dbNow).
		Where("(next_attempt_at = 0 OR next_attempt_at <= ?)", dbNow).
		Where("(disposition = ? OR (disposition = ? AND lease_expires_at > 0 AND lease_expires_at < ?))",
			model.RecallLifecycleEventPending, model.RecallLifecycleEventLeased, dbNow).
		Count(&metrics.DueBacklogCount).Error; err != nil {
		return nil, err
	}
	dispositionCounts, err := recallLifecycleCountBy(ctx, base(), "disposition")
	if err != nil {
		return nil, err
	}
	metrics.LeasedCount = dispositionCounts[model.RecallLifecycleEventLeased]
	metrics.EnrolledCount = dispositionCounts[model.RecallLifecycleEventEnrolled]
	metrics.SkippedCount = dispositionCounts[model.RecallLifecycleEventSkipped]
	metrics.FailedCount = dispositionCounts[model.RecallLifecycleEventFailed]
	metrics.SkipReasonCounts, err = recallLifecycleCountBy(ctx, base().Where("disposition = ?", model.RecallLifecycleEventSkipped), "disposition_reason_code")
	if err != nil {
		return nil, err
	}
	metrics.ErrorCodeCounts, err = recallLifecycleCountBy(ctx, base().Where("last_error_code <> ''"), "last_error_code")
	if err != nil {
		return nil, err
	}
	if err := base().Where("attempt_count > 1").Count(&metrics.RetriedEventCount).Error; err != nil {
		return nil, err
	}
	if err := base().Where("disposition = ? AND lease_expires_at > 0 AND lease_expires_at < ?", model.RecallLifecycleEventLeased, dbNow).Count(&metrics.LeaseRecoveryCount).Error; err != nil {
		return nil, err
	}
	processing := struct {
		LastProcessedAt             int64
		MaxProcessingLatencySeconds int64
	}{}
	if err := base().Select("MAX(CASE WHEN resolved_at > processed_at THEN resolved_at ELSE processed_at END) AS last_processed_at, MAX(CASE WHEN resolved_at > 0 AND available_at > 0 AND resolved_at >= available_at THEN resolved_at - available_at WHEN processed_at > 0 AND available_at > 0 AND processed_at >= available_at THEN processed_at - available_at ELSE 0 END) AS max_processing_latency_seconds").
		Scan(&processing).Error; err != nil {
		return nil, err
	}
	metrics.LastProcessedAt = processing.LastProcessedAt
	metrics.MaxProcessingLatencySeconds = processing.MaxProcessingLatencySeconds
	if err := recallLifecycleMessageMetrics(ctx, campaignID, metrics); err != nil {
		return nil, err
	}
	return metrics, nil
}

func recallLifecycleBoundaryQuery(ctx context.Context, campaign *model.RecallCampaign, marker int64) *gorm.DB {
	return recallLifecycleBoundaryQueryDB(model.DB.WithContext(ctx), campaign, marker)
}

func recallLifecycleBoundaryQueryDB(db *gorm.DB, campaign *model.RecallCampaign, marker int64) *gorm.DB {
	return db.Model(&model.RecallLifecycleEvent{}).
		Where("event_type = ?", campaign.LifecycleTrigger).
		Where("occurred_at >= ?", marker).
		Where("available_at >= ?", campaign.ProcessingStartAt)
}

func recallLifecycleCampaignBoundary(ctx context.Context, id int64) (*model.RecallCampaign, int64, int64, bool, error) {
	if ctx == nil {
		return nil, 0, 0, false, fmt.Errorf("context is nil")
	}
	if id <= 0 {
		return nil, 0, 0, false, fmt.Errorf("recall campaign ID must be positive")
	}
	return recallLifecycleCampaignBoundaryDB(ctx, model.DB.WithContext(ctx), id)
}

func recallLifecycleCampaignBoundaryDB(ctx context.Context, db *gorm.DB, id int64) (*model.RecallCampaign, int64, int64, bool, error) {
	if db == nil {
		return nil, 0, 0, false, fmt.Errorf("database is not initialized")
	}
	var campaign model.RecallCampaign
	err := db.First(&campaign, id).Error
	if err != nil {
		return nil, 0, 0, false, err
	}
	if campaign.ExecutionMode != "continuous" {
		return &campaign, 0, 0, false, nil
	}
	var option model.Option
	if err := db.First(&option, "key = ?", model.OptionKeyRecallLifecycleEventCollectionStartedAt).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, 0, 0, false, fmt.Errorf("recall lifecycle event collection marker: recall lifecycle event collection marker is missing")
		}
		return nil, 0, 0, false, err
	}
	marker, err := parseRecallLifecycleMarker(option.Value)
	if err != nil {
		return nil, 0, 0, false, fmt.Errorf("recall lifecycle event collection marker: %w", err)
	}
	dbNow, err := getDBTimestampForLifecycleTx(db)
	if err != nil {
		return nil, 0, 0, false, err
	}
	if campaign.ProcessingStartAt < marker || campaign.ProcessingStartAt > dbNow {
		return nil, 0, 0, false, fmt.Errorf("continuous recall campaign processing start must be between lifecycle event collection marker and database time")
	}
	return &campaign, marker, dbNow, true, nil
}

func recallLifecycleSample(event model.RecallLifecycleEvent) RecallLifecycleSample {
	return RecallLifecycleSample{
		ID:                    event.Id,
		EventType:             event.EventType,
		User:                  maskedRecallLifecycleValue(fmt.Sprintf("user:%d", event.UserId)),
		ScopeType:             event.ScopeType,
		Scope:                 maskedRecallLifecycleValue(event.ScopeId),
		BusinessKey:           maskedRecallLifecycleValue(event.BusinessKey),
		RecipientIdentity:     maskedRecallLifecycleValue(event.RecipientIdentity),
		Disposition:           event.Disposition,
		DispositionReasonCode: event.DispositionReasonCode,
		OccurredAt:            event.OccurredAt,
		AvailableAt:           event.AvailableAt,
		AttemptCount:          event.AttemptCount,
		LastErrorCode:         safeRecallLifecycleErrorCode(event.LastErrorCode),
	}
}

func maskedRecallLifecycleValue(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(value))
	return fmt.Sprintf("sha256:%x", sum[:6])
}

func safeRecallLifecycleErrorCode(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return ""
	}
	var builder strings.Builder
	for _, char := range value {
		switch {
		case char >= 'a' && char <= 'z':
			builder.WriteRune(char)
		case char >= '0' && char <= '9':
			builder.WriteRune(char)
		case char == '_' || char == '-':
			builder.WriteRune(char)
		}
		if builder.Len() >= 64 {
			break
		}
	}
	return builder.String()
}

func recallLifecycleCountBy(ctx context.Context, base *gorm.DB, column string) (map[string]int64, error) {
	rows := make([]struct {
		Key   string
		Count int64
	}, 0)
	if err := base.Session(&gorm.Session{}).
		Select(column + " AS key, COUNT(*) AS count").
		Where(column + " <> ''").
		Group(column).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	counts := make(map[string]int64, len(rows))
	for _, row := range rows {
		key := safeRecallLifecycleErrorCode(row.Key)
		if key != "" {
			counts[key] = row.Count
		}
	}
	return counts, nil
}

func recallLifecycleMessageMetrics(ctx context.Context, campaignID int64, metrics *RecallLifecycleMetrics) error {
	rows := make([]struct {
		State string
		Count int64
	}, 0)
	if err := model.DB.WithContext(ctx).Model(&model.RecallMessage{}).
		Joins("JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id").
		Where("recall_recipients.campaign_id = ?", campaignID).
		Select("recall_messages.state AS state, COUNT(*) AS count").
		Group("recall_messages.state").
		Find(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		switch row.State {
		case model.RecallMessageScheduled, model.RecallMessageRetryWait, model.RecallMessageLeased, model.RecallMessageSending:
			metrics.MessagesQueuedCount += row.Count
		case model.RecallMessageAccepted:
			metrics.MessagesSMTPAcceptedCount += row.Count
		case model.RecallMessageUncertain:
			metrics.MessagesUncertainCount += row.Count
		case model.RecallMessageFailed:
			metrics.MessagesFailedCount += row.Count
		case model.RecallMessageCancelled:
			metrics.MessagesCancelledCount += row.Count
		}
	}
	reasons, err := recallLifecycleMessageReasonCounts(ctx, campaignID)
	if err != nil {
		return err
	}
	metrics.SendBlockedReasonCounts = reasons
	return nil
}

func recallLifecycleMessageReasonCounts(ctx context.Context, campaignID int64) (map[string]int64, error) {
	rows := make([]struct {
		Key   string
		Count int64
	}, 0)
	if err := model.DB.WithContext(ctx).Model(&model.RecallMessage{}).
		Joins("JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id").
		Where("recall_recipients.campaign_id = ?", campaignID).
		Where("recall_messages.last_error_code <> ''").
		Select("recall_messages.last_error_code AS key, COUNT(*) AS count").
		Group("recall_messages.last_error_code").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	counts := make(map[string]int64, len(rows))
	for _, row := range rows {
		key := safeRecallLifecycleErrorCode(row.Key)
		if key != "" {
			counts[key] = row.Count
		}
	}
	return counts, nil
}

func (w *RecallLifecycleWorker) RunBatch(ctx context.Context, limit int) (int, error) {
	if w == nil {
		return 0, fmt.Errorf("recall lifecycle worker is nil")
	}
	if limit <= 0 {
		return 0, nil
	}
	dbNow, err := model.GetDBTimestampWithContext(ctx)
	if err != nil {
		return 0, err
	}
	due, err := model.ListDueRecallLifecycleEvents(ctx, dbNow, limit)
	if err != nil {
		return 0, err
	}
	enrolled := 0
	for _, event := range due {
		if err := ctx.Err(); err != nil {
			return enrolled, err
		}
		claimed, won, err := model.ClaimDueRecallLifecycleEvent(ctx, event.Id, w.owner, dbNow, dbNow+int64(recallLifecycleLeaseTTL.Seconds()))
		if err != nil {
			return enrolled, err
		}
		if !won || claimed == nil {
			continue
		}
		created, err := w.enrollClaimedEvent(ctx, *claimed)
		if err != nil {
			if errors.Is(err, errRecallLifecycleFenceLost) {
				continue
			}
			deferred, deferErr := model.DeferRecallLifecycleEvent(ctx, model.RecallLifecycleEventDeferral{
				EventID:              claimed.Id,
				Owner:                w.owner,
				LeaseEpoch:           claimed.LeaseEpoch,
				ExpectedLeaseExpires: claimed.LeaseExpiresAt,
				ErrorCode:            recallLifecycleTransientErrorCode(err),
			})
			if deferErr != nil {
				return enrolled, deferErr
			}
			if !deferred {
				continue
			}
			continue
		}
		if created {
			enrolled++
		}
	}
	return enrolled, nil
}

func (w *RecallLifecycleWorker) enrollClaimedEvent(ctx context.Context, claimed model.RecallLifecycleEvent) (bool, error) {
	dbNow, err := model.GetDBTimestampWithContext(ctx)
	if err != nil {
		return false, err
	}
	created := false
	err = model.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var event model.RecallLifecycleEvent
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND disposition = ? AND lease_owner = ? AND lease_epoch = ? AND lease_expires_at > ?",
				claimed.Id, model.RecallLifecycleEventLeased, w.owner, claimed.LeaseEpoch, dbNow).
			First(&event).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		if _, err := decodeRecallLifecycleEventData(event.EventData); err != nil {
			return skipRecallLifecycleEventTx(tx, event, w.owner, "malformed_event_data", dbNow)
		}
		campaign, ok, err := loadRecallLifecycleCampaignForEventTx(tx, event, dbNow)
		if err != nil || !ok {
			return err
		}
		recipient, message, err := recallLifecycleEnrollmentRowsTx(tx, campaign, event, dbNow)
		if err != nil {
			return skipRecallLifecycleEventTx(tx, event, w.owner, recallLifecycleEnrollmentErrorCode(err), dbNow)
		}
		insertResult := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "lifecycle_event_id"}},
			DoNothing: true,
		}).Create(&recipient)
		if insertResult.Error != nil {
			return insertResult.Error
		}
		var stored model.RecallRecipient
		if err := tx.Where("lifecycle_event_id = ?", event.Id).First(&stored).Error; err != nil {
			return err
		}
		expectedIdentity := model.RecallLifecycleRecipientIdentity(event.EventType, event.OccurrenceKeyHash)
		if !recallLifecycleStoredRecipientMatchesEvent(stored, event, expectedIdentity) {
			return skipRecallLifecycleEventTx(tx, event, w.owner, "lifecycle_recipient_inconsistent", dbNow)
		}
		if stored.CampaignId != campaign.Id {
			complete, err := recallLifecycleExistingEnrollmentCompleteTx(tx, stored, event)
			if err != nil {
				return err
			}
			if !complete {
				return skipRecallLifecycleEventTx(tx, event, w.owner, "lifecycle_recipient_inconsistent", dbNow)
			}
			resolved, err := resolveRecallLifecycleEventTx(tx, event, w.owner, stored.CampaignId, stored.Id, dbNow)
			if err != nil {
				return err
			}
			if !resolved {
				return errRecallLifecycleFenceLost
			}
			return nil
		}
		message.RecipientId = stored.Id
		if err := model.CreateRecallMessagesWithStateEventsTx(tx, stored.CampaignId, []model.RecallMessage{message}, dbNow); err != nil {
			return err
		}
		complete, err := recallLifecycleExistingEnrollmentCompleteTx(tx, stored, event)
		if err != nil {
			return err
		}
		if !complete {
			return skipRecallLifecycleEventTx(tx, event, w.owner, "lifecycle_message_inconsistent", dbNow)
		}
		resolved, err := resolveRecallLifecycleEventTx(tx, event, w.owner, stored.CampaignId, stored.Id, dbNow)
		if err != nil {
			return err
		}
		if !resolved {
			return errRecallLifecycleFenceLost
		}
		if resolved && insertResult.RowsAffected == 1 {
			created = true
		}
		return nil
	})
	return created, err
}

func loadRecallLifecycleCampaignForEventTx(tx *gorm.DB, event model.RecallLifecycleEvent, now int64) (model.RecallCampaign, bool, error) {
	var marker model.Option
	if err := tx.First(&marker, "key = ?", model.OptionKeyRecallLifecycleEventCollectionStartedAt).Error; err != nil {
		return model.RecallCampaign{}, false, err
	}
	markerAt, err := parseRecallLifecycleMarker(marker.Value)
	if err != nil {
		return model.RecallCampaign{}, false, err
	}
	var campaign model.RecallCampaign
	err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Model(&model.RecallCampaign{}).
		Select("recall_campaigns.*").
		Joins("JOIN recall_continuous_trigger_slots ON recall_continuous_trigger_slots.campaign_id = recall_campaigns.id").
		Where("recall_continuous_trigger_slots.trigger = ?", event.EventType).
		Where("recall_campaigns.status = ? AND recall_campaigns.execution_mode = ? AND recall_campaigns.lifecycle_trigger = ?",
			model.RecallCampaignRunning, "continuous", event.EventType).
		First(&campaign).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return model.RecallCampaign{}, false, nil
		}
		return model.RecallCampaign{}, false, err
	}
	if event.OccurredAt < markerAt || event.AvailableAt < campaign.ProcessingStartAt || event.AvailableAt > now {
		return model.RecallCampaign{}, false, nil
	}
	return campaign, true, nil
}

func recallLifecycleEnrollmentRowsTx(tx *gorm.DB, campaign model.RecallCampaign, event model.RecallLifecycleEvent, now int64) (model.RecallRecipient, model.RecallMessage, error) {
	if event.UserId <= 0 {
		return model.RecallRecipient{}, model.RecallMessage{}, fmt.Errorf("missing_user")
	}
	var user model.User
	if err := tx.First(&user, event.UserId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return model.RecallRecipient{}, model.RecallMessage{}, fmt.Errorf("missing_user")
		}
		return model.RecallRecipient{}, model.RecallMessage{}, err
	}
	email, ok := normalizeRecallLifecycleEmail(user.Email)
	if !ok {
		return model.RecallRecipient{}, model.RecallMessage{}, fmt.Errorf("invalid_email")
	}
	var stages []RecallEmailStage
	if err := common.Unmarshal([]byte(campaign.EmailSequenceConfig), &stages); err != nil {
		return model.RecallRecipient{}, model.RecallMessage{}, fmt.Errorf("invalid_email_sequence")
	}
	var stage *RecallEmailStage
	for i := range stages {
		if stages[i].StageNo == 1 {
			stage = &stages[i]
			break
		}
	}
	if stage == nil {
		return model.RecallRecipient{}, model.RecallMessage{}, fmt.Errorf("missing_stage_one")
	}
	templateJSON, err := common.Marshal(stage.Templates)
	if err != nil {
		return model.RecallRecipient{}, model.RecallMessage{}, err
	}
	eventID := event.Id
	scheduledAt := event.AvailableAt + stage.DelaySeconds
	if scheduledAt <= 0 {
		scheduledAt = now + stage.DelaySeconds
	}
	recipient := model.RecallRecipient{
		CampaignId:          campaign.Id,
		LifecycleEventId:    &eventID,
		RecipientIdentity:   model.RecallLifecycleRecipientIdentity(event.EventType, event.OccurrenceKeyHash),
		UserId:              event.UserId,
		EligibilitySnapshot: event.EventData,
		EmailSnapshot:       email,
		LanguageSnapshot:    "en",
		State:               model.RecallRecipientContacting,
	}
	message := model.RecallMessage{
		StageNo:          1,
		TemplateVersion:  stage.TemplateVersion,
		TemplateSnapshot: string(templateJSON),
		ScheduledAt:      scheduledAt,
		State:            model.RecallMessageScheduled,
	}
	return recipient, message, nil
}

func recallLifecycleStoredRecipientMatchesEvent(stored model.RecallRecipient, event model.RecallLifecycleEvent, expectedIdentity string) bool {
	if stored.LifecycleEventId == nil || *stored.LifecycleEventId != event.Id {
		return false
	}
	if strings.TrimSpace(stored.RecipientIdentity) != expectedIdentity {
		return false
	}
	return stored.UserId == event.UserId
}

func recallLifecycleExistingEnrollmentCompleteTx(tx *gorm.DB, stored model.RecallRecipient, event model.RecallLifecycleEvent) (bool, error) {
	var campaign model.RecallCampaign
	if err := tx.Select("id", "status", "execution_mode", "lifecycle_trigger").
		First(&campaign, stored.CampaignId).Error; err != nil {
		return false, err
	}
	if campaign.ExecutionMode != "continuous" || campaign.LifecycleTrigger != event.EventType {
		return false, nil
	}
	switch campaign.Status {
	case model.RecallCampaignRunning, model.RecallCampaignPaused, model.RecallCampaignCancelled, model.RecallCampaignCompleted:
	default:
		return false, nil
	}
	var message model.RecallMessage
	if err := tx.Where("recipient_id = ? AND stage_no = ?", stored.Id, 1).First(&message).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return false, nil
		}
		return false, err
	}
	var stateEvents int64
	if err := tx.Model(&model.RecallEvent{}).
		Where("campaign_id = ? AND recipient_id = ? AND message_id = ? AND event_type = ? AND source = ? AND source_event_id = ?",
			stored.CampaignId, stored.Id, message.Id, "message_state_changed", "message_state", fmt.Sprintf("%d:1", message.Id)).
		Count(&stateEvents).Error; err != nil {
		return false, err
	}
	return stateEvents == 1, nil
}

func resolveRecallLifecycleEventTx(tx *gorm.DB, event model.RecallLifecycleEvent, owner string, campaignID int64, recipientID int64, resolvedAt int64) (bool, error) {
	dbNow, err := getDBTimestampForLifecycleTx(tx)
	if err != nil {
		return false, err
	}
	result := tx.Model(&model.RecallLifecycleEvent{}).
		Where("id = ? AND disposition = ? AND lease_owner = ? AND lease_epoch = ? AND lease_expires_at = ? AND lease_expires_at > ?",
			event.Id, model.RecallLifecycleEventLeased, strings.TrimSpace(owner), event.LeaseEpoch, event.LeaseExpiresAt, dbNow).
		Updates(map[string]any{
			"disposition":             model.RecallLifecycleEventEnrolled,
			"disposition_reason_code": "",
			"campaign_id":             campaignID,
			"recipient_id":            recipientID,
			"processed_at":            resolvedAt,
			"resolved_at":             resolvedAt,
			"lease_owner":             "",
			"lease_expires_at":        int64(0),
			"last_error_code":         "",
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func decodeRecallLifecycleEventData(value string) (map[string]any, error) {
	var data map[string]any
	if strings.TrimSpace(value) == "" {
		value = `{}`
	}
	if err := common.Unmarshal([]byte(value), &data); err != nil {
		return nil, err
	}
	return data, nil
}

func normalizeRecallLifecycleEmail(value string) (string, bool) {
	value = strings.TrimSpace(value)
	parsed, err := mail.ParseAddress(value)
	if err != nil || parsed.Address != value {
		return "", false
	}
	return strings.ToLower(value), true
}

func parseRecallLifecycleMarker(value string) (int64, error) {
	marker, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil || marker <= 0 {
		return 0, fmt.Errorf("malformed_collection_marker")
	}
	return marker, nil
}

func skipRecallLifecycleEventTx(tx *gorm.DB, event model.RecallLifecycleEvent, owner string, reasonCode string, resolvedAt int64) error {
	reasonCode = recallLifecycleEnrollmentErrorCode(fmt.Errorf("%s", reasonCode))
	dbNow, err := getDBTimestampForLifecycleTx(tx)
	if err != nil {
		return err
	}
	result := tx.Model(&model.RecallLifecycleEvent{}).
		Where("id = ? AND disposition = ? AND lease_owner = ? AND lease_epoch = ? AND lease_expires_at = ? AND lease_expires_at > ?",
			event.Id, model.RecallLifecycleEventLeased, strings.TrimSpace(owner), event.LeaseEpoch, event.LeaseExpiresAt, dbNow).
		Updates(map[string]any{
			"disposition":             model.RecallLifecycleEventSkipped,
			"disposition_reason_code": reasonCode,
			"last_error_code":         reasonCode,
			"resolved_at":             resolvedAt,
			"lease_owner":             "",
			"lease_expires_at":        int64(0),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errRecallLifecycleFenceLost
	}
	return nil
}

func recallLifecycleEnrollmentErrorCode(err error) string {
	code := strings.TrimSpace(err.Error())
	switch code {
	case "malformed_event_data", "missing_user", "invalid_email", "invalid_email_sequence", "missing_stage_one", "lifecycle_recipient_inconsistent", "lifecycle_message_inconsistent":
		return code
	default:
		return "lifecycle_enrollment_failed"
	}
}

func recallLifecycleTransientErrorCode(err error) string {
	code := strings.TrimSpace(err.Error())
	if code == "" {
		return "lifecycle_enrollment_retry"
	}
	return code
}

func getDBTimestampForLifecycleTx(tx *gorm.DB) (int64, error) {
	if tx == nil || tx.Dialector == nil {
		return 0, fmt.Errorf("database is not initialized")
	}
	query := "SELECT UNIX_TIMESTAMP()"
	switch tx.Dialector.Name() {
	case "postgres":
		query = "SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::bigint"
	case "sqlite":
		query = "SELECT strftime('%s','now')"
	case "mysql":
		query = "SELECT UNIX_TIMESTAMP()"
	}
	var ts int64
	if err := tx.Raw(query).Scan(&ts).Error; err != nil {
		return 0, err
	}
	if ts <= 0 {
		return 0, fmt.Errorf("database timestamp query returned non-positive timestamp: %d", ts)
	}
	return ts, nil
}
