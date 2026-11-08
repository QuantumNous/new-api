package model

import (
	"errors"
	"math"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func createReserveTestUser(t *testing.T, quota int) User {
	t.Helper()
	user := User{
		Username:    "reserve-user-" + common.GetRandomString(6),
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
		Quota:       quota,
		AffCode:     "reserve-aff-" + common.GetRandomString(8),
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func createReserveTestToken(t *testing.T, remainQuota int) Token {
	t.Helper()
	token := Token{
		UserId:      1,
		Key:         "reserve-token-" + common.GetRandomString(8),
		Name:        "reserve-test",
		Status:      common.TokenStatusEnabled,
		ExpiredTime: -1,
		RemainQuota: remainQuota,
	}
	require.NoError(t, token.Insert())
	return token
}

func getUserQuotaFromDB(t *testing.T, id int) int {
	t.Helper()
	var user User
	require.NoError(t, DB.Select("quota").First(&user, id).Error)
	return user.Quota
}

func getTokenFromDB(t *testing.T, id int) Token {
	t.Helper()
	var token Token
	require.NoError(t, DB.First(&token, id).Error)
	return token
}

func resetBatchUpdateTestState(t *testing.T) {
	t.Helper()
	oldBatchEnabled := common.BatchUpdateEnabled
	common.BatchUpdateEnabled = false
	for i := range BatchUpdateTypeCount {
		batchUpdateLocks[i].Lock()
		batchUpdateStores[i] = make(map[int]int)
		batchUpdateLocks[i].Unlock()
	}
	t.Cleanup(func() {
		common.BatchUpdateEnabled = oldBatchEnabled
		for i := range BatchUpdateTypeCount {
			batchUpdateLocks[i].Lock()
			batchUpdateStores[i] = make(map[int]int)
			batchUpdateLocks[i].Unlock()
		}
	})
}

func TestTryReserveQuotaWithoutRedis(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := createReserveTestUser(t, 100)
	reserved, err := TryReserveUserQuota(user.Id, 60)
	require.NoError(t, err)
	assert.True(t, reserved)
	assert.Equal(t, 40, getUserQuotaFromDB(t, user.Id))

	reserved, err = TryReserveUserQuota(user.Id, 41)
	require.NoError(t, err)
	assert.False(t, reserved)
	assert.Equal(t, 40, getUserQuotaFromDB(t, user.Id))

	token := createReserveTestToken(t, 80)
	reserved, err = TryReserveTokenQuota(token.Id, token.Key, 25, false)
	require.NoError(t, err)
	assert.True(t, reserved)
	reloaded := getTokenFromDB(t, token.Id)
	assert.Equal(t, 55, reloaded.RemainQuota)
	assert.Equal(t, 25, reloaded.UsedQuota)

	reserved, err = TryReserveTokenQuota(token.Id, token.Key, 56, false)
	require.NoError(t, err)
	assert.False(t, reserved)
	assert.Equal(t, 55, getTokenFromDB(t, token.Id).RemainQuota)
}

func TestRedisBatchReserveNeverFallsBackToStaleDatabaseBalance(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)
	common.BatchUpdateEnabled = true

	user := createReserveTestUser(t, 10)
	reserved, err := TryReserveUserQuota(user.Id, 8)
	require.NoError(t, err)
	assert.True(t, reserved)
	assert.Equal(t, 10, getUserQuotaFromDB(t, user.Id), "batch delta is not flushed yet")

	reserved, err = TryReserveUserQuota(user.Id, 3)
	require.NoError(t, err)
	assert.False(t, reserved, "stale DB balance must not authorize a second spend")
	cachedUser, err := GetUserCache(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 2, cachedUser.Quota)

	token := createReserveTestToken(t, 9)
	reserved, err = TryReserveTokenQuota(token.Id, token.Key, 7, false)
	require.NoError(t, err)
	assert.True(t, reserved)
	reserved, err = TryReserveTokenQuota(token.Id, token.Key, 3, false)
	require.NoError(t, err)
	assert.False(t, reserved)
	assert.Equal(t, 9, getTokenFromDB(t, token.Id).RemainQuota)

	batchUpdate()
	assert.Equal(t, 2, getUserQuotaFromDB(t, user.Id))
	reloadedToken := getTokenFromDB(t, token.Id)
	assert.Equal(t, 2, reloadedToken.RemainQuota)
	assert.Equal(t, 7, reloadedToken.UsedQuota)
}

func TestBatchUpdateAccumulatesTwoMaximumRequestCharges(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	common.BatchUpdateEnabled = true

	user := createReserveTestUser(t, common.MaxQuota*2+100)
	require.NoError(t, DecreaseUserQuota(user.Id, common.MaxQuota, false))
	require.NoError(t, DecreaseUserQuota(user.Id, common.MaxQuota, false))

	batchUpdate()
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))
}

