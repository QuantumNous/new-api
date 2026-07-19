package model

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func seedBillingAdjustmentOutboxState(t *testing.T, suffix string) (*User, *Token) {
	t.Helper()
	user := &User{
		Username: "billing-adjustment-user-" + suffix,
		Quota:    80,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(user).Error)
	token := &Token{
		UserId:      user.Id,
		Key:         "billing-adjustment-token-" + suffix,
		Name:        "billing-adjustment",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 80,
		UsedQuota:   20,
	}
	require.NoError(t, DB.Create(token).Error)
	require.NoError(t, populateUserCache(*user))
	require.NoError(t, cacheSetToken(*token))
	require.NoError(t, common.RDB.SAdd(context.Background(), imageTaskUserQuotaPinsKey(user.Id), "active-task").Err())
	require.NoError(t, common.RDB.SAdd(context.Background(), imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key)), "active-task").Err())
	return user, token
}

func TestBillingAdjustmentOutboxRetriesUnavailableRedisAndAppliesLegsExactlyOnce(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)
	user, token := seedBillingAdjustmentOutboxState(t, "retry")

	rows, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{
		{
			RequestID: "billing-adjustment-retry",
			Phase:     BillingAdjustmentPhaseSettle,
			Leg:       BillingAdjustmentLegWallet,
			UserID:    user.Id,
			Delta:     -10,
		},
		{
			RequestID: "billing-adjustment-retry",
			Phase:     BillingAdjustmentPhaseSettle,
			Leg:       BillingAdjustmentLegToken,
			UserID:    user.Id,
			TokenID:   token.Id,
			Delta:     -10,
		},
	})
	require.NoError(t, err)
	require.Len(t, rows, 2)

	redisClient := common.RDB
	common.RDB = nil
	for i := range rows {
		require.Error(t, ProcessBillingAdjustmentOutbox(rows[i].Id))
	}
	common.RDB = redisClient

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 80, storedUser.Quota)
	var storedToken Token
	require.NoError(t, DB.First(&storedToken, token.Id).Error)
	assert.Equal(t, 80, storedToken.RemainQuota)

	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where("request_id = ?", "billing-adjustment-retry").Updates(map[string]interface{}{
		"next_attempt_at": 0,
		"lease_until":     0,
	}).Error)
	for i := range rows {
		require.NoError(t, ProcessBillingAdjustmentOutbox(rows[i].Id))
		require.NoError(t, ProcessBillingAdjustmentOutbox(rows[i].Id))
	}

	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 70, storedUser.Quota)
	require.NoError(t, DB.First(&storedToken, token.Id).Error)
	assert.Equal(t, 70, storedToken.RemainQuota)
	assert.Equal(t, 30, storedToken.UsedQuota)
	rawUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 70, rawUser.Quota)
	rawToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 70, rawToken.RemainQuota)

	duplicates, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{
		{RequestID: "billing-adjustment-retry", Phase: BillingAdjustmentPhaseSettle, Leg: BillingAdjustmentLegWallet, UserID: user.Id, Delta: -10},
		{RequestID: "billing-adjustment-retry", Phase: BillingAdjustmentPhaseSettle, Leg: BillingAdjustmentLegToken, UserID: user.Id, TokenID: token.Id, Delta: -10},
	})
	require.NoError(t, err)
	require.Len(t, duplicates, 2)
	var count int64
	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where("request_id = ?", "billing-adjustment-retry").Count(&count).Error)
	assert.EqualValues(t, 2, count)
}

func TestBillingAdjustmentOutboxReplayAfterCacheAppliedDoesNotDoubleDelta(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)
	user, _ := seedBillingAdjustmentOutboxState(t, "ambiguous-cache")

	rows, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{{
		RequestID: "billing-adjustment-ambiguous-cache",
		Phase:     BillingAdjustmentPhaseRefund,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     20,
	}})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	claimed, ok, err := claimBillingAdjustmentOutbox(rows[0].Id, common.GetTimestamp())
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, withUserQuotaCacheLock(user.Id, func() error {
		if err := applyBillingAdjustmentDatabase(claimed); err != nil {
			return err
		}
		return applyBillingAdjustmentCache(claimed, "")
	}))

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 100, storedUser.Quota)
	raw, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 100, raw.Quota)

	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where("id = ?", claimed.Id).Updates(map[string]interface{}{
		"lease_until":     0,
		"next_attempt_at": 0,
	}).Error)
	require.NoError(t, ProcessBillingAdjustmentOutbox(claimed.Id))
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 100, storedUser.Quota)
	raw, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 100, raw.Quota)

	var delivered BillingAdjustmentOutbox
	require.NoError(t, DB.First(&delivered, claimed.Id).Error)
	assert.True(t, delivered.DBApplied)
	assert.True(t, delivered.CacheApplied)
	assert.Equal(t, billingAdjustmentDelivered, delivered.Status)
}

