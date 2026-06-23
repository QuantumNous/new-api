package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testSystemTaskPayload struct {
	TargetTimestamp int64 `json:"target_timestamp"`
	BatchSize       int   `json:"batch_size"`
}

type testSystemTaskState struct {
	Total     int64 `json:"total"`
	Processed int64 `json:"processed"`
	Progress  int   `json:"progress"`
	Remaining int64 `json:"remaining"`
}

func TestSystemTaskCreateAndActiveLifecycle(t *testing.T) {
	truncateTables(t)

	payload := testSystemTaskPayload{TargetTimestamp: 1000, BatchSize: 100}
	state := testSystemTaskState{}
	task, err := CreateSystemTask(SystemTaskTypeLogCleanup, payload, state)
	require.NoError(t, err)

	var decodedPayload testSystemTaskPayload
	require.NoError(t, task.DecodePayload(&decodedPayload))
	assert.Equal(t, payload, decodedPayload)

	activeTask, err := GetActiveSystemTask(SystemTaskTypeLogCleanup)
	require.NoError(t, err)
	require.NotNil(t, activeTask)
	assert.Equal(t, task.TaskID, activeTask.TaskID)

	runnerID := "runner-a"
	claimedTask, claimed, err := ClaimSystemTask(task.ID, SystemTaskTypeLogCleanup, runnerID, common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)

	err = FinishSystemTask(claimedTask.TaskID, runnerID, SystemTaskStatusSucceeded, map[string]int64{"deleted_count": 0}, "")
	require.NoError(t, err)

	activeTask, err = GetActiveSystemTask(SystemTaskTypeLogCleanup)
	require.NoError(t, err)
	require.Nil(t, activeTask)

	_, err = CreateSystemTask(SystemTaskTypeLogCleanup, payload, state)
	require.NoError(t, err)
}

func TestSystemTaskLockPreventsConcurrentClaim(t *testing.T) {
	truncateTables(t)

	payload := testSystemTaskPayload{TargetTimestamp: 1000, BatchSize: 100}
	task, err := CreateSystemTask(SystemTaskTypeLogCleanup, payload, testSystemTaskState{})
	require.NoError(t, err)
	secondTask, err := CreateSystemTask(SystemTaskTypeLogCleanup, payload, testSystemTaskState{})
	require.NoError(t, err)

	claimedTask, claimed, err := ClaimSystemTask(task.ID, SystemTaskTypeLogCleanup, "runner-a", common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)

	_, claimed, err = ClaimSystemTask(secondTask.ID, SystemTaskTypeLogCleanup, "runner-b", common.GetTimestamp()+60)
	require.NoError(t, err)
	require.False(t, claimed)

	assert.Equal(t, "runner-a", claimedTask.LockedBy)

	reloadedSecond, err := GetSystemTaskByTaskID(secondTask.TaskID)
	require.NoError(t, err)
	require.NotNil(t, reloadedSecond)
	assert.Equal(t, SystemTaskStatusPending, reloadedSecond.Status)
}

func TestExpiredSystemTaskLockFailsOldRunAndClaimsNewRun(t *testing.T) {
	truncateTables(t)

	first, err := CreateSystemTask(SystemTaskTypeLogCleanup, nil, nil)
	require.NoError(t, err)
	_, claimed, err := ClaimSystemTask(first.ID, SystemTaskTypeLogCleanup, "runner-a", common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)

	require.NoError(t, DB.Model(&SystemTaskLock{}).
		Where("task_id = ?", first.TaskID).
		Update("locked_until", common.GetTimestamp()-1).Error)

	second, err := CreateSystemTask(SystemTaskTypeLogCleanup, nil, nil)
	require.NoError(t, err)
	claimedTask, claimed, err := ClaimSystemTask(second.ID, SystemTaskTypeLogCleanup, "runner-b", common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)
	assert.Equal(t, second.TaskID, claimedTask.TaskID)
	assert.Equal(t, "runner-b", claimedTask.LockedBy)

	reloadedFirst, err := GetSystemTaskByTaskID(first.TaskID)
	require.NoError(t, err)
	require.NotNil(t, reloadedFirst)
	assert.Equal(t, SystemTaskStatusFailed, reloadedFirst.Status)
	assert.Equal(t, "task lease expired", reloadedFirst.Error)
}

func TestFindEarliestPendingSystemTasks(t *testing.T) {
	truncateTables(t)

	empty, err := FindEarliestPendingSystemTasks(nil)
	require.NoError(t, err)
	assert.Empty(t, empty)

	firstA, err := CreateSystemTask("type_a", nil, nil)
	require.NoError(t, err)
	_, err = CreateSystemTask("type_a", nil, nil)
	require.NoError(t, err)
	ignoredB, err := CreateSystemTask("type_b", nil, nil)
	require.NoError(t, err)
	require.NoError(t, DB.Model(ignoredB).Update("status", SystemTaskStatusRunning).Error)
	firstB, err := CreateSystemTask("type_b", nil, nil)
	require.NoError(t, err)
	ignoredC, err := CreateSystemTask("type_c", nil, nil)
	require.NoError(t, err)
	require.NoError(t, DB.Model(ignoredC).Update("status", SystemTaskStatusFailed).Error)

	tasks, err := FindEarliestPendingSystemTasks([]string{"type_a", "type_b", "type_c", "missing"})
	require.NoError(t, err)
	require.Len(t, tasks, 2)
	assert.Equal(t, firstA.TaskID, tasks["type_a"].TaskID)
	assert.Equal(t, firstB.TaskID, tasks["type_b"].TaskID)
	assert.Nil(t, tasks["type_c"])
	assert.Nil(t, tasks["missing"])
}

