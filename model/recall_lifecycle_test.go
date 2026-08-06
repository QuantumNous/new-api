package model

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
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
		&Option{},
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

	policy, err := RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerUserRegistered)
	require.NoError(t, err)
	require.Equal(t, RecallDeliveryPolicyService, policy)
	policy, err = RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerRegistrationUnused)
	require.NoError(t, err)
	require.Equal(t, RecallDeliveryPolicyEngagement, policy)
	policy, err = RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerQuotaLow)
	require.NoError(t, err)
	require.Equal(t, RecallDeliveryPolicyService, policy)
	policy, err = RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerQuotaExhaustedUnpaid)
	require.NoError(t, err)
	require.Equal(t, RecallDeliveryPolicyService, policy)
	policy, err = RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerPaymentFailed)
	require.NoError(t, err)
	require.Equal(t, RecallDeliveryPolicyService, policy)
	policy, err = RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerPaymentPending)
	require.NoError(t, err)
	require.Equal(t, RecallDeliveryPolicyEngagement, policy)
	policy, err = RecallLifecycleTriggerDeliveryPolicy(RecallLifecycleTriggerPaymentSucceeded)
	require.NoError(t, err)
	require.Equal(t, RecallDeliveryPolicyService, policy)

	delay, err := RecallLifecycleTriggerDelay(RecallLifecycleTriggerRegistrationUnused)
	require.NoError(t, err)
	require.Equal(t, 7*24*time.Hour, delay)
	delay, err = RecallLifecycleTriggerDelay(RecallLifecycleTriggerPaymentPending)
	require.NoError(t, err)
	require.Equal(t, 24*time.Hour, delay)
	delay, err = RecallLifecycleTriggerDelay(RecallLifecycleTriggerQuotaLow)
	require.NoError(t, err)
	require.Zero(t, delay)
}

