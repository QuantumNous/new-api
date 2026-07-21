package model

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedImageTaskBillingState(t *testing.T, suffix string, preConsumed int) (*User, *Token, *Channel, *Task) {
	t.Helper()
	user := &User{
		Username: "image-finalize-" + suffix,
		Password: "password",
		Quota:    1000 - preConsumed,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, DB.Create(user).Error)

	token := &Token{
		UserId:      user.Id,
		Key:         "image-finalize-token-" + suffix,
		Status:      common.TokenStatusEnabled,
		RemainQuota: 1000 - preConsumed,
		UsedQuota:   preConsumed,
	}
	require.NoError(t, DB.Create(token).Error)

	channel := &Channel{
		Key:    "image-finalize-channel-key-" + suffix,
		Name:   "image-finalize-channel-" + suffix,
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, DB.Create(channel).Error)

	now := common.GetTimestamp()
	task := &Task{
		TaskID:     "task_image_finalize_" + suffix,
		Platform:   constant.TaskPlatformOpenAIImage,
		UserId:     user.Id,
		ChannelId:  channel.Id,
		Quota:      preConsumed,
		Status:     TaskStatusInProgress,
		Attempt:    1,
		Progress:   "10%",
		SubmitTime: now,
		StartTime:  now,
		PrivateData: TaskPrivateData{
			BillingSource:       "wallet",
			TokenId:             token.Id,
			TokenPreConsumed:    preConsumed,
			TokenBillingEnabled: true,
		},
	}
	require.NoError(t, DB.Create(task).Error)
	return user, token, channel, task
}

func useImageTaskTestRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	redisServer := miniredis.RunT(t)
	oldRedisEnabled, oldRDB := common.RedisEnabled, common.RDB
	client := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	common.RedisEnabled = true
	common.RDB = client
	t.Cleanup(func() {
		_ = client.Close()
		common.RedisEnabled, common.RDB = oldRedisEnabled, oldRDB
	})
	return redisServer
}

func TestFinalizeImageTaskSuccessDeltaAndIdempotency(t *testing.T) {
	truncateTables(t)
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "true")
	user, token, channel, task := seedImageTaskBillingState(t, "success", 100)
	task.PrivateData.BillingContext = &TaskBillingContext{BillingRequestInput: &billingexpr.RequestInput{
		Headers: map[string]string{"X-Trace-Id": "finalization-trace-secret"},
		Body:    []byte(`{"prompt":"finalization-prompt-secret"}`),
	}}
	require.NoError(t, DB.Model(task).Update("private_data", task.PrivateData).Error)
	task.CheckpointData = []byte(`{"api_key":"must-not-survive-finalization"}`)
	require.NoError(t, DB.Model(task).Update("checkpoint_data", task.CheckpointData).Error)
	require.NoError(t, DB.Create(&ImageTaskArtifactChunk{
		TaskID:     task.TaskID,
		ChunkIndex: 0,
		ChunkCount: 1,
		TotalSize:  3,
		Data:       []byte("img"),
	}).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	assert.Equal(t, 100, finalized.PreviousQuota)
	assert.Equal(t, 140, finalized.ActualQuota)
	assert.Equal(t, 40, finalized.Delta)
	assert.Equal(t, TaskStatus(TaskStatusSuccess), finalized.Task.Status)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 860, user.Quota)
	assert.Equal(t, 140, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 860, token.RemainQuota)
	assert.Equal(t, 140, token.UsedQuota)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.EqualValues(t, 140, channel.UsedQuota)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusSuccess), stored.Status)
	assert.Equal(t, "100%", stored.Progress)
	assert.Equal(t, 140, stored.Quota)
	assert.NotZero(t, stored.FinishTime)
	assert.Empty(t, stored.PrivateData.BillingFinalStatus)
	assert.Zero(t, stored.PrivateData.BillingActualQuota)
	assert.Empty(t, stored.CheckpointData)
	require.NotNil(t, stored.PrivateData.BillingContext)
	assert.Nil(t, stored.PrivateData.BillingContext.BillingRequestInput)
	assert.Empty(t, stored.PrivateData.BillingContext.EncryptedBillingRequestInput)
	var storedPrivateData []byte
	require.NoError(t, DB.Raw("SELECT private_data FROM tasks WHERE id = ?", task.ID).Row().Scan(&storedPrivateData))
	assert.NotContains(t, string(storedPrivateData), "billing_request_input_encrypted")
	var artifactChunks int64
	require.NoError(t, DB.Model(&ImageTaskArtifactChunk{}).Where("task_id = ?", task.TaskID).Count(&artifactChunks).Error)
	assert.Zero(t, artifactChunks)

	second, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	assert.False(t, second.Applied)
	assert.Zero(t, second.Delta)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 860, user.Quota)
	assert.Equal(t, 140, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 860, token.RemainQuota)
	assert.Equal(t, 140, token.UsedQuota)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.EqualValues(t, 140, channel.UsedQuota)
}

