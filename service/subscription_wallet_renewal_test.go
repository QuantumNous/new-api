package service

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type walletRenewalTxOptionsRecorder struct {
	*sql.DB
	options *sql.TxOptions
}

func (recorder *walletRenewalTxOptionsRecorder) BeginTx(ctx context.Context, options *sql.TxOptions) (*sql.Tx, error) {
	if options != nil {
		copied := *options
		recorder.options = &copied
	}
	return recorder.DB.BeginTx(ctx, options)
}

func seedWalletRenewalContract(t *testing.T, userID int, quota int, plan model.SubscriptionPlan, periodEnd int64) (model.UserSubscriptionContract, model.UserSubscription) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:       userID,
		Username: fmt.Sprintf("wallet_renewal_user_%s_%d", t.Name(), userID),
		Status:   common.UserStatusEnabled,
		Quota:    quota,
		Group:    "plg",
		AffCode:  fmt.Sprintf("wallet_renewal_aff_%s_%d", t.Name(), userID),
	}).Error)
	contract := model.UserSubscriptionContract{
		UserId:               userID,
		Status:               model.SubscriptionContractStatusActive,
		PaymentMode:          model.SubscriptionPaymentModePrepaid,
		RenewalSource:        model.SubscriptionRenewalSourceWallet,
		RenewalStatus:        model.SubscriptionRenewalStatusEnabled,
		CurrentPlanId:        plan.Id,
		CurrentPeriodStart:   periodEnd - 30*24*3600,
		CurrentPeriodEnd:     periodEnd,
		CurrentEntitlementId: 0,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	entitlement := model.UserSubscription{
		UserId:        userID,
		PlanId:        plan.Id,
		ContractId:    contract.Id,
		AmountTotal:   plan.TotalAmount,
		StartTime:     contract.CurrentPeriodStart,
		EndTime:       periodEnd,
		AccessEndTime: periodEnd,
		Status:        model.SubscriptionEntitlementStatusActive,
		PaymentMode:   model.SubscriptionPaymentModePrepaid,
		Source:        model.PaymentMethodBalance,
	}
	currentSlot := 1
	entitlement.CurrentSlot = &currentSlot
	require.NoError(t, model.DB.Create(&entitlement).Error)
	require.NoError(t, model.DB.Model(&contract).Updates(map[string]interface{}{"current_entitlement_id": entitlement.Id}).Error)
	contract.CurrentEntitlementId = entitlement.Id
	return contract, entitlement
}

func TestRenewWalletSubscriptionContractChargesCurrentOneMonthPlanAndExtendsOnce(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7801, 1, 7, 700)
	periodEnd := common.GetTimestamp() - 15
	contract, oldEntitlement := seedWalletRenewalContract(t, 7901, 1000, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Update("price_amount", 9).Error)

	result, err := RenewWalletSubscriptionContract(contract.Id)

	require.NoError(t, err)
	require.True(t, result.Renewed)
	require.Equal(t, int64(900), result.ChargedQuota)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7901).Error)
	require.Equal(t, 100, user.Quota)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, stored.RenewalStatus)
	require.Equal(t, periodEnd, stored.CurrentPeriodStart)
	require.Equal(t, time.Unix(periodEnd, 0).AddDate(0, 1, 0).Unix(), stored.CurrentPeriodEnd)
	require.NotEqual(t, oldEntitlement.Id, stored.CurrentEntitlementId)
	var ledgerCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("user_id = ? AND entry_type = ?", 7901, model.WalletLedgerEntryTypePrepaidDebit).Count(&ledgerCount).Error)
	require.Equal(t, int64(1), ledgerCount)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "id = ?", result.OrderID).Error)
	require.NotEmpty(t, order.PlanSnapshot)
	require.Contains(t, order.PlanSnapshot, `"plan_id":7801`)
	require.Contains(t, order.PlanSnapshot, `"price_amount":9`)

	replay, err := RenewWalletSubscriptionContract(contract.Id)
	require.NoError(t, err)
	require.False(t, replay.Renewed)
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("user_id = ? AND entry_type = ?", 7901, model.WalletLedgerEntryTypePrepaidDebit).Count(&ledgerCount).Error)
	require.Equal(t, int64(1), ledgerCount)
}