func TestLifecycleTriggerPolicyDelayAndSlotRejectUnknownTriggers(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	require.Error(t, ValidateRecallLifecycleTrigger("unknown_trigger"))
	policy, err := RecallLifecycleTriggerDeliveryPolicy("unknown_trigger")
	require.Error(t, err)
	require.Empty(t, policy)
	delay, err := RecallLifecycleTriggerDelay("unknown_trigger")
	require.Error(t, err)
	require.Zero(t, delay)

	require.Error(t, EnsureRecallContinuousTriggerSlotTx(DB, "unknown_trigger"))
	var count int64
	require.NoError(t, DB.Model(&RecallContinuousTriggerSlot{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestLifecycleOccurrenceHashAndRecipientIdentityAreDeterministic(t *testing.T) {
	left := recallLifecycleOccurrenceHash("v1|quota_low|user:12|cycle:2026-08|user:12")
	right := recallLifecycleOccurrenceHash("v1|quota_low|user:12|cycle:2026-08|user:12")
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
			canonical: "v1|quota_low|user:42|cycle:2026-08|user:42",
			build: func() (RecallLifecycleOccurrence, error) {
				return NewRecallLifecycleQuotaOccurrence(RecallLifecycleTriggerQuotaLow, QuotaLifecycleScopeUser, "42", "2026-08", 42)
			},
		},
		{
			name:      "quota exhausted unpaid",
			canonical: "v1|quota_exhausted_unpaid|token:tok_123|cycle:2026-08|user:42",
			build: func() (RecallLifecycleOccurrence, error) {
				return NewRecallLifecycleQuotaOccurrence(RecallLifecycleTriggerQuotaExhaustedUnpaid, QuotaLifecycleScopeToken, "tok_123", "2026-08", 42)
			},
		},
		{
			name:      "payment failed trade",
			canonical: "v1|payment_failed|subscription|trade:sub_trade_1",
			build: func() (RecallLifecycleOccurrence, error) {
				return NewRecallLifecyclePurchaseOccurrence(RecallLifecycleTriggerPaymentFailed, "subscription", "sub_trade_1", "", 0, 42)
			},
		},
		{
			name:      "payment pending source fallback",
			canonical: "v1|payment_pending|topup|source:top_ups:987",
			build: func() (RecallLifecycleOccurrence, error) {
				return NewRecallLifecyclePurchaseOccurrence(RecallLifecycleTriggerPaymentPending, "topup", "", "top_ups", 987, 42)
			},
		},
		{
			name:      "payment succeeded trade",
			canonical: "v1|payment_succeeded|topup|trade:topup_trade_1",
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

func TestLifecycleOccurrenceBuildersRejectUnsupportedTriggerFamilies(t *testing.T) {
	_, err := NewRecallLifecycleUserOccurrence(RecallLifecycleTriggerPaymentPending, 42)
	require.Error(t, err)
	require.Contains(t, err.Error(), "unsupported user lifecycle trigger")

	_, err = NewRecallLifecycleQuotaOccurrence(RecallLifecycleTriggerUserRegistered, QuotaLifecycleScopeUser, "42", "2026-08", 42)
	require.Error(t, err)
	require.Contains(t, err.Error(), "unsupported quota lifecycle trigger")

	_, err = NewRecallLifecyclePurchaseOccurrence(RecallLifecycleTriggerQuotaLow, "topup", "trade_1", "", 0, 42)
	require.Error(t, err)
	require.Contains(t, err.Error(), "unsupported purchase lifecycle trigger")
}

func TestLifecycleEventBusinessKeyAllowsBoundedAuditReference(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	longScopeID := strings.Repeat("s", 80)
	longCycle := strings.Repeat("c", 64)
	occurrence, err := NewRecallLifecycleQuotaOccurrence(RecallLifecycleTriggerQuotaLow, QuotaLifecycleScopeUser, longScopeID, longCycle, 77)
	require.NoError(t, err)
	require.Greater(t, len(occurrence.Canonical), recallLifecycleBusinessKeyMaxLen)

	event := RecallLifecycleEvent{
		EventType:         RecallLifecycleTriggerQuotaLow,
		OccurrenceKeyHash: occurrence.Hash,
		ScopeType:         QuotaLifecycleScopeUser,
		ScopeId:           longScopeID,
		BusinessKey:       strings.Repeat("k", recallLifecycleBusinessKeyMaxLen),
		UserId:            77,
		EventData:         `{}`,
		OccurredAt:        1,
		AvailableAt:       1,
	}
	inserted, err := TryInsertRecallLifecycleEventWithContext(context.Background(), &event)
	require.NoError(t, err)
	require.True(t, inserted)
}

func TestLifecycleEventBusinessKeyRejectsOverBoundQuotaAndPurchaseReferences(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	quotaOccurrence, err := NewRecallLifecycleQuotaOccurrence(RecallLifecycleTriggerQuotaLow, QuotaLifecycleScopeUser, "77", "2026-08", 77)
	require.NoError(t, err)
	quotaEvent := RecallLifecycleEvent{
		EventType:         RecallLifecycleTriggerQuotaLow,
		OccurrenceKeyHash: quotaOccurrence.Hash,
		BusinessKey:       strings.Repeat("q", recallLifecycleBusinessKeyMaxLen+1),
		UserId:            77,
		EventData:         `{}`,
	}
	inserted, err := TryInsertRecallLifecycleEventWithContext(context.Background(), &quotaEvent)
	require.Error(t, err)
	require.False(t, inserted)
	require.Contains(t, err.Error(), "business key")

	purchaseOccurrence, err := NewRecallLifecyclePurchaseOccurrence(RecallLifecycleTriggerPaymentPending, "topup", "trade_oversize", "", 0, 88)
	require.NoError(t, err)
	purchaseEvent := RecallLifecycleEvent{
		EventType:         RecallLifecycleTriggerPaymentPending,
		OccurrenceKeyHash: purchaseOccurrence.Hash,
		BusinessKey:       strings.Repeat("p", recallLifecycleBusinessKeyMaxLen+1),
		UserId:            88,
		EventData:         `{}`,
	}
	inserted, err = TryInsertRecallLifecycleEventWithContext(context.Background(), &purchaseEvent)
	require.Error(t, err)
	require.False(t, inserted)
	require.Contains(t, err.Error(), "business key")

	var count int64
	require.NoError(t, DB.Model(&RecallLifecycleEvent{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestLifecycleEventRejectsUnsupportedEventTypeAndMalformedOccurrenceHash(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	occurrence, err := NewRecallLifecycleQuotaOccurrence(RecallLifecycleTriggerQuotaLow, QuotaLifecycleScopeUser, "77", "2026-08", 77)
	require.NoError(t, err)
	validEvent := RecallLifecycleEvent{
		EventType:         RecallLifecycleTriggerQuotaLow,
		OccurrenceKeyHash: occurrence.Hash,
		BusinessKey:       "quota:77:2026-08",
		UserId:            77,
		EventData:         `{}`,
	}
	inserted, err := TryInsertRecallLifecycleEventWithContext(context.Background(), &validEvent)
	require.NoError(t, err)
	require.True(t, inserted)

	tests := []struct {
		name      string
		eventType string
		hash      string
		want      string
	}{
		{
			name:      "unsupported event type",
			eventType: "unknown_trigger",
			hash:      occurrence.Hash,
			want:      "unsupported recall lifecycle trigger",
		},
		{
			name:      "wrong hash length",
			eventType: RecallLifecycleTriggerQuotaLow,
			hash:      occurrence.Hash + "0",
			want:      "occurrence key hash",
		},
		{
			name:      "uppercase hash",
			eventType: RecallLifecycleTriggerQuotaLow,
			hash:      strings.ToUpper(occurrence.Hash),
			want:      "occurrence key hash",
		},
		{
			name:      "non hex hash",
			eventType: RecallLifecycleTriggerQuotaLow,
			hash:      strings.Repeat("g", 64),
			want:      "occurrence key hash",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			malformed := validEvent
			malformed.Id = 0
			malformed.EventType = test.eventType
			malformed.OccurrenceKeyHash = test.hash
			inserted, err := TryInsertRecallLifecycleEventWithContext(context.Background(), &malformed)
			require.Error(t, err)
			require.False(t, inserted)
			require.Contains(t, err.Error(), test.want)
		})
	}

	duplicate := validEvent
	duplicate.Id = 0
	inserted, err = TryInsertRecallLifecycleEventWithContext(context.Background(), &duplicate)
	require.NoError(t, err)
	require.False(t, inserted)

	var count int64
	require.NoError(t, DB.Model(&RecallLifecycleEvent{}).Count(&count).Error)
	require.EqualValues(t, 1, count)
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

func TestLifecycleEventDuplicateNoopDoesNotSwallowMalformedRows(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	occurrence, err := NewRecallLifecycleQuotaOccurrence(RecallLifecycleTriggerQuotaLow, QuotaLifecycleScopeUser, "77", "2026-08", 77)
	require.NoError(t, err)
	event := RecallLifecycleEvent{
		EventType:         RecallLifecycleTriggerQuotaLow,
		OccurrenceKeyHash: occurrence.Hash,
		BusinessKey:       "quota:77:2026-08",
		UserId:            77,
		EventData:         `{}`,
	}
	inserted, err := TryInsertRecallLifecycleEventWithContext(context.Background(), &event)
	require.NoError(t, err)
	require.True(t, inserted)

	malformed := event
	malformed.Id = 0
	malformed.OccurrenceKeyHash = recallLifecycleOccurrenceHash("v1|quota_low|user:88|cycle:2026-08|user:88")
	malformed.BusinessKey = strings.Repeat("x", recallLifecycleBusinessKeyMaxLen+1)
	inserted, err = TryInsertRecallLifecycleEventWithContext(context.Background(), &malformed)
	require.Error(t, err)
	require.False(t, inserted)
	require.Contains(t, err.Error(), "business key")

	var count int64
	require.NoError(t, DB.Model(&RecallLifecycleEvent{}).Count(&count).Error)
	require.EqualValues(t, 1, count)
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
		require.Zero(t, slot.CampaignId)
	}
	require.ElementsMatch(t, RecallLifecycleTriggers(), triggers)
}

func TestLifecycleEnsureContinuousTriggerSlotTxInsertsRepairsAndRollsBack(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	tx := DB.Begin()
	require.NoError(t, tx.Error)
	require.NoError(t, EnsureRecallContinuousTriggerSlotTx(tx, RecallLifecycleTriggerQuotaLow))
	require.NoError(t, EnsureRecallContinuousTriggerSlotTx(tx, RecallLifecycleTriggerQuotaLow))

	var inside []RecallContinuousTriggerSlot
	require.NoError(t, tx.Find(&inside).Error)
	require.Len(t, inside, 1)
	require.Equal(t, RecallLifecycleTriggerQuotaLow, inside[0].Trigger)
	require.Equal(t, RecallDeliveryPolicyService, inside[0].DeliveryPolicy)
	require.Zero(t, inside[0].CampaignId)
	require.NoError(t, tx.Rollback().Error)

	var count int64
	require.NoError(t, DB.Model(&RecallContinuousTriggerSlot{}).Count(&count).Error)
	require.Zero(t, count)

	require.NoError(t, DB.Create(&RecallContinuousTriggerSlot{
		Trigger:        RecallLifecycleTriggerPaymentPending,
		DeliveryPolicy: RecallDeliveryPolicyService,
		DelaySeconds:   0,
		ScanPeriod:     0,
		CampaignId:     123,
	}).Error)
	tx = DB.Begin()
	require.NoError(t, tx.Error)
	require.NoError(t, EnsureRecallContinuousTriggerSlotTx(tx, RecallLifecycleTriggerPaymentPending))
	require.NoError(t, tx.Commit().Error)

	var repaired RecallContinuousTriggerSlot
	require.NoError(t, DB.First(&repaired, "trigger = ?", RecallLifecycleTriggerPaymentPending).Error)
	require.Equal(t, RecallDeliveryPolicyEngagement, repaired.DeliveryPolicy)
	require.EqualValues(t, int64(24*time.Hour/time.Second), repaired.DelaySeconds)
	require.EqualValues(t, recallContinuousTriggerSlotDefaultScanPeriod, repaired.ScanPeriod)
	require.EqualValues(t, 123, repaired.CampaignId)
}

func TestLifecycleContinuousTriggerSlotDuplicateNoopDoesNotSwallowUnknownTrigger(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	require.NoError(t, EnsureRecallContinuousTriggerSlotTx(DB, RecallLifecycleTriggerPaymentPending))
	require.NoError(t, EnsureRecallContinuousTriggerSlotTx(DB, RecallLifecycleTriggerPaymentPending))
	require.Error(t, EnsureRecallContinuousTriggerSlotTx(DB, "payment_pending_unreviewed"))

	var slots []RecallContinuousTriggerSlot
	require.NoError(t, DB.Find(&slots).Error)
	require.Len(t, slots, 1)
	require.Equal(t, RecallLifecycleTriggerPaymentPending, slots[0].Trigger)
}

func TestLifecycleCollectionMarkerInsertIsWriteOnceAndStrongRead(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMap[OptionKeyRecallLifecycleEventCollectionStartedAt] = "111"
	common.OptionMapRWMutex.Unlock()

	_, err := GetRecallLifecycleEventCollectionStartedAtWithContext(context.Background())
	require.ErrorContains(t, err, "missing")

	const attempts = 8
	var wg sync.WaitGroup
	results := make(chan int64, attempts)
	errs := make(chan error, attempts)
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ts, insertErr := InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext(context.Background())
			if insertErr != nil {
				errs <- insertErr
				return
			}
			results <- ts
		}()
	}
	wg.Wait()
	close(results)
	close(errs)
	require.Empty(t, errs)

	var first int64
	for ts := range results {
		require.Positive(t, ts)
		if first == 0 {
			first = ts
		}
		require.Equal(t, first, ts)
	}
	stored, err := GetRecallLifecycleEventCollectionStartedAtWithContext(context.Background())
	require.NoError(t, err)
	require.Equal(t, first, stored)

	var option Option
	require.NoError(t, DB.First(&option, "key = ?", OptionKeyRecallLifecycleEventCollectionStartedAt).Error)
	require.Equal(t, strconv.FormatInt(first, 10), option.Value)
}

func TestLifecycleCollectionMarkerReadRejectsMalformed(t *testing.T) {
	setupRecallLifecycleTestDB(t)
	require.NoError(t, DB.Create(&Option{Key: OptionKeyRecallLifecycleEventCollectionStartedAt, Value: "not-a-decimal"}).Error)

	_, err := GetRecallLifecycleEventCollectionStartedAtWithContext(context.Background())

	require.ErrorContains(t, err, "malformed")
}

func TestLifecycleContinuousTriggerSlotOwnershipClaimReleaseAndRepair(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	var firstWon, secondWon bool
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		firstWon, err = ClaimRecallContinuousTriggerSlotTx(tx, RecallLifecycleTriggerQuotaLow, 101)
		return err
	}))
	require.True(t, firstWon)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		secondWon, err = ClaimRecallContinuousTriggerSlotTx(tx, RecallLifecycleTriggerQuotaLow, 202)
		return err
	}))
	require.False(t, secondWon)

	var slot RecallContinuousTriggerSlot
	require.NoError(t, DB.First(&slot, "trigger = ?", RecallLifecycleTriggerQuotaLow).Error)
	require.EqualValues(t, 101, slot.CampaignId)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		won, err := ClaimRecallContinuousTriggerSlotTx(tx, RecallLifecycleTriggerQuotaLow, 101)
		require.True(t, won)
		return err
	}))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ReleaseRecallContinuousTriggerSlotTx(tx, RecallLifecycleTriggerQuotaLow, 202)
	}))
	require.NoError(t, DB.First(&slot, "trigger = ?", RecallLifecycleTriggerQuotaLow).Error)
	require.EqualValues(t, 101, slot.CampaignId)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ReleaseRecallContinuousTriggerSlotTx(tx, RecallLifecycleTriggerQuotaLow, 101)
	}))
	require.NoError(t, DB.First(&slot, "trigger = ?", RecallLifecycleTriggerQuotaLow).Error)
	require.Zero(t, slot.CampaignId)

	require.NoError(t, DB.Where("trigger = ?", RecallLifecycleTriggerPaymentPending).Delete(&RecallContinuousTriggerSlot{}).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		won, err := ClaimRecallContinuousTriggerSlotTx(tx, RecallLifecycleTriggerPaymentPending, 303)
		require.True(t, won)
		return err
	}))
	slot = RecallContinuousTriggerSlot{}
	require.NoError(t, DB.First(&slot, "trigger = ?", RecallLifecycleTriggerPaymentPending).Error)
	require.EqualValues(t, 303, slot.CampaignId)
	require.Equal(t, RecallDeliveryPolicyEngagement, slot.DeliveryPolicy)
}

