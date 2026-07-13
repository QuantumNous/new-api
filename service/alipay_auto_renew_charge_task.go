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
	alipayAutoRenewChargeTickInterval = 2 * time.Minute
	alipayAutoRenewChargeBatchSize    = 50
)

var (
	alipayAutoRenewChargeOnce    sync.Once
	alipayAutoRenewChargeRunning atomic.Bool
)

// StartAlipayAutoRenewChargeTask scans only due alipay auto-renew contracts near/after
// period end and initiates one charge. Mid-cycle contracts are not polled.
func StartAlipayAutoRenewChargeTask() {
	alipayAutoRenewChargeOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf(
				"alipay auto-renew charge task started: tick=%s", alipayAutoRenewChargeTickInterval))
			ticker := time.NewTicker(alipayAutoRenewChargeTickInterval)
			defer ticker.Stop()

			runAlipayAutoRenewChargeTaskOnce()
			for range ticker.C {
				runAlipayAutoRenewChargeTaskOnce()
			}
		})
	})
}

func runAlipayAutoRenewChargeTaskOnce() {
	if !alipayAutoRenewChargeRunning.CompareAndSwap(false, true) {
		return
	}
	defer alipayAutoRenewChargeRunning.Store(false)

	if !IsAlipayCyclePayConfigured() {
		return
	}

	ctx := context.Background()
	now := common.GetTimestamp()

	if n, err := MarkAlipayAutoRenewContractsCanceledAtPeriodEnd(now, alipayAutoRenewChargeBatchSize); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("alipay auto-renew cancel-at-period-end finalize failed: %v", err))
	} else if n > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("alipay auto-renew finalized cancel_at_period_end count=%d", n))
	}

	contracts, err := model.ListDueAlipayAutoRenewContracts(now, alipayAutoRenewChargeBatchSize)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("alipay auto-renew list due contracts failed: %v", err))
		return
	}
	if len(contracts) == 0 {
		return
	}

	notifyURL := AlipaySubscriptionNotifyURL()
	charged := 0
	for i := range contracts {
		contract := contracts[i]
		if err := ChargeAlipayAutoRenewContract(ctx, &contract, notifyURL); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf(
				"alipay auto-renew charge failed contract_id=%d agreement=%s error=%v",
				contract.Id, contract.ProviderSubscriptionId, err))
			continue
		}
		charged++
	}
	if charged > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("alipay auto-renew charge tick done due=%d charged_ok=%d", len(contracts), charged))
	}
}