func TestBatchUpdateAccumulatorSaturatesOverflow(t *testing.T) {
	resetBatchUpdateTestState(t)

	addNewRecord(BatchUpdateTypeUserQuota, 1, math.MaxInt)
	addNewRecord(BatchUpdateTypeUserQuota, 1, 1)
	batchUpdateLocks[BatchUpdateTypeUserQuota].Lock()
	assert.Equal(t, math.MaxInt, batchUpdateStores[BatchUpdateTypeUserQuota][1])
	batchUpdateLocks[BatchUpdateTypeUserQuota].Unlock()

	batchUpdateLocks[BatchUpdateTypeUserQuota].Lock()
	batchUpdateStores[BatchUpdateTypeUserQuota] = make(map[int]int)
	batchUpdateLocks[BatchUpdateTypeUserQuota].Unlock()
	addNewRecord(BatchUpdateTypeUserQuota, 1, math.MinInt)
	addNewRecord(BatchUpdateTypeUserQuota, 1, -1)
	batchUpdateLocks[BatchUpdateTypeUserQuota].Lock()
	assert.Equal(t, math.MinInt, batchUpdateStores[BatchUpdateTypeUserQuota][1])
	batchUpdateLocks[BatchUpdateTypeUserQuota].Unlock()
}

func TestReserveFallsBackToDatabaseWhenRedisIsUnavailable(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	server := useUserCacheMiniRedis(t)

	user := createReserveTestUser(t, 20)
	require.NoError(t, populateUserCache(user))
	server.Close()

	// Redis 故障时降级为数据库条件更新：服务保持可用且不会超扣。
	reserved, err := TryReserveUserQuota(user.Id, 5)
	require.NoError(t, err)
	assert.True(t, reserved)
	assert.Equal(t, 15, getUserQuotaFromDB(t, user.Id))

	reserved, err = TryReserveUserQuota(user.Id, 16)
	require.NoError(t, err)
	assert.False(t, reserved)
	assert.Equal(t, 15, getUserQuotaFromDB(t, user.Id))
}

func TestSynchronousReserveCompensatesCacheWhenPersistenceFails(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)

	user := createReserveTestUser(t, 10)
	require.NoError(t, populateUserCache(user))
	require.NoError(t, DB.Delete(&user).Error)

	reserved, err := TryReserveUserQuota(user.Id, 6)
	assert.False(t, reserved)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	cached, cacheErr := cacheGetUserBase(user.Id)
	require.NoError(t, cacheErr)
	assert.Equal(t, 10, cached.Quota)

	token := createReserveTestToken(t, 12)
	_, err = GetTokenByKey(token.Key, true)
	require.NoError(t, err)
	require.NoError(t, DB.Delete(&token).Error)
	reserved, err = TryReserveTokenQuota(token.Id, token.Key, 7, false)
	assert.False(t, reserved)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	cachedToken, cacheErr := cacheGetTokenByKey(token.Key)
	require.NoError(t, cacheErr)
	assert.Equal(t, 12, cachedToken.RemainQuota)
	assert.Zero(t, cachedToken.UsedQuota)
}

