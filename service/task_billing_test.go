package service

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMain(m *testing.M) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to open test db: " + err.Error())
	}
	sqlDB, err := db.DB()
	if err != nil {
		panic("failed to get sql.DB: " + err.Error())
	}
	sqlDB.SetMaxOpenConns(1)

	model.DB = db
	model.LOG_DB = db

	common.UsingSQLite = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true

	if err := db.AutoMigrate(
		&model.Task{},
		&model.User{},
		&model.Token{},
		&model.Log{},
		&model.Channel{},
		&model.TopUp{},
		&model.UserSubscription{},
	); err != nil {
		panic("failed to migrate: " + err.Error())
	}

	os.Exit(m.Run())
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

func truncate(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM tasks")
		model.DB.Exec("DELETE FROM users")
		model.DB.Exec("DELETE FROM tokens")
		model.DB.Exec("DELETE FROM logs")
		model.DB.Exec("DELETE FROM channels")
		model.DB.Exec("DELETE FROM top_ups")
		model.DB.Exec("DELETE FROM user_subscriptions")
	})
}

func seedUser(t *testing.T, id int, quota int) {
	t.Helper()
	user := &model.User{Id: id, Username: "test_user", Quota: quota, Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(user).Error)
}

func seedToken(t *testing.T, id int, userId int, key string, remainQuota int) {
	t.Helper()
	token := &model.Token{
		Id:          id,
		UserId:      userId,
		Key:         key,
		Name:        "test_token",
		Status:      common.TokenStatusEnabled,
		RemainQuota: remainQuota,
		UsedQuota:   0,
	}
	require.NoError(t, model.DB.Create(token).Error)
}

func seedSubscription(t *testing.T, id int, userId int, amountTotal int64, amountUsed int64) {
	t.Helper()
	sub := &model.UserSubscription{
		Id:          id,
		UserId:      userId,
		AmountTotal: amountTotal,
		AmountUsed:  amountUsed,
		Status:      "active",
		StartTime:   time.Now().Unix(),
		EndTime:     time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	require.NoError(t, model.DB.Create(sub).Error)
}

func seedChannel(t *testing.T, id int) {
	t.Helper()
	ch := &model.Channel{Id: id, Name: "test_channel", Key: "sk-test", Status: common.ChannelStatusEnabled}
	require.NoError(t, model.DB.Create(ch).Error)
}

// makeTask constructs an in-memory task. Most tests should use seedTask
// instead so the row exists for the targeted UPDATE in RecalculateTaskQuota.
func makeTask(userId, channelId, quota, tokenId int, billingSource string, subscriptionId int) *model.Task {
	return &model.Task{
		TaskID:    "task_" + time.Now().Format("150405.000000"),
		UserId:    userId,
		ChannelId: channelId,
		Quota:     quota,
		Status:    model.TaskStatus(model.TaskStatusInProgress),
		Group:     "default",
		Data:      json.RawMessage(`{}`),
		CreatedAt: time.Now().Unix(),
		UpdatedAt: time.Now().Unix(),
		Properties: model.Properties{
			OriginModelName: "test-model",
		},
		PrivateData: model.TaskPrivateData{
			BillingSource:  billingSource,
			SubscriptionId: subscriptionId,
			TokenId:        tokenId,
			BillingContext: &model.TaskBillingContext{
				ModelPrice:      0.02,
				GroupRatio:      1.0,
				OriginModelName: "test-model",
			},
		},
	}
}

// seedTask is the standard helper for settle/recalc tests: it builds a task
// and inserts it into the in-memory DB so RecalculateTaskQuota's targeted
// UPDATE can match the row. Tests that intentionally exercise the missing-row
// path (RowsAffected == 0) should use makeTask without a Create.
func seedTask(t *testing.T, userId, channelId, quota, tokenId int, billingSource string, subscriptionId int) *model.Task {
	t.Helper()
	task := makeTask(userId, channelId, quota, tokenId, billingSource, subscriptionId)
	require.NoError(t, model.DB.Create(task).Error)
	return task
}

// ---------------------------------------------------------------------------
// Read-back helpers
// ---------------------------------------------------------------------------

func getUserQuota(t *testing.T, id int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("quota").Where("id = ?", id).First(&user).Error)
	return user.Quota
}

func getUserUsedQuotaAndRequestCount(t *testing.T, id int) (int, int) {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("used_quota", "request_count").Where("id = ?", id).First(&user).Error)
	return user.UsedQuota, user.RequestCount
}

func getChannelUsedQuota(t *testing.T, id int) int64 {
	t.Helper()
	var channel model.Channel
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", id).First(&channel).Error)
	return channel.UsedQuota
}