func TestFinalizeImageTaskFailureRefund(t *testing.T) {
	truncateTables(t)
	user, token, channel, task := seedImageTaskBillingState(t, "failure", 100)
	task.FailReason = "upstream failed"

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusFailure, 0)
	require.NoError(t, err)
	require.True(t, won)

	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	assert.Equal(t, -100, finalized.Delta)
	assert.Equal(t, TaskStatus(TaskStatusFailure), finalized.Task.Status)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	assert.Zero(t, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.Zero(t, channel.UsedQuota)
}

func TestFinalizeImageTaskFailurePreservesLegacyUserUsedQuota(t *testing.T) {
	if strconv.IntSize < 64 {
		t.Skip("legacy compatibility values require a 64-bit Go int")
	}
	truncateTables(t)
	user, token, channel, task := seedImageTaskBillingState(t, "failure-legacy-user-used", 100)
	legacyUsedQuota := int(int64(common.MaxQuota) + 100)
	require.NoError(t, DB.Model(user).Update("used_quota", legacyUsedQuota).Error)
	task.FailReason = "upstream failed"

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusFailure, 0)
	require.NoError(t, err)
	require.True(t, won)

	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	assert.Equal(t, TaskStatus(TaskStatusFailure), finalized.Task.Status)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	assert.Equal(t, legacyUsedQuota, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.Zero(t, channel.UsedQuota)
}

func TestFinalizeImageTaskSuccessIncrementsLegacyUserUsedQuota(t *testing.T) {
	if strconv.IntSize < 64 {
		t.Skip("legacy compatibility values require a 64-bit Go int")
	}
	truncateTables(t)
	user, token, channel, task := seedImageTaskBillingState(t, "success-legacy-user-used", 100)
	legacyUsedQuota := int(int64(common.MaxQuota) + 100)
	require.NoError(t, DB.Model(user).Update("used_quota", legacyUsedQuota).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	assert.Equal(t, TaskStatus(TaskStatusSuccess), finalized.Task.Status)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 860, user.Quota)
	assert.Equal(t, legacyUsedQuota+140, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 860, token.RemainQuota)
	assert.Equal(t, 140, token.UsedQuota)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.EqualValues(t, 140, channel.UsedQuota)
}

func TestFinalizeImageTaskSettlesSoftDeletedTokenLedger(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "soft-deleted-token", 100)
	require.NoError(t, DB.Delete(token).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 860, user.Quota)
	assert.Equal(t, 140, user.UsedQuota)
	var storedToken Token
	require.NoError(t, DB.Unscoped().First(&storedToken, token.Id).Error)
	assert.True(t, storedToken.DeletedAt.Valid)
	assert.Equal(t, 860, storedToken.RemainQuota)
	assert.Equal(t, 140, storedToken.UsedQuota)
}

func TestFinalizeImageTaskDoesNotRestoreSoftDeletedTokenCache(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	_, token, _, task := seedImageTaskBillingState(t, "deleted-token-cache", 100)
	require.NoError(t, cacheSetToken(*token))
	require.NoError(t, DB.Delete(token).Error)
	require.NoError(t, cacheDeleteToken(token.Key))
	tokenCacheKey := "token:" + common.GenerateHMAC(token.Key)
	assert.False(t, redisServer.Exists(tokenCacheKey))

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)

	assert.False(t, redisServer.Exists(tokenCacheKey))
	_, err = ValidateUserToken(token.Key)
	require.ErrorIs(t, err, ErrTokenInvalid)
	var storedToken Token
	require.NoError(t, DB.Unscoped().First(&storedToken, token.Id).Error)
	assert.Equal(t, 860, storedToken.RemainQuota)
	assert.Equal(t, 140, storedToken.UsedQuota)
}

func TestFinalizeImageTaskDoesNotRestoreSoftDeletedUserCache(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	user, _, _, task := seedImageTaskBillingState(t, "deleted-user-cache", 100)
	require.NoError(t, populateUserCache(*user))
	require.NoError(t, DB.Delete(user).Error)
	require.NoError(t, invalidateUserCache(user.Id))
	userCacheKey := getUserCacheKey(user.Id)
	assert.False(t, redisServer.Exists(userCacheKey))

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)

	assert.False(t, redisServer.Exists(userCacheKey))
	_, err = GetUserCache(user.Id)
	require.Error(t, err)
	var storedUser User
	require.NoError(t, DB.Unscoped().First(&storedUser, user.Id).Error)
	assert.Equal(t, 860, storedUser.Quota)
	assert.Equal(t, 140, storedUser.UsedQuota)
}

