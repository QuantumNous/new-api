package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestRecallLifecycleEnrollmentCreatesOneOccurrenceRecipientAndStageOneMessage(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, campaign := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	event := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 301, 120, 120, `{}`)

	worker := NewRecallLifecycleWorker("node-a")
	enrolled, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, enrolled)

	var storedEvent model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&storedEvent, event.Id).Error)
	require.Equal(t, model.RecallLifecycleEventEnrolled, storedEvent.Disposition)
	require.Equal(t, campaign.Id, storedEvent.CampaignId)
	require.NotZero(t, storedEvent.RecipientId)

	var recipients []model.RecallRecipient
	require.NoError(t, model.DB.Find(&recipients).Error)
	require.Len(t, recipients, 1)
	require.Equal(t, campaign.Id, recipients[0].CampaignId)
	require.Equal(t, event.Id, *recipients[0].LifecycleEventId)
	require.Equal(t, model.RecallLifecycleRecipientIdentity(event.EventType, event.OccurrenceKeyHash), recipients[0].RecipientIdentity)
	require.Equal(t, model.RecallRecipientContacting, recipients[0].State)

	var messages []model.RecallMessage
	require.NoError(t, model.DB.Find(&messages).Error)
	require.Len(t, messages, 1)
	require.Equal(t, recipients[0].Id, messages[0].RecipientId)
	require.Equal(t, 1, messages[0].StageNo)
	require.Equal(t, model.RecallMessageScheduled, messages[0].State)
	require.EqualValues(t, 120, messages[0].ScheduledAt)

	var stateEvents int64
	require.NoError(t, model.DB.Model(&model.RecallEvent{}).
		Where("campaign_id = ? AND recipient_id = ? AND message_id = ? AND event_type = ? AND source = ?",
			campaign.Id, recipients[0].Id, messages[0].Id, "message_state_changed", "message_state").
		Count(&stateEvents).Error)
	require.EqualValues(t, 1, stateEvents)

	again, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, again)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Count(new(int64)).Error)
}

func TestRecallLifecyclePausedCampaignDoesNotEnroll(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignPaused, 100)
	event := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 311, 120, 120, `{}`)

	enrolled, err := NewRecallLifecycleWorker("node-a").RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, enrolled)

	var stored model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&stored, event.Id).Error)
	require.Equal(t, model.RecallLifecycleEventPending, stored.Disposition)
	var recipients int64
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Count(&recipients).Error)
	require.Zero(t, recipients)
}

func TestEnrollClaimedLifecycleEventDefersWhenCampaignBecomesUnavailable(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(t *testing.T, campaign model.RecallCampaign)
	}{
		{
			name: "paused",
			mutate: func(t *testing.T, campaign model.RecallCampaign) {
				t.Helper()
				require.NoError(t, model.DB.Model(&model.RecallCampaign{}).
					Where("id = ?", campaign.Id).
					Update("status", model.RecallCampaignPaused).Error)
			},
		},
		{
			name: "cancelled",
			mutate: func(t *testing.T, campaign model.RecallCampaign) {
				t.Helper()
				require.NoError(t, model.DB.Model(&model.RecallCampaign{}).
					Where("id = ?", campaign.Id).
					Update("status", model.RecallCampaignCancelled).Error)
			},
		},
		{
			name: "slot missing",
			mutate: func(t *testing.T, campaign model.RecallCampaign) {
				t.Helper()
				require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
					Where("trigger = ?", campaign.LifecycleTrigger).
					Update("campaign_id", int64(0)).Error)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupRecallLifecycleServiceTestDB(t)
			setRecallCampaignEnabled(t, true)
			_, campaign := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
			event := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 321, 120, 120, `{}`)
			worker := NewRecallLifecycleWorker("node-a")
			dbNow, err := model.GetDBTimestampWithContext(context.Background())
			require.NoError(t, err)
			claimed, won, err := model.ClaimDueRecallLifecycleEvent(context.Background(), event.Id, worker.owner, dbNow, dbNow+300)
			require.NoError(t, err)
			require.True(t, won)
			require.NotNil(t, claimed)

			tt.mutate(t, campaign)
			created, err := worker.enrollClaimedEvent(context.Background(), *claimed)

			require.NoError(t, err)
			require.False(t, created)
			var stored model.RecallLifecycleEvent
			require.NoError(t, model.DB.First(&stored, event.Id).Error)
			require.Equal(t, model.RecallLifecycleEventPending, stored.Disposition)
			require.Empty(t, stored.LeaseOwner)
			require.Zero(t, stored.LeaseExpiresAt)
			require.NotZero(t, stored.NextAttemptAt)
			require.Equal(t, "lifecycle_campaign_unavailable", stored.LastErrorCode)
			require.Equal(t, "lifecycle_campaign_unavailable", stored.DispositionReasonCode)
			var recipients int64
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Count(&recipients).Error)
			require.Zero(t, recipients)
		})
	}
}

