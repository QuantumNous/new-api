package model

import (
	"math"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestImageTaskBillingLogRequestIDDoesNotTruncateLongTaskIdentity(t *testing.T) {
	prefix := strings.Repeat("provider-task-prefix-", 8)
	first := imageTaskBillingLogRequestID(prefix + "first")
	second := imageTaskBillingLogRequestID(prefix + "second")

	assert.Len(t, first, billingAdjustmentRequestIDMax)
	assert.Len(t, second, billingAdjustmentRequestIDMax)
	assert.NotEqual(t, first, second)
}

func TestFinalizeImageTaskEnqueuesAndDeliversBillingLogIdempotently(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "billing-outbox", 100)
	task.Properties.OriginModelName = "gpt-image-2"
	require.NoError(t, DB.Model(task).Update("properties", task.Properties).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)

	var outbox ImageTaskBillingLogOutbox
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&outbox).Error)
	assert.Equal(t, imageTaskBillingLogPending, outbox.Status)
	assert.Equal(t, user.Id, outbox.UserID)
	assert.Equal(t, token.Id, outbox.TokenID)

	require.NoError(t, DeliverImageTaskBillingLogOutbox(task.TaskID))
	var delivered ImageTaskBillingLogOutbox
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&delivered).Error)
	assert.Equal(t, imageTaskBillingLogDelivered, delivered.Status)
	var logs []Log
	require.NoError(t, DB.Where("request_id = ?", outbox.RequestID).Find(&logs).Error)
	assert.Len(t, logs, 1)
	require.NoError(t, DeliverImageTaskBillingLogOutbox(task.TaskID))
	require.NoError(t, DB.Where("request_id = ?", outbox.RequestID).Find(&logs).Error)
	assert.Len(t, logs, 1)
}

func TestImageTaskBillingLogOutboxStaleLeaseCannotOverwriteReclaimedLease(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	outbox := &ImageTaskBillingLogOutbox{
		TaskID:        "billing-outbox-stale-lease",
		RequestID:     imageTaskBillingLogRequestID("billing-outbox-stale-lease"),
		Status:        imageTaskBillingLogPending,
		NextAttemptAt: now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	require.NoError(t, DB.Create(outbox).Error)

	firstClaim, claimed, err := claimImageTaskBillingLogOutbox(outbox.TaskID, now)
	require.NoError(t, err)
	require.True(t, claimed)
	require.NotEmpty(t, firstClaim.LeaseToken)
	staleClaim := *firstClaim

	secondClaim, claimed, err := claimImageTaskBillingLogOutbox(outbox.TaskID, firstClaim.LeaseUntil+1)
	require.NoError(t, err)
	require.True(t, claimed)
	require.NotEmpty(t, secondClaim.LeaseToken)
	assert.NotEqual(t, staleClaim.LeaseToken, secondClaim.LeaseToken)

	require.ErrorIs(t, markImageTaskBillingLogOutboxRetry(&staleClaim, assert.AnError), gorm.ErrRecordNotFound)
	require.ErrorIs(t, markImageTaskBillingLogOutboxDelivered(&staleClaim), gorm.ErrRecordNotFound)

	var stored ImageTaskBillingLogOutbox
	require.NoError(t, DB.First(&stored, outbox.ID).Error)
	assert.Equal(t, imageTaskBillingLogDelivering, stored.Status)
	assert.Equal(t, secondClaim.LeaseToken, stored.LeaseToken)
	require.NoError(t, markImageTaskBillingLogOutboxDelivered(secondClaim))
	require.NoError(t, DB.First(&stored, outbox.ID).Error)
	assert.Equal(t, imageTaskBillingLogDelivered, stored.Status)
	assert.Empty(t, stored.LeaseToken)
}

func TestCompensatePermanentImageTaskFinalizationRefundsActiveReservation(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "permanent-compensation", 100)
	reservation := &ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}
	require.NoError(t, DB.Create(reservation).Error)
	task.Status = TaskStatusFinalizing
	task.PrivateData.BillingFinalStatus = TaskStatusSuccess
	task.PrivateData.BillingActualQuota = common.MaxQuota + 1
	require.NoError(t, DB.Model(task).Select("status", "private_data").Updates(task).Error)

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid final quota")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	assert.True(t, compensated.Applied)
	assert.Equal(t, TaskStatus(TaskStatusFailure), compensated.Task.Status)
	assert.Equal(t, -100, compensated.Delta)

	var storedTask Task
	require.NoError(t, DB.First(&storedTask, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusFailure), storedTask.Status)
	assert.Equal(t, 0, storedTask.Quota)
	var storedReservation ImageBillingReservation
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&storedReservation).Error)
	assert.Equal(t, ImageBillingReservationRefunded, storedReservation.Status)
	assert.Zero(t, storedReservation.WalletReserved)
	assert.Zero(t, storedReservation.TokenReserved)
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Equal(t, 0, token.UsedQuota)

	var outbox ImageTaskBillingLogOutbox
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&outbox).Error)
	assert.Equal(t, LogTypeRefund, outbox.LogType)
}

