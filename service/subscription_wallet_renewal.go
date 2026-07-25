package service

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

type WalletSubscriptionRenewalResult struct {
	ContractID    int64
	Renewed       bool
	PausedStatus  string
	ChargedQuota  int64
	EntitlementID int
	OrderID       int
}

type walletRenewalAttempt struct {
	ContractID      int64
	UserID          int
	PlanID          int
	PeriodStart     int64
	PeriodEnd       int64
	RenewalKey      string
	TradeNo         string
	RequiredQuota   int
	PriceAmount     float64
	PaymentCurrency string
	PlanSnapshot    string
	GrantInput      model.GrantEntitlementInput
}

func RunWalletSubscriptionRenewalOnce(limit int) (int, error) {
	if limit <= 0 {
		limit = subscriptionResetBatchSize
	}
	now := common.GetTimestamp()
	var contracts []model.UserSubscriptionContract
	if err := model.DB.
		Where("status = ? AND renewal_source = ? AND renewal_status = ? AND current_period_end > ? AND current_period_end <= ?",
			model.SubscriptionContractStatusActive,
			model.SubscriptionRenewalSourceWallet,
			model.SubscriptionRenewalStatusEnabled,
			0,
			now).
		Order("current_period_end asc, id asc").
		Limit(limit).
		Find(&contracts).Error; err != nil {
		return 0, err
	}
	renewed := 0
	for _, contract := range contracts {
		result, err := RenewWalletSubscriptionContract(contract.Id)
		if err != nil {
			return renewed, err
		}
		if result.Renewed {
			renewed++
		}
	}
	return renewed, nil
}

