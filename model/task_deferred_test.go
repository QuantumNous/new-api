package model

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

const (
	testLegacyTaskDispatchStatusPending TaskDispatchStatus = "pending"
	testLegacyTaskDispatchStatusRunning TaskDispatchStatus = "running"
)

// These helpers intentionally replay the 720944a predicates and writes with
// literal legacy states. Keep them independent from the current constants.
func findDispatchableDeferredTasksLike720944a(
	db *gorm.DB,
	now int64,
	limit int,
) ([]*Task, error) {
	var tasks []*Task
	err := db.Where("execution_mode = ?", TaskExecutionModeDeferred).
		Where("status NOT IN ?", []TaskStatus{TaskStatusFailure, TaskStatusSuccess, TaskStatusCancelled}).
		Where(
			"dispatch_status = ? OR (dispatch_status = ? AND dispatch_lock_until < ?)",
			testLegacyTaskDispatchStatusPending,
			testLegacyTaskDispatchStatusRunning,
			now,
		).
		Order("id").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}

func claimDeferredTaskLike720944a(
	db *gorm.DB,
	id int64,
	owner string,
	now, lockUntil int64,
) *gorm.DB {
	return db.Model(&Task{}).
		Where("id = ? AND execution_mode = ?", id, TaskExecutionModeDeferred).
		Where("status NOT IN ?", []TaskStatus{TaskStatusFailure, TaskStatusSuccess, TaskStatusCancelled}).
		Where(
			"dispatch_status = ? OR (dispatch_status = ? AND dispatch_lock_until < ?)",
			testLegacyTaskDispatchStatusPending,
			testLegacyTaskDispatchStatusRunning,
			now,
		).
		Updates(map[string]any{
			"dispatch_status":     testLegacyTaskDispatchStatusRunning,
			"dispatch_owner":      owner,
			"dispatch_lock_until": lockUntil,
			"dispatch_attempts":   gorm.Expr("dispatch_attempts + ?", 1),
			"dispatch_error":      "",
		})
}

func requeueDeferredTaskLike720944a(
	db *gorm.DB,
	id int64,
	owner, reason string,
) *gorm.DB {
	return db.Model(&Task{}).
		Where("id = ? AND dispatch_status = ? AND dispatch_owner = ?",
			id, testLegacyTaskDispatchStatusRunning, owner).
		Updates(map[string]any{
			"dispatch_status":     testLegacyTaskDispatchStatusPending,
			"dispatch_owner":      "",
			"dispatch_lock_until": 0,
			"dispatch_error":      reason,
		})
}

func TestRC40MixedVersionOld720944aPredicatesIgnoreCurrentStates(t *testing.T) {
	truncateTables(t)
	assert.Equal(t, "pending_v1", string(TaskDispatchStatusPending))
	assert.Equal(t, "running_v1", string(TaskDispatchStatusRunning))

	currentPending := &Task{
		TaskID:         "task_current_pending_old_predicates",
		Status:         TaskStatusNotStart,
		Progress:       "0%",
		ExecutionMode:  TaskExecutionModeDeferred,
		DispatchStatus: TaskDispatchStatusPending,
	}
	currentRunning := &Task{
		TaskID:                  "task_current_running_old_predicates",
		Status:                  TaskStatusNotStart,
		Progress:                "0%",
		ExecutionMode:           TaskExecutionModeDeferred,
		DispatchStatus:          TaskDispatchStatusRunning,
		DispatchOwner:           "current-owner",
		DispatchLockUntil:       99,
		DispatchProtocolVersion: CurrentTaskDispatchProtocolVersion,
	}
	insertTask(t, currentPending)
	insertTask(t, currentRunning)

	found, err := findDispatchableDeferredTasksLike720944a(DB, 100, 10)
	require.NoError(t, err)
	assert.Empty(t, found)

	oldRequeue := requeueDeferredTaskLike720944a(
		DB,
		currentRunning.ID,
		"current-owner",
		"old retry",
	)
	require.NoError(t, oldRequeue.Error)
	assert.Zero(t, oldRequeue.RowsAffected)

	oldPendingClaim := claimDeferredTaskLike720944a(
		DB,
		currentPending.ID,
		"old-pending-owner",
		100,
		200,
	)
	require.NoError(t, oldPendingClaim.Error)
	assert.Zero(t, oldPendingClaim.RowsAffected)

	oldRunningClaim := claimDeferredTaskLike720944a(
		DB,
		currentRunning.ID,
		"old-running-owner",
		100,
		200,
	)
	require.NoError(t, oldRunningClaim.Error)
	assert.Zero(t, oldRunningClaim.RowsAffected)
}