func TestCompensatePermanentImageTaskFinalizationRollsBackPreparedRedisCache(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	user, token, _, task := seedImageTaskBillingState(t, "prepared-cache-compensation", 100)
	require.NoError(t, DB.Model(user).Update("request_count", math.MaxInt).Error)
	require.NoError(t, DB.Create(&ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}).Error)
	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	_, err = FinalizeImageTask(task.TaskID)
	permanent, ok := IsPermanentImageTaskFinalizationError(err)
	require.True(t, ok)
	assert.False(t, permanent.BillingDBApplied)
	markerKey := "billing:image-task-cache:" + task.TaskID
	assert.Equal(t, "prepared", redisServer.HGet(markerKey, "state"))
	userPinned, err := redisServer.SIsMember(imageTaskUserQuotaPinsKey(user.Id), task.TaskID)
	require.NoError(t, err)
	assert.True(t, userPinned)
	tokenPinned, err := redisServer.SIsMember(imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key)), task.TaskID)
	require.NoError(t, err)
	assert.True(t, tokenPinned)

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid billing state")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	assert.True(t, compensated.Applied)
	assert.Equal(t, TaskStatus(TaskStatusFailure), compensated.Task.Status)
	assert.False(t, redisServer.Exists(markerKey))
	assert.False(t, redisServer.Exists(imageTaskUserQuotaPinsKey(user.Id)))
	assert.False(t, redisServer.Exists(imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key))))
	assert.False(t, redisServer.Exists(getUserCacheKey(user.Id)))
	assert.False(t, redisServer.Exists("token:"+common.GenerateHMAC(token.Key)))

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	assert.Zero(t, user.UsedQuota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}

func TestCompensatePermanentImageTaskFinalizationRefundsSurvivingPinnedLedger(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	user, token, _, task := seedImageTaskBillingState(t, "prepared-cache-compensation-with-peer", 100)
	require.NoError(t, DB.Model(user).Update("request_count", math.MaxInt).Error)
	require.NoError(t, DB.Create(&ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}).Error)
	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	_, err = FinalizeImageTask(task.TaskID)
	permanent, ok := IsPermanentImageTaskFinalizationError(err)
	require.True(t, ok)
	assert.False(t, permanent.BillingDBApplied)

	const peerTaskID = "task_image_finalize_compensation_peer"
	require.NoError(t, prepareImageTaskCacheAdjustment(imageTaskCacheAdjustment{
		taskID:     peerTaskID,
		userID:     user.Id,
		userDelta:  -25,
		tokenKey:   token.Key,
		tokenDelta: -25,
	}, user, token))

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid billing state")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	assert.True(t, compensated.Applied)

	rawUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 975, rawUser.Quota)
	rawToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 975, rawToken.RemainQuota)
	userPeerPinned, err := redisServer.SIsMember(imageTaskUserQuotaPinsKey(user.Id), peerTaskID)
	require.NoError(t, err)
	assert.True(t, userPeerPinned)
	tokenPeerPinned, err := redisServer.SIsMember(imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key)), peerTaskID)
	require.NoError(t, err)
	assert.True(t, tokenPeerPinned)
	userCompensationPinned, err := redisServer.SIsMember(imageTaskUserQuotaPinsKey(user.Id), task.TaskID)
	require.NoError(t, err)
	assert.False(t, userCompensationPinned)
	tokenCompensationPinned, err := redisServer.SIsMember(imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key)), task.TaskID)
	require.NoError(t, err)
	assert.False(t, tokenCompensationPinned)
	assert.False(t, redisServer.Exists("billing:image-task-cache:"+task.TaskID))
	assert.True(t, redisServer.Exists("billing:image-task-cache:"+peerTaskID))

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 1000, storedUser.Quota)
	var storedToken Token
	require.NoError(t, DB.First(&storedToken, token.Id).Error)
	assert.Equal(t, 1000, storedToken.RemainQuota)
	assert.Zero(t, storedToken.UsedQuota)
}

