package model

import (
	"context"
	"database/sql"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type failNextEvalRedisHook struct {
	failed atomic.Bool
}

func (hook *failNextEvalRedisHook) BeforeProcess(ctx context.Context, cmd redis.Cmder) (context.Context, error) {
	if cmd.Name() == "eval" && hook.failed.CompareAndSwap(false, true) {
		return ctx, errors.New("injected Redis reconciliation failure")
	}
	return ctx, nil
}

func (*failNextEvalRedisHook) AfterProcess(context.Context, redis.Cmder) error { return nil }

func (*failNextEvalRedisHook) BeforeProcessPipeline(ctx context.Context, _ []redis.Cmder) (context.Context, error) {
	return ctx, nil
}

func (*failNextEvalRedisHook) AfterProcessPipeline(context.Context, []redis.Cmder) error { return nil }

type observeSecondRedisSetHook struct {
	sets      atomic.Int32
	attempted chan struct{}
	once      sync.Once
}

func (hook *observeSecondRedisSetHook) BeforeProcess(ctx context.Context, cmd redis.Cmder) (context.Context, error) {
	if cmd.Name() == "set" && hook.sets.Add(1) == 2 {
		hook.once.Do(func() { close(hook.attempted) })
	}
	return ctx, nil
}

func (*observeSecondRedisSetHook) AfterProcess(context.Context, redis.Cmder) error { return nil }

func (*observeSecondRedisSetHook) BeforeProcessPipeline(ctx context.Context, _ []redis.Cmder) (context.Context, error) {
	return ctx, nil
}

func (*observeSecondRedisSetHook) AfterProcessPipeline(context.Context, []redis.Cmder) error {
	return nil
}

type ambiguousCommitPool struct {
	gorm.ConnPool
}

func (pool *ambiguousCommitPool) BeginTx(ctx context.Context, opts *sql.TxOptions) (gorm.ConnPool, error) {
	beginner, ok := pool.ConnPool.(interface {
		BeginTx(context.Context, *sql.TxOptions) (*sql.Tx, error)
	})
	if !ok {
		return nil, errors.New("test database cannot begin transactions")
	}
	tx, err := beginner.BeginTx(ctx, opts)
	if err != nil {
		return nil, err
	}
	return &ambiguousCommitTx{ConnPool: tx}, nil
}

type ambiguousCommitTx struct {
	gorm.ConnPool
}

func (tx *ambiguousCommitTx) Commit() error {
	if err := tx.ConnPool.(gorm.TxCommitter).Commit(); err != nil {
		return err
	}
	return errors.New("injected ambiguous commit result")
}

func (tx *ambiguousCommitTx) Rollback() error {
	return tx.ConnPool.(gorm.TxCommitter).Rollback()
}

func seedPreparedImageBillingReservation(t *testing.T, suffix string, quota int) (*User, *Token, *Task) {
	t.Helper()
	truncateTables(t)

	user := &User{
		Username: "image-reservation-user-" + suffix,
		Password: "password",
		Quota:    1000,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, DB.Create(user).Error)
	token := &Token{
		UserId:      user.Id,
		Key:         "image-reservation-token-" + suffix,
		Name:        "image reservation",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 1000,
	}
	require.NoError(t, DB.Create(token).Error)

	now := common.GetTimestamp()
	task := &Task{
		TaskID:     "task_image_reservation_" + suffix,
		Platform:   constant.TaskPlatformOpenAIImage,
		UserId:     user.Id,
		Status:     TaskStatusReserving,
		Progress:   "0%",
		SubmitTime: now,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	reservation := &ImageBillingReservation{
		TaskID:        task.TaskID,
		RequestID:     "request-image-reservation-" + suffix,
		UserID:        user.Id,
		TokenID:       token.Id,
		TokenRequired: true,
		ExpectedQuota: quota,
	}
	require.NoError(t, InsertPreparedImageTask(task, nil, reservation))
	return user, token, task
}

func populateImageReservationTestCache(t *testing.T, redisServer interface{ SetTTL(string, time.Duration) }, user *User, token *Token) {
	t.Helper()
	require.NoError(t, populateUserCache(*user))
	require.NoError(t, cacheSetToken(*token))
	redisServer.SetTTL(getUserCacheKey(user.Id), time.Minute)
	redisServer.SetTTL("token:"+common.GenerateHMAC(token.Key), time.Minute)
}

func TestImageBillingReservationWalletTokenRecoveryIsIdempotent(t *testing.T) {
	redisServer := useImageTaskTestRedis(t)
	user, token, task := seedPreparedImageBillingReservation(t, "recover", 100)
	populateImageReservationTestCache(t, redisServer, user, token)

	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 900, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 900, token.RemainQuota)
	assert.Equal(t, 100, token.UsedQuota)
	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 900, cachedUser.Quota)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 900, cachedToken.RemainQuota)

	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, 100, reservation.WalletReserved)
	assert.Equal(t, 100, reservation.TokenReserved)
	assert.Equal(t, "wallet", reservation.FundingSource)

	applied, err := RefundImageBillingReservation(task.TaskID, "submission abandoned")
	require.NoError(t, err)
	require.True(t, applied)
	applied, err = RefundImageBillingReservation(task.TaskID, "duplicate recovery")
	require.NoError(t, err)
	assert.False(t, applied)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)

	reservation, err = GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, ImageBillingReservationRefunded, reservation.Status)
	assert.Zero(t, reservation.WalletReserved)
	assert.Zero(t, reservation.TokenReserved)
	require.NoError(t, DB.First(task, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusFailure), task.Status)
	assert.Equal(t, "submission abandoned", task.FailReason)
	cachedUser, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 1000, cachedUser.Quota)
	cachedToken, err = cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 1000, cachedToken.RemainQuota)
	assert.Empty(t, redisServer.HGet(getUserCacheKey(user.Id), imageReservationCacheField(task.TaskID)))
	assert.Empty(t, redisServer.HGet("token:"+common.GenerateHMAC(token.Key), imageReservationCacheField(task.TaskID)))
	assert.Positive(t, reservation.CacheReconciledAt)
}

