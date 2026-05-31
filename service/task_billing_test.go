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
		&model.QuotaData{},
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
		model.DB.Exec("DELETE FROM quota_data")
		// 把内存里残留的 cache 也清掉，避免上一用例的统计污染下一用例
		model.CacheQuotaDataLock.Lock()
		model.CacheQuotaData = make(map[string]*model.QuotaData)
		model.CacheQuotaDataLock.Unlock()
	})
}

func seedUser(t *testing.T, id int, quota int) {
	t.Helper()
	user := &model.User{Id: id, Username: "test_user", Quota: quota, Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(user).Error)
}

// seedUserWithUsed 同 seedUser，但允许设置 used_quota / request_count 初值，
// 用于验证退款/补扣时 used_quota 守恒、request_count 不被污染。
func seedUserWithUsed(t *testing.T, id int, quota int, used int, requestCount int) {
	t.Helper()
	user := &model.User{
		Id:           id,
		Username:     "test_user",
		Quota:        quota,
		UsedQuota:    used,
		RequestCount: requestCount,
		Status:       common.UserStatusEnabled,
	}
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

// seedChannelWithUsed 在创建渠道的同时写入 used_quota，用于验证渠道用量统计同步守恒。
func seedChannelWithUsed(t *testing.T, id int, usedQuota int64) {
	t.Helper()
	ch := &model.Channel{
		Id:        id,
		Name:      "test_channel",
		Key:       "sk-test",
		Status:    common.ChannelStatusEnabled,
		UsedQuota: usedQuota,
	}
	require.NoError(t, model.DB.Create(ch).Error)
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

func getUserUsedQuota(t *testing.T, id int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", id).First(&user).Error)
	return user.UsedQuota
}

func getUserRequestCount(t *testing.T, id int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("request_count").Where("id = ?", id).First(&user).Error)
	return user.RequestCount
}

func getChannelUsedQuota(t *testing.T, id int) int64 {
	t.Helper()
	var ch model.Channel
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", id).First(&ch).Error)
	return ch.UsedQuota
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

// ===========================================================================
// RefundTaskQuota tests
// ===========================================================================

func TestRefundTaskQuota_Wallet(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 1, 1, 1
	// 模拟「LogTaskConsumption 已记账后任务失败」的真实状态：
	// - 钱包预扣了 preConsumed → User.Quota=initQuota（已减完）/ UsedQuota=preConsumed
	// - request_count 已 +1
	// - 渠道 used_quota 已 +preConsumed
	const walletAfterPre, preConsumed = 7000, 3000
	const userInitTotal = walletAfterPre + preConsumed // 总额度（守恒目标）
	const tokenRemain = 5000
	const tokenUsedAfterPre = preConsumed
	const requestCountBefore = 1

	seedUserWithUsed(t, userID, walletAfterPre, preConsumed, requestCountBefore)
	seedToken(t, tokenID, userID, "sk-test-key", tokenRemain)
	seedChannelWithUsed(t, channelID, int64(preConsumed))

	// 把 token 的 used_quota 也对齐到 preConsumed（模拟 DecreaseTokenQuota 的副作用）
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", tokenID).Update("used_quota", tokenUsedAfterPre).Error)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RefundTaskQuota(ctx, task, "task failed: upstream error")

	// 用户表：Quota 回退 + UsedQuota 回退 → 总额度守恒
	assert.Equal(t, walletAfterPre+preConsumed, getUserQuota(t, userID))
	assert.Equal(t, 0, getUserUsedQuota(t, userID))
	assert.Equal(t, userInitTotal, getUserQuota(t, userID)+getUserUsedQuota(t, userID))
	// request_count 不应被退款污染
	assert.Equal(t, requestCountBefore, getUserRequestCount(t, userID))

	// 令牌：剩余额度回涨；已用额度回到 0
	assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, 0, getTokenUsedQuota(t, tokenID))

	// 渠道用量：回退到预扣前
	assert.Equal(t, int64(0), getChannelUsedQuota(t, channelID))

	// 退款日志
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
	// 模拟预扣后的真实状态
	const walletAfterPre, preConsumed = 8000, 2000
	const actualQuota = 3000 // under-charged by 1000 (need to charge an extra 1000)
	const userInitTotal = walletAfterPre + preConsumed
	const tokenRemain = 5000
	const requestCountBefore = 1

	seedUserWithUsed(t, userID, walletAfterPre, preConsumed, requestCountBefore)
	seedToken(t, tokenID, userID, "sk-recalc-pos", tokenRemain)
	seedChannelWithUsed(t, channelID, int64(preConsumed))

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, actualQuota, 0, "adaptor adjustment")

	delta := actualQuota - preConsumed

	// 用户表：Quota -delta、UsedQuota +delta，总额度守恒
	assert.Equal(t, walletAfterPre-delta, getUserQuota(t, userID))
	assert.Equal(t, preConsumed+delta, getUserUsedQuota(t, userID))
	assert.Equal(t, userInitTotal, getUserQuota(t, userID)+getUserUsedQuota(t, userID))
	// request_count 不被结算污染
	assert.Equal(t, requestCountBefore, getUserRequestCount(t, userID))

	// 令牌
	assert.Equal(t, tokenRemain-delta, getTokenRemainQuota(t, tokenID))

	// 渠道用量随补扣同向变化
	assert.Equal(t, int64(actualQuota), getChannelUsedQuota(t, channelID))

	// task.Quota 落到 actualQuota
	assert.Equal(t, actualQuota, task.Quota)

	// 日志记 Consume + delta
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeConsume, log.Type)
	assert.Equal(t, delta, log.Quota)
}

