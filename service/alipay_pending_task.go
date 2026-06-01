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
	alipayPendingTickInterval = 30 * time.Second
	alipayPendingBatchSize    = 100
	alipayPendingQueryDelay   = 30 * time.Second
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

func NextAlipayPendingQueryTime(base time.Time) int64 {
	return base.Add(alipayPendingQueryDelay).Unix()
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
	now := time.Now()
	tasks, err := model.GetDueAlipayPendingTasks(now.Unix(), alipayPendingBatchSize)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("alipay pending topup query failed: %v", err))
		return
	}

	for _, task := range tasks {
		topUp := model.GetTopUpByTradeNo(task.TradeNo)
		if topUp == nil || topUp.PaymentProvider != model.PaymentProviderAlipay || topUp.Status != common.TopUpStatusPending {
			_ = model.DeleteAlipayPendingTask(task.TradeNo)
			continue
		}

		result, err := QueryAlipayTrade(ctx, setting.AlipayGateway, setting.AlipayAppID, setting.AlipayPrivateKey, task.TradeNo)
		if err != nil {
			if IsAlipayPermanentTradeQueryError(err) {
				updateErr := model.UpdatePendingTopUpStatus(task.TradeNo, model.PaymentProviderAlipay, common.TopUpStatusExpired)
				if updateErr != nil && !errors.Is(updateErr, model.ErrTopUpNotFound) && !errors.Is(updateErr, model.ErrTopUpStatusInvalid) {
					logger.LogWarn(ctx, fmt.Sprintf("alipay pending topup permanent failure update failed trade_no=%s error=%v", task.TradeNo, updateErr))
				}
				_ = model.DeleteAlipayPendingTask(task.TradeNo)
			} else {
				_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
			}
			logger.LogWarn(ctx, fmt.Sprintf("alipay trade query failed trade_no=%s error=%v", task.TradeNo, err))
			continue
		}

		targetStatus := MapAlipayTradeStatusToLocalStatus(result.TradeStatus)
		switch targetStatus {
		case common.TopUpStatusSuccess:
			if err := model.RechargeAlipay(task.TradeNo, "system/alipay-pending-task"); err != nil {
				_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
				logger.LogWarn(ctx, fmt.Sprintf("alipay pending topup settle failed trade_no=%s error=%v", task.TradeNo, err))
			}
		case common.TopUpStatusPending:
			_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), result.TradeStatus)
		case common.TopUpStatusExpired, common.TopUpStatusFailed:
			err := model.UpdatePendingTopUpStatus(task.TradeNo, model.PaymentProviderAlipay, targetStatus)
			if err != nil && !errors.Is(err, model.ErrTopUpNotFound) && !errors.Is(err, model.ErrTopUpStatusInvalid) {
				_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
				logger.LogWarn(ctx, fmt.Sprintf("alipay pending topup status update failed trade_no=%s status=%s error=%v", task.TradeNo, targetStatus, err))
				continue
			}
			_ = model.DeleteAlipayPendingTask(task.TradeNo)
		}
	}
}

func isAlipayPendingTaskEnabled() bool {
	return strings.TrimSpace(setting.AlipayAppID) != "" &&
		strings.TrimSpace(setting.AlipayPrivateKey) != "" &&
		strings.TrimSpace(setting.AlipayPublicKey) != "" &&
		strings.TrimSpace(setting.AlipayGateway) != ""
}
