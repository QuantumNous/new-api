package model

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRecallLifecycleTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := DB
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	DB = db
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
	})

	require.NoError(t, DB.AutoMigrate(
		&RecallCampaign{},
		&RecallRecipient{},
		&RecallLifecycleEvent{},
		&RecallContinuousTriggerSlot{},
		&QuotaLifecycleState{},
	))
	return db
}

func TestLifecycleTriggerPoliciesAndDelays(t *testing.T) {
	require.ElementsMatch(t, []string{
		RecallLifecycleTriggerUserRegistered,
		RecallLifecycleTriggerRegistrationUnused,
		RecallLifecycleTriggerQuotaLow,
		RecallLifecycleTriggerQuotaExhaustedUnpaid,
		RecallLifecycleTriggerPaymentFailed,
		RecallLifecycleTriggerPaymentPending,
		RecallLifecycleTriggerPaymentSucceeded,
	}, RecallLifecycleTriggers())

	require.Equal(t, RecallDeliveryPolicyService, RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerUserRegistered))
	require.Equal(t, RecallDeliveryPolicyEngagement, RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerRegistrationUnused))
	require.Equal(t, RecallDeliveryPolicyService, RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerQuotaLow))
	require.Equal(t, RecallDeliveryPolicyService, RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerQuotaExhaustedUnpaid))
	require.Equal(t, RecallDeliveryPolicyService, RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerPaymentFailed))
	require.Equal(t, RecallDeliveryPolicyEngagement, RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerPaymentPending))
	require.Equal(t, RecallDeliveryPolicyService, RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerPaymentSucceeded))

	require.Equal(t, 7*24*time.Hour, RecallLifecycleTriggerDelay(RecallLifecycleTriggerRegistrationUnused))
	require.Equal(t, 24*time.Hour, RecallLifecycleTriggerDelay(RecallLifecycleTriggerPaymentPending))
}

func TestLifecycleOccurrenceHashAndRecipientIdentityAreDeterministic(t *testing.T) {
	left, err := RecallLifecycleOccurrenceHash(map[string]any{
		"user_id": 12,
		"scope": map[string]any{
			"type": "user",
			"id":   "12",
		},
	})
	require.NoError(t, err)
	right, err := RecallLifecycleOccurrenceHash(map[string]any{
		"scope": map[string]any{
			"id":   "12",
			"type": "user",
		},
		"user_id": 12,
	})
	require.NoError(t, err)
	require.Equal(t, left, right)
	require.Len(t, left, 64)

	wantIdentity := fmt.Sprintf("occ:%x", sha256.Sum256([]byte(RecallLifecycleTriggerQuotaLow+"|"+left)))
	require.Equal(t, wantIdentity, RecallLifecycleRecipientIdentity(RecallLifecycleTriggerQuotaLow, left))
	require.Empty(t, RecallLifecycleRecipientIdentity("", left))
	require.Empty(t, RecallLifecycleRecipientIdentity(RecallLifecycleTriggerQuotaLow, ""))
}

func TestLifecycleEventDuplicateOccurrenceInsertIsNoop(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	occurrenceHash, err := RecallLifecycleOccurrenceHash(map[string]any{"user_id": 77, "cycle": "2026-08"})
	require.NoError(t, err)
	event := RecallLifecycleEvent{
		EventType:         RecallLifecycleTriggerQuotaLow,
		OccurrenceKeyHash: occurrenceHash,
		UserId:            77,
		EventData:         `{"user_id":77}`,
		Disposition:       RecallLifecycleEventPending,
		CreatedAt:         1_800_000_000,
	}

	inserted, err := TryInsertRecallLifecycleEventWithContext(context.Background(), &event)
	require.NoError(t, err)
	require.True(t, inserted)
	require.NotZero(t, event.Id)

	duplicate := event
	duplicate.Id = 0
	duplicate.EventData = `{"user_id":77,"duplicate":true}`
	inserted, err = TryInsertRecallLifecycleEventWithContext(context.Background(), &duplicate)
	require.NoError(t, err)
	require.False(t, inserted)

	var events []RecallLifecycleEvent
	require.NoError(t, DB.Find(&events).Error)
	require.Len(t, events, 1)
	require.Equal(t, event.EventData, events[0].EventData)
}

func TestLifecycleSchemaAndSevenSlotSeeding(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	require.True(t, DB.Migrator().HasColumn(&RecallCampaign{}, "DeliveryPolicy"))
	require.True(t, DB.Migrator().HasColumn(&RecallCampaign{}, "LifecycleTrigger"))
	require.True(t, DB.Migrator().HasColumn(&RecallCampaign{}, "LifecycleTriggerConfig"))
	require.True(t, DB.Migrator().HasColumn(&RecallCampaign{}, "ProcessingStartAt"))
	require.True(t, DB.Migrator().HasColumn(&RecallRecipient{}, "LifecycleEventId"))
	require.True(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_lifecycle_event"))
	require.True(t, DB.Migrator().HasIndex(&RecallLifecycleEvent{}, "idx_recall_lifecycle_occurrence"))
	require.True(t, DB.Migrator().HasIndex(&RecallContinuousTriggerSlot{}, "idx_recall_continuous_trigger_slot"))
	require.Equal(t, "TEXT", recallLifecycleSQLiteColumnType(t, "recall_campaigns", "lifecycle_trigger_config"))
	require.Equal(t, "TEXT", recallLifecycleSQLiteColumnType(t, "recall_lifecycle_events", "event_data"))

	require.NoError(t, SeedRecallContinuousTriggerSlotsWithContext(context.Background()))
	require.NoError(t, SeedRecallContinuousTriggerSlotsWithContext(context.Background()))

	var slots []RecallContinuousTriggerSlot
	require.NoError(t, DB.Order("trigger ASC").Find(&slots).Error)
	require.Len(t, slots, 7)
	triggers := make([]string, 0, len(slots))
	for _, slot := range slots {
		triggers = append(triggers, slot.Trigger)
	}
	require.ElementsMatch(t, RecallLifecycleTriggers(), triggers)
}

func TestMigrateDBFastCreatesLifecycleTablesAndSlots(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open("file:lifecycle-fast-migrate?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	DB = db
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
	})

	require.NoError(t, migrateDBFast())
	require.True(t, DB.Migrator().HasTable(&RecallLifecycleEvent{}))
	require.True(t, DB.Migrator().HasTable(&RecallContinuousTriggerSlot{}))

	var count int64
	require.NoError(t, DB.Model(&RecallContinuousTriggerSlot{}).Count(&count).Error)
	require.EqualValues(t, 7, count)
}

func recallLifecycleSQLiteColumnType(t *testing.T, table string, column string) string {
	t.Helper()
	return recallSQLiteColumnType(t, table, column)
}
