package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestInsertTaskWithWebhookAndClaimImageTask(t *testing.T) {
	truncateTables(t)
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "true")
	require.NoError(t, DB.AutoMigrate(&TaskWebhook{}))

	task := &Task{
		TaskID:     "task_image_1",
		UserId:     7,
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusNotStart,
		Progress:   "0%",
		SubmitTime: common.GetTimestamp(),
	}
	webhook := &TaskWebhook{
		TaskID: task.TaskID,
		URL:    "https://example.com/hook",
		Secret: "secret",
	}

	require.NoError(t, InsertTaskWithWebhook(task, webhook))
	var stored struct {
		URL    string
		Secret string
	}
	require.NoError(t, DB.Model(&TaskWebhook{}).Select("url", "secret").Where("id = ?", webhook.ID).Scan(&stored).Error)
	assert.True(t, strings.HasPrefix(stored.URL, "enc:v1:"))
	assert.NotEqual(t, "https://example.com/hook", stored.URL)
	storedSecret := stored.Secret
	assert.True(t, strings.HasPrefix(storedSecret, "enc:v1:"))
	assert.NotEqual(t, "secret", storedSecret)
	webhookURL, secret, err := webhook.DeliveryCredentials()
	require.NoError(t, err)
	assert.Equal(t, "https://example.com/hook", webhookURL)
	assert.Equal(t, "secret", secret)

	pending, err := FindPendingImageTasks(10)
	require.NoError(t, err)
	require.Len(t, pending, 1)

	claimed, err := ClaimImageTask(pending[0], common.GetTimestamp())
	require.NoError(t, err)
	assert.True(t, claimed)
	assert.Equal(t, TaskStatus(TaskStatusInProgress), pending[0].Status)
	assert.Equal(t, "10%", pending[0].Progress)
	require.NoError(t, DB.Model(&Task{}).Where("id = ?", pending[0].ID).Update("status", TaskStatusSuccess).Error)

	due, err := FindDueTaskWebhooks(common.GetTimestamp(), 10)
	require.NoError(t, err)
	require.Len(t, due, 1)
	assert.Equal(t, task.TaskID, due[0].TaskID)
	assert.Equal(t, TaskWebhookStatusPending, due[0].Status)
}

func TestTaskWebhookReaderFirstModeWritesLegacyCredentials(t *testing.T) {
	truncateTables(t)
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")
	hook := &TaskWebhook{
		TaskID: "task_image_webhook_reader_first",
		URL:    "https://example.com/reader-first",
		Secret: "reader-first-secret",
	}
	require.NoError(t, DB.Create(hook).Error)
	var stored TaskWebhook
	require.NoError(t, DB.First(&stored, hook.ID).Error)
	assert.Equal(t, hook.URL, stored.URL)
	assert.Equal(t, hook.Secret, stored.Secret)
	webhookURL, secret, err := stored.DeliveryCredentials()
	require.NoError(t, err)
	assert.Equal(t, hook.URL, webhookURL)
	assert.Equal(t, hook.Secret, secret)
}

func TestTaskWebhookRetryAndDeliveryLifecycle(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TaskWebhook{}))

	hook := &TaskWebhook{
		TaskID: "task_image_2",
		URL:    "https://example.com/hook",
		Secret: "discard-after-delivery",
	}
	require.NoError(t, DB.Create(hook).Error)

	now := common.GetTimestamp()
	require.NoError(t, MarkTaskWebhookRetry(hook, now+30, "temporary failure"))
	assert.Equal(t, 1, hook.Attempts)
	assert.Equal(t, TaskWebhookStatusPending, hook.Status)
	assert.Equal(t, now+30, hook.NextAttemptAt)

	require.NoError(t, MarkTaskWebhookDelivered(hook))
	assert.Equal(t, TaskWebhookStatusDelivered, hook.Status)
	assert.Empty(t, hook.LastError)
	assert.Empty(t, hook.URL)
	assert.Empty(t, hook.Secret)
}

func TestTaskWebhookFailureClearsCallbackCredentials(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TaskWebhook{}))

	hook := &TaskWebhook{
		TaskID: "task_image_failed_webhook",
		URL:    "https://example.com/hook?token=secret",
		Secret: "discard-after-failure",
	}
	require.NoError(t, DB.Create(hook).Error)

	require.NoError(t, MarkTaskWebhookFailed(hook, "delivery exhausted"))
	assert.Equal(t, TaskWebhookStatusFailed, hook.Status)
	assert.Empty(t, hook.URL)
	assert.Empty(t, hook.Secret)
}