func TestRC40MixedVersionCurrentLeaseCannotBeReclaimedOrRequeuedBy720944a(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID:         "task_current_mixed_sequence",
		Status:         TaskStatusNotStart,
		Progress:       "0%",
		ExecutionMode:  TaskExecutionModeDeferred,
		DispatchStatus: TaskDispatchStatusPending,
	}
	insertTask(t, task)

	claimed, won, err := ClaimDeferredTask(task.ID, "current-owner", 100, 200)
	require.NoError(t, err)
	require.True(t, won)
	assert.Equal(t, TaskDispatchStatus("running_v1"), claimed.DispatchStatus)
	assert.Equal(t, CurrentTaskDispatchProtocolVersion, claimed.DispatchProtocolVersion)

	oldTransaction := DB.Begin()
	require.NoError(t, oldTransaction.Error)
	oldClaim := claimDeferredTaskLike720944a(oldTransaction, task.ID, "old-owner", 201, 301)
	require.NoError(t, oldClaim.Error)
	assert.Zero(t, oldClaim.RowsAffected)
	require.NoError(t, oldTransaction.Rollback().Error)

	oldRequeue := requeueDeferredTaskLike720944a(
		DB,
		task.ID,
		"current-owner",
		"old retry after expiry",
	)
	require.NoError(t, oldRequeue.Error)
	assert.Zero(t, oldRequeue.RowsAffected)

	reclaimed, won, err := ClaimDeferredTask(task.ID, "current-reclaimer", 201, 301)
	require.NoError(t, err)
	require.True(t, won)
	assert.Equal(t, TaskDispatchStatus("running_v1"), reclaimed.DispatchStatus)
	assert.Equal(t, CurrentTaskDispatchProtocolVersion, reclaimed.DispatchProtocolVersion)
	assert.Equal(t, "current-reclaimer", reclaimed.DispatchOwner)
	assert.Equal(t, 2, reclaimed.DispatchAttempts)

	malformed := &Task{
		TaskID:                  "task_current_v0_not_reclaimable",
		Status:                  TaskStatusNotStart,
		Progress:                "0%",
		ExecutionMode:           TaskExecutionModeDeferred,
		DispatchStatus:          TaskDispatchStatus("running_v1"),
		DispatchOwner:           "malformed-owner",
		DispatchLockUntil:       99,
		DispatchProtocolVersion: 0,
	}
	insertTask(t, malformed)
	_, won, err = ClaimDeferredTask(malformed.ID, "current-reclaimer", 100, 200)
	require.NoError(t, err)
	assert.False(t, won)
}

func TestRC40MixedVersionLegacyPendingCASHasSingleOwner(t *testing.T) {
	t.Run("old wins", func(t *testing.T) {
		truncateTables(t)
		task := &Task{
			TaskID:         "task_legacy_pending_old_wins",
			Status:         TaskStatusNotStart,
			Progress:       "0%",
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: testLegacyTaskDispatchStatusPending,
		}
		insertTask(t, task)

		oldClaim := claimDeferredTaskLike720944a(DB, task.ID, "old-owner", 100, 200)
		require.NoError(t, oldClaim.Error)
		require.EqualValues(t, 1, oldClaim.RowsAffected)
		_, newWon, err := ClaimDeferredTask(task.ID, "current-owner", 100, 200)
		require.NoError(t, err)
		assert.False(t, newWon)

		var stored Task
		require.NoError(t, DB.First(&stored, task.ID).Error)
		assert.Equal(t, testLegacyTaskDispatchStatusRunning, stored.DispatchStatus)
		assert.Equal(t, "old-owner", stored.DispatchOwner)
		assert.Zero(t, stored.DispatchProtocolVersion)
		assert.Equal(t, 1, stored.DispatchAttempts)
	})

	t.Run("current wins", func(t *testing.T) {
		truncateTables(t)
		task := &Task{
			TaskID:         "task_legacy_pending_current_wins",
			Status:         TaskStatusNotStart,
			Progress:       "0%",
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: testLegacyTaskDispatchStatusPending,
		}
		insertTask(t, task)

		claimed, newWon, err := ClaimDeferredTask(task.ID, "current-owner", 100, 200)
		require.NoError(t, err)
		require.True(t, newWon)
		assert.Equal(t, TaskDispatchStatus("running_v1"), claimed.DispatchStatus)
		assert.Equal(t, CurrentTaskDispatchProtocolVersion, claimed.DispatchProtocolVersion)

		oldClaim := claimDeferredTaskLike720944a(DB, task.ID, "old-owner", 100, 200)
		require.NoError(t, oldClaim.Error)
		assert.Zero(t, oldClaim.RowsAffected)

		var stored Task
		require.NoError(t, DB.First(&stored, task.ID).Error)
		assert.Equal(t, TaskDispatchStatus("running_v1"), stored.DispatchStatus)
		assert.Equal(t, "current-owner", stored.DispatchOwner)
		assert.Equal(t, CurrentTaskDispatchProtocolVersion, stored.DispatchProtocolVersion)
		assert.Equal(t, 1, stored.DispatchAttempts)
	})
}

func TestDeferredTaskClaimRecoversExpiredLeaseAndCompletes(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID:         "task_deferred_claim",
		Status:         TaskStatusNotStart,
		Progress:       "0%",
		ExecutionMode:  TaskExecutionModeDeferred,
		DispatchStatus: TaskDispatchStatusPending,
		PrivateData: TaskPrivateData{
			DeferredRequest: &TaskDeferredRequest{
				Path:        "/v1/responses",
				Method:      "POST",
				RequestBody: json.RawMessage(`{"model":"image-model","prompt":"hello"}`),
			},
		},
	}
	insertTask(t, task)

	assert.True(t, HasDispatchableDeferredTasks(100))
	candidates, err := FindDispatchableDeferredTasks(100, 10)
	require.NoError(t, err)
	require.Len(t, candidates, 1)

	claimed, won, err := ClaimDeferredTask(task.ID, "runner-a", 100, 200)
	require.NoError(t, err)
	require.True(t, won)
	assert.Equal(t, TaskDispatchStatusRunning, claimed.DispatchStatus)
	assert.Equal(t, CurrentTaskDispatchProtocolVersion, claimed.DispatchProtocolVersion)
	assert.Equal(t, 1, claimed.DispatchAttempts)
	assert.False(t, HasDispatchableDeferredTasks(150))

	_, won, err = ClaimDeferredTask(task.ID, "runner-b", 150, 250)
	require.NoError(t, err)
	assert.False(t, won)

	claimed, won, err = ClaimDeferredTask(task.ID, "runner-b", 201, 301)
	require.NoError(t, err)
	require.True(t, won)
	assert.Equal(t, CurrentTaskDispatchProtocolVersion, claimed.DispatchProtocolVersion)
	assert.Equal(t, 2, claimed.DispatchAttempts)

	won, err = RequeueDeferredTask(claimed, "runner-b", "temporary failure")
	require.NoError(t, err)
	require.True(t, won)
	assert.True(t, HasDispatchableDeferredTasks(202))

	claimed, won, err = ClaimDeferredTask(task.ID, "runner-c", 202, 302)
	require.NoError(t, err)
	require.True(t, won)
	claimed.Status = TaskStatusSubmitted
	claimed.Progress = "10%"
	claimed.PrivateData.UpstreamTaskID = "upstream-private"
	claimed.PrivateData.DeferredRequest = nil
	fenced, err := FenceDeferredTaskProviderSubmit(claimed, "runner-c", 203)
	require.NoError(t, err)
	require.True(t, fenced)
	won, err = CompleteDeferredTask(claimed, "runner-c")
	require.NoError(t, err)
	require.True(t, won)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskDispatchStatusDispatched, stored.DispatchStatus)
	assert.Equal(t, TaskStatus(TaskStatusSubmitted), stored.Status)
	assert.Equal(t, "upstream-private", stored.PrivateData.UpstreamTaskID)
	assert.Nil(t, stored.PrivateData.DeferredRequest)
	assert.False(t, HasDispatchableDeferredTasks(400))
}