func TestRecallLifecycleEnrollmentBoundaryRecoveryAndCampaignReplacement(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, first := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignCancelled, 100)
	_, replacement := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ?", model.RecallLifecycleTriggerQuotaLow).
		Update("campaign_id", replacement.Id).Error)
	event := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 302, 150, 150, `{}`)

	enrolled, err := NewRecallLifecycleWorker("node-a").RunBatch(context.Background(), 1)
	require.NoError(t, err)
	require.Equal(t, 1, enrolled)
	require.NotEqual(t, first.Id, replacement.Id)

	var recipient model.RecallRecipient
	require.NoError(t, model.DB.First(&recipient, "lifecycle_event_id = ?", event.Id).Error)
	require.Equal(t, replacement.Id, recipient.CampaignId)

	dup := model.RecallRecipient{
		CampaignId:          first.Id,
		LifecycleEventId:    &event.Id,
		RecipientIdentity:   model.RecallLifecycleRecipientIdentity(event.EventType, event.OccurrenceKeyHash),
		UserId:              event.UserId,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "duplicate@example.com",
		LanguageSnapshot:    "en",
		State:               model.RecallRecipientContacting,
	}
	require.Error(t, model.DB.Create(&dup).Error)
}

func TestRecallLifecycleEnrollmentSkipsMalformedTerminalAndContinues(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	bad := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 401, 120, 120, `{not-json`)
	good := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 402, 121, 121, `{}`)

	enrolled, err := NewRecallLifecycleWorker("node-a").RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, enrolled)

	var badStored model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&badStored, bad.Id).Error)
	require.Equal(t, model.RecallLifecycleEventSkipped, badStored.Disposition)
	require.Equal(t, "malformed_event_data", badStored.DispositionReasonCode)
	require.NotZero(t, badStored.ResolvedAt)

	var goodStored model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&goodStored, good.Id).Error)
	require.Equal(t, model.RecallLifecycleEventEnrolled, goodStored.Disposition)
}

func TestRecallLifecycleRetryTransientEnrollmentDefersAndContinuesBatch(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	transient := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 601, 120, 120, `{}`)
	good := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 602, 121, 121, `{}`)
	injectRecallRecipientCreateErrorOnce(t, 601, errors.New("temporary insert outage order=raw-601"))

	enrolled, err := NewRecallLifecycleWorker("node-a").RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, enrolled)

	var retryEvent model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&retryEvent, transient.Id).Error)
	require.Equal(t, model.RecallLifecycleEventPending, retryEvent.Disposition)
	require.Empty(t, retryEvent.LeaseOwner)
	require.Zero(t, retryEvent.LeaseExpiresAt)
	require.NotZero(t, retryEvent.NextAttemptAt)
	require.Equal(t, "temporaryinsertoutageorderraw-601", retryEvent.LastErrorCode)

	var goodEvent model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&goodEvent, good.Id).Error)
	require.Equal(t, model.RecallLifecycleEventEnrolled, goodEvent.Disposition)
}