func TestImageBillingReservationRefundSchedulesPreparedInputCleanup(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "refund-input-cleanup", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, PersistPreparedImageInputCleanup(task.TaskID, []string{"inputs/reference/refund.png"}))

	applied, err := RefundImageBillingReservation(task.TaskID, "staging failed")
	require.NoError(t, err)
	require.True(t, applied)

	var cleanup ImageInputCleanup
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&cleanup).Error)
	assert.Equal(t, ImageInputCleanupPending, cleanup.Status)
	assert.Positive(t, cleanup.NextAttemptAt)
}

func TestImageBillingReservationRecoversTaggedRedisOnlyDebits(t *testing.T) {
	redisServer := useImageTaskTestRedis(t)
	user, token, task := seedPreparedImageBillingReservation(t, "unrecorded-cache-debit", 100)

	require.NoError(t, populateUserCache(*user))
	require.NoError(t, cacheSetToken(*token))
	redisServer.SetTTL(getUserCacheKey(user.Id), time.Minute)
	redisServer.SetTTL("token:"+common.GenerateHMAC(token.Key), time.Minute)
	// Simulate a process stopping after each atomic cache debit was tagged but
	// before either durable reservation leg was written.
	applied, err := applyImageReservationCacheDebit(
		getUserCacheKey(user.Id),
		imageTaskUserQuotaPinsKey(user.Id),
		"Quota",
		"",
		task.TaskID,
		100,
	)
	require.NoError(t, err)
	require.True(t, applied)
	applied, err = applyImageReservationCacheDebit(
		"token:"+common.GenerateHMAC(token.Key),
		imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key)),
		constant.TokenFiledRemainQuota,
		"UnlimitedQuota",
		task.TaskID,
		100,
	)
	require.NoError(t, err)
	require.True(t, applied)
	redisServer.FastForward(2 * time.Minute)
	assert.True(t, redisServer.Exists(getUserCacheKey(user.Id)))
	assert.True(t, redisServer.Exists("token:"+common.GenerateHMAC(token.Key)))
	assert.True(t, redisServer.Exists(imageTaskUserQuotaPinsKey(user.Id)))
	assert.True(t, redisServer.Exists(imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key))))
	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 900, cachedUser.Quota)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 900, cachedToken.RemainQuota)

	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Zero(t, reservation.WalletReserved)
	assert.Zero(t, reservation.TokenReserved)

	applied, err = RefundImageBillingReservation(task.TaskID, "submission abandoned before database debit")
	require.NoError(t, err)
	require.True(t, applied)
	assert.True(t, redisServer.Exists(getUserCacheKey(user.Id)))
	assert.True(t, redisServer.Exists("token:"+common.GenerateHMAC(token.Key)))
	cachedUser, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 1000, cachedUser.Quota)
	cachedToken, err = cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 1000, cachedToken.RemainQuota)
	reservation, err = GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Positive(t, reservation.CacheReconciledAt)
	assert.False(t, redisServer.Exists(imageTaskUserQuotaPinsKey(user.Id)))
	assert.False(t, redisServer.Exists(imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key))))
}