func getTokenRemainQuota(t *testing.T, id int) int {
	t.Helper()
	var token model.Token
	require.NoError(t, model.DB.Select("remain_quota").Where("id = ?", id).First(&token).Error)
	return token.RemainQuota
}

func getTokenUsedQuota(t *testing.T, id int) int {
	t.Helper()
	var token model.Token
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", id).First(&token).Error)
	return token.UsedQuota
}

func getSubscriptionUsed(t *testing.T, id int) int64 {
	t.Helper()
	var sub model.UserSubscription
	require.NoError(t, model.DB.Select("amount_used").Where("id = ?", id).First(&sub).Error)
	return sub.AmountUsed
}

func getSubscriptionUpdatedAt(t *testing.T, id int) int64 {
	t.Helper()
	var sub model.UserSubscription
	require.NoError(t, model.DB.Select("updated_at").Where("id = ?", id).First(&sub).Error)
	return sub.UpdatedAt
}

func getLastLog(t *testing.T) *model.Log {
	t.Helper()
	var log model.Log
	err := model.LOG_DB.Order("id desc").First(&log).Error
	if err != nil {
		return nil
	}
	return &log
}

func countLogs(t *testing.T) int64 {
	t.Helper()
	var count int64
	model.LOG_DB.Model(&model.Log{}).Count(&count)
	return count
}

// ===========================================================================
// RefundTaskQuota tests
// ===========================================================================

func TestRefundTaskQuota_Wallet(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 1, 1, 1
	const initQuota, preConsumed = 10000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-test-key", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RefundTaskQuota(ctx, task, "task failed: upstream error")

	// User quota should increase by preConsumed
	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID))

	// Token remain_quota should increase, used_quota should decrease
	assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, -preConsumed, getTokenUsedQuota(t, tokenID))

	// A refund log should be created
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
	assert.Equal(t, preConsumed, log.Quota)
	assert.Equal(t, "test-model", log.ModelName)
}

func TestRefundTaskQuota_Subscription(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID, subID = 2, 2, 2, 1
	const preConsumed = 2000
	const subTotal, subUsed int64 = 100000, 50000
	const tokenRemain = 8000

	seedUser(t, userID, 0)
	seedToken(t, tokenID, userID, "sk-sub-key", tokenRemain)
	seedChannel(t, channelID)
	seedSubscription(t, subID, userID, subTotal, subUsed)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceSubscription, subID)

	RefundTaskQuota(ctx, task, "subscription task failed")

	// Subscription used should decrease by preConsumed
	assert.Equal(t, subUsed-int64(preConsumed), getSubscriptionUsed(t, subID))

	// Token should also be refunded
	assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID))

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

func TestRefundTaskQuota_ZeroQuota(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID = 3
	seedUser(t, userID, 5000)

	task := seedTask(t, userID, 0, 0, 0, BillingSourceWallet, 0)

	RefundTaskQuota(ctx, task, "zero quota task")

	// No change to user quota
	assert.Equal(t, 5000, getUserQuota(t, userID))

	// No log created
	assert.Equal(t, int64(0), countLogs(t))
}

func TestRefundTaskQuota_NoToken(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, channelID = 4, 4
	const initQuota, preConsumed = 10000, 1500

	seedUser(t, userID, initQuota)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, 0, BillingSourceWallet, 0) // TokenId=0

	RefundTaskQuota(ctx, task, "no token task failed")

	// User quota refunded
	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID))

	// Log created
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

// ===========================================================================
// RecalculateTaskQuota tests
// ===========================================================================

func TestRecalculate_PositiveDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 10, 10, 10
	const initQuota, preConsumed = 10000, 2000
	const actualQuota = 3000 // under-charged by 1000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-recalc-pos", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, actualQuota, "adaptor adjustment")

	// User quota should decrease by the delta (1000 additional charge)
	assert.Equal(t, initQuota-(actualQuota-preConsumed), getUserQuota(t, userID))

	// Token should also be charged the delta
	assert.Equal(t, tokenRemain-(actualQuota-preConsumed), getTokenRemainQuota(t, tokenID))

	usedQuota, requestCount := getUserUsedQuotaAndRequestCount(t, userID)
	assert.Equal(t, actualQuota-preConsumed, usedQuota)
	assert.Equal(t, 0, requestCount, "settle must not increment request_count (already counted at submit time)")
	assert.Equal(t, int64(actualQuota-preConsumed), getChannelUsedQuota(t, channelID))

	// task.Quota should be updated to actualQuota
	assert.Equal(t, actualQuota, task.Quota)

	// Log type should be Consume (additional charge)
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeConsume, log.Type)
	assert.Equal(t, actualQuota-preConsumed, log.Quota)
}

