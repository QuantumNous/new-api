package order

import "fmt"

type Status string

const (
	StatusCreating          Status = "CREATING"
	StatusPayable           Status = "PAYABLE"
	StatusCreateUnknown     Status = "CREATE_UNKNOWN"
	StatusCreateFailed      Status = "CREATE_FAILED"
	StatusPaidPendingNotify Status = "PAID_PENDING_NOTIFY"
	StatusNotified          Status = "NOTIFIED"
	StatusExpired           Status = "EXPIRED"
	StatusManualReview      Status = "MANUAL_REVIEW"
)

type NotificationState string

const (
	NotificationPending    NotificationState = "PENDING"
	NotificationProcessing NotificationState = "PROCESSING"
	NotificationRetry      NotificationState = "RETRY"
	NotificationSucceeded  NotificationState = "SUCCEEDED"
	NotificationDead       NotificationState = "DEAD"
)

var allowedTransitions = map[Status]map[Status]struct{}{
	StatusCreating: {
		StatusPayable:       {},
		StatusCreateUnknown: {},
		StatusCreateFailed:  {},
	},
	StatusCreateUnknown: {
		StatusPayable:           {},
		StatusCreateFailed:      {},
		StatusManualReview:      {},
		StatusPaidPendingNotify: {},
	},
	StatusCreateFailed: {
		StatusCreating:     {},
		StatusManualReview: {},
	},
	StatusPayable: {
		StatusPaidPendingNotify: {},
		StatusExpired:           {},
		StatusManualReview:      {},
	},
	StatusPaidPendingNotify: {
		StatusNotified:     {},
		StatusManualReview: {},
	},
	StatusExpired: {
		StatusManualReview: {},
	},
}

func CanTransition(from, to Status) bool {
	_, allowed := allowedTransitions[from][to]
	return allowed
}

func ValidateTransition(from, to Status) error {
	if CanTransition(from, to) {
		return nil
	}
	return fmt.Errorf("invalid payment order transition: %s -> %s", from, to)
}

func IsPaid(status Status) bool {
	return status == StatusPaidPendingNotify || status == StatusNotified
}