func RenewWalletSubscriptionContract(contractID int64) (*WalletSubscriptionRenewalResult, error) {
	if contractID <= 0 {
		return nil, errors.New("invalid contract id")
	}
	var result *WalletSubscriptionRenewalResult
	var attempt *walletRenewalAttempt
	invalidateUserID := 0
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var contract model.UserSubscriptionContract
		if err := subscriptionCommandLock(tx).Where("id = ?", contractID).First(&contract).Error; err != nil {
			return err
		}
		result = &WalletSubscriptionRenewalResult{ContractID: contract.Id}
		if !walletContractIsRenewable(contract) {
			return nil
		}
		plan, err := loadEnabledSubscriptionPlanTx(tx, contract.CurrentPlanId)
		if err != nil {
			return pauseWalletRenewalTx(tx, &contract, model.SubscriptionRenewalStatusPausedPlanUnavailable, result)
		}
		if err := validateFlexiblePrepaidPlan(plan); err != nil {
			return pauseWalletRenewalTx(tx, &contract, model.SubscriptionRenewalStatusPausedPlanUnavailable, result)
		}
		if plan.AllowBalancePay != nil && !*plan.AllowBalancePay {
			return pauseWalletRenewalTx(tx, &contract, model.SubscriptionRenewalStatusPausedPlanUnavailable, result)
		}
		var user model.User
		if err := subscriptionCommandLock(tx).Where("id = ?", contract.UserId).First(&user).Error; err != nil {
			return err
		}
		requiredQuota, err := subscriptionBalanceQuota(plan.PriceAmount)
		if err != nil {
			return err
		}
		if requiredQuota > 0 && user.Quota < requiredQuota {
			return pauseWalletRenewalTx(tx, &contract, model.SubscriptionRenewalStatusPausedInsufficientBalance, result)
		}

		periodStart := contract.CurrentPeriodEnd
		periodEnd := time.Unix(periodStart, 0).AddDate(0, 1, 0).Unix()
		renewalKey := walletRenewalKey(contract.Id, periodStart, plan.Id)
		tradeNo := walletRenewalTradeNo(contract.Id, periodStart, plan.Id)
		now := common.GetTimestamp()
		planSnapshot, err := subscriptionPurchasePlanSnapshot(plan)
		if err != nil {
			return err
		}
		grantInput := model.GrantEntitlementInput{
			ContractId:           contract.Id,
			UserId:               user.Id,
			PlanId:               plan.Id,
			ProviderBindingId:    0,
			GrantKey:             renewalKey,
			PaymentMode:          model.SubscriptionPaymentModePrepaid,
			AmountTotal:          plan.TotalAmount,
			MediaCreditsTotal:    plan.MediaCreditsMonthly,
			Window5hAmount:       common.GetPointer(plan.Window5hAmount),
			WindowWeekAmount:     common.GetPointer(plan.WindowWeekAmount),
			UpgradeGroup:         common.GetPointer(plan.UpgradeGroup),
			PeriodStart:          periodStart,
			PeriodEnd:            periodEnd,
			EndReasonForPrevious: model.SubscriptionEntitlementEndReasonRenewed,
			Source:               model.PaymentMethodBalance,
		}
		attempt = &walletRenewalAttempt{
			ContractID:      contract.Id,
			UserID:          user.Id,
			PlanID:          plan.Id,
			PeriodStart:     periodStart,
			PeriodEnd:       periodEnd,
			RenewalKey:      renewalKey,
			TradeNo:         tradeNo,
			RequiredQuota:   requiredQuota,
			PriceAmount:     plan.PriceAmount,
			PaymentCurrency: plan.Currency,
			PlanSnapshot:    planSnapshot,
			GrantInput:      grantInput,
		}
		order := &model.SubscriptionOrder{
			UserId:          user.Id,
			PlanId:          plan.Id,
			Money:           plan.PriceAmount,
			TradeNo:         tradeNo,
			PaymentMethod:   model.PaymentMethodBalance,
			PaymentProvider: model.PaymentProviderBalance,
			Status:          common.TopUpStatusSuccess,
			CreateTime:      now,
			CompleteTime:    now,
			PurchaseMonths:  1,
			UnitPrice:       plan.PriceAmount,
			PaymentCurrency: plan.Currency,
			PlanSnapshot:    planSnapshot,
			ProviderPayload: fmt.Sprintf("charged_quota=%d;contract_id=%d;renewal_key=%s", requiredQuota, contract.Id, renewalKey),
			RenewalSource:   model.SubscriptionRenewalSourceWallet,
		}
		if err := tx.Create(order).Error; err != nil {
			return handleExistingWalletRenewalTx(tx, &contract, renewalKey, result, err)
		}
		if requiredQuota > 0 {
			res := tx.Model(&model.User{}).Where("id = ? AND quota >= ?", user.Id, requiredQuota).
				Update("quota", gorm.Expr("quota - ?", requiredQuota))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected != 1 {
				deleted := tx.Where("id = ? AND trade_no = ?", order.Id, order.TradeNo).Delete(&model.SubscriptionOrder{})
				if deleted.Error != nil {
					return deleted.Error
				}
				if deleted.RowsAffected != 1 {
					return errors.New("wallet renewal success order cleanup failed")
				}
				return pauseWalletRenewalTx(tx, &contract, model.SubscriptionRenewalStatusPausedInsufficientBalance, result)
			}
			if err := tx.Create(&model.WalletLedgerEntry{
				UserId:      user.Id,
				EntryKey:    renewalKey,
				QuotaDelta:  -int64(requiredQuota),
				MoneyAmount: plan.PriceAmount,
				EntryType:   model.WalletLedgerEntryTypePrepaidDebit,
				OrderId:     order.Id,
			}).Error; err != nil {
				return handleExistingWalletRenewalTx(tx, &contract, renewalKey, result, err)
			}
		}
		grant, err := model.RotateCurrentEntitlementTx(tx, grantInput)
		if err != nil {
			return handleExistingWalletRenewalTx(tx, &contract, renewalKey, result, err)
		}
		if err := createPrepaidTermSegmentsTx(tx, contract.Id, order.Id, plan.Id, PrepaidTermAllocation{
			CanonicalWalletUnitPrice: plan.PriceAmount,
		}, periodStart, 1); err != nil {
			return err
		}
		if err := tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
			"renewal_status":       model.SubscriptionRenewalStatusEnabled,
			"current_period_start": periodStart,
			"current_period_end":   periodEnd,
			"updated_at":           now,
		}).Error; err != nil {
			return err
		}
		result.Renewed = true
		result.ChargedQuota = int64(requiredQuota)
		result.OrderID = order.Id
		if grant != nil && grant.Entitlement != nil {
			result.EntitlementID = grant.Entitlement.Id
		}
		invalidateUserID = user.Id
		return nil
	})
	if err != nil {
		if !common.UsingPostgreSQL || attempt == nil || !isWalletRenewalDuplicateError(err) {
			return nil, err
		}
		result, err = recoverPostgresWalletRenewalDuplicate(*attempt)
		if err != nil {
			return nil, err
		}
		invalidateUserID = attempt.UserID
	}
	if invalidateUserID > 0 {
		if err := model.InvalidateUserCache(invalidateUserID); err != nil {
			common.SysLog("failed to invalidate user cache after wallet renewal: " + err.Error())
		}
	}
	return result, nil
}