func TestDeletedTokenWithImageBillingPinIsDisabledUntilCacheRemoval(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	_, token, _, task := seedImageTaskBillingState(t, "deleted-token-pinned-cache", 100)
	adjustment := imageTaskCacheAdjustment{
		taskID:     task.TaskID,
		tokenKey:   token.Key,
		tokenDelta: -40,
	}
	require.NoError(t, prepareImageTaskCacheAdjustment(adjustment, nil, token))
	require.NoError(t, DB.Delete(token).Error)
	require.NoError(t, cacheDeleteToken(token.Key))

	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, common.TokenStatusDisabled, cachedToken.Status)
	_, err = ValidateUserToken(token.Key)
	require.ErrorIs(t, err, ErrTokenInvalid)

	require.NoError(t, commitImageTaskCacheAdjustment(adjustment))
	assert.False(t, redisServer.Exists("token:"+common.GenerateHMAC(token.Key)))
}

func TestFinalizeImageTaskRefundsUnlimitedTokenReservation(t *testing.T) {
	truncateTables(t)
	_, token, _, task := seedImageTaskBillingState(t, "unlimited", 100)
	token.UnlimitedQuota = true
	require.NoError(t, DB.Model(token).Update("unlimited_quota", true).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusFailure, 0)
	require.NoError(t, err)
	require.True(t, won)
	_, err = FinalizeImageTask(task.TaskID)
	require.NoError(t, err)

	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}

func TestFinalizeImageTaskDoesNotAdjustPlaygroundToken(t *testing.T) {
	truncateTables(t)
	_, token, _, task := seedImageTaskBillingState(t, "playground", 100)
	require.NoError(t, DB.Model(token).Updates(map[string]any{
		"remain_quota": 1000,
		"used_quota":   0,
	}).Error)
	task.PrivateData.TokenPreConsumed = 0
	task.PrivateData.TokenBillingEnabled = false
	require.NoError(t, DB.Model(task).Update("private_data", task.PrivateData).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusFailure, 0)
	require.NoError(t, err)
	require.True(t, won)
	_, err = FinalizeImageTask(task.TaskID)
	require.NoError(t, err)

	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}

func TestFinalizeImageTaskResumesAfterBillingDBCommit(t *testing.T) {
	truncateTables(t)
	user, token, channel, task := seedImageTaskBillingState(t, "resume-db", 100)
	require.NoError(t, DB.Model(user).Updates(map[string]any{
		"quota":         860,
		"used_quota":    140,
		"request_count": 1,
	}).Error)
	require.NoError(t, DB.Model(token).Updates(map[string]any{
		"remain_quota": 860,
		"used_quota":   140,
	}).Error)
	require.NoError(t, DB.Model(channel).Update("used_quota", 140).Error)
	task.Status = TaskStatusFinalizing
	task.Progress = "99%"
	task.PrivateData.BillingFinalStatus = TaskStatusSuccess
	task.PrivateData.BillingActualQuota = 140
	task.PrivateData.BillingDBApplied = true
	require.NoError(t, DB.Model(task).Select("status", "progress", "private_data").Updates(task).Error)

	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	assert.Equal(t, TaskStatus(TaskStatusSuccess), finalized.Task.Status)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 860, user.Quota)
	assert.Equal(t, 140, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 860, token.RemainQuota)
	assert.Equal(t, 140, token.UsedQuota)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.EqualValues(t, 140, channel.UsedQuota)
}

func TestFinalizeImageTaskRedisFailureLeavesBillingRecoverable(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled, oldRDB := common.RedisEnabled, common.RDB
	common.RedisEnabled = true
	common.RDB = nil
	t.Cleanup(func() {
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
	})

	user, token, channel, task := seedImageTaskBillingState(t, "redis-unavailable", 100)
	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	finalized, err := FinalizeImageTask(task.TaskID)
	require.ErrorContains(t, err, "redis is enabled but unavailable")
	assert.Nil(t, finalized)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusFinalizing), stored.Status)
	assert.False(t, stored.PrivateData.BillingDBApplied)
	assert.Equal(t, 100, stored.Quota)
	assert.Zero(t, stored.FinishTime)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 900, user.Quota)
	assert.Zero(t, user.UsedQuota)
	assert.Zero(t, user.RequestCount)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 900, token.RemainQuota)
	assert.Equal(t, 100, token.UsedQuota)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.Zero(t, channel.UsedQuota)

	second, err := FinalizeImageTask(task.TaskID)
	require.ErrorContains(t, err, "redis is enabled but unavailable")
	assert.Nil(t, second)
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 900, user.Quota)
	assert.Zero(t, user.UsedQuota)
	assert.Zero(t, user.RequestCount)
}