func TestBillingAdjustmentOutboxRejectsIdempotencyConflict(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)
	user, _ := seedBillingAdjustmentOutboxState(t, "conflict")

	_, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{{
		RequestID: "billing-adjustment-conflict",
		Phase:     BillingAdjustmentPhaseSettle,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     -10,
	}})
	require.NoError(t, err)
	_, err = EnqueueBillingAdjustments([]BillingAdjustmentSpec{{
		RequestID: "billing-adjustment-conflict",
		Phase:     BillingAdjustmentPhaseSettle,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     -20,
	}})
	require.ErrorContains(t, err, "idempotency conflict")
}

func TestImmediateDebitOwnerCannotBeClaimedOrAppliedByBackgroundWorker(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

	user := User{Username: "immediate-owned-user", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)

	row, err := enqueueOwnedImmediateBillingAdjustment(BillingAdjustmentSpec{
		RequestID: "immediate-owned-debit",
		Phase:     BillingAdjustmentPhaseDirect,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     -30,
	})
	require.NoError(t, err)
	assert.Equal(t, billingAdjustmentOwned, row.Status)
	assert.NotEmpty(t, row.LeaseToken)

	claimed, ok, err := claimBillingAdjustmentOutbox(row.Id, common.GetTimestamp())
	require.NoError(t, err)
	require.False(t, ok)
	assert.Equal(t, billingAdjustmentOwned, claimed.Status)

	workerErr := make(chan error, 1)
	go func() {
		workerErr <- ProcessBillingAdjustmentOutbox(row.Id)
	}()
	require.NoError(t, <-workerErr)
	require.NoError(t, cancelOwnedUnappliedBillingAdjustment(row, errors.New("caller failed before dispatch")))

	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where("id = ?", row.Id).Update("next_attempt_at", 0).Error)
	require.NoError(t, ProcessBillingAdjustmentOutbox(row.Id))

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 100, storedUser.Quota)
	var storedRow BillingAdjustmentOutbox
	require.NoError(t, DB.First(&storedRow, row.Id).Error)
	assert.False(t, storedRow.DBApplied)
	assert.Equal(t, billingAdjustmentFailed, storedRow.Status)
}

func TestImmediateDebitDatabaseApplyAtomicallyReleasesOwner(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

	user := User{Username: "immediate-applied-user", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)

	row, err := enqueueOwnedImmediateBillingAdjustment(BillingAdjustmentSpec{
		RequestID: "immediate-applied-debit",
		Phase:     BillingAdjustmentPhaseDirect,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     -30,
	})
	require.NoError(t, err)
	require.NoError(t, applyOwnedBillingAdjustmentDatabase(row))

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 70, storedUser.Quota)
	var storedRow BillingAdjustmentOutbox
	require.NoError(t, DB.First(&storedRow, row.Id).Error)
	assert.True(t, storedRow.DBApplied)
	assert.Equal(t, billingAdjustmentProcessing, storedRow.Status)
	assert.Equal(t, row.LeaseToken, storedRow.LeaseToken)

	require.ErrorIs(t, cancelOwnedUnappliedBillingAdjustment(row, errors.New("late caller failure")), gorm.ErrRecordNotFound)
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 70, storedUser.Quota)
}

