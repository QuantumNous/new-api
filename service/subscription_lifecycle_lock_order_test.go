package service

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionPlanChangeSourceKeepsProviderBindingBeforeContractLocks(t *testing.T) {
	source := readServiceSourceForLockOrder(t, "subscription_contract.go")

	requireSourceOrderInServiceFunction(t, source, "ChangeSubscriptionPlan",
		"lockStripePlanChangeIntentBindingBeforeContractTx",
		`subscriptionCommandLock(tx).
				Where("id = ? AND user_id = ?", existing.ContractId, cmd.UserID)`,
	)
	requireSourceOrderInServiceFunction(t, source, "ChangeSubscriptionPlan",
		"prelockCurrentStripePlanChangeBindingBeforeContractTx",
		"getOrCreateContractForUserTx",
	)
	requireSourceOrderInServiceFunction(t, source, "ChangeSubscriptionPlan",
		"validatePrelockedStripePlanChangeBindingForContract",
		"classifyPlanChangeTx",
	)
	require.NotContains(t, sourceFunctionBody(t, "subscription_contract.go", "prepareStripeSubscriptionDowngradeTx"), "subscriptionCommandLock(tx)")
	requireSourceOrderInServiceFunction(t, readServiceSourceForLockOrder(t, "subscription_downgrade.go"), "latestStripeDowngradeScheduleInput",
		"SubscriptionProviderBinding",
		"UserSubscriptionContract",
	)
	require.NotContains(t, sourceFunctionBody(t, "subscription_contract.go", "ChangeSubscriptionPlan"),
		`Where("id = ? AND user_id = ? AND contract_id = ? AND provider = ?"`,
	)
}

func TestSubscriptionLifecycleSourceRoutesReviewedOrderTransitionsThroughLifecycle(t *testing.T) {
	for _, tc := range []struct {
		fileName     string
		functionName string
		forbidden    []string
	}{
		{
			fileName:     "subscription_purchase.go",
			functionName: "createPendingOneTimePurchaseOrderTx",
			forbidden: []string{
				"Status:                    common.TopUpStatusPending",
				"tx.Create(order)",
			},
		},
		{
			fileName:     "subscription_purchase.go",
			functionName: "applyBalancePrepaidPurchaseTx",
			forbidden: []string{
				"Status:                    common.TopUpStatusSuccess",
				"tx.Create(order)",
			},
		},
		{
			fileName:     "subscription_contract.go",
			functionName: "applyBalanceOnePeriodChangeTx",
			forbidden: []string{
				"Status:          common.TopUpStatusSuccess",
				"tx.Create(order)",
			},
		},
		{
			fileName:     "subscription_contract.go",
			functionName: "prepareStripeSubscriptionCheckoutPaymentTx",
			forbidden: []string{
				"Status:                    common.TopUpStatusPending",
				"tx.Create(order)",
			},
		},
		{
			fileName:     "subscription_compensation.go",
			functionName: "prepareStripeToBalanceCompensationTx",
			forbidden: []string{
				"Status:          common.TopUpStatusSuccess",
				"tx.Create(order)",
			},
		},
		{
			fileName:     "subscription_compensation.go",
			functionName: "refundSubscriptionCompensationWalletDebitDefault",
			forbidden: []string{
				`"status":           common.TopUpStatusFailed`,
			},
		},
	} {
		t.Run(tc.fileName+"/"+tc.functionName, func(t *testing.T) {
			body := sourceFunctionBody(t, tc.fileName, tc.functionName)
			require.Contains(t, body, "PurchaseLifecycle", "%s must use subscription purchase lifecycle primitive", tc.functionName)
			for _, forbidden := range tc.forbidden {
				require.NotContains(t, body, forbidden)
			}
		})
	}
}

func TestSubscriptionInvoiceBindingSourceCreatesOrUpdatesOnlyInsideLifecycleWinner(t *testing.T) {
	body := sourceFunctionBody(t, "subscription_invoice.go", "reconcilePaidInvoice")

	requireSourceOrderInServiceFunction(t, readServiceSourceForLockOrder(t, "subscription_invoice.go"), "reconcilePaidInvoice",
		"PersistSubscriptionPurchaseLifecycleTransitionWithWinner",
		"createOrLoadStripeInvoiceBindingTx",
	)
	require.Contains(t, body, "createOrLoadStripeInvoiceBindingTx(tx, locked")
	require.NotContains(t, body, "createOrLoadStripeInvoiceBindingTx(tx, order")
}

func TestSubscriptionPlanChangeRejectsPrelockedProviderBindingDrift(t *testing.T) {
	binding := &model.SubscriptionProviderBinding{
		Id:         7001,
		UserId:     7101,
		ContractId: 7201,
		Provider:   model.PaymentProviderStripe,
	}
	contract := &model.UserSubscriptionContract{
		Id:                       7201,
		UserId:                   7101,
		Status:                   model.SubscriptionContractStatusActive,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		CurrentProviderBindingId: 7002,
	}

	err := validatePrelockedStripePlanChangeBindingForContract(binding, contract, false)

	require.True(t, errors.Is(err, ErrSubscriptionChangeInProgress))
}

