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
	dbNow, err := GetDBTimestampWithContext(context.Background())
	require.NoError(t, err)

	first, won, err := ClaimDueRecallLifecycleEvent(context.Background(), event.Id, "node-a", dbNow, dbNow+60)
	require.NoError(t, err)
	require.True(t, won)
	require.Equal(t, RecallLifecycleEventLeased, first.Disposition)
	require.EqualValues(t, 1, first.LeaseEpoch)

	second, won, err := ClaimDueRecallLifecycleEvent(context.Background(), event.Id, "node-b", dbNow+1, dbNow+70)
	require.NoError(t, err)
	require.False(t, won)
	require.Nil(t, second)

	recovered, won, err := ClaimDueRecallLifecycleEvent(context.Background(), event.Id, "node-b", dbNow+61, dbNow+120)
	require.NoError(t, err)
	require.True(t, won)
	require.EqualValues(t, 2, recovered.LeaseEpoch)
	require.Equal(t, "node-b", recovered.LeaseOwner)

	resolved, err := ResolveRecallLifecycleEventEnrollment(context.Background(), RecallLifecycleEventEnrollmentResolution{
		EventID:              event.Id,
		Owner:                "node-a",
		LeaseEpoch:           1,
		ExpectedLeaseExpires: first.LeaseExpiresAt,
		CampaignID:           11,
		RecipientID:          12,
		ResolvedAt:           dbNow + 62,
	})
	require.NoError(t, err)
	require.False(t, resolved)

	resolved, err = ResolveRecallLifecycleEventEnrollment(context.Background(), RecallLifecycleEventEnrollmentResolution{
		EventID:              event.Id,
		Owner:                "node-b",
		LeaseEpoch:           recovered.LeaseEpoch,
		ExpectedLeaseExpires: recovered.LeaseExpiresAt,
		CampaignID:           21,
		RecipientID:          22,
		ResolvedAt:           dbNow + 63,
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

func TestRecallLifecycleRecoveryExpiredOwnerCannotResolveSkipOrDefer(t *testing.T) {
	setupRecallLifecycleTestDB(t)
	event := createRecallLifecycleModelEvent(t, RecallLifecycleTriggerQuotaLow, 301, 100, 100)
	dbNow, err := GetDBTimestampWithContext(context.Background())
	require.NoError(t, err)
	claimed, won, err := ClaimDueRecallLifecycleEvent(context.Background(), event.Id, "node-a", dbNow, dbNow+60)
	require.NoError(t, err)
	require.True(t, won)
	claimed.LeaseExpiresAt = dbNow - 1
	require.NoError(t, DB.Model(&RecallLifecycleEvent{}).
		Where("id = ?", event.Id).
		Update("lease_expires_at", claimed.LeaseExpiresAt).Error)

	resolved, err := ResolveRecallLifecycleEventEnrollment(context.Background(), RecallLifecycleEventEnrollmentResolution{
		EventID:              event.Id,
		Owner:                "node-a",
		LeaseEpoch:           claimed.LeaseEpoch,
		ExpectedLeaseExpires: claimed.LeaseExpiresAt,
		CampaignID:           11,
		RecipientID:          12,
		ResolvedAt:           dbNow + 2,
	})
	require.NoError(t, err)
	require.False(t, resolved)

	skipped, err := SkipRecallLifecycleEvent(context.Background(), event.Id, "node-a", claimed.LeaseEpoch, claimed.LeaseExpiresAt, "malformed_event_data")
	require.NoError(t, err)
	require.False(t, skipped)

	deferred, err := DeferRecallLifecycleEvent(context.Background(), RecallLifecycleEventDeferral{
		EventID:              event.Id,
		Owner:                "node-a",
		LeaseEpoch:           claimed.LeaseEpoch,
		ExpectedLeaseExpires: claimed.LeaseExpiresAt,
		ErrorCode:            "db_timeout_order_12345",
	})
	require.NoError(t, err)
	require.False(t, deferred)

	var stored RecallLifecycleEvent
	require.NoError(t, DB.First(&stored, event.Id).Error)
	require.Equal(t, RecallLifecycleEventLeased, stored.Disposition)
	require.Equal(t, "node-a", stored.LeaseOwner)
	require.EqualValues(t, dbNow-1, stored.LeaseExpiresAt)
}

func TestRecallLifecycleRetryDeferSetsBoundedBackoffAndFencesEpoch(t *testing.T) {
	setupRecallLifecycleTestDB(t)
	event := createRecallLifecycleModelEvent(t, RecallLifecycleTriggerQuotaLow, 302, 100, 100)
	dbNow, err := GetDBTimestampWithContext(context.Background())
	require.NoError(t, err)
	claimed, won, err := ClaimDueRecallLifecycleEvent(context.Background(), event.Id, "node-a", dbNow, dbNow+300)
	require.NoError(t, err)
	require.True(t, won)

	deferred, err := DeferRecallLifecycleEvent(context.Background(), RecallLifecycleEventDeferral{
		EventID:              event.Id,
		Owner:                "node-b",
		LeaseEpoch:           claimed.LeaseEpoch,
		ExpectedLeaseExpires: claimed.LeaseExpiresAt,
		ErrorCode:            "wrong_owner",
	})
	require.NoError(t, err)
	require.False(t, deferred)

	deferred, err = DeferRecallLifecycleEvent(context.Background(), RecallLifecycleEventDeferral{
		EventID:              event.Id,
		Owner:                "node-a",
		LeaseEpoch:           claimed.LeaseEpoch,
		ExpectedLeaseExpires: claimed.LeaseExpiresAt,
		ErrorCode:            "db timeout order=raw-1234567890",
	})
	require.NoError(t, err)
	require.True(t, deferred)

	var stored RecallLifecycleEvent
	require.NoError(t, DB.First(&stored, event.Id).Error)
	require.Equal(t, RecallLifecycleEventPending, stored.Disposition)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
	require.Greater(t, stored.NextAttemptAt, dbNow)
	require.LessOrEqual(t, stored.NextAttemptAt, dbNow+3600)
	require.Equal(t, "dbtimeoutorderraw-1234567890", stored.LastErrorCode)
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