func TestTokenCacheInitPreservesLiveQuotaAndFenceBlocksStaleSnapshot(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	server := useUserCacheMiniRedis(t)

	token := createReserveTestToken(t, 100)
	loaded, err := GetTokenByKey(token.Key, true)
	require.NoError(t, err)
	stale := *loaded

	result, err := cacheApplyTokenQuotaDelta(token.Id, token.Key, -70)
	require.NoError(t, err)
	require.Equal(t, cacheQuotaOK, result)

	// 已存在的哈希只刷新 TTL：数据库快照不得覆盖已被原子预扣的余额。
	code, err := cacheInitToken(stale)
	require.NoError(t, err)
	assert.Equal(t, 2, code)
	cached, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 30, cached.RemainQuota)

	// 变更期间：fence 删除缓存并拦截并发读者手中的过期快照。
	require.NoError(t, invalidateTokenCacheForMutation(token.Key))
	code, err = cacheInitToken(stale)
	require.NoError(t, err)
	assert.Zero(t, code, "the pre-mutation snapshot must not be published while fenced")
	_, err = cacheGetTokenByKey(token.Key)
	assert.Error(t, err)

	// fence 过期后可重新从数据库水合。
	server.FastForward(time.Duration(tokenCacheFenceSeconds+1) * time.Second)
	fresh, err := GetTokenByKey(token.Key, false)
	require.NoError(t, err)
	assert.Equal(t, 100, fresh.RemainQuota)
	cached, err = cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 100, cached.RemainQuota)
}

func TestSettleUserQuotaDebitChargesFullAmountWhenFunded(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := createReserveTestUser(t, 1000)

	deducted, err := SettleUserQuotaDebit(user.Id, 300)

	require.NoError(t, err)
	assert.Equal(t, 300, deducted)
	assert.Equal(t, 700, getUserQuotaFromDB(t, user.Id))
}

func TestSettleUserQuotaDebitRejectsChargeBeyondBalance(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := createReserveTestUser(t, 100)

	// 预扣保证结算差额有余额覆盖；一旦不满足，条件更新拒绝整笔扣款而不是
	// 部分扣减或记账欠费，由调用方记录对账错误。
	deducted, err := SettleUserQuotaDebit(user.Id, 400)
	require.NoError(t, err)
	assert.Zero(t, deducted, "an uncovered settlement is not partially charged")
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id), "an uncovered settlement must not move the balance")

	deducted, err = SettleUserQuotaDebit(user.Id, 50)
	require.NoError(t, err)
	assert.Equal(t, 50, deducted)
	assert.Equal(t, 50, getUserQuotaFromDB(t, user.Id))
}

func TestSettleUserQuotaDebitUnderConcurrentSettlementsNeverOverdraws(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := createReserveTestUser(t, 100)

	const settlements = 4
	deductedAmounts := make(chan int, settlements)
	errs := make(chan error, settlements)
	var wg sync.WaitGroup
	for range settlements {
		wg.Go(func() {
			deducted, err := SettleUserQuotaDebit(user.Id, 100)
			deductedAmounts <- deducted
			errs <- err
		})
	}
	wg.Wait()
	close(deductedAmounts)
	close(errs)

	total := 0
	for err := range errs {
		require.NoError(t, err)
	}
	for deducted := range deductedAmounts {
		total += deducted
	}
	assert.Equal(t, 100, total, "concurrent settlements must charge the balance exactly once")
	assert.Equal(t, 0, getUserQuotaFromDB(t, user.Id))
}

func TestDecreaseUserQuotaRejectsInsufficientBalanceWithoutRedis(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := createReserveTestUser(t, 100)

	// 扣减受 quota >= ? 约束：余额不足时返回严格错误，且不做部分扣减。
	require.ErrorIs(t, DecreaseUserQuota(user.Id, 101, false), ErrInsufficientUserQuota)
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))

	require.NoError(t, DecreaseUserQuota(user.Id, 100, false))
	assert.Equal(t, 0, getUserQuotaFromDB(t, user.Id))

	require.ErrorIs(t, DecreaseUserQuota(user.Id, 1, false), ErrInsufficientUserQuota)
	assert.Equal(t, 0, getUserQuotaFromDB(t, user.Id))
}

func TestConcurrentDecreaseUserQuotaNeverOverdraws(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	const (
		balance = 100
		amount  = 30
		workers = 10
	)
	user := createReserveTestUser(t, balance)

	errs := make([]error, workers)
	var waitGroup sync.WaitGroup
	for i := range workers {
		waitGroup.Go(func() { errs[i] = DecreaseUserQuota(user.Id, amount, false) })
	}
	waitGroup.Wait()

	succeeded := 0
	for _, err := range errs {
		if err == nil {
			succeeded++
			continue
		}
		require.ErrorIs(t, err, ErrInsufficientUserQuota)
	}
	assert.Equal(t, balance/amount, succeeded)
	assert.Equal(t, balance-succeeded*amount, getUserQuotaFromDB(t, user.Id))
	assert.GreaterOrEqual(t, getUserQuotaFromDB(t, user.Id), 0)
}