func TestRecalculate_NegativeDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 11, 11, 11
	const initQuota, preConsumed = 10000, 5000
	const actualQuota = 3000 // over-charged by 2000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-recalc-neg", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, actualQuota, "adaptor adjustment")

	// User quota should increase by abs(delta) = 2000 (refund overpayment)
	assert.Equal(t, initQuota+(preConsumed-actualQuota), getUserQuota(t, userID))

	// Token should be refunded the difference
	assert.Equal(t, tokenRemain+(preConsumed-actualQuota), getTokenRemainQuota(t, tokenID))

	// task.Quota updated
	assert.Equal(t, actualQuota, task.Quota)

	// Log type should be Refund
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
	assert.Equal(t, preConsumed-actualQuota, log.Quota)
}

func TestRecalculate_ZeroDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID = 12
	const initQuota, preConsumed = 10000, 3000

	seedUser(t, userID, initQuota)

	task := seedTask(t, userID, 0, preConsumed, 0, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, preConsumed, "exact match")

	// No change to user quota
	assert.Equal(t, initQuota, getUserQuota(t, userID))

	// No log created (delta is zero)
	assert.Equal(t, int64(0), countLogs(t))
}

func TestRecalculate_ActualQuotaZero(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID = 13
	const initQuota = 10000

	seedUser(t, userID, initQuota)

	task := seedTask(t, userID, 0, 5000, 0, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, 0, "zero actual")

	// No change (early return)
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, int64(0), countLogs(t))
}

func TestRecalculate_NoToken_PositiveDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, channelID = 15, 15
	const initQuota, preConsumed = 10000, 2000
	const actualQuota = 3500

	seedUser(t, userID, initQuota)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, 0, BillingSourceWallet, 0) // TokenId=0 playground task

	RecalculateTaskQuota(ctx, task, actualQuota, "playground tokenless settle")

	// Playground tasks do not have a persisted token row, but wallet quota must still settle.
	assert.Equal(t, initQuota-(actualQuota-preConsumed), getUserQuota(t, userID))
	assert.Equal(t, actualQuota, task.Quota)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeConsume, log.Type)
	assert.Equal(t, 0, log.TokenId)
	assert.Equal(t, actualQuota-preConsumed, log.Quota)
}

func TestRecalculate_NoToken_NegativeDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, channelID = 16, 16
	const initQuota, preConsumed = 10000, 5000
	const actualQuota = 3200

	seedUser(t, userID, initQuota)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, 0, BillingSourceWallet, 0) // TokenId=0 playground task

	RecalculateTaskQuota(ctx, task, actualQuota, "playground tokenless refund")

	// Refund must go back to the user's wallet even when there is no token quota to restore.
	assert.Equal(t, initQuota+(preConsumed-actualQuota), getUserQuota(t, userID))
	assert.Equal(t, actualQuota, task.Quota)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
	assert.Equal(t, 0, log.TokenId)
	assert.Equal(t, preConsumed-actualQuota, log.Quota)
}

func TestRecalculate_Subscription_NegativeDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID, subID = 14, 14, 14, 2
	const preConsumed = 5000
	const actualQuota = 2000 // over-charged by 3000
	const subTotal, subUsed int64 = 100000, 50000
	const tokenRemain = 8000

	seedUser(t, userID, 0)
	seedToken(t, tokenID, userID, "sk-sub-recalc", tokenRemain)
	seedChannel(t, channelID)
	seedSubscription(t, subID, userID, subTotal, subUsed)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("id = ?", subID).Update("updated_at", int64(1)).Error)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceSubscription, subID)

	RecalculateTaskQuota(ctx, task, actualQuota, "subscription over-charge")

	// Subscription used should decrease by delta (refund 3000), and audit timestamp should update.
	assert.Equal(t, subUsed-int64(preConsumed-actualQuota), getSubscriptionUsed(t, subID))
	assert.NotEqual(t, int64(1), getSubscriptionUpdatedAt(t, subID))

	// Token refunded
	assert.Equal(t, tokenRemain+(preConsumed-actualQuota), getTokenRemainQuota(t, tokenID))

	assert.Equal(t, actualQuota, task.Quota)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