func TestRenewWalletSubscriptionContractPausesWithoutExtendingOnInsufficientBalance(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7802, 1, 7, 700)
	periodEnd := common.GetTimestamp() - 15
	contract, entitlement := seedWalletRenewalContract(t, 7902, 699, plan, periodEnd)

	result, err := RenewWalletSubscriptionContract(contract.Id)

	require.NoError(t, err)
	require.False(t, result.Renewed)
	require.Equal(t, model.SubscriptionRenewalStatusPausedInsufficientBalance, result.PausedStatus)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusPausedInsufficientBalance, stored.RenewalStatus)
	require.Equal(t, model.SubscriptionContractStatusEnded, stored.Status)
	require.Equal(t, periodEnd, stored.CurrentPeriodEnd)
	require.Equal(t, entitlement.Id, stored.CurrentEntitlementId)
	var storedEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&storedEntitlement, "id = ?", entitlement.Id).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, storedEntitlement.Status)
}

func TestRenewWalletSubscriptionContractDoesNotPersistSuccessFactsWhenConditionalDebitLoses(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7807, 1, 7, 700)
	periodEnd := common.GetTimestamp() - 15
	contract, entitlement := seedWalletRenewalContract(t, 7908, 700, plan, periodEnd)
	renewalKey := walletRenewalKey(contract.Id, periodEnd, plan.Id)
	tradeNo := walletRenewalTradeNo(contract.Id, periodEnd, plan.Id)

	callbackName := "test:wallet_renewal_conditional_debit_loses"
	fired := false
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if fired || tx.Statement == nil || tx.Statement.Table != "users" {
			return
		}
		fired = true
		require.NoError(t, tx.Session(&gorm.Session{NewDB: true}).
			Model(&model.User{}).
			Where("id = ?", contract.UserId).
			Update("quota", 0).Error)
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})

	result, err := RenewWalletSubscriptionContract(contract.Id)

	require.NoError(t, err)
	require.True(t, fired)
	require.False(t, result.Renewed)
	require.Equal(t, model.SubscriptionRenewalStatusPausedInsufficientBalance, result.PausedStatus)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("trade_no = ?", tradeNo).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var ledgerCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("entry_key = ?", renewalKey).Count(&ledgerCount).Error)
	require.Zero(t, ledgerCount)
	var renewalEntitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("grant_key = ?", renewalKey).Count(&renewalEntitlementCount).Error)
	require.Zero(t, renewalEntitlementCount)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusEnded, storedContract.Status)
	var storedEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&storedEntitlement, "id = ?", entitlement.Id).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, storedEntitlement.Status)
}

func TestRenewWalletSubscriptionContractPausesWithoutExtendingWhenPlanUnavailable(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7805, 1, 7, 700)
	periodEnd := common.GetTimestamp() - 15
	contract, entitlement := seedWalletRenewalContract(t, 7905, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Update("enabled", false).Error)

	result, err := RenewWalletSubscriptionContract(contract.Id)

	require.NoError(t, err)
	require.False(t, result.Renewed)
	require.Equal(t, model.SubscriptionRenewalStatusPausedPlanUnavailable, result.PausedStatus)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusPausedPlanUnavailable, stored.RenewalStatus)
	require.Equal(t, model.SubscriptionContractStatusEnded, stored.Status)
	require.Equal(t, periodEnd, stored.CurrentPeriodEnd)
	require.Equal(t, entitlement.Id, stored.CurrentEntitlementId)
}

