package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// ChargeAlipayAutoRenewContract initiates one period charge for an alipay auto-renew contract.
// On uncertain outcomes it enqueues a short-lived AlipayPendingTask for trade.query (no mid-cycle polling).
func ChargeAlipayAutoRenewContract(ctx context.Context, contract *model.BillingSubscription, notifyURL string) error {
	if contract == nil {
		return errors.New("contract is nil")
	}
	if contract.Provider != model.PaymentProviderAlipay {
		return errors.New("contract is not alipay")
	}
	if strings.TrimSpace(contract.ProviderSubscriptionId) == "" {
		return errors.New("agreement_no is empty")
	}
	if !IsAlipayCyclePayConfigured() {
		return errors.New("alipay cycle pay is not configured")
	}

	plan, err := model.GetSubscriptionPlanById(contract.PlanId)
	if err != nil {
		return err
	}

	now := time.Now()
	periodStart, periodEnd, err := nextAlipayAutoRenewPeriod(contract, plan, now)
	if err != nil {
		return err
	}
	outTradeNo := buildAlipayAutoRenewOutTradeNo(contract.Id, contract.ProviderSubscriptionId, periodStart, periodEnd)

	// Already fulfilled for this period key.
	var existing model.UserSubscription
	if err := model.DB.Where("billing_subscription_id = ? AND provider_invoice_id = ?", contract.Id, outTradeNo).
		Limit(1).Find(&existing).Error; err == nil && existing.Id > 0 {
		return nil
	}

	// In-flight charge already queued for query — do not double-pay.
	if hasOpenAlipayAutoRenewCharge(outTradeNo) {
		return nil
	}

	payMoney := alipaySubscriptionMoney(plan.PriceAmount)
	if payMoney < 0.01 {
		return fmt.Errorf("invalid pay amount")
	}
	amount := FormatAlipayAmount(payMoney)
	subject := fmt.Sprintf("Subscription %s", plan.Title)
	centAmount := int64(payMoney*100 + 0.5)

	if err := upsertPendingAlipayChargeAttempt(contract, outTradeNo, periodStart, periodEnd, centAmount); err != nil {
		return err
	}

	rsp, payErr := TradePayAlipayWithAgreement(ctx, AlipayAgreementTradePayRequest{
		OutTradeNo:  outTradeNo,
		TotalAmount: amount,
		Subject:     subject,
		AgreementNo: contract.ProviderSubscriptionId,
		NotifyURL:   notifyURL,
	})

	payload := ""
	if rsp != nil {
		payload = common.GetJsonString(rsp)
	} else if payErr != nil {
		payload = common.GetJsonString(map[string]string{"error": payErr.Error()})
	}

	// Sync success path (some gateways return trade no immediately).
	if payErr == nil && rsp != nil && strings.TrimSpace(rsp.TradeNo) != "" {
		if err := model.FulfillRecurringInvoice(&model.RecurringChargeAttempt{
			BillingSubscriptionId:  contract.Id,
			Provider:               model.PaymentProviderAlipay,
			ProviderInvoiceId:      outTradeNo,
			ProviderSubscriptionId: contract.ProviderSubscriptionId,
			PeriodStart:            periodStart,
			PeriodEnd:              periodEnd,
			Amount:                 centAmount,
			Currency:               "CNY",
			PaymentStatus:          "paid",
			ProviderCustomerId:     contract.ProviderCustomerId,
			ProviderPayload:        payload,
		}); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("alipay auto-renew fulfill after pay failed out_trade_no=%s error=%v", outTradeNo, err))
		} else {
			_ = model.DeleteAlipayPendingTask(outTradeNo)
			return nil
		}
	}

	if payErr != nil {
		_ = model.RecordRecurringInvoiceFailure(&model.RecurringChargeAttempt{
			BillingSubscriptionId:  contract.Id,
			Provider:               model.PaymentProviderAlipay,
			ProviderInvoiceId:      outTradeNo,
			ProviderSubscriptionId: contract.ProviderSubscriptionId,
			PeriodStart:            periodStart,
			PeriodEnd:              periodEnd,
			Amount:                 centAmount,
			Currency:               "CNY",
			FailureReason:          payErr.Error(),
			ProviderPayload:        payload,
		})
		// Keep period_end in the past so the light due-scan can retry later.
		dueEnd := contract.CurrentPeriodEnd
		if dueEnd <= 0 || dueEnd > now.Unix() {
			dueEnd = now.Unix()
		}
		_ = model.UpsertBillingSubscriptionByProviderID(&model.BillingSubscription{
			UserId:                 contract.UserId,
			PlanId:                 contract.PlanId,
			Provider:               contract.Provider,
			ProviderSubscriptionId: contract.ProviderSubscriptionId,
			ProviderCustomerId:     contract.ProviderCustomerId,
			ProviderPriceId:        contract.ProviderPriceId,
			Status:                 "past_due",
			CancelAtPeriodEnd:      contract.CancelAtPeriodEnd,
			CurrentPeriodStart:     contract.CurrentPeriodStart,
			CurrentPeriodEnd:       dueEnd,
			LastInvoiceId:          outTradeNo,
			LastPaymentStatus:      "failed",
			ProviderPayload:        payload,
		})
	}

	// Short-lived query only for this out_trade_no (not mid-cycle polling of all contracts).
	if err := ensureAlipayAutoRenewChargePendingTask(outTradeNo); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("alipay auto-renew enqueue pending query failed out_trade_no=%s error=%v", outTradeNo, err))
	}
	if payErr != nil {
		return payErr
	}
	return nil
}

