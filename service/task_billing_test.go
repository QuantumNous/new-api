package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
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
		&model.UserSubscriptionContract{},
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
		model.DB.Exec("DELETE FROM user_subscription_contracts")
		model.DB.Exec("DELETE FROM user_subscriptions")
	})
}

func seedUser(t *testing.T, id int, quota int) {
	t.Helper()
	user := &model.User{Id: id, Username: "test_user_" + strconv.Itoa(id), Quota: quota, Status: common.UserStatusEnabled, AffCode: "test_aff_" + strconv.Itoa(id)}
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

func restoreRatioSettings(t *testing.T) {
	t.Helper()

	originalModelRatio := ratio_setting.ModelRatio2JSONString()
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	originalGroupGroupRatio := ratio_setting.GroupGroupRatio2JSONString()
	originalGroupModelRatio := ratio_setting.GroupModelRatio2JSONString()

	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalModelRatio))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio))
		require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(originalGroupGroupRatio))
		require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(originalGroupModelRatio))
	})
}

func makeTask(userId, channelId, quota, tokenId int, billingSource string, subscriptionId int) *model.Task {
	return &model.Task{
		TaskID:    "task_" + time.Now().Format("150405.000"),
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

// ---------------------------------------------------------------------------
// Read-back helpers
// ---------------------------------------------------------------------------

func getUserQuota(t *testing.T, id int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("quota").Where("id = ?", id).First(&user).Error)
	return user.Quota
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

func TestLogTaskConsumptionIncludesGroupModelRatioSource(t *testing.T) {
	truncate(t)

	const userID, channelID = 1, 1
	seedUser(t, userID, 10000)
	seedChannel(t, channelID)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", nil)
	ctx.Set("username", "test_user_1")

	LogTaskConsumption(ctx, &relaycommon.RelayInfo{
		UserId:          userID,
		OriginModelName: "gpt-5.5",
		UsingGroup:      "plg",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: channelID,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action: "submit",
		},
		PriceData: types.PriceData{
			ModelPrice: 0.02,
			Quota:      30,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio:           0.3,
				GroupModelRatio:      0.3,
				HasGroupModelRatio:   true,
				GroupModelRatioGroup: "plg",
				GroupModelRatioModel: "gpt-5.5",
			},
		},
	})

	log := getLastLog(t)
	require.NotNil(t, log)

	other := map[string]any{}
	require.NoError(t, common.UnmarshalJsonStr(log.Other, &other))
	require.Equal(t, 0.3, other["group_model_ratio"])
	require.Equal(t, "plg", other["group_model_ratio_group"])
	require.Equal(t, "gpt-5.5", other["group_model_ratio_model"])
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

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

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

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceSubscription, subID)

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

	task := makeTask(userID, 0, 0, 0, BillingSourceWallet, 0)

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

	task := makeTask(userID, channelID, preConsumed, 0, BillingSourceWallet, 0) // TokenId=0

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

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, actualQuota, "adaptor adjustment")

	// User quota should decrease by the delta (1000 additional charge)
	assert.Equal(t, initQuota-(actualQuota-preConsumed), getUserQuota(t, userID))

	// Token should also be charged the delta
	assert.Equal(t, tokenRemain-(actualQuota-preConsumed), getTokenRemainQuota(t, tokenID))

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

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

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

	task := makeTask(userID, 0, preConsumed, 0, BillingSourceWallet, 0)

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

	task := makeTask(userID, 0, 5000, 0, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, 0, "zero actual")

	// No change (early return)
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, int64(0), countLogs(t))
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

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceSubscription, subID)

	RecalculateTaskQuota(ctx, task, actualQuota, "subscription over-charge")

	// Subscription used should decrease by delta (refund 3000)
	assert.Equal(t, subUsed-int64(preConsumed-actualQuota), getSubscriptionUsed(t, subID))

	// Token refunded
	assert.Equal(t, tokenRemain+(preConsumed-actualQuota), getTokenRemainQuota(t, tokenID))

	assert.Equal(t, actualQuota, task.Quota)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