func TestDeferredTaskClaimDoesNotRecoverExpiredLegacyLease(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID:                  "task_deferred_legacy_expired",
		Status:                  TaskStatusNotStart,
		Progress:                "0%",
		ExecutionMode:           TaskExecutionModeDeferred,
		DispatchStatus:          testLegacyTaskDispatchStatusRunning,
		DispatchOwner:           "legacy-runner",
		DispatchLockUntil:       99,
		DispatchAttempts:        1,
		DispatchProtocolVersion: 0,
	}
	insertTask(t, task)

	assert.False(t, HasDispatchableDeferredTasks(100))
	candidates, err := FindDispatchableDeferredTasks(100, 10)
	require.NoError(t, err)
	assert.Empty(t, candidates)

	_, won, err := ClaimDeferredTask(task.ID, "runner-current", 100, 200)
	require.NoError(t, err)
	assert.False(t, won)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, testLegacyTaskDispatchStatusRunning, stored.DispatchStatus)
	assert.Equal(t, "legacy-runner", stored.DispatchOwner)
	assert.Equal(t, int64(99), stored.DispatchLockUntil)
	assert.Equal(t, 1, stored.DispatchAttempts)
	assert.Zero(t, stored.DispatchProtocolVersion)
}

func TestDeferredTaskFencePersistsUncertainStateTimestampAndOwner(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID:         "task_deferred_atomic_fence",
		Status:         TaskStatusNotStart,
		Progress:       "0%",
		ExecutionMode:  TaskExecutionModeDeferred,
		DispatchStatus: TaskDispatchStatusPending,
		PrivateData: TaskPrivateData{
			DeferredRequest: &TaskDeferredRequest{RequestBody: json.RawMessage(`{}`)},
		},
	}
	insertTask(t, task)
	claimed, won, err := ClaimDeferredTask(task.ID, "runner-fence", 100, 200)
	require.NoError(t, err)
	require.True(t, won)

	fenced, err := FenceDeferredTaskProviderSubmit(claimed, "runner-fence", 150)
	require.NoError(t, err)
	require.True(t, fenced)
	assert.Equal(t, TaskDispatchStatusUncertain, claimed.DispatchStatus)
	assert.Equal(t, int64(150), claimed.DispatchStartedAt)
	assert.Equal(t, "runner-fence", claimed.DispatchOwner)
	assert.Zero(t, claimed.DispatchLockUntil)
	assert.Contains(t, claimed.DispatchError, "provider submission")

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskDispatchStatusUncertain, stored.DispatchStatus)
	assert.Equal(t, int64(150), stored.DispatchStartedAt)
	assert.Equal(t, "runner-fence", stored.DispatchOwner)
	assert.Zero(t, stored.DispatchLockUntil)
	assert.Contains(t, stored.DispatchError, "provider submission")
}

func TestDeferredTaskUncertainCompletionRequiresOwner(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID:         "task_deferred_uncertain_completion",
		Status:         TaskStatusNotStart,
		Progress:       "0%",
		ExecutionMode:  TaskExecutionModeDeferred,
		DispatchStatus: TaskDispatchStatusPending,
		PrivateData: TaskPrivateData{
			DeferredRequest: &TaskDeferredRequest{RequestBody: json.RawMessage(`{}`)},
		},
	}
	insertTask(t, task)
	claimed, won, err := ClaimDeferredTask(task.ID, "runner-owner", 100, 200)
	require.NoError(t, err)
	require.True(t, won)
	fenced, err := FenceDeferredTaskProviderSubmit(claimed, "runner-owner", 150)
	require.NoError(t, err)
	require.True(t, fenced)

	claimed.Status = TaskStatusSubmitted
	claimed.Progress = "10%"
	claimed.PrivateData.UpstreamTaskID = "upstream-owner"
	claimed.PrivateData.DeferredRequest = nil
	won, err = CompleteDeferredTask(claimed, "runner-wrong")
	require.NoError(t, err)
	assert.False(t, won)
	won, err = CompleteDeferredTask(claimed, "runner-owner")
	require.NoError(t, err)
	require.True(t, won)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskDispatchStatusDispatched, stored.DispatchStatus)
	assert.Equal(t, "upstream-owner", stored.PrivateData.UpstreamTaskID)
	assert.Empty(t, stored.DispatchOwner)
}

