package common

import "github.com/gin-gonic/gin"

// BillingSettler abstracts the lifecycle operations of a billing session.
// Implemented by service.BillingSession, stored on RelayInfo to avoid circular references.
type BillingSettler interface {
	// Settle settles according to the actual consumption quota, and calculates delta = actualQuota - preConsumedQuota,
	// Also adjust the funding source (wallet/subscription) and token limit.
	Settle(actualQuota int) error

	// Refund refunds all withholding fees (fund source + token), idempotent and safe.
	// Asynchronous execution via gopool. If settlement or refund has already been made, no action will be taken.
	Refund(c *gin.Context)

	// NeedsRefund Returns whether the session has a withholding status that needs to be refunded (unsettled and not refunded).
	NeedsRefund() bool

	// GetPreConsumedQuota returns the actual withholding quota value (may be 0 for trusted users).
	GetPreConsumedQuota() int

	// Reserve will make up the withholding amount to the target value; if the target value is not higher than the current withholding amount, nothing will be done.
	Reserve(targetQuota int) error

	// ReserveBeforeSubmit is the same as Reserve, used for subsidy when the price has been determined before initiating the upstream request.
	// (For example, the task is retried and switched to a more expensive channel): When the wallet balance is insufficient, the amount returned is insufficient and will not be recorded as arrears.
	ReserveBeforeSubmit(targetQuota int) error
}