func TestImageBillingReservationPinsTaggedDebitsAcrossCacheInvalidation(t *testing.T) {
	redisServer := useImageTaskTestRedis(t)
	user, token, task := seedPreparedImageBillingReservation(t, "pinned-invalidation", 100)
	populateImageReservationTestCache(t, redisServer, user, token)

	applied, err := applyImageReservationCacheDebit(
		getUserCacheKey(user.Id),
		imageTaskUserQuotaPinsKey(user.Id),
		"Quota",
		"",
		task.TaskID,
		100,
	)
	require.NoError(t, err)
	require.True(t, applied)
	tokenHMAC := common.GenerateHMAC(token.Key)
	applied, err = applyImageReservationCacheDebit(
		"token:"+tokenHMAC,
		imageTaskTokenQuotaPinsKey(tokenHMAC),
		constant.TokenFiledRemainQuota,
		"UnlimitedQuota",
		task.TaskID,
		100,
	)
	require.NoError(t, err)
	require.True(t, applied)

	require.NoError(t, invalidateUserCache(user.Id))
	require.NoError(t, cacheDeleteToken(token.Key))
	assert.True(t, redisServer.Exists(getUserCacheKey(user.Id)))
	assert.True(t, redisServer.Exists("token:"+tokenHMAC))
	assert.Equal(t, "100", redisServer.HGet(getUserCacheKey(user.Id), imageReservationCacheField(task.TaskID)))
	assert.Equal(t, "100", redisServer.HGet("token:"+tokenHMAC, imageReservationCacheField(task.TaskID)))
	assert.True(t, redisServer.Exists(imageTaskUserQuotaInvalidationKey(user.Id)))
	assert.True(t, redisServer.Exists(imageTaskTokenQuotaInvalidationKey(tokenHMAC)))

	// Retrying the reservation after the invalidation races with the pre-DB
	// cache phase records each durable leg without applying a second cache debit.
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	applied, err = RefundImageBillingReservation(task.TaskID, "recover invalidated reservation")
	require.NoError(t, err)
	require.True(t, applied)

	// The independent invalidations are honored only after the final pin release.
	assert.False(t, redisServer.Exists(getUserCacheKey(user.Id)))
	assert.False(t, redisServer.Exists("token:"+tokenHMAC))
	assert.False(t, redisServer.Exists(imageTaskUserQuotaPinsKey(user.Id)))
	assert.False(t, redisServer.Exists(imageTaskTokenQuotaPinsKey(tokenHMAC)))
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
}

func TestImageBillingReservationReleasePreservesFinalizationPin(t *testing.T) {
	redisServer := useImageTaskTestRedis(t)
	user, _, task := seedPreparedImageBillingReservation(t, "reservation-pin-namespace", 100)
	require.NoError(t, populateUserCache(*user))
	redisServer.SetTTL(getUserCacheKey(user.Id), time.Minute)

	pinsKey := imageTaskUserQuotaPinsKey(user.Id)
	applied, err := applyImageReservationCacheDebit(
		getUserCacheKey(user.Id),
		pinsKey,
		"Quota",
		"",
		task.TaskID,
		100,
	)
	require.NoError(t, err)
	require.True(t, applied)
	require.NoError(t, common.RDB.SAdd(context.Background(), pinsKey, task.TaskID).Err())

	require.NoError(t, releaseImageReservationCacheDebit(
		getUserCacheKey(user.Id),
		pinsKey,
		imageTaskUserQuotaInvalidationKey(user.Id),
		"Quota",
		task.TaskID,
		false,
	))

	reservationPinned, err := redisServer.SIsMember(pinsKey, imageReservationCachePinMember(task.TaskID))
	require.NoError(t, err)
	assert.False(t, reservationPinned)
	finalizationPinned, err := redisServer.SIsMember(pinsKey, task.TaskID)
	require.NoError(t, err)
	assert.True(t, finalizationPinned)
	assert.Equal(t, "900", redisServer.HGet(getUserCacheKey(user.Id), "Quota"))
	assert.Empty(t, redisServer.HGet(getUserCacheKey(user.Id), imageReservationCacheField(task.TaskID)))
}

