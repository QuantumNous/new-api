package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
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
		&model.TaskAcceptedAccountingLedger{},
		&model.TaskAcceptedAccountingLogLedger{},
		&model.User{},
		&model.Token{},
		&model.Log{},
		&model.Channel{},
		&model.TopUp{},
		&model.SubscriptionPlan{},
		&model.UserSubscription{},
		&model.UserSubscriptionContract{},
		&model.SubscriptionPreConsumeRecord{},
		&model.RecallLifecycleEvent{},
		&model.QuotaLifecycleState{},
	); err != nil {
		panic("failed to migrate: " + err.Error())
	}

	os.Exit(m.Run())
}

func TestAcceptedTaskSubscriptionFundingConcurrentDeltasDoNotLoseUpdate(t *testing.T) {
	oldDB := model.DB
	oldLogDB := model.LOG_DB
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.Task{}, &model.TaskAcceptedAccountingLedger{}, &model.User{}, &model.UserSubscription{}, &model.RecallLifecycleEvent{}, &model.QuotaLifecycleState{}))
	model.DB = db
	model.LOG_DB = db
	defer func() {
		model.DB = oldDB
		model.LOG_DB = oldLogDB
		_ = sqlDB.Close()
	}()

	require.NoError(t, model.DB.Create(&model.User{
		Id:       7,
		Username: "accepted_subscription_concurrent",
		Status:   common.UserStatusEnabled,
		AffCode:  "accepted_subscription_concurrent",
	}).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		Id:          7001,
		UserId:      7,
		AmountTotal: 100000,
		AmountUsed:  200,
		Status:      "active",
		StartTime:   1,
		EndTime:     time.Now().Add(time.Hour).Unix(),
	}).Error)
	tasks := []*model.Task{
		acceptedSubscriptionFundingTask("task_sub_concurrent_a", 7001, 100, 200),
		acceptedSubscriptionFundingTask("task_sub_concurrent_b", 7001, 100, 200),
	}
	require.NoError(t, model.DB.Create(tasks).Error)

	var wg sync.WaitGroup
	errs := make(chan error, len(tasks))
	for _, task := range tasks {
		task := task
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- SettleAcceptedTaskFundingOnce(context.Background(), task, task.AcceptedAccountingActualQuota)
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	var sub model.UserSubscription
	require.NoError(t, model.DB.Select("amount_used").Where("id = ?", 7001).First(&sub).Error)
	require.EqualValues(t, 400, sub.AmountUsed)
}

