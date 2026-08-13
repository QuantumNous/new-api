package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// TaskFailoverRecreateResult is returned by TaskFailoverRecreateFunc after a
// successful cross-channel create (no billing / no new local task id).
type TaskFailoverRecreateResult struct {
	UpstreamTaskID string
	UpstreamBody   string
	TaskData       []byte
	Platform       string
}

// TaskFailoverRecreateFunc is injected from relay to avoid service↔relay import cycles.
// It must create an upstream task on next using task.PrivateData.ClientRequestBody
// without PreConsume. nil means cross-channel recreate is unavailable.
var TaskFailoverRecreateFunc func(ctx context.Context, task *model.Task, next *model.Channel) (*TaskFailoverRecreateResult, error)

// HandleAsyncTaskFailure decides same-channel resubmit vs cross-channel recreate.
// handled=true → keep task non-terminal; caller must not refund.
func HandleAsyncTaskFailure(ctx context.Context, ch *model.Channel, adaptor TaskPollingAdaptor, task *model.Task, failReason string) (handled bool, progress string, err error) {
	if task == nil {
		return false, "", nil
	}

	class := taskcommon.ClassifyFailReason(failReason)
	if class == taskcommon.FailReasonAudit {
		return false, "", nil
	}

	maxSame := task.PrivateData.SameChannelMaxRetries
	if maxSame <= 0 {
		maxSame = operation_setting.GetTaskSameChannelMaxRetries()
	}

	trySame := class == taskcommon.FailReasonRetryable
	if trySame {
		if r, ok := adaptor.(TaskAsyncFailureResubmitter); ok && ch != nil {
			if task.PrivateData.RequestBody != "" && task.PrivateData.RetryCount < maxSame {
				okResubmit, prog, resubmitErr := r.TryResubmitOnFailure(ctx, ch, task, failReason)
				if resubmitErr != nil {
					return false, "", resubmitErr
				}
				if okResubmit {
					return true, prog, nil
				}
			}
		}
	}

	if !operation_setting.IsTaskCrossChannelFailoverEnabled() {
		return false, "", nil
	}

	return tryCrossChannelFailover(ctx, task, ch)
}

func tryCrossChannelFailover(ctx context.Context, task *model.Task, current *model.Channel) (bool, string, error) {
	if TaskFailoverRecreateFunc == nil {
		logger.LogInfo(ctx, fmt.Sprintf("Task %s cross-channel failover skipped: recreate not wired", task.TaskID))
		return false, "", nil
	}
	if strings.TrimSpace(task.PrivateData.ClientRequestBody) == "" {
		logger.LogInfo(ctx, fmt.Sprintf("Task %s cross-channel failover skipped: empty client_request_body", task.TaskID))
		return false, "", nil
	}

	ordered := task.PrivateData.FailoverChannelIDs
	if len(ordered) == 0 {
		modelName := ""
		if task.PrivateData.BillingContext != nil {
			modelName = task.PrivateData.BillingContext.OriginModelName
		}
		if modelName == "" {
			modelName = task.Properties.OriginModelName
		}
		ordered = ResolveTaskFailoverChannelIDs(task.Group, modelName)
	}

	currentID := 0
	if current != nil {
		currentID = current.Id
	} else {
		currentID = task.ChannelId
	}

	tried := append([]int{}, task.PrivateData.TriedChannelIDs...)
	if currentID > 0 && !containsInt(tried, currentID) {
		tried = append(tried, currentID)
	}

	for {
		next, ok := PickNextFailoverChannel(ordered, tried, 0)
		if !ok || next == nil {
			task.PrivateData.TriedChannelIDs = tried
			return false, "", nil
		}

		result, recreateErr := TaskFailoverRecreateFunc(ctx, task, next)
		if recreateErr != nil || result == nil || strings.TrimSpace(result.UpstreamTaskID) == "" {
			logger.LogError(ctx, fmt.Sprintf("Task %s failover recreate on channel #%d failed: %v", task.TaskID, next.Id, recreateErr))
			tried = append(tried, next.Id)
			continue
		}

		applyCrossChannelFailoverResult(task, next, result, append(tried, next.Id))

		idx := ChannelIndexInOrder(ordered, next.Id)
		total := len(ordered)
		if total < 1 {
			total = 1
		}
		if idx < 1 {
			idx = len(tried)
		}
		prog := fmt.Sprintf("switching %d/%d", idx, total)
		return true, prog, nil
	}
}

func applyCrossChannelFailoverResult(task *model.Task, next *model.Channel, result *TaskFailoverRecreateResult, tried []int) {
	task.ChannelId = next.Id
	if p := strings.TrimSpace(result.Platform); p != "" {
		task.Platform = constant.TaskPlatform(p)
	} else {
		task.Platform = constant.TaskPlatform(fmt.Sprintf("%d", next.Type))
	}
	task.PrivateData.UpstreamTaskID = result.UpstreamTaskID
	if result.UpstreamBody != "" {
		task.PrivateData.RequestBody = result.UpstreamBody
	}
	if len(result.TaskData) > 0 {
		task.Data = result.TaskData
	}
	task.PrivateData.RetryCount = 0
	task.PrivateData.TriedChannelIDs = tried
	task.Status = model.TaskStatusQueued
	task.FailReason = ""
	task.FinishTime = 0
}

func containsInt(ids []int, id int) bool {
	for _, v := range ids {
		if v == id {
			return true
		}
	}
	return false
}