func TestCompensatePermanentImageTaskFinalizationRefundsSoftDeletedToken(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "soft-deleted-token-compensation", 100)
	reservation := &ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}
	require.NoError(t, DB.Create(reservation).Error)
	task.Status = TaskStatusFinalizing
	task.PrivateData.BillingFinalStatus = TaskStatusSuccess
	task.PrivateData.BillingActualQuota = common.MaxQuota + 1
	require.NoError(t, DB.Model(task).Select("status", "private_data").Updates(task).Error)
	require.NoError(t, DB.Delete(token).Error)

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid final quota")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	assert.True(t, compensated.Applied)

	var storedToken Token
	require.NoError(t, DB.Unscoped().First(&storedToken, token.Id).Error)
	assert.True(t, storedToken.DeletedAt.Valid)
	assert.Equal(t, 1000, storedToken.RemainQuota)
	assert.Zero(t, storedToken.UsedQuota)
}

func TestCompensatePermanentImageTaskFinalizationRefundsSoftDeletedUser(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "soft-deleted-user-compensation", 100)
	require.NoError(t, DB.Create(&ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}).Error)
	task.Status = TaskStatusFinalizing
	task.PrivateData.BillingFinalStatus = TaskStatusSuccess
	task.PrivateData.BillingActualQuota = common.MaxQuota + 1
	require.NoError(t, DB.Model(task).Select("status", "private_data").Updates(task).Error)
	require.NoError(t, DB.Delete(user).Error)

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid final quota")
	require.NoError(t, err)
	require.NotNil(t, compensated)
	assert.True(t, compensated.Applied)

	var storedUser User
	require.NoError(t, DB.Unscoped().First(&storedUser, user.Id).Error)
	assert.True(t, storedUser.DeletedAt.Valid)
	assert.Equal(t, 1000, storedUser.Quota)
}

func TestCompensatePermanentImageTaskFinalizationNeverRefundsAppliedBilling(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "applied-no-refund", 100)
	task.Status = TaskStatusFinalizing
	task.PrivateData.BillingDBApplied = true
	require.NoError(t, DB.Model(task).Select("status", "private_data").Updates(task).Error)
	reservation := &ImageBillingReservation{
		TaskID:         task.TaskID,
		UserID:         user.Id,
		TokenID:        token.Id,
		ExpectedQuota:  100,
		FundingSource:  "wallet",
		WalletReserved: 100,
		TokenRequired:  true,
		TokenReserved:  100,
		Status:         ImageBillingReservationActive,
	}
	require.NoError(t, DB.Create(reservation).Error)

	_, err := CompensatePermanentImageTaskFinalization(task.TaskID, "corrupt state after billing")
	require.Error(t, err)
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 900, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 900, token.RemainQuota)
	var storedTask Task
	require.NoError(t, DB.First(&storedTask, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusFinalizing), storedTask.Status)
	assert.True(t, storedTask.PrivateData.BillingDBApplied)
}
