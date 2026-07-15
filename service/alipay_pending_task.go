package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
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
			logger.LogInfo(context.Background(), fmt.Sprintf("alipay pending task started: tick=%s", alipayPendingTickInterval))
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

func alipayOrderQueryExpired(createTime int64, now time.Time) bool {
	if createTime <= 0 {
		return false
	}
	timeout := DefaultAlipayTimeoutExpress()
	duration, err := parseAlipayTimeoutExpress(timeout)
	if err != nil || duration <= 0 {
		duration = 30 * time.Minute
	}
	return now.Unix() >= createTime+int64(duration.Seconds())
}

func parseAlipayTimeoutExpress(timeout string) (time.Duration, error) {
	trimmed := strings.ToLower(strings.TrimSpace(timeout))
	if trimmed == "" {
		return 0, errors.New("empty timeout express")
	}
	if strings.HasSuffix(trimmed, "m") {
		value, err := strconv.Atoi(strings.TrimSuffix(trimmed, "m"))
		if err != nil {
			return 0, err
		}
		return time.Duration(value) * time.Minute, nil
	}
	if strings.HasSuffix(trimmed, "h") {
		value, err := strconv.Atoi(strings.TrimSuffix(trimmed, "h"))
		if err != nil {
			return 0, err
		}
		return time.Duration(value) * time.Hour, nil
	}
	if strings.HasSuffix(trimmed, "d") {
		value, err := strconv.Atoi(strings.TrimSuffix(trimmed, "d"))
		if err != nil {
			return 0, err
		}
		return time.Duration(value) * 24 * time.Hour, nil
	}
	return 0, fmt.Errorf("unsupported timeout express: %s", timeout)
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
		logger.LogWarn(ctx, fmt.Sprintf("alipay pending query failed: %v", err))
		return
	}

	for _, task := range tasks {
		switch task.TradeType {
		case model.AlipayPendingTaskTypeSubscription:
			handleAlipayPendingSubscriptionTask(ctx, now, task)
		case model.AlipayPendingTaskTypeAutoRenewCharge:
			handleAlipayPendingAutoRenewChargeTask(ctx, now, task)
		default:
			handleAlipayPendingTopUpTask(ctx, now, task)
		}
	}
}

func handleAlipayPendingAutoRenewChargeTask(ctx context.Context, now time.Time, task *model.AlipayPendingTask) {
	var attempt model.RecurringChargeAttempt
	err := model.DB.Where("provider = ? AND provider_invoice_id = ?", model.PaymentProviderAlipay, task.TradeNo).First(&attempt).Error
	if err != nil {
		_ = model.DeleteAlipayPendingTask(task.TradeNo)
		return
	}
	if attempt.Status == "paid" {
		_ = model.DeleteAlipayPendingTask(task.TradeNo)
		return
	}

	// Bound short query window (~2h) so mid-life subscriptions are never polled forever.
	if attempt.CreatedAt > 0 && now.Unix() >= attempt.CreatedAt+2*3600 {
		_ = model.RecordRecurringInvoiceFailure(&model.RecurringChargeAttempt{
			BillingSubscriptionId:  attempt.BillingSubscriptionId,
			Provider:               model.PaymentProviderAlipay,
			ProviderInvoiceId:      attempt.ProviderInvoiceId,
			ProviderSubscriptionId: attempt.ProviderSubscriptionId,
			PeriodStart:            attempt.PeriodStart,
			PeriodEnd:              attempt.PeriodEnd,
			Amount:                 attempt.Amount,
			Currency:               attempt.Currency,
			FailureReason:          "query_timeout",
			ProviderPayload:        attempt.ProviderPayload,
		})
		_ = model.DeleteAlipayPendingTask(task.TradeNo)
		logger.LogWarn(ctx, fmt.Sprintf("alipay auto-renew charge query timed out trade_no=%s", task.TradeNo))
		return
	}

	result, err := QueryAlipayTrade(ctx, setting.AlipayGateway, setting.AlipayAppID, setting.AlipayPrivateKey, task.TradeNo)
	if err != nil {
		if IsAlipayPermanentTradeQueryError(err) {
			if attempt.CreatedAt > 0 && now.Unix() < attempt.CreatedAt+30*60 {
				_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
				return
			}
			_ = FinalizeAlipayAutoRenewChargeFromQuery(ctx, task.TradeNo, "TRADE_CLOSED", common.GetJsonString(map[string]string{"error": err.Error()}))
			return
		}
		_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
		logger.LogWarn(ctx, fmt.Sprintf("alipay auto-renew charge query failed trade_no=%s error=%v", task.TradeNo, err))
		return
	}

	if err := FinalizeAlipayAutoRenewChargeFromQuery(ctx, task.TradeNo, result.TradeStatus, common.GetJsonString(result)); err != nil {
		_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
		logger.LogWarn(ctx, fmt.Sprintf("alipay auto-renew charge finalize failed trade_no=%s error=%v", task.TradeNo, err))
	}
}