// TestRecalculate_DBUpdateFailure_KeepsInvariant locks down the rollback
// behaviour added in the reorder fix: when the targeted UPDATE on tasks fails
// (e.g. transient DB error or missing table), RecalculateTaskQuota must abort
// the entire settle — wallet/token/log untouched and in-memory task.Quota
// rolled back to pre_consumed. Otherwise we silently recreate the exact
// inconsistency the persistence is meant to fix (wallet debited but
// tasks.quota stale).
func TestRecalculate_DBUpdateFailure_KeepsInvariant(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 40, 40, 40
	const initQuota, preConsumed = 10000, 5000
	const actualQuota = 1500
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-update-fail", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	// Drop the tasks table to force the targeted UPDATE to fail. Re-migrate
	// in cleanup so the rest of the test suite still has the table.
	require.NoError(t, model.DB.Exec("DROP TABLE tasks").Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.AutoMigrate(&model.Task{}))
	})

	logsBefore := countLogs(t)

	RecalculateTaskQuota(ctx, task, actualQuota, "simulated DB failure")

	// 1. In-memory task.Quota rolled back to pre_consumed.
	assert.Equal(t, preConsumed, task.Quota, "task.Quota should be rolled back when DB UPDATE fails")

	// 2. Wallet untouched.
	assert.Equal(t, initQuota, getUserQuota(t, userID), "user wallet should not change on UPDATE failure")

	// 3. Token untouched.
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID), "token remain_quota should not change on UPDATE failure")

	// 4. No billing log written.
	assert.Equal(t, logsBefore, countLogs(t), "no billing log should be written on UPDATE failure")
}

// TestRecalculate_PersistsTaskQuotaToDB locks down the bug fixed by the
// targeted UPDATE inside RecalculateTaskQuota: the polling settle path
// (service/task_polling.go::SettleTaskBillingOnComplete) does not call
// task.Update() afterwards, so without the in-function persistence the
// tasks.quota row keeps the pre-consumed value forever and the history UI
// shows the wrong (over-large) cost.
//
// The test seeds the task into the DB, runs RecalculateTaskQuota, and asserts
// the actualQuota is reflected on a freshly-fetched row. Without the
// persistence the assertion would fail.
func TestRecalculate_PersistsTaskQuotaToDB(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 30, 30, 30
	const initQuota, preConsumed = 10000, 5000
	const actualQuota = 1500 // big over-charge to mirror the production seedance scenario

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-recalc-persist", 5000)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	require.NotZero(t, task.ID, "GORM should assign an autoincrement ID")

	RecalculateTaskQuota(ctx, task, actualQuota, "polling settle")

	// 1. In-memory mutation (existing contract).
	assert.Equal(t, actualQuota, task.Quota, "in-memory task.Quota should be updated")

	// 2. Database row reflects the actualQuota — this is what the history UI
	//    reads. Without the targeted UPDATE inside RecalculateTaskQuota this
	//    assertion would fail because nothing else persists task.Quota along
	//    the polling path.
	var fetched model.Task
	require.NoError(t, model.DB.First(&fetched, task.ID).Error, "fetch task back from DB")
	assert.Equal(t, actualQuota, fetched.Quota, "tasks.quota row must be persisted to actualQuota")
	assert.NotZero(t, fetched.UpdatedAt, "updated_at should be bumped by the targeted UPDATE")
}

// ===========================================================================
// CAS + Billing integration tests
// Simulates the flow in updateVideoSingleTask (service/task_polling.go)
// ===========================================================================

// simulatePollBilling reproduces the CAS + billing logic from updateVideoSingleTask.
// It takes a persisted task (already in DB), applies the new status, and performs
// the conditional update + billing exactly as the polling loop does.
func simulatePollBilling(ctx context.Context, task *model.Task, newStatus model.TaskStatus, actualQuota int) {
	snap := task.Snapshot()

	shouldRefund := false
	shouldSettle := false
	quota := task.Quota

	task.Status = newStatus
	switch string(newStatus) {
	case model.TaskStatusSuccess:
		task.Progress = "100%"
		task.FinishTime = 9999
		shouldSettle = true
	case model.TaskStatusFailure:
		task.Progress = "100%"
		task.FinishTime = 9999
		task.FailReason = "upstream error"
		if quota != 0 {
			shouldRefund = true
		}
	default:
		task.Progress = "50%"
	}

	isDone := task.Status == model.TaskStatus(model.TaskStatusSuccess) || task.Status == model.TaskStatus(model.TaskStatusFailure)
	if isDone && snap.Status != task.Status {
		won, err := task.UpdateWithStatus(snap.Status)
		if err != nil {
			shouldRefund = false
			shouldSettle = false
		} else if !won {
			shouldRefund = false
			shouldSettle = false
		}
	} else if !snap.Equal(task.Snapshot()) {
		_, _ = task.UpdateWithStatus(snap.Status)
	}

	if shouldSettle && actualQuota > 0 {
		RecalculateTaskQuota(ctx, task, actualQuota, "test settle")
	}
	if shouldRefund {
		RefundTaskQuota(ctx, task, task.FailReason)
	}
}