func TestFinalizeImageTaskRedisFirstPrepareCreatesMarker(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)

	user, token, _, task := seedImageTaskBillingState(t, "redis-first-prepare", 100)
	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	assert.Equal(t, TaskStatus(TaskStatusSuccess), finalized.Task.Status)
	assert.Equal(t, 40, finalized.Delta)

	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 860, cachedUser.Quota)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 860, cachedToken.RemainQuota)
	assert.Equal(t, "committed", redisServer.HGet("billing:image-task-cache:"+task.TaskID, "state"))
}

func TestFinalizeImageTaskRecoversAfterCommitMarkerExpires(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)

	user, token, _, task := seedImageTaskBillingState(t, "expired-commit-marker", 100)
	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	coordinator := imageTaskCacheCoordinator{
		prepare: prepareImageTaskCacheAdjustment,
		commit: func(imageTaskCacheAdjustment) error {
			return errors.New("injected stop after billing database commit")
		},
	}
	first, err := finalizeImageTaskWithCache(task.TaskID, coordinator)
	require.ErrorContains(t, err, "injected stop after billing database commit")
	assert.Nil(t, first)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusFinalizing), stored.Status)
	assert.True(t, stored.PrivateData.BillingDBApplied)
	markerKey := "billing:image-task-cache:" + task.TaskID
	assert.Equal(t, "prepared", redisServer.HGet(markerKey, "state"))
	assert.Equal(t, "-40", redisServer.HGet(getUserCacheKey(user.Id), "ImageTaskBilling:"+task.TaskID))
	assert.Equal(t, "-40", redisServer.HGet("token:"+common.GenerateHMAC(token.Key), "ImageTaskBilling:"+task.TaskID))

	// Cache activity can extend shared user/token hashes beyond this task's
	// marker. Expire only the marker to reproduce that recovery boundary.
	redisServer.SetTTL(markerKey, time.Second)
	redisServer.FastForward(2 * time.Second)
	assert.False(t, redisServer.Exists(markerKey))
	assert.True(t, redisServer.Exists(getUserCacheKey(user.Id)))
	assert.True(t, redisServer.Exists("token:"+common.GenerateHMAC(token.Key)))

	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	assert.Equal(t, TaskStatus(TaskStatusSuccess), finalized.Task.Status)
	assert.Empty(t, redisServer.HGet(getUserCacheKey(user.Id), "ImageTaskBilling:"+task.TaskID))
	assert.Empty(t, redisServer.HGet("token:"+common.GenerateHMAC(token.Key), "ImageTaskBilling:"+task.TaskID))
	assert.False(t, redisServer.Exists(imageTaskUserQuotaPinsKey(user.Id)))
	assert.False(t, redisServer.Exists(imageTaskTokenQuotaPinsKey(common.GenerateHMAC(token.Key))))

	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 860, cachedUser.Quota)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 860, cachedToken.RemainQuota)
}