func TestImageBillingReservationRefundPreservesConcurrentUnrelatedCacheDebits(t *testing.T) {
	redisServer := useImageTaskTestRedis(t)
	user, token, task := seedPreparedImageBillingReservation(t, "concurrent-cache-debit", 100)
	populateImageReservationTestCache(t, redisServer, user, token)

	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, cacheDecrUserQuota(user.Id, 30))
	require.NoError(t, cacheDecrTokenQuota(token.Key, 30))

	applied, err := RefundImageBillingReservation(task.TaskID, "submission abandoned while unrelated debits continue")
	require.NoError(t, err)
	require.True(t, applied)

	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 970, cachedUser.Quota)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 970, cachedToken.RemainQuota)

	tokenHMAC := common.GenerateHMAC(token.Key)
	assert.True(t, redisServer.Exists(getUserCacheKey(user.Id)))
	assert.True(t, redisServer.Exists("token:"+tokenHMAC))
	assert.Empty(t, redisServer.HGet(getUserCacheKey(user.Id), imageReservationCacheField(task.TaskID)))
	assert.Empty(t, redisServer.HGet("token:"+tokenHMAC, imageReservationCacheField(task.TaskID)))
}

func TestImageBillingReservationRefundWaitsForTokenSnapshotLock(t *testing.T) {
	redisServer := useImageTaskTestRedis(t)
	user, token, task := seedPreparedImageBillingReservation(t, "token-snapshot-lock", 100)
	populateImageReservationTestCache(t, redisServer, user, token)
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))

	hook := &observeSecondRedisSetHook{attempted: make(chan struct{})}
	common.RDB.AddHook(hook)
	lockHeld := make(chan struct{})
	releaseLock := make(chan struct{})
	lockDone := make(chan error, 1)
	go func() {
		lockDone <- withTokenQuotaCacheLock(token.Key, func() error {
			close(lockHeld)
			<-releaseLock
			return nil
		})
	}()
	<-lockHeld

	type refundResult struct {
		applied bool
		err     error
	}
	refundDone := make(chan refundResult, 1)
	go func() {
		applied, err := RefundImageBillingReservation(task.TaskID, "wait for token snapshot update")
		refundDone <- refundResult{applied: applied, err: err}
	}()
	<-hook.attempted

	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, ImageBillingReservationPreparing, reservation.Status)
	close(releaseLock)
	require.NoError(t, <-lockDone)
	result := <-refundDone
	require.NoError(t, result.err)
	require.True(t, result.applied)

	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 1000, cachedToken.RemainQuota)
}

func TestImageBillingReservationRetriesCacheReconciliationAfterRedisFailure(t *testing.T) {
	redisServer := useImageTaskTestRedis(t)
	user, token, task := seedPreparedImageBillingReservation(t, "cache-retry", 100)
	populateImageReservationTestCache(t, redisServer, user, token)
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))

	healthyClient := common.RDB
	failedClient := redis.NewClient(&redis.Options{
		Addr: redisServer.Addr(),
	})
	failedClient.AddHook(&failNextEvalRedisHook{})
	common.RDB = failedClient
	applied, err := RefundImageBillingReservation(task.TaskID, "cache temporarily unavailable")
	require.True(t, applied)
	require.ErrorContains(t, err, "restore image wallet reservation cache")
	common.RDB = healthyClient
	require.NoError(t, failedClient.Close())

	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, ImageBillingReservationRefunded, reservation.Status)
	assert.Zero(t, reservation.CacheReconciledAt)

	recovered, err := RecoverStaleImageBillingReservations(common.GetTimestamp(), 10, "retry cache reconciliation")
	require.NoError(t, err)
	assert.Zero(t, recovered)
	reservation, err = GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Positive(t, reservation.CacheReconciledAt)
	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 1000, cachedUser.Quota)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 1000, cachedToken.RemainQuota)
}

