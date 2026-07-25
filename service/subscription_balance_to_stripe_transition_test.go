package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
)

func TestBalanceCurrentUpgradeToStripeRecurringCreatesReplayableCheckout(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 8160, 5000)
	currentPlan := insertContractServicePlan(t, 8260, 1, 10, 1000)
	targetPlan := insertStripeUpgradePlan(t, 8261, 2, 12.34, 1234, "price_invoice_plan")

	current, err := ChangeSubscriptionPlan(balanceChangeCommand(8160, currentPlan.Id, "balance-current"))
	require.NoError(t, err)
	var beforeUser model.User
	require.NoError(t, model.DB.First(&beforeUser, "id = ?", 8160).Error)
	var beforeContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&beforeContract, "id = ?", current.Contract.Id).Error)
	var beforeEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&beforeEntitlement, "id = ?", beforeContract.CurrentEntitlementId).Error)

	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	creatorCalls := 0
	stripeSubscriptionCheckoutCreator = func(ctx context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		creatorCalls++
		require.Equal(t, 8160, input.UserID)
		require.Equal(t, targetPlan.Id, input.PlanID)
		require.Equal(t, beforeContract.Id, input.ContractID)
		require.Equal(t, "price_invoice_plan", input.PriceID)
		require.NotEmpty(t, input.TradeNo)
		require.NotEmpty(t, input.IdempotencyKey)
		return &StripeSubscriptionCheckoutSession{ID: "cs_balance_to_stripe", URL: "https://checkout.stripe.test/balance-to-stripe"}, nil
	}
	cmd := ChangePlanCommand{
		UserID:      8160,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "balance-to-stripe-upgrade",
	}

	first, err := ChangeSubscriptionPlan(cmd)
	require.NoError(t, err)
	replayed, err := ChangeSubscriptionPlan(cmd)
	require.NoError(t, err)

	require.Equal(t, ChangePlanStatusCheckoutRequired, first.Status)
	require.Equal(t, "https://checkout.stripe.test/balance-to-stripe", first.CheckoutURL)
	require.NotNil(t, first.Intent)
	require.Equal(t, model.SubscriptionChangeIntentKindUpgrade, first.Intent.Kind)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, first.Intent.Status)
	require.Zero(t, first.Intent.ProviderBindingId)
	require.Equal(t, first.Intent.Id, replayed.Intent.Id)
	require.Equal(t, first.CheckoutURL, replayed.CheckoutURL)
	require.Equal(t, 1, creatorCalls)

	var afterContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&afterContract, "id = ?", beforeContract.Id).Error)
	require.Equal(t, beforeContract.CurrentPlanId, afterContract.CurrentPlanId)
	require.Equal(t, beforeContract.CurrentEntitlementId, afterContract.CurrentEntitlementId)
	require.Zero(t, afterContract.CurrentProviderBindingId)
	require.Equal(t, model.SubscriptionPaymentModeBalanceOnePeriod, afterContract.PaymentMode)
	require.Equal(t, first.Intent.Id, afterContract.LatestChangeIntentId)

	var afterEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&afterEntitlement, "id = ?", beforeEntitlement.Id).Error)
	require.Equal(t, beforeEntitlement.PlanId, afterEntitlement.PlanId)
	require.Equal(t, beforeEntitlement.AmountUsed, afterEntitlement.AmountUsed)
	require.Equal(t, beforeEntitlement.CurrentSlot, afterEntitlement.CurrentSlot)
	require.Equal(t, model.SubscriptionPaymentModeBalanceOnePeriod, afterEntitlement.PaymentMode)

	var afterUser model.User
	require.NoError(t, model.DB.First(&afterUser, "id = ?", 8160).Error)
	require.Equal(t, beforeUser.Quota, afterUser.Quota)

	var orders []model.SubscriptionOrder
	require.NoError(t, model.DB.Where("change_intent_id = ? AND payment_provider = ?", first.Intent.Id, model.PaymentProviderStripe).Find(&orders).Error)
	require.Len(t, orders, 1)
	require.Equal(t, common.TopUpStatusPending, orders[0].Status)
	require.Equal(t, model.PaymentMethodStripe, orders[0].PaymentMethod)
	require.Equal(t, targetPlan.Id, orders[0].PlanId)
}