// Redis 为权威值时，并发扣减也必须由 Lua 原子比较并扣减串行化：只有余额覆盖
// 的扣减会成功，其余返回 ErrInsufficientUserQuota，缓存余额永远不为负。
func TestConcurrentDecreaseUserQuotaRedisNeverOverdraws(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)

	const (
		balance = 100
		amount  = 30
		workers = 10
	)
	user := createReserveTestUser(t, balance)
	require.NoError(t, populateUserCache(user))

	errs := make([]error, workers)
	var waitGroup sync.WaitGroup
	for i := range workers {
		waitGroup.Go(func() { errs[i] = DecreaseUserQuota(user.Id, amount, false) })
	}
	waitGroup.Wait()

	succeeded := 0
	for _, err := range errs {
		if err == nil {
			succeeded++
			continue
		}
		require.ErrorIs(t, err, ErrInsufficientUserQuota)
	}
	assert.Equal(t, balance/amount, succeeded)

	cached, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, balance-succeeded*amount, cached.Quota)
	assert.GreaterOrEqual(t, cached.Quota, 0)
	assert.Equal(t, cached.Quota, getUserQuotaFromDB(t, user.Id), "the live cache and database must stay in sync")
}

// Redis 故障时额度增减同步降级为数据库条件更新：扣减不会丢失也不会扣成负数。
func TestDecreaseUserQuotaFailsSafeWhenRedisUnavailable(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	server := useUserCacheMiniRedis(t)

	user := createReserveTestUser(t, 100)
	require.NoError(t, populateUserCache(user))

	server.Close()

	require.NoError(t, DecreaseUserQuota(user.Id, 30, false))
	assert.Equal(t, 70, getUserQuotaFromDB(t, user.Id))

	require.ErrorIs(t, DecreaseUserQuota(user.Id, 80, false), ErrInsufficientUserQuota)
	assert.Equal(t, 70, getUserQuotaFromDB(t, user.Id), "an uncovered deduction must not move the balance")
}

// 退款/充值在 Redis 故障时也必须同步落库，不能因为缓存不可用而丢失增量。
func TestIncreaseUserQuotaSurvivesRedisFailure(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	server := useUserCacheMiniRedis(t)

	user := createReserveTestUser(t, 100)
	require.NoError(t, populateUserCache(user))

	server.Close()

	require.NoError(t, IncreaseUserQuota(user.Id, 50, false))
	assert.Equal(t, 150, getUserQuotaFromDB(t, user.Id))
}

// S-03：额度增减必须同步更新 Redis（不再 fire-and-forget），函数返回时缓存
// 已反映最新余额，不依赖后台协程。
func TestUserQuotaUpdateSyncsCacheSynchronously(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)

	user := createReserveTestUser(t, 100)
	require.NoError(t, populateUserCache(user))

	require.NoError(t, DecreaseUserQuota(user.Id, 40, false))
	cached, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 60, cached.Quota)

	require.NoError(t, IncreaseUserQuota(user.Id, 15, false))
	cached, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 75, cached.Quota)
}

// S-03：批量模式下 Redis 优先同步扣减，增量随后进入 outbox 等待异步落库。
func TestUserQuotaUpdateRedisFirstOutboxSecond(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)
	common.BatchUpdateEnabled = true

	user := createReserveTestUser(t, 100)
	require.NoError(t, populateUserCache(user))

	require.NoError(t, DecreaseUserQuota(user.Id, 40, false))

	cached, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 60, cached.Quota, "the live cache must be updated synchronously")
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id), "the outbox delta is not flushed yet")

	batchUpdate()
	assert.Equal(t, 60, getUserQuotaFromDB(t, user.Id))
}

