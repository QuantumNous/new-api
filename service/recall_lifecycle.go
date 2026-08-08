package service

import (
	"context"
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
			_, err = resolveRecallLifecycleEventTx(tx, event, w.owner, stored.CampaignId, stored.Id, dbNow)
			return err
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
		Where("campaign_id = ? AND recipient_id = ? AND message_id = ? AND event_type = ? AND source = ?",
			stored.CampaignId, stored.Id, message.Id, "message_state_changed", "message_state").
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
	return result.Error
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