func TestDeferredTaskUncertainRequiresExplicitPreIORequeue(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID:         "task_deferred_uncertain_requeue",
		Status:         TaskStatusNotStart,
		Progress:       "0%",
		ExecutionMode:  TaskExecutionModeDeferred,
		DispatchStatus: TaskDispatchStatusPending,
	}
	insertTask(t, task)
	claimed, won, err := ClaimDeferredTask(task.ID, "runner-requeue", 100, 200)
	require.NoError(t, err)
	require.True(t, won)
	fenced, err := FenceDeferredTaskProviderSubmit(claimed, "runner-requeue", 150)
	require.NoError(t, err)
	require.True(t, fenced)

	won, err = RequeueDeferredTask(claimed, "runner-requeue", "generic failure")
	require.NoError(t, err)
	assert.False(t, won)
	won, err = RequeueDeferredTaskBeforeProviderIO(claimed, "runner-requeue", "context canceled")
	require.NoError(t, err)
	require.True(t, won)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskDispatchStatusPending, stored.DispatchStatus)
	assert.Zero(t, stored.DispatchStartedAt)
	assert.Empty(t, stored.DispatchOwner)
	assert.Equal(t, "context canceled", stored.DispatchError)
}

func TestDeferredTaskUncertainAndLegacyFenceStayOutOfAutomaticWorkers(t *testing.T) {
	truncateTables(t)
	tasks := []*Task{
		{
			TaskID:            "task_deferred_uncertain",
			Status:            TaskStatusNotStart,
			Progress:          "0%",
			SubmitTime:        1,
			ExecutionMode:     TaskExecutionModeDeferred,
			DispatchStatus:    TaskDispatchStatusUncertain,
			DispatchOwner:     "runner-uncertain",
			DispatchStartedAt: 2,
		},
		{
			TaskID:            "task_deferred_legacy_fence",
			Status:            TaskStatusNotStart,
			Progress:          "0%",
			SubmitTime:        1,
			ExecutionMode:     TaskExecutionModeDeferred,
			DispatchStatus:    testLegacyTaskDispatchStatusRunning,
			DispatchOwner:     "runner-legacy",
			DispatchLockUntil: math.MaxInt64,
		},
		{
			TaskID:            "task_deferred_legacy_expired",
			Status:            TaskStatusNotStart,
			Progress:          "0%",
			SubmitTime:        1,
			ExecutionMode:     TaskExecutionModeDeferred,
			DispatchStatus:    testLegacyTaskDispatchStatusRunning,
			DispatchOwner:     "runner-legacy-expired",
			DispatchLockUntil: 9,
		},
		{
			TaskID:            "task_deferred_legacy_active",
			Status:            TaskStatusNotStart,
			Progress:          "0%",
			SubmitTime:        1,
			ExecutionMode:     TaskExecutionModeDeferred,
			DispatchStatus:    testLegacyTaskDispatchStatusRunning,
			DispatchOwner:     "runner-legacy-active",
			DispatchLockUntil: 11,
		},
	}
	for _, task := range tasks {
		insertTask(t, task)
	}

	assert.False(t, HasDispatchableDeferredTasks(10))
	dispatchable, err := FindDispatchableDeferredTasks(10, 10)
	require.NoError(t, err)
	assert.Empty(t, dispatchable)
	for _, task := range tasks {
		_, won, claimErr := ClaimDeferredTask(task.ID, "runner-new", 10, 20)
		require.NoError(t, claimErr)
		assert.False(t, won)
	}
	assert.Empty(t, GetAllUnFinishSyncTasks(10))
	assert.Empty(t, GetTimedOutUnfinishedTasks(10, 10))
	count, err := CountUncertainDeferredTasksAt(10)
	require.NoError(t, err)
	assert.EqualValues(t, 3, count)
	assert.True(t, tasks[0].RequiresOperatorResolutionAt(10))
	assert.True(t, tasks[1].RequiresOperatorResolutionAt(10))
	assert.True(t, tasks[2].RequiresOperatorResolutionAt(10))
	assert.False(t, tasks[3].RequiresOperatorResolutionAt(10))
	assert.True(t, tasks[3].RequiresOperatorResolutionAt(12))
	assert.Equal(t, int64(2), tasks[0].EffectiveDispatchStartedAt())
	assert.Equal(t, int64(1), tasks[1].EffectiveDispatchStartedAt())
}

func TestTaskDispatchStatusFilterIncludesLegacyUncertainAndCountParity(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	tasks := []*Task{
		{
			TaskID:            "task_filter_uncertain",
			Status:            TaskStatusNotStart,
			ExecutionMode:     TaskExecutionModeDeferred,
			DispatchStatus:    TaskDispatchStatusUncertain,
			DispatchStartedAt: 10,
		},
		{
			TaskID:            "task_filter_legacy_uncertain",
			Status:            TaskStatusNotStart,
			ExecutionMode:     TaskExecutionModeDeferred,
			DispatchStatus:    testLegacyTaskDispatchStatusRunning,
			DispatchLockUntil: math.MaxInt64,
		},
		{
			TaskID:            "task_filter_legacy_expired",
			Status:            TaskStatusNotStart,
			ExecutionMode:     TaskExecutionModeDeferred,
			DispatchStatus:    testLegacyTaskDispatchStatusRunning,
			DispatchLockUntil: now - 1,
		},
		{
			TaskID:            "task_filter_legacy_active",
			Status:            TaskStatusNotStart,
			ExecutionMode:     TaskExecutionModeDeferred,
			DispatchStatus:    testLegacyTaskDispatchStatusRunning,
			DispatchLockUntil: now + 3600,
		},
		{
			TaskID:                  "task_filter_current_expired",
			Status:                  TaskStatusNotStart,
			ExecutionMode:           TaskExecutionModeDeferred,
			DispatchStatus:          TaskDispatchStatusRunning,
			DispatchLockUntil:       now - 1,
			DispatchProtocolVersion: CurrentTaskDispatchProtocolVersion,
		},
		{
			TaskID:         "task_filter_pending",
			Status:         TaskStatusNotStart,
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: TaskDispatchStatusPending,
		},
		{
			TaskID:         "task_filter_legacy_pending",
			Status:         TaskStatusNotStart,
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: testLegacyTaskDispatchStatusPending,
		},
	}
	for _, task := range tasks {
		insertTask(t, task)
	}

	var filtered []*Task
	require.NoError(t, applyTaskDispatchStatusFilterAt(
		DB.Model(&Task{}),
		string(TaskDispatchStatusUncertain),
		now,
	).Order("id").Find(&filtered).Error)
	require.Len(t, filtered, 3)
	count, err := CountUncertainDeferredTasksAt(now)
	require.NoError(t, err)
	assert.EqualValues(t, len(filtered), count)
	ids := []string{filtered[0].TaskID, filtered[1].TaskID}
	assert.ElementsMatch(t, []string{
		"task_filter_uncertain",
		"task_filter_legacy_uncertain",
		"task_filter_legacy_expired",
	}, append(ids, filtered[2].TaskID))

	uncertainQuery := SyncTaskQueryParams{DispatchStatus: string(TaskDispatchStatusUncertain)}
	listed := TaskGetAllTasks(0, 10, uncertainQuery)
	require.Len(t, listed, 3)
	assert.EqualValues(t, len(listed), TaskCountAllTasks(uncertainQuery))

	pendingQuery := SyncTaskQueryParams{DispatchStatus: string(TaskDispatchStatusPending)}
	pending := TaskGetAllTasks(0, 10, pendingQuery)
	require.Len(t, pending, 2)
	assert.ElementsMatch(t, []string{
		"task_filter_pending",
		"task_filter_legacy_pending",
	}, []string{pending[0].TaskID, pending[1].TaskID})
	assert.EqualValues(t, len(pending), TaskCountAllTasks(pendingQuery))

	legacyPendingQuery := SyncTaskQueryParams{DispatchStatus: string(testLegacyTaskDispatchStatusPending)}
	legacyPending := TaskGetAllTasks(0, 10, legacyPendingQuery)
	require.Len(t, legacyPending, 2)
	assert.EqualValues(t, len(legacyPending), TaskCountAllTasks(legacyPendingQuery))
}