func TestFindDueTaskWebhooksIncludesOrphanForTerminalCleanup(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TaskWebhook{}))

	hook := &TaskWebhook{
		TaskID: "task_image_orphan_webhook",
		URL:    "https://example.com/hook",
		Secret: "discard-on-cleanup",
	}
	require.NoError(t, DB.Create(hook).Error)

	due, err := FindDueTaskWebhooks(common.GetTimestamp(), 10)
	require.NoError(t, err)
	require.Len(t, due, 1)
	assert.Equal(t, hook.ID, due[0].ID)
}

func TestClaimDueTaskWebhooksLeasesDeliveryAndKeepsStableIDAcrossRetries(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TaskWebhook{}))
	now := common.GetTimestamp()
	task := &Task{
		TaskID:     "task_image_webhook_lease",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusSuccess,
		SubmitTime: now,
	}
	require.NoError(t, DB.Create(task).Error)
	hook := &TaskWebhook{
		TaskID: task.TaskID,
		URL:    "https://example.com/hook",
		Secret: "secret",
	}
	require.NoError(t, DB.Create(hook).Error)

	firstClaim, err := ClaimDueTaskWebhooks(now, now+60, 10)
	require.NoError(t, err)
	require.Len(t, firstClaim, 1)
	assert.Equal(t, task.TaskID, firstClaim[0].DeliveryID())
	assert.NotEmpty(t, firstClaim[0].LeaseToken)
	staleClaim := *firstClaim[0]

	concurrentClaim, err := ClaimDueTaskWebhooks(now, now+60, 10)
	require.NoError(t, err)
	assert.Empty(t, concurrentClaim)

	require.NoError(t, MarkTaskWebhookRetry(firstClaim[0], now, "temporary failure"))
	secondClaim, err := ClaimDueTaskWebhooks(now, now+60, 10)
	require.NoError(t, err)
	require.Len(t, secondClaim, 1)
	assert.Equal(t, staleClaim.DeliveryID(), secondClaim[0].DeliveryID())
	assert.NotEqual(t, staleClaim.LeaseToken, secondClaim[0].LeaseToken)

	err = MarkTaskWebhookDelivered(&staleClaim)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	require.NoError(t, MarkTaskWebhookDelivered(secondClaim[0]))
}

func TestGetImageTaskByTaskIDDoesNotReturnAnotherPlatform(t *testing.T) {
	truncateTables(t)
	sharedTaskID := "task_shared_platform_id"
	require.NoError(t, DB.Create(&Task{
		TaskID:   sharedTaskID,
		Platform: constant.TaskPlatformSuno,
		Status:   TaskStatusSuccess,
	}).Error)

	task, exists, err := GetImageTaskByTaskID(sharedTaskID)
	require.NoError(t, err)
	assert.False(t, exists)
	assert.Nil(t, task)

	imageTask := &Task{
		TaskID:   sharedTaskID,
		Platform: constant.TaskPlatformOpenAIImage,
		Status:   TaskStatusSuccess,
	}
	require.NoError(t, DB.Create(imageTask).Error)
	task, exists, err = GetImageTaskByTaskID(sharedTaskID)
	require.NoError(t, err)
	require.True(t, exists)
	require.NotNil(t, task)
	assert.Equal(t, imageTask.ID, task.ID)
}

func TestRequeueStaleInProgressImageTasksLeavesActiveClaimsAlone(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	stale := &Task{
		TaskID:     "task_image_stale_claim",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusInProgress,
		StartTime:  now - 1200,
		SubmitTime: now - 1200,
	}
	active := &Task{
		TaskID:     "task_image_active_claim",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusInProgress,
		StartTime:  now - 30,
		SubmitTime: now - 30,
	}
	require.NoError(t, DB.Create(stale).Error)
	require.NoError(t, DB.Create(active).Error)

	cutoff := now - 600
	require.True(t, HasPendingImageWork(cutoff))
	require.NoError(t, RequeueStaleInProgressImageTasks(cutoff, now))

	require.NoError(t, DB.First(stale, stale.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusNotStart), stale.Status)
	assert.Zero(t, stale.StartTime)
	require.NoError(t, DB.First(active, active.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusInProgress), active.Status)
	assert.Equal(t, now-30, active.StartTime)
	require.NoError(t, DB.Model(stale).Update("status", TaskStatusSuccess).Error)
	assert.False(t, HasPendingImageWork(cutoff))
}