func upsertPendingAlipayChargeAttempt(contract *model.BillingSubscription, outTradeNo string, periodStart, periodEnd, centAmount int64) error {
	var attempt model.RecurringChargeAttempt
	err := model.DB.Where("provider = ? AND provider_invoice_id = ?", model.PaymentProviderAlipay, outTradeNo).First(&attempt).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.DB.Create(&model.RecurringChargeAttempt{
			BillingSubscriptionId:  contract.Id,
			Provider:               model.PaymentProviderAlipay,
			ProviderInvoiceId:      outTradeNo,
			ProviderSubscriptionId: contract.ProviderSubscriptionId,
			PeriodStart:            periodStart,
			PeriodEnd:              periodEnd,
			Amount:                 centAmount,
			Currency:               "CNY",
			Status:                 "pending",
		}).Error
	}
	if err != nil {
		return err
	}
	if attempt.Status == "paid" {
		return nil
	}
	return model.DB.Model(&attempt).Updates(map[string]interface{}{
		"billing_subscription_id":  contract.Id,
		"provider_subscription_id": contract.ProviderSubscriptionId,
		"period_start":             periodStart,
		"period_end":               periodEnd,
		"amount":                   centAmount,
		"currency":                 "CNY",
		"status":                   "pending",
		"failure_reason":           "",
		"updated_at":               common.GetTimestamp(),
	}).Error
}

func hasOpenAlipayAutoRenewCharge(outTradeNo string) bool {
	var attempt model.RecurringChargeAttempt
	err := model.DB.Where("provider = ? AND provider_invoice_id = ? AND status IN ?",
		model.PaymentProviderAlipay, outTradeNo, []string{"pending", "pending_contract"}).
		First(&attempt).Error
	if err == nil {
		// Only treat as open if a pending query task still exists, or attempt is very recent.
		var task model.AlipayPendingTask
		if e := model.DB.Where("trade_no = ?", outTradeNo).First(&task).Error; e == nil {
			return true
		}
		// No task and still pending: allow retry after a short grace to avoid thundering herd.
		if attempt.UpdatedAt > 0 && common.GetTimestamp()-attempt.UpdatedAt < 120 {
			return true
		}
		return false
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false
	}
	var task model.AlipayPendingTask
	err = model.DB.Where("trade_no = ? AND trade_type = ?", outTradeNo, model.AlipayPendingTaskTypeAutoRenewCharge).First(&task).Error
	return err == nil
}

func ensureAlipayAutoRenewChargePendingTask(outTradeNo string) error {
	if strings.TrimSpace(outTradeNo) == "" {
		return errors.New("out_trade_no empty")
	}
	var existing model.AlipayPendingTask
	err := model.DB.Where("trade_no = ?", outTradeNo).First(&existing).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return model.CreateAlipayPendingTask(model.AlipayPendingTaskTypeAutoRenewCharge, outTradeNo, NextAlipayPendingQueryTime(time.Now()), nil)
}

