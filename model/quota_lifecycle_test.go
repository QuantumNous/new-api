package model

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const (
	testMaxInt64 = int64(^uint64(0) >> 1)
	testMinInt64 = -testMaxInt64 - 1
)

func TestLifecycleQuotaStateSchemaAndUniqueScope(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	require.True(t, DB.Migrator().HasTable(&QuotaLifecycleState{}))
	require.True(t, DB.Migrator().HasIndex(&QuotaLifecycleState{}, "idx_quota_lifecycle_scope"))
	require.Equal(t, "TEXT", recallLifecycleSQLiteColumnType(t, "quota_lifecycle_states", "source_data"))

	first := QuotaLifecycleState{
		UserId:       99,
		ScopeType:    QuotaLifecycleScopeUser,
		ScopeId:      "99",
		Cycle:        "2026-08",
		Balance:      1000,
		Threshold:    2000,
		Source:       "quota_scan",
		SourceData:   `{"balance":1000}`,
		StateVersion: 1,
	}
	require.NoError(t, DB.Create(&first).Error)

	duplicate := first
	duplicate.Id = 0
	err := DB.Create(&duplicate).Error
	require.Error(t, err)
}

func TestLifecycleQuotaLockQueriesUseForUpdateForSQLDialects(t *testing.T) {
	originalSQLite := common.UsingSQLite
	t.Cleanup(func() { common.UsingSQLite = originalSQLite })
	source, err := os.ReadFile("quota_lifecycle.go")
	require.NoError(t, err)
	require.NotContains(t, string(source), "gorm:query_option")

	for name, db := range recallLifecycleDryRunDialects(t) {
		if name == "sqlite" {
			continue
		}
		t.Run(name, func(t *testing.T) {
			common.UsingSQLite = false

			queries := []string{
				db.ToSQL(func(tx *gorm.DB) *gorm.DB {
					var user User
					return lockQuery(tx).Where("id = ?", 42).First(&user)
				}),
				db.ToSQL(func(tx *gorm.DB) *gorm.DB {
					var sub UserSubscription
					return lockQuery(tx).Where("id = ? AND user_id = ?", 99, 42).First(&sub)
				}),
				db.ToSQL(func(tx *gorm.DB) *gorm.DB {
					var state QuotaLifecycleState
					return lockQuery(tx).
						Where("user_id = ? AND scope_type = ? AND scope_id = ?", 42, QuotaLifecycleScopeSubscription, "99").
						First(&state)
				}),
			}
			for _, query := range queries {
				require.NotEmpty(t, query)
				require.Contains(t, strings.ToUpper(query), "FOR UPDATE")
			}
		})
	}
}

func TestApplyLifecycleQuotaMutationWalletCrossings(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)

	tests := []struct {
		name       string
		initial    int
		threshold  int64
		delta      int64
		wantEvents []string
	}{
		{name: "above-to-low emits low", initial: 150, threshold: 100, delta: -60, wantEvents: []string{RecallLifecycleTriggerQuotaLow}},
		{name: "low-to-lower emits none", initial: 90, threshold: 100, delta: -10},
		{name: "low-to-zero emits exhausted", initial: 90, threshold: 100, delta: -90, wantEvents: []string{RecallLifecycleTriggerQuotaExhaustedUnpaid}},
		{name: "above-to-zero emits only exhausted", initial: 150, threshold: 100, delta: -150, wantEvents: []string{RecallLifecycleTriggerQuotaExhaustedUnpaid}},
		{name: "zero-to-positive emits none", initial: 0, threshold: 100, delta: 50},
		{name: "refund emits no crossing", initial: 25, threshold: 100, delta: 75},
		{name: "admin grant emits no crossing", initial: 25, threshold: 100, delta: 175},
	}

	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user := createLifecycleQuotaTestUser(t, fmt.Sprintf("wallet-crossing-%d", i), tt.initial, 0)
			cause := "relay_charge"
			if strings.Contains(tt.name, "refund") {
				cause = "refund"
			}
			if strings.Contains(tt.name, "admin grant") {
				cause = "admin_grant"
			}

			result, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
				UserID:     user.Id,
				ScopeType:  QuotaLifecycleScopeWallet,
				ScopeID:    int64(user.Id),
				Delta:      tt.delta,
				Cause:      cause,
				SourceRef:  tt.name,
				Threshold:  tt.threshold,
				OccurredAt: 1700000000 + int64(i),
			})
			require.NoError(t, err)
			require.True(t, result.Applied)
			require.Equal(t, int64(tt.initial), result.PreviousBalance)
			require.Equal(t, int64(tt.initial)+tt.delta, result.CurrentBalance)
			require.Equal(t, fmt.Sprintf("baseline:wallet:%d", user.Id), result.CycleKey)

			requireLifecycleEvents(t, user.Id, QuotaLifecycleScopeWallet, strconv.Itoa(user.Id), result.CycleKey, tt.wantEvents)
		})
	}
}

