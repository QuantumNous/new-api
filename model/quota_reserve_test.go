package model

import (
	"math"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
	t.Setenv("BATCH_UPDATE_OUTBOX_DIR", t.TempDir())
	resetBatchOutbox()
	clearBatchUpdateAccumulators()
	t.Cleanup(func() {
		common.BatchUpdateEnabled = oldBatchEnabled
		clearBatchUpdateAccumulators()
		resetBatchOutbox()
	})
}

func clearBatchUpdateAccumulators() {
	for i := range BatchUpdateTypeCount {
		batchUpdateLocks[i].Lock()
		batchUpdateStores[i] = make(map[int]int)
		batchUpdateLocks[i].Unlock()
	}
	batchUpdateRetriesLock.Lock()
	batchUpdateRetries = nil
	batchUpdateRetriesLock.Unlock()
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

func TestSettleUserQuotaDebitStopsAtZeroBalance(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := createReserveTestUser(t, 100)

	deducted, err := SettleUserQuotaDebit(user.Id, 400)
	require.NoError(t, err)
	assert.Equal(t, 100, deducted, "a settlement larger than the wallet charges at most the balance")
	assert.Equal(t, 0, getUserQuotaFromDB(t, user.Id))

	deducted, err = SettleUserQuotaDebit(user.Id, 50)
	require.NoError(t, err)
	assert.Zero(t, deducted, "an exhausted wallet must not create debt")
	assert.Equal(t, 0, getUserQuotaFromDB(t, user.Id))
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

// A wallet that only covers three requests must admit exactly three of two
// hundred concurrent reservations. The old snapshot trust check let all of them
// start and settled the overage to zero, which is free service delivery.
func TestConcurrentReservationsNeverExceedTheWalletBalance(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)
	common.BatchUpdateEnabled = true

	const (
		attempts = 200
		allowed  = 3
		price    = 100
	)
	user := createReserveTestUser(t, allowed*price)
	require.NoError(t, populateUserCache(user))

	var (
		waitGroup sync.WaitGroup
		reserved  atomic.Int64
		rejected  atomic.Int64
		failures  atomic.Int64
	)
	for range attempts {
		waitGroup.Go(func() {
			ok, err := TryReserveUserQuota(user.Id, price)
			switch {
			case err != nil:
				failures.Add(1)
			case ok:
				reserved.Add(1)
			default:
				rejected.Add(1)
			}
		})
	}
	waitGroup.Wait()

	require.Zero(t, failures.Load(), "every request must be admitted or rejected cleanly")
	assert.EqualValues(t, allowed, reserved.Load())
	assert.EqualValues(t, attempts-allowed, rejected.Load())

	batchUpdate()
	assert.Zero(t, getUserQuotaFromDB(t, user.Id))
}

func TestDecreaseUserQuotaNeverOverdrawsTheWallet(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := createReserveTestUser(t, 50)

	err := DecreaseUserQuota(user.Id, 51, true)
	assert.ErrorIs(t, err, ErrUserQuotaInsufficient)
	assert.Equal(t, 50, getUserQuotaFromDB(t, user.Id), "a rejected debit must not touch the balance")

	require.NoError(t, DecreaseUserQuota(user.Id, 50, true))
	assert.Zero(t, getUserQuotaFromDB(t, user.Id))
}

// Every wallet debit entry point must reject a charge the balance cannot cover
// instead of writing a negative quota, including the delta helper legacy code
// still calls.
func TestUserQuotaDebitPathsNeverOverdrawTheWallet(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	debitPaths := []struct {
		name  string
		debit func(userID, amount int) error
	}{
		{"DecreaseUserQuota", func(id, amount int) error { return DecreaseUserQuota(id, amount, true) }},
		{"DeltaUpdateUserQuota", func(id, amount int) error { return DeltaUpdateUserQuota(id, -amount) }},
	}
	for _, path := range debitPaths {
		t.Run(path.name, func(t *testing.T) {
			user := createReserveTestUser(t, 30)

			require.NoError(t, path.debit(user.Id, 30))
			assert.Zero(t, getUserQuotaFromDB(t, user.Id))

			assert.Error(t, path.debit(user.Id, 1), "an exhausted wallet must reject further debits")
			assert.Zero(t, getUserQuotaFromDB(t, user.Id), "quota must never drop below zero")
		})
	}
}

func TestBatchFlushClampsDebitsBeyondTheWalletBalance(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	common.BatchUpdateEnabled = true

	user := createReserveTestUser(t, 100)
	require.NoError(t, DecreaseUserQuota(user.Id, 400, false))

	batchUpdate()
	assert.Zero(t, getUserQuotaFromDB(t, user.Id), "a batch debit may never drive the wallet negative")
}

// A process killed between staging a batch and committing it must replay the
// staged deltas on the next start, and a batch that already committed must not
// be charged twice.
func TestBatchOutboxRecoveryAppliesStagedDeltasExactlyOnce(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	common.BatchUpdateEnabled = true

	// Phase 1: the process dies before the database transaction commits.
	beforeCommit := createReserveTestUser(t, 1000)
	require.NoError(t, DecreaseUserQuota(beforeCommit.Id, 300, false))
	outbox, err := getBatchOutbox()
	require.NoError(t, err)
	batchID := newBatchID()
	require.NoError(t, outbox.stage(batchID, copyBatchUpdateStores()))
	clearBatchUpdateAccumulators()
	crashFile := filepath.Join(filepath.Dir(outbox.path), "batch-outbox-previous-process.wal")
	require.NoError(t, os.Rename(outbox.path, crashFile))
	resetBatchOutbox()

	RecoverBatchOutbox()
	assert.Equal(t, 700, getUserQuotaFromDB(t, beforeCommit.Id))
	assert.NoFileExists(t, crashFile)

	// Phase 2: the process dies after the commit but before the log was compacted.
	afterCommit := createReserveTestUser(t, 1000)
	require.NoError(t, DecreaseUserQuota(afterCommit.Id, 250, false))
	outbox, err = getBatchOutbox()
	require.NoError(t, err)
	snapshot := copyBatchUpdateStores()
	batchID = newBatchID()
	require.NoError(t, outbox.stage(batchID, snapshot))
	require.NoError(t, applyBatchQuotaDeltas(batchID, snapshot))
	assert.Equal(t, 750, getUserQuotaFromDB(t, afterCommit.Id))
	clearBatchUpdateAccumulators()
	crashFile = filepath.Join(filepath.Dir(outbox.path), "batch-outbox-previous-process-2.wal")
	require.NoError(t, os.Rename(outbox.path, crashFile))
	resetBatchOutbox()

	RecoverBatchOutbox()
	assert.Equal(t, 750, getUserQuotaFromDB(t, afterCommit.Id), "an already committed batch must not be charged twice")
	assert.NoFileExists(t, crashFile)
}

// A database failure during a flush must keep the deltas for the next attempt
// instead of dropping them.
func TestBatchUpdateRetriesFailedFlushWithoutLosingDeltas(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	common.BatchUpdateEnabled = true

	user := createReserveTestUser(t, 1000)
	require.NoError(t, DecreaseUserQuota(user.Id, 400, false))
	require.NoError(t, DB.Migrator().DropTable(&BatchQuotaJournal{}))
	t.Cleanup(func() { _ = DB.AutoMigrate(&BatchQuotaJournal{}) })

	batchUpdate()
	assert.Equal(t, 1000, getUserQuotaFromDB(t, user.Id), "a failed flush must not touch the balance")
	assert.Equal(t, 1, pendingBatchRetryCount(), "the failed batch must stay queued for a retry")

	require.NoError(t, DB.AutoMigrate(&BatchQuotaJournal{}))
	batchUpdate()
	assert.Equal(t, 600, getUserQuotaFromDB(t, user.Id))
	assert.Zero(t, pendingBatchRetryCount())
}