func TestImmediateDebitTransactionFailureDoesNotMarkInMemoryApplied(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

	user := User{Username: "immediate-rollback-user", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	row, err := enqueueOwnedImmediateBillingAdjustment(BillingAdjustmentSpec{
		RequestID: "immediate-rollback-debit",
		Phase:     BillingAdjustmentPhaseDirect,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     -30,
	})
	require.NoError(t, err)

	require.NoError(t, DB.Exec(`
		CREATE TRIGGER fail_immediate_outbox_apply
		BEFORE UPDATE OF db_applied ON billing_adjustment_outboxes
		WHEN NEW.db_applied = 1
		BEGIN
			SELECT RAISE(ABORT, 'forced outbox apply failure');
		END
	`).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Exec("DROP TRIGGER IF EXISTS fail_immediate_outbox_apply").Error)
	})

	require.ErrorContains(t, applyOwnedBillingAdjustmentDatabase(row), "forced outbox apply failure")
	assert.False(t, row.DBApplied)
	assert.Equal(t, billingAdjustmentOwned, row.Status)

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 100, storedUser.Quota)
	var storedRow BillingAdjustmentOutbox
	require.NoError(t, DB.First(&storedRow, row.Id).Error)
	assert.False(t, storedRow.DBApplied)
	assert.Equal(t, billingAdjustmentOwned, storedRow.Status)
	require.NoError(t, cancelOwnedUnappliedBillingAdjustment(row, errors.New("transaction rolled back")))
}

func TestImmediateDebitFailureCannotBeRetriedIntoALaterDebit(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)

	user := User{Username: "immediate-failed-user", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))

	healthyRedis := common.RDB
	common.RDB = nil
	err := ApplyImmediateBillingAdjustment(BillingAdjustmentSpec{
		RequestID: "immediate-failed-debit",
		Phase:     BillingAdjustmentPhaseDirect,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     -30,
	})
	require.Error(t, err)
	common.RDB = healthyRedis

	var row BillingAdjustmentOutbox
	require.NoError(t, DB.Where("request_id = ?", "immediate-failed-debit").First(&row).Error)
	assert.False(t, row.DBApplied)
	assert.Equal(t, billingAdjustmentFailed, row.Status)
	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where("id = ?", row.Id).Updates(map[string]interface{}{
		"next_attempt_at": 0,
		"lease_until":     0,
	}).Error)
	require.NoError(t, ProcessBillingAdjustmentOutbox(row.Id))
	processed, failed, drainErr := DrainDueBillingAdjustmentOutbox(10)
	require.NoError(t, drainErr)
	assert.Zero(t, processed)
	assert.Zero(t, failed)

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 100, storedUser.Quota)
}

func TestBillingAdjustmentOutboxNormalizesOversizedRequestID(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)
	user, _ := seedBillingAdjustmentOutboxState(t, "oversized-id")
	requestID := "topup:" + strings.Repeat("provider-reference-", 20)

	rows, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{{
		RequestID: requestID,
		Phase:     BillingAdjustmentPhaseExternalCredit,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     10,
	}})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Len(t, rows[0].RequestID, billingAdjustmentRequestIDMax)
	assert.Equal(t, NormalizeBillingAdjustmentRequestID(requestID), rows[0].RequestID)

	duplicate, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{{
		RequestID: requestID,
		Phase:     BillingAdjustmentPhaseExternalCredit,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     10,
	}})
	require.NoError(t, err)
	require.Len(t, duplicate, 1)
	assert.Equal(t, rows[0].Id, duplicate[0].Id)
}