func TestRecalculateTaskQuotaByTokensUsesBillingContextGroupModelRatioSnapshot(t *testing.T) {
	truncate(t)
	restoreRatioSettings(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 15, 15, 15
	const initQuota, preConsumed = 10000, 100
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-recalc-group-model", tokenRemain)
	seedChannel(t, channelID)

	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"test-model":1}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"plg":0.9}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{"plg":{"plg":0.8}}`))
	require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(`{"plg":{"test-model":0.7}}`))

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Group = "plg"
	task.PrivateData.BillingContext.GroupRatio = 0.3
	task.PrivateData.BillingContext.GroupModelRatio = 0.3
	task.PrivateData.BillingContext.GroupModelRatioGroup = "plg"
	task.PrivateData.BillingContext.GroupModelRatioModel = "test-model"

	RecalculateTaskQuotaByTokens(ctx, task, 1000)

	const actualQuota = 300
	assert.Equal(t, actualQuota, task.Quota)
	assert.Equal(t, initQuota-(actualQuota-preConsumed), getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-(actualQuota-preConsumed), getTokenRemainQuota(t, tokenID))

	log := getLastLog(t)
	require.NotNil(t, log)
	require.Equal(t, model.LogTypeConsume, log.Type)
	require.Equal(t, actualQuota-preConsumed, log.Quota)
	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	require.Equal(t, 0.3, other["group_model_ratio"])
	require.Equal(t, "plg", other["group_model_ratio_group"])
	require.Equal(t, "test-model", other["group_model_ratio_model"])
}

func TestRecalculateTaskQuotaByTokensSkipsPerCallBilling(t *testing.T) {
	truncate(t)
	restoreRatioSettings(t)
	originalModelRatio := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalModelRatio))
	})
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"test-model":1}`))

	ctx := context.Background()
	task := &model.Task{
		TaskID:    "task-per-call",
		UserId:    1,
		ChannelId: 2,
		Group:     "plg",
		Quota:     100,
		PrivateData: model.TaskPrivateData{
			TokenId: 3,
			BillingContext: &model.TaskBillingContext{
				GroupRatio:      0.3,
				ModelRatio:      1,
				OriginModelName: "test-model",
				PerCallBilling:  true,
			},
		},
	}

	RecalculateTaskQuotaByTokens(ctx, task, 1000)

	require.Equal(t, 100, task.Quota)
	require.Zero(t, countLogs(t))
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

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)
	require.NoError(t, model.DB.Create(task).Error)

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
	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)
	require.NoError(t, model.DB.Create(task).Error)

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

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)
	require.NoError(t, model.DB.Create(task).Error)

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

func TestNonTerminalUpdate_NoBilling(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, channelID = 23, 23
	const initQuota, preConsumed = 10000, 3000

	seedUser(t, userID, initQuota)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, 0, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)
	task.Progress = "20%"
	require.NoError(t, model.DB.Create(task).Error)

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
// Mock adaptor for settleTaskBillingOnComplete tests
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
// PerCallBilling tests — settleTaskBillingOnComplete
// ===========================================================================

func TestSettle_PerCallBilling_AcceptsAdaptorAdjust(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 30, 30, 30
	const initQuota, preConsumed = 10000, 5000
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-percall-adaptor", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.PerCallBilling = true

	adaptor := &mockAdaptor{adjustReturn: 2000}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	// Per-call billing still accepts a positive adaptor adjustment.
	assert.Equal(t, initQuota+(preConsumed-2000), getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+(preConsumed-2000), getTokenRemainQuota(t, tokenID))
	assert.Equal(t, 2000, task.Quota)
	assert.Equal(t, int64(1), countLogs(t))
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

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.PerCallBilling = true

	adaptor := &mockAdaptor{adjustReturn: 0}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess, TotalTokens: 9999}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	// Per-call: no recalculation by tokens
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, preConsumed, task.Quota)
	assert.Equal(t, int64(0), countLogs(t))
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

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	// PerCallBilling defaults to false

	adaptor := &mockAdaptor{adjustReturn: adaptorQuota}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	// Non-per-call: adaptor adjustment applies (refund 2000)
	assert.Equal(t, initQuota+(preConsumed-adaptorQuota), getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+(preConsumed-adaptorQuota), getTokenRemainQuota(t, tokenID))
	assert.Equal(t, adaptorQuota, task.Quota)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

