package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	systemTaskRunnerTickInterval = time.Second
	systemTaskLockTTL            = 60 * time.Second
	logCleanupBatchSize          = 100
)

type LogCleanupPayload struct {
	TargetTimestamp int64 `json:"target_timestamp"`
	BatchSize       int   `json:"batch_size"`
}

type LogCleanupState struct {
	Total     int64 `json:"total"`
	Processed int64 `json:"processed"`
	Progress  int   `json:"progress"`
	Remaining int64 `json:"remaining"`
}

type LogCleanupResult struct {
	DeletedCount int64 `json:"deleted_count"`
}

var systemTaskRunnerOnce sync.Once

func StartSystemTaskRunner() {
	systemTaskRunnerOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}

		runnerID := fmt.Sprintf("%s-%s", common.NodeName, common.GetRandomString(8))
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("system task runner started: runner=%s tick=%s", runnerID, systemTaskRunnerTickInterval))

			ticker := time.NewTicker(systemTaskRunnerTickInterval)
			defer ticker.Stop()

			runSystemTaskRunnerOnce(runnerID)
			for range ticker.C {
				runSystemTaskRunnerOnce(runnerID)
			}
		})
	})
}

func StartLogCleanupTask(targetTimestamp int64) (*model.SystemTask, error) {
	if targetTimestamp <= 0 {
		return nil, errors.New("target timestamp is required")
	}

	activeTask, err := model.GetActiveSystemTask(model.SystemTaskTypeLogCleanup)
	if err != nil {
		return nil, err
	}
	if activeTask != nil {
		return activeTask, nil
	}

	payload := LogCleanupPayload{
		TargetTimestamp: targetTimestamp,
		BatchSize:       logCleanupBatchSize,
	}
	state := LogCleanupState{}
	task, err := model.CreateSystemTask(model.SystemTaskTypeLogCleanup, model.SystemTaskTypeLogCleanup, payload, state)
	if err != nil {
		activeTask, activeErr := model.GetActiveSystemTask(model.SystemTaskTypeLogCleanup)
		if activeErr == nil && activeTask != nil {
			return activeTask, nil
		}
		return nil, err
	}
	return task, nil
}

func runSystemTaskRunnerOnce(runnerID string) {
	now := common.GetTimestamp()
	tasks, err := model.FindRunnableSystemTasks(model.SystemTaskTypeLogCleanup, now, 1)
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("system task runner query failed: %v", err))
		return
	}

	for _, task := range tasks {
		claimedTask, claimed, err := model.ClaimSystemTask(task.ID, model.SystemTaskTypeLogCleanup, runnerID, systemTaskLockUntil())
		if err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("system task claim failed: %v", err))
			continue
		}
		if !claimed {
			continue
		}
		runLogCleanupTask(context.Background(), claimedTask, runnerID)
	}
}

func runLogCleanupTask(ctx context.Context, task *model.SystemTask, runnerID string) {
	payload := LogCleanupPayload{}
	if err := task.DecodePayload(&payload); err != nil {
		failSystemTask(task, runnerID, err)
		return
	}
	if payload.TargetTimestamp <= 0 {
		failSystemTask(task, runnerID, errors.New("target timestamp is required"))
		return
	}
	if payload.BatchSize <= 0 {
		payload.BatchSize = logCleanupBatchSize
	}

	state := LogCleanupState{}
	if err := task.DecodeState(&state); err != nil {
		failSystemTask(task, runnerID, err)
		return
	}

	for {
		remaining, err := model.CountOldLog(ctx, payload.TargetTimestamp)
		if err != nil {
			failSystemTask(task, runnerID, err)
			return
		}
		syncLogCleanupStateFromRemaining(&state, remaining)
		if err := model.UpdateSystemTaskState(task.TaskID, runnerID, state, systemTaskLockUntil()); err != nil {
			logSystemTaskLockError(ctx, task, err)
			return
		}
		if state.Remaining == 0 {
			break
		}

		// Track whether this pass deleted anything so a fresh recount that still
		// reports remaining rows resumes immediately instead of waiting for the
		// lock to expire. If a whole pass deletes nothing while rows remain, the
		// rows cannot be removed and we fail instead of busy-looping.
		progressed := false
		for state.Remaining > 0 {
			rowsAffected, err := model.DeleteOldLogBatch(ctx, payload.TargetTimestamp, payload.BatchSize)
			if err != nil {
				failSystemTask(task, runnerID, err)
				return
			}
			if rowsAffected == 0 {
				break
			}
			progressed = true

			state.Processed += rowsAffected
			if state.Total < state.Processed {
				state.Total = state.Processed
			}
			if state.Remaining > rowsAffected {
				state.Remaining -= rowsAffected
			} else {
				state.Remaining = 0
			}
			state.Progress = logCleanupProgress(state.Processed, state.Total)

			if err := model.UpdateSystemTaskState(task.TaskID, runnerID, state, systemTaskLockUntil()); err != nil {
				logSystemTaskLockError(ctx, task, err)
				return
			}
		}

		if !progressed {
			failSystemTask(task, runnerID, errors.New("no log rows were deleted"))
			return
		}
	}

	state.Remaining = 0
	state.Progress = 100
	if state.Total < state.Processed {
		state.Total = state.Processed
	}
	if err := model.UpdateSystemTaskState(task.TaskID, runnerID, state, systemTaskLockUntil()); err != nil {
		logSystemTaskLockError(ctx, task, err)
		return
	}

	result := LogCleanupResult{DeletedCount: state.Processed}
	if err := model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, result, ""); err != nil {
		logSystemTaskLockError(ctx, task, err)
	}
}

func syncLogCleanupStateFromRemaining(state *LogCleanupState, remaining int64) {
	if state.Total <= 0 {
		state.Total = remaining
		state.Processed = 0
	} else {
		processedFromRemaining := state.Total - remaining
		if processedFromRemaining > state.Processed {
			state.Processed = processedFromRemaining
		}
	}
	if state.Processed < 0 {
		state.Processed = 0
	}
	state.Remaining = remaining
	state.Progress = logCleanupProgress(state.Processed, state.Total)
}

func logCleanupProgress(processed int64, total int64) int {
	if total <= 0 {
		return 100
	}
	if processed <= 0 {
		return 0
	}
	if processed >= total {
		return 100
	}
	return int(processed * 100 / total)
}

func systemTaskLockUntil() int64 {
	return common.GetTimestamp() + int64(systemTaskLockTTL.Seconds())
}

func failSystemTask(task *model.SystemTask, runnerID string, err error) {
	logger.LogWarn(context.Background(), fmt.Sprintf("system task %s failed: %v", task.TaskID, err))
	if finishErr := model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusFailed, nil, err.Error()); finishErr != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("system task %s failed to save failure state: %v", task.TaskID, finishErr))
	}
}

func logSystemTaskLockError(ctx context.Context, task *model.SystemTask, err error) {
	if errors.Is(err, model.ErrSystemTaskLockLost) {
		logger.LogWarn(ctx, fmt.Sprintf("system task %s lock lost", task.TaskID))
		return
	}
	logger.LogWarn(ctx, fmt.Sprintf("system task %s update failed: %v", task.TaskID, err))
}
