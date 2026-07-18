package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestImageInputCleanupEncryptsAndLeasesObjectKeys(t *testing.T) {
	truncateTables(t)
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "true")
	previousSecret := common.CryptoSecret
	common.CryptoSecret = "image-input-cleanup-test-secret"
	t.Cleanup(func() { common.CryptoSecret = previousSecret })

	cleanup, err := NewImageInputCleanup("task_cleanup_encrypted", []string{
		"inputs/one/reference.png",
		"inputs/two/reference.webp",
	})
	require.NoError(t, err)
	assert.NotContains(t, cleanup.ObjectKeys, "inputs/")
	cleanup.Status = ImageInputCleanupPending
	cleanup.NextAttemptAt = common.GetTimestamp()
	require.NoError(t, DB.Create(cleanup).Error)

	claimed, err := ClaimDueImageInputCleanups(common.GetTimestamp(), common.GetTimestamp()+60, 10)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	keys, err := claimed[0].ResolvedObjectKeys()
	require.NoError(t, err)
	assert.Equal(t, []string{"inputs/one/reference.png", "inputs/two/reference.webp"}, keys)
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")
	require.NoError(t, UpdateClaimedImageInputCleanupKeys(claimed[0], []string{"inputs/two/reference.webp"}))
	assert.NotContains(t, claimed[0].ObjectKeys, "inputs/")

	require.NoError(t, MarkImageInputCleanupCompleted(claimed[0]))
	require.NoError(t, DB.First(cleanup, cleanup.ID).Error)
	assert.Equal(t, ImageInputCleanupCompleted, cleanup.Status)
	assert.Empty(t, cleanup.ObjectKeys)
}

func TestFinalizeImageTaskSchedulesPrivateInputCleanup(t *testing.T) {
	truncateTables(t)
	_, _, _, task := seedImageTaskBillingState(t, "input-cleanup", 100)
	cleanup := &ImageInputCleanup{
		TaskID:     task.TaskID,
		ObjectKeys: `["inputs/reference/image.png"]`,
		Status:     ImageInputCleanupWaiting,
	}
	require.NoError(t, DB.Create(cleanup).Error)

	won, err := task.TransitionImageTaskToFinalizing(TaskStatusFailure, 0)
	require.NoError(t, err)
	require.True(t, won)
	_, err = FinalizeImageTask(task.TaskID)
	require.NoError(t, err)

	require.NoError(t, DB.First(cleanup, cleanup.ID).Error)
	assert.Equal(t, ImageInputCleanupPending, cleanup.Status)
	assert.Positive(t, cleanup.NextAttemptAt)
}

func TestImageInputCleanupWaitingRowIsNotClaimedBeforeTerminalFinalization(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	cleanup, err := NewImageInputCleanup("task_cleanup_waiting", []string{"inputs/reference/image.png"})
	require.NoError(t, err)
	require.NoError(t, DB.Create(cleanup).Error)

	claimed, err := ClaimDueImageInputCleanups(now, now+60, 10)
	require.NoError(t, err)
	assert.Empty(t, claimed)
	assert.False(t, HasDueImageInputCleanups(now))
}

func TestImageInputCleanupRetryAndStaleLeaseFencing(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	cleanup, err := NewImageInputCleanup("task_cleanup_retry", []string{"inputs/reference/image.png"})
	require.NoError(t, err)
	cleanup.Status = ImageInputCleanupPending
	cleanup.NextAttemptAt = now
	require.NoError(t, DB.Create(cleanup).Error)

	first, err := ClaimDueImageInputCleanups(now, now+60, 1)
	require.NoError(t, err)
	require.Len(t, first, 1)
	stale := *first[0]
	second, err := ClaimDueImageInputCleanups(now+61, now+121, 1)
	require.NoError(t, err)
	require.Len(t, second, 1)
	assert.NotEqual(t, stale.LeaseToken, second[0].LeaseToken)
	require.ErrorIs(t, MarkImageInputCleanupRetry(&stale, now+120, "stale retry"), gorm.ErrRecordNotFound)
	require.ErrorIs(t, MarkImageInputCleanupCompleted(&stale), gorm.ErrRecordNotFound)

	require.NoError(t, MarkImageInputCleanupRetry(second[0], now+180, "temporary failure"))
	assert.Equal(t, 1, second[0].Attempts)
	claimed, err := ClaimDueImageInputCleanups(now+179, now+240, 1)
	require.NoError(t, err)
	assert.Empty(t, claimed)
	claimed, err = ClaimDueImageInputCleanups(now+180, now+240, 1)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	require.NoError(t, MarkImageInputCleanupCompleted(claimed[0]))
}