func TestResolveDeferredTaskAcceptsOnlyExpiredLegacyFiniteLease(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID:            "task_deferred_legacy_resolution",
		Status:            TaskStatusNotStart,
		Progress:          "0%",
		SubmitTime:        10,
		ExecutionMode:     TaskExecutionModeDeferred,
		DispatchStatus:    testLegacyTaskDispatchStatusRunning,
		DispatchOwner:     "legacy-runner",
		DispatchLockUntil: 101,
		PrivateData: TaskPrivateData{
			DeferredRequest: &TaskDeferredRequest{RequestBody: json.RawMessage(`{}`)},
		},
	}
	insertTask(t, task)

	won, err := ResolveDeferredTask(task, true, "upstream-too-early", "active lease", 100)
	require.NoError(t, err)
	assert.False(t, won)

	won, err = ResolveDeferredTask(task, true, "upstream-confirmed", "expired legacy lease", 102)
	require.NoError(t, err)
	require.True(t, won)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskDispatchStatusDispatched, stored.DispatchStatus)
	assert.Equal(t, "upstream-confirmed", stored.PrivateData.UpstreamTaskID)
	assert.Nil(t, stored.PrivateData.DeferredRequest)
}

func TestTaskPollingExcludesUndispatchedDeferredTasks(t *testing.T) {
	truncateTables(t)
	tasks := []*Task{
		{
			TaskID:         "task_deferred_pending",
			Status:         TaskStatusNotStart,
			Progress:       "0%",
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: TaskDispatchStatusPending,
		},
		{
			TaskID:         "task_deferred_dispatched",
			Status:         TaskStatusSubmitted,
			Progress:       "10%",
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: TaskDispatchStatusDispatched,
			PrivateData:    TaskPrivateData{UpstreamTaskID: "upstream-deferred"},
		},
		{
			TaskID:      "task_legacy",
			Status:      TaskStatusSubmitted,
			Progress:    "10%",
			PrivateData: TaskPrivateData{UpstreamTaskID: "upstream-legacy"},
		},
	}
	for _, task := range tasks {
		insertTask(t, task)
	}

	polled := GetAllUnFinishSyncTasks(10)
	ids := make([]string, 0, len(polled))
	for _, task := range polled {
		ids = append(ids, task.TaskID)
	}
	assert.ElementsMatch(t, []string{"task_deferred_dispatched", "task_legacy"}, ids)
}

func TestTimedOutTasksExcludeUndispatchedDeferredTasks(t *testing.T) {
	truncateTables(t)
	tasks := []*Task{
		{
			TaskID:         "task_deferred_pending_timeout",
			Status:         TaskStatusNotStart,
			Progress:       "0%",
			SubmitTime:     1,
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: TaskDispatchStatusPending,
		},
		{
			TaskID:            "task_deferred_uncertain_timeout",
			Status:            TaskStatusNotStart,
			Progress:          "0%",
			SubmitTime:        1,
			ExecutionMode:     TaskExecutionModeDeferred,
			DispatchStatus:    TaskDispatchStatusUncertain,
			DispatchStartedAt: 1,
		},
		{
			TaskID:                  "task_deferred_fenced_timeout",
			Status:                  TaskStatusNotStart,
			Progress:                "0%",
			SubmitTime:              1,
			ExecutionMode:           TaskExecutionModeDeferred,
			DispatchStatus:          TaskDispatchStatusRunning,
			DispatchOwner:           "runner-fenced",
			DispatchLockUntil:       math.MaxInt64,
			DispatchProtocolVersion: CurrentTaskDispatchProtocolVersion,
		},
		{
			TaskID:         "task_deferred_dispatched_timeout",
			Status:         TaskStatusSubmitted,
			Progress:       "10%",
			SubmitTime:     1,
			StartTime:      1,
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: TaskDispatchStatusDispatched,
		},
		{
			TaskID:         "task_deferred_dispatched_legacy_timeout",
			Status:         TaskStatusSubmitted,
			Progress:       "10%",
			SubmitTime:     2,
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: TaskDispatchStatusDispatched,
		},
		{
			TaskID:     "task_foreground_timeout",
			Status:     TaskStatusInProgress,
			Progress:   "50%",
			SubmitTime: 3,
			StartTime:  100,
		},
		{
			TaskID:        "task_app_managed_timeout",
			Status:        TaskStatusInProgress,
			Progress:      "50%",
			SubmitTime:    1,
			ExecutionMode: TaskExecutionModeAppManaged,
		},
	}
	for _, task := range tasks {
		insertTask(t, task)
	}

	timedOut := GetTimedOutUnfinishedTasks(10, 10)
	ids := make([]string, 0, len(timedOut))
	for _, task := range timedOut {
		ids = append(ids, task.TaskID)
	}
	assert.Equal(t, []string{
		"task_deferred_dispatched_timeout",
		"task_deferred_dispatched_legacy_timeout",
		"task_foreground_timeout",
	}, ids)

	limited := GetTimedOutUnfinishedTasks(10, 2)
	require.Len(t, limited, 2)
	assert.Equal(t, "task_deferred_dispatched_timeout", limited[0].TaskID)
	assert.Equal(t, "task_deferred_dispatched_legacy_timeout", limited[1].TaskID)
}

