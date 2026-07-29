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
	inviteSubscriptionRewardReconciliationTickInterval = 15 * time.Minute
	inviteSubscriptionRewardReconciliationBatchSize    = 100
	inviteSubscriptionRewardReconciliationMaxRounds    = 10
)

var (
	inviteSubscriptionRewardReconciliationOnce    sync.Once
	inviteSubscriptionRewardReconciliationRunning atomic.Bool
	inviteSubscriptionRewardReconciler            = model.ReconcileMissedInviteSubscriptionRewards
)

func StartInviteSubscriptionRewardReconciliationTask() {
	inviteSubscriptionRewardReconciliationOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("invite subscription reward reconciliation task started: tick=%s", inviteSubscriptionRewardReconciliationTickInterval))
			ticker := time.NewTicker(inviteSubscriptionRewardReconciliationTickInterval)
			defer ticker.Stop()

			runInviteSubscriptionRewardReconciliationOnceLogged()
			for range ticker.C {
				runInviteSubscriptionRewardReconciliationOnceLogged()
			}
		})
	})
}

func runInviteSubscriptionRewardReconciliationOnceLogged() {
	count, err := RunInviteSubscriptionRewardReconciliationOnce()
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("invite subscription reward reconciliation failed after %d order(s): %v", count, err))
		return
	}
	if common.DebugEnabled && count > 0 {
		logger.LogDebug(context.Background(), "invite subscription reward reconciliation processed_count=%d", count)
	}
}

func RunInviteSubscriptionRewardReconciliationOnce() (int, error) {
	if !common.IsMasterNode {
		return 0, nil
	}
	if !inviteSubscriptionRewardReconciliationRunning.CompareAndSwap(false, true) {
		return 0, nil
	}
	defer inviteSubscriptionRewardReconciliationRunning.Store(false)

	processed := 0
	for round := 0; round < inviteSubscriptionRewardReconciliationMaxRounds; round++ {
		count, err := inviteSubscriptionRewardReconciler(0, inviteSubscriptionRewardReconciliationBatchSize)
		processed += count
		if err != nil {
			return processed, err
		}
		if count < inviteSubscriptionRewardReconciliationBatchSize {
			return processed, nil
		}
	}
	return processed, nil
}