func TestRecallLifecycleResolveRollbackAfterMessageInsertLeaseTakeover(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	event := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 603, 120, 120, `{}`)
	stealRecallLifecycleLeaseBeforeFinalUpdateOnce(t, event.Id, "node-b")

	enrolled, err := NewRecallLifecycleWorker("node-a").RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, enrolled)

	var recipients, messages, stateEvents int64
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Count(&recipients).Error)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Count(&messages).Error)
	require.NoError(t, model.DB.Model(&model.RecallEvent{}).Count(&stateEvents).Error)
	require.Zero(t, recipients)
	require.Zero(t, messages)
	require.Zero(t, stateEvents)

	var stolen model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&stolen, event.Id).Error)
	require.Equal(t, model.RecallLifecycleEventLeased, stolen.Disposition)
	require.Equal(t, "node-a", stolen.LeaseOwner)
	require.EqualValues(t, 1, stolen.LeaseEpoch)

	require.NoError(t, model.DB.Model(&model.RecallLifecycleEvent{}).
		Where("id = ?", event.Id).
		Updates(map[string]any{
			"disposition":      model.RecallLifecycleEventPending,
			"lease_owner":      "",
			"lease_expires_at": int64(0),
			"next_attempt_at":  int64(0),
		}).Error)

	enrolled, err = NewRecallLifecycleWorker("node-b").RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, enrolled)

	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Count(&recipients).Error)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Count(&messages).Error)
	require.NoError(t, model.DB.Model(&model.RecallEvent{}).Count(&stateEvents).Error)
	require.EqualValues(t, 1, recipients)
	require.EqualValues(t, 1, messages)
	require.EqualValues(t, 1, stateEvents)
}

func TestRecallLifecycleReplacementConflictHalfFinishedDoesNotCreateOldCampaignMessage(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, oldCampaign := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignCancelled, 100)
	_, replacement := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ?", model.RecallLifecycleTriggerQuotaLow).
		Update("campaign_id", replacement.Id).Error)
	event := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 701, 120, 120, `{}`)
	createRecallLifecycleExistingRecipient(t, oldCampaign.Id, event)

	enrolled, err := NewRecallLifecycleWorker("node-a").RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, enrolled)

	var recipients, messages int64
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Count(&recipients).Error)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Count(&messages).Error)
	require.EqualValues(t, 1, recipients)
	require.Zero(t, messages)

	var stored model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&stored, event.Id).Error)
	require.Equal(t, model.RecallLifecycleEventSkipped, stored.Disposition)
	require.Equal(t, "lifecycle_recipient_inconsistent", stored.DispositionReasonCode)
}

func TestRecallLifecycleReplacementConflictCompleteIdempotentRecovery(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, oldCampaign := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignCancelled, 100)
	_, replacement := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ?", model.RecallLifecycleTriggerQuotaLow).
		Update("campaign_id", replacement.Id).Error)
	event := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 702, 120, 120, `{}`)
	recipient := createRecallLifecycleExistingRecipient(t, oldCampaign.Id, event)
	createRecallLifecycleExistingStageOne(t, oldCampaign.Id, recipient.Id)

	enrolled, err := NewRecallLifecycleWorker("node-a").RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, enrolled)

	var recipients, messages int64
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Count(&recipients).Error)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Count(&messages).Error)
	require.EqualValues(t, 1, recipients)
	require.EqualValues(t, 1, messages)

	var stored model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&stored, event.Id).Error)
	require.Equal(t, model.RecallLifecycleEventEnrolled, stored.Disposition)
	require.Equal(t, oldCampaign.Id, stored.CampaignId)
	require.Equal(t, recipient.Id, stored.RecipientId)
}

func TestRecallLifecycleReplacementConflictCompleteWithLaterStateEventRecovers(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, oldCampaign := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignCancelled, 100)
	_, replacement := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ?", model.RecallLifecycleTriggerQuotaLow).
		Update("campaign_id", replacement.Id).Error)
	event := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 703, 120, 120, `{}`)
	recipient := createRecallLifecycleExistingRecipient(t, oldCampaign.Id, event)
	message := createRecallLifecycleExistingStageOne(t, oldCampaign.Id, recipient.Id)
	createRecallLifecycleLaterStateEvent(t, oldCampaign.Id, recipient.Id, message.Id)

	enrolled, err := NewRecallLifecycleWorker("node-a").RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, enrolled)

	var recipients, messages int64
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Count(&recipients).Error)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Count(&messages).Error)
	require.EqualValues(t, 1, recipients)
	require.EqualValues(t, 1, messages)

	var stored model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&stored, event.Id).Error)
	require.Equal(t, model.RecallLifecycleEventEnrolled, stored.Disposition)
	require.Equal(t, oldCampaign.Id, stored.CampaignId)
	require.Equal(t, recipient.Id, stored.RecipientId)
}