func TestExternalCurrentUpgradeToStripeRecurringCreatesCheckoutWithoutMutatingCurrentContract(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 8162, 5000)
	currentPlan := insertContractServicePlan(t, 8264, 1, 10, 1000)
	targetPlan := insertStripeUpgradePlan(t, 8265, 2, 12.34, 1234, "price_invoice_plan")
	contract, oldEntitlement := seedExternalOnePeriodContract(t, 8162, currentPlan)

	originalCreator := stripeSubscriptionCheckoutCreator
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })
	creatorCalls := 0
	stripeSubscriptionCheckoutCreator = func(ctx context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		creatorCalls++
		require.Equal(t, 8162, input.UserID)
		require.Equal(t, targetPlan.Id, input.PlanID)
		require.Equal(t, contract.Id, input.ContractID)
		require.Equal(t, "price_invoice_plan", input.PriceID)
		return &StripeSubscriptionCheckoutSession{ID: "cs_external_to_stripe", URL: "https://checkout.stripe.test/external-to-stripe"}, nil
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      8162,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "external-to-stripe-upgrade",
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusCheckoutRequired, result.Status)
	require.Equal(t, "https://checkout.stripe.test/external-to-stripe", result.CheckoutURL)
	require.Equal(t, model.SubscriptionChangeIntentKindUpgrade, result.Intent.Kind)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, result.Intent.Status)
	require.Zero(t, result.Intent.ProviderBindingId)
	require.Equal(t, 1, creatorCalls)

	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, currentPlan.Id, reloadedContract.CurrentPlanId)
	require.Equal(t, oldEntitlement.Id, reloadedContract.CurrentEntitlementId)
	require.Zero(t, reloadedContract.CurrentProviderBindingId)
	require.Equal(t, model.SubscriptionPaymentModeExternalOnePeriod, reloadedContract.PaymentMode)
	require.Equal(t, result.Intent.Id, reloadedContract.LatestChangeIntentId)

	var reloadedEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&reloadedEntitlement, "id = ?", oldEntitlement.Id).Error)
	require.Equal(t, currentPlan.Id, reloadedEntitlement.PlanId)
	require.Equal(t, int64(77), reloadedEntitlement.AmountUsed)
	require.NotNil(t, reloadedEntitlement.CurrentSlot)
	require.Equal(t, model.SubscriptionPaymentModeExternalOnePeriod, reloadedEntitlement.PaymentMode)

	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("change_intent_id = ? AND payment_provider = ?", result.Intent.Id, model.PaymentProviderStripe).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestBalanceCurrentUpgradeToStripeRecurringPaidInvoiceRotatesThroughCheckoutBinding(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 8161, 5000)
	currentPlan := insertContractServicePlan(t, 8262, 1, 10, 1000)
	targetPlan := insertStripeUpgradePlan(t, 8263, 2, 12.34, 1234, "price_invoice_plan")

	current, err := ChangeSubscriptionPlan(balanceChangeCommand(8161, currentPlan.Id, "balance-current-paid"))
	require.NoError(t, err)
	var beforeUser model.User
	require.NoError(t, model.DB.First(&beforeUser, "id = ?", 8161).Error)
	var oldEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&oldEntitlement, "id = ?", current.Contract.CurrentEntitlementId).Error)

	restoreCheckout := replaceStripeCheckoutCreator(t, "cs_balance_to_stripe_paid", "https://checkout.stripe.test/balance-to-stripe-paid")
	defer restoreCheckout()
	pending, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      8161,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "balance-to-stripe-paid",
	})
	require.NoError(t, err)

	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "change_intent_id = ? AND payment_provider = ?", pending.Intent.Id, model.PaymentProviderStripe).Error)
	invoice := stripeInvoiceFixture("in_balance_to_stripe_paid", "sub_balance_to_stripe_paid")
	invoice.AmountPaid = 1234
	invoice.AmountDue = 1234
	invoice.Total = 1234
	invoice.Customer = &stripe.Customer{ID: "cus_balance_to_stripe_paid"}
	setStripeInvoiceLinePrice(invoice.Lines.Data[0], "price_invoice_plan")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: 3000, End: 4000}
	subscription := stripeSubscriptionFixture("sub_balance_to_stripe_paid", map[string]string{
		"trade_no":         order.TradeNo,
		"user_id":          "8161",
		"plan_id":          fmt.Sprintf("%d", targetPlan.Id),
		"contract_id":      fmt.Sprintf("%d", current.Contract.Id),
		"change_intent_id": fmt.Sprintf("%d", pending.Intent.Id),
	})
	subscription.Customer = &stripe.Customer{ID: "cus_balance_to_stripe_paid"}
	subscription.Items.Data[0].ID = "si_balance_to_stripe_paid"
	subscription.Items.Data[0].Price = &stripe.Price{ID: "price_invoice_plan"}
	setStripeSubscriptionCurrentPeriod(subscription, 3000, 4000)
	restoreReconcilers := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restoreReconcilers()

	reconciled, err := ReconcilePaidInvoice(context.Background(), "in_balance_to_stripe_paid")

	require.NoError(t, err)
	require.True(t, reconciled.Applied)
	require.NotNil(t, reconciled.Binding)
	require.NotNil(t, reconciled.Entitlement)
	require.Equal(t, targetPlan.Id, reconciled.Entitlement.PlanId)
	require.Equal(t, int64(1234), reconciled.Entitlement.AmountTotal)
	require.Equal(t, int64(0), reconciled.Entitlement.AmountUsed)
	require.Equal(t, model.SubscriptionPaymentModeStripeRecurring, reconciled.Entitlement.PaymentMode)
	require.Equal(t, reconciled.Binding.Id, reconciled.Entitlement.ProviderBindingId)

	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", current.Contract.Id).Error)
	require.Equal(t, targetPlan.Id, reloadedContract.CurrentPlanId)
	require.Equal(t, reconciled.Entitlement.Id, reloadedContract.CurrentEntitlementId)
	require.Equal(t, reconciled.Binding.Id, reloadedContract.CurrentProviderBindingId)
	require.Equal(t, model.SubscriptionPaymentModeStripeRecurring, reloadedContract.PaymentMode)

	var reloadedIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&reloadedIntent, "id = ?", pending.Intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusApplied, reloadedIntent.Status)
	require.Equal(t, reconciled.Binding.Id, reloadedIntent.ProviderBindingId)
	require.Equal(t, "in_balance_to_stripe_paid", reloadedIntent.ProviderInvoiceId)

	var reloadedOrder model.SubscriptionOrder
	require.NoError(t, model.DB.First(&reloadedOrder, "id = ?", order.Id).Error)
	require.Equal(t, common.TopUpStatusSuccess, reloadedOrder.Status)

	var archivedOld model.UserSubscription
	require.NoError(t, model.DB.First(&archivedOld, "id = ?", oldEntitlement.Id).Error)
	require.Nil(t, archivedOld.CurrentSlot)
	require.Equal(t, model.SubscriptionEntitlementEndReasonUpgraded, archivedOld.EndReason)
	require.Equal(t, int64(0), archivedOld.ProviderBindingId)

	var afterUser model.User
	require.NoError(t, model.DB.First(&afterUser, "id = ?", 8161).Error)
	require.Equal(t, beforeUser.Quota, afterUser.Quota)

	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("provider_subscription_id = ?", "sub_balance_to_stripe_paid").Count(&bindingCount).Error)
	require.Equal(t, int64(1), bindingCount)
}