func TestRecalculate_NegativeDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 11, 11, 11
	const walletAfterPre, preConsumed = 5000, 5000
	const actualQuota = 3000 // over-charged by 2000
	const userInitTotal = walletAfterPre + preConsumed
	const tokenRemain = 5000
	const requestCountBefore = 1

	seedUserWithUsed(t, userID, walletAfterPre, preConsumed, requestCountBefore)
	seedToken(t, tokenID, userID, "sk-recalc-neg", tokenRemain)
	seedChannelWithUsed(t, channelID, int64(preConsumed))

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, actualQuota, 0, "adaptor adjustment")

	refund := preConsumed - actualQuota

	// 用户表：Quota +refund、UsedQuota -refund，总额度守恒
	assert.Equal(t, walletAfterPre+refund, getUserQuota(t, userID))
	assert.Equal(t, preConsumed-refund, getUserUsedQuota(t, userID))
	assert.Equal(t, userInitTotal, getUserQuota(t, userID)+getUserUsedQuota(t, userID))
	assert.Equal(t, requestCountBefore, getUserRequestCount(t, userID))

	// 令牌：剩余额度增加
	assert.Equal(t, tokenRemain+refund, getTokenRemainQuota(t, tokenID))

	// 渠道用量同步退还
	assert.Equal(t, int64(actualQuota), getChannelUsedQuota(t, channelID))

	// task.Quota 落到 actualQuota
	assert.Equal(t, actualQuota, task.Quota)

	// 日志记 Refund + refund
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
	assert.Equal(t, refund, log.Quota)
}

func TestRecalculate_ZeroDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID = 12
	const initQuota, preConsumed = 10000, 3000

	seedUser(t, userID, initQuota)

	task := makeTask(userID, 0, preConsumed, 0, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, preConsumed, 0, "exact match")

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

	RecalculateTaskQuota(ctx, task, 0, 0, "zero actual")

	// No change (early return)
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, int64(0), countLogs(t))
}