func TestActiveImageBillingReservationRetriesCacheReconciliationAfterFixedPriceFinalization(t *testing.T) {
	redisServer := useImageTaskTestRedis(t)
	user, token, task := seedPreparedImageBillingReservation(t, "active-cache-retry", 100)
	populateImageReservationTestCache(t, redisServer, user, token)
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))

	healthyClient := common.RDB
	failedClient := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	failedClient.AddHook(&failNextEvalRedisHook{})
	common.RDB = failedClient
	task.Quota = 100
	activated, err := ActivatePreparedImageTask(task)
	require.NoError(t, err)
	require.True(t, activated)
	common.RDB = healthyClient
	require.NoError(t, failedClient.Close())

	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, ImageBillingReservationActive, reservation.Status)
	assert.Zero(t, reservation.CacheReconciledAt)
	tokenHMAC := common.GenerateHMAC(token.Key)
	assert.Equal(t, tokenHMAC, reservation.TokenCacheKeyHash)
	// Older active rows predate the persisted cache identity. Recovery backfills
	// it before touching Redis so a later token deletion cannot strand the pin.
	require.NoError(t, DB.Model(&ImageBillingReservation{}).
		Where("id = ?", reservation.ID).
		Update("token_cache_key_hash", "").Error)
	assert.Equal(t, "100", redisServer.HGet(getUserCacheKey(user.Id), imageReservationCacheField(task.TaskID)))
	assert.Equal(t, "100", redisServer.HGet("token:"+tokenHMAC, imageReservationCacheField(task.TaskID)))

	// A fixed-price task has no final cache delta, so finalization cannot
	// incidentally release the reservation namespace's tag or pin.
	task.Status = TaskStatusInProgress
	task.Attempt = 1
	task.StartTime = common.GetTimestamp()
	require.NoError(t, DB.Model(task).Select("status", "attempt", "start_time").Updates(task).Error)
	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 100)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	assert.Equal(t, TaskStatus(TaskStatusSuccess), finalized.Task.Status)
	userReservationPinned, err := redisServer.SIsMember(imageTaskUserQuotaPinsKey(user.Id), imageReservationCachePinMember(task.TaskID))
	require.NoError(t, err)
	assert.True(t, userReservationPinned)
	tokenReservationPinned, err := redisServer.SIsMember(imageTaskTokenQuotaPinsKey(tokenHMAC), imageReservationCachePinMember(task.TaskID))
	require.NoError(t, err)
	assert.True(t, tokenReservationPinned)

	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("updated_at", int64(1)).Error)
	assert.True(t, HasStaleImageBillingReservations(common.GetTimestamp()))
	recovered, err := RecoverStaleImageBillingReservations(common.GetTimestamp(), 10, "retry active cache reconciliation")
	require.NoError(t, err)
	assert.Zero(t, recovered)

	reservation, err = GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Positive(t, reservation.CacheReconciledAt)
	assert.Equal(t, tokenHMAC, reservation.TokenCacheKeyHash)
	assert.Empty(t, redisServer.HGet(getUserCacheKey(user.Id), imageReservationCacheField(task.TaskID)))
	assert.Empty(t, redisServer.HGet("token:"+tokenHMAC, imageReservationCacheField(task.TaskID)))
	assert.False(t, redisServer.Exists(imageTaskUserQuotaPinsKey(user.Id)))
	assert.False(t, redisServer.Exists(imageTaskTokenQuotaPinsKey(tokenHMAC)))
	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 900, cachedUser.Quota)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 900, cachedToken.RemainQuota)
}