func TestRefundWalletPreConsumeCreditsExactlyOnce(t *testing.T) {
	const (
		startQuota  = 1_000
		preConsumed = 400
		requestId   = "refund-replay-request"
	)
	truncateTables(t)
	resetBatchUpdateTestState(t)
	user := createReserveTestUser(t, startQuota)
	require.NoError(t, DecreaseUserQuota(user.Id, preConsumed, true))
	require.Equal(t, startQuota-preConsumed, getUserQuotaFromDB(t, user.Id))
	// Startup migration runs on every boot, so the refund table must accept a
	// repeated AutoMigrate without losing its unique request id index.
	require.NoError(t, DB.AutoMigrate(&WalletRefundRecord{}))
	require.NoError(t, DB.AutoMigrate(&WalletRefundRecord{}))

	// Replay the same refund the way a retried background task or a manual
	// operator retry would: the balance must be credited exactly once.
	require.NoError(t, RefundWalletPreConsume(requestId, user.Id, preConsumed))
	require.NoError(t, RefundWalletPreConsume(requestId, user.Id, preConsumed))
	assert.Equal(t, startQuota, getUserQuotaFromDB(t, user.Id))

	var records int64
	require.NoError(t, DB.Model(&WalletRefundRecord{}).Where("request_id = ?", requestId).Count(&records).Error)
	assert.EqualValues(t, 1, records)
}

func TestRefundWalletPreConsumeConcurrentReplayCreditsExactlyOnce(t *testing.T) {
	const (
		startQuota  = 1_000
		preConsumed = 400
		requestId   = "refund-concurrent-request"
		workers     = 8
	)
	truncateTables(t)
	resetBatchUpdateTestState(t)
	user := createReserveTestUser(t, startQuota)
	require.NoError(t, DecreaseUserQuota(user.Id, preConsumed, true))

	errs := make([]error, workers)
	var waitGroup sync.WaitGroup
	for i := range workers {
		waitGroup.Go(func() { errs[i] = RefundWalletPreConsume(requestId, user.Id, preConsumed) })
	}
	waitGroup.Wait()

	for _, err := range errs {
		require.NoError(t, err)
	}
	assert.Equal(t, startQuota, getUserQuotaFromDB(t, user.Id), "concurrent refunds must credit the wallet once")
}

// injectUserTableUpdateFailure 模拟批量刷新期间数据库故障：outbox 行已持久化，
// 但目标用户行更新失败。返回的开关置为 false 后可恢复。
func injectUserTableUpdateFailure(t *testing.T) *atomic.Bool {
	t.Helper()
	failing := &atomic.Bool{}
	failing.Store(true)
	const callback = "test:inject_users_table_update_failure"
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callback, func(tx *gorm.DB) {
		if failing.Load() && tx.Statement.Table == "users" {
			tx.AddError(errors.New("injected users table update failure"))
		}
	}))
	t.Cleanup(func() { _ = DB.Callback().Update().Remove(callback) })
	return failing
}

func TestBatchUpdateOutboxSurvivesApplyFailureAndReplaysExactlyOnce(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	common.BatchUpdateEnabled = true

	user := createReserveTestUser(t, 1000)
	// 同一轮里既有扣减也有退还（退款/充值），净增量必须在恢复后恰好应用一次。
	require.NoError(t, DecreaseUserQuota(user.Id, 300, false))
	require.NoError(t, IncreaseUserQuota(user.Id, 200, false))
	UpdateUserUsedQuotaAndRequestCount(user.Id, 300)

	failing := injectUserTableUpdateFailure(t)
	batchUpdate()

	// 目标行更新失败：内存增量已经持久化到 outbox，数据库保持不变，行等待重试。
	assert.Equal(t, 1000, getUserQuotaFromDB(t, user.Id))
	var pending []QuotaOutbox
	require.NoError(t, DB.Where("status = ?", quotaOutboxStatusPending).Find(&pending).Error)
	require.Len(t, pending, 1)
	assert.EqualValues(t, -100, pending[0].QuotaDelta)
	assert.EqualValues(t, 300, pending[0].UsedQuotaDelta)
	assert.EqualValues(t, 1, pending[0].RequestCountDelta)
	assert.Positive(t, pending[0].Attempts, "a failed apply must be recorded for retry")
	assert.NotEmpty(t, pending[0].LastError)

	// 数据库恢复后按启动恢复流程重放，增量恰好应用一次。
	failing.Store(false)
	RecoverQuotaOutbox()
	var got User
	require.NoError(t, DB.Select("quota", "used_quota", "request_count").First(&got, user.Id).Error)
	assert.Equal(t, 900, got.Quota)
	assert.Equal(t, 300, got.UsedQuota)
	assert.Equal(t, 1, got.RequestCount)

	// 重复恢复必须幂等，不得二次扣减。
	RecoverQuotaOutbox()
	RecoverQuotaOutbox()
	assert.Equal(t, 900, getUserQuotaFromDB(t, user.Id))
	var remaining int64
	require.NoError(t, DB.Model(&QuotaOutbox{}).Where("status = ?", quotaOutboxStatusPending).Count(&remaining).Error)
	assert.Zero(t, remaining)
}