func TestFinalizeImageTaskMissingTagPreservesConcurrentCacheDelta(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)

	user, token, _, task := seedImageTaskBillingState(t, "missing-tag-concurrent-delta", 100)
	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)
	coordinator := imageTaskCacheCoordinator{
		prepare: prepareImageTaskCacheAdjustment,
		commit: func(imageTaskCacheAdjustment) error {
			return errors.New("injected stop after billing database commit")
		},
	}
	first, err := finalizeImageTaskWithCache(task.TaskID, coordinator)
	require.ErrorContains(t, err, "injected stop after billing database commit")
	assert.Nil(t, first)

	markerKey := "billing:image-task-cache:" + task.TaskID
	userCacheKey := getUserCacheKey(user.Id)
	tokenHMAC := common.GenerateHMAC(token.Key)
	tokenCacheKey := "token:" + tokenHMAC
	taskField := "ImageTaskBilling:" + task.TaskID
	ctx := context.Background()
	require.NoError(t, common.RDB.HDel(ctx, userCacheKey, taskField).Err())
	require.NoError(t, common.RDB.HDel(ctx, tokenCacheKey, taskField).Err())
	require.NoError(t, common.RDB.HIncrBy(ctx, userCacheKey, "Quota", -7).Err())
	require.NoError(t, common.RDB.HIncrBy(ctx, tokenCacheKey, constant.TokenFiledRemainQuota, -7).Err())
	require.NoError(t, common.RDB.Del(ctx, markerKey).Err())

	finalized, err := FinalizeImageTask(task.TaskID)
	require.Error(t, err)
	assert.Nil(t, finalized)
	permanent, ok := IsPermanentImageTaskFinalizationError(err)
	require.True(t, ok)
	assert.True(t, permanent.BillingDBApplied)
	assert.ErrorIs(t, permanent, errImageTaskQuotaCacheConflict)
	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusFinalizing), stored.Status)
	assert.True(t, stored.PrivateData.BillingDBApplied)
	assert.True(t, redisServer.Exists(userCacheKey))
	assert.True(t, redisServer.Exists(tokenCacheKey))
	assert.Equal(t, "853", redisServer.HGet(userCacheKey, "Quota"))
	assert.Equal(t, "853", redisServer.HGet(tokenCacheKey, constant.TokenFiledRemainQuota))
	assert.Equal(t, fmt.Sprintf("%d", common.UserStatusDisabled), redisServer.HGet(userCacheKey, "Status"))
	assert.Equal(t, fmt.Sprintf("%d", common.TokenStatusDisabled), redisServer.HGet(tokenCacheKey, "Status"))
	userPinned, err := redisServer.SIsMember(imageTaskUserQuotaPinsKey(user.Id), task.TaskID)
	require.NoError(t, err)
	assert.True(t, userPinned)
	tokenPinned, err := redisServer.SIsMember(imageTaskTokenQuotaPinsKey(tokenHMAC), task.TaskID)
	require.NoError(t, err)
	assert.True(t, tokenPinned)
	assert.True(t, redisServer.Exists(imageTaskUserQuotaInvalidationKey(user.Id)))
	assert.True(t, redisServer.Exists(imageTaskTokenQuotaInvalidationKey(tokenHMAC)))
}

func TestFinalizeImageTaskPositiveDeltaUsesConcurrentCacheBalance(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = true
	t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

	_, _, _, task := seedImageTaskBillingState(t, "concurrent-cache", 100)
	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	var mu sync.Mutex
	userQuota, tokenQuota := 900, 900
	prepareCalls := 0
	prepareReached := make(chan struct{})
	resumePrepare := make(chan struct{})
	coordinator := imageTaskCacheCoordinator{
		prepare: func(adjustment imageTaskCacheAdjustment, _ *User, _ *Token) error {
			mu.Lock()
			prepareCalls++
			first := prepareCalls == 1
			mu.Unlock()
			if first {
				close(prepareReached)
				<-resumePrepare
			}
			mu.Lock()
			defer mu.Unlock()
			if userQuota+adjustment.userDelta < 0 {
				return errImageTaskWalletQuotaInsufficient
			}
			if tokenQuota+adjustment.tokenDelta < 0 {
				return errImageTaskTokenQuotaInsufficient
			}
			userQuota += adjustment.userDelta
			tokenQuota += adjustment.tokenDelta
			return nil
		},
		commit: func(imageTaskCacheAdjustment) error { return nil },
	}

	type finalizeOutcome struct {
		result *ImageTaskFinalizationResult
		err    error
	}
	outcome := make(chan finalizeOutcome, 1)
	go func() {
		result, finalizeErr := finalizeImageTaskWithCache(task.TaskID, coordinator)
		outcome <- finalizeOutcome{result: result, err: finalizeErr}
	}()
	<-prepareReached
	mu.Lock()
	// Simulate another node atomically consuming the remaining live quota while
	// SQL still contains the older balance.
	userQuota = 20
	tokenQuota = 20
	mu.Unlock()
	close(resumePrepare)

	finalized := <-outcome
	require.NoError(t, finalized.err)
	require.NotNil(t, finalized.result)
	assert.Equal(t, TaskStatus(TaskStatusFailure), finalized.result.Task.Status)
	assert.Contains(t, finalized.result.Task.FailReason, "wallet quota insufficient")
	mu.Lock()
	assert.Equal(t, 120, userQuota)
	assert.Equal(t, 120, tokenQuota)
	assert.Equal(t, 2, prepareCalls)
	mu.Unlock()
}