func nextAlipayAutoRenewPeriod(contract *model.BillingSubscription, plan *model.SubscriptionPlan, now time.Time) (int64, int64, error) {
	if plan == nil {
		return 0, 0, errors.New("plan is nil")
	}
	startUnix := now.Unix()
	if contract.CurrentPeriodEnd > 0 && contract.CurrentPeriodEnd <= now.Unix() {
		// Renewal: continue from previous period end.
		startUnix = contract.CurrentPeriodEnd
	} else if contract.CurrentPeriodEnd == 0 || contract.Status == "pending_first_charge" {
		// First charge.
		startUnix = now.Unix()
	} else if contract.CurrentPeriodEnd > now.Unix() {
		return 0, 0, errors.New("contract period has not ended")
	}

	start := time.Unix(startUnix, 0)
	endUnix, err := calcAlipayPlanPeriodEnd(start, plan)
	if err != nil {
		return 0, 0, err
	}
	if endUnix <= startUnix {
		return 0, 0, errors.New("invalid period end")
	}
	return startUnix, endUnix, nil
}

func calcAlipayPlanPeriodEnd(start time.Time, plan *model.SubscriptionPlan) (int64, error) {
	if plan == nil {
		return 0, errors.New("plan is nil")
	}
	if plan.DurationValue <= 0 && plan.DurationUnit != model.SubscriptionDurationCustom {
		return 0, errors.New("duration_value must be > 0")
	}
	switch plan.DurationUnit {
	case model.SubscriptionDurationYear:
		return start.AddDate(plan.DurationValue, 0, 0).Unix(), nil
	case model.SubscriptionDurationMonth:
		return start.AddDate(0, plan.DurationValue, 0).Unix(), nil
	case model.SubscriptionDurationDay:
		return start.AddDate(0, 0, plan.DurationValue).Unix(), nil
	case model.SubscriptionDurationHour:
		return start.Add(time.Duration(plan.DurationValue) * time.Hour).Unix(), nil
	case model.SubscriptionDurationCustom:
		if plan.CustomSeconds <= 0 {
			return 0, errors.New("custom_seconds must be > 0")
		}
		return start.Add(time.Duration(plan.CustomSeconds) * time.Second).Unix(), nil
	default:
		return 0, fmt.Errorf("invalid duration_unit: %s", plan.DurationUnit)
	}
}

func buildAlipayAutoRenewOutTradeNo(contractID int, agreementNo string, periodStart, periodEnd int64) string {
	raw := fmt.Sprintf("aliar%d%s", contractID, common.Sha1([]byte(fmt.Sprintf("%s-%d-%d", agreementNo, periodStart, periodEnd)))[:16])
	if len(raw) > 64 {
		return raw[:64]
	}
	return raw
}

func alipaySubscriptionMoney(amountUSD float64) float64 {
	rate := operation_setting.USDExchangeRate
	if rate <= 0 {
		rate = 1
	}
	return amountUSD * rate
}