func TestCASGuardedRefund_Win(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 20, 20, 20
	const initQuota, preConsumed = 10000, 4000
	const tokenRemain = 6000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-cas-refund-win", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)

	simulatePollBilling(ctx, task, model.TaskStatus(model.TaskStatusFailure), 0)

	// CAS wins: task in DB should now be FAILURE
	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, reloaded.Status)

	// Refund should have happened
	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID))

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

func TestCASGuardedRefund_Lose(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 21, 21, 21
	const initQuota, preConsumed = 10000, 4000
	const tokenRemain = 6000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-cas-refund-lose", tokenRemain)
	seedChannel(t, channelID)

	// Create task with IN_PROGRESS in DB
	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)

	// Simulate another process already transitioning to FAILURE
	model.DB.Model(&model.Task{}).Where("id = ?", task.ID).Update("status", model.TaskStatusFailure)

	// Our process still has the old in-memory state (IN_PROGRESS) and tries to transition
	// task.Status is still IN_PROGRESS in the snapshot
	simulatePollBilling(ctx, task, model.TaskStatus(model.TaskStatusFailure), 0)

	// CAS lost: user quota should NOT change (no double refund)
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID))

	// No billing log should be created
	assert.Equal(t, int64(0), countLogs(t))
}

func TestCASGuardedSettle_Win(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 22, 22, 22
	const initQuota, preConsumed = 10000, 5000
	const actualQuota = 3000 // over-charged, should get partial refund
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-cas-settle-win", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)

	simulatePollBilling(ctx, task, model.TaskStatus(model.TaskStatusSuccess), actualQuota)

	// CAS wins: task should be SUCCESS
	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusSuccess, reloaded.Status)

	// Settlement should refund the over-charge (5000 - 3000 = 2000 back to user)
	assert.Equal(t, initQuota+(preConsumed-actualQuota), getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+(preConsumed-actualQuota), getTokenRemainQuota(t, tokenID))

	// task.Quota should be updated to actualQuota
	assert.Equal(t, actualQuota, task.Quota)
}

// TestCASGuardedSettle_Lose mirrors TestCASGuardedRefund_Lose for the settle
// path: another process already transitioned the task to SUCCESS, and our
// process — still holding the old IN_PROGRESS in-memory state — must NOT
// re-settle. Without the won-flag check, the wallet would be debited twice
// and a duplicate billing log would be written. This is the more dangerous
// direction (over-charging the user) and the exact scenario that motivates
// the CAS in the first place.
func TestCASGuardedSettle_Lose(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 24, 24, 24
	const initQuota, preConsumed = 10000, 5000
	const actualQuota = 7000 // under-charged; duplicate settle would over-charge by 2000
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-cas-settle-lose", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)

	// Another process already transitioned the row to SUCCESS and presumably
	// settled it. Our process still has the stale IN_PROGRESS snapshot.
	require.NoError(t, model.DB.Model(&model.Task{}).Where("id = ?", task.ID).
		Update("status", model.TaskStatusSuccess).Error)

	simulatePollBilling(ctx, task, model.TaskStatus(model.TaskStatusSuccess), actualQuota)

	// CAS lost: must NOT re-settle.
	assert.Equal(t, initQuota, getUserQuota(t, userID), "wallet should not move on CAS-lose")
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID), "token remain_quota should not move on CAS-lose")

	// tasks.quota in DB stays at preConsumed (we did not run the settle UPDATE).
	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.Equal(t, preConsumed, reloaded.Quota, "tasks.quota should be untouched on CAS-lose")

	// No billing log written by us.
	assert.Equal(t, int64(0), countLogs(t), "no billing log should be created on CAS-lose")
}

func TestNonTerminalUpdate_NoBilling(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, channelID = 23, 23
	const initQuota, preConsumed = 10000, 3000

	seedUser(t, userID, initQuota)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, 0, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)
	task.Progress = "20%"

	// Simulate a non-terminal poll update (still IN_PROGRESS, progress changed)
	simulatePollBilling(ctx, task, model.TaskStatus(model.TaskStatusInProgress), 0)

	// User quota should NOT change
	assert.Equal(t, initQuota, getUserQuota(t, userID))

	// No billing log
	assert.Equal(t, int64(0), countLogs(t))

	// Task progress should be updated in DB
	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.Equal(t, "50%", reloaded.Progress)
}

// ===========================================================================
// Mock adaptor for SettleTaskBillingOnComplete tests
// ===========================================================================

type mockAdaptor struct {
	adjustReturn int
}