func recoverPostgresWalletRenewalDuplicate(attempt walletRenewalAttempt) (*WalletSubscriptionRenewalResult, error) {
	if attempt.ContractID <= 0 || attempt.UserID <= 0 || attempt.PlanID <= 0 || attempt.PeriodEnd <= attempt.PeriodStart ||
		strings.TrimSpace(attempt.TradeNo) == "" || strings.TrimSpace(attempt.RenewalKey) == "" || attempt.RequiredQuota < 0 ||
		strings.TrimSpace(attempt.PlanSnapshot) == "" || !walletRenewalAttemptGrantInputMatches(attempt) {
		return nil, errors.New("wallet renewal duplicate recovery input is invalid")
	}

	recovered := &WalletSubscriptionRenewalResult{
		ContractID:   attempt.ContractID,
		ChargedQuota: int64(attempt.RequiredQuota),
	}
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var order model.SubscriptionOrder
		if err := tx.Where("trade_no = ?", attempt.TradeNo).First(&order).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return walletRenewalDuplicateFactsError("success order %q is missing", attempt.TradeNo)
			}
			return fmt.Errorf("read wallet renewal duplicate order: %w", err)
		}
		expectedPayload := fmt.Sprintf("charged_quota=%d;contract_id=%d;renewal_key=%s", attempt.RequiredQuota, attempt.ContractID, attempt.RenewalKey)
		if order.UserId != attempt.UserID || order.PlanId != attempt.PlanID || order.TradeNo != attempt.TradeNo ||
			order.PaymentMethod != model.PaymentMethodBalance || order.PaymentProvider != model.PaymentProviderBalance ||
			order.Status != common.TopUpStatusSuccess || order.PurchaseMonths != 1 || order.Money != attempt.PriceAmount ||
			order.UnitPrice != attempt.PriceAmount || order.PaymentCurrency != attempt.PaymentCurrency ||
			order.RenewalSource != model.SubscriptionRenewalSourceWallet || order.ProviderPayload != expectedPayload ||
			order.PlanSnapshot != attempt.PlanSnapshot {
			return walletRenewalDuplicateFactsError("success order %q is inconsistent", attempt.TradeNo)
		}

		var entitlement model.UserSubscription
		if err := tx.Where("grant_key = ?", attempt.RenewalKey).First(&entitlement).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return walletRenewalDuplicateFactsError("entitlement grant %q is missing", attempt.RenewalKey)
			}
			return fmt.Errorf("read wallet renewal duplicate entitlement: %w", err)
		}
		if !walletRenewalEntitlementMatchesGrantInput(&entitlement, attempt.GrantInput) ||
			(entitlement.Status != model.SubscriptionEntitlementStatusActive && entitlement.Status != model.SubscriptionEntitlementStatusHistorical) {
			return walletRenewalDuplicateFactsError("entitlement grant %q is inconsistent", attempt.RenewalKey)
		}

		var ledger model.WalletLedgerEntry
		ledgerQuery := tx.Where("entry_key = ?", attempt.RenewalKey).Limit(1).Find(&ledger)
		if ledgerQuery.Error != nil {
			return fmt.Errorf("read wallet renewal duplicate ledger: %w", ledgerQuery.Error)
		}
		if attempt.RequiredQuota == 0 {
			if ledgerQuery.RowsAffected != 0 {
				return walletRenewalDuplicateFactsError("zero-cost renewal ledger %q is inconsistent", attempt.RenewalKey)
			}
		} else if ledgerQuery.RowsAffected != 1 {
			return walletRenewalDuplicateFactsError("debit ledger %q is missing", attempt.RenewalKey)
		} else if ledger.UserId != attempt.UserID || ledger.EntryKey != attempt.RenewalKey ||
			ledger.QuotaDelta != -int64(attempt.RequiredQuota) || ledger.MoneyAmount != attempt.PriceAmount ||
			ledger.EntryType != model.WalletLedgerEntryTypePrepaidDebit || ledger.OrderId != order.Id {
			return walletRenewalDuplicateFactsError("debit ledger %q is inconsistent", attempt.RenewalKey)
		}

		var contract model.UserSubscriptionContract
		if err := tx.Where("id = ? AND user_id = ?", attempt.ContractID, attempt.UserID).First(&contract).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return walletRenewalDuplicateFactsError("contract %d is missing", attempt.ContractID)
			}
			return fmt.Errorf("read wallet renewal duplicate contract: %w", err)
		}
		if contract.CurrentPeriodEnd < attempt.PeriodEnd {
			return walletRenewalDuplicateFactsError("contract %d was not advanced through %d", attempt.ContractID, attempt.PeriodEnd)
		}
		if !walletRenewalEntitlementLifecycleMatchesContractPeriod(&entitlement, &contract, attempt) {
			return walletRenewalDuplicateFactsError("entitlement grant %q is inconsistent", attempt.RenewalKey)
		}

		var currentEntitlement model.UserSubscription
		if err := tx.Where("id = ? AND user_id = ? AND contract_id = ?", contract.CurrentEntitlementId, attempt.UserID, attempt.ContractID).
			First(&currentEntitlement).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return walletRenewalDuplicateFactsError("current entitlement %d is missing", contract.CurrentEntitlementId)
			}
			return fmt.Errorf("read wallet renewal duplicate current entitlement: %w", err)
		}
		if !walletRenewalContractMatchesRecoveredGrant(&contract, &entitlement, &currentEntitlement, attempt) {
			return walletRenewalDuplicateFactsError("contract %d is inconsistent", attempt.ContractID)
		}

		recovered.OrderID = order.Id
		recovered.EntitlementID = entitlement.Id
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, err
	}
	return recovered, nil
}

