package order

import (
	"context"
	"time"
)

const unknownCreateScanLimit = 100

type RecoveryRepository interface {
	ExpirePayableOrders(time.Time) (int64, error)
	FindCreateUnknownOrders(int) ([]NativeOrderRecord, error)
}

type RecoveryScheduler struct {
	repository RecoveryRepository
	native     *NativeOrderService
	now        func() time.Time
}

func NewRecoveryScheduler(repository RecoveryRepository, native *NativeOrderService) *RecoveryScheduler {
	return &RecoveryScheduler{repository: repository, native: native, now: func() time.Time { return time.Now().UTC() }}
}

func (scheduler *RecoveryScheduler) Run(ctx context.Context) {
	_ = scheduler.Process(ctx)
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_ = scheduler.Process(ctx)
		}
	}
}

func (scheduler *RecoveryScheduler) Process(ctx context.Context) error {
	now := scheduler.now()
	if _, err := scheduler.repository.ExpirePayableOrders(now); err != nil {
		return err
	}
	records, err := scheduler.repository.FindCreateUnknownOrders(unknownCreateScanLimit)
	if err != nil {
		return err
	}
	for _, record := range records {
		if err := scheduler.native.RecoverUnknown(ctx, record); err != nil {
			return err
		}
	}
	return nil
}