func TestTaskBillingSettlementCrashRetryAndConcurrentCAS(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TaskBillingSettlement{}))
	originalLogDB := model.LOG_DB
	logDB, err := gorm.Open(sqlite.Open("file:task_billing_settlement?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, logDB.AutoMigrate(&model.Log{}, &model.TaskBillingLogDelivery{}))
	model.LOG_DB = logDB
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM task_billing_settlements")
		model.LOG_DB = originalLogDB
		if sqlDB, dbErr := logDB.DB(); dbErr == nil {
			_ = sqlDB.Close()
		}
	})

	ctx := context.Background()
	const userID, tokenID, channelID = 40, 40, 40
	const initialUserQuota, initialTokenQuota = 10_000, 8_000
	const reservedQuota, actualQuota = 5_000, 2_000

	seedUser(t, userID, initialUserQuota)
	const tokenKey = "sk-settlement-retry"
	seedToken(t, tokenID, userID, tokenKey, initialTokenQuota)
	seedChannel(t, channelID)
	mr := setupWindowTestRedis(t)
	userCacheKey := "user:v2:" + strconv.Itoa(userID)
	tokenCacheKey := "token:" + common.GenerateHMAC(tokenKey)
	mr.HSet(userCacheKey, "Quota", strconv.Itoa(initialUserQuota))
	mr.HSet(tokenCacheKey, "RemainQuota", strconv.Itoa(initialTokenQuota))
	task := makeTask(userID, channelID, reservedQuota, tokenID, BillingSourceWallet, 0)
	require.NoError(t, model.DB.Create(task).Error)

	first := *task
	second := *task
	first.Status = model.TaskStatusSuccess
	second.Status = model.TaskStatusSuccess
	first.Progress = "100%"
	second.Progress = "100%"

	type transitionResult struct {
		won          bool
		settlementID int64
		err          error
	}
	results := make(chan transitionResult, 2)
	var wg sync.WaitGroup
	for _, candidate := range []*model.Task{&first, &second} {
		wg.Add(1)
		go func(candidate *model.Task) {
			defer wg.Done()
			won, settlementID, err := candidate.TransitionWithBilling(
				model.TaskStatusInProgress,
				taskBillingTransition(candidate, actualQuota, "test settle"),
			)
			results <- transitionResult{won: won, settlementID: settlementID, err: err}
		}(candidate)
	}
	wg.Wait()
	close(results)

	wins := 0
	var settlementID int64
	for result := range results {
		require.NoError(t, result.err)
		if result.won {
			wins++
			settlementID = result.settlementID
		}
	}
	require.Equal(t, 1, wins)
	require.Positive(t, settlementID)

	// Simulate a process crash immediately after the main-DB transaction:
	// terminal status and all main quota effects committed, targets did not.
	assert.Equal(t, initialUserQuota+(reservedQuota-actualQuota), getUserQuota(t, userID))
	assert.Equal(t, initialTokenQuota+(reservedQuota-actualQuota), getTokenRemainQuota(t, tokenID))
	assert.Equal(t, int64(0), countLogs(t))
	var storedTask model.Task
	require.NoError(t, model.DB.First(&storedTask, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusSuccess, storedTask.Status)
	assert.Equal(t, actualQuota, storedTask.Quota)

	// LOG_DB committed, but main-DB acknowledgement was lost before recovery.
	require.NoError(t, model.DeliverTaskBillingSettlementLog(settlementID))
	require.NoError(t, model.DB.Model(&model.TaskBillingSettlement{}).
		Where("id = ?", settlementID).Update("log_delivered", false).Error)
	recoverPendingTaskBillingSettlements(ctx, 10)
	recoverPendingTaskBillingSettlements(ctx, 10)
	assert.Equal(t, initialUserQuota+(reservedQuota-actualQuota), getUserQuota(t, userID))
	assert.Equal(t, initialTokenQuota+(reservedQuota-actualQuota), getTokenRemainQuota(t, tokenID))
	assert.Equal(t, int64(1), countLogs(t))
	if mr.Exists(userCacheKey) {
		assert.Equal(t, strconv.Itoa(initialUserQuota+(reservedQuota-actualQuota)), mr.HGet(userCacheKey, "Quota"))
	}
	if mr.Exists(tokenCacheKey) {
		assert.Equal(t, strconv.Itoa(initialTokenQuota+(reservedQuota-actualQuota)), mr.HGet(tokenCacheKey, "RemainQuota"))
	}
	var settlementCount int64
	require.NoError(t, model.DB.Model(&model.TaskBillingSettlement{}).Where("id = ?", settlementID).Count(&settlementCount).Error)
	assert.Equal(t, int64(1), settlementCount)
	var deliveryCount int64
	require.NoError(t, model.LOG_DB.Model(&model.TaskBillingLogDelivery{}).
		Where("settlement_id = ?", settlementID).Count(&deliveryCount).Error)
	assert.Equal(t, int64(1), deliveryCount)

	require.NoError(t, model.DB.Model(&model.TaskBillingSettlement{}).Where("id = ?", settlementID).
		Update("updated_at", common.GetTimestamp()-model.TaskBillingSettlementCleanupDelaySeconds-1).Error)
	recoverPendingTaskBillingSettlements(ctx, 10)
	require.NoError(t, model.DB.Model(&model.TaskBillingSettlement{}).Where("id = ?", settlementID).Count(&settlementCount).Error)
	assert.Zero(t, settlementCount)
	require.NoError(t, model.LOG_DB.Model(&model.TaskBillingLogDelivery{}).
		Where("settlement_id = ?", settlementID).Count(&deliveryCount).Error)
	assert.Zero(t, deliveryCount)
}