func TestBatchUpdateOutboxRecoveryKeepsCacheConsistentWithDatabase(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)
	common.BatchUpdateEnabled = true

	user := createReserveTestUser(t, 1000)
	require.NoError(t, populateUserCache(user))

	reserved, err := TryReserveUserQuota(user.Id, 300)
	require.NoError(t, err)
	require.True(t, reserved)
	cached, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	require.Equal(t, 700, cached.Quota, "the reservation is visible in the live cache")

	// flush 期间数据库故障：缓存已经是 700，数据库仍是 1000，增量保存在 outbox。
	failing := injectUserTableUpdateFailure(t)
	batchUpdate()
	assert.Equal(t, 1000, getUserQuotaFromDB(t, user.Id))

	// 缓存失效后（TTL 过期/重启），重放必须让数据库回到正确余额，随后水合的
	// 缓存也必须一致。
	failing.Store(false)
	RecoverQuotaOutbox()
	assert.Equal(t, 700, getUserQuotaFromDB(t, user.Id))

	cacheAfter, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 700, cacheAfter.Quota)

	require.NoError(t, invalidateUserCache(user.Id))
	hydrated, err := GetUserCache(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 700, hydrated.Quota, "cache rehydration after recovery must match the database")
}

func TestOutboxRecoveryKeepsConsumeLogsAndUsedQuotaInSync(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	common.BatchUpdateEnabled = true

	user := createReserveTestUser(t, 1000)
	require.NoError(t, LOG_DB.Create(&Log{UserId: user.Id, Type: LogTypeConsume, Quota: 300, CreatedAt: common.GetTimestamp()}).Error)
	UpdateUserUsedQuotaAndRequestCount(user.Id, 300)

	failing := injectUserTableUpdateFailure(t)
	batchUpdate()
	failing.Store(false)
	RecoverQuotaOutbox()

	var logTotal, usedTotal int64
	require.NoError(t, LOG_DB.Model(&Log{}).Where("user_id = ? AND type = ?", user.Id, LogTypeConsume).
		Select("COALESCE(SUM(quota), 0)").Scan(&logTotal).Error)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).
		Select("COALESCE(SUM(used_quota), 0)").Scan(&usedTotal).Error)
	assert.EqualValues(t, 300, logTotal)
	assert.Equal(t, logTotal, usedTotal, "consume logs and accumulated used quota must reconcile after recovery")
}

// 启动迁移会在每次引导时运行，outbox 表必须能重复 AutoMigrate 且保留可用性。
func TestQuotaOutboxMigrationIsIdempotent(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	require.NoError(t, DB.AutoMigrate(&QuotaOutbox{}))
	require.NoError(t, DB.AutoMigrate(&QuotaOutbox{}))
	require.True(t, DB.Migrator().HasTable(&QuotaOutbox{}))

	row := QuotaOutbox{TargetType: quotaOutboxTargetUser, TargetId: 42, QuotaDelta: -5, Status: quotaOutboxStatusPending}
	require.NoError(t, DB.Create(&row).Error)
	require.NotZero(t, row.Id)
}