func TestApplyLifecycleQuotaMutationThresholdFallbackAndLazyBaseline(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)

	userThreshold := createLifecycleQuotaTestUser(t, "user-threshold", 150, 75)
	userResult, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:     userThreshold.Id,
		ScopeType:  QuotaLifecycleScopeWallet,
		ScopeID:    int64(userThreshold.Id),
		Delta:      -80,
		Cause:      "relay_charge",
		SourceRef:  "user-threshold",
		OccurredAt: 1700000100,
	})
	require.NoError(t, err)
	require.True(t, userResult.Applied)
	require.Equal(t, int64(150), userResult.PreviousBalance)
	require.Equal(t, int64(70), userResult.CurrentBalance)
	require.Equal(t, fmt.Sprintf("baseline:wallet:%d", userThreshold.Id), userResult.CycleKey)
	requireLifecycleEvents(t, userThreshold.Id, QuotaLifecycleScopeWallet, strconv.Itoa(userThreshold.Id), userResult.CycleKey, []string{RecallLifecycleTriggerQuotaLow})
	requireLifecycleState(t, userThreshold.Id, QuotaLifecycleScopeWallet, strconv.Itoa(userThreshold.Id), userResult.CycleKey, 70, 75)

	globalThreshold := createLifecycleQuotaTestUser(t, "global-threshold", 150, 0)
	globalResult, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:     globalThreshold.Id,
		ScopeType:  QuotaLifecycleScopeWallet,
		ScopeID:    int64(globalThreshold.Id),
		Delta:      -60,
		Cause:      "relay_charge",
		SourceRef:  "global-threshold",
		OccurredAt: 1700000200,
	})
	require.NoError(t, err)
	require.True(t, globalResult.Applied)
	require.Equal(t, int64(common.QuotaRemindThreshold), lifecycleStateForTest(t, globalThreshold.Id, QuotaLifecycleScopeWallet, strconv.Itoa(globalThreshold.Id)).Threshold)
	requireLifecycleEvents(t, globalThreshold.Id, QuotaLifecycleScopeWallet, strconv.Itoa(globalThreshold.Id), globalResult.CycleKey, []string{RecallLifecycleTriggerQuotaLow})
}