func TestFinalizeImageTaskCacheReloadAfterDBCommitDoesNotReapplyDelta(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = true
	t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

	user, token, channel, task := seedImageTaskBillingState(t, "cache-reload", 100)
	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)

	var mu sync.Mutex
	userQuota, tokenQuota := 900, 900
	prepareCalls, commitCalls := 0, 0
	failCommit := true
	coordinator := imageTaskCacheCoordinator{
		prepare: func(adjustment imageTaskCacheAdjustment, _ *User, _ *Token) error {
			mu.Lock()
			defer mu.Unlock()
			prepareCalls++
			userQuota += adjustment.userDelta
			tokenQuota += adjustment.tokenDelta
			return nil
		},
		commit: func(imageTaskCacheAdjustment) error {
			mu.Lock()
			defer mu.Unlock()
			commitCalls++
			if failCommit {
				failCommit = false
				return errors.New("forced cache commit failure")
			}
			return nil
		},
	}

	first, err := finalizeImageTaskWithCache(task.TaskID, coordinator)
	require.ErrorContains(t, err, "forced cache commit failure")
	assert.Nil(t, first)
	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusFinalizing), stored.Status)
	assert.True(t, stored.PrivateData.BillingDBApplied)
	require.NoError(t, DB.First(user, user.Id).Error)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 860, user.Quota)
	assert.Equal(t, 860, token.RemainQuota)

	mu.Lock()
	// A cache miss after the DB phase reloads the already-adjusted durable values.
	userQuota = user.Quota
	tokenQuota = token.RemainQuota
	mu.Unlock()

	second, err := finalizeImageTaskWithCache(task.TaskID, coordinator)
	require.NoError(t, err)
	require.True(t, second.Applied)
	assert.Equal(t, TaskStatus(TaskStatusSuccess), second.Task.Status)
	mu.Lock()
	assert.Equal(t, 860, userQuota)
	assert.Equal(t, 860, tokenQuota)
	assert.Equal(t, 1, prepareCalls)
	assert.Equal(t, 2, commitCalls)
	mu.Unlock()

	require.NoError(t, DB.First(user, user.Id).Error)
	require.NoError(t, DB.First(token, token.Id).Error)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.Equal(t, 860, user.Quota)
	assert.Equal(t, 140, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	assert.Equal(t, 860, token.RemainQuota)
	assert.Equal(t, 140, token.UsedQuota)
	assert.EqualValues(t, 140, channel.UsedQuota)
}

func TestFinalizeImageTaskSubscriptionDelta(t *testing.T) {
	truncateTables(t)
	user, token, channel, task := seedImageTaskBillingState(t, "subscription", 100)
	user.Quota = 700
	require.NoError(t, DB.Model(user).Update("quota", user.Quota).Error)

	subscription := &UserSubscription{
		UserId:      user.Id,
		PlanId:      1,
		AmountTotal: 1000,
		AmountUsed:  100,
		Status:      "active",
	}
	require.NoError(t, DB.Create(subscription).Error)
	task.PrivateData.BillingSource = "subscription"
	task.PrivateData.SubscriptionId = subscription.Id
	require.NoError(t, DB.Model(task).Update("private_data", task.PrivateData).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)
	_, err = FinalizeImageTask(task.TaskID)
	require.NoError(t, err)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 700, user.Quota)
	assert.Equal(t, 140, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	require.NoError(t, DB.First(subscription, subscription.Id).Error)
	assert.EqualValues(t, 140, subscription.AmountUsed)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 860, token.RemainQuota)
	assert.Equal(t, 140, token.UsedQuota)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.EqualValues(t, 140, channel.UsedQuota)
}