// outbox 是新的数据库表：与仓库中其他跨库测试一致，配置 DSN 后会在真实
// MySQL/PostgreSQL 上运行，未配置时跳过。所有增量类型都必须恰好应用一次。
func TestQuotaOutboxDatabaseMatrix(t *testing.T) {
	for _, dialect := range []struct {
		name common.DatabaseType
		env  string
	}{
		{common.DatabaseTypeSQLite, ""},
		{common.DatabaseTypeMySQL, "TEST_OUTBOX_MYSQL_DSN"},
		{common.DatabaseTypePostgreSQL, "TEST_OUTBOX_POSTGRES_DSN"},
	} {
		t.Run(string(dialect.name), func(t *testing.T) {
			var driver gorm.Dialector = sqlite.Open(":memory:")
			if dialect.env != "" {
				dsn := os.Getenv(dialect.env)
				if dsn == "" {
					t.Skip(dialect.env + " is not configured")
				}
				if dialect.name == common.DatabaseTypeMySQL {
					driver = mysql.Open(dsn)
				} else {
					driver = postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
				}
			}
			db, err := gorm.Open(driver, &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			t.Cleanup(func() { _ = sqlDB.Close() })

			oldDB := DB
			DB = db
			t.Cleanup(func() { DB = oldDB })
			oldRedis := common.RedisEnabled
			common.RedisEnabled = false
			t.Cleanup(func() { common.RedisEnabled = oldRedis })

			require.NoError(t, db.AutoMigrate(&QuotaOutbox{}, &User{}, &Token{}, &Channel{}))
			// 启动迁移在每次引导时重复执行，必须幂等。
			require.NoError(t, db.AutoMigrate(&QuotaOutbox{}))

			resetBatchUpdateTestState(t)
			common.BatchUpdateEnabled = true

			user := User{Username: "outbox-matrix-" + common.GetRandomString(6), Password: "unused-password-hash", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, Quota: 1000, AffCode: "outbox-aff-" + common.GetRandomString(8)}
			require.NoError(t, db.Create(&user).Error)
			token := Token{UserId: user.Id, Key: "outbox-token-" + common.GetRandomString(8), Name: "outbox", Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: 500}
			require.NoError(t, db.Create(&token).Error)
			channel := Channel{Name: "outbox-channel-" + common.GetRandomString(6), Key: "sk-outbox", Status: common.ChannelStatusEnabled}
			require.NoError(t, db.Create(&channel).Error)

			require.NoError(t, DecreaseUserQuota(user.Id, 300, false))
			require.NoError(t, DecreaseTokenQuota(token.Id, token.Key, 120))
			UpdateUserUsedQuota(user.Id, 300)
			UpdateChannelUsedQuota(channel.Id, 300)
			batchUpdate()

			var storedUser User
			require.NoError(t, db.Select("quota", "used_quota").First(&storedUser, user.Id).Error)
			assert.Equal(t, 700, storedUser.Quota)
			assert.Equal(t, 300, storedUser.UsedQuota)
			var storedToken Token
			require.NoError(t, db.First(&storedToken, token.Id).Error)
			assert.Equal(t, 380, storedToken.RemainQuota)
			assert.Equal(t, 120, storedToken.UsedQuota)
			var storedChannel Channel
			require.NoError(t, db.First(&storedChannel, channel.Id).Error)
			assert.EqualValues(t, 300, storedChannel.UsedQuota)
			var pending int64
			require.NoError(t, db.Model(&QuotaOutbox{}).Where("status = ?", quotaOutboxStatusPending).Count(&pending).Error)
			assert.Zero(t, pending)

			// 已处理行重放必须幂等。
			RecoverQuotaOutbox()
			require.NoError(t, db.Select("quota").First(&storedUser, user.Id).Error)
			assert.Equal(t, 700, storedUser.Quota)

			// 模拟 flush 后目标更新未提交：pending 行在恢复后恰好应用一次。
			leftover := QuotaOutbox{TargetType: quotaOutboxTargetUser, TargetId: user.Id, QuotaDelta: -50, Status: quotaOutboxStatusPending}
			require.NoError(t, db.Create(&leftover).Error)
			RecoverQuotaOutbox()
			require.NoError(t, db.Select("quota").First(&storedUser, user.Id).Error)
			assert.Equal(t, 650, storedUser.Quota)

			// 恢复可重复执行，余额不再变化。
			RecoverQuotaOutbox()
			require.NoError(t, db.Select("quota").First(&storedUser, user.Id).Error)
			assert.Equal(t, 650, storedUser.Quota)
		})
	}
}