func TestTimedOutTasksUseResolutionStartTimeForDeferredProviderAccepted(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID:            "task_deferred_resolved_recently",
		Status:            TaskStatusNotStart,
		Progress:          "0%",
		SubmitTime:        10,
		ExecutionMode:     TaskExecutionModeDeferred,
		DispatchStatus:    TaskDispatchStatusUncertain,
		DispatchStartedAt: 20,
		PrivateData: TaskPrivateData{
			DeferredRequest: &TaskDeferredRequest{RequestBody: json.RawMessage(`{}`)},
		},
	}
	insertTask(t, task)

	won, err := ResolveDeferredTask(task, true, "upstream-resolved", "provider confirmed acceptance", 100)
	require.NoError(t, err)
	require.True(t, won)
	require.Equal(t, int64(100), task.StartTime)

	assert.Empty(t, GetTimedOutUnfinishedTasks(50, 10))
}

func TestTimeoutWithStatusRejectsDeferredTaskFencedAfterSelection(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID:         "task_deferred_timeout_cas",
		Status:         TaskStatusInProgress,
		Progress:       "50%",
		Quota:          1_200,
		SubmitTime:     1,
		ExecutionMode:  TaskExecutionModeDeferred,
		DispatchStatus: TaskDispatchStatusPending,
	}
	insertTask(t, task)

	var stale Task
	require.NoError(t, DB.First(&stale, task.ID).Error)
	require.NoError(t, DB.Model(&Task{}).Where("id = ?", task.ID).Updates(map[string]any{
		"dispatch_status":           TaskDispatchStatusRunning,
		"dispatch_owner":            "runner-fenced",
		"dispatch_lock_until":       int64(math.MaxInt64),
		"dispatch_attempts":         1,
		"dispatch_protocol_version": CurrentTaskDispatchProtocolVersion,
	}).Error)

	oldStatus := stale.Status
	stale.Status = TaskStatusFailure
	stale.Progress = "100%"
	stale.FailReason = "timed out"
	stale.FinishTime = 2
	won, err := stale.TimeoutWithStatus(oldStatus, 10)
	require.NoError(t, err)
	assert.False(t, won)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusInProgress), stored.Status)
	assert.Equal(t, "50%", stored.Progress)
	assert.Equal(t, TaskDispatchStatusRunning, stored.DispatchStatus)
	assert.Equal(t, "runner-fenced", stored.DispatchOwner)
	assert.Equal(t, int64(math.MaxInt64), stored.DispatchLockUntil)
	assert.Equal(t, 1, stored.DispatchAttempts)
	assert.Equal(t, 1_200, stored.Quota)
}

func TestTimeoutWithStatusRejectsDeferredTaskWhoseStartTimeRefreshesAfterSelection(t *testing.T) {
	truncateTables(t)
	const cutoff = int64(100)
	task := &Task{
		TaskID:         "task_deferred_timeout_start_refreshed",
		Status:         TaskStatusInProgress,
		Progress:       "50%",
		Quota:          1_200,
		SubmitTime:     1,
		StartTime:      2,
		ExecutionMode:  TaskExecutionModeDeferred,
		DispatchStatus: TaskDispatchStatusDispatched,
	}
	insertTask(t, task)

	selected := GetTimedOutUnfinishedTasks(cutoff, 10)
	require.Len(t, selected, 1)
	stale := selected[0]
	require.NoError(t, DB.Model(&Task{}).Where("id = ?", task.ID).
		Update("start_time", cutoff).Error)

	oldStatus := stale.Status
	stale.Status = TaskStatusFailure
	stale.Progress = "100%"
	stale.FailReason = "timed out"
	stale.FinishTime = cutoff
	won, err := stale.TimeoutWithStatus(oldStatus, cutoff)
	require.NoError(t, err)
	assert.False(t, won)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusInProgress), stored.Status)
	assert.Equal(t, "50%", stored.Progress)
	assert.Equal(t, cutoff, stored.StartTime)
	assert.Equal(t, TaskDispatchStatusDispatched, stored.DispatchStatus)
	assert.Equal(t, 1_200, stored.Quota)
}