func TestRequeueStaleInProgressImageTasksNeverReopensCheckpointPendingCall(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	task := &Task{
		TaskID:     "task_image_checkpoint_pending",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusCheckpointPending,
		Attempt:    1,
		StartTime:  now - 3600,
		SubmitTime: now - 3600,
		UpdatedAt:  now - 3600,
		Progress:   "20%",
	}
	require.NoError(t, DB.Create(task).Error)

	require.True(t, HasPendingImageWork(now-600))
	require.NoError(t, RequeueStaleInProgressImageTasks(now-600, now))
	require.NoError(t, DB.First(task, task.ID).Error)
	assert.Equal(t, TaskStatusCheckpointPending, task.Status)
	assert.Equal(t, "20%", task.Progress)

	pending, err := FindPendingImageTasks(10)
	require.NoError(t, err)
	assert.Empty(t, pending)
	ambiguous, err := FindCheckpointPendingImageTasks(now, 10)
	require.NoError(t, err)
	require.Len(t, ambiguous, 1)
	assert.Equal(t, task.TaskID, ambiguous[0].TaskID)
}

func TestImageTaskProviderDownloadAndUploadRetriesAreIndependent(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	task := &Task{
		TaskID:     "task_image_independent_retries",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusNotStart,
		SubmitTime: now,
	}
	require.NoError(t, DB.Create(task).Error)

	claimed, err := ClaimImageTask(task, now)
	require.NoError(t, err)
	require.True(t, claimed)
	scheduled, err := task.MarkImageProviderRetry(now, "provider poll unavailable")
	require.NoError(t, err)
	require.True(t, scheduled)
	assert.Equal(t, 1, task.ProviderAttempts)
	assert.Zero(t, task.DownloadAttempts)
	assert.Zero(t, task.UploadAttempts)
	assert.Equal(t, "40%", task.Progress)

	claimed, err = ClaimImageTask(task, now+1)
	require.NoError(t, err)
	require.True(t, claimed)
	scheduled, err = task.MarkImageDownloadRetry(now, "temporary image URL unavailable")
	require.NoError(t, err)
	require.True(t, scheduled)
	assert.Equal(t, 1, task.ProviderAttempts)
	assert.Equal(t, 1, task.DownloadAttempts)
	assert.Zero(t, task.UploadAttempts)
	assert.Equal(t, "40%", task.Progress)

	claimed, err = ClaimImageTask(task, now+2)
	require.NoError(t, err)
	require.True(t, claimed)
	scheduled, err = task.MarkImageUploadRetry(now, "R2 unavailable")
	require.NoError(t, err)
	require.True(t, scheduled)
	assert.Equal(t, 1, task.ProviderAttempts)
	assert.Equal(t, 1, task.DownloadAttempts)
	assert.Equal(t, 1, task.UploadAttempts)
	assert.Equal(t, "70%", task.Progress)
}

func TestImageTaskSubmissionRetryReturnsTaskToSubmissionStage(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	task := &Task{
		TaskID:     "task_image_submission_retry",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusNotStart,
		SubmitTime: now,
	}
	require.NoError(t, DB.Create(task).Error)

	claimed, err := ClaimImageTask(task, now)
	require.NoError(t, err)
	require.True(t, claimed)
	scheduled, err := task.MarkImageSubmissionRetry(now+30, "provider submit unavailable")
	require.NoError(t, err)
	require.True(t, scheduled)
	assert.Equal(t, TaskStatus(TaskStatusNotStart), task.Status)
	assert.Equal(t, "10%", task.Progress)
	assert.Equal(t, 1, task.ProviderAttempts)
	assert.Equal(t, now+30, task.ProviderNextRetryAt)
	assert.Equal(t, "provider submit unavailable", task.ProviderError)
}

func TestImageTaskUnexpectedWorkerRetryIsDueGatedAndResetByKnownRetry(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	task := &Task{
		TaskID:     "task_image_worker_retry",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusNotStart,
		SubmitTime: now,
	}
	require.NoError(t, DB.Create(task).Error)

	claimed, err := ClaimImageTask(task, now)
	require.NoError(t, err)
	require.True(t, claimed)
	scheduled, err := task.MarkImageWorkerRetry(now+30, "temporary persistence error")
	require.NoError(t, err)
	require.True(t, scheduled)
	assert.Equal(t, 1, task.WorkerAttempts)
	assert.Equal(t, now+30, task.WorkerNextRetryAt)
	assert.Equal(t, "temporary persistence error", task.WorkerError)

	pending, err := FindPendingImageTasks(10)
	require.NoError(t, err)
	assert.Empty(t, pending)

	require.NoError(t, DB.Model(task).Update("worker_next_retry_at", now).Error)
	task.WorkerNextRetryAt = now
	claimed, err = ClaimImageTask(task, now+1)
	require.NoError(t, err)
	require.True(t, claimed)
	scheduled, err = task.MarkImageProviderRetry(now+30, "known provider error")
	require.NoError(t, err)
	require.True(t, scheduled)
	assert.Zero(t, task.WorkerAttempts)
	assert.Zero(t, task.WorkerNextRetryAt)
	assert.Empty(t, task.WorkerError)
}
