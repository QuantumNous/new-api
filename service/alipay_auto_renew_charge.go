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
	"gorm.io/gorm/clause"
)

const alipayAutoRenewChargeLease = 10 * time.Minute

var (
	// ErrAlipayAutoRenewChargeNotClaimed means another worker/request holds the charge lease.
	ErrAlipayAutoRenewChargeNotClaimed = errors.New("alipay auto-renew charge already claimed")
	// ErrAlipayAutoRenewChargeAlreadyPaid means this period was already fulfilled.
	ErrAlipayAutoRenewChargeAlreadyPaid = errors.New("alipay auto-renew charge already paid")
)

// ChargeAlipayAutoRenewContract initiates one period charge for an alipay auto-renew contract.
// On uncertain outcomes it enqueues a short-lived AlipayPendingTask for trade.query (no mid-cycle polling).
// Concurrent callers are serialized by a DB claim lease on the charge attempt row.
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

	seed := strings.TrimSpace(contract.ProviderSubscriptionId)
	if seed == "" {
		seed = strings.TrimSpace(contract.SignupReference)
	}
	outTradeNo := BuildAlipayAutoRenewOutTradeNo(contract.Id, seed, periodStart, periodEnd)

	payMoney := alipaySubscriptionMoney(plan.PriceAmount)
	if payMoney < 0.01 {
		return fmt.Errorf("invalid pay amount")
	}
	amount := FormatAlipayAmount(payMoney)
	subject := fmt.Sprintf("Subscription %s", plan.Title)
	centAmount := int64(payMoney*100 + 0.5)

	claimed, attempt, err := ClaimAlipayAutoRenewChargeAttempt(contract, outTradeNo, periodStart, periodEnd, centAmount, now)
	if err != nil {
		if errors.Is(err, ErrAlipayAutoRenewChargeAlreadyPaid) {
			return nil
		}
		if errors.Is(err, ErrAlipayAutoRenewChargeNotClaimed) {
			// Another worker owns the lease; ensure short query task exists and exit.
			_ = EnsureAlipayAutoRenewChargePendingTask(outTradeNo)
			return nil
		}
		return err
	}
	if !claimed || attempt == nil {
		_ = EnsureAlipayAutoRenewChargePendingTask(outTradeNo)
		return nil
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
			model.CompleteAutoRenewBillingRecords(contract, outTradeNo, centAmount, "CNY")
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
	if err := EnsureAlipayAutoRenewChargePendingTask(outTradeNo); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("alipay auto-renew enqueue pending query failed out_trade_no=%s error=%v", outTradeNo, err))
	}
	if payErr != nil {
		return payErr
	}
	return nil
}

