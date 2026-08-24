package service

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
)

func TestStripeUpgradeExecutorRecoversAppliedTargetPriceWithLatestInvoiceWithoutUpdate(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7140, 0)
	currentPlan := insertStripeUpgradePlan(t, 7245, 1, 10, 1000, "price_current_executor_replay")
	targetPlan := insertStripeUpgradePlan(t, 7246, 2, 25, 2500, "price_target_executor_replay")
	contract, binding, _ := seedStripeUpgradeContract(t, 7140, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7140,
		RequestId:              "stripe-upgrade-executor-replay",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusSyncing,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderIdempotencyKey: "subscription-upgrade:executor-replay",
		EffectiveAt:            common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(intent).Error)

	updateCalls := 0
	useStripeUpgradeTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/subscriptions/sub_upgrade":
			_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","cancel_at_period_end":false,"current_period_start":3000,"current_period_end":4000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_target_executor_replay","object":"price"}}]},"latest_invoice":{"id":"in_upgrade_executor_replay","object":"invoice","paid":false,"status":"open","hosted_invoice_url":"https://stripe.test/invoice/in_upgrade_executor_replay"}}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscriptions/sub_upgrade":
			updateCalls++
			_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","cancel_at_period_end":false,"current_period_start":3000,"current_period_end":4000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_target_executor_replay","object":"price"}}]},"latest_invoice":{"id":"in_duplicate_executor_replay","object":"invoice","paid":false,"status":"open","hosted_invoice_url":"https://stripe.test/invoice/in_duplicate_executor_replay"}}`))
		default:
			http.NotFound(w, r)
		}
	}))

	result, err := executeStripeSubscriptionUpgrade(context.Background(), StripeSubscriptionUpgradeInput{
		ContractID:                 contract.Id,
		ChangeVersion:              intent.ChangeVersion,
		TargetPlanID:               targetPlan.Id,
		TargetPriceID:              targetPlan.StripePriceId,
		ProviderSubscriptionID:     binding.ProviderSubscriptionId,
		ProviderSubscriptionItemID: binding.ProviderSubscriptionItemId,
		IdempotencyKey:             intent.ProviderIdempotencyKey,
	})

	require.NoError(t, err)
	require.Zero(t, updateCalls)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, result.Status)
	require.Equal(t, "in_upgrade_executor_replay", result.ProviderInvoiceID)
	require.Equal(t, "https://stripe.test/invoice/in_upgrade_executor_replay", result.HostedInvoiceURL)
	require.Equal(t, "price_target_executor_replay", result.Snapshot.ProviderPriceId)
	require.Equal(t, "in_upgrade_executor_replay", result.Snapshot.ProviderLatestInvoiceId)
}

func TestStripeUpgradeReplayReturnsHostedInvoiceWithoutReexecutingUpgrade(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7135, 0)
	currentPlan := insertStripeUpgradePlan(t, 7235, 1, 10, 1000, "price_current_replay")
	targetPlan := insertStripeUpgradePlan(t, 7236, 2, 25, 2500, "price_target_replay")
	contract, _, oldEntitlement := seedStripeUpgradeContract(t, 7135, currentPlan)

	originalUpgrade := stripeSubscriptionUpgradeExecutor
	originalInvoiceGetter := stripeInvoiceGetter
	t.Cleanup(func() {
		stripeSubscriptionUpgradeExecutor = originalUpgrade
		stripeInvoiceGetter = originalInvoiceGetter
	})

	upgradeCalls := 0
	stripeSubscriptionUpgradeExecutor = func(ctx context.Context, input StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		upgradeCalls++
		return &StripeSubscriptionUpgradeResult{
			Status:            model.SubscriptionChangeIntentStatusAwaitingPayment,
			ProviderInvoiceID: "in_upgrade_replay",
			HostedInvoiceURL:  "https://stripe.test/invoice/in_upgrade_replay",
			Snapshot: model.ProviderSubscriptionSnapshot{
				ProviderSubscriptionId:     input.ProviderSubscriptionID,
				ProviderSubscriptionItemId: input.ProviderSubscriptionItemID,
				ProviderCustomerId:         "cus_upgrade",
				ProviderPriceId:            "price_current_replay",
				ProviderLatestInvoiceId:    "in_upgrade_replay",
				ProviderStatus:             "active",
				CurrentPeriodStart:         1000,
				CurrentPeriodEnd:           2000,
			},
		}, nil
	}

	cmd := ChangePlanCommand{
		UserID:      7135,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "stripe-upgrade-replay",
	}
	first, err := ChangeSubscriptionPlan(cmd)
	require.NoError(t, err)
	require.Equal(t, 1, upgradeCalls)

	invoice := stripeInvoiceFixture("in_upgrade_replay", "sub_upgrade")
	markStripeInvoiceUnpaid(invoice)
	invoice.Status = stripe.InvoiceStatusOpen
	invoice.HostedInvoiceURL = "https://stripe.test/invoice/in_upgrade_replay"
	invoiceGets := 0
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		invoiceGets++
		require.Equal(t, "in_upgrade_replay", invoiceID)
		return invoice, nil
	}

	replayed, err := ChangeSubscriptionPlan(cmd)

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusPaymentActionRequired, replayed.Status)
	require.Equal(t, first.Intent.Id, replayed.Intent.Id)
	require.Equal(t, invoice.HostedInvoiceURL, replayed.HostedInvoiceURL)
	require.Equal(t, 1, invoiceGets)
	require.Equal(t, 1, upgradeCalls)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("change_intent_id = ?", first.Intent.Id).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var entitlement model.UserSubscription
	require.NoError(t, model.DB.First(&entitlement, "id = ?", oldEntitlement.Id).Error)
	require.Equal(t, currentPlan.Id, entitlement.PlanId)
	require.Equal(t, int64(77), entitlement.AmountUsed)
	require.NotNil(t, entitlement.CurrentSlot)
	require.Equal(t, contract.Id, entitlement.ContractId)
}

func TestStripeUpgradeReplayResumesSyncingIntentWithOriginalKey(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7137, 0)
	currentPlan := insertStripeUpgradePlan(t, 7239, 1, 10, 1000, "price_current_syncing_replay")
	targetPlan := insertStripeUpgradePlan(t, 7240, 2, 25, 2500, "price_target_syncing_replay")
	contract, binding, oldEntitlement := seedStripeUpgradeContract(t, 7137, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7137,
		RequestId:              "stripe-upgrade-syncing-replay",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusSyncing,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderIdempotencyKey: "subscription-upgrade:original-syncing-key",
		EffectiveAt:            common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(contract).Update("latest_change_intent_id", intent.Id).Error)

	originalUpgrade := stripeSubscriptionUpgradeExecutor
	t.Cleanup(func() { stripeSubscriptionUpgradeExecutor = originalUpgrade })
	upgradeCalls := 0
	var gotInput StripeSubscriptionUpgradeInput
	stripeSubscriptionUpgradeExecutor = func(ctx context.Context, input StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		upgradeCalls++
		gotInput = input
		return &StripeSubscriptionUpgradeResult{
			Status:            model.SubscriptionChangeIntentStatusAwaitingPayment,
			ProviderInvoiceID: "in_upgrade_syncing_replay",
			HostedInvoiceURL:  "https://stripe.test/invoice/in_upgrade_syncing_replay",
			Snapshot: model.ProviderSubscriptionSnapshot{
				ProviderSubscriptionId:     input.ProviderSubscriptionID,
				ProviderSubscriptionItemId: input.ProviderSubscriptionItemID,
				ProviderCustomerId:         "cus_upgrade",
				ProviderPriceId:            "price_current_syncing_replay",
				ProviderLatestInvoiceId:    "in_upgrade_syncing_replay",
				ProviderStatus:             "active",
				CurrentPeriodStart:         1000,
				CurrentPeriodEnd:           2000,
			},
		}, nil
	}

	replayed, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      7137,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   intent.RequestId,
	})

	require.NoError(t, err)
	require.Equal(t, 1, upgradeCalls)
	require.Equal(t, intent.ProviderIdempotencyKey, gotInput.IdempotencyKey)
	require.Equal(t, contract.Id, gotInput.ContractID)
	require.Equal(t, intent.ChangeVersion, gotInput.ChangeVersion)
	require.Equal(t, targetPlan.Id, gotInput.TargetPlanID)
	require.Equal(t, targetPlan.StripePriceId, gotInput.TargetPriceID)
	require.Equal(t, binding.ProviderSubscriptionId, gotInput.ProviderSubscriptionID)
	require.Equal(t, binding.ProviderSubscriptionItemId, gotInput.ProviderSubscriptionItemID)
	require.Equal(t, ChangePlanStatusPaymentActionRequired, replayed.Status)
	require.Equal(t, intent.Id, replayed.Intent.Id)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, replayed.Intent.Status)
	require.Equal(t, "in_upgrade_syncing_replay", replayed.Intent.ProviderInvoiceId)
	require.Equal(t, "https://stripe.test/invoice/in_upgrade_syncing_replay", replayed.HostedInvoiceURL)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 7137).Count(&intentCount).Error)
	require.Equal(t, int64(1), intentCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7137).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("user_id = ?", 7137).Count(&bindingCount).Error)
	require.Equal(t, int64(1), bindingCount)
	var entitlement model.UserSubscription
	require.NoError(t, model.DB.First(&entitlement, "id = ?", oldEntitlement.Id).Error)
	require.Equal(t, currentPlan.Id, entitlement.PlanId)
	require.Equal(t, int64(77), entitlement.AmountUsed)
}

func TestStripeUpgradeReplayUsesOpenInvoiceBeforeExecutorForSyncingIntent(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7138, 0)
	currentPlan := insertStripeUpgradePlan(t, 7241, 1, 10, 1000, "price_current_syncing_open")
	targetPlan := insertStripeUpgradePlan(t, 7242, 2, 25, 2500, "price_target_syncing_open")
	contract, binding, oldEntitlement := seedStripeUpgradeContract(t, 7138, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7138,
		RequestId:              "stripe-upgrade-syncing-open",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusSyncing,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderInvoiceId:      "in_upgrade_syncing_open",
		ProviderIdempotencyKey: "subscription-upgrade:syncing-open",
		EffectiveAt:            common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(contract).Update("latest_change_intent_id", intent.Id).Error)

	invoice := stripeInvoiceFixture("in_upgrade_syncing_open", binding.ProviderSubscriptionId)
	markStripeInvoiceUnpaid(invoice)
	invoice.Status = stripe.InvoiceStatusOpen
	invoice.HostedInvoiceURL = "https://stripe.test/invoice/in_upgrade_syncing_open"
	originalInvoiceGetter := stripeInvoiceGetter
	originalUpgrade := stripeSubscriptionUpgradeExecutor
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionUpgradeExecutor = originalUpgrade
	})
	invoiceGets := 0
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		invoiceGets++
		require.Equal(t, intent.ProviderInvoiceId, invoiceID)
		return invoice, nil
	}
	upgradeCalls := 0
	stripeSubscriptionUpgradeExecutor = func(ctx context.Context, input StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		upgradeCalls++
		return nil, fmt.Errorf("upgrade executor must not run when an invoice id is persisted")
	}

	replayed, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      7138,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   intent.RequestId,
	})

	require.NoError(t, err)
	require.Equal(t, 1, invoiceGets)
	require.Zero(t, upgradeCalls)
	require.Equal(t, ChangePlanStatusPaymentActionRequired, replayed.Status)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, replayed.Intent.Status)
	require.Equal(t, invoice.HostedInvoiceURL, replayed.HostedInvoiceURL)
	var reloadedIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&reloadedIntent, "id = ?", intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, reloadedIntent.Status)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("change_intent_id = ?", intent.Id).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var entitlement model.UserSubscription
	require.NoError(t, model.DB.First(&entitlement, "id = ?", oldEntitlement.Id).Error)
	require.Equal(t, currentPlan.Id, entitlement.PlanId)
	require.Equal(t, int64(77), entitlement.AmountUsed)
}

func TestStripeUpgradeReplayUsesPaidInvoiceBeforeExecutorForSyncingIntent(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7139, 0)
	currentPlan := insertStripeUpgradePlan(t, 7243, 1, 10, 1000, "price_current_syncing_paid")
	targetPlan := insertStripeUpgradePlan(t, 7244, 2, 25, 2500, "price_target_syncing_paid")
	contract, binding, oldEntitlement := seedStripeUpgradeContract(t, 7139, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7139,
		RequestId:              "stripe-upgrade-syncing-paid",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusSyncing,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderInvoiceId:      "in_upgrade_syncing_paid",
		ProviderIdempotencyKey: "subscription-upgrade:syncing-paid",
		EffectiveAt:            common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(contract).Update("latest_change_intent_id", intent.Id).Error)

	invoice := stripeInvoiceFixture("in_upgrade_syncing_paid", binding.ProviderSubscriptionId)
	invoice.AmountPaid = 2500
	invoice.AmountDue = 2500
	invoice.Total = 2500
	invoice.Customer = &stripe.Customer{ID: "cus_upgrade"}
	setStripeInvoiceLinePrice(invoice.Lines.Data[0], "price_target_syncing_paid")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: 3000, End: 4000}
	subscription := stripeSubscriptionFixture(binding.ProviderSubscriptionId, map[string]string{
		"trade_no":         "",
		"user_id":          "7139",
		"plan_id":          fmt.Sprintf("%d", targetPlan.Id),
		"contract_id":      fmt.Sprintf("%d", contract.Id),
		"change_intent_id": fmt.Sprintf("%d", intent.Id),
	})
	subscription.Customer = &stripe.Customer{ID: "cus_upgrade"}
	subscription.Items.Data[0].ID = binding.ProviderSubscriptionItemId
	subscription.Items.Data[0].Price = &stripe.Price{ID: "price_target_syncing_paid"}
	setStripeSubscriptionCurrentPeriod(subscription, 3000, 4000)
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	originalUpgrade := stripeSubscriptionUpgradeExecutor
	t.Cleanup(func() { stripeSubscriptionUpgradeExecutor = originalUpgrade })
	upgradeCalls := 0
	stripeSubscriptionUpgradeExecutor = func(ctx context.Context, input StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		upgradeCalls++
		return nil, fmt.Errorf("upgrade executor must not run when an invoice id is persisted")
	}

	replayed, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      7139,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   intent.RequestId,
	})

	require.NoError(t, err)
	require.Zero(t, upgradeCalls)
	require.Equal(t, ChangePlanStatusApplied, replayed.Status)
	require.Equal(t, model.SubscriptionChangeIntentStatusApplied, replayed.Intent.Status)
	require.Equal(t, targetPlan.Id, replayed.Contract.CurrentPlanId)
	require.NotEqual(t, oldEntitlement.Id, replayed.Contract.CurrentEntitlementId)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("change_intent_id = ?", intent.Id).Count(&orderCount).Error)
	require.Zero(t, orderCount)
}

func TestStripeUpgradeReplayReconcilesPaidInvoice(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7136, 0)
	currentPlan := insertStripeUpgradePlan(t, 7237, 1, 10, 1000, "price_current_paid_replay")
	targetPlan := insertStripeUpgradePlan(t, 7238, 2, 25, 2500, "price_target_paid_replay")
	contract, binding, oldEntitlement := seedStripeUpgradeContract(t, 7136, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7136,
		RequestId:              "stripe-upgrade-paid-replay",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusAwaitingPayment,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderInvoiceId:      "in_upgrade_paid_replay",
		ProviderIdempotencyKey: "subscription-upgrade:paid-replay",
		EffectiveAt:            common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(contract).Update("latest_change_intent_id", intent.Id).Error)

	invoice := stripeInvoiceFixture("in_upgrade_paid_replay", "sub_upgrade")
	invoice.AmountPaid = 2500
	invoice.AmountDue = 2500
	invoice.Total = 2500
	invoice.Customer = &stripe.Customer{ID: "cus_upgrade"}
	setStripeInvoiceLinePrice(invoice.Lines.Data[0], "price_target_paid_replay")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: 3000, End: 4000}
	subscription := stripeSubscriptionFixture("sub_upgrade", map[string]string{
		"trade_no":         "",
		"user_id":          "7136",
		"plan_id":          fmt.Sprintf("%d", targetPlan.Id),
		"contract_id":      fmt.Sprintf("%d", contract.Id),
		"change_intent_id": fmt.Sprintf("%d", intent.Id),
	})
	subscription.Customer = &stripe.Customer{ID: "cus_upgrade"}
	subscription.Items.Data[0].ID = "si_current_item"
	subscription.Items.Data[0].Price = &stripe.Price{ID: "price_target_paid_replay"}
	setStripeSubscriptionCurrentPeriod(subscription, 3000, 4000)
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	originalUpgrade := stripeSubscriptionUpgradeExecutor
	t.Cleanup(func() { stripeSubscriptionUpgradeExecutor = originalUpgrade })
	upgradeCalls := 0
	stripeSubscriptionUpgradeExecutor = func(ctx context.Context, input StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		upgradeCalls++
		return nil, fmt.Errorf("upgrade executor must not run during replay")
	}

	replayed, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      7136,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   intent.RequestId,
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusApplied, replayed.Status)
	require.Equal(t, intent.Id, replayed.Intent.Id)
	require.Equal(t, model.SubscriptionChangeIntentStatusApplied, replayed.Intent.Status)
	require.Equal(t, targetPlan.Id, replayed.Contract.CurrentPlanId)
	require.NotEqual(t, oldEntitlement.Id, replayed.Contract.CurrentEntitlementId)
	require.Zero(t, upgradeCalls)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("change_intent_id = ?", intent.Id).Count(&orderCount).Error)
	require.Zero(t, orderCount)
}
