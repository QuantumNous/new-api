package mao

import (
	"fmt"

	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
)

const MaxAsyncRetries = 3

func isNonRetryableFailReason(reason string) bool {
	// Same-channel path: audit and upstream-balance both block local resubmit.
	// Cross-channel handling for balance is owned by the failover orchestrator.
	return taskcommon.BlocksSameChannelResubmit(reason)
}

func retryProgressLabel(failCount int) string {
	return fmt.Sprintf("retrying %d/%d", failCount+1, MaxAsyncRetries)
}

func shouldAttemptResubmit(body string, retryCount int, reason string) bool {
	// Only resubmit when this failure's new count would still be < MaxAsyncRetries
	// (i.e. allow resubmit at count 0 and 1; at count 2 → terminal after 3rd failure).
	return body != "" && retryCount+1 < MaxAsyncRetries && !isNonRetryableFailReason(reason)
}