func TestTaskBillingSettlementPositiveDeltaSharedLogDBIsIdempotent(t *testing.T) {
	truncate(t)
	require.Same(t, model.DB, model.LOG_DB)
	require.NoError(t, model.DB.AutoMigrate(&model.TaskBillingSettlement{}, &model.TaskBillingLogDelivery{}))
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM task_billing_settlements")
		model.DB.Exec("DELETE FROM task_billing_log_deliveries")
	})

	const userID, tokenID, channelID = 41, 41, 41
	const initialQuota, reservedQuota, actualQuota = 10_000, 2_000, 5_000
	seedUser(t, userID, initialQuota)
	seedToken(t, tokenID, userID, "sk-settlement-positive", initialQuota)
	seedChannel(t, channelID)
	task := makeTask(userID, channelID, reservedQuota, tokenID, BillingSourceWallet, 0)
	require.NoError(t, model.DB.Create(task).Error)

	first := *task
	first.Status = model.TaskStatusSuccess
	won, settlementID, err := first.TransitionWithBilling(
		model.TaskStatusInProgress,
		taskBillingTransition(&first, actualQuota, "positive settle"),
	)
	require.NoError(t, err)
	require.True(t, won)
	require.Positive(t, settlementID)

	second := *task
	second.Status = model.TaskStatusSuccess
	won, _, err = second.TransitionWithBilling(
		model.TaskStatusInProgress,
		taskBillingTransition(&second, actualQuota, "positive settle"),
	)
	require.NoError(t, err)
	assert.False(t, won)

	assert.Equal(t, initialQuota-(actualQuota-reservedQuota), getUserQuota(t, userID))
	assert.Equal(t, initialQuota-(actualQuota-reservedQuota), getTokenRemainQuota(t, tokenID))
	var token model.Token
	require.NoError(t, model.DB.Select("accessed_time").First(&token, tokenID).Error)
	assert.Positive(t, token.AccessedTime)
	var user model.User
	require.NoError(t, model.DB.Select("used_quota", "request_count").First(&user, userID).Error)
	assert.Equal(t, actualQuota-reservedQuota, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	var channel model.Channel
	require.NoError(t, model.DB.Select("used_quota").First(&channel, channelID).Error)
	assert.Equal(t, int64(actualQuota-reservedQuota), channel.UsedQuota)

	deliverTaskBillingSettlement(context.Background(), settlementID)
	deliverTaskBillingSettlement(context.Background(), settlementID)
	assert.Equal(t, int64(1), countLogs(t))
	var deliveryCount int64
	require.NoError(t, model.DB.Model(&model.TaskBillingLogDelivery{}).Count(&deliveryCount).Error)
	assert.Equal(t, int64(1), deliveryCount)
	var settlementCount int64
	require.NoError(t, model.DB.Model(&model.TaskBillingSettlement{}).Count(&settlementCount).Error)
	assert.Equal(t, int64(1), settlementCount)
	require.NoError(t, model.DB.Model(&model.TaskBillingSettlement{}).Where("id = ?", settlementID).
		Update("updated_at", common.GetTimestamp()-model.TaskBillingSettlementCleanupDelaySeconds-1).Error)
	recoverPendingTaskBillingSettlements(context.Background(), 10)
	require.NoError(t, model.DB.Model(&model.TaskBillingLogDelivery{}).Count(&deliveryCount).Error)
	assert.Zero(t, deliveryCount)
	require.NoError(t, model.DB.Model(&model.TaskBillingSettlement{}).Count(&settlementCount).Error)
	assert.Zero(t, settlementCount)
}