func TestTimeoutWithStatusMatchesTimeoutSelectionAnchorsAndFences(t *testing.T) {
	truncateTables(t)
	const cutoff = int64(100)
	testCases := []struct {
		name string
		task Task
		won  bool
	}{
		{
			name: "deferred dispatched old start time",
			task: Task{
				SubmitTime:     1,
				StartTime:      2,
				ExecutionMode:  TaskExecutionModeDeferred,
				DispatchStatus: TaskDispatchStatusDispatched,
			},
			won: true,
		},
		{
			name: "deferred dispatched zero start uses submit time",
			task: Task{
				SubmitTime:     2,
				ExecutionMode:  TaskExecutionModeDeferred,
				DispatchStatus: TaskDispatchStatusDispatched,
			},
			won: true,
		},
		{
			name: "foreground uses submit time despite recent start",
			task: Task{
				SubmitTime: 3,
				StartTime:  cutoff,
			},
			won: true,
		},
		{
			name: "deferred pending remains fenced",
			task: Task{
				SubmitTime:     1,
				StartTime:      2,
				ExecutionMode:  TaskExecutionModeDeferred,
				DispatchStatus: TaskDispatchStatusPending,
			},
		},
		{
			name: "deferred uncertain remains fenced",
			task: Task{
				SubmitTime:     1,
				StartTime:      2,
				ExecutionMode:  TaskExecutionModeDeferred,
				DispatchStatus: TaskDispatchStatusUncertain,
			},
		},
		{
			name: "deferred running remains fenced",
			task: Task{
				SubmitTime:              1,
				StartTime:               2,
				ExecutionMode:           TaskExecutionModeDeferred,
				DispatchStatus:          TaskDispatchStatusRunning,
				DispatchOwner:           "runner-fenced",
				DispatchLockUntil:       math.MaxInt64,
				DispatchProtocolVersion: CurrentTaskDispatchProtocolVersion,
			},
		},
	}

	for index, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			task := test.task
			task.TaskID = "task_timeout_anchor_control_" + string(rune('a'+index))
			task.Status = TaskStatusInProgress
			task.Progress = "50%"
			task.Quota = 1_200
			insertTask(t, &task)

			task.Status = TaskStatusFailure
			task.Progress = "100%"
			task.FailReason = "timed out"
			task.FinishTime = cutoff
			won, err := task.TimeoutWithStatus(TaskStatus(TaskStatusInProgress), cutoff)
			require.NoError(t, err)
			assert.Equal(t, test.won, won)

			var stored Task
			require.NoError(t, DB.First(&stored, task.ID).Error)
			if test.won {
				assert.Equal(t, TaskStatus(TaskStatusFailure), stored.Status)
				assert.Equal(t, "100%", stored.Progress)
			} else {
				assert.Equal(t, TaskStatus(TaskStatusInProgress), stored.Status)
				assert.Equal(t, "50%", stored.Progress)
				assert.Equal(t, test.task.DispatchStatus, stored.DispatchStatus)
			}
		})
	}
}

func TestTimeoutEligibilityDatabaseMatrix(t *testing.T) {
	db := openTimeoutEligibilityTestDB(t)
	const cutoff = int64(100)
	tasks := []*Task{
		{
			TaskID:         "task_timeout_matrix_refreshed",
			Status:         TaskStatusInProgress,
			Progress:       "50%",
			Quota:          1_200,
			SubmitTime:     1,
			StartTime:      2,
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: TaskDispatchStatusDispatched,
		},
		{
			TaskID:         "task_timeout_matrix_old_start",
			Status:         TaskStatusInProgress,
			Progress:       "50%",
			SubmitTime:     2,
			StartTime:      3,
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: TaskDispatchStatusDispatched,
		},
		{
			TaskID:         "task_timeout_matrix_zero_start",
			Status:         TaskStatusInProgress,
			Progress:       "50%",
			SubmitTime:     3,
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: TaskDispatchStatusDispatched,
		},
		{
			TaskID:     "task_timeout_matrix_foreground",
			Status:     TaskStatusInProgress,
			Progress:   "50%",
			SubmitTime: 4,
			StartTime:  cutoff,
		},
		{
			TaskID:         "task_timeout_matrix_pending",
			Status:         TaskStatusInProgress,
			Progress:       "50%",
			SubmitTime:     5,
			StartTime:      6,
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: TaskDispatchStatusPending,
		},
	}
	require.NoError(t, db.Create(&tasks).Error)

	selected := GetTimedOutUnfinishedTasks(cutoff, 10)
	require.Len(t, selected, 4)
	selectedByTaskID := make(map[string]*Task, len(selected))
	for _, task := range selected {
		selectedByTaskID[task.TaskID] = task
	}
	require.NoError(t, db.Model(&Task{}).
		Where("id = ?", tasks[0].ID).
		Update("start_time", cutoff).Error)

	for _, taskID := range []string{
		"task_timeout_matrix_refreshed",
		"task_timeout_matrix_old_start",
		"task_timeout_matrix_zero_start",
		"task_timeout_matrix_foreground",
	} {
		task := selectedByTaskID[taskID]
		require.NotNil(t, task)
		task.Status = TaskStatusFailure
		task.Progress = "100%"
		task.FinishTime = cutoff
		won, err := task.TimeoutWithStatus(TaskStatus(TaskStatusInProgress), cutoff)
		require.NoError(t, err)
		assert.Equal(t, taskID != "task_timeout_matrix_refreshed", won)
	}

	pending := tasks[4]
	pending.Status = TaskStatusFailure
	pending.Progress = "100%"
	pending.FinishTime = cutoff
	won, err := pending.TimeoutWithStatus(TaskStatus(TaskStatusInProgress), cutoff)
	require.NoError(t, err)
	assert.False(t, won)

	var stored []*Task
	require.NoError(t, db.Order("id").Find(&stored).Error)
	require.Len(t, stored, len(tasks))
	assert.Equal(t, TaskStatus(TaskStatusInProgress), stored[0].Status)
	assert.Equal(t, cutoff, stored[0].StartTime)
	assert.Equal(t, 1_200, stored[0].Quota)
	for _, task := range stored[1:4] {
		assert.Equal(t, TaskStatus(TaskStatusFailure), task.Status)
		assert.Equal(t, "100%", task.Progress)
	}
	assert.Equal(t, TaskStatus(TaskStatusInProgress), stored[4].Status)
	assert.Equal(t, TaskDispatchStatusPending, stored[4].DispatchStatus)
}