func TestRecallLifecycleReplacementConflictNonBaselineStateEventIsInconsistent(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, oldCampaign := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignCancelled, 100)
	_, replacement := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ?", model.RecallLifecycleTriggerQuotaLow).
		Update("campaign_id", replacement.Id).Error)
	event := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 704, 120, 120, `{}`)
	recipient := createRecallLifecycleExistingRecipient(t, oldCampaign.Id, event)
	message := createRecallLifecycleExistingStageOneWithoutBaseline(t, recipient.Id)
	createRecallLifecycleLaterStateEvent(t, oldCampaign.Id, recipient.Id, message.Id)

	enrolled, err := NewRecallLifecycleWorker("node-a").RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, enrolled)

	var recipients, messages int64
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Count(&recipients).Error)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Count(&messages).Error)
	require.EqualValues(t, 1, recipients)
	require.EqualValues(t, 1, messages)

	var stored model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&stored, event.Id).Error)
	require.Equal(t, model.RecallLifecycleEventSkipped, stored.Disposition)
	require.Equal(t, "lifecycle_recipient_inconsistent", stored.DispositionReasonCode)
}

func TestRecallLifecycleEnrollmentLimitNonPositiveIsSafe(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 501, 120, 120, `{}`)

	enrolled, err := NewRecallLifecycleWorker("node-a").RunBatch(context.Background(), 0)
	require.NoError(t, err)
	require.Zero(t, enrolled)
}

func TestRecallLifecyclePreviewAndMetricsExposeMaskedOperationalData(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	_, campaign := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	old := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 801, 99, 120, `{"secret":"old"}`)
	due := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 802, 120, 120, `{"secret":"due"}`)
	future := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 803, 121, time.Now().Add(time.Hour).Unix(), `{"secret":"future"}`)
	skipped := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 804, 122, 122, `{}`)
	require.NoError(t, model.DB.Model(&model.RecallLifecycleEvent{}).
		Where("id = ?", due.Id).
		Updates(map[string]any{
			"scope_type":   "order",
			"scope_id":     "raw-order-802",
			"business_key": "order=802 email=user-802@example.com",
			"recipient_identity": model.RecallLifecycleRecipientIdentity(
				model.RecallLifecycleTriggerQuotaLow,
				"user-802@example.com",
			),
		}).Error)
	require.NoError(t, model.DB.Model(&model.RecallLifecycleEvent{}).
		Where("id = ?", skipped.Id).
		Updates(map[string]any{
			"disposition":             model.RecallLifecycleEventSkipped,
			"disposition_reason_code": "invalid_email",
			"last_error_code":         "invalid_email",
			"resolved_at":             int64(130),
		}).Error)
	require.NoError(t, model.DB.Model(&model.RecallLifecycleEvent{}).
		Where("id = ?", future.Id).
		Update("last_error_code", "lease_recovered").Error)
	require.NoError(t, model.DB.Delete(&model.RecallLifecycleEvent{}, old.Id).Error)

	recipient := model.RecallRecipient{
		CampaignId:          campaign.Id,
		LifecycleEventId:    &due.Id,
		RecipientIdentity:   model.RecallLifecycleRecipientIdentity(model.RecallLifecycleTriggerQuotaLow, due.OccurrenceKeyHash),
		UserId:              due.UserId,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "masked-metrics@example.com",
		LanguageSnapshot:    "en",
		State:               model.RecallRecipientContacting,
	}
	require.NoError(t, model.DB.Create(&recipient).Error)
	require.NoError(t, model.DB.Create(&model.RecallMessage{
		RecipientId:      recipient.Id,
		StageNo:          1,
		TemplateVersion:  1,
		TemplateSnapshot: "{}",
		ScheduledAt:      120,
		State:            model.RecallMessageCancelled,
		StateVersion:     1,
		LastErrorCode:    "no_account_email",
	}).Error)

	preview, err := service.PreviewLifecycle(context.Background(), campaign.Id)
	require.NoError(t, err)
	require.EqualValues(t, 100, preview.CollectionStartAt)
	require.EqualValues(t, 100, preview.ProcessingStartAt)
	require.EqualValues(t, 120, preview.EarliestAvailable)
	require.EqualValues(t, 3, preview.EstimatedCount)
	require.GreaterOrEqual(t, preview.DueCount, int64(1))
	require.NotEmpty(t, preview.Samples)
	require.NotContains(t, fmt.Sprintf("%+v", preview.Samples), "user-802@example.com")
	require.NotContains(t, fmt.Sprintf("%+v", preview.Samples), "raw-order-802")
	require.NotContains(t, fmt.Sprintf("%+v", preview.Samples), "secret")

	var dbLog bytes.Buffer
	previousLogger := model.DB.Logger
	model.DB.Logger = logger.New(log.New(&dbLog, "", 0), logger.Config{LogLevel: logger.Error})
	t.Cleanup(func() { model.DB.Logger = previousLogger })

	metrics, err := GetRecallLifecycleMetrics(context.Background(), campaign.Id)
	require.NoError(t, err)
	require.NotContains(t, dbLog.String(), "unsupported data type")
	require.EqualValues(t, 3, metrics.EventTotal)
	require.EqualValues(t, 1, metrics.PendingNotDueCount)
	require.GreaterOrEqual(t, metrics.DueBacklogCount, int64(1))
	require.EqualValues(t, 1, metrics.SkippedCount)
	require.EqualValues(t, 1, metrics.MessagesCancelledCount)
	require.EqualValues(t, 1, metrics.SkipReasonCounts["invalid_email"])
	require.EqualValues(t, 1, metrics.SendBlockedReasonCounts["no_account_email"])
	require.EqualValues(t, 1, metrics.ErrorCodeCounts["lease_recovered"])
}

