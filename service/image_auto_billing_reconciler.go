package service

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

var startImageAutoBillingReconcilerOnce sync.Once

func imageAutoBillingReconcileInterval() time.Duration {
	seconds := common.GetEnvOrDefault("IMAGE_AUTO_BILLING_RECONCILE_INTERVAL_SECONDS", 30)
	if seconds < 5 {
		seconds = 5
	}
	if seconds > 60 {
		seconds = 60
	}
	return time.Duration(seconds) * time.Second
}

func ReconcileImageAutoBillingOnce() (model.ImageAutoBillingReconcileResult, error) {
	return model.ReconcileImageAutoBillingBatch(200)
}

func RepairImageAutoBillingQuotaCaches() error {
	return model.RefreshOpenImageAutoBillingQuotaCaches()
}

// StartImageAutoBillingReconciler executes one pass synchronously, then starts
// bounded periodic reconciliation in the background.
func StartImageAutoBillingReconciler() {
	startImageAutoBillingReconcilerOnce.Do(func() {
		if result, err := ReconcileImageAutoBillingOnce(); err != nil {
			common.SysLog(fmt.Sprintf("image-auto billing reconciliation completed with failures (found=%d processed=%d failed=%d): %v", result.Found, result.Processed, result.Failed, err))
		}
		gopool.Go(func() {
			ticker := time.NewTicker(imageAutoBillingReconcileInterval())
			defer ticker.Stop()
			for range ticker.C {
				if result, err := ReconcileImageAutoBillingOnce(); err != nil {
					common.SysLog(fmt.Sprintf("image-auto billing reconciliation completed with failures (found=%d processed=%d failed=%d): %v", result.Found, result.Processed, result.Failed, err))
				}
			}
		})
	})
}