// TestQuotaData_RefundFullyReverts 端到端验证：
//  1. LogTaskConsumption 的 quota_data 进入 cache (+pre, count=1, tokens=0)；
//  2. 任务失败触发 RefundTaskQuota → 反向 adjust 写入 cache；
//  3. 落库后该 hour bucket 的 quota / count / tokens 全部归零（守恒）。
func TestQuotaData_RefundFullyReverts(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	prevDataExport := common.DataExportEnabled
	prevLogConsume := common.LogConsumeEnabled
	common.DataExportEnabled = true
	common.LogConsumeEnabled = true
	t.Cleanup(func() {
		common.DataExportEnabled = prevDataExport
		common.LogConsumeEnabled = prevLogConsume
	})

	const userID, tokenID, channelID = 40, 40, 40
	const walletAfterPre, preConsumed = 7000, 3000

	seedUserWithUsed(t, userID, walletAfterPre, preConsumed, 1)
	seedToken(t, tokenID, userID, "sk-qdata-refund", 5000)
	seedChannelWithUsed(t, channelID, int64(preConsumed))

	// 模拟 LogTaskConsumption 已经为本任务写过一笔正向 quota_data（count=1, quota=preConsumed）
	username, err := model.GetUsernameById(userID, false)
	require.NoError(t, err)
	model.LogQuotaData(userID, username, "test-model", preConsumed, time.Now().Unix(), 0)

	// 任务失败 → 退款（内部应同步反向 adjust quota_data）
	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	RefundTaskQuota(ctx, task, "task failed")

	// RefundTaskQuota 内部 RecordTaskBillingLog 走 gopool.Go 异步刷 quota_data，
	// 等待最多 1 秒让 goroutine 把 cache 写完再 flush。
	require.Eventually(t, func() bool {
		model.CacheQuotaDataLock.Lock()
		defer model.CacheQuotaDataLock.Unlock()
		// 反向 adjust 落入 cache 后，quota / token_used 净值应当为 0
		for _, qd := range model.CacheQuotaData {
			if qd.UserID != userID || qd.ModelName != "test-model" {
				continue
			}
			return qd.Quota == 0 && qd.TokenUsed == 0
		}
		return false
	}, time.Second, 20*time.Millisecond)

	model.SaveQuotaDataCache()

	// 落库后断言：该 user/model 维度下 sum(quota) 和 sum(token_used) 都应为 0（守恒）
	var sumQuota, sumTokens int64
	require.NoError(t, model.DB.Table("quota_data").
		Select("COALESCE(SUM(quota), 0)").
		Where("user_id = ? and model_name = ?", userID, "test-model").
		Scan(&sumQuota).Error)
	require.NoError(t, model.DB.Table("quota_data").
		Select("COALESCE(SUM(token_used), 0)").
		Where("user_id = ? and model_name = ?", userID, "test-model").
		Scan(&sumTokens).Error)
	assert.Equal(t, int64(0), sumQuota, "quota_data.quota 应在退款后净值归零")
	assert.Equal(t, int64(0), sumTokens, "quota_data.token_used 应在退款后净值归零")
}

// TestQuotaData_NegativeDeltaStillRecordsTokens 防回归用例：
// 当上游实际花费 < 预扣（部分退款），但仍然返回了 totalTokens 时，
// quota_data 必须做到「钱往负方向走，token 仍向正方向加到 totalTokens」。
// 这是历史 sign bug 的高发场景：金额 delta 是负的，token 却必须是正的。
func TestQuotaData_NegativeDeltaStillRecordsTokens(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	prevDataExport := common.DataExportEnabled
	prevLogConsume := common.LogConsumeEnabled
	common.DataExportEnabled = true
	common.LogConsumeEnabled = true
	t.Cleanup(func() {
		common.DataExportEnabled = prevDataExport
		common.LogConsumeEnabled = prevLogConsume
	})

	const userID, tokenID, channelID = 42, 42, 42
	const walletAfterPre, preConsumed = 5000, 5000
	const actualQuota = 3000 // delta = -2000，部分退款
	const totalTokens = 1234

	seedUserWithUsed(t, userID, walletAfterPre, preConsumed, 1)
	seedToken(t, tokenID, userID, "sk-qdata-neg-tokens", 5000)
	seedChannelWithUsed(t, channelID, int64(preConsumed))

	username, err := model.GetUsernameById(userID, false)
	require.NoError(t, err)
	model.LogQuotaData(userID, username, "test-model", preConsumed, time.Now().Unix(), 0)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	RecalculateTaskQuota(ctx, task, actualQuota, totalTokens, "token重算-负delta")

	require.Eventually(t, func() bool {
		model.CacheQuotaDataLock.Lock()
		defer model.CacheQuotaDataLock.Unlock()
		for _, qd := range model.CacheQuotaData {
			if qd.UserID != userID || qd.ModelName != "test-model" {
				continue
			}
			// quota: preConsumed + (actualQuota - preConsumed) = actualQuota
			// token_used: 0 + totalTokens = totalTokens（关键：不是 -totalTokens）
			return qd.Quota == actualQuota && qd.TokenUsed == totalTokens
		}
		return false
	}, time.Second, 20*time.Millisecond)

	model.SaveQuotaDataCache()

	var sumQuota, sumTokens int64
	require.NoError(t, model.DB.Table("quota_data").
		Select("COALESCE(SUM(quota), 0)").
		Where("user_id = ? and model_name = ?", userID, "test-model").
		Scan(&sumQuota).Error)
	require.NoError(t, model.DB.Table("quota_data").
		Select("COALESCE(SUM(token_used), 0)").
		Where("user_id = ? and model_name = ?", userID, "test-model").
		Scan(&sumTokens).Error)
	assert.Equal(t, int64(actualQuota), sumQuota, "quota 应当落在 actualQuota")
	assert.Equal(t, int64(totalTokens), sumTokens, "token_used 应当向正方向加到 totalTokens")

	// Log 表的 token 字段也应正确填到 CompletionTokens（即便日志类型是 Refund）
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
	assert.Equal(t, 0, log.PromptTokens)
	assert.Equal(t, totalTokens, log.CompletionTokens)
}