func seedExternalOnePeriodContract(t *testing.T, userID int, currentPlan model.SubscriptionPlan) (*model.UserSubscriptionContract, model.UserSubscription) {
	t.Helper()
	contract := &model.UserSubscriptionContract{
		UserId:      userID,
		Status:      model.SubscriptionContractStatusActive,
		PaymentMode: model.SubscriptionPaymentModeExternalOnePeriod,
	}
	require.NoError(t, model.DB.Create(contract).Error)
	currentSlot := 1
	grantKey := "external:current"
	entitlement := model.UserSubscription{
		UserId:        userID,
		PlanId:        currentPlan.Id,
		ContractId:    contract.Id,
		GrantKey:      &grantKey,
		CurrentSlot:   &currentSlot,
		AmountTotal:   currentPlan.TotalAmount,
		AmountUsed:    77,
		StartTime:     1000,
		EndTime:       2000,
		AccessEndTime: 2000,
		Status:        model.SubscriptionEntitlementStatusActive,
		Source:        model.SubscriptionPaymentModeExternalOnePeriod,
		PaymentMode:   model.SubscriptionPaymentModeExternalOnePeriod,
	}
	require.NoError(t, model.DB.Create(&entitlement).Error)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{
		"current_plan_id":        currentPlan.Id,
		"current_entitlement_id": entitlement.Id,
		"current_period_start":   1000,
		"current_period_end":     2000,
	}).Error)
	require.NoError(t, model.DB.First(contract, "id = ?", contract.Id).Error)
	return contract, entitlement
}