func TestRunWalletSubscriptionRenewalOnceSkipsFuturePeriodsAndCatchesUpExpiredPeriods(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7803, 1, 3, 300)
	now := common.GetTimestamp()
	futureEnd := now + 30
	futureContract, _ := seedWalletRenewalContract(t, 7903, 300, plan, futureEnd)
	expiredEnd := now - 90
	expiredContract, _ := seedWalletRenewalContract(t, 7906, 300, plan, expiredEnd)

	renewed, err := RunWalletSubscriptionRenewalOnce(10)

	require.NoError(t, err)
	require.Equal(t, 1, renewed)
	var futureStored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&futureStored, "id = ?", futureContract.Id).Error)
	require.Equal(t, futureEnd, futureStored.CurrentPeriodEnd)
	var expiredStored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&expiredStored, "id = ?", expiredContract.Id).Error)
	require.Greater(t, expiredStored.CurrentPeriodEnd, expiredEnd)
}

func TestRenewWalletSubscriptionContractInvalidatesUserCacheAfterDebit(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	mr := setupWalletRenewalRedis(t)
	plan := insertPurchaseServicePlan(t, 7806, 1, 3, 300)
	periodEnd := common.GetTimestamp() - 15
	contract, _ := seedWalletRenewalContract(t, 7907, 300, plan, periodEnd)
	cacheUserQuota(t, 7907, 300)
	require.True(t, mr.Exists(fmt.Sprintf("user:v2:%d", 7907)))

	_, err := RenewWalletSubscriptionContract(contract.Id)

	require.NoError(t, err)
	require.False(t, mr.Exists(fmt.Sprintf("user:v2:%d", 7907)))
}

func TestHandleExistingWalletRenewalDoesNotQueryAbortedPostgresTransaction(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalUsingSQLite := common.UsingSQLite
	common.UsingPostgreSQL = true
	common.UsingSQLite = false
	t.Cleanup(func() {
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.UsingSQLite = originalUsingSQLite
	})
	originalErr := &pgconn.PgError{Code: "23505", Message: "duplicate key value violates unique constraint"}

	err := handleExistingWalletRenewalTx(model.DB, &model.UserSubscriptionContract{Id: 1}, "missing-key", nil, originalErr)

	require.ErrorIs(t, err, originalErr)
}

func TestRunWalletSubscriptionRenewalOnceRecoversCompletedPostgresDuplicateAndContinues(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7808, 1, 7, 700)
	originalPeriodEnd := common.GetTimestamp() - 15
	staleContract, _ := seedWalletRenewalContract(t, 7909, 1400, plan, originalPeriodEnd)

	winner, err := RenewWalletSubscriptionContract(staleContract.Id)
	require.NoError(t, err)
	require.True(t, winner.Renewed)
	var committedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&committedContract, "id = ?", staleContract.Id).Error)
	require.Greater(t, committedContract.CurrentPeriodEnd, originalPeriodEnd)

	followerContract, _ := seedWalletRenewalContract(t, 7910, 700, plan, originalPeriodEnd)
	common.UsingPostgreSQL = true

	callbackName := "test:wallet_renewal_postgres_stale_snapshot"
	batchInjected := false
	contractInjected := false
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "user_subscription_contracts" {
			return
		}
		switch destination := tx.Statement.Dest.(type) {
		case *[]model.UserSubscriptionContract:
			if !batchInjected {
				*destination = append([]model.UserSubscriptionContract{staleContract}, (*destination)...)
				batchInjected = true
			}
		case *model.UserSubscriptionContract:
			if batchInjected && !contractInjected && destination.Id == staleContract.Id {
				*destination = staleContract
				contractInjected = true
			}
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
	})

	renewed, err := RunWalletSubscriptionRenewalOnce(10)

	require.NoError(t, err)
	require.True(t, batchInjected)
	require.True(t, contractInjected)
	require.Equal(t, 1, renewed)
	var winnerUser model.User
	require.NoError(t, model.DB.First(&winnerUser, "id = ?", staleContract.UserId).Error)
	require.Equal(t, 700, winnerUser.Quota)
	var winnerOrderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("trade_no = ?", walletRenewalTradeNo(staleContract.Id, originalPeriodEnd, plan.Id)).Count(&winnerOrderCount).Error)
	require.Equal(t, int64(1), winnerOrderCount)
	var winnerLedgerCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("entry_key = ?", walletRenewalKey(staleContract.Id, originalPeriodEnd, plan.Id)).Count(&winnerLedgerCount).Error)
	require.Equal(t, int64(1), winnerLedgerCount)
	var followerStored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&followerStored, "id = ?", followerContract.Id).Error)
	require.Greater(t, followerStored.CurrentPeriodEnd, originalPeriodEnd)
}