func acceptedSubscriptionFundingTask(taskID string, subID int, reserved int, actual int) *model.Task {
	return &model.Task{
		TaskID:                          taskID,
		UserId:                          7,
		Group:                           "default",
		Quota:                           reserved,
		Status:                          model.TaskStatusSubmitted,
		AcceptedAccountingStatus:        model.TaskAcceptedAccountingProcessing,
		AcceptedAccountingReservedQuota: reserved,
		AcceptedAccountingActualQuota:   actual,
		PrivateData: model.TaskPrivateData{
			BillingSource:  BillingSourceSubscription,
			SubscriptionId: subID,
			BillingContext: &model.TaskBillingContext{SubscriptionWeight: 1},
		},
		Properties: model.Properties{OriginModelName: "seedance-2.0"},
	}
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

func truncate(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM tasks")
		model.DB.Exec("DELETE FROM task_accepted_accounting_ledgers")
		model.DB.Exec("DELETE FROM task_accepted_accounting_log_ledgers")
		model.DB.Exec("DELETE FROM users")
		model.DB.Exec("DELETE FROM tokens")
		model.DB.Exec("DELETE FROM logs")
		model.DB.Exec("DELETE FROM channels")
		model.DB.Exec("DELETE FROM top_ups")
		model.DB.Exec("DELETE FROM user_subscription_contracts")
		model.DB.Exec("DELETE FROM user_subscriptions")
		model.DB.Exec("DELETE FROM subscription_pre_consume_records")
		model.DB.Exec("DELETE FROM recall_lifecycle_events")
		model.DB.Exec("DELETE FROM quota_lifecycle_states")
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
	plan := &model.SubscriptionPlan{
		Title:         "test plan " + strconv.Itoa(id),
		DurationValue: 1,
		DurationUnit:  model.SubscriptionDurationMonth,
		TotalAmount:   amountTotal,
		Enabled:       true,
	}
	require.NoError(t, model.DB.Create(plan).Error)
	sub := &model.UserSubscription{
		Id:          id,
		UserId:      userId,
		PlanId:      plan.Id,
		AmountTotal: amountTotal,
		AmountUsed:  amountUsed,
		Status:      "active",
		StartTime:   time.Now().Unix(),
		EndTime:     time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	require.NoError(t, model.DB.Create(sub).Error)
}

func useTaskBillingRedisForTest(t *testing.T) func() {
	t.Helper()
	mr := miniredis.RunT(t)
	oldRDB := common.RDB
	oldRedisEnabled := common.RedisEnabled
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	return func() {
		_ = common.RDB.Close()
		common.RDB = oldRDB
		common.RedisEnabled = oldRedisEnabled
		mr.Close()
	}
}

func seedChannel(t *testing.T, id int) {
	t.Helper()
	ch := &model.Channel{Id: id, Name: "test_channel", Key: "sk-test", Status: common.ChannelStatusEnabled}
	require.NoError(t, model.DB.Create(ch).Error)
}

func restoreRatioSettings(t *testing.T) {
	t.Helper()

	originalModelPrice := ratio_setting.ModelPrice2JSONString()
	originalModelRatio := ratio_setting.ModelRatio2JSONString()
	originalCompletionRatio := ratio_setting.CompletionRatio2JSONString()
	originalCacheRatio := ratio_setting.CacheRatio2JSONString()
	originalCreateCacheRatio := ratio_setting.CreateCacheRatio2JSONString()
	originalImageRatio := ratio_setting.ImageRatio2JSONString()
	originalAudioRatio := ratio_setting.AudioRatio2JSONString()
	originalAudioCompletionRatio := ratio_setting.AudioCompletionRatio2JSONString()
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	originalGroupGroupRatio := ratio_setting.GroupGroupRatio2JSONString()
	originalGroupModelRatio := ratio_setting.GroupModelRatio2JSONString()

	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(originalModelPrice))
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalModelRatio))
		require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(originalCompletionRatio))
		require.NoError(t, ratio_setting.UpdateCacheRatioByJSONString(originalCacheRatio))
		require.NoError(t, ratio_setting.UpdateCreateCacheRatioByJSONString(originalCreateCacheRatio))
		require.NoError(t, ratio_setting.UpdateImageRatioByJSONString(originalImageRatio))
		require.NoError(t, ratio_setting.UpdateAudioRatioByJSONString(originalAudioRatio))
		require.NoError(t, ratio_setting.UpdateAudioCompletionRatioByJSONString(originalAudioCompletionRatio))
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

func countAcceptedAccountingLedgers(t *testing.T, taskID string, step string) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.TaskAcceptedAccountingLedger{}).Where("task_id = ? AND step = ?", taskID, step).Count(&count).Error)
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
	for _, tc := range []struct {
		name     string
		platform constant.TaskPlatform
	}{
		{name: "task_video", platform: constant.TaskPlatformSuno},
		{name: "midjourney", platform: constant.TaskPlatformMidjourney},
	} {
		t.Run(tc.name, func(t *testing.T) {
			truncate(t)
			ctx := context.Background()

			const initQuota, preConsumed = 10000, 3000
			const tokenRemain = 5000
			userID := 100 + len(tc.name)
			tokenID := 200 + len(tc.name)
			channelID := 300 + len(tc.name)

			seedUser(t, userID, initQuota)
			seedToken(t, tokenID, userID, "sk-test-key-"+tc.name, tokenRemain)
			seedChannel(t, channelID)

			task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
			task.Platform = tc.platform

			RefundTaskQuota(ctx, task, "task failed: upstream error")

			assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID))
			requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), initQuota+preConsumed)
			assert.Equal(t, int64(0), countLifecycleEventsForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID)))

			assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID))
			assert.Equal(t, -preConsumed, getTokenUsedQuota(t, tokenID))

			log := getLastLog(t)
			require.NotNil(t, log)
			assert.Equal(t, model.LogTypeRefund, log.Type)
			assert.Equal(t, preConsumed, log.Quota)
			assert.Equal(t, "test-model", log.ModelName)
		})
	}
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