func TestBillingAdjustmentCreditPreservesImageReservationHeadroom(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

	user := User{Username: "billing-headroom-user", Quota: common.MaxQuota - 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	token := Token{
		UserId:      user.Id,
		Key:         "billing-headroom-token",
		Name:        "billing-headroom",
		Status:      common.TokenStatusEnabled,
		RemainQuota: common.MaxQuota - 100,
		UsedQuota:   100,
	}
	require.NoError(t, DB.Create(&token).Error)
	reservation := ImageBillingReservation{
		TaskID:         "billing-headroom-image",
		UserID:         user.Id,
		TokenID:        token.Id,
		WalletReserved: 100,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}
	require.NoError(t, DB.Create(&reservation).Error)
	task := Task{
		TaskID:   reservation.TaskID,
		Platform: constant.TaskPlatformOpenAIImage,
		UserId:   user.Id,
		Status:   TaskStatusInProgress,
	}
	require.NoError(t, DB.Create(&task).Error)

	rows, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{
		{
			RequestID: "billing-headroom-credit",
			Phase:     BillingAdjustmentPhaseExternalCredit,
			Leg:       BillingAdjustmentLegWallet,
			UserID:    user.Id,
			Delta:     100,
		},
		{
			RequestID: "billing-headroom-credit",
			Phase:     BillingAdjustmentPhaseExternalCredit,
			Leg:       BillingAdjustmentLegToken,
			UserID:    user.Id,
			TokenID:   token.Id,
			Delta:     100,
		},
	})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	for i := range rows {
		err := ProcessBillingAdjustmentOutbox(rows[i].Id)
		require.ErrorIs(t, err, ErrBillingAdjustmentBalanceBlocked)
	}

	require.NoError(t, DB.First(&user, user.Id).Error)
	require.NoError(t, DB.First(&token, token.Id).Error)
	assert.Equal(t, common.MaxQuota-100, user.Quota)
	assert.Equal(t, common.MaxQuota-100, token.RemainQuota)
	assert.Equal(t, 100, token.UsedQuota)

	// Terminal image tasks retain their active reservation row for audit, but
	// it no longer represents a future refund liability.
	require.NoError(t, DB.Model(&Task{}).Where("id = ?", task.ID).Update("status", TaskStatusSuccess).Error)
	for i := range rows {
		require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Where("id = ?", rows[i].Id).Update("next_attempt_at", 0).Error)
		require.NoError(t, ProcessBillingAdjustmentOutbox(rows[i].Id))
	}

	require.NoError(t, DB.First(&user, user.Id).Error)
	require.NoError(t, DB.First(&token, token.Id).Error)
	assert.Equal(t, common.MaxQuota, user.Quota)
	assert.Equal(t, common.MaxQuota, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}

func TestCleanupTerminalBillingAdjustmentOutboxPreservesActiveRows(t *testing.T) {
	truncateTables(t)

	now := common.GetTimestamp()
	old := now - 46*24*60*60
	shortExpired := now - 7*60*60
	recent := now - 60
	rows := []BillingAdjustmentOutbox{
		{RequestID: "cleanup-delivered", Phase: BillingAdjustmentPhaseDirect, Leg: BillingAdjustmentLegWallet, UserID: 1, Delta: -1, DBApplied: true, CacheApplied: true, Status: billingAdjustmentDelivered, CreatedAt: old, UpdatedAt: old},
		{RequestID: "cleanup-failed", Phase: BillingAdjustmentPhaseDirect, Leg: BillingAdjustmentLegWallet, UserID: 2, Delta: -1, Status: billingAdjustmentFailed, CreatedAt: old, UpdatedAt: old},
		{RequestID: "cleanup-recent", Phase: BillingAdjustmentPhaseDirect, Leg: BillingAdjustmentLegWallet, UserID: 3, Delta: -1, DBApplied: true, CacheApplied: true, Status: billingAdjustmentDelivered, CreatedAt: recent, UpdatedAt: recent},
		{RequestID: "cleanup-short-expired", Phase: BillingAdjustmentPhaseSettle, Leg: BillingAdjustmentLegWallet, UserID: 8, Delta: -1, DBApplied: true, CacheApplied: true, Status: billingAdjustmentDelivered, CreatedAt: shortExpired, UpdatedAt: shortExpired},
		{RequestID: "cleanup-reserve-rollback", Phase: BillingAdjustmentPhaseReserveRollback, Leg: BillingAdjustmentLegWallet, UserID: 11, Delta: 1, DBApplied: true, CacheApplied: true, Status: billingAdjustmentDelivered, CreatedAt: shortExpired, UpdatedAt: shortExpired},
		{RequestID: "cleanup-long-retained", Phase: BillingAdjustmentPhaseExternalCredit, Leg: BillingAdjustmentLegWallet, UserID: 9, Delta: 1, DBApplied: true, CacheApplied: true, Status: billingAdjustmentDelivered, CreatedAt: shortExpired, UpdatedAt: shortExpired},
		{RequestID: "cleanup-long-expired", Phase: BillingAdjustmentPhaseExternalCredit, Leg: BillingAdjustmentLegWallet, UserID: 10, Delta: 1, DBApplied: true, CacheApplied: true, Status: billingAdjustmentDelivered, CreatedAt: old, UpdatedAt: old},
		{RequestID: "cleanup-pending", Phase: BillingAdjustmentPhaseDirect, Leg: BillingAdjustmentLegWallet, UserID: 4, Delta: -1, Status: billingAdjustmentPending, CreatedAt: old, UpdatedAt: old},
		{RequestID: "cleanup-retry", Phase: BillingAdjustmentPhaseDirect, Leg: BillingAdjustmentLegWallet, UserID: 5, Delta: -1, Status: billingAdjustmentRetry, CreatedAt: old, UpdatedAt: old},
		{RequestID: "cleanup-processing", Phase: BillingAdjustmentPhaseDirect, Leg: BillingAdjustmentLegWallet, UserID: 6, Delta: -1, Status: billingAdjustmentProcessing, CreatedAt: old, UpdatedAt: old},
		{RequestID: "cleanup-owned", Phase: BillingAdjustmentPhaseDirect, Leg: BillingAdjustmentLegWallet, UserID: 7, Delta: -1, Status: billingAdjustmentOwned, CreatedAt: old, UpdatedAt: old},
	}
	require.NoError(t, DB.Create(&rows).Error)

	shortCutoff := now - 6*60*60
	longCutoff := now - 45*24*60*60
	deleted, err := CleanupTerminalBillingAdjustmentOutbox(shortCutoff, longCutoff, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 1, deleted)
	deleted, err = CleanupTerminalBillingAdjustmentOutbox(shortCutoff, longCutoff, 500)
	require.NoError(t, err)
	assert.EqualValues(t, 4, deleted)

	var remaining []BillingAdjustmentOutbox
	require.NoError(t, DB.Order("request_id ASC").Find(&remaining).Error)
	remainingIDs := make([]string, 0, len(remaining))
	for _, row := range remaining {
		remainingIDs = append(remainingIDs, row.RequestID)
	}
	assert.ElementsMatch(t, []string{
		"cleanup-long-retained",
		"cleanup-owned",
		"cleanup-pending",
		"cleanup-processing",
		"cleanup-recent",
		"cleanup-retry",
	}, remainingIDs)
}