func handleAlipayPendingTopUpTask(ctx context.Context, now time.Time, task *model.AlipayPendingTask) {
	topUp := model.GetTopUpByTradeNo(task.TradeNo)
	if topUp == nil || topUp.PaymentProvider != model.PaymentProviderAlipay || topUp.Status != common.TopUpStatusPending {
		_ = model.DeleteAlipayPendingTask(task.TradeNo)
		return
	}

	result, err := QueryAlipayTrade(ctx, setting.AlipayGateway, setting.AlipayAppID, setting.AlipayPrivateKey, task.TradeNo)
	if err != nil {
		if IsAlipayPermanentTradeQueryError(err) {
			if !alipayOrderQueryExpired(topUp.CreateTime, now) {
				_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
				logger.LogWarn(ctx, fmt.Sprintf("alipay pending topup trade not found before timeout, will retry trade_no=%s error=%v", task.TradeNo, err))
				return
			}
			updateErr := model.UpdatePendingTopUpStatus(task.TradeNo, model.PaymentProviderAlipay, common.TopUpStatusExpired)
			if updateErr != nil && !errors.Is(updateErr, model.ErrTopUpNotFound) && !errors.Is(updateErr, model.ErrTopUpStatusInvalid) {
				_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), updateErr.Error())
				logger.LogWarn(ctx, fmt.Sprintf("alipay pending topup permanent failure update failed trade_no=%s error=%v", task.TradeNo, updateErr))
				return
			}
			_ = model.DeleteAlipayPendingTask(task.TradeNo)
		} else {
			_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
		}
		logger.LogWarn(ctx, fmt.Sprintf("alipay trade query failed trade_no=%s error=%v", task.TradeNo, err))
		return
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
			return
		}
		_ = model.DeleteAlipayPendingTask(task.TradeNo)
	}
}

func handleAlipayPendingSubscriptionTask(ctx context.Context, now time.Time, task *model.AlipayPendingTask) {
	order := model.GetSubscriptionOrderByTradeNo(task.TradeNo)
	if order == nil || order.PaymentProvider != model.PaymentProviderAlipay || order.Status != common.TopUpStatusPending {
		_ = model.DeleteAlipayPendingTask(task.TradeNo)
		return
	}

	result, err := QueryAlipayTrade(ctx, setting.AlipayGateway, setting.AlipayAppID, setting.AlipayPrivateKey, task.TradeNo)
	if err != nil {
		if IsAlipayPermanentTradeQueryError(err) {
			if !alipayOrderQueryExpired(order.CreateTime, now) {
				_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
				logger.LogWarn(ctx, fmt.Sprintf("alipay pending subscription trade not found before timeout, will retry trade_no=%s error=%v", task.TradeNo, err))
				return
			}
			if expireErr := model.ExpireSubscriptionOrder(task.TradeNo, model.PaymentProviderAlipay); expireErr != nil &&
				!errors.Is(expireErr, model.ErrSubscriptionOrderNotFound) &&
				!errors.Is(expireErr, model.ErrPaymentMethodMismatch) {
				_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), expireErr.Error())
				logger.LogWarn(ctx, fmt.Sprintf("alipay pending subscription expire failed trade_no=%s error=%v", task.TradeNo, expireErr))
				return
			}
			_ = model.DeleteAlipayPendingTask(task.TradeNo)
		} else {
			_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
		}
		logger.LogWarn(ctx, fmt.Sprintf("alipay pending subscription query failed trade_no=%s error=%v", task.TradeNo, err))
		return
	}

	switch MapAlipayTradeStatusToLocalStatus(result.TradeStatus) {
	case common.TopUpStatusSuccess:
		if err := model.CompleteSubscriptionOrder(task.TradeNo, common.GetJsonString(result), model.PaymentProviderAlipay, model.PaymentMethodAlipay); err != nil {
			if errors.Is(err, model.ErrSubscriptionOrderNotFound) || errors.Is(err, model.ErrSubscriptionOrderStatusInvalid) || errors.Is(err, model.ErrPaymentMethodMismatch) {
				_ = model.DeleteAlipayPendingTask(task.TradeNo)
				return
			}
			_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
			logger.LogWarn(ctx, fmt.Sprintf("alipay pending subscription settle failed trade_no=%s error=%v", task.TradeNo, err))
			return
		}
		_ = model.DeleteAlipayPendingTask(task.TradeNo)
	case common.TopUpStatusPending:
		_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), result.TradeStatus)
	case common.TopUpStatusExpired, common.TopUpStatusFailed:
		if err := model.ExpireSubscriptionOrder(task.TradeNo, model.PaymentProviderAlipay); err != nil &&
			!errors.Is(err, model.ErrSubscriptionOrderNotFound) &&
			!errors.Is(err, model.ErrPaymentMethodMismatch) {
			_ = model.UpdateAlipayPendingTaskRetry(task.TradeNo, NextAlipayPendingQueryTime(now), err.Error())
			logger.LogWarn(ctx, fmt.Sprintf("alipay pending subscription status update failed trade_no=%s error=%v", task.TradeNo, err))
			return
		}
		_ = model.DeleteAlipayPendingTask(task.TradeNo)
	}
}

func isAlipayPendingTaskEnabled() bool {
	return strings.TrimSpace(setting.AlipayAppID) != "" &&
		strings.TrimSpace(setting.AlipayPrivateKey) != "" &&
		strings.TrimSpace(setting.AlipayPublicKey) != "" &&
		strings.TrimSpace(setting.AlipayGateway) != ""
}