func (m *mockAdaptor) Init(_ *relaycommon.RelayInfo) {}
func (m *mockAdaptor) FetchTask(string, string, map[string]any, string) (*http.Response, error) {
	return nil, nil
}
func (m *mockAdaptor) ParseTaskResult([]byte) (*relaycommon.TaskInfo, error) { return nil, nil }
func (m *mockAdaptor) AdjustBillingOnComplete(_ *model.Task, _ *relaycommon.TaskInfo) int {
	return m.adjustReturn
}

// ===========================================================================
// PerCallBilling tests — SettleTaskBillingOnComplete
// ===========================================================================

func TestSettle_PerCallBilling_SkipsAdaptorAdjust(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 30, 30, 30
	const initQuota, preConsumed = 10000, 5000
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-percall-adaptor", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.PerCallBilling = true

	adaptor := &mockAdaptor{adjustReturn: 2000}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	SettleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	// Per-call: no adjustment despite adaptor returning 2000
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, preConsumed, task.Quota)
	assert.Equal(t, int64(0), countLogs(t))
}

func TestSettle_PerCallBilling_SkipsTotalTokens(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 31, 31, 31
	const initQuota, preConsumed = 10000, 4000
	const tokenRemain = 7000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-percall-tokens", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.PerCallBilling = true

	adaptor := &mockAdaptor{adjustReturn: 0}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess, TotalTokens: 9999}

	SettleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	// Per-call: no recalculation by tokens
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, preConsumed, task.Quota)
	assert.Equal(t, int64(0), countLogs(t))
}

// TestEffectiveTokenCount locks down the fallback rule used by
// SettleTaskBillingOnComplete's token branch. Volc Ark callbacks for video
// tasks routinely deliver completion_tokens with total_tokens=0, and without
// this fallback the settle would skip the recalc path and silently keep the
// pre-consumed quota.
func TestEffectiveTokenCount(t *testing.T) {
	cases := []struct {
		name       string
		total      int
		completion int
		want       int
	}{
		{"prefers TotalTokens when both present", 200, 100, 200},
		{"falls back to CompletionTokens when total is zero", 0, 100, 100},
		{"falls back to CompletionTokens when total is negative", -1, 50, 50},
		{"returns zero when both unset", 0, 0, 0},
		{"returns zero when nil", 0, 0, 0}, // nil case below
	}
	for _, c := range cases[:4] {
		t.Run(c.name, func(t *testing.T) {
			got := effectiveTokenCount(&relaycommon.TaskInfo{TotalTokens: c.total, CompletionTokens: c.completion})
			assert.Equal(t, c.want, got)
		})
	}
	t.Run(cases[4].name, func(t *testing.T) {
		assert.Equal(t, 0, effectiveTokenCount(nil))
	})
}

// TestSettle_NilAdaptor_FallsBackToTokens covers the callback-side init-order
// edge case: when GetTaskAdaptorFunc returns nil the helper should still
// apply the token-count fallback (and PerCallBilling guard) without panicking
// on the nil interface.
func TestSettle_NilAdaptor_FallsBackToTokens(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 34, 34, 34
	const initQuota, preConsumed = 10000, 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-nil-adaptor", 8000)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	// nil adaptor — must not panic; should attempt the token branch.
	taskResult := &relaycommon.TaskInfo{
		Status:           model.TaskStatusSuccess,
		TotalTokens:      0,
		CompletionTokens: 100,
	}
	require.NotPanics(t, func() {
		SettleTaskBillingOnComplete(ctx, nil, task, taskResult)
	})
}

// TestSettle_NilAdaptor_HonoursPerCallSkip covers the PerCallBilling guard
// even when the adaptor is nil — without this the callback's fallback path
// would re-bill per-call tasks via token recalculation.
func TestSettle_NilAdaptor_HonoursPerCallSkip(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 35, 35, 35
	const initQuota, preConsumed = 10000, 5000
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-nil-percall", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.PerCallBilling = true

	taskResult := &relaycommon.TaskInfo{
		Status:           model.TaskStatusSuccess,
		TotalTokens:      9999,
		CompletionTokens: 8888,
	}
	SettleTaskBillingOnComplete(ctx, nil, task, taskResult)

	// PerCall: no recalculation despite tokens being present and adaptor nil.
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, preConsumed, task.Quota)
	assert.Equal(t, int64(0), countLogs(t))
}