func TestRecallLifecyclePreviewUsesDBTimeForDraftFromNowWithoutPersisting(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	_, err := model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
	require.NoError(t, err)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	draft := validRecallContinuousDraft()
	require.Zero(t, draft.ProcessingStartAt)
	campaign, err := service.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)
	require.Zero(t, campaign.ProcessingStartAt)
	beforeDB, err := model.GetDBTimestampWithContext(context.Background())
	require.NoError(t, err)
	oldEvent := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 901, 120, 120, `{}`)
	futureAvailableAt := beforeDB + 3600
	futureEvent := createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 902, futureAvailableAt, futureAvailableAt, `{}`)

	preview, err := service.PreviewLifecycle(context.Background(), campaign.Id)
	require.NoError(t, err)
	afterDB, err := model.GetDBTimestampWithContext(context.Background())
	require.NoError(t, err)
	require.GreaterOrEqual(t, preview.ProcessingStartAt, beforeDB)
	require.LessOrEqual(t, preview.ProcessingStartAt, afterDB)
	require.GreaterOrEqual(t, preview.ProcessingStartAt, preview.CollectionStartAt)
	require.EqualValues(t, 1, preview.EstimatedCount)
	require.EqualValues(t, futureEvent.AvailableAt, preview.EarliestAvailable)
	require.Len(t, preview.Samples, 1)
	require.Equal(t, futureEvent.Id, preview.Samples[0].ID)
	require.NotEqual(t, oldEvent.Id, preview.Samples[0].ID)
	stored, err := model.GetRecallCampaignByIDWithContext(context.Background(), campaign.Id)
	require.NoError(t, err)
	require.Zero(t, stored.ProcessingStartAt)
}

func TestRecallLifecyclePreviewAndMetricsEmptyBacklogReturnZeroAggregates(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	service := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	_, campaign := createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)

	preview, err := service.PreviewLifecycle(context.Background(), campaign.Id)
	require.NoError(t, err)
	require.EqualValues(t, 0, preview.EstimatedCount)
	require.EqualValues(t, 0, preview.DueCount)
	require.EqualValues(t, 0, preview.EarliestAvailable)
	require.Empty(t, preview.Samples)

	metrics, err := GetRecallLifecycleMetrics(context.Background(), campaign.Id)
	require.NoError(t, err)
	require.EqualValues(t, 0, metrics.EventTotal)
	require.EqualValues(t, 0, metrics.PendingNotDueCount)
	require.EqualValues(t, 0, metrics.DueBacklogCount)
	require.EqualValues(t, 0, metrics.LastProcessedAt)
	require.EqualValues(t, 0, metrics.MaxProcessingLatencySeconds)
	require.Empty(t, metrics.SkipReasonCounts)
	require.Empty(t, metrics.SendBlockedReasonCounts)
	require.Empty(t, metrics.ErrorCodeCounts)
}