func TestImageBillingReservationKeepsTaggedDebitWhenCommitResultIsAmbiguous(t *testing.T) {
	redisServer := useImageTaskTestRedis(t)
	user, token, task := seedPreparedImageBillingReservation(t, "ambiguous-commit", 100)
	populateImageReservationTestCache(t, redisServer, user, token)

	originalDB := DB
	t.Cleanup(func() { DB = originalDB })
	faultDB := originalDB.Session(&gorm.Session{NewDB: true, Context: context.Background()})
	faultPool := &ambiguousCommitPool{ConnPool: originalDB.Config.ConnPool}
	faultDB.Config.ConnPool = faultPool
	faultDB.Statement.ConnPool = faultPool
	DB = faultDB
	err := ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100)
	DB = originalDB
	require.ErrorContains(t, err, "injected ambiguous commit result")

	// The database commit succeeded even though its result was reported as an
	// error. The tagged Redis debit must remain until terminal recovery decides
	// whether the durable leg exists.
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 900, user.Quota)
	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, 100, reservation.WalletReserved)
	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 900, cachedUser.Quota)
	assert.Equal(t, "100", redisServer.HGet(getUserCacheKey(user.Id), imageReservationCacheField(task.TaskID)))

	applied, err := RefundImageBillingReservation(task.TaskID, "recover ambiguous commit")
	require.NoError(t, err)
	require.True(t, applied)
	cachedUser, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 1000, cachedUser.Quota)
}

func TestImageBillingReservationRefundsSoftDeletedTokenLedger(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "soft-deleted-token", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, DB.Delete(token).Error)

	applied, err := RefundImageBillingReservation(task.TaskID, "submission abandoned")
	require.NoError(t, err)
	require.True(t, applied)

	var storedToken Token
	require.NoError(t, DB.Unscoped().First(&storedToken, token.Id).Error)
	assert.True(t, storedToken.DeletedAt.Valid)
	assert.Equal(t, 1000, storedToken.RemainQuota)
	assert.Zero(t, storedToken.UsedQuota)
}

func TestImageBillingReservationRefundsSoftDeletedUserLedger(t *testing.T) {
	user, _, task := seedPreparedImageBillingReservation(t, "soft-deleted-user", 100)
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, DB.Delete(user).Error)

	applied, err := RefundImageBillingReservation(task.TaskID, "submission abandoned")
	require.NoError(t, err)
	require.True(t, applied)

	var storedUser User
	require.NoError(t, DB.Unscoped().First(&storedUser, user.Id).Error)
	assert.True(t, storedUser.DeletedAt.Valid)
	assert.Equal(t, 1000, storedUser.Quota)
}

func TestRefundImageTaskWalletQuotaDoesNotClearLedgerWhenUserIsHardDeleted(t *testing.T) {
	user, _, task := seedPreparedImageBillingReservation(t, "missing-user", 100)
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, DB.Unscoped().Delete(user).Error)

	err := RefundImageTaskWalletQuota(task.TaskID, user.Id)
	require.ErrorContains(t, err, "image wallet reservation refund lost")
	reservation, lookupErr := GetImageBillingReservation(task.TaskID)
	require.NoError(t, lookupErr)
	assert.Equal(t, ImageBillingReservationPreparing, reservation.Status)
	assert.Equal(t, 100, reservation.WalletReserved)
}

func TestImageBillingReservationDoesNotClearLedgerWhenTokenIsHardDeleted(t *testing.T) {
	_, token, task := seedPreparedImageBillingReservation(t, "missing-token", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, DB.Unscoped().Delete(token).Error)

	applied, err := RefundImageBillingReservation(task.TaskID, "submission abandoned")
	require.ErrorContains(t, err, "image token reservation refund lost")
	assert.False(t, applied)

	reservation, lookupErr := GetImageBillingReservation(task.TaskID)
	require.NoError(t, lookupErr)
	assert.Equal(t, ImageBillingReservationPreparing, reservation.Status)
	assert.Equal(t, 100, reservation.TokenReserved)
}

func TestImageBillingReservationActivationPreventsRecovery(t *testing.T) {
	redisServer := useImageTaskTestRedis(t)
	user, token, task := seedPreparedImageBillingReservation(t, "activate", 100)
	populateImageReservationTestCache(t, redisServer, user, token)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))

	task.Quota = 100
	task.Action = constant.TaskActionGenerate
	task.PrivateData.TokenBillingEnabled = true
	activated, err := ActivatePreparedImageTask(task)
	require.NoError(t, err)
	require.True(t, activated)
	activated, err = ActivatePreparedImageTask(task)
	require.NoError(t, err)
	assert.False(t, activated)

	applied, err := RefundImageBillingReservation(task.TaskID, "must not refund active task")
	require.NoError(t, err)
	assert.False(t, applied)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 900, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 900, token.RemainQuota)
	assert.Equal(t, 100, token.UsedQuota)
	require.NoError(t, DB.First(task, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusNotStart), task.Status)
	assert.Equal(t, "wallet", task.PrivateData.BillingSource)
	assert.Equal(t, 100, task.PrivateData.TokenPreConsumed)

	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, ImageBillingReservationActive, reservation.Status)
	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 900, cachedUser.Quota)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 900, cachedToken.RemainQuota)
	assert.Empty(t, redisServer.HGet(getUserCacheKey(user.Id), imageReservationCacheField(task.TaskID)))
	assert.Empty(t, redisServer.HGet("token:"+common.GenerateHMAC(token.Key), imageReservationCacheField(task.TaskID)))
}