func walletRenewalAttemptGrantInputMatches(attempt walletRenewalAttempt) bool {
	input := attempt.GrantInput
	return input.ContractId == attempt.ContractID &&
		input.UserId == attempt.UserID &&
		input.PlanId == attempt.PlanID &&
		input.ProviderBindingId == 0 &&
		strings.TrimSpace(input.GrantKey) == attempt.RenewalKey &&
		input.PaymentMode == model.SubscriptionPaymentModePrepaid &&
		input.PeriodStart == attempt.PeriodStart &&
		input.PeriodEnd == attempt.PeriodEnd &&
		input.EndReasonForPrevious == model.SubscriptionEntitlementEndReasonRenewed &&
		input.Source == model.PaymentMethodBalance &&
		input.AmountTotal >= 0 &&
		input.MediaCreditsTotal >= 0 &&
		input.Window5hAmount != nil &&
		*input.Window5hAmount >= 0 &&
		input.WindowWeekAmount != nil &&
		*input.WindowWeekAmount >= 0 &&
		input.UpgradeGroup != nil
}

func walletRenewalEntitlementMatchesGrantInput(entitlement *model.UserSubscription, input model.GrantEntitlementInput) bool {
	return entitlement != nil &&
		entitlement.GrantKey != nil &&
		strings.TrimSpace(*entitlement.GrantKey) == strings.TrimSpace(input.GrantKey) &&
		entitlement.ContractId == input.ContractId &&
		entitlement.UserId == input.UserId &&
		entitlement.PlanId == input.PlanId &&
		entitlement.ProviderBindingId == input.ProviderBindingId &&
		entitlement.AmountTotal == input.AmountTotal &&
		entitlement.MediaCreditsTotal == input.MediaCreditsTotal &&
		walletRenewalWindowAmountMatches(entitlement.Window5hAmount, input.Window5hAmount) &&
		walletRenewalWindowAmountMatches(entitlement.WindowWeekAmount, input.WindowWeekAmount) &&
		strings.TrimSpace(entitlement.UpgradeGroup) == strings.TrimSpace(*input.UpgradeGroup) &&
		entitlement.StartTime == input.PeriodStart &&
		entitlement.EndTime == input.PeriodEnd &&
		entitlement.AccessEndTime == input.PeriodEnd &&
		entitlement.PaymentMode == input.PaymentMode &&
		strings.TrimSpace(entitlement.Source) == input.Source
}

