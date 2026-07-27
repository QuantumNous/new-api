package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCancelCurrentSubscriptionRenewalMarksWalletAutoCancelledAndIsIdempotent(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7821, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, _ := seedWalletRenewalContract(t, 7921, 700, plan, periodEnd)

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.Equal(t, model.SubscriptionRenewalSourceWallet, result.RenewalSource)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.Equal(t, periodEnd, result.CurrentPeriodEnd)
	require.False(t, result.CanCancel)
	require.True(t, result.CanResume)
	require.True(t, result.CancelAtPeriodEnd)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, stored.RenewalStatus)
	firstUpdatedAt := stored.UpdatedAt
	contractUpdates := countSubscriptionContractUpdates(t)

	replay, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, replay.RenewalStatus)
	require.False(t, replay.CanCancel)
	require.True(t, replay.CanResume)
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, firstUpdatedAt, stored.UpdatedAt)
	require.Zero(t, *contractUpdates)
}

func TestResumeCurrentSubscriptionRenewalRestoresWalletAutoEnabledAndIsIdempotent(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7822, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, _ := seedWalletRenewalContract(t, 7922, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("renewal_status", model.SubscriptionRenewalStatusCancelledByUser).Error)

	result, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.Equal(t, model.SubscriptionRenewalSourceWallet, result.RenewalSource)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, result.RenewalStatus)
	require.Equal(t, periodEnd, result.CurrentPeriodEnd)
	require.True(t, result.CanCancel)
	require.False(t, result.CanResume)
	require.False(t, result.CancelAtPeriodEnd)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, stored.RenewalStatus)
	firstUpdatedAt := stored.UpdatedAt
	contractUpdates := countSubscriptionContractUpdates(t)

	replay, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, replay.RenewalStatus)
	require.True(t, replay.CanCancel)
	require.False(t, replay.CanResume)
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, firstUpdatedAt, stored.UpdatedAt)
	require.Zero(t, *contractUpdates)
}

func TestResumeCurrentSubscriptionRenewalRejectsExpiredPeriod(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7823, 1, 7, 700)
	periodEnd := common.GetTimestamp() - 1
	contract, _ := seedWalletRenewalContract(t, 7923, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("renewal_status", model.SubscriptionRenewalStatusCancelledByUser).Error)

	result, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.Error(t, err)
	require.Nil(t, result)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, stored.RenewalStatus)
}

func TestCancelCurrentSubscriptionRenewalRejectsInactiveOrMismatchedEntitlement(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7824, 1, 7, 700)
	futureEnd := common.GetTimestamp() + 3600
	inactiveContract, _ := seedWalletRenewalContract(t, 7924, 700, plan, futureEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", inactiveContract.Id).
		Update("status", model.SubscriptionContractStatusEnded).Error)

	inactiveResult, inactiveErr := CancelCurrentSubscriptionRenewal(inactiveContract.UserId)

	require.Error(t, inactiveErr)
	require.Nil(t, inactiveResult)

	contract, _ := seedWalletRenewalContract(t, 7925, 700, plan, futureEnd)
	otherContract, otherEntitlement := seedWalletRenewalContract(t, 7926, 700, plan, futureEnd)
	require.NotEqual(t, contract.Id, otherContract.Id)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("current_entitlement_id", otherEntitlement.Id).Error)

	mismatchResult, mismatchErr := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.Error(t, mismatchErr)
	require.Nil(t, mismatchResult)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, stored.RenewalStatus)
}

func TestCancelCurrentSubscriptionRenewalRejectsHistoricalCurrentEntitlement(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7829, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, entitlement := seedWalletRenewalContract(t, 7929, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).
		Where("id = ? AND contract_id = ?", entitlement.Id, contract.Id).
		Update("status", model.SubscriptionEntitlementStatusHistorical).Error)
	var storedEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&storedEntitlement, "id = ?", entitlement.Id).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, storedEntitlement.Status)
	require.NotNil(t, storedEntitlement.CurrentSlot)

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorContains(t, err, "active current subscription entitlement")
	require.Nil(t, result)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, storedContract.RenewalStatus)
}

func TestResumeCurrentSubscriptionRenewalRejectsHistoricalCurrentEntitlement(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7830, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, entitlement := seedWalletRenewalContract(t, 7930, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("renewal_status", model.SubscriptionRenewalStatusCancelledByUser).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).
		Where("id = ? AND contract_id = ?", entitlement.Id, contract.Id).
		Update("status", model.SubscriptionEntitlementStatusHistorical).Error)
	var storedEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&storedEntitlement, "id = ?", entitlement.Id).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, storedEntitlement.Status)
	require.NotNil(t, storedEntitlement.CurrentSlot)

	result, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorContains(t, err, "active current subscription entitlement")
	require.Nil(t, result)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, storedContract.RenewalStatus)
}

func TestCancelCurrentSubscriptionRenewalRejectsNonWalletSource(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7825, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, _ := seedWalletRenewalContract(t, 7927, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("renewal_source", model.SubscriptionRenewalSourceProvider).Error)

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorContains(t, err, "wallet")
	require.Nil(t, result)
}

func TestRunWalletSubscriptionRenewalOnceSkipsCancelledByUserWithoutWalletLedger(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7826, 1, 7, 700)
	periodEnd := common.GetTimestamp() - 15
	contract, _ := seedWalletRenewalContract(t, 7928, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("renewal_status", model.SubscriptionRenewalStatusCancelledByUser).Error)

	renewed, err := RunWalletSubscriptionRenewalOnce(10)

	require.NoError(t, err)
	require.Zero(t, renewed)
	var ledgerCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("user_id = ?", contract.UserId).Count(&ledgerCount).Error)
	require.Zero(t, ledgerCount)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, periodEnd, stored.CurrentPeriodEnd)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, stored.RenewalStatus)
}

func countSubscriptionContractUpdates(t *testing.T) *int {
	t.Helper()
	count := 0
	callbackName := "test:subscription_renewal_lifecycle_contract_updates:" + t.Name()
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "user_subscription_contracts" {
			count++
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})
	return &count
}