func TestImageBillingReservationActivationRequiresTokenLeg(t *testing.T) {
	user, _, task := seedPreparedImageBillingReservation(t, "missing-token", 100)
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	task.Quota = 100

	activated, err := ActivatePreparedImageTask(task)
	require.ErrorContains(t, err, "token reservation is incomplete")
	assert.False(t, activated)

	reservation, lookupErr := GetImageBillingReservation(task.TaskID)
	require.NoError(t, lookupErr)
	assert.Equal(t, ImageBillingReservationPreparing, reservation.Status)
	require.NoError(t, DB.First(task, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusReserving), task.Status)
}

func TestImageBillingReservationActivationRequiresFundingLeg(t *testing.T) {
	_, token, task := seedPreparedImageBillingReservation(t, "missing-funding", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	task.Quota = 100

	activated, err := ActivatePreparedImageTask(task)
	require.ErrorContains(t, err, "funding reservation is incomplete")
	assert.False(t, activated)
}

func TestImageBillingReservationAllowsFreeActivationWithoutQuotaLegs(t *testing.T) {
	_, _, task := seedPreparedImageBillingReservation(t, "free", 0)
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("token_required", false).Error)
	task.Quota = 0

	activated, err := ActivatePreparedImageTask(task)
	require.NoError(t, err)
	require.True(t, activated)
	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, ImageBillingReservationActive, reservation.Status)
}

func TestImageBillingReservationUpgradesZeroEstimateForSubscriptionMinimum(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "subscription-minimum", 0)
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("token_required", false).Error)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Title:            "Minimum Reservation Plan",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	require.NoError(t, DB.Create(plan).Error)
	subscription := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 1000,
		StartTime:   now - 60,
		EndTime:     now + 3600,
		Status:      "active",
	}
	require.NoError(t, DB.Create(subscription).Error)
	requestID := "request-subscription-minimum"
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("request_id", requestID).Error)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 1))
	_, err := PreConsumeImageTaskSubscription(task.TaskID, requestID, user.Id, "gpt-image-1", 0, 1)
	require.NoError(t, err)
	task.Quota = 1

	activated, err := ActivatePreparedImageTask(task)
	require.NoError(t, err)
	require.True(t, activated)
	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, 1, reservation.ExpectedQuota)
	assert.True(t, reservation.TokenRequired)
	assert.True(t, task.PrivateData.TokenBillingEnabled)
	assert.Equal(t, 1, task.PrivateData.TokenPreConsumed)
}

func TestImageBillingReservationFailedDebitRollsBackLedgerClaim(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "insufficient", 1100)

	err := ReserveImageTaskWalletQuota(task.TaskID, user.Id, 1100)
	require.ErrorContains(t, err, "user quota is not enough")
	err = ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 1100)
	require.ErrorContains(t, err, "token quota is not enough")

	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Zero(t, reservation.WalletReserved)
	assert.Zero(t, reservation.TokenReserved)
	assert.Empty(t, reservation.FundingSource)
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}

func TestImageBillingReservationPreservesUnlimitedTokenCacheSemantics(t *testing.T) {
	redisServer := useImageTaskTestRedis(t)
	user, token, task := seedPreparedImageBillingReservation(t, "unlimited-token", 100)
	require.NoError(t, DB.Model(token).Updates(map[string]any{
		"unlimited_quota": true,
		"remain_quota":    0,
	}).Error)
	require.NoError(t, DB.First(token, token.Id).Error)
	populateImageReservationTestCache(t, redisServer, user, token)

	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.True(t, cachedToken.UnlimitedQuota)
	assert.Equal(t, -100, cachedToken.RemainQuota)

	applied, err := RefundImageBillingReservation(task.TaskID, "unlimited reservation abandoned")
	require.NoError(t, err)
	require.True(t, applied)
	cachedToken, err = cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.True(t, cachedToken.UnlimitedQuota)
	assert.Zero(t, cachedToken.RemainQuota)
}