func TestLifecycleInsertConflictSQLIsTargetedByDialect(t *testing.T) {
	dialects := recallLifecycleDryRunDialects(t)
	for name, db := range dialects {
		t.Run(name+"/event", func(t *testing.T) {
			occurrence, err := NewRecallLifecycleQuotaOccurrence(RecallLifecycleTriggerQuotaLow, QuotaLifecycleScopeUser, "77", "2026-08", 77)
			require.NoError(t, err)
			event := RecallLifecycleEvent{
				EventType:         RecallLifecycleTriggerQuotaLow,
				OccurrenceKeyHash: occurrence.Hash,
				BusinessKey:       "quota:77:2026-08",
				UserId:            77,
				EventData:         `{}`,
			}
			sql := strings.ToLower(db.ToSQL(func(tx *gorm.DB) *gorm.DB {
				return insertRecallLifecycleEvent(tx, &event)
			}))
			require.NotContains(t, sql, "insert ignore")
			if name == "mysql" {
				require.Contains(t, sql, "on duplicate key update")
			} else {
				require.Contains(t, sql, "on conflict")
			}
		})

		t.Run(name+"/slot", func(t *testing.T) {
			slot, err := newRecallContinuousTriggerSlot(RecallLifecycleTriggerPaymentPending)
			require.NoError(t, err)
			sql := strings.ToLower(db.ToSQL(func(tx *gorm.DB) *gorm.DB {
				return insertRecallContinuousTriggerSlot(tx, slot)
			}))
			require.NotContains(t, sql, "insert ignore")
			if name == "mysql" {
				require.Contains(t, sql, "on duplicate key update")
			} else {
				require.Contains(t, sql, "on conflict")
			}
		})
	}
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
	require.NotNil(t, parsedSlot.LookUpField("CampaignId"))
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

func recallLifecycleDryRunDialects(t *testing.T) map[string]*gorm.DB {
	t.Helper()
	silentLogger := logger.Default.LogMode(logger.Silent)
	sqliteDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: silentLogger})
	require.NoError(t, err)
	sqlDB, err := sqliteDB.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })

	mysqlDB, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{DryRun: true, DisableAutomaticPing: true, Logger: silentLogger})
	require.NoError(t, err)

	postgresDB, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		DryRun: true, DisableAutomaticPing: true, Logger: silentLogger,
	})
	require.NoError(t, err)

	return map[string]*gorm.DB{
		"sqlite":     sqliteDB.Session(&gorm.Session{DryRun: true}),
		"mysql":      mysqlDB,
		"postgresql": postgresDB,
	}
}