func walletRenewalWindowAmountMatches(existing *int64, expected *int64) bool {
	return existing != nil && expected != nil && *existing == *expected
}

func walletRenewalEntitlementLifecycleMatchesContractPeriod(entitlement *model.UserSubscription, contract *model.UserSubscriptionContract, attempt walletRenewalAttempt) bool {
	if entitlement == nil || contract == nil {
		return false
	}
	if contract.CurrentPeriodEnd == attempt.PeriodEnd {
		return entitlement.Status == model.SubscriptionEntitlementStatusActive &&
			entitlement.CurrentSlot != nil && *entitlement.CurrentSlot == 1
	}
	return contract.CurrentPeriodEnd > attempt.PeriodEnd &&
		entitlement.Status == model.SubscriptionEntitlementStatusHistorical &&
		entitlement.CurrentSlot == nil
}

func walletRenewalContractMatchesRecoveredGrant(contract *model.UserSubscriptionContract, entitlement *model.UserSubscription, currentEntitlement *model.UserSubscription, attempt walletRenewalAttempt) bool {
	if contract == nil || entitlement == nil ||
		contract.Id != attempt.ContractID ||
		contract.UserId != attempt.UserID ||
		contract.Status != model.SubscriptionContractStatusActive ||
		!walletRenewalCurrentEntitlementMatchesContract(currentEntitlement, contract) {
		return false
	}
	if contract.CurrentPeriodEnd == attempt.PeriodEnd {
		return contract.RenewalSource == model.SubscriptionRenewalSourceWallet &&
			contract.RenewalStatus == model.SubscriptionRenewalStatusEnabled &&
			contract.CurrentPlanId == attempt.PlanID &&
			contract.CurrentEntitlementId == entitlement.Id &&
			contract.CurrentProviderBindingId == attempt.GrantInput.ProviderBindingId &&
			contract.CurrentPeriodStart == attempt.PeriodStart &&
			contract.PaymentMode == attempt.GrantInput.PaymentMode
	}
	return contract.CurrentPeriodEnd > attempt.PeriodEnd &&
		contract.CurrentPeriodStart >= attempt.PeriodEnd &&
		contract.CurrentPeriodStart < contract.CurrentPeriodEnd &&
		contract.CurrentEntitlementId != entitlement.Id
}

func walletRenewalCurrentEntitlementMatchesContract(entitlement *model.UserSubscription, contract *model.UserSubscriptionContract) bool {
	return entitlement != nil &&
		contract != nil &&
		entitlement.Id == contract.CurrentEntitlementId &&
		entitlement.ContractId == contract.Id &&
		entitlement.UserId == contract.UserId &&
		entitlement.Status == model.SubscriptionEntitlementStatusActive &&
		entitlement.CurrentSlot != nil &&
		*entitlement.CurrentSlot == 1 &&
		entitlement.PlanId == contract.CurrentPlanId &&
		entitlement.ProviderBindingId == contract.CurrentProviderBindingId &&
		entitlement.StartTime == contract.CurrentPeriodStart &&
		entitlement.EndTime == contract.CurrentPeriodEnd &&
		entitlement.PaymentMode == contract.PaymentMode
}