func TestRefundTaskSubscriptionWindowSnapshotLeavesRedisCounters(t *testing.T) {
	truncate(t)
	restoreRedis := useTaskBillingRedisForTest(t)
	defer restoreRedis()
	ctx := context.Background()

	const userID, tokenID, channelID, subID = 22, 22, 22, 22
	const preConsumed = 100
	const subTotal, subUsed int64 = 100000, 500
	const tokenRemain = 8000
	const bucketKey = "sub:win:5h:22:0"
	const weekKey = "sub:win:w:22:0"

	seedUser(t, userID, 0)
	seedToken(t, tokenID, userID, "sk-sub-window-refund", tokenRemain)
	seedChannel(t, channelID)
	seedSubscription(t, subID, userID, subTotal, subUsed)
	require.NoError(t, common.RDB.Set(ctx, bucketKey, 150, 0).Err())
	require.NoError(t, common.RDB.Set(ctx, weekKey, 150, 0).Err())

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceSubscription, subID)
	task.TaskID = "task_subscription_window_refund"
	task.PrivateData.BillingContext.SubscriptionWeight = 1.5
	task.PrivateData.BillingContext.SubscriptionWindow = &model.TaskSubscriptionWindow{
		SubId:      subID,
		SubStart:   0,
		Limit5h:    1000,
		LimitWeek:  1000,
		BucketHeld: map[string]int64{bucketKey: 150},
		WeekHeld:   map[string]int64{weekKey: 150},
	}

	RefundTaskQuota(ctx, task, "subscription task failed")

	require.Equal(t, subUsed-150, getSubscriptionUsed(t, subID), "refund must still settle the weighted monthly subscription pool")
	bucketValue, err := common.RDB.Get(ctx, bucketKey).Int64()
	require.NoError(t, err)
	weekValue, err := common.RDB.Get(ctx, weekKey).Int64()
	require.NoError(t, err)
	require.EqualValues(t, 150, bucketValue, "legacy 5h window counter must not be changed by async refund")
	require.EqualValues(t, 150, weekValue, "legacy weekly window counter must not be changed by async refund")
}

func TestAcceptedTaskSubscriptionWindowStepOnlyMarksCompatibilityLedger(t *testing.T) {
	truncate(t)
	restoreRedis := useTaskBillingRedisForTest(t)
	defer restoreRedis()
	ctx := context.Background()

	const userID, tokenID, channelID, subID = 23, 23, 23, 23
	now := common.GetTimestamp()
	subStart := now - 3600
	bucketKey := subscriptionWindowBucketKey(subID, now/subscriptionWindowBucketSeconds*subscriptionWindowBucketSeconds)
	weekKey := subscriptionWindowWeekKey(subID, subscriptionWindowWeekIndex(subStart, now))

	seedUser(t, userID, 0)
	seedToken(t, tokenID, userID, "sk-sub-window-accepted", 8000)
	seedChannel(t, channelID)
	seedSubscription(t, subID, userID, 100000, 500)
	require.NoError(t, common.RDB.Set(ctx, bucketKey, 150, 0).Err())
	require.NoError(t, common.RDB.Set(ctx, weekKey, 150, 0).Err())

	task := makeTask(userID, channelID, 100, tokenID, BillingSourceSubscription, subID)
	task.TaskID = "task_subscription_window_accepted"
	task.AcceptedAccountingReservedQuota = 100
	task.AcceptedAccountingActualQuota = 200
	task.PrivateData.BillingContext.SubscriptionWeight = 1.5
	task.PrivateData.BillingContext.SubscriptionWindow = &model.TaskSubscriptionWindow{
		SubId:      subID,
		SubStart:   subStart,
		Limit5h:    1000,
		LimitWeek:  1000,
		BucketHeld: map[string]int64{bucketKey: 150},
		WeekHeld:   map[string]int64{weekKey: 150},
	}

	require.NoError(t, ApplyAcceptedTaskSubscriptionWindowOnce(ctx, task))

	require.EqualValues(t, 1, countAcceptedAccountingLedgers(t, task.TaskID, model.TaskAcceptedAccountingStepSubscriptionWindow))
	bucketValue, err := common.RDB.Get(ctx, bucketKey).Int64()
	require.NoError(t, err)
	weekValue, err := common.RDB.Get(ctx, weekKey).Int64()
	require.NoError(t, err)
	require.EqualValues(t, 150, bucketValue, "legacy 5h window counter must not be changed by accepted accounting")
	require.EqualValues(t, 150, weekValue, "legacy weekly window counter must not be changed by accepted accounting")
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

func TestPreparationFailureRefundsOnce(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 40, 40, 40
	const initQuota, preConsumed = 10000, 1500
	const leaseExpiresAt int64 = 4102444800

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-preparation-refund", 2500)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.TaskID = "task_preparation_refund_once"
	task.Status = model.TaskStatusQueued
	task.PreparationStatus = model.TaskPreparationStatusPreparing
	task.PreparationLeaseOwner = "worker-a"
	task.PreparationLeaseExpiresAt = leaseExpiresAt
	require.NoError(t, model.DB.Create(task).Error)

	won, err := model.MarkQueuedTaskFailed(task.TaskID, "worker-a", leaseExpiresAt, "materialize failed", time.Now().Unix())
	require.NoError(t, err)
	require.True(t, won)
	if won {
		RefundTaskQuota(ctx, task, "materialize failed")
	}

	lateWon, err := model.MarkQueuedTaskFailed(task.TaskID, "worker-b", leaseExpiresAt, "late failure", time.Now().Unix())
	require.NoError(t, err)
	require.False(t, lateWon)
	if lateWon {
		RefundTaskQuota(ctx, task, "late failure")
	}

	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID))
	assert.Equal(t, int64(1), countLogs(t))
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
	requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), initQuota+preConsumed)
	assert.Equal(t, int64(0), countLifecycleEventsForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID)))
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