func TestRenewWalletSubscriptionContractReportsIncompletePostgresDuplicateFacts(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7809, 1, 7, 700)
	periodEnd := common.GetTimestamp() - 15
	contract, _ := seedWalletRenewalContract(t, 7911, 700, plan, periodEnd)
	renewalKey := walletRenewalKey(contract.Id, periodEnd, plan.Id)
	tradeNo := walletRenewalTradeNo(contract.Id, periodEnd, plan.Id)
	planSnapshot, err := subscriptionPurchasePlanSnapshot(&plan)
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:          contract.UserId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodBalance,
		PaymentProvider: model.PaymentProviderBalance,
		Status:          common.TopUpStatusSuccess,
		PurchaseMonths:  1,
		UnitPrice:       plan.PriceAmount,
		PaymentCurrency: plan.Currency,
		PlanSnapshot:    planSnapshot,
		ProviderPayload: fmt.Sprintf("charged_quota=700;contract_id=%d;renewal_key=%s", contract.Id, renewalKey),
		RenewalSource:   model.SubscriptionRenewalSourceWallet,
	}).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId:            contract.UserId,
		PlanId:            plan.Id,
		ContractId:        contract.Id,
		ProviderBindingId: 0,
		GrantKey:          &renewalKey,
		AmountTotal:       plan.TotalAmount,
		MediaCreditsTotal: plan.MediaCreditsMonthly,
		Window5hAmount:    common.GetPointer(plan.Window5hAmount),
		WindowWeekAmount:  common.GetPointer(plan.WindowWeekAmount),
		StartTime:         periodEnd,
		EndTime:           time.Unix(periodEnd, 0).AddDate(0, 1, 0).Unix(),
		AccessEndTime:     time.Unix(periodEnd, 0).AddDate(0, 1, 0).Unix(),
		Status:            model.SubscriptionEntitlementStatusHistorical,
		PaymentMode:       model.SubscriptionPaymentModePrepaid,
		Source:            model.PaymentMethodBalance,
		UpgradeGroup:      plan.UpgradeGroup,
	}).Error)
	common.UsingPostgreSQL = true

	_, err = RenewWalletSubscriptionContract(contract.Id)

	require.ErrorContains(t, err, "wallet renewal duplicate facts are incomplete")
	require.ErrorContains(t, err, "debit ledger")
}

func TestRecoverPostgresWalletRenewalDuplicateRejectsGrantMismatchDespiteCorrectLedger(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7810, 1, 7, 700)
	plan.MediaCreditsMonthly = 35
	plan.Window5hAmount = 75
	plan.WindowWeekAmount = 650
	plan.UpgradeGroup = "renewal_group"
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"media_credits_monthly": plan.MediaCreditsMonthly,
		"window_5h_amount":      plan.Window5hAmount,
		"window_week_amount":    plan.WindowWeekAmount,
		"upgrade_group":         plan.UpgradeGroup,
	}).Error)
	periodEnd := common.GetTimestamp() - 15
	contract, _ := seedWalletRenewalContract(t, 7912, 700, plan, periodEnd)
	attempt := seedCompletedWalletRenewalDuplicateFacts(t, contract, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).
		Where("grant_key = ?", attempt.RenewalKey).
		Update("amount_total", plan.TotalAmount+1).Error)

	_, err := recoverPostgresWalletRenewalDuplicate(attempt)

	require.ErrorContains(t, err, "wallet renewal duplicate facts are incomplete")
	require.ErrorContains(t, err, "entitlement grant")
}