func walletRenewalDuplicateFactsError(format string, args ...interface{}) error {
	return fmt.Errorf("wallet renewal duplicate facts are incomplete or inconsistent: "+format, args...)
}

func walletContractIsRenewable(contract model.UserSubscriptionContract) bool {
	return contract.Status == model.SubscriptionContractStatusActive &&
		contract.RenewalSource == model.SubscriptionRenewalSourceWallet &&
		contract.RenewalStatus == model.SubscriptionRenewalStatusEnabled &&
		contract.CurrentPlanId > 0 &&
		contract.CurrentPeriodEnd > 0 &&
		contract.CurrentPeriodEnd <= common.GetTimestamp()
}

func pauseWalletRenewalTx(tx *gorm.DB, contract *model.UserSubscriptionContract, status string, result *WalletSubscriptionRenewalResult) error {
	if tx == nil || contract == nil {
		return errors.New("subscription renewal facts are incomplete")
	}
	now := common.GetTimestamp()
	if contract.CurrentEntitlementId > 0 {
		if err := tx.Model(&model.UserSubscription{}).
			Where("id = ? AND contract_id = ? AND status = ?", contract.CurrentEntitlementId, contract.Id, model.SubscriptionEntitlementStatusActive).
			Updates(map[string]interface{}{
				"status":     model.SubscriptionEntitlementStatusHistorical,
				"end_reason": model.SubscriptionEntitlementEndReasonExpired,
				"updated_at": now,
			}).Error; err != nil {
			return err
		}
	}
	if err := tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":         model.SubscriptionContractStatusEnded,
		"renewal_status": status,
		"updated_at":     now,
	}).Error; err != nil {
		return err
	}
	if result != nil {
		result.PausedStatus = status
	}
	return nil
}

func handleExistingWalletRenewalTx(tx *gorm.DB, contract *model.UserSubscriptionContract, renewalKey string, result *WalletSubscriptionRenewalResult, originalErr error) error {
	if common.UsingPostgreSQL && isWalletRenewalDuplicateError(originalErr) {
		return originalErr
	}
	var entitlement model.UserSubscription
	query := tx.Where("grant_key = ?", renewalKey).Limit(1).Find(&entitlement)
	if query.Error != nil {
		return query.Error
	}
	if query.RowsAffected == 0 {
		return originalErr
	}
	if result != nil {
		result.EntitlementID = entitlement.Id
	}
	if contract == nil || contract.CurrentPeriodEnd >= entitlement.EndTime {
		return nil
	}
	return tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"current_entitlement_id": entitlement.Id,
		"current_period_start":   entitlement.StartTime,
		"current_period_end":     entitlement.EndTime,
		"updated_at":             common.GetTimestamp(),
	}).Error
}

func walletRenewalKey(contractID int64, periodStart int64, planID int) string {
	return fmt.Sprintf("subscription:renewal:debit:contract:%d:period:%d:plan:%d", contractID, periodStart, planID)
}

func walletRenewalTradeNo(contractID int64, periodStart int64, planID int) string {
	return fmt.Sprintf("SUBRENEWCON%dPER%dPLAN%d", contractID, periodStart, planID)
}

func isWalletRenewalDuplicateError(err error) bool {
	if err == nil {
		return false
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	var mysqlErr *mysqlDriver.MySQLError
	if errors.As(err, &mysqlErr) {
		return mysqlErr.Number == 1062
	}
	var sqliteErr interface{ Code() int }
	if errors.As(err, &sqliteErr) {
		return sqliteErr.Code()&0xff == 19
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "constraint failed: unique")
}
