package model

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
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
	left := recallLifecycleOccurrenceHash("v1|quota_low|scope:user:12|cycle:2026-08|user:12")
	right := recallLifecycleOccurrenceHash("v1|quota_low|scope:user:12|cycle:2026-08|user:12")
	require.Equal(t, left, right)
	require.Len(t, left, 64)

	wantIdentity := fmt.Sprintf("occ:%x", sha256.Sum256([]byte(RecallLifecycleTriggerQuotaLow+"|"+left)))
	require.Equal(t, wantIdentity, RecallLifecycleRecipientIdentity(RecallLifecycleTriggerQuotaLow, left))
	require.Empty(t, RecallLifecycleRecipientIdentity("", left))
	require.Empty(t, RecallLifecycleRecipientIdentity(RecallLifecycleTriggerQuotaLow, ""))
}

func TestLifecycleCanonicalOccurrenceBuildersUseExactVersionedFormats(t *testing.T) {
	tests := []struct {
		name      string
		canonical string
		build     func() (RecallLifecycleOccurrence, error)
	}{
		{
			name:      "user registered",
			canonical: "v1|user_registered|user:42",
			build: func() (RecallLifecycleOccurrence, error) {
				return NewRecallLifecycleUserOccurrence(RecallLifecycleTriggerUserRegistered, 42)
			},
		},
		{
			name:      "registration unused",
			canonical: "v1|registration_unused|user:42",
			build: func() (RecallLifecycleOccurrence, error) {
				return NewRecallLifecycleUserOccurrence(RecallLifecycleTriggerRegistrationUnused, 42)
			},
		},
		{
			name:      "quota low",
			canonical: "v1|quota_low|scope:user:42|cycle:2026-08|user:42",
			build: func() (RecallLifecycleOccurrence, error) {
				return NewRecallLifecycleQuotaOccurrence(RecallLifecycleTriggerQuotaLow, QuotaLifecycleScopeUser, "42", "2026-08", 42)
			},
		},
		{
			name:      "quota exhausted unpaid",
			canonical: "v1|quota_exhausted_unpaid|scope:token:tok_123|cycle:2026-08|user:42",
			build: func() (RecallLifecycleOccurrence, error) {
				return NewRecallLifecycleQuotaOccurrence(RecallLifecycleTriggerQuotaExhaustedUnpaid, QuotaLifecycleScopeToken, "tok_123", "2026-08", 42)
			},
		},
		{
			name:      "payment failed trade",
			canonical: "v1|payment_failed|purchase:subscription|trade:sub_trade_1|user:42",
			build: func() (RecallLifecycleOccurrence, error) {
				return NewRecallLifecyclePurchaseOccurrence(RecallLifecycleTriggerPaymentFailed, "subscription", "sub_trade_1", "", 0, 42)
			},
		},
		{
			name:      "payment pending source fallback",
			canonical: "v1|payment_pending|purchase:topup|source:top_ups:987|user:42",
			build: func() (RecallLifecycleOccurrence, error) {
				return NewRecallLifecyclePurchaseOccurrence(RecallLifecycleTriggerPaymentPending, "topup", "", "top_ups", 987, 42)
			},
		},
		{
			name:      "payment succeeded trade",
			canonical: "v1|payment_succeeded|purchase:topup|trade:topup_trade_1|user:42",
			build: func() (RecallLifecycleOccurrence, error) {
				return NewRecallLifecyclePurchaseOccurrence(RecallLifecycleTriggerPaymentSucceeded, "topup", "topup_trade_1", "top_ups", 987, 42)
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			occurrence, err := test.build()
			require.NoError(t, err)
			require.Equal(t, test.canonical, occurrence.Canonical)
			require.Equal(t, fmt.Sprintf("%x", sha256.Sum256([]byte(test.canonical))), occurrence.Hash)
		})
	}

	_, err := NewRecallLifecyclePurchaseOccurrence(RecallLifecycleTriggerPaymentPending, "topup", "", "", 0, 42)
	require.Error(t, err)
	require.Contains(t, err.Error(), "trade number or stable source reference")
}

