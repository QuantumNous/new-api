package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	alipayPendingTickInterval = 5 * time.Minute
	alipayPendingBatchSize    = 100
	alipayPendingQueryDelay   = 1 * time.Minute
)

var (
	alipayPendingOnce    sync.Once
	alipayPendingRunning atomic.Bool
)

func StartAlipayPendingTopUpTask() {
	alipayPendingOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("alipay pending topup task started: tick=%s", alipayPendingTickInterval))
			ticker := time.NewTicker(alipayPendingTickInterval)
			defer ticker.Stop()

			runAlipayPendingTopUpTaskOnce()
			for range ticker.C {
				runAlipayPendingTopUpTaskOnce()
			}
		})
	})
}

func runAlipayPendingTopUpTaskOnce() {
	if !alipayPendingRunning.CompareAndSwap(false, true) {
		return
	}
	defer alipayPendingRunning.Store(false)

	if !isAlipayPendingTaskEnabled() {
		return
	}

	ctx := context.Background()
	beforeCreateTime := time.Now().Add(-alipayPendingQueryDelay).Unix()
	topUps, err := model.GetPendingTopUpsByProvider(model.PaymentProviderAlipay, beforeCreateTime, alipayPendingBatchSize)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("alipay pending topup query failed: %v", err))
		return
	}

	for _, topUp := range topUps {
		result, err := QueryAlipayTradeWithEncryptKey(ctx, setting.AlipayGateway, setting.AlipayAppID, setting.AlipayPrivateKey, topUp.TradeNo, setting.AlipayEncryptKey)
		if err != nil {
			if IsAlipayPermanentTradeQueryError(err) {
				updateErr := model.UpdatePendingTopUpStatus(topUp.TradeNo, model.PaymentProviderAlipay, common.TopUpStatusExpired)
				if updateErr != nil && !errors.Is(updateErr, model.ErrTopUpNotFound) && !errors.Is(updateErr, model.ErrTopUpStatusInvalid) {
					logger.LogWarn(ctx, fmt.Sprintf("alipay pending topup permanent failure update failed trade_no=%s error=%v", topUp.TradeNo, updateErr))
				}
			}
			logger.LogWarn(ctx, fmt.Sprintf("alipay trade query failed trade_no=%s error=%v", topUp.TradeNo, err))
			continue
		}

		targetStatus := MapAlipayTradeStatusToLocalStatus(result.TradeStatus)
		switch targetStatus {
		case common.TopUpStatusSuccess:
			if err := model.RechargeAlipay(topUp.TradeNo, "system/alipay-pending-task"); err != nil {
				logger.LogWarn(ctx, fmt.Sprintf("alipay pending topup settle failed trade_no=%s error=%v", topUp.TradeNo, err))
			}
		case common.TopUpStatusExpired, common.TopUpStatusFailed:
			err := model.UpdatePendingTopUpStatus(topUp.TradeNo, model.PaymentProviderAlipay, targetStatus)
			if err != nil && !errors.Is(err, model.ErrTopUpNotFound) && !errors.Is(err, model.ErrTopUpStatusInvalid) {
				logger.LogWarn(ctx, fmt.Sprintf("alipay pending topup status update failed trade_no=%s status=%s error=%v", topUp.TradeNo, targetStatus, err))
			}
		}
	}
}

func isAlipayPendingTaskEnabled() bool {
	return strings.TrimSpace(setting.AlipayAppID) != "" &&
		strings.TrimSpace(setting.AlipayPrivateKey) != "" &&
		strings.TrimSpace(setting.AlipayPublicKey) != "" &&
		strings.TrimSpace(setting.AlipayGateway) != ""
}