func setupRecallLifecycleServiceTestDB(t *testing.T) {
	t.Helper()
	setupRecallCampaignTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.RecallLifecycleEvent{}))
}

func createRecallLifecycleEnrollmentCampaign(t *testing.T, status string, processingStartAt int64) (int64, model.RecallCampaign) {
	t.Helper()
	stageJSON, err := common.Marshal([]RecallEmailStage{{
		StageNo:      1,
		DelaySeconds: 0,
		Templates: map[string]RecallEmailTemplate{
			"en": {Subject: "Notice", BodyText: "Body"},
		},
	}})
	require.NoError(t, err)
	campaign := model.RecallCampaign{
		CampaignType:        model.RecallCampaignTypeContentOnly,
		DeliveryPolicy:      model.RecallDeliveryPolicyService,
		LifecycleTrigger:    model.RecallLifecycleTriggerQuotaLow,
		ProcessingStartAt:   processingStartAt,
		Name:                "lifecycle enrollment",
		Status:              status,
		AudienceTemplate:    "lifecycle",
		AudienceConfig:      `{}`,
		ExecutionMode:       "continuous",
		CouponSource:        "none",
		DiscountConfig:      `{}`,
		ProductScope:        `{}`,
		EmailSequenceConfig: string(stageJSON),
		EnrollmentLimit:     100,
		WorkerConcurrency:   2,
	}
	require.NoError(t, model.DB.Create(&campaign).Error)
	var optionCount int64
	require.NoError(t, model.DB.Model(&model.Option{}).
		Where("key = ?", model.OptionKeyRecallLifecycleEventCollectionStartedAt).
		Count(&optionCount).Error)
	if optionCount == 0 {
		require.NoError(t, model.DB.Create(&model.Option{Key: model.OptionKeyRecallLifecycleEventCollectionStartedAt, Value: "100"}).Error)
	}
	require.NoError(t, model.EnsureRecallContinuousTriggerSlotTx(model.DB, model.RecallLifecycleTriggerQuotaLow))
	require.NoError(t, model.DB.Model(&model.RecallContinuousTriggerSlot{}).
		Where("trigger = ?", model.RecallLifecycleTriggerQuotaLow).
		Update("campaign_id", campaign.Id).Error)
	return campaign.Id, campaign
}

func createRecallLifecycleEnrollmentEvent(t *testing.T, trigger string, userID int, occurredAt int64, availableAt int64, eventData string) model.RecallLifecycleEvent {
	t.Helper()
	user := model.User{Id: userID, Username: fmt.Sprintf("user-%d", userID), Email: fmt.Sprintf("user-%d@example.com", userID), Status: common.UserStatusEnabled}
	user.AffCode = fmt.Sprintf("aff-%d", userID)
	require.NoError(t, model.DB.Create(&user).Error)
	occurrence := model.RecallLifecycleOccurrence{Canonical: fmt.Sprintf("v1|%s|service-user:%d", trigger, userID), Hash: ""}
	occurrence.Hash = model.RecallLifecycleRecipientIdentity(trigger, occurrence.Canonical)
	occurrence.Hash = occurrence.Hash[len("occ:"):]
	event := model.RecallLifecycleEvent{
		EventType:         trigger,
		OccurrenceKeyHash: occurrence.Hash,
		BusinessKey:       occurrence.Canonical,
		UserId:            userID,
		EventData:         eventData,
		Disposition:       model.RecallLifecycleEventPending,
		OccurredAt:        occurredAt,
		AvailableAt:       availableAt,
	}
	inserted, err := model.TryInsertRecallLifecycleEventWithContext(context.Background(), &event)
	require.NoError(t, err)
	require.True(t, inserted)
	return event
}

func injectRecallRecipientCreateErrorOnce(t *testing.T, userID int, injectErr error) {
	t.Helper()
	name := fmt.Sprintf("recall_lifecycle_test_insert_error_%d", userID)
	triggered := false
	require.NoError(t, model.DB.Callback().Create().Before("gorm:create").Register(name, func(tx *gorm.DB) {
		if triggered || tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallRecipient" {
			return
		}
		recipient, ok := tx.Statement.Dest.(*model.RecallRecipient)
		if !ok || recipient.UserId != userID {
			return
		}
		triggered = true
		tx.AddError(injectErr)
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Create().Remove(name))
	})
}

