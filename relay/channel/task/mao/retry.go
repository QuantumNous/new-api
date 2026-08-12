package mao

import (
	"fmt"

	"github.com/QuantumNous/new-api/model"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// MaxAsyncRetries is the legacy default same-channel resubmit cap (kept for tests / fallback).
const MaxAsyncRetries = 3

func isNonRetryableFailReason(reason string) bool {
	// Same-channel path: audit and upstream-balance both block local resubmit.
	// Cross-channel handling for balance is owned by the failover orchestrator.
	return taskcommon.BlocksSameChannelResubmit(reason)
}

func resolveSameChannelMaxRetries(task *model.Task) int {
	if task != nil && task.PrivateData.SameChannelMaxRetries > 0 {
		return task.PrivateData.SameChannelMaxRetries
	}
	if n := operation_setting.GetTaskSameChannelMaxRetries(); n > 0 {
		return n
	}
	return MaxAsyncRetries
}

func retryProgressLabel(failCount, maxRetries int) string {
	if maxRetries < 1 {
		maxRetries = MaxAsyncRetries
	}
	return fmt.Sprintf("retrying %d/%d", failCount, maxRetries)
}

func shouldAttemptResubmit(body string, retryCount, maxRetries int, reason string) bool {
	if maxRetries < 1 {
		return false
	}
	// retryCount is failures so far; allow resubmit while retryCount < maxRetries.
	return body != "" && retryCount < maxRetries && !isNonRetryableFailReason(reason)
}