func TestRecoverPostgresWalletRenewalDuplicateRejectsContractThatOnlyAdvancesPeriodEnd(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7811, 1, 7, 700)
	periodEnd := common.GetTimestamp() - 15
	contract, oldEntitlement := seedWalletRenewalContract(t, 7913, 700, plan, periodEnd)
	attempt := seedCompletedWalletRenewalDuplicateFacts(t, contract, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).
		Where("grant_key = ?", attempt.RenewalKey).
		Updates(map[string]interface{}{
			"current_slot": nil,
			"status":       model.SubscriptionEntitlementStatusHistorical,
			"end_reason":   model.SubscriptionEntitlementEndReasonRenewed,
		}).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"current_period_start":   contract.CurrentPeriodStart,
		"current_period_end":     time.Unix(attempt.PeriodEnd, 0).AddDate(0, 1, 0).Unix(),
		"current_entitlement_id": oldEntitlement.Id,
	}).Error)

	_, err := recoverPostgresWalletRenewalDuplicate(attempt)

	require.ErrorContains(t, err, "wallet renewal duplicate facts are incomplete")
	require.ErrorContains(t, err, "contract")
}

func TestRecoverPostgresWalletRenewalDuplicateRejectsSamePeriodHistoricalGrantWithoutCurrentSlot(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7812, 1, 7, 700)
	periodStart := common.GetTimestamp() - 15
	contract, _ := seedWalletRenewalContract(t, 7914, 700, plan, periodStart)
	attempt := seedCompletedWalletRenewalDuplicateFacts(t, contract, plan, periodStart)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).
		Where("grant_key = ?", attempt.RenewalKey).
		Updates(map[string]interface{}{
			"current_slot": nil,
			"status":       model.SubscriptionEntitlementStatusHistorical,
			"end_reason":   model.SubscriptionEntitlementEndReasonRenewed,
		}).Error)

	_, err := recoverPostgresWalletRenewalDuplicate(attempt)

	require.ErrorContains(t, err, "wallet renewal duplicate facts are incomplete")
	require.ErrorContains(t, err, "entitlement grant")
}

func TestRecoverPostgresWalletRenewalDuplicateAcceptsHistoricalGrantAfterContractAdvances(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7813, 1, 7, 700)
	periodStart := common.GetTimestamp() - 15
	contract, _ := seedWalletRenewalContract(t, 7915, 700, plan, periodStart)
	attempt := seedCompletedWalletRenewalDuplicateFacts(t, contract, plan, periodStart)
	nextGrantInput := attempt.GrantInput
	nextGrantInput.GrantKey = walletRenewalKey(contract.Id, attempt.PeriodEnd, plan.Id)
	nextGrantInput.PeriodStart = attempt.PeriodEnd
	nextGrantInput.PeriodEnd = time.Unix(nextGrantInput.PeriodStart, 0).AddDate(0, 1, 0).Unix()
	var nextGrant *model.GrantEntitlementResult
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		var err error
		nextGrant, err = model.RotateCurrentEntitlementTx(tx, nextGrantInput)
		return err
	}))
	var attemptedEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&attemptedEntitlement, "grant_key = ?", attempt.RenewalKey).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, attemptedEntitlement.Status)
	require.Nil(t, attemptedEntitlement.CurrentSlot)

	result, err := recoverPostgresWalletRenewalDuplicate(attempt)

	require.NoError(t, err)
	require.Equal(t, attemptedEntitlement.Id, result.EntitlementID)
	require.NotNil(t, nextGrant)
	require.NotEqual(t, attemptedEntitlement.Id, nextGrant.Entitlement.Id)
}