// TestRecalculate_ZeroRowsAffected_KeepsInvariant locks down the
// RowsAffected==0 guard: GORM's Updates(...).Error stays nil when the WHERE
// matches zero rows (e.g. task.ID is unset or the row was deleted), so we
// must inspect RowsAffected explicitly. Without this, the wallet/log side
// effects would land against a phantom row, recreating the inconsistency
// the persistence is meant to fix.
func TestRecalculate_ZeroRowsAffected_KeepsInvariant(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 41, 41, 41
	const initQuota, preConsumed = 10000, 5000
	const actualQuota = 1500

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-zero-rows", 8000)
	seedChannel(t, channelID)

	// Build a task whose ID points at a nonexistent row so the targeted
	// UPDATE matches zero rows.
	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.ID = 999999 // not in DB

	logsBefore := countLogs(t)

	RecalculateTaskQuota(ctx, task, actualQuota, "phantom row")

	// In-memory rolled back, wallet/token untouched, no log written.
	assert.Equal(t, preConsumed, task.Quota, "task.Quota should be rolled back when RowsAffected==0")
	assert.Equal(t, initQuota, getUserQuota(t, userID), "wallet should not move when persist matches 0 rows")
	assert.Equal(t, logsBefore, countLogs(t), "no billing log should be written when persist matches 0 rows")
}

func TestRecalculate_FundingFailureRollsBackTaskQuotaAndLog(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID, subID = 42, 42, 42, 42
	const preConsumed = 5000
	const actualQuota = 7000 // delta +2000 would push subscription above total
	const subTotal int64 = 6000
	const subUsed int64 = 5500

	seedUser(t, userID, 0)
	seedToken(t, tokenID, userID, "sk-funding-fail", 8000)
	seedChannel(t, channelID)
	seedSubscription(t, subID, userID, subTotal, subUsed)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceSubscription, subID)
	logsBefore := countLogs(t)

	RecalculateTaskQuota(ctx, task, actualQuota, "subscription over-limit")

	assert.Equal(t, preConsumed, task.Quota, "in-memory quota should stay pre-consumed when funding tx fails")
	assert.Equal(t, subUsed, getSubscriptionUsed(t, subID), "subscription used should roll back")
	assert.Equal(t, logsBefore, countLogs(t), "no billing log should be written when tx rolls back")

	var fetched model.Task
	require.NoError(t, model.DB.First(&fetched, task.ID).Error)
	assert.Equal(t, preConsumed, fetched.Quota, "tasks.quota should roll back with the funding failure")
}

// TestRecalculate_CASGuard_IdempotentSkip verifies that a concurrent settle
// (simulated by pre-changing tasks.quota in the DB to a value other than
// preConsumedQuota) causes settleTaskQuotaInTransaction to return the
// errSettleAlreadyApplied sentinel, which RecalculateTaskQuota treats as an
// idempotent no-op (info-level log, no wallet/log side-effects, in-memory
// task.Quota unchanged).
//
// Scenario: two polling workers read the same in-memory task snapshot with
// quota=preConsumedQuota. Worker A settles first and updates tasks.quota to
// actualQuota. Worker B then attempts settleTaskQuotaInTransaction; its
// WHERE id=? AND quota=preConsumedQuota predicate matches zero rows and the
// sentinel is returned. Worker B must silently skip — not double-settle.
func TestRecalculate_CASGuard_IdempotentSkip(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 50, 50, 50
	const initQuota, preConsumed = 10000, 5000
	const actualQuota = 3000 // what both workers would settle to
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-cas-guard", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	// Simulate Worker A having already settled: change tasks.quota to
	// actualQuota in the DB so the CAS predicate no longer matches.
	require.NoError(t, model.DB.Model(&model.Task{}).
		Where("id = ?", task.ID).
		Update("quota", actualQuota).Error)

	logsBefore := countLogs(t)

	// Worker B still holds the stale in-memory snapshot with quota=preConsumed.
	// RecalculateTaskQuota should detect the CAS miss and abort.
	RecalculateTaskQuota(ctx, task, actualQuota, "duplicate settle attempt")

	// Wallet must not change (Worker A already did it; Worker B was blocked).
	assert.Equal(t, initQuota, getUserQuota(t, userID), "wallet must not change on CAS-guard abort")

	// tasks.quota stays at actualQuota (set by Worker A).
	var fetched model.Task
	require.NoError(t, model.DB.First(&fetched, task.ID).Error)
	assert.Equal(t, actualQuota, fetched.Quota, "tasks.quota should remain at Worker A's settled value")

	// In-memory task.Quota must not be mutated: Worker B's snapshot retains the
	// pre-consumed value because the idempotent skip returns before the
	// task.Quota = actualQuota assignment.
	assert.Equal(t, preConsumed, task.Quota, "in-memory task.Quota must not be updated on CAS-guard idempotent skip")

	// No billing log written by Worker B.
	assert.Equal(t, logsBefore, countLogs(t), "no billing log should be written on CAS-guard abort")
}

// setUserUsedQuota sets users.used_quota directly for test setup.
func setUserUsedQuota(t *testing.T, id int, usedQuota int) {
	t.Helper()
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", id).Update("used_quota", usedQuota).Error)
}

