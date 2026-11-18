package controller

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// RegisterSystemTaskHandlers registers only general system maintenance jobs.
func RegisterSystemTaskHandlers() {
	service.RegisterSystemTaskHandler(systemTaskCleanupHandler{})
}

// systemTaskCleanupHandler deletes, once a day, the finished system tasks
// older than the configured retention.
type systemTaskCleanupHandler struct{}

func (systemTaskCleanupHandler) Type() string { return model.SystemTaskTypeCleanup }

func (systemTaskCleanupHandler) Enabled() bool { return true }

func (systemTaskCleanupHandler) Interval() time.Duration { return 24 * time.Hour }

func (systemTaskCleanupHandler) NewPayload() any { return nil }

func (systemTaskCleanupHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	days := max(operation_setting.GetSystemTaskSetting().RetentionDays, 1)
	deleted, err := model.DeleteFinishedSystemTasks(ctx, common.GetTimestamp()-int64(days)*24*60*60)
	status := model.SystemTaskStatusSucceeded
	if err != nil {
		status = model.SystemTaskStatusFailed
	}
	finishSystemTaskHandler(task, runnerID, status, map[string]int64{"deleted_count": deleted}, err)
}

func finishSystemTaskHandler(task *model.SystemTask, runnerID string, status model.SystemTaskStatus, result any, runErr error) {
	errorMessage := ""
	if runErr != nil {
		errorMessage = runErr.Error()
	}
	if err := model.FinishSystemTask(task.TaskID, runnerID, status, result, errorMessage); err != nil {
		common.SysLog(common.LogText("system task %s failed to persist result: %v", task.TaskID, err))
	}
}
