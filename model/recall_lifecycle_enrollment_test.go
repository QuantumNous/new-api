package model

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRecallLifecycleEventLeaseTwoNodesExpiredRecoveryAndStaleOwnerFencing(t *testing.T) {
	setupRecallLifecycleTestDB(t)
	event := createRecallLifecycleModelEvent(t, RecallLifecycleTriggerQuotaLow, 101, 100, 100)

	first, won, err := ClaimDueRecallLifecycleEvent(context.Background(), event.Id, "node-a", 150, 210)
	require.NoError(t, err)
	require.True(t, won)
	require.Equal(t, RecallLifecycleEventLeased, first.Disposition)
	require.EqualValues(t, 1, first.LeaseEpoch)

	second, won, err := ClaimDueRecallLifecycleEvent(context.Background(), event.Id, "node-b", 151, 220)
	require.NoError(t, err)
	require.False(t, won)
	require.Nil(t, second)

	recovered, won, err := ClaimDueRecallLifecycleEvent(context.Background(), event.Id, "node-b", 211, 280)
	require.NoError(t, err)
	require.True(t, won)
	require.EqualValues(t, 2, recovered.LeaseEpoch)
	require.Equal(t, "node-b", recovered.LeaseOwner)

	resolved, err := ResolveRecallLifecycleEventEnrollment(context.Background(), RecallLifecycleEventEnrollmentResolution{
		EventID:     event.Id,
		Owner:       "node-a",
		LeaseEpoch:  1,
		CampaignID:  11,
		RecipientID: 12,
		ResolvedAt:  212,
	})
	require.NoError(t, err)
	require.False(t, resolved)

	resolved, err = ResolveRecallLifecycleEventEnrollment(context.Background(), RecallLifecycleEventEnrollmentResolution{
		EventID:     event.Id,
		Owner:       "node-b",
		LeaseEpoch:  recovered.LeaseEpoch,
		CampaignID:  21,
		RecipientID: 22,
		ResolvedAt:  213,
	})
	require.NoError(t, err)
	require.True(t, resolved)

	var stored RecallLifecycleEvent
	require.NoError(t, DB.First(&stored, event.Id).Error)
	require.Equal(t, RecallLifecycleEventEnrolled, stored.Disposition)
	require.EqualValues(t, 21, stored.CampaignId)
	require.EqualValues(t, 22, stored.RecipientId)
	require.Empty(t, stored.LeaseOwner)
}

func TestRecallLifecycleEventLeaseEligibilityPredicate(t *testing.T) {
	setupRecallLifecycleTestDB(t)
	require.NoError(t, DB.Create(&Option{Key: OptionKeyRecallLifecycleEventCollectionStartedAt, Value: "100"}).Error)
	campaign := RecallCampaign{Status: RecallCampaignRunning, ExecutionMode: "continuous", LifecycleTrigger: RecallLifecycleTriggerQuotaLow, ProcessingStartAt: 120}
	require.NoError(t, DB.Create(&campaign).Error)
	require.NoError(t, DB.Create(&RecallContinuousTriggerSlot{Trigger: RecallLifecycleTriggerQuotaLow, CampaignId: campaign.Id, DeliveryPolicy: RecallDeliveryPolicyService, ScanPeriod: 60}).Error)

	eligible := createRecallLifecycleModelEvent(t, RecallLifecycleTriggerQuotaLow, 201, 130, 130)
	createRecallLifecycleModelEvent(t, RecallLifecycleTriggerPaymentPending, 202, 130, 130)
	createRecallLifecycleModelEvent(t, RecallLifecycleTriggerQuotaLow, 203, 99, 130)
	createRecallLifecycleModelEvent(t, RecallLifecycleTriggerQuotaLow, 204, 130, 119)
	createRecallLifecycleModelEvent(t, RecallLifecycleTriggerQuotaLow, 205, 130, 181)
	createRecallLifecycleModelEventWithDisposition(t, RecallLifecycleTriggerQuotaLow, 206, 130, 130, RecallLifecycleEventEnrolled)

	events, err := ListDueRecallLifecycleEvents(context.Background(), 180, 10)
	require.NoError(t, err)
	require.Len(t, events, 1)
	require.Equal(t, eligible.Id, events[0].Id)
}

func createRecallLifecycleModelEvent(t *testing.T, trigger string, userID int, occurredAt int64, availableAt int64) RecallLifecycleEvent {
	t.Helper()
	return createRecallLifecycleModelEventWithDisposition(t, trigger, userID, occurredAt, availableAt, RecallLifecycleEventPending)
}

func createRecallLifecycleModelEventWithDisposition(t *testing.T, trigger string, userID int, occurredAt int64, availableAt int64, disposition string) RecallLifecycleEvent {
	t.Helper()
	occurrence, err := NewRecallLifecycleUserOccurrence(RecallLifecycleTriggerUserRegistered, userID)
	require.NoError(t, err)
	if trigger != RecallLifecycleTriggerUserRegistered {
		occurrence = newRecallLifecycleOccurrence(fmt.Sprintf("v1|%s|test-user:%d", trigger, userID))
	}
	event := RecallLifecycleEvent{
		EventType:         trigger,
		OccurrenceKeyHash: occurrence.Hash,
		BusinessKey:       occurrence.Canonical,
		UserId:            userID,
		EventData:         `{}`,
		Disposition:       disposition,
		OccurredAt:        occurredAt,
		AvailableAt:       availableAt,
	}
	inserted, err := TryInsertRecallLifecycleEventWithContext(context.Background(), &event)
	require.NoError(t, err)
	require.True(t, inserted)
	return event
}
