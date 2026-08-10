package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	subscriptionResetTickInterval = 1 * time.Minute
	subscriptionResetBatchSize    = 300
	subscriptionCleanupInterval   = 30 * time.Minute
	// Cancellation reconcile costs one Airwallex round trip per renewing
	// customer, so it runs far less often than the 1-minute maintenance tick.
	// It is a backstop for dropped webhooks, not the primary path: the cancel
	// endpoint and the webhook both write immediately, so a delay here is only
	// visible when one of those has already failed.
	subscriptionReconcileInterval  = 30 * time.Minute
	subscriptionReconcileBatchSize = 200
)

var (
	subscriptionResetOnce     sync.Once
	subscriptionResetRunning  atomic.Bool
	subscriptionCleanupLast   atomic.Int64
	recurringChargeLast       atomic.Int64
	subscriptionReconcileLast atomic.Int64
)

// Agreement-based rails (WeChat 委托代扣 / Alipay 周期扣款) are merchant-initiated:
// scan once a day; a no-op while no RecurringCharger is registered (HK/Airwallex).
const recurringChargeInterval = 24 * time.Hour

func StartSubscriptionQuotaResetTask() {
	subscriptionResetOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("subscription quota reset task started: tick=%s", subscriptionResetTickInterval))
			ticker := time.NewTicker(subscriptionResetTickInterval)
			defer ticker.Stop()

			runSubscriptionQuotaResetOnce()
			for range ticker.C {
				runSubscriptionQuotaResetOnce()
			}
		})
	})
}

func runSubscriptionQuotaResetOnce() {
	if !subscriptionResetRunning.CompareAndSwap(false, true) {
		return
	}
	defer subscriptionResetRunning.Store(false)

	ctx := context.Background()
	totalReset := 0
	totalExpired := 0
	for {
		n, err := model.ExpireDueSubscriptions(subscriptionResetBatchSize)
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("subscription expire task failed: %v", err))
			return
		}
		if n == 0 {
			break
		}
		totalExpired += n
		if n < subscriptionResetBatchSize {
			break
		}
	}
	for {
		n, err := model.ResetDueSubscriptions(subscriptionResetBatchSize)
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("subscription quota reset task failed: %v", err))
			return
		}
		if n == 0 {
			break
		}
		totalReset += n
		if n < subscriptionResetBatchSize {
			break
		}
	}
	lastCleanup := time.Unix(subscriptionCleanupLast.Load(), 0)
	if time.Since(lastCleanup) >= subscriptionCleanupInterval {
		if _, err := model.CleanupSubscriptionPreConsumeRecords(7 * 24 * 3600); err == nil {
			subscriptionCleanupLast.Store(time.Now().Unix())
		}
	}
	lastRecurring := time.Unix(recurringChargeLast.Load(), 0)
	if time.Since(lastRecurring) >= recurringChargeInterval {
		ChargeDueAgreementSubscriptions()
		recurringChargeLast.Store(time.Now().Unix())
	}
	lastReconcile := time.Unix(subscriptionReconcileLast.Load(), 0)
	if time.Since(lastReconcile) >= subscriptionReconcileInterval {
		if _, err := ReconcileAirwallexCancellations(subscriptionReconcileBatchSize); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("subscription cancellation reconcile failed: %v", err))
		}
		// Stamped regardless of outcome: a failing reconcile must not turn the
		// 30-minute backstop into a once-a-minute retry storm against Airwallex.
		subscriptionReconcileLast.Store(time.Now().Unix())
	}
	if common.DebugEnabled && (totalReset > 0 || totalExpired > 0) {
		logger.LogDebug(ctx, "subscription maintenance: reset_count=%d, expired_count=%d", totalReset, totalExpired)
	}
}