type perCallAdjustingMockAdaptor struct {
	*mockAdaptor
}

func (m *perCallAdjustingMockAdaptor) AdjustPerCallBillingOnComplete(_ *model.Task, _ *relaycommon.TaskInfo) int {
	return m.adjustReturn
}

// ===========================================================================
// PerCallBilling tests — settleTaskBillingOnComplete
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

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.PerCallBilling = true

	adaptor := &mockAdaptor{adjustReturn: 2000}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	// Per-call adaptors must explicitly opt in to completion adjustment.
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, preConsumed, task.Quota)
	assert.Equal(t, int64(0), countLogs(t))
}

func TestSettle_PerCallBilling_OptInAdaptorAdjusts(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 33, 33, 33
	const initQuota, preConsumed, actualQuota = 10000, 5000, 2000
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-percall-opt-in", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.PerCallBilling = true
	adaptor := &perCallAdjustingMockAdaptor{mockAdaptor: &mockAdaptor{adjustReturn: actualQuota}}

	settleTaskBillingOnComplete(ctx, adaptor, task, &relaycommon.TaskInfo{Status: model.TaskStatusSuccess})

	assert.Equal(t, initQuota+(preConsumed-actualQuota), getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+(preConsumed-actualQuota), getTokenRemainQuota(t, tokenID))
	assert.Equal(t, actualQuota, task.Quota)
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

func TestSettle_NonPerCallSeedance_UsesTotalTokensAndScenarioRatio(t *testing.T) {
	truncate(t)
	restoreRatioSettings(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 33, 33, 33
	const initQuota, preConsumed = 10000, 100
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-seedance-token-settle", tokenRemain)
	seedChannel(t, channelID)

	ratio_setting.InitRatioSettings()
	modelRatio, ok, _ := ratio_setting.GetModelRatio("seedance-2.0")
	require.True(t, ok, "seedance-2.0 default model ratio must be registered")
	require.Equal(t, 3.5, modelRatio)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Properties.OriginModelName = "seedance-2.0"
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		ModelPrice:      -1,
		ModelRatio:      modelRatio,
		GroupRatio:      1,
		OtherRatios:     map[string]float64{"video_input": 43.0 / 70.0},
		OriginModelName: "seedance-2.0",
		PerCallBilling:  false,
	}

	adaptor := &mockAdaptor{adjustReturn: 0}
	taskResult := &relaycommon.TaskInfo{
		Status:      model.TaskStatusSuccess,
		TotalTokens: 1000,
	}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	const actualQuota = 2150
	const quotaDelta = actualQuota - preConsumed
	assert.Equal(t, actualQuota, task.Quota)
	assert.Equal(t, initQuota-quotaDelta, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-quotaDelta, getTokenRemainQuota(t, tokenID))

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeConsume, log.Type)
	assert.Equal(t, quotaDelta, log.Quota)
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