func TestFinalizeImageTaskFailsAndRefundsWhenSubscriptionCannotCoverActualUsage(t *testing.T) {
	truncateTables(t)
	user, token, channel, task := seedImageTaskBillingState(t, "subscription-insufficient", 100)
	subscription := &UserSubscription{
		UserId:      user.Id,
		PlanId:      1,
		AmountTotal: 120,
		AmountUsed:  100,
		Status:      "active",
	}
	require.NoError(t, DB.Create(subscription).Error)
	task.Data = []byte(`{"data":[{"url":"https://cdn.example/image.png"}]}`)
	task.PrivateData.ResultURL = "https://cdn.example/image.png"
	task.PrivateData.BillingSource = "subscription"
	task.PrivateData.SubscriptionId = subscription.Id
	require.NoError(t, DB.Model(task).Select("data", "private_data").Updates(task).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	assert.Equal(t, TaskStatus(TaskStatusFailure), finalized.Task.Status)
	assert.Equal(t, 0, finalized.ActualQuota)
	assert.Equal(t, -100, finalized.Delta)
	assert.Contains(t, finalized.Task.FailReason, "subscription quota insufficient")
	assert.Empty(t, finalized.Task.Data)
	assert.Empty(t, finalized.Task.PrivateData.ResultURL)

	require.NoError(t, DB.First(subscription, subscription.Id).Error)
	assert.Zero(t, subscription.AmountUsed)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.Zero(t, channel.UsedQuota)
}

func TestFinalizeImageTaskFailsAndRefundsWhenWalletCannotCoverActualUsage(t *testing.T) {
	truncateTables(t)
	user, token, channel, task := seedImageTaskBillingState(t, "wallet-insufficient", 100)
	require.NoError(t, DB.Model(user).Update("quota", 20).Error)
	task.Data = []byte(`{"data":[{"url":"https://cdn.example/image.png"}]}`)
	task.PrivateData.ResultURL = "https://cdn.example/image.png"

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	assert.Equal(t, TaskStatus(TaskStatusFailure), finalized.Task.Status)
	assert.Equal(t, 0, finalized.ActualQuota)
	assert.Equal(t, -100, finalized.Delta)
	assert.Contains(t, finalized.Task.FailReason, "wallet quota insufficient")
	assert.Empty(t, finalized.Task.Data)
	assert.Empty(t, finalized.Task.PrivateData.ResultURL)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 120, user.Quota)
	assert.Zero(t, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.Zero(t, channel.UsedQuota)
}

func TestFinalizeImageTaskFailsAndRefundsWhenTokenCannotCoverActualUsage(t *testing.T) {
	truncateTables(t)
	user, token, channel, task := seedImageTaskBillingState(t, "token-insufficient", 100)
	require.NoError(t, DB.Model(token).Update("remain_quota", 20).Error)
	task.Data = []byte(`{"data":[{"url":"https://cdn.example/image.png"}]}`)
	task.PrivateData.ResultURL = "https://cdn.example/image.png"

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
	require.NoError(t, err)
	require.True(t, won)
	finalized, err := FinalizeImageTask(task.TaskID)
	require.NoError(t, err)
	require.True(t, finalized.Applied)
	assert.Equal(t, TaskStatus(TaskStatusFailure), finalized.Task.Status)
	assert.Equal(t, 0, finalized.ActualQuota)
	assert.Equal(t, -100, finalized.Delta)
	assert.Contains(t, finalized.Task.FailReason, "token quota insufficient")
	assert.Empty(t, finalized.Task.Data)
	assert.Empty(t, finalized.Task.PrivateData.ResultURL)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	assert.Zero(t, user.UsedQuota)
	assert.Equal(t, 1, user.RequestCount)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 120, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	assert.Zero(t, channel.UsedQuota)
}

func TestFinalizeImageTaskUsesLockedDBBalanceWhenRedisSnapshotIsStale(t *testing.T) {
	tests := []struct {
		name       string
		lowerDB    func(t *testing.T, user *User, token *Token)
		wantReason string
	}{
		{
			name: "wallet",
			lowerDB: func(t *testing.T, user *User, _ *Token) {
				require.NoError(t, DB.Model(user).Update("quota", 20).Error)
			},
			wantReason: "wallet quota insufficient",
		},
		{
			name: "token",
			lowerDB: func(t *testing.T, _ *User, token *Token) {
				require.NoError(t, DB.Model(token).Update("remain_quota", 20).Error)
			},
			wantReason: "token quota insufficient",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			truncateTables(t)
			useImageTaskTestRedis(t)
			user, token, channel, task := seedImageTaskBillingState(t, "stale-db-"+tt.name, 100)
			require.NoError(t, populateUserCache(*user))
			require.NoError(t, cacheSetToken(*token))
			tt.lowerDB(t, user, token)

			won, err := task.TransitionImageTaskToFinalizing(TaskStatusSuccess, 140)
			require.NoError(t, err)
			require.True(t, won)
			finalized, err := FinalizeImageTask(task.TaskID)
			require.NoError(t, err)
			require.True(t, finalized.Applied)
			assert.Equal(t, TaskStatus(TaskStatusFailure), finalized.Task.Status)
			assert.Contains(t, finalized.Task.FailReason, tt.wantReason)

			require.NoError(t, DB.First(user, user.Id).Error)
			require.NoError(t, DB.First(token, token.Id).Error)
			require.NoError(t, DB.First(channel, channel.Id).Error)
			assert.GreaterOrEqual(t, user.Quota, 0)
			assert.GreaterOrEqual(t, token.RemainQuota, 0)
			assert.Zero(t, channel.UsedQuota)
		})
	}
}

