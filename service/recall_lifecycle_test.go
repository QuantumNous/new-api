package service

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
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

func TestRecallLifecycleEnrollmentLimitNonPositiveIsSafe(t *testing.T) {
	setupRecallLifecycleServiceTestDB(t)
	setRecallCampaignEnabled(t, true)
	createRecallLifecycleEnrollmentCampaign(t, model.RecallCampaignRunning, 100)
	createRecallLifecycleEnrollmentEvent(t, model.RecallLifecycleTriggerQuotaLow, 501, 120, 120, `{}`)

	enrolled, err := NewRecallLifecycleWorker("node-a").RunBatch(context.Background(), 0)
	require.NoError(t, err)
	require.Zero(t, enrolled)
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