func TestGetLatestSystemTask(t *testing.T) {
	truncateTables(t)

	latest, err := GetLatestSystemTask(SystemTaskTypeChannelTest)
	require.NoError(t, err)
	require.Nil(t, latest)

	first, err := CreateSystemTask(SystemTaskTypeChannelTest, nil, nil)
	require.NoError(t, err)

	runnerID := "runner-a"
	_, claimed, err := ClaimSystemTask(first.ID, SystemTaskTypeChannelTest, runnerID, common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)
	require.NoError(t, FinishSystemTask(first.TaskID, runnerID, SystemTaskStatusSucceeded, nil, ""))

	second, err := CreateSystemTask(SystemTaskTypeChannelTest, nil, nil)
	require.NoError(t, err)

	latest, err = GetLatestSystemTask(SystemTaskTypeChannelTest)
	require.NoError(t, err)
	require.NotNil(t, latest)
	assert.Equal(t, second.TaskID, latest.TaskID)
}

func TestGetLatestSystemTasks(t *testing.T) {
	truncateTables(t)

	empty, err := GetLatestSystemTasks(nil)
	require.NoError(t, err)
	assert.Empty(t, empty)

	firstA, err := CreateSystemTask("type_a", nil, nil)
	require.NoError(t, err)
	firstB, err := CreateSystemTask("type_b", nil, nil)
	require.NoError(t, err)
	secondA, err := CreateSystemTask("type_a", nil, nil)
	require.NoError(t, err)

	tasks, err := GetLatestSystemTasks([]string{"type_a", "type_b", "missing"})
	require.NoError(t, err)
	require.Len(t, tasks, 2)
	assert.NotEqual(t, firstA.TaskID, tasks["type_a"].TaskID)
	assert.Equal(t, secondA.TaskID, tasks["type_a"].TaskID)
	assert.Equal(t, firstB.TaskID, tasks["type_b"].TaskID)
	assert.Nil(t, tasks["missing"])
}

func TestRenewSystemTaskLock(t *testing.T) {
	truncateTables(t)

	task, err := CreateSystemTask(SystemTaskTypeLogCleanup, nil, nil)
	require.NoError(t, err)

	runnerID := "runner-a"
	_, claimed, err := ClaimSystemTask(task.ID, SystemTaskTypeLogCleanup, runnerID, common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)

	newLockUntil := common.GetTimestamp() + 600
	require.NoError(t, RenewSystemTaskLock(task.TaskID, runnerID, newLockUntil))

	var lock SystemTaskLock
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&lock).Error)
	assert.Equal(t, newLockUntil, lock.LockedUntil)

	// A different runner cannot renew a lease it does not hold.
	assert.ErrorIs(t, RenewSystemTaskLock(task.TaskID, "runner-b", common.GetTimestamp()+600), ErrSystemTaskLockLost)

	// After the task finishes it is no longer running, so renew fails.
	require.NoError(t, FinishSystemTask(task.TaskID, runnerID, SystemTaskStatusSucceeded, nil, ""))
	assert.ErrorIs(t, RenewSystemTaskLock(task.TaskID, runnerID, common.GetTimestamp()+600), ErrSystemTaskLockLost)
}

func TestFinishSystemTaskRetainsExecutor(t *testing.T) {
	truncateTables(t)

	task, err := CreateSystemTask(SystemTaskTypeLogCleanup, nil, nil)
	require.NoError(t, err)

	runnerID := "node-1-abc123"
	_, claimed, err := ClaimSystemTask(task.ID, SystemTaskTypeLogCleanup, runnerID, common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)

	require.NoError(t, FinishSystemTask(task.TaskID, runnerID, SystemTaskStatusSucceeded, nil, ""))

	reloaded, err := GetSystemTaskByTaskID(task.TaskID)
	require.NoError(t, err)
	require.NotNil(t, reloaded)
	assert.Equal(t, SystemTaskStatusSucceeded, reloaded.Status)
	assert.Equal(t, runnerID, reloaded.LockedBy, "executor-of-record must be retained for history")

	var lockCount int64
	require.NoError(t, DB.Model(&SystemTaskLock{}).Where("task_id = ?", task.TaskID).Count(&lockCount).Error)
	assert.Equal(t, int64(0), lockCount)
}

func TestSystemTaskUpdatesRequireCurrentLock(t *testing.T) {
	truncateTables(t)

	task, err := CreateSystemTask(SystemTaskTypeLogCleanup, nil, nil)
	require.NoError(t, err)

	runnerID := "runner-a"
	_, claimed, err := ClaimSystemTask(task.ID, SystemTaskTypeLogCleanup, runnerID, common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)

	require.NoError(t, DB.Model(&SystemTaskLock{}).
		Where("task_id = ?", task.TaskID).
		Updates(map[string]any{"locked_by": "runner-b"}).Error)

	assert.ErrorIs(t, UpdateSystemTaskState(task.TaskID, runnerID, testSystemTaskState{Progress: 10}), ErrSystemTaskLockLost)
	assert.ErrorIs(t, FinishSystemTask(task.TaskID, runnerID, SystemTaskStatusSucceeded, nil, ""), ErrSystemTaskLockLost)
}