func TestBillingAdjustmentCacheOperationKeyDoesNotCollideAfterRowReuse(t *testing.T) {
	row := &BillingAdjustmentOutbox{
		Id:        42,
		CreatedAt: 100,
		RequestID: "request-a",
		Phase:     BillingAdjustmentPhaseDirect,
		Leg:       BillingAdjustmentLegWallet,
	}
	key := billingAdjustmentCacheOperationKey(row)
	assert.Equal(t, key, billingAdjustmentCacheOperationKey(row))

	reused := *row
	reused.CreatedAt = 200
	reused.RequestID = "request-b"
	assert.NotEqual(t, key, billingAdjustmentCacheOperationKey(&reused))
}

func TestBillingAdjustmentOperationMarkerLifecycleFollowsDurableAcknowledgement(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	user, _ := seedBillingAdjustmentOutboxState(t, "marker-lifecycle")

	deliveredRows, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{{
		RequestID: "marker-delivered",
		Phase:     BillingAdjustmentPhaseDirect,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     -5,
	}})
	require.NoError(t, err)
	require.Len(t, deliveredRows, 1)
	deliveredKey := billingAdjustmentCacheOperationKey(&deliveredRows[0])
	require.NoError(t, ProcessBillingAdjustmentOutbox(deliveredRows[0].Id))
	assert.False(t, redisServer.Exists(deliveredKey))

	retryRows, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{{
		RequestID: "marker-retry",
		Phase:     BillingAdjustmentPhaseDirect,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     -5,
	}})
	require.NoError(t, err)
	require.Len(t, retryRows, 1)
	retryKey := billingAdjustmentCacheOperationKey(&retryRows[0])
	require.NoError(t, DB.Exec(`
		CREATE TRIGGER fail_billing_adjustment_delivery_ack
		BEFORE UPDATE ON billing_adjustment_outboxes
		WHEN NEW.status = 'delivered'
		BEGIN
			SELECT RAISE(FAIL, 'forced delivery acknowledgement failure');
		END
	`).Error)
	t.Cleanup(func() {
		DB.Exec("DROP TRIGGER IF EXISTS fail_billing_adjustment_delivery_ack")
	})

	require.Error(t, ProcessBillingAdjustmentOutbox(retryRows[0].Id))
	assert.True(t, redisServer.Exists(retryKey))

	var stored BillingAdjustmentOutbox
	require.NoError(t, DB.First(&stored, retryRows[0].Id).Error)
	assert.Equal(t, billingAdjustmentRetry, stored.Status)
	assert.True(t, stored.DBApplied)
	assert.False(t, stored.CacheApplied)
}