func TestTaskBillingSubscriptionWindowCrashRetryIsIdempotent(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TaskBillingSettlement{}, &model.TaskBillingLogDelivery{}))
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM task_billing_settlements")
		model.DB.Exec("DELETE FROM task_billing_log_deliveries")
	})

	const userID, channelID, subscriptionID = 42, 42, 42
	seedUser(t, userID, 10_000)
	seedChannel(t, channelID)
	seedSubscription(t, subscriptionID, userID, 10_000, 5_000)
	mr := setupWindowTestRedis(t)
	const bucketKey = "sub:win:5h:42:1000"
	const weekKey = "sub:win:w:42:0"
	mr.Set(bucketKey, "5000")
	mr.Set(weekKey, "5000")

	task := makeTask(userID, channelID, 5_000, 0, BillingSourceSubscription, subscriptionID)
	task.PrivateData.BillingContext.SubscriptionWindow = &model.TaskSubscriptionWindow{
		SubId:      subscriptionID,
		SubStart:   1,
		Limit5h:    10_000,
		LimitWeek:  10_000,
		BucketHeld: map[string]int64{bucketKey: 5_000},
		WeekHeld:   map[string]int64{weekKey: 5_000},
	}
	require.NoError(t, model.DB.Create(task).Error)
	task.Status = model.TaskStatusSuccess
	won, settlementID, err := task.TransitionWithBilling(
		model.TaskStatusInProgress,
		taskBillingTransition(task, 2_000, "subscription settle"),
	)
	require.NoError(t, err)
	require.True(t, won)
	require.Positive(t, settlementID)
	assert.Equal(t, int64(2_000), getSubscriptionUsed(t, subscriptionID))

	// Redis script committed, but the process crashed before main-DB ack.
	var settlement model.TaskBillingSettlement
	require.NoError(t, model.DB.First(&settlement, settlementID).Error)
	require.Equal(t, int64(-3_000), settlement.WindowDelta)
	require.NoError(t, ApplyTaskSettlementSubscriptionWindow(
		settlementID,
		task.PrivateData.BillingContext.SubscriptionWindow,
		settlement.WindowDelta,
	))
	bucketValue, err := mr.Get(bucketKey)
	require.NoError(t, err)
	weekValue, err := mr.Get(weekKey)
	require.NoError(t, err)
	assert.Equal(t, "2000", bucketValue)
	assert.Equal(t, "2000", weekValue)

	var wg sync.WaitGroup
	deliveryResults := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			deliveryResults <- deliverTaskBillingSettlementWindow(settlementID)
		}()
	}
	wg.Wait()
	close(deliveryResults)
	for deliveryErr := range deliveryResults {
		require.NoError(t, deliveryErr)
	}
	require.NoError(t, deliverTaskBillingSettlementWindow(settlementID))
	bucketValue, err = mr.Get(bucketKey)
	require.NoError(t, err)
	weekValue, err = mr.Get(weekKey)
	require.NoError(t, err)
	assert.Equal(t, "2000", bucketValue)
	assert.Equal(t, "2000", weekValue)
	assert.True(t, mr.Exists("task:settlement:window:"+strconv.FormatInt(settlementID, 10)))
	require.NoError(t, model.DB.First(&settlement, settlementID).Error)
	assert.True(t, settlement.WindowDelivered)

	// Fresh completed settlements retain both DB records for 24 hours, while a
	// stale reader is still fenced by the longer-lived Redis marker.
	require.NoError(t, model.SyncTaskBillingSettlementCache(settlementID))
	require.NoError(t, model.DeliverTaskBillingSettlementLog(settlementID))
	require.NoError(t, cleanupTaskBillingSettlement(settlementID))
	markerKey := "task:settlement:window:" + strconv.FormatInt(settlementID, 10)
	assert.True(t, mr.Exists(markerKey))
	markerTTL := mr.TTL(markerKey)
	assert.Greater(t, markerTTL, 6*24*time.Hour)
	assert.LessOrEqual(t, markerTTL, 7*24*time.Hour)
	var settlementCount int64
	require.NoError(t, model.DB.Model(&model.TaskBillingSettlement{}).
		Where("id = ?", settlementID).Count(&settlementCount).Error)
	assert.Equal(t, int64(1), settlementCount)
	var deliveryCount int64
	require.NoError(t, model.LOG_DB.Model(&model.TaskBillingLogDelivery{}).
		Where("settlement_id = ?", settlementID).Count(&deliveryCount).Error)
	assert.Equal(t, int64(1), deliveryCount)

	// A stale worker replays before the cleanup horizon: marker blocks it.
	require.NoError(t, ApplyTaskSettlementSubscriptionWindow(
		settlementID,
		task.PrivateData.BillingContext.SubscriptionWindow,
		settlement.WindowDelta,
	))
	bucketValue, err = mr.Get(bucketKey)
	require.NoError(t, err)
	weekValue, err = mr.Get(weekKey)
	require.NoError(t, err)
	assert.Equal(t, "2000", bucketValue)
	assert.Equal(t, "2000", weekValue)

	require.NoError(t, model.DB.Model(&model.TaskBillingSettlement{}).Where("id = ?", settlementID).
		Update("updated_at", common.GetTimestamp()-model.TaskBillingSettlementCleanupDelaySeconds-1).Error)
	recoverPendingTaskBillingSettlements(context.Background(), 10)
	recoverPendingTaskBillingSettlements(context.Background(), 10)
	require.NoError(t, model.DB.Model(&model.TaskBillingSettlement{}).
		Where("id = ?", settlementID).Count(&settlementCount).Error)
	assert.Zero(t, settlementCount)
	require.NoError(t, model.LOG_DB.Model(&model.TaskBillingLogDelivery{}).
		Where("settlement_id = ?", settlementID).Count(&deliveryCount).Error)
	assert.Zero(t, deliveryCount)
	assert.True(t, mr.Exists(markerKey))
	assert.Positive(t, mr.TTL(markerKey))
	assert.Equal(t, int64(1), countLogs(t))
}