// setChannelUsedQuota sets channels.used_quota directly for test setup.
func setChannelUsedQuota(t *testing.T, id int, usedQuota int64) {
	t.Helper()
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", id).Update("used_quota", usedQuota).Error)
}

// TestRecalculate_NegativeDelta_UpdatesUsedQuota verifies that a settle refund
// (actualQuota < preConsumedQuota) correctly decrements used_quota on both the
// user and the channel, while leaving request_count unchanged.
func TestRecalculate_NegativeDelta_UpdatesUsedQuota(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 60, 60, 60
	const initQuota, preConsumed = 10000, 3000
	const actualQuota = 1000 // over-charged by 2000 → refund delta = -2000
	const tokenRemain = 5000
	const initUsedQuota = 5000

	seedUser(t, userID, initQuota)
	setUserUsedQuota(t, userID, initUsedQuota)
	seedToken(t, tokenID, userID, "sk-neg-used", tokenRemain)
	seedChannel(t, channelID)
	setChannelUsedQuota(t, channelID, int64(initUsedQuota))

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, actualQuota, "refund used_quota")

	// Wallet refunded: quota increases by abs(delta)
	assert.Equal(t, initQuota+(preConsumed-actualQuota), getUserQuota(t, userID))

	// used_quota must decrease by abs(delta) = 2000
	// expected: 5000 + (1000 - 3000) = 3000
	usedQuota, requestCount := getUserUsedQuotaAndRequestCount(t, userID)
	assert.Equal(t, initUsedQuota+(actualQuota-preConsumed), usedQuota,
		"used_quota should decrease on refund settle")
	assert.Equal(t, 0, requestCount,
		"request_count must not change on refund settle")

	// Channel used_quota must also decrease by abs(delta)
	assert.Equal(t, int64(initUsedQuota)+(int64(actualQuota)-int64(preConsumed)), getChannelUsedQuota(t, channelID),
		"channel used_quota should decrease on refund settle")
}

// TestRecalculate_PositiveDelta_DoesNotDoubleCountRequest verifies that the
// settle path does NOT increment request_count even when quotaDelta > 0.
// Async tasks already count the request via LogTaskConsumption →
// UpdateUserUsedQuotaAndRequestCount at submit time; incrementing again during
// settlement would double-count requests in user statistics.
func TestRecalculate_PositiveDelta_DoesNotDoubleCountRequest(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 61, 61, 61
	const initQuota, preConsumed = 10000, 2000
	const actualQuota = 3500 // under-charged by 1500 → positive delta
	const tokenRemain = 5000
	const initUsedQuota = 1000
	const initRequestCount = 5 // pre-existing count from submit time

	seedUser(t, userID, initQuota)
	setUserUsedQuota(t, userID, initUsedQuota)
	// Seed request_count=5 to simulate that LogTaskConsumption already ran at submit.
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userID).
		Update("request_count", initRequestCount).Error)
	seedToken(t, tokenID, userID, "sk-pos-reqcount", tokenRemain)
	seedChannel(t, channelID)
	setChannelUsedQuota(t, channelID, int64(initUsedQuota))

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, actualQuota, "positive delta settle")

	// Wallet debited by delta
	assert.Equal(t, initQuota-(actualQuota-preConsumed), getUserQuota(t, userID))

	// used_quota increases by delta; request_count must remain unchanged at 5.
	usedQuota, requestCount := getUserUsedQuotaAndRequestCount(t, userID)
	assert.Equal(t, initUsedQuota+(actualQuota-preConsumed), usedQuota,
		"used_quota should increase on positive-delta settle")
	assert.Equal(t, initRequestCount, requestCount,
		"request_count must not change during settlement — already counted at submit time")

	// Channel used_quota increases too
	assert.Equal(t, int64(initUsedQuota)+(int64(actualQuota)-int64(preConsumed)), getChannelUsedQuota(t, channelID),
		"channel used_quota should increase on positive-delta settle")
}

func TestSettle_NonPerCall_AdaptorAdjustWorks(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 32, 32, 32
	const initQuota, preConsumed = 10000, 5000
	const adaptorQuota = 3000
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-nonpercall-adj", tokenRemain)
	seedChannel(t, channelID)

	task := seedTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	// PerCallBilling defaults to false

	adaptor := &mockAdaptor{adjustReturn: adaptorQuota}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	SettleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	// Non-per-call: adaptor adjustment applies (refund 2000)
	assert.Equal(t, initQuota+(preConsumed-adaptorQuota), getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+(preConsumed-adaptorQuota), getTokenRemainQuota(t, tokenID))
	assert.Equal(t, adaptorQuota, task.Quota)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}