type legacyDeferredDispatchTaskSchema struct {
	ID                int64              `gorm:"primaryKey"`
	TaskID            string             `gorm:"type:varchar(191);index"`
	Status            TaskStatus         `gorm:"type:varchar(20);index"`
	Progress          string             `gorm:"type:varchar(20);index"`
	ExecutionMode     string             `gorm:"type:varchar(20);index"`
	DispatchStatus    TaskDispatchStatus `gorm:"type:varchar(20);index"`
	DispatchOwner     string             `gorm:"type:varchar(128)"`
	DispatchLockUntil int64              `gorm:"index"`
	DispatchAttempts  int
	DispatchError     string `gorm:"type:text"`
}

func TestDeferredDispatchStatusDatabaseMatrix(t *testing.T) {
	db := openTimeoutEligibilityTestDB(t)
	assert.LessOrEqual(t, len(TaskDispatchStatusPending), 20)
	assert.LessOrEqual(t, len(TaskDispatchStatusRunning), 20)

	columnTypes, err := db.Migrator().ColumnTypes(&Task{})
	require.NoError(t, err)
	var dispatchStatusLength int64
	var dispatchStatusLengthKnown bool
	for _, columnType := range columnTypes {
		if columnType.Name() != "dispatch_status" {
			continue
		}
		dispatchStatusLength, dispatchStatusLengthKnown = columnType.Length()
		break
	}
	require.True(t, dispatchStatusLengthKnown)
	assert.EqualValues(t, 20, dispatchStatusLength)

	fresh := []*Task{
		{
			TaskID:         "task_fresh_current_pending",
			Status:         TaskStatusNotStart,
			Progress:       "0%",
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: TaskDispatchStatusPending,
		},
		{
			TaskID:                  "task_fresh_current_running",
			Status:                  TaskStatusNotStart,
			Progress:                "0%",
			ExecutionMode:           TaskExecutionModeDeferred,
			DispatchStatus:          TaskDispatchStatusRunning,
			DispatchProtocolVersion: CurrentTaskDispatchProtocolVersion,
		},
	}
	require.NoError(t, db.Create(&fresh).Error)
	var storedFresh []*Task
	require.NoError(t, db.Where("task_id LIKE ?", "task_fresh_current_%").Order("id").Find(&storedFresh).Error)
	require.Len(t, storedFresh, 2)
	assert.Equal(t, TaskDispatchStatus("pending_v1"), storedFresh[0].DispatchStatus)
	assert.Equal(t, TaskDispatchStatus("running_v1"), storedFresh[1].DispatchStatus)

	legacyTable := fmt.Sprintf("legacy_deferred_status_%d", time.Now().UnixNano())
	t.Cleanup(func() {
		require.NoError(t, db.Migrator().DropTable(legacyTable))
	})
	require.NoError(t, db.Table(legacyTable).AutoMigrate(&legacyDeferredDispatchTaskSchema{}))
	legacyRows := []*legacyDeferredDispatchTaskSchema{
		{
			TaskID:         "task_upgrade_legacy_pending",
			Status:         TaskStatusNotStart,
			Progress:       "0%",
			ExecutionMode:  TaskExecutionModeDeferred,
			DispatchStatus: testLegacyTaskDispatchStatusPending,
		},
		{
			TaskID:            "task_upgrade_legacy_running",
			Status:            TaskStatusNotStart,
			Progress:          "0%",
			ExecutionMode:     TaskExecutionModeDeferred,
			DispatchStatus:    testLegacyTaskDispatchStatusRunning,
			DispatchOwner:     "legacy-owner",
			DispatchLockUntil: math.MaxInt64,
		},
	}
	require.NoError(t, db.Table(legacyTable).Create(&legacyRows).Error)
	for range 2 {
		require.NoError(t, db.Table(legacyTable).AutoMigrate(&Task{}))
	}

	var upgraded []*Task
	require.NoError(t, db.Table(legacyTable).Order("id").Find(&upgraded).Error)
	require.Len(t, upgraded, 2)
	assert.Equal(t, testLegacyTaskDispatchStatusPending, upgraded[0].DispatchStatus)
	assert.Equal(t, testLegacyTaskDispatchStatusRunning, upgraded[1].DispatchStatus)
	assert.Zero(t, upgraded[0].DispatchProtocolVersion)
	assert.Zero(t, upgraded[1].DispatchProtocolVersion)
}

func openTimeoutEligibilityTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dialect := strings.TrimSpace(os.Getenv("APP_PLUGIN_TEST_DIALECT"))
	dsn := strings.TrimSpace(os.Getenv("APP_PLUGIN_TEST_DSN"))
	var dialector gorm.Dialector
	switch dialect {
	case "", "sqlite":
		dialect = "sqlite"
		if dsn == "" {
			dsn = ":memory:"
		}
		dialector = sqlite.Open(dsn)
	case "mysql":
		require.NotEmpty(t, dsn)
		dialector = mysql.Open(dsn)
	case "postgres":
		require.NotEmpty(t, dsn)
		dialector = postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
	default:
		t.Fatalf("unsupported APP_PLUGIN_TEST_DIALECT %q", dialect)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix: fmt.Sprintf("tp%d_", time.Now().UnixNano()),
		},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&Task{}))

	previousDB := DB
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		require.NoError(t, db.Migrator().DropTable(&Task{}))
		require.NoError(t, sqlDB.Close())
	})

	var version string
	versionQuery := "SELECT version()"
	if dialect == "sqlite" {
		versionQuery = "SELECT sqlite_version()"
	}
	require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
	t.Logf("database: %s %s", dialect, version)
	return db
}
