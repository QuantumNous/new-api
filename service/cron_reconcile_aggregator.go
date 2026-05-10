package service

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
)

const reconcileAggregateInterval = 1 * time.Hour
const reconcileAggregateOffset = 7 * time.Minute

// StartReconcileAggregator starts the hourly aggregation goroutine.
// The goroutine aligns to hh:07:00 and then fires every hour.
func StartReconcileAggregator() {
	now := time.Now()
	next := now.Truncate(time.Hour).Add(time.Hour + reconcileAggregateOffset)
	common.SysLog(fmt.Sprintf("reconcile aggregator: started, first tick at %s",
		next.Format("2006-01-02 15:04:05")))
	gopool.Go(func() {
		// Align to next hh:07:00
		time.Sleep(time.Until(next))

		RunReconcileAggregation()

		ticker := time.NewTicker(reconcileAggregateInterval)
		defer ticker.Stop()
		for range ticker.C {
			RunReconcileAggregation()
		}
	})
}