// ClaimAlipayAutoRenewChargeAttempt atomically claims the right to initiate payment for one period.
// Returns claimed=true only for the winner of the lease.
func ClaimAlipayAutoRenewChargeAttempt(
	contract *model.BillingSubscription,
	outTradeNo string,
	periodStart, periodEnd, centAmount int64,
	now time.Time,
) (claimed bool, attempt *model.RecurringChargeAttempt, err error) {
	if contract == nil || contract.Id <= 0 {
		return false, nil, errors.New("invalid contract")
	}
	if strings.TrimSpace(outTradeNo) == "" {
		return false, nil, errors.New("out_trade_no empty")
	}
	nowUnix := now.Unix()
	leaseBefore := nowUnix - int64(alipayAutoRenewChargeLease.Seconds())

	err = model.DB.Transaction(func(tx *gorm.DB) error {
		var locked model.BillingSubscription
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", contract.Id).
			First(&locked).Error; err != nil {
			return err
		}

		// Already fulfilled for this period key.
		var existingSub model.UserSubscription
		q := tx.Where("billing_subscription_id = ? AND provider_invoice_id = ?", locked.Id, outTradeNo).
			Limit(1).Find(&existingSub)
		if q.Error != nil {
			return q.Error
		}
		if q.RowsAffected > 0 {
			return ErrAlipayAutoRenewChargeAlreadyPaid
		}

		var existing model.RecurringChargeAttempt
		findErr := tx.Where("provider = ? AND provider_invoice_id = ?", model.PaymentProviderAlipay, outTradeNo).
			First(&existing).Error
		if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
			return findErr
		}

		if errors.Is(findErr, gorm.ErrRecordNotFound) {
			row := &model.RecurringChargeAttempt{
				BillingSubscriptionId:  locked.Id,
				Provider:               model.PaymentProviderAlipay,
				ProviderInvoiceId:      outTradeNo,
				ProviderSubscriptionId: locked.ProviderSubscriptionId,
				PeriodStart:            periodStart,
				PeriodEnd:              periodEnd,
				Amount:                 centAmount,
				Currency:               "CNY",
				Status:                 model.RecurringChargeStatusPending,
				ClaimedAt:              nowUnix,
			}
			if err := tx.Create(row).Error; err != nil {
				// Unique race: treat as not claimed so caller backs off.
				return ErrAlipayAutoRenewChargeNotClaimed
			}
			attempt = row
			claimed = true
			return nil
		}

		if existing.Status == model.RecurringChargeStatusPaid {
			return ErrAlipayAutoRenewChargeAlreadyPaid
		}

		// Active lease held by another worker.
		if existing.Status == model.RecurringChargeStatusPending &&
			existing.ClaimedAt > leaseBefore {
			attempt = &existing
			claimed = false
			return ErrAlipayAutoRenewChargeNotClaimed
		}

		// Take over failed or expired lease.
		res := tx.Model(&model.RecurringChargeAttempt{}).
			Where("id = ? AND (status = ? OR (status = ? AND claimed_at <= ?))",
				existing.Id,
				model.RecurringChargeStatusFailed,
				model.RecurringChargeStatusPending,
				leaseBefore,
			).
			Updates(map[string]interface{}{
				"billing_subscription_id":  locked.Id,
				"provider_subscription_id": locked.ProviderSubscriptionId,
				"period_start":             periodStart,
				"period_end":               periodEnd,
				"amount":                   centAmount,
				"currency":                 "CNY",
				"status":                   model.RecurringChargeStatusPending,
				"claimed_at":               nowUnix,
				"failure_reason":           "",
				"updated_at":               nowUnix,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			attempt = &existing
			claimed = false
			return ErrAlipayAutoRenewChargeNotClaimed
		}
		if err := tx.First(&existing, existing.Id).Error; err != nil {
			return err
		}
		attempt = &existing
		claimed = true
		return nil
	})
	if err != nil {
		return false, attempt, err
	}
	return claimed, attempt, nil
}