func TestTaskBillingSubscriptionConcurrentTasksUseAtomicDelta(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TaskBillingSettlement{}, &model.TaskBillingLogDelivery{}))
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM task_billing_settlements")
		model.DB.Exec("DELETE FROM task_billing_log_deliveries")
	})

	const userID, channelID, subscriptionID = 43, 43, 43
	seedUser(t, userID, 10_000)
	seedChannel(t, channelID)
	seedSubscription(t, subscriptionID, userID, 10_000, 1_000)
	tasks := make([]*model.Task, 0, 2)
	for i := 0; i < 2; i++ {
		task := makeTask(userID, channelID, 1_000, 0, BillingSourceSubscription, subscriptionID)
		task.TaskID += "_" + strconv.Itoa(i)
		require.NoError(t, model.DB.Create(task).Error)
		task.Status = model.TaskStatusSuccess
		tasks = append(tasks, task)
	}

	results := make(chan error, len(tasks))
	var wg sync.WaitGroup
	for _, task := range tasks {
		wg.Add(1)
		go func(task *model.Task) {
			defer wg.Done()
			won, _, err := task.TransitionWithBilling(
				model.TaskStatusInProgress,
				taskBillingTransition(task, 1_300, "concurrent subscription settle"),
			)
			if err == nil && !won {
				err = errors.New("subscription settlement CAS unexpectedly lost")
			}
			results <- err
		}(task)
	}
	wg.Wait()
	close(results)
	for err := range results {
		require.NoError(t, err)
	}
	assert.Equal(t, int64(1_600), getSubscriptionUsed(t, subscriptionID))
}