func TestImageBillingReservationSubscriptionRecoveryIsIdempotent(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "subscription", 100)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Title:            "Image Plan",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	require.NoError(t, DB.Create(plan).Error)
	subscription := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 1000,
		StartTime:   now - 60,
		EndTime:     now + 3600,
		Status:      "active",
	}
	require.NoError(t, DB.Create(subscription).Error)

	requestID := "request-image-reservation-subscription"
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("request_id", requestID).Error)
	first, err := PreConsumeImageTaskSubscription(task.TaskID, requestID, user.Id, "gpt-image-1", 0, 100)
	require.NoError(t, err)
	second, err := PreConsumeImageTaskSubscription(task.TaskID, requestID, user.Id, "gpt-image-1", 0, 100)
	require.NoError(t, err)
	assert.Equal(t, first.UserSubscriptionId, second.UserSubscriptionId)
	assert.EqualValues(t, 100, second.PreConsumed)

	require.NoError(t, DB.First(subscription, subscription.Id).Error)
	assert.EqualValues(t, 100, subscription.AmountUsed)
	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, "subscription", reservation.FundingSource)
	assert.EqualValues(t, 100, reservation.SubscriptionReserved)
	err = ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100)
	require.ErrorContains(t, err, "conflicting image wallet reservation")
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)

	applied, err := RefundImageBillingReservation(task.TaskID, "stale subscription submission")
	require.NoError(t, err)
	require.True(t, applied)
	applied, err = RefundImageBillingReservation(task.TaskID, "duplicate stale recovery")
	require.NoError(t, err)
	assert.False(t, applied)

	require.NoError(t, DB.First(subscription, subscription.Id).Error)
	assert.Zero(t, subscription.AmountUsed)
	var record SubscriptionPreConsumeRecord
	require.NoError(t, DB.Where("request_id = ?", requestID).First(&record).Error)
	assert.Equal(t, "refunded", record.Status)

	// Subscription funding does not touch the wallet, and the token leg was not
	// reserved in this focused model test.
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
}

func TestImageBillingReservationRejectsSubscriptionAfterWalletFunding(t *testing.T) {
	user, _, task := seedPreparedImageBillingReservation(t, "wallet-then-subscription", 75)
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 75))
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Title:            "Conflicting Plan",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	require.NoError(t, DB.Create(plan).Error)
	subscription := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 1000,
		StartTime:   now - 60,
		EndTime:     now + 3600,
		Status:      "active",
	}
	require.NoError(t, DB.Create(subscription).Error)
	requestID := "request-wallet-then-subscription"
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("request_id", requestID).Error)

	_, err := PreConsumeImageTaskSubscription(task.TaskID, requestID, user.Id, "gpt-image-1", 0, 75)
	require.ErrorContains(t, err, "already uses wallet funding")
	require.NoError(t, DB.First(subscription, subscription.Id).Error)
	assert.Zero(t, subscription.AmountUsed)
}

func TestRecoverStaleImageBillingReservationsOnlyClaimsDuePreparingRows(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "stale", 50)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 50))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 50))
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("updated_at", int64(100)).Error)

	recovered, err := RecoverStaleImageBillingReservations(200, 10, "reservation timed out")
	require.NoError(t, err)
	assert.Equal(t, 1, recovered)
	recovered, err = RecoverStaleImageBillingReservations(200, 10, "second pass")
	require.NoError(t, err)
	assert.Zero(t, recovered)
}

func TestFullImageBillingRefundReportsOnlyLegsStillReserved(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "partial-full", 80)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 80))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 80))
	require.NoError(t, RefundImageTaskWalletQuota(task.TaskID, user.Id))

	applied, walletRefunded, tokenRefunded, err := refundImageBillingReservationDB(task.TaskID, "finish partial refund")
	require.NoError(t, err)
	require.True(t, applied)
	assert.Zero(t, walletRefunded)
	assert.Equal(t, 80, tokenRefunded)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}