func TestImageTaskOldAttemptLosesFinalizingCAS(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	task := &Task{
		TaskID:     "task_image_attempt_fence",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusNotStart,
		Progress:   "0%",
		SubmitTime: now,
	}
	require.NoError(t, DB.Create(task).Error)

	claimed, err := ClaimImageTask(task, now)
	require.NoError(t, err)
	require.True(t, claimed)
	require.Equal(t, 1, task.Attempt)
	staleClaim := *task

	require.NoError(t, RequeueStaleInProgressImageTasks(now, now+1))
	var current Task
	require.NoError(t, DB.First(&current, task.ID).Error)
	claimed, err = ClaimImageTask(&current, now+2)
	require.NoError(t, err)
	require.True(t, claimed)
	require.Equal(t, 2, current.Attempt)

	won, err := staleClaim.TransitionImageTaskToFinalizing(TaskStatusFailure, 0)
	require.NoError(t, err)
	assert.False(t, won)

	var afterStale Task
	require.NoError(t, DB.First(&afterStale, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusInProgress), afterStale.Status)
	assert.Equal(t, 2, afterStale.Attempt)

	won, err = current.TransitionImageTaskToFinalizing(TaskStatusSuccess, 0)
	require.NoError(t, err)
	assert.True(t, won)

	finalizing, err := FindFinalizingImageTasks(10)
	require.NoError(t, err)
	require.Len(t, finalizing, 1)
	assert.Equal(t, current.TaskID, finalizing[0].TaskID)
}

func TestImageTaskFinalizationRetryBackoffDoesNotBlockLaterRows(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	first := &Task{
		TaskID:    "task_image_finalize_retry_first",
		Platform:  constant.TaskPlatformOpenAIImage,
		Status:    TaskStatusFinalizing,
		UpdatedAt: now,
	}
	second := &Task{
		TaskID:    "task_image_finalize_retry_second",
		Platform:  constant.TaskPlatformOpenAIImage,
		Status:    TaskStatusFinalizing,
		UpdatedAt: now,
	}
	require.NoError(t, DB.Create(first).Error)
	require.NoError(t, DB.Create(second).Error)
	require.NoError(t, MarkImageTaskFinalizationRetry(first, now+60, "broken billing state"))

	due, err := FindFinalizingImageTasks(10)
	require.NoError(t, err)
	require.Len(t, due, 1)
	assert.Equal(t, second.TaskID, due[0].TaskID)
	assert.Equal(t, 1, first.FinalizeAttempts)
	assert.Equal(t, "broken billing state", first.FinalizeError)
}

func TestImageTaskClientRequestIDUniqueness(t *testing.T) {
	truncateTables(t)
	key := "client-request-1"
	first := &Task{
		TaskID:          "task_image_idempotent_1",
		Platform:        constant.TaskPlatformOpenAIImage,
		UserId:          101,
		ClientRequestID: &key,
		Status:          TaskStatusNotStart,
	}
	require.NoError(t, DB.Create(first).Error)

	duplicate := &Task{
		TaskID:          "task_image_idempotent_2",
		Platform:        constant.TaskPlatformOpenAIImage,
		UserId:          101,
		ClientRequestID: &key,
		Status:          TaskStatusNotStart,
	}
	require.Error(t, DB.Create(duplicate).Error)

	otherUser := &Task{
		TaskID:          "task_image_idempotent_3",
		Platform:        constant.TaskPlatformOpenAIImage,
		UserId:          102,
		ClientRequestID: &key,
		Status:          TaskStatusNotStart,
	}
	require.NoError(t, DB.Create(otherUser).Error)

	found, exists, err := GetImageTaskByClientRequestID(101, key)
	require.NoError(t, err)
	require.True(t, exists)
	assert.Equal(t, first.TaskID, found.TaskID)
}

func TestGenericTaskPollingExcludesImageTasks(t *testing.T) {
	truncateTables(t)
	imageTask := &Task{
		TaskID:     "task_image_polling_isolation",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusFinalizing,
		Progress:   "99%",
		SubmitTime: 1,
	}
	videoTask := &Task{
		TaskID:     "task_video_polling_control",
		Platform:   constant.TaskPlatformSuno,
		Status:     TaskStatusInProgress,
		Progress:   "50%",
		SubmitTime: 1,
	}
	require.NoError(t, DB.Create(imageTask).Error)
	require.NoError(t, DB.Create(videoTask).Error)

	timedOut := GetTimedOutUnfinishedTasks(2, 10)
	require.Len(t, timedOut, 1)
	assert.Equal(t, videoTask.TaskID, timedOut[0].TaskID)
	unfinished := GetAllUnFinishSyncTasks(10)
	require.Len(t, unfinished, 1)
	assert.Equal(t, videoTask.TaskID, unfinished[0].TaskID)
	assert.True(t, HasUnfinishedSyncTasks())

	require.NoError(t, DB.Delete(videoTask).Error)
	assert.False(t, HasUnfinishedSyncTasks())
}