// FinalizeAlipayAutoRenewChargeFromQuery settles a pending auto-renew charge using trade.query result.
func FinalizeAlipayAutoRenewChargeFromQuery(ctx context.Context, outTradeNo string, tradeStatus string, payload string) error {
	if strings.TrimSpace(outTradeNo) == "" {
		return errors.New("out_trade_no empty")
	}
	var attempt model.RecurringChargeAttempt
	if err := model.DB.Where("provider = ? AND provider_invoice_id = ?", model.PaymentProviderAlipay, outTradeNo).First(&attempt).Error; err != nil {
		return err
	}
	if attempt.Status == "paid" {
		_ = model.DeleteAlipayPendingTask(outTradeNo)
		return nil
	}

	localStatus := MapAlipayTradeStatusToLocalStatus(tradeStatus)
	switch localStatus {
	case common.TopUpStatusSuccess:
		if err := model.FulfillRecurringInvoice(&model.RecurringChargeAttempt{
			BillingSubscriptionId:  attempt.BillingSubscriptionId,
			Provider:               model.PaymentProviderAlipay,
			ProviderInvoiceId:      outTradeNo,
			ProviderSubscriptionId: attempt.ProviderSubscriptionId,
			PeriodStart:            attempt.PeriodStart,
			PeriodEnd:              attempt.PeriodEnd,
			Amount:                 attempt.Amount,
			Currency:               attempt.Currency,
			PaymentStatus:          "paid",
			ProviderPayload:        payload,
		}); err != nil {
			return err
		}
		_ = model.DeleteAlipayPendingTask(outTradeNo)
		return nil
	case common.TopUpStatusPending:
		return model.UpdateAlipayPendingTaskRetry(outTradeNo, NextAlipayPendingQueryTime(time.Now()), tradeStatus)
	case common.TopUpStatusExpired, common.TopUpStatusFailed:
		_ = model.RecordRecurringInvoiceFailure(&model.RecurringChargeAttempt{
			BillingSubscriptionId:  attempt.BillingSubscriptionId,
			Provider:               model.PaymentProviderAlipay,
			ProviderInvoiceId:      outTradeNo,
			ProviderSubscriptionId: attempt.ProviderSubscriptionId,
			PeriodStart:            attempt.PeriodStart,
			PeriodEnd:              attempt.PeriodEnd,
			Amount:                 attempt.Amount,
			Currency:               attempt.Currency,
			FailureReason:          tradeStatus,
			ProviderPayload:        payload,
		})
		if contract, err := model.GetBillingSubscriptionByProviderSubscriptionID(model.PaymentProviderAlipay, attempt.ProviderSubscriptionId); err == nil {
			dueEnd := contract.CurrentPeriodEnd
			if dueEnd <= 0 {
				dueEnd = common.GetTimestamp()
			}
			_ = model.UpsertBillingSubscriptionByProviderID(&model.BillingSubscription{
				UserId:                 contract.UserId,
				PlanId:                 contract.PlanId,
				Provider:               contract.Provider,
				ProviderSubscriptionId: contract.ProviderSubscriptionId,
				ProviderCustomerId:     contract.ProviderCustomerId,
				ProviderPriceId:        contract.ProviderPriceId,
				Status:                 "past_due",
				CancelAtPeriodEnd:      contract.CancelAtPeriodEnd,
				CurrentPeriodStart:     contract.CurrentPeriodStart,
				CurrentPeriodEnd:       dueEnd,
				LastInvoiceId:          outTradeNo,
				LastPaymentStatus:      tradeStatus,
				ProviderPayload:        payload,
			})
		}
		_ = model.DeleteAlipayPendingTask(outTradeNo)
		return nil
	default:
		return model.UpdateAlipayPendingTaskRetry(outTradeNo, NextAlipayPendingQueryTime(time.Now()), tradeStatus)
	}
}

// MarkAlipayAutoRenewContractsCanceledAtPeriodEnd finalizes cancel_at_period_end contracts after period end.
func MarkAlipayAutoRenewContractsCanceledAtPeriodEnd(now int64, limit int) (int, error) {
	contracts, err := model.ListExpiredCancelAtPeriodEndAlipayContracts(now, limit)
	if err != nil {
		return 0, err
	}
	n := 0
	for i := range contracts {
		c := contracts[i]
		if err := model.UpsertBillingSubscriptionByProviderID(&model.BillingSubscription{
			UserId:                 c.UserId,
			PlanId:                 c.PlanId,
			Provider:               c.Provider,
			ProviderSubscriptionId: c.ProviderSubscriptionId,
			ProviderCustomerId:     c.ProviderCustomerId,
			ProviderPriceId:        c.ProviderPriceId,
			Status:                 "canceled",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     c.CurrentPeriodStart,
			CurrentPeriodEnd:       c.CurrentPeriodEnd,
			LastInvoiceId:          c.LastInvoiceId,
			LastPaymentStatus:      c.LastPaymentStatus,
			ProviderPayload:        c.ProviderPayload,
		}); err != nil {
			return n, err
		}
		n++
	}
	return n, nil
}

// AlipaySubscriptionNotifyURL returns the notify URL used for cycle-pay callbacks.
// Always uses the subscription path so top-up AlipayNotifyURL overrides do not steal events.
func AlipaySubscriptionNotifyURL() string {
	return strings.TrimRight(GetCallbackAddress(), "/") + "/api/subscription/alipay/notify"
}