func TestRecoverPostgresWalletRenewalDuplicateUsesReadOnlyRepeatableReadTransaction(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7814, 1, 7, 700)
	periodStart := common.GetTimestamp() - 15
	contract, _ := seedWalletRenewalContract(t, 7916, 700, plan, periodStart)
	attempt := seedCompletedWalletRenewalDuplicateFacts(t, contract, plan, periodStart)
	sqlDB, err := model.DB.DB()
	require.NoError(t, err)
	recorder := &walletRenewalTxOptionsRecorder{DB: sqlDB}
	originalConnPool := model.DB.Statement.ConnPool
	model.DB.Statement.ConnPool = recorder
	t.Cleanup(func() {
		model.DB.Statement.ConnPool = originalConnPool
	})

	_, err = recoverPostgresWalletRenewalDuplicate(attempt)

	require.NoError(t, err)
	require.NotNil(t, recorder.options)
	require.True(t, recorder.options.ReadOnly)
	require.Equal(t, sql.LevelRepeatableRead, recorder.options.Isolation)
}

func TestRecoverPostgresWalletRenewalDuplicateRejectsContractBehindAttemptPeriodWithCompleteWinnerFacts(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7815, 1, 7, 700)
	periodStart := common.GetTimestamp() - 15
	contract, _ := seedWalletRenewalContract(t, 7917, 700, plan, periodStart)
	attempt := seedCompletedWalletRenewalDuplicateFacts(t, contract, plan, periodStart)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("current_period_end", attempt.PeriodEnd-1).Error)

	_, err := recoverPostgresWalletRenewalDuplicate(attempt)

	require.ErrorContains(t, err, "wallet renewal duplicate facts are incomplete")
	require.ErrorContains(t, err, "was not advanced through")
}

func TestRunSubscriptionTermSegmentAdvanceOnceCompletesExpiredActiveAndActivatesDueTerms(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7904, 0)
	plan := insertPurchaseServicePlan(t, 7804, 1, 3, 300)
	contract := model.UserSubscriptionContract{UserId: 7904, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: plan.Id}
	require.NoError(t, model.DB.Create(&contract).Error)
	order := model.SubscriptionOrder{UserId: 7904, PlanId: plan.Id, TradeNo: "advance-term-state", PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&order).Error)
	now := common.GetTimestamp()
	expiredActive := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: order.Id, PlanId: plan.Id, SegmentIndex: 0, StartTime: now - 7200, EndTime: now - 3600, AllocatedMoney: plan.PriceAmount, Status: model.SubscriptionTermStatusActive}
	dueNotStarted := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: order.Id, PlanId: plan.Id, SegmentIndex: 1, StartTime: now - 3600, EndTime: now + 3600, AllocatedMoney: plan.PriceAmount, Status: model.SubscriptionTermStatusNotStarted}
	futureNotStarted := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: order.Id, PlanId: plan.Id, SegmentIndex: 2, StartTime: now + 3600, EndTime: now + 7200, AllocatedMoney: plan.PriceAmount, Status: model.SubscriptionTermStatusNotStarted}
	require.NoError(t, model.DB.Create(&expiredActive).Error)
	require.NoError(t, model.DB.Create(&dueNotStarted).Error)
	require.NoError(t, model.DB.Create(&futureNotStarted).Error)

	advanced, err := RunSubscriptionTermSegmentAdvanceOnce(10)

	require.NoError(t, err)
	require.Equal(t, 2, advanced)
	var terms []model.SubscriptionTermSegment
	require.NoError(t, model.DB.Where("order_id = ?", order.Id).Order("segment_index asc").Find(&terms).Error)
	require.Equal(t, subscriptionTermStatusCompleted, terms[0].Status)
	require.Equal(t, model.SubscriptionTermStatusActive, terms[1].Status)
	require.Equal(t, model.SubscriptionTermStatusNotStarted, terms[2].Status)
}