func TestLifecycleEventDuplicateOccurrenceInsertIsNoop(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	occurrence, err := NewRecallLifecycleQuotaOccurrence(RecallLifecycleTriggerQuotaLow, QuotaLifecycleScopeUser, "77", "2026-08", 77)
	require.NoError(t, err)
	event := RecallLifecycleEvent{
		EventType:         RecallLifecycleTriggerQuotaLow,
		OccurrenceKeyHash: occurrence.Hash,
		ScopeType:         QuotaLifecycleScopeUser,
		ScopeId:           "77",
		BusinessKey:       occurrence.Canonical,
		UserId:            77,
		EventData:         `{"user_id":77}`,
		Disposition:       RecallLifecycleEventPending,
		OccurredAt:        1_800_000_000,
		AvailableAt:       1_800_000_060,
		SchemaVersion:     1,
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
	for _, field := range []string{"ScopeType", "ScopeId", "BusinessKey", "OccurredAt", "AvailableAt", "SchemaVersion", "LastErrorCode", "ResolvedAt"} {
		require.True(t, DB.Migrator().HasColumn(&RecallLifecycleEvent{}, field), field)
	}
	require.True(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_lifecycle_event"))
	require.True(t, DB.Migrator().HasIndex(&RecallLifecycleEvent{}, "idx_recall_lifecycle_occurrence"))
	require.Equal(t, []string{"event_type", "disposition", "available_at", "occurred_at", "id"}, recallLifecycleSQLiteIndexColumns(t, "idx_recall_lifecycle_due"))
	require.Equal(t, "TEXT", recallLifecycleSQLiteColumnType(t, "recall_campaigns", "lifecycle_trigger_config"))
	require.Equal(t, "TEXT", recallLifecycleSQLiteColumnType(t, "recall_lifecycle_events", "event_data"))
	require.Equal(t, "varchar(160)", recallLifecycleSQLiteColumnType(t, "recall_lifecycle_events", "business_key"))

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

func TestLifecycleDueIndexAndTriggerSlotPrimaryKeyShape(t *testing.T) {
	parsedEvent, err := schema.Parse(&RecallLifecycleEvent{}, &sync.Map{}, schema.NamingStrategy{})
	require.NoError(t, err)
	requireLifecycleIndexPriority(t, parsedEvent, "EventType", "idx_recall_lifecycle_due", "1")
	requireLifecycleIndexPriority(t, parsedEvent, "Disposition", "idx_recall_lifecycle_due", "2")
	requireLifecycleIndexPriority(t, parsedEvent, "AvailableAt", "idx_recall_lifecycle_due", "3")
	requireLifecycleIndexPriority(t, parsedEvent, "OccurredAt", "idx_recall_lifecycle_due", "4")
	requireLifecycleIndexPriority(t, parsedEvent, "Id", "idx_recall_lifecycle_due", "5")
	requireLifecycleIndexAbsent(t, parsedEvent, "LeaseOwner", "idx_recall_lifecycle_due")
	requireLifecycleIndexAbsent(t, parsedEvent, "LeaseExpiresAt", "idx_recall_lifecycle_due")

	parsedSlot, err := schema.Parse(&RecallContinuousTriggerSlot{}, &sync.Map{}, schema.NamingStrategy{})
	require.NoError(t, err)
	require.Len(t, parsedSlot.PrimaryFields, 1)
	require.Equal(t, "Trigger", parsedSlot.PrimaryFields[0].Name)
	require.Nil(t, parsedSlot.LookUpField("Id"))
}

func TestLifecycleDeliveryPolicyDefaultsAndBackfill(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	campaign := newRecallRepositoryCampaign("delivery policy default")
	require.NoError(t, CreateRecallCampaign(&campaign))
	require.Equal(t, RecallDeliveryPolicyEngagement, campaign.DeliveryPolicy)

	require.NoError(t, DB.Model(&RecallCampaign{}).
		Where("id = ?", campaign.Id).
		Update("delivery_policy", "").Error)
	require.NoError(t, migrateRecallCampaignLifecycleDefaults())

	var stored RecallCampaign
	require.NoError(t, DB.First(&stored, campaign.Id).Error)
	require.Equal(t, RecallDeliveryPolicyEngagement, stored.DeliveryPolicy)
}

func TestLifecycleRecipientEventIdAllowsMultipleNullsButDedupesConcreteEvent(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	campaign := newRecallRepositoryCampaign("nullable lifecycle event id")
	require.NoError(t, CreateRecallCampaign(&campaign))
	nullRows := []RecallRecipient{
		{CampaignId: campaign.Id, UserId: 1001, EligibilitySnapshot: `{}`, EmailSnapshot: "null-one@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
		{CampaignId: campaign.Id, UserId: 1002, EligibilitySnapshot: `{}`, EmailSnapshot: "null-two@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
	}
	require.NoError(t, DB.Create(&nullRows).Error)

	occurrence, err := NewRecallLifecycleUserOccurrence(RecallLifecycleTriggerUserRegistered, 1003)
	require.NoError(t, err)
	event := RecallLifecycleEvent{
		EventType:         RecallLifecycleTriggerUserRegistered,
		OccurrenceKeyHash: occurrence.Hash,
		BusinessKey:       occurrence.Canonical,
		UserId:            1003,
		OccurredAt:        1,
		AvailableAt:       1,
		EventData:         `{}`,
	}
	inserted, err := TryInsertRecallLifecycleEventWithContext(context.Background(), &event)
	require.NoError(t, err)
	require.True(t, inserted)

	eventID := event.Id
	first := RecallRecipient{CampaignId: campaign.Id, LifecycleEventId: &eventID, UserId: 1003, EligibilitySnapshot: `{}`, EmailSnapshot: "event-one@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued}
	second := RecallRecipient{CampaignId: campaign.Id, LifecycleEventId: &eventID, UserId: 1004, EligibilitySnapshot: `{}`, EmailSnapshot: "event-two@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued}
	require.NoError(t, DB.Create(&first).Error)
	require.Error(t, DB.Create(&second).Error)
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

func TestMigrateDBCreatesLifecycleTablesAndSlots(t *testing.T) {
	originalDB := DB
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	db, err := gorm.Open(sqlite.Open("file:lifecycle-full-migrate?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})

	require.NoError(t, migrateDB())
	require.True(t, DB.Migrator().HasTable(&RecallLifecycleEvent{}))
	require.True(t, DB.Migrator().HasTable(&RecallContinuousTriggerSlot{}))
	require.True(t, DB.Migrator().HasTable(&QuotaLifecycleState{}))

	var count int64
	require.NoError(t, DB.Model(&RecallContinuousTriggerSlot{}).Count(&count).Error)
	require.EqualValues(t, 7, count)
}

func recallLifecycleSQLiteColumnType(t *testing.T, table string, column string) string {
	t.Helper()
	return recallSQLiteColumnType(t, table, column)
}

func recallLifecycleSQLiteIndexColumns(t *testing.T, index string) []string {
	t.Helper()
	rows, err := DB.Raw("PRAGMA index_info(" + index + ")").Rows()
	require.NoError(t, err)
	defer rows.Close()
	columns := make([]string, 0)
	for rows.Next() {
		var seqno int
		var cid int
		var name string
		require.NoError(t, rows.Scan(&seqno, &cid, &name))
		columns = append(columns, name)
	}
	require.NoError(t, rows.Err())
	return columns
}

func requireLifecycleIndexPriority(t *testing.T, parsed *schema.Schema, fieldName string, indexName string, priority string) {
	t.Helper()
	field := parsed.LookUpField(fieldName)
	require.NotNil(t, field)
	indexes := field.TagSettings["INDEX"]
	if field.TagSettings["UNIQUEINDEX"] != "" {
		indexes += ";" + field.TagSettings["UNIQUEINDEX"]
	}
	require.Contains(t, indexes, indexName)
	require.Contains(t, strings.ToLower(indexes), "priority:"+priority)
}

func requireLifecycleIndexAbsent(t *testing.T, parsed *schema.Schema, fieldName string, indexName string) {
	t.Helper()
	field := parsed.LookUpField(fieldName)
	require.NotNil(t, field)
	indexes := field.TagSettings["INDEX"]
	if field.TagSettings["UNIQUEINDEX"] != "" {
		indexes += ";" + field.TagSettings["UNIQUEINDEX"]
	}
	require.NotContains(t, indexes, indexName)
}