func TestApplyLifecycleQuotaMutationCycleRotationAndDeduplication(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)

	user := createLifecycleQuotaTestUser(t, "cycle", 300, 100)
	first, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:          user.Id,
		ScopeType:       QuotaLifecycleScopeWallet,
		ScopeID:         int64(user.Id),
		Delta:           0,
		Cause:           "topup_success",
		SourceRef:       "topup-1",
		NextCycleKey:    "wallet-cycle-1",
		NextCycleSource: "topup:1",
		OccurredAt:      1700000300,
	})
	require.NoError(t, err)
	require.True(t, first.Applied)
	require.Equal(t, "wallet-cycle-1", first.CycleKey)

	_, err = applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:     user.Id,
		ScopeType:  QuotaLifecycleScopeWallet,
		ScopeID:    int64(user.Id),
		Delta:      -250,
		Cause:      "relay_charge",
		SourceRef:  "charge-1",
		OccurredAt: 1700000310,
	})
	require.NoError(t, err)
	_, err = applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:     user.Id,
		ScopeType:  QuotaLifecycleScopeWallet,
		ScopeID:    int64(user.Id),
		Delta:      -10,
		Cause:      "relay_charge",
		SourceRef:  "charge-2",
		OccurredAt: 1700000320,
	})
	require.NoError(t, err)
	_, err = applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:     user.Id,
		ScopeType:  QuotaLifecycleScopeWallet,
		ScopeID:    int64(user.Id),
		Delta:      -40,
		Cause:      "relay_charge",
		SourceRef:  "charge-3",
		OccurredAt: 1700000330,
	})
	require.NoError(t, err)
	requireLifecycleEvents(t, user.Id, QuotaLifecycleScopeWallet, strconv.Itoa(user.Id), "wallet-cycle-1", []string{
		RecallLifecycleTriggerQuotaLow,
		RecallLifecycleTriggerQuotaExhaustedUnpaid,
	})

	_, err = applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:          user.Id,
		ScopeType:       QuotaLifecycleScopeWallet,
		ScopeID:         int64(user.Id),
		Delta:           300,
		Cause:           "refund",
		SourceRef:       "refund-no-rotate",
		NextCycleKey:    "wallet-cycle-rejected",
		NextCycleSource: "refund",
		OccurredAt:      1700000340,
	})
	require.Error(t, err)
	require.NotEqual(t, "wallet-cycle-rejected", lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeWallet, strconv.Itoa(user.Id)).Cycle)

	second, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:          user.Id,
		ScopeType:       QuotaLifecycleScopeWallet,
		ScopeID:         int64(user.Id),
		Delta:           300,
		Cause:           "topup_success",
		SourceRef:       "topup-2",
		NextCycleKey:    "wallet-cycle-2",
		NextCycleSource: "topup:2",
		OccurredAt:      1700000350,
	})
	require.NoError(t, err)
	require.Equal(t, "wallet-cycle-2", second.CycleKey)
	_, err = applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:     user.Id,
		ScopeType:  QuotaLifecycleScopeWallet,
		ScopeID:    int64(user.Id),
		Delta:      -250,
		Cause:      "relay_charge",
		SourceRef:  "charge-4",
		OccurredAt: 1700000360,
	})
	require.NoError(t, err)
	requireLifecycleEvents(t, user.Id, QuotaLifecycleScopeWallet, strconv.Itoa(user.Id), "wallet-cycle-2", []string{RecallLifecycleTriggerQuotaLow})
}

func TestApplyLifecycleQuotaMutationSubscriptionScopeAndRollback(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)

	user := createLifecycleQuotaTestUser(t, "subscription-scope", 500, 100)
	sub := createLifecycleQuotaTestSubscription(t, user.Id, 200, 50)
	walletCycle := fmt.Sprintf("baseline:wallet:%d", user.Id)
	subCycle := fmt.Sprintf("baseline:subscription:%d", sub.Id)

	_, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:     user.Id,
		ScopeType:  QuotaLifecycleScopeWallet,
		ScopeID:    int64(user.Id),
		Delta:      -425,
		Cause:      "relay_charge",
		SourceRef:  "wallet-independent",
		OccurredAt: 1700000400,
	})
	require.NoError(t, err)
	_, err = applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:     user.Id,
		ScopeType:  QuotaLifecycleScopeSubscription,
		ScopeID:    int64(sub.Id),
		Delta:      -125,
		Cause:      "subscription_pre_consume",
		SourceRef:  "subscription-independent",
		OccurredAt: 1700000410,
	})
	require.NoError(t, err)

	requireLifecycleEvents(t, user.Id, QuotaLifecycleScopeWallet, strconv.Itoa(user.Id), walletCycle, []string{RecallLifecycleTriggerQuotaLow})
	requireLifecycleEvents(t, user.Id, QuotaLifecycleScopeSubscription, strconv.Itoa(sub.Id), subCycle, []string{RecallLifecycleTriggerQuotaLow})

	injected := fmt.Errorf("rollback after lifecycle mutation")
	err = DB.Transaction(func(tx *gorm.DB) error {
		_, err := ApplyLifecycleQuotaMutation(tx, LifecycleQuotaMutation{
			UserID:         user.Id,
			ScopeType:      QuotaLifecycleScopeSubscription,
			ScopeID:        int64(sub.Id),
			Delta:          -75,
			RequireAtLeast: 75,
			Cause:          "subscription_pre_consume",
			SourceRef:      "rollback",
			OccurredAt:     1700000420,
		})
		require.NoError(t, err)
		return injected
	})
	require.ErrorIs(t, err, injected)
	requireLifecycleState(t, user.Id, QuotaLifecycleScopeSubscription, strconv.Itoa(sub.Id), subCycle, 25, int64(common.QuotaRemindThreshold))
	requireLifecycleEvents(t, user.Id, QuotaLifecycleScopeSubscription, strconv.Itoa(sub.Id), subCycle, []string{RecallLifecycleTriggerQuotaLow})
}