// TestQuotaData_RecalcByTokensRecordsTokens 验证 token 重算路径下：
//  1. quota_data.quota 净值 = actualQuota（pre + delta）
//  2. quota_data.token_used 由 0 增加到 totalTokens（视频任务 input=0 全部记 completion）
//  3. Log 的 prompt_tokens=0 / completion_tokens=totalTokens
func TestQuotaData_RecalcByTokensRecordsTokens(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	prevDataExport := common.DataExportEnabled
	prevLogConsume := common.LogConsumeEnabled
	common.DataExportEnabled = true
	common.LogConsumeEnabled = true
	t.Cleanup(func() {
		common.DataExportEnabled = prevDataExport
		common.LogConsumeEnabled = prevLogConsume
	})

	const userID, tokenID, channelID = 41, 41, 41
	const walletAfterPre, preConsumed = 8000, 2000
	const actualQuota = 3000 // delta = +1000
	const totalTokens = 1234

	seedUserWithUsed(t, userID, walletAfterPre, preConsumed, 1)
	seedToken(t, tokenID, userID, "sk-qdata-tokens", 5000)
	seedChannelWithUsed(t, channelID, int64(preConsumed))

	username, err := model.GetUsernameById(userID, false)
	require.NoError(t, err)
	model.LogQuotaData(userID, username, "test-model", preConsumed, time.Now().Unix(), 0)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	RecalculateTaskQuota(ctx, task, actualQuota, totalTokens, "token重算")

	// 等异步 LogQuotaDataAdjust 刷进 cache
	require.Eventually(t, func() bool {
		model.CacheQuotaDataLock.Lock()
		defer model.CacheQuotaDataLock.Unlock()
		for _, qd := range model.CacheQuotaData {
			if qd.UserID != userID || qd.ModelName != "test-model" {
				continue
			}
			// cache 里此时 quota = preConsumed + (actualQuota - preConsumed) = actualQuota
			//             token_used = 0 + totalTokens = totalTokens
			return qd.Quota == actualQuota && qd.TokenUsed == totalTokens
		}
		return false
	}, time.Second, 20*time.Millisecond)

	model.SaveQuotaDataCache()

	var sumQuota, sumTokens int64
	require.NoError(t, model.DB.Table("quota_data").
		Select("COALESCE(SUM(quota), 0)").
		Where("user_id = ? and model_name = ?", userID, "test-model").
		Scan(&sumQuota).Error)
	require.NoError(t, model.DB.Table("quota_data").
		Select("COALESCE(SUM(token_used), 0)").
		Where("user_id = ? and model_name = ?", userID, "test-model").
		Scan(&sumTokens).Error)
	assert.Equal(t, int64(actualQuota), sumQuota)
	assert.Equal(t, int64(totalTokens), sumTokens)

	// Log 的 token 字段被正确填写
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeConsume, log.Type)
	assert.Equal(t, 0, log.PromptTokens)
	assert.Equal(t, totalTokens, log.CompletionTokens)
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

	RecalculateTaskQuota(ctx, task, actualQuota, 0, "subscription over-charge")

	// Subscription used should decrease by delta (refund 3000)
	assert.Equal(t, subUsed-int64(preConsumed-actualQuota), getSubscriptionUsed(t, subID))

	// Token refunded
	assert.Equal(t, tokenRemain+(preConsumed-actualQuota), getTokenRemainQuota(t, tokenID))

	assert.Equal(t, actualQuota, task.Quota)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
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
		RecalculateTaskQuota(ctx, task, actualQuota, 0, "test settle")
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