func seedCompletedWalletRenewalDuplicateFacts(t *testing.T, contract model.UserSubscriptionContract, plan model.SubscriptionPlan, periodStart int64) walletRenewalAttempt {
	t.Helper()
	renewalKey := walletRenewalKey(contract.Id, periodStart, plan.Id)
	tradeNo := walletRenewalTradeNo(contract.Id, periodStart, plan.Id)
	periodEnd := time.Unix(periodStart, 0).AddDate(0, 1, 0).Unix()
	planSnapshot, err := subscriptionPurchasePlanSnapshot(&plan)
	require.NoError(t, err)
	attempt := walletRenewalAttempt{
		ContractID:      contract.Id,
		UserID:          contract.UserId,
		PlanID:          plan.Id,
		PeriodStart:     periodStart,
		PeriodEnd:       periodEnd,
		RenewalKey:      renewalKey,
		TradeNo:         tradeNo,
		RequiredQuota:   700,
		PriceAmount:     plan.PriceAmount,
		PaymentCurrency: plan.Currency,
		PlanSnapshot:    planSnapshot,
		GrantInput: model.GrantEntitlementInput{
			ContractId:           contract.Id,
			UserId:               contract.UserId,
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
		},
	}
	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:          contract.UserId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodBalance,
		PaymentProvider: model.PaymentProviderBalance,
		Status:          common.TopUpStatusSuccess,
		PurchaseMonths:  1,
		UnitPrice:       plan.PriceAmount,
		PaymentCurrency: plan.Currency,
		PlanSnapshot:    planSnapshot,
		ProviderPayload: fmt.Sprintf("charged_quota=700;contract_id=%d;renewal_key=%s", contract.Id, renewalKey),
		RenewalSource:   model.SubscriptionRenewalSourceWallet,
	}).Error)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "trade_no = ?", tradeNo).Error)
	require.NoError(t, model.DB.Create(&model.WalletLedgerEntry{
		UserId:      contract.UserId,
		EntryKey:    renewalKey,
		QuotaDelta:  -700,
		MoneyAmount: plan.PriceAmount,
		EntryType:   model.WalletLedgerEntryTypePrepaidDebit,
		OrderId:     order.Id,
	}).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).
		Where("contract_id = ? AND current_slot = ?", contract.Id, 1).
		Updates(map[string]interface{}{
			"current_slot": nil,
			"status":       model.SubscriptionEntitlementStatusHistorical,
			"end_reason":   model.SubscriptionEntitlementEndReasonRenewed,
		}).Error)
	currentSlot := 1
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId:            contract.UserId,
		PlanId:            plan.Id,
		ContractId:        contract.Id,
		ProviderBindingId: 0,
		GrantKey:          &renewalKey,
		CurrentSlot:       &currentSlot,
		AmountTotal:       plan.TotalAmount,
		MediaCreditsTotal: plan.MediaCreditsMonthly,
		Window5hAmount:    common.GetPointer(plan.Window5hAmount),
		WindowWeekAmount:  common.GetPointer(plan.WindowWeekAmount),
		StartTime:         periodStart,
		EndTime:           periodEnd,
		AccessEndTime:     periodEnd,
		Status:            model.SubscriptionEntitlementStatusActive,
		Source:            model.PaymentMethodBalance,
		PaymentMode:       model.SubscriptionPaymentModePrepaid,
		UpgradeGroup:      plan.UpgradeGroup,
	}).Error)
	var entitlement model.UserSubscription
	require.NoError(t, model.DB.First(&entitlement, "grant_key = ?", renewalKey).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"current_period_start":   periodStart,
		"current_period_end":     periodEnd,
		"current_entitlement_id": entitlement.Id,
		"current_plan_id":        plan.Id,
		"payment_mode":           model.SubscriptionPaymentModePrepaid,
	}).Error)
	return attempt
}