func TestApplyLifecycleQuotaMutationSubscriptionZeroDeltaRotationSkipsAmountUsedUpdate(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)

	user := createLifecycleQuotaTestUser(t, "subscription-zero-delta", 500, 100)
	sub := createLifecycleQuotaTestSubscription(t, user.Id, 100, 0)
	amountUsedUpdates := 0
	callbackName := "test:record_subscription_amount_used_update"
	require.NoError(t, DB.Callback().Update().After("gorm:update").Register(callbackName, func(db *gorm.DB) {
		sql := strings.ToLower(db.Statement.SQL.String())
		if strings.Contains(sql, "user_subscriptions") && strings.Contains(sql, "amount_used") {
			amountUsedUpdates++
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Update().Remove(callbackName))
	})

	result, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:          user.Id,
		ScopeType:       QuotaLifecycleScopeSubscription,
		ScopeID:         int64(sub.Id),
		Delta:           0,
		Cause:           "subscription_purchase",
		SourceRef:       "subscription-zero-delta",
		NextCycleKey:    "sub-cycle-1",
		NextCycleSource: "subscription:test",
		OccurredAt:      1700000430,
	})

	require.NoError(t, err)
	require.True(t, result.Applied)
	require.Equal(t, int64(100), result.PreviousBalance)
	require.Equal(t, int64(100), result.CurrentBalance)
	require.Equal(t, "sub-cycle-1", result.CycleKey)
	require.Zero(t, amountUsedUpdates)
	requireLifecycleState(t, user.Id, QuotaLifecycleScopeSubscription, strconv.Itoa(sub.Id), "sub-cycle-1", 100, 100)
}

func TestApplyLifecycleQuotaMutationSubscriptionOverRefundUsesClampedBalance(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)

	user := createLifecycleQuotaTestUser(t, "subscription-over-refund", 500, 100)
	sub := createLifecycleQuotaTestSubscription(t, user.Id, 100, 20)

	result, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:     user.Id,
		ScopeType:  QuotaLifecycleScopeSubscription,
		ScopeID:    int64(sub.Id),
		Delta:      100,
		Cause:      "refund",
		SourceRef:  "subscription-over-refund",
		OccurredAt: 1700000440,
	})

	require.NoError(t, err)
	require.True(t, result.Applied)
	require.Equal(t, int64(80), result.PreviousBalance)
	require.Equal(t, int64(100), result.CurrentBalance)
	require.Equal(t, int64(100), subscriptionRemainingForTest(t, sub.Id))
	state := lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeSubscription, strconv.Itoa(sub.Id))
	require.Equal(t, int64(100), state.Balance)
	var sourceData map[string]any
	require.NoError(t, common.Unmarshal([]byte(state.SourceData), &sourceData))
	require.Equal(t, float64(100), sourceData["current_balance"])
}

func TestApplyLifecycleQuotaMutationRejectsWalletBalanceOverflow(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)

	user := createLifecycleQuotaTestUser(t, "wallet-overflow", int(testMaxInt64), 100)
	_, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:    user.Id,
		ScopeType: QuotaLifecycleScopeWallet,
		ScopeID:   int64(user.Id),
		Delta:     1,
		Cause:     "admin_grant",
		SourceRef: "wallet-overflow",
	})

	require.ErrorIs(t, err, ErrLifecycleQuotaBalanceOverflow)
	require.Equal(t, int(testMaxInt64), walletQuotaForTest(t, user.Id))
}

func TestApplyLifecycleQuotaMutationRejectsFiniteSubscriptionBalanceUnderflow(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)

	user := createLifecycleQuotaTestUser(t, "subscription-underflow", 0, 100)
	sub := createLifecycleQuotaTestSubscription(t, user.Id, 100, 0)
	_, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:    user.Id,
		ScopeType: QuotaLifecycleScopeSubscription,
		ScopeID:   int64(sub.Id),
		Delta:     testMinInt64,
		Cause:     "subscription_adjustment",
		SourceRef: "subscription-underflow",
	})

	require.ErrorIs(t, err, ErrLifecycleQuotaBalanceOverflow)
	require.Equal(t, int64(0), subscriptionAmountUsedForTest(t, sub.Id))
}

