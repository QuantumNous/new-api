package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	billingAdjustmentDrainInterval   = 5 * time.Second
	billingAdjustmentDrainBatch      = 100
	billingAdjustmentCleanupInterval = time.Minute
	billingAdjustmentShortRetention  = 6 * time.Hour
	billingAdjustmentLongRetention   = 45 * 24 * time.Hour
	billingAdjustmentCleanupBatch    = 500
	billingAdjustmentCleanupBatches  = 100
)

var billingAdjustmentWorkerOnce sync.Once

// enqueueBillingAdjustments returns after every required leg is durable. The
// synchronous processing attempt is best-effort; failures remain retryable in
// the main database and are owned by the master drainer.
func enqueueBillingAdjustments(specs []model.BillingAdjustmentSpec) error {
	rows, err := model.EnqueueBillingAdjustments(specs)
	if err != nil {
		return err
	}
	for i := range rows {
		if err := model.ProcessBillingAdjustmentOutbox(rows[i].Id); err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf(
				"billing adjustment queued for retry: id=%d request_id=%s phase=%s leg=%s err=%v",
				rows[i].Id,
				rows[i].RequestID,
				rows[i].Phase,
				rows[i].Leg,
				err,
			))
		}
	}
	return nil
}

func StartBillingAdjustmentOutboxWorker() {
	billingAdjustmentWorkerOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			drainTicker := time.NewTicker(billingAdjustmentDrainInterval)
			cleanupTicker := time.NewTicker(billingAdjustmentCleanupInterval)
			defer drainTicker.Stop()
			defer cleanupTicker.Stop()

			drain := func() {
				if !model.HasDueBillingAdjustmentOutbox(common.GetTimestamp()) {
					return
				}
				processed, failed, err := model.DrainDueBillingAdjustmentOutbox(billingAdjustmentDrainBatch)
				if err != nil {
					logger.LogWarn(context.Background(), fmt.Sprintf(
						"billing adjustment outbox drain incomplete: processed=%d failed=%d err=%v",
						processed,
						failed,
						err,
					))
				}
			}
			cleanup := func() {
				now := time.Now()
				shortRetentionCutoff := now.Add(-billingAdjustmentShortRetention).Unix()
				longRetentionCutoff := now.Add(-billingAdjustmentLongRetention).Unix()
				for i := 0; i < billingAdjustmentCleanupBatches; i++ {
					deleted, err := model.CleanupTerminalBillingAdjustmentOutbox(shortRetentionCutoff, longRetentionCutoff, billingAdjustmentCleanupBatch)
					if err != nil {
						logger.LogWarn(context.Background(), "billing adjustment outbox cleanup failed: "+err.Error())
						return
					}
					if deleted < billingAdjustmentCleanupBatch {
						return
					}
				}
			}

			drain()
			cleanup()
			for {
				select {
				case <-drainTicker.C:
					drain()
				case <-cleanupTicker.C:
					cleanup()
				}
			}
		})
	})
}