func TestActivatePreparedImageTaskPersistsWaitingCleanupAtomically(t *testing.T) {
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")
	user, token, task := seedPreparedImageBillingReservation(t, "cleanup-activation", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	task.Quota = 100
	checkpoint, err := common.Marshal(map[string]any{
		"input_object_keys": []string{"inputs/reference/image.png"},
	})
	require.NoError(t, err)
	task.CheckpointData = checkpoint
	activated, err := ActivatePreparedImageTask(task)
	require.NoError(t, err)
	require.True(t, activated)
	var stored ImageInputCleanup
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	assert.Equal(t, ImageInputCleanupWaiting, stored.Status)

	claimed, err := ClaimDueImageInputCleanups(common.GetTimestamp(), common.GetTimestamp()+60, 10)
	require.NoError(t, err)
	assert.Empty(t, claimed)
}

func TestPersistPreparedImageInputCleanupMergesAndActivationReusesRow(t *testing.T) {
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")
	user, token, task := seedPreparedImageBillingReservation(t, "cleanup-pre-staging", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))

	require.NoError(t, PersistPreparedImageInputCleanup(task.TaskID, []string{"inputs/reference/first.png"}))
	require.NoError(t, PersistPreparedImageInputCleanup(task.TaskID, []string{"inputs/reference/second.png"}))
	var cleanup ImageInputCleanup
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&cleanup).Error)
	keys, err := cleanup.ResolvedObjectKeys()
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"inputs/reference/first.png", "inputs/reference/second.png"}, keys)

	task.Quota = 100
	checkpoint, err := common.Marshal(map[string]any{
		"input_object_keys": []string{"inputs/reference/first.png", "inputs/reference/second.png"},
	})
	require.NoError(t, err)
	task.CheckpointData = checkpoint
	activated, err := ActivatePreparedImageTask(task)
	require.NoError(t, err)
	require.True(t, activated)

	var count int64
	require.NoError(t, DB.Model(&ImageInputCleanup{}).Where("task_id = ?", task.TaskID).Count(&count).Error)
	assert.EqualValues(t, 1, count)
}

func TestActivatePreparedImageTaskRejectsCleanupCheckpointMismatch(t *testing.T) {
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")
	user, token, task := seedPreparedImageBillingReservation(t, "cleanup-mismatch", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	task.Quota = 100
	checkpoint, err := common.Marshal(map[string]any{
		"input_object_keys": []string{"inputs/reference/expected.png"},
	})
	require.NoError(t, err)
	task.CheckpointData = checkpoint
	cleanup, err := NewImageInputCleanup(task.TaskID, []string{"inputs/reference/unexpected.png"})
	require.NoError(t, err)

	activated, err := ActivatePreparedImageTask(task, cleanup)
	require.ErrorContains(t, err, "do not match")
	assert.False(t, activated)
	var storedTask Task
	require.NoError(t, DB.First(&storedTask, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusReserving), storedTask.Status)
	var storedCleanup ImageInputCleanup
	require.ErrorIs(t, DB.Where("task_id = ?", task.TaskID).First(&storedCleanup).Error, gorm.ErrRecordNotFound)
	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, ImageBillingReservationPreparing, reservation.Status)
}

func TestActivatePreparedImageTaskRejectsPersistedCleanupWithoutCheckpointKeys(t *testing.T) {
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")
	user, token, task := seedPreparedImageBillingReservation(t, "cleanup-missing-checkpoint", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, PersistPreparedImageInputCleanup(task.TaskID, []string{"inputs/reference/staged.png"}))
	task.Quota = 100

	activated, err := ActivatePreparedImageTask(task)
	require.ErrorContains(t, err, "do not match")
	assert.False(t, activated)
	var storedTask Task
	require.NoError(t, DB.First(&storedTask, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusReserving), storedTask.Status)
}

func TestCompensatePermanentImageTaskFinalizationSchedulesPrivateInputCleanup(t *testing.T) {
	truncateTables(t)
	user, token, _, task := seedImageTaskBillingState(t, "input-cleanup-compensation", 100)
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
	cleanup := &ImageInputCleanup{
		TaskID:     task.TaskID,
		ObjectKeys: `["inputs/reference/image.png"]`,
		Status:     ImageInputCleanupWaiting,
	}
	require.NoError(t, DB.Create(cleanup).Error)
	task.Status = TaskStatusFinalizing
	task.PrivateData.BillingFinalStatus = TaskStatusSuccess
	task.PrivateData.BillingActualQuota = common.MaxQuota + 1
	require.NoError(t, DB.Model(task).Select("status", "private_data").Updates(task).Error)

	compensated, err := CompensatePermanentImageTaskFinalization(task.TaskID, "invalid final quota")
	require.NoError(t, err)
	require.True(t, compensated.Applied)
	require.NoError(t, DB.First(cleanup, cleanup.ID).Error)
	assert.Equal(t, ImageInputCleanupPending, cleanup.Status)
	assert.Positive(t, cleanup.NextAttemptAt)
}

func TestImageInputCleanupRejectsInvalidOrExcessiveKeys(t *testing.T) {
	_, err := NewImageInputCleanup("task_cleanup_invalid", []string{"inputs/../escape.png"})
	require.ErrorContains(t, err, "invalid image input object key")

	tooMany := make([]string, maxImageInputCleanupKeys+1)
	for index := range tooMany {
		tooMany[index] = "inputs/reference/image.png"
	}
	_, err = NewImageInputCleanup("task_cleanup_excessive", tooMany)
	require.ErrorContains(t, err, "max 17")

}
