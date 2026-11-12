package service

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

const taskCallerContextKey = "task_caller_context"

// DetachTaskSubmission lets a native task submit outlive a caller that stops
// waiting. Once sent, the job may already exist and be billed upstream, so
// cancelling it would refund the caller and leave no task or log behind.
// After the caller disconnects, the submission may run at most
// TASK_SUBMIT_TIMEOUT_SECONDS longer; while the caller waits it is not
// bounded here. A caller that is gone before an attempt is sent still stops
// it (see TaskCallerGone). The returned func restores the client request.
func DetachTaskSubmission(c *gin.Context) func() {
	clientRequest := c.Request
	callerContext := clientRequest.Context()
	// A caller that is already gone never starts a submit; one that leaves
	// later keeps it running, since upstream may already have billed the job.
	if callerContext.Err() != nil {
		return func() {}
	}
	timeout := time.Duration(constant.TaskSubmitTimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 5 * time.Minute
	}
	submitContext, cancel := context.WithCancel(context.WithoutCancel(callerContext))
	stopWatch := context.AfterFunc(callerContext, func() {
		timer := time.NewTimer(timeout)
		defer timer.Stop()
		select {
		case <-timer.C:
			cancel()
		case <-submitContext.Done():
		}
	})
	c.Request = clientRequest.WithContext(submitContext)
	c.Set(taskCallerContextKey, callerContext)
	return func() {
		c.Request = clientRequest
		stopWatch()
		cancel()
	}
}

// TaskCallerGone reports whether the caller of a detached task submission has
// disconnected. An attempt not yet sent upstream must not start then: it would
// create and bill a job nobody waits for.
func TaskCallerGone(c *gin.Context) bool {
	if c == nil {
		return false
	}
	value, ok := c.Get(taskCallerContextKey)
	if !ok {
		return false
	}
	callerContext, ok := value.(context.Context)
	return ok && callerContext.Err() != nil
}