func TestApplyLifecycleQuotaMutationRejectsUnlimitedSubscriptionUsedOverflow(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)

	user := createLifecycleQuotaTestUser(t, "subscription-unlimited-overflow", 0, 100)
	sub := createLifecycleQuotaTestSubscription(t, user.Id, 0, testMaxInt64)
	_, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:    user.Id,
		ScopeType: QuotaLifecycleScopeSubscription,
		ScopeID:   int64(sub.Id),
		Delta:     -1,
		Cause:     "subscription_adjustment",
		SourceRef: "subscription-unlimited-overflow",
	})

	require.ErrorIs(t, err, ErrLifecycleQuotaBalanceOverflow)
	require.Equal(t, testMaxInt64, subscriptionAmountUsedForTest(t, sub.Id))
}

func TestApplyLifecycleQuotaMutationDoesNotAutoMigrateLifecycleTables(t *testing.T) {
	setupLifecycleQuotaMissingSchemaTestDB(t)

	user := createLifecycleQuotaTestUser(t, "missing-schema", 100, 100)
	_, err := applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
		UserID:    user.Id,
		ScopeType: QuotaLifecycleScopeWallet,
		ScopeID:   int64(user.Id),
		Delta:     -10,
		Cause:     "wallet_debit",
		SourceRef: "missing-schema",
	})

	require.Error(t, err)
	require.False(t, DB.Migrator().HasTable(&QuotaLifecycleState{}))
	require.False(t, DB.Migrator().HasTable(&RecallLifecycleEvent{}))
}

func TestLifecycleQuotaWalletAdaptersCommitSynchronouslyWhenBatchEnabled(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)
	common.BatchUpdateEnabled = true
	clearBatchUpdateStoreForTest(t, BatchUpdateTypeUserQuota)

	user := createLifecycleQuotaTestUser(t, "wallet-adapters", 200, 100)
	require.NoError(t, IncreaseUserQuota(user.Id, 50, false))
	require.Equal(t, 250, walletQuotaForTest(t, user.Id))
	require.Empty(t, batchUpdateStores[BatchUpdateTypeUserQuota])

	require.NoError(t, DecreaseUserQuota(user.Id, 80, false))
	require.Equal(t, 170, walletQuotaForTest(t, user.Id))
	require.Empty(t, batchUpdateStores[BatchUpdateTypeUserQuota])

	ok, err := PreConsumeUserQuota(user.Id, 90)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, 80, walletQuotaForTest(t, user.Id))
	requireLifecycleEvents(t, user.Id, QuotaLifecycleScopeWallet, strconv.Itoa(user.Id), fmt.Sprintf("baseline:wallet:%d", user.Id), []string{RecallLifecycleTriggerQuotaLow})

	require.NoError(t, RefundUserQuota(user.Id, 20))
	require.Equal(t, 100, walletQuotaForTest(t, user.Id))
	require.Empty(t, batchUpdateStores[BatchUpdateTypeUserQuota])

	ok, err = PreConsumeUserQuota(user.Id, 500)
	require.NoError(t, err)
	require.False(t, ok)
	require.Equal(t, 100, walletQuotaForTest(t, user.Id))
}

func applyLifecycleQuotaMutationForTest(mutation LifecycleQuotaMutation) (LifecycleQuotaMutationResult, error) {
	var result LifecycleQuotaMutationResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		applied, err := ApplyLifecycleQuotaMutation(tx, mutation)
		result = applied
		return err
	})
	return result, err
}

func setupLifecycleQuotaMutationTestDB(t *testing.T, maxOpenConns int) {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	originalRedis := common.RedisEnabled
	originalBatch := common.BatchUpdateEnabled
	originalThreshold := common.QuotaRemindThreshold

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/quota-lifecycle.db?_pragma=busy_timeout(10000)&_txlock=immediate"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	if maxOpenConns <= 0 {
		maxOpenConns = 1
	}
	sqlDB.SetMaxOpenConns(maxOpenConns)
	DB = db
	LOG_DB = db
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.QuotaRemindThreshold = 100

	require.NoError(t, db.AutoMigrate(
		&User{},
		&SubscriptionPlan{},
		&UserSubscription{},
		&SubscriptionPreConsumeRecord{},
		&RecallLifecycleEvent{},
		&QuotaLifecycleState{},
	))

	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
		LOG_DB = originalLogDB
		common.RedisEnabled = originalRedis
		common.BatchUpdateEnabled = originalBatch
		common.QuotaRemindThreshold = originalThreshold
	})
}