func stealRecallLifecycleLeaseBeforeFinalUpdateOnce(t *testing.T, eventID int64, owner string) {
	t.Helper()
	name := fmt.Sprintf("recall_lifecycle_test_lease_steal_%d", eventID)
	messageName := fmt.Sprintf("recall_lifecycle_test_message_seen_%d", eventID)
	triggered := false
	messageInserted := false
	require.NoError(t, model.DB.Callback().Create().After("gorm:create").Register(messageName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallMessage" {
			return
		}
		messageInserted = true
	}))
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(name, func(tx *gorm.DB) {
		if triggered || tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallLifecycleEvent" {
			return
		}
		if !messageInserted || tx.Statement.Clauses["WHERE"].Name == "" {
			return
		}
		triggered = true
		tx.Session(&gorm.Session{NewDB: true, SkipHooks: true}).
			Model(&model.RecallLifecycleEvent{}).
			Where("id = ?", eventID).
			Updates(map[string]any{
				"lease_owner": owner,
				"lease_epoch": gorm.Expr("lease_epoch + ?", 1),
			})
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(name))
		require.NoError(t, model.DB.Callback().Create().Remove(messageName))
	})
}

func createRecallLifecycleExistingRecipient(t *testing.T, campaignID int64, event model.RecallLifecycleEvent) model.RecallRecipient {
	t.Helper()
	eventID := event.Id
	recipient := model.RecallRecipient{
		CampaignId:          campaignID,
		LifecycleEventId:    &eventID,
		RecipientIdentity:   model.RecallLifecycleRecipientIdentity(event.EventType, event.OccurrenceKeyHash),
		UserId:              event.UserId,
		EligibilitySnapshot: event.EventData,
		EmailSnapshot:       fmt.Sprintf("user-%d@example.com", event.UserId),
		LanguageSnapshot:    "en",
		State:               model.RecallRecipientContacting,
	}
	require.NoError(t, model.DB.Create(&recipient).Error)
	return recipient
}

func createRecallLifecycleExistingStageOne(t *testing.T, campaignID int64, recipientID int64) model.RecallMessage {
	t.Helper()
	templateJSON, err := common.Marshal(map[string]RecallEmailTemplate{
		"en": {Subject: "Notice", BodyText: "Body"},
	})
	require.NoError(t, err)
	message := model.RecallMessage{
		RecipientId:         recipientID,
		StageNo:             1,
		TemplateSnapshot:    string(templateJSON),
		ScheduledAt:         120,
		State:               model.RecallMessageScheduled,
		TemplateVersion:     1,
		PreSendAttemptCount: 0,
	}
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		return model.CreateRecallMessagesWithStateEventsTx(tx, campaignID, []model.RecallMessage{message}, 120)
	}))
	require.NoError(t, model.DB.First(&message, "recipient_id = ? AND stage_no = ?", recipientID, 1).Error)
	return message
}

func createRecallLifecycleExistingStageOneWithoutBaseline(t *testing.T, recipientID int64) model.RecallMessage {
	t.Helper()
	templateJSON, err := common.Marshal(map[string]RecallEmailTemplate{
		"en": {Subject: "Notice", BodyText: "Body"},
	})
	require.NoError(t, err)
	message := model.RecallMessage{
		RecipientId:         recipientID,
		StageNo:             1,
		TemplateSnapshot:    string(templateJSON),
		ScheduledAt:         120,
		State:               model.RecallMessageScheduled,
		TemplateVersion:     1,
		StateVersion:        2,
		PreSendAttemptCount: 0,
	}
	require.NoError(t, model.DB.Create(&message).Error)
	return message
}

func createRecallLifecycleLaterStateEvent(t *testing.T, campaignID int64, recipientID int64, messageID int64) model.RecallEvent {
	t.Helper()
	event := model.RecallEvent{
		CampaignId:    campaignID,
		RecipientId:   recipientID,
		MessageId:     messageID,
		EventType:     "message_state_changed",
		Source:        "message_state",
		SourceEventId: fmt.Sprintf("%d:2", messageID),
		EventData:     `{}`,
		CreatedAt:     121,
	}
	require.NoError(t, model.DB.Create(&event).Error)
	return event
}