func TestSubscriptionPlanChangeRejectsMissingPrelockForCurrentStripeBinding(t *testing.T) {
	contract := &model.UserSubscriptionContract{
		Id:                       7201,
		UserId:                   7101,
		Status:                   model.SubscriptionContractStatusActive,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		CurrentProviderBindingId: 7001,
	}

	err := validatePrelockedStripePlanChangeBindingForContract(nil, contract, true)

	require.True(t, errors.Is(err, ErrSubscriptionChangeInProgress))
}

func TestSubscriptionPlanChangeAllowsMissingPrelockWhenExistingIntentDoesNotTouchBinding(t *testing.T) {
	contract := &model.UserSubscriptionContract{
		Id:                       7201,
		UserId:                   7101,
		Status:                   model.SubscriptionContractStatusActive,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		CurrentProviderBindingId: 7001,
	}

	err := validatePrelockedStripePlanChangeBindingForContract(nil, contract, false)

	require.NoError(t, err)
}

func TestSubscriptionPlanChangeRejectsActiveProviderLifecycleReservationBeforeExecutor(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7142, 0)
	currentPlan := insertStripeUpgradePlan(t, 7249, 1, 10, 1000, "price_current_lifecycle_reservation")
	targetPlan := insertStripeUpgradePlan(t, 7250, 2, 25, 2500, "price_target_lifecycle_reservation")
	contract, binding, _ := seedStripeUpgradeContract(t, 7142, currentPlan)
	_, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"plan-change-blocked-by-lifecycle",
		300,
	)
	require.NoError(t, err)

	originalUpgrade := stripeSubscriptionUpgradeExecutor
	t.Cleanup(func() { stripeSubscriptionUpgradeExecutor = originalUpgrade })
	upgradeCalls := 0
	stripeSubscriptionUpgradeExecutor = func(context.Context, StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		upgradeCalls++
		return nil, errors.New("upgrade executor must not run during lifecycle reservation")
	}

	_, err = ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      contract.UserId,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "stripe-upgrade-lifecycle-reservation",
	})

	require.ErrorIs(t, err, ErrSubscriptionChangeInProgress)
	require.Zero(t, upgradeCalls)
}

func TestChangeSubscriptionPlanSyncingUpgradeReplayRejectsProviderBindingDriftBeforeExecutor(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7141, 0)
	currentPlan := insertStripeUpgradePlan(t, 7247, 1, 10, 1000, "price_current_lock_order")
	targetPlan := insertStripeUpgradePlan(t, 7248, 2, 25, 2500, "price_target_lock_order")
	contract, binding, _ := seedStripeUpgradeContract(t, 7141, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7141,
		RequestId:              "stripe-upgrade-lock-order-drift",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusSyncing,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderIdempotencyKey: "subscription-upgrade:lock-order-drift",
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{
		"current_provider_binding_id": 0,
		"latest_change_intent_id":     intent.Id,
	}).Error)

	originalUpgrade := stripeSubscriptionUpgradeExecutor
	t.Cleanup(func() { stripeSubscriptionUpgradeExecutor = originalUpgrade })
	upgradeCalls := 0
	stripeSubscriptionUpgradeExecutor = func(context.Context, StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		upgradeCalls++
		return nil, errors.New("upgrade executor must not run after provider binding drift")
	}

	_, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      7141,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   intent.RequestId,
	})

	require.ErrorIs(t, err, ErrSubscriptionChangeInProgress)
	require.Zero(t, upgradeCalls)
}

func readServiceSourceForLockOrder(t *testing.T, fileName string) string {
	t.Helper()
	data, err := os.ReadFile(fileName)
	require.NoError(t, err)
	return string(data)
}

func requireSourceOrderInServiceFunction(t *testing.T, source string, functionName string, first string, second string) {
	t.Helper()
	body := serviceSourceFunctionBodyForLockOrder(t, source, functionName)
	firstIndex := strings.Index(body, first)
	secondIndex := strings.Index(body, second)
	require.NotEqual(t, -1, firstIndex, "%s missing %q", functionName, first)
	require.NotEqual(t, -1, secondIndex, "%s missing %q", functionName, second)
	require.Less(t, firstIndex, secondIndex, "%s must keep %q before %q", functionName, first, second)
}

func serviceSourceFunctionBodyForLockOrder(t *testing.T, source string, functionName string) string {
	t.Helper()
	start := strings.Index(source, "func "+functionName+"(")
	require.NotEqual(t, -1, start, "missing function %s", functionName)
	open := strings.Index(source[start:], "{")
	require.NotEqual(t, -1, open, "missing function body for %s", functionName)
	open += start
	depth := 0
	for index := open; index < len(source); index++ {
		switch source[index] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return source[open : index+1]
			}
		}
	}
	t.Fatalf("unterminated function body for %s", functionName)
	return ""
}