// EnsureAlipayAutoRenewChargePendingTask enqueues a short-lived trade.query for one out_trade_no.
func EnsureAlipayAutoRenewChargePendingTask(outTradeNo string) error {
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
		// Renewal: continue from previous period end (stable across retries).
		startUnix = contract.CurrentPeriodEnd
	} else if contract.CurrentPeriodEnd == 0 || contract.Status == "pending_first_charge" || contract.Status == "pending_signup" {
		// First period: use contract.CreatedAt so retries share one out_trade_no.
		if contract.CreatedAt > 0 {
			startUnix = contract.CreatedAt
		} else {
			startUnix = now.Unix()
		}
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

// BuildAlipayAutoRenewOutTradeNo builds a deterministic merchant trade no for one period.
func BuildAlipayAutoRenewOutTradeNo(contractID int, agreementNo string, periodStart, periodEnd int64) string {
	raw := fmt.Sprintf("aliar%d%s", contractID, common.Sha1([]byte(fmt.Sprintf("%s-%d-%d", agreementNo, periodStart, periodEnd)))[:16])
	if len(raw) > 64 {
		return raw[:64]
	}
	return raw
}

// PrepareAlipayAutoRenewFirstPeriod reserves a stable first-period charge attempt for pay-and-sign checkout.
// Reuses last_invoice_id / contract.CreatedAt so double-clicks share one out_trade_no.
func PrepareAlipayAutoRenewFirstPeriod(contract *model.BillingSubscription, plan *model.SubscriptionPlan, now time.Time) (outTradeNo string, periodStart, periodEnd int64, err error) {
	if contract == nil || plan == nil {
		return "", 0, 0, errors.New("contract or plan is nil")
	}

	err = model.DB.Transaction(func(tx *gorm.DB) error {
		var locked model.BillingSubscription
		if e := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", contract.Id).First(&locked).Error; e != nil {
			return e
		}

		// Reuse existing first-period attempt when present.
		if strings.TrimSpace(locked.LastInvoiceId) != "" {
			var existing model.RecurringChargeAttempt
			e := tx.Where("provider = ? AND provider_invoice_id = ?", model.PaymentProviderAlipay, locked.LastInvoiceId).
				First(&existing).Error
			if e == nil {
				if existing.Status == model.RecurringChargeStatusPaid {
					outTradeNo = existing.ProviderInvoiceId
					periodStart = existing.PeriodStart
					periodEnd = existing.PeriodEnd
					return nil
				}
				// Refresh claim lease for checkout retry (same out_trade_no).
				nowUnix := now.Unix()
				_ = tx.Model(&existing).Updates(map[string]interface{}{
					"claimed_at": nowUnix,
					"status":     model.RecurringChargeStatusPending,
					"updated_at": nowUnix,
				}).Error
				outTradeNo = existing.ProviderInvoiceId
				periodStart = existing.PeriodStart
				periodEnd = existing.PeriodEnd
				return nil
			}
		}

		// Stable first period start: contract creation time (not wall clock on each click).
		periodStart = locked.CreatedAt
		if periodStart <= 0 {
			periodStart = now.Unix()
		}
		end, e := calcAlipayPlanPeriodEnd(time.Unix(periodStart, 0), plan)
		if e != nil {
			return e
		}
		periodEnd = end

		seed := strings.TrimSpace(locked.SignupReference)
		if seed == "" {
			seed = fmt.Sprintf("contract-%d", locked.Id)
		}
		outTradeNo = BuildAlipayAutoRenewOutTradeNo(locked.Id, seed, periodStart, periodEnd)

		payMoney := alipaySubscriptionMoney(plan.PriceAmount)
		centAmount := int64(payMoney*100 + 0.5)
		nowUnix := now.Unix()

		var attempt model.RecurringChargeAttempt
		findErr := tx.Where("provider = ? AND provider_invoice_id = ?", model.PaymentProviderAlipay, outTradeNo).
			First(&attempt).Error
		if errors.Is(findErr, gorm.ErrRecordNotFound) {
			if e := tx.Create(&model.RecurringChargeAttempt{
				BillingSubscriptionId:  locked.Id,
				Provider:               model.PaymentProviderAlipay,
				ProviderInvoiceId:      outTradeNo,
				ProviderSubscriptionId: locked.ProviderSubscriptionId,
				PeriodStart:            periodStart,
				PeriodEnd:              periodEnd,
				Amount:                 centAmount,
				Currency:               "CNY",
				Status:                 model.RecurringChargeStatusPending,
				ClaimedAt:              nowUnix,
			}).Error; e != nil {
				return e
			}
		} else if findErr != nil {
			return findErr
		} else if attempt.Status != model.RecurringChargeStatusPaid {
			_ = tx.Model(&attempt).Updates(map[string]interface{}{
				"claimed_at":   nowUnix,
				"status":       model.RecurringChargeStatusPending,
				"period_start": periodStart,
				"period_end":   periodEnd,
				"amount":       centAmount,
				"updated_at":   nowUnix,
			}).Error
		}

		return tx.Model(&model.BillingSubscription{}).Where("id = ?", locked.Id).Updates(map[string]interface{}{
			"last_invoice_id":      outTradeNo,
			"current_period_start": periodStart,
			"current_period_end":   periodEnd,
			"updated_at":           nowUnix,
		}).Error
	})
	if err != nil {
		return "", 0, 0, err
	}
	return outTradeNo, periodStart, periodEnd, nil
}

// HasAlipayAutoRenewPaidPeriod reports whether the contract already has a paid cycle for outTradeNo.
func HasAlipayAutoRenewPaidPeriod(contractID int, outTradeNo string) bool {
	if contractID <= 0 || strings.TrimSpace(outTradeNo) == "" {
		return false
	}
	var n int64
	_ = model.DB.Model(&model.UserSubscription{}).
		Where("billing_subscription_id = ? AND provider_invoice_id = ?", contractID, outTradeNo).
		Count(&n).Error
	if n > 0 {
		return true
	}
	var attempt model.RecurringChargeAttempt
	if err := model.DB.Where("provider = ? AND provider_invoice_id = ? AND status = ?",
		model.PaymentProviderAlipay, outTradeNo, model.RecurringChargeStatusPaid).First(&attempt).Error; err == nil {
		return true
	}
	return false
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
	if attempt.Status == model.RecurringChargeStatusPaid {
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
		var bill model.BillingSubscription
		if cErr := model.DB.First(&bill, attempt.BillingSubscriptionId).Error; cErr == nil {
			model.CompleteAutoRenewBillingRecords(&bill, outTradeNo, attempt.Amount, attempt.Currency)
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
