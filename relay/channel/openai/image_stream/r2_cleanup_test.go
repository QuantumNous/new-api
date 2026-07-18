package image_stream

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAsyncImageInputCleanupTaskOnlyDrainsRegisteredObjects(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	cleanup, err := model.NewImageInputCleanup("task_cleanup_scheduled", []string{"inputs/task/reference.png"})
	require.NoError(t, err)
	cleanup.Status = model.ImageInputCleanupPending
	cleanup.NextAttemptAt = common.GetTimestamp()
	require.NoError(t, model.DB.Create(cleanup).Error)

	var deletedKeys []string
	previousDelete := deleteAsyncImageInputObject
	deleteAsyncImageInputObject = func(_ context.Context, key string) error {
		deletedKeys = append(deletedKeys, key)
		return nil
	}
	t.Cleanup(func() { deleteAsyncImageInputObject = previousDelete })

	var r2Requests int
	previousClient := http.DefaultClient
	http.DefaultClient = &http.Client{Transport: asyncImageRoundTripFunc(func(*http.Request) (*http.Response, error) {
		r2Requests++
		return nil, errors.New("unexpected unregistered R2 cleanup request")
	})}
	t.Cleanup(func() { http.DefaultClient = previousClient })

	task, err := model.CreateSystemTask(model.SystemTaskTypeImageInputGC, nil, nil)
	require.NoError(t, err)
	claimedTask, claimed, err := model.ClaimSystemTask(task.ID, task.Type, "runner-cleanup", common.GetTimestamp()+60)
	require.NoError(t, err)
	require.True(t, claimed)

	asyncImageInputCleanupTaskHandler{}.Run(context.Background(), claimedTask, "runner-cleanup")

	assert.Zero(t, r2Requests)
	assert.Equal(t, []string{"inputs/task/reference.png"}, deletedKeys)
	finishedTask, err := model.GetSystemTaskByTaskID(task.TaskID)
	require.NoError(t, err)
	require.NotNil(t, finishedTask)
	assert.Equal(t, model.SystemTaskStatusSucceeded, finishedTask.Status)
	var result map[string]any
	require.NoError(t, common.UnmarshalJsonStr(finishedTask.Result, &result))
	assert.Equal(t, float64(1), result["outbox_completed"])
	assert.Equal(t, float64(0), result["outbox_retried"])
	assert.NotContains(t, result, "deleted")
	assert.NotContains(t, result, "retention_days")
}

func TestDrainDueImageInputCleanupsDeletesTerminalTaskInputs(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	var deletedKeys []string
	previousDelete := deleteAsyncImageInputObject
	deleteAsyncImageInputObject = func(_ context.Context, key string) error {
		deletedKeys = append(deletedKeys, key)
		return nil
	}
	t.Cleanup(func() { deleteAsyncImageInputObject = previousDelete })

	cleanup, err := model.NewImageInputCleanup("task_cleanup_outbox", []string{
		"inputs/one/reference.png",
		"inputs/two/reference.webp",
	})
	require.NoError(t, err)
	cleanup.Status = model.ImageInputCleanupPending
	cleanup.NextAttemptAt = common.GetTimestamp()
	require.NoError(t, model.DB.Create(cleanup).Error)

	completed, retried, err := drainDueImageInputCleanups(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, completed)
	assert.Zero(t, retried)
	assert.Equal(t, []string{"inputs/one/reference.png", "inputs/two/reference.webp"}, deletedKeys)
	require.NoError(t, model.DB.First(cleanup, cleanup.ID).Error)
	assert.Equal(t, model.ImageInputCleanupCompleted, cleanup.Status)
	assert.Empty(t, cleanup.ObjectKeys)
}

func TestDrainDueImageInputCleanupsPersistsRemainingKeysAfterPartialDelete(t *testing.T) {
	setupAsyncImageSubmitTestDB(t)
	var attempts []string
	previousDelete := deleteAsyncImageInputObject
	deleteAsyncImageInputObject = func(_ context.Context, key string) error {
		attempts = append(attempts, key)
		if key == "inputs/two/reference.webp" && len(attempts) == 2 {
			return errors.New("temporary R2 failure")
		}
		return nil
	}
	t.Cleanup(func() { deleteAsyncImageInputObject = previousDelete })

	cleanup, err := model.NewImageInputCleanup("task_cleanup_partial", []string{
		"inputs/one/reference.png",
		"inputs/two/reference.webp",
	})
	require.NoError(t, err)
	cleanup.Status = model.ImageInputCleanupPending
	cleanup.NextAttemptAt = common.GetTimestamp()
	require.NoError(t, model.DB.Create(cleanup).Error)

	completed, retried, err := drainDueImageInputCleanups(context.Background())
	require.Error(t, err)
	assert.Zero(t, completed)
	assert.Equal(t, 1, retried)
	require.NoError(t, model.DB.First(cleanup, cleanup.ID).Error)
	keys, err := cleanup.ResolvedObjectKeys()
	require.NoError(t, err)
	assert.Equal(t, []string{"inputs/two/reference.webp"}, keys)

	require.NoError(t, model.DB.Model(cleanup).Update("next_attempt_at", common.GetTimestamp()).Error)
	completed, retried, err = drainDueImageInputCleanups(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, completed)
	assert.Zero(t, retried)
	assert.Equal(t, []string{
		"inputs/one/reference.png",
		"inputs/two/reference.webp",
		"inputs/two/reference.webp",
	}, attempts)
}