func setupLifecycleQuotaMissingSchemaTestDB(t *testing.T) {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	originalRedis := common.RedisEnabled
	originalBatch := common.BatchUpdateEnabled
	originalThreshold := common.QuotaRemindThreshold

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/quota-lifecycle-missing-schema.db"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	DB = db
	LOG_DB = db
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.QuotaRemindThreshold = 100

	require.NoError(t, db.AutoMigrate(
		&User{},
		&SubscriptionPlan{},
		&UserSubscription{},
	))

	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
		LOG_DB = originalLogDB
		common.RedisEnabled = originalRedis
		common.BatchUpdateEnabled = originalBatch
		common.QuotaRemindThreshold = originalThreshold
	})
}

func createLifecycleQuotaTestUser(t *testing.T, name string, quota int, threshold float64) User {
	t.Helper()
	user := User{
		Username: fmt.Sprintf("quota-life-%s", name),
		Password: "password123",
		Email:    fmt.Sprintf("%s@example.com", name),
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Quota:    quota,
		AffCode:  fmt.Sprintf("aff-%s", name),
	}
	if threshold > 0 {
		user.SetSetting(dto.UserSetting{QuotaWarningThreshold: threshold})
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func createLifecycleQuotaTestSubscription(t *testing.T, userID int, total int64, used int64) UserSubscription {
	t.Helper()
	plan := SubscriptionPlan{
		Title:         fmt.Sprintf("quota lifecycle plan %d", userID),
		Subtitle:      "test",
		DurationValue: 1,
		DurationUnit:  SubscriptionDurationMonth,
		TotalAmount:   total,
		Enabled:       true,
	}
	require.NoError(t, DB.Create(&plan).Error)
	now := GetDBTimestamp()
	sub := UserSubscription{
		UserId:      userID,
		PlanId:      plan.Id,
		AmountTotal: total,
		AmountUsed:  used,
		StartTime:   now,
		EndTime:     now + 86400,
		Status:      "active",
		Source:      "test",
	}
	require.NoError(t, DB.Create(&sub).Error)
	return sub
}

func requireLifecycleEvents(t *testing.T, userID int, scopeType string, scopeID string, cycle string, want []string) {
	t.Helper()
	var events []RecallLifecycleEvent
	require.NoError(t, DB.Where("user_id = ? AND scope_type = ? AND scope_id = ? AND business_key LIKE ?", userID, scopeType, scopeID, "%cycle:"+cycle+"%").
		Order("id asc").
		Find(&events).Error)
	got := make([]string, 0, len(events))
	for _, event := range events {
		got = append(got, event.EventType)
		require.Contains(t, event.BusinessKey, fmt.Sprintf("%s:%s", scopeType, scopeID))
		require.Contains(t, event.BusinessKey, "cycle:"+cycle)
	}
	if want == nil {
		want = []string{}
	}
	require.Equal(t, want, got)
}

func requireLifecycleState(t *testing.T, userID int, scopeType string, scopeID string, cycle string, balance int64, threshold int64) {
	t.Helper()
	state := lifecycleStateForTest(t, userID, scopeType, scopeID)
	require.Equal(t, cycle, state.Cycle)
	require.Equal(t, balance, state.Balance)
	require.Equal(t, threshold, state.Threshold)
}

func lifecycleStateForTest(t *testing.T, userID int, scopeType string, scopeID string) QuotaLifecycleState {
	t.Helper()
	var state QuotaLifecycleState
	require.NoError(t, DB.Where("user_id = ? AND scope_type = ? AND scope_id = ?", userID, scopeType, scopeID).First(&state).Error)
	return state
}

func walletQuotaForTest(t *testing.T, userID int) int {
	t.Helper()
	var quota int
	require.NoError(t, DB.Model(&User{}).Where("id = ?", userID).Select("quota").Scan(&quota).Error)
	return quota
}

func subscriptionRemainingForTest(t *testing.T, subscriptionID int) int64 {
	t.Helper()
	var sub UserSubscription
	require.NoError(t, DB.Where("id = ?", subscriptionID).First(&sub).Error)
	return sub.AmountTotal - sub.AmountUsed
}

func clearBatchUpdateStoreForTest(t *testing.T, storeType int) {
	t.Helper()
	batchUpdateLocks[storeType].Lock()
	batchUpdateStores[storeType] = make(map[int]int)
	batchUpdateLocks[storeType].Unlock()
}
