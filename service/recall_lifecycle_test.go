package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
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

	again, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, again)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Count(new(int64)).Error)
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
