package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
)

func insertStripeUpgradePlan(t *testing.T, id int, rank int, price float64, amount int64, priceID string) model.SubscriptionPlan {
	t.Helper()
	plan := insertContractServicePlan(t, id, rank, price, amount)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", id).Updates(map[string]interface{}{
		"stripe_price_id": priceID,
		"currency":        "USD",
	}).Error)
	plan.StripePriceId = priceID
	plan.Currency = "USD"
	return plan
}

func seedStripeUpgradeContract(t *testing.T, userID int, currentPlan model.SubscriptionPlan) (*model.UserSubscriptionContract, *model.SubscriptionProviderBinding, model.UserSubscription) {
	t.Helper()
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userID).Update("stripe_customer", "cus_upgrade").Error)
	contract := &model.UserSubscriptionContract{
		UserId:      userID,
		Status:      model.SubscriptionContractStatusActive,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
	}
	require.NoError(t, model.DB.Create(contract).Error)
	binding := &model.SubscriptionProviderBinding{
		UserId:                     userID,
		PlanId:                     currentPlan.Id,
		ContractId:                 contract.Id,
		Provider:                   model.PaymentProviderStripe,
		ProviderSubscriptionId:     "sub_upgrade",
		ProviderSubscriptionItemId: "si_current_item",
		ProviderCustomerId:         "cus_upgrade",
		ProviderPriceId:            currentPlan.StripePriceId,
		ProviderStatus:             "active",
		CurrentPeriodStart:         1000,
		CurrentPeriodEnd:           2000,
	}
	require.NoError(t, model.DB.Create(binding).Error)
	currentSlot := 1
	grantKey := "stripe:current"
	entitlement := model.UserSubscription{
		UserId:            userID,
		PlanId:            currentPlan.Id,
		ContractId:        contract.Id,
		ProviderBindingId: binding.Id,
		GrantKey:          &grantKey,
		CurrentSlot:       &currentSlot,
		AmountTotal:       currentPlan.TotalAmount,
		AmountUsed:        77,
		StartTime:         1000,
		EndTime:           2000,
		AccessEndTime:     2000,
		Status:            model.SubscriptionEntitlementStatusActive,
		Source:            model.PaymentMethodStripe,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
	}
	require.NoError(t, model.DB.Create(&entitlement).Error)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{
		"current_plan_id":             currentPlan.Id,
		"current_entitlement_id":      entitlement.Id,
		"current_provider_binding_id": binding.Id,
		"current_period_start":        1000,
		"current_period_end":          2000,
	}).Error)
	require.NoError(t, model.DB.First(contract, "id = ?", contract.Id).Error)
	return contract, binding, entitlement
}

func useStripeUpgradeTestServer(t *testing.T, handler http.Handler) {
	t.Helper()
	originalBackend := stripe.GetBackend(stripe.APIBackend)
	originalSecret := setting.StripeApiSecret
	originalKey := stripe.Key
	server := httptest.NewServer(handler)
	stripe.SetBackend(stripe.APIBackend, stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{
		URL:               stripe.String(server.URL),
		HTTPClient:        server.Client(),
		MaxNetworkRetries: stripe.Int64(0),
		LeveledLogger:     &stripe.LeveledLogger{Level: stripe.LevelNull},
	}))
	setting.StripeApiSecret = "sk_test_upgrade"
	t.Cleanup(func() {
		server.Close()
		stripe.SetBackend(stripe.APIBackend, originalBackend)
		setting.StripeApiSecret = originalSecret
		stripe.Key = originalKey
	})
}

func TestCreateStripeSubscriptionCheckoutOmitsCustomerCreationInSubscriptionMode(t *testing.T) {
	var checkoutForm url.Values
	useStripeUpgradeTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/v1/checkout/sessions", r.URL.Path)
		require.NoError(t, r.ParseForm())
		checkoutForm = r.PostForm
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"cs_subscription","object":"checkout.session","url":"https://checkout.stripe.test/subscription"}`))
	}))

	created, err := createStripeSubscriptionCheckout(context.Background(), StripeSubscriptionCheckoutInput{
		TradeNo:        "sub_test_checkout",
		UserID:         7130,
		PlanID:         7230,
		ContractID:     7330,
		ChangeIntentID: 7430,
		Email:          "buyer@example.com",
		PriceID:        "price_subscription",
		IdempotencyKey: "stripe-checkout-test",
	})

	require.NoError(t, err)
	require.Equal(t, "cs_subscription", created.ID)
	require.Equal(t, string(stripe.CheckoutSessionModeSubscription), checkoutForm.Get("mode"))
	require.Equal(t, "buyer@example.com", checkoutForm.Get("customer_email"))
	require.NotContains(t, checkoutForm, "customer_creation")
}

func TestStripeUpgradeExecuteWritesAuthoritativeMetadata(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7130, 0)
	currentPlan := insertStripeUpgradePlan(t, 7229, 1, 10, 1000, "price_current_metadata")
	targetPlan := insertStripeUpgradePlan(t, 7230, 2, 25, 2500, "price_target_metadata")
	contract, binding, _ := seedStripeUpgradeContract(t, 7130, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7130,
		RequestId:              "stripe-upgrade-metadata",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusSyncing,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderIdempotencyKey: stripeSubscriptionUpgradeIdempotencyKey(contract.Id, 1, targetPlan.Id),
	}
	require.NoError(t, model.DB.Create(intent).Error)

	var updateForm url.Values
	useStripeUpgradeTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/subscriptions/sub_upgrade":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","cancel_at_period_end":false,"current_period_start":1000,"current_period_end":2000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_current_metadata","object":"price"}}]}}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscriptions/sub_upgrade":
			require.NoError(t, r.ParseForm())
			updateForm = r.PostForm
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","cancel_at_period_end":false,"current_period_start":1000,"current_period_end":2000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_target_metadata","object":"price"}}]},"latest_invoice":{"id":"in_upgrade_metadata","object":"invoice","paid":false,"status":"open","hosted_invoice_url":"https://stripe.test/invoice/in_upgrade_metadata"},"pending_update":{"expires_at":9999999999}}`))
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
	require.NotNil(t, result)
	require.Equal(t, "7130", updateForm.Get("metadata[user_id]"))
	require.Equal(t, fmt.Sprintf("%d", targetPlan.Id), updateForm.Get("metadata[plan_id]"))
	require.Equal(t, fmt.Sprintf("%d", contract.Id), updateForm.Get("metadata[contract_id]"))
	require.Equal(t, fmt.Sprintf("%d", intent.Id), updateForm.Get("metadata[change_intent_id]"))
	require.Equal(t, "1", updateForm.Get("metadata[change_version]"))
}

func TestStripeUpgradeUpdateFailureRestoresReleasedDowngradeSchedule(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7129, 0)
	currentPlan := insertStripeUpgradePlan(t, 7226, 2, 25, 2500, "price_current_recovery")
	downgradePlan := insertStripeUpgradePlan(t, 7227, 1, 10, 1000, "price_downgrade_recovery")
	targetPlan := insertStripeUpgradePlan(t, 7228, 3, 50, 5000, "price_target_recovery")
	contract, binding, _ := seedStripeUpgradeContract(t, 7129, currentPlan)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{
		"pending_plan_id":      downgradePlan.Id,
		"pending_effective_at": int64(2000),
	}).Error)
	require.NoError(t, model.DB.Model(binding).Update("provider_schedule_id", "sched_upgrade_previous").Error)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7129,
		RequestId:              "stripe-upgrade-recovery",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusSyncing,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderIdempotencyKey: stripeSubscriptionUpgradeIdempotencyKey(contract.Id, 1, targetPlan.Id),
	}
	require.NoError(t, model.DB.Create(intent).Error)

	getSubscriptionCalls := 0
	snapshotPersistedAtRelease := false
	restoreCreateCalls := 0
	restoreUpdateCalls := 0
	useStripeUpgradeTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/subscriptions/sub_upgrade":
			getSubscriptionCalls++
			if getSubscriptionCalls == 1 {
				_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","schedule":"sched_upgrade_previous","cancel_at_period_end":false,"current_period_start":1000,"current_period_end":2000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_current_recovery","object":"price"}}]}}`))
				return
			}
			_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","cancel_at_period_end":false,"current_period_start":1000,"current_period_end":2000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_current_recovery","object":"price"}}]}}`))
		case r.Method == http.MethodGet && r.URL.Path == "/v1/subscription_schedules/sched_upgrade_previous":
			_, _ = w.Write([]byte(`{"id":"sched_upgrade_previous","object":"subscription_schedule","status":"active","end_behavior":"release","subscription":"sub_upgrade","current_phase":{"start_date":1000,"end_date":2000},"phases":[{"start_date":1000,"end_date":2000,"proration_behavior":"none","items":[{"price":"price_current_recovery","quantity":1}]},{"start_date":2000,"end_date":3000,"proration_behavior":"none","items":[{"price":"price_downgrade_recovery","quantity":1}]}]}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscription_schedules/sched_upgrade_previous/release":
			var reloaded model.SubscriptionChangeIntent
			snapshotPersistedAtRelease = model.DB.First(&reloaded, "id = ?", intent.Id).Error == nil && reloaded.PreviousScheduleSnapshot != ""
			_, _ = w.Write([]byte(`{"id":"sched_upgrade_previous","object":"subscription_schedule","status":"released","released_subscription":"sub_upgrade"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscriptions/sub_upgrade":
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":{"type":"api_error","message":"subscription update failed"}}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscription_schedules":
			restoreCreateCalls++
			require.NoError(t, r.ParseForm())
			require.Equal(t, "sub_upgrade", r.PostForm.Get("from_subscription"))
			_, _ = w.Write([]byte(`{"id":"sched_upgrade_restored","object":"subscription_schedule","status":"active","subscription":"sub_upgrade"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscription_schedules/sched_upgrade_restored":
			restoreUpdateCalls++
			_, _ = w.Write([]byte(`{"id":"sched_upgrade_restored","object":"subscription_schedule","status":"active","end_behavior":"release","subscription":"sub_upgrade","current_phase":{"start_date":1000,"end_date":2000},"phases":[{"start_date":1000,"end_date":2000,"proration_behavior":"none","items":[{"price":"price_current_recovery","quantity":1}]},{"start_date":2000,"end_date":3000,"proration_behavior":"none","items":[{"price":"price_downgrade_recovery","quantity":1}]}]}`))
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
		ProviderScheduleID:         "sched_upgrade_previous",
		IdempotencyKey:             intent.ProviderIdempotencyKey,
	})

	require.Error(t, err)
	require.Nil(t, result)
	require.True(t, snapshotPersistedAtRelease)
	require.Equal(t, 1, restoreCreateCalls)
	require.Equal(t, 1, restoreUpdateCalls)
	var reloadedIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&reloadedIntent, "id = ?", intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusFailed, reloadedIntent.Status)
	require.Empty(t, reloadedIntent.PreviousScheduleSnapshot)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, "sched_upgrade_restored", reloadedBinding.ProviderScheduleId)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
	require.Equal(t, downgradePlan.Id, reloadedContract.PendingPlanId)
	require.Equal(t, int64(2000), reloadedContract.PendingEffectiveAt)
}

func TestStripeUpgradePendingPaymentPreservesPreexistingCancelAtPeriodEnd(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7128, 0)
	currentPlan := insertStripeUpgradePlan(t, 7224, 1, 10, 1000, "price_current_cancel")
	targetPlan := insertStripeUpgradePlan(t, 7225, 2, 25, 2500, "price_target_cancel")
	contract, binding, _ := seedStripeUpgradeContract(t, 7128, currentPlan)
	require.NoError(t, model.DB.Model(binding).Update("cancel_at_period_end", true).Error)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7128,
		RequestId:              "stripe-upgrade-cancel-pending",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusSyncing,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderIdempotencyKey: stripeSubscriptionUpgradeIdempotencyKey(contract.Id, 1, targetPlan.Id),
	}
	require.NoError(t, model.DB.Create(intent).Error)
	var updateForm url.Values
	useStripeUpgradeTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/subscriptions/sub_upgrade":
			_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","cancel_at_period_end":true,"current_period_start":1000,"current_period_end":2000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_current_cancel","object":"price"}}]}}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscriptions/sub_upgrade":
			require.NoError(t, r.ParseForm())
			updateForm = r.PostForm
			_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","cancel_at_period_end":false,"current_period_start":1000,"current_period_end":2000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_target_cancel","object":"price"}}]},"latest_invoice":{"id":"in_upgrade_cancel","object":"invoice","paid":false,"status":"open","hosted_invoice_url":"https://stripe.test/invoice/in_upgrade_cancel"},"pending_update":{"expires_at":9999999999}}`))
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
		CancelAtPeriodEnd:          true,
		IdempotencyKey:             intent.ProviderIdempotencyKey,
	})
	require.NoError(t, err)
	require.Empty(t, updateForm.Get("cancel_at_period_end"))
	require.NoError(t, persistStripeSubscriptionUpgradeResult(intent.Id, result))
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.True(t, reloadedBinding.CancelAtPeriodEnd)
}

func TestStripeUpgradeUncertainScheduleRecoveryMarksContractNeedsAttention(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7127, 0)
	currentPlan := insertStripeUpgradePlan(t, 7222, 1, 10, 1000, "price_current_attention")
	targetPlan := insertStripeUpgradePlan(t, 7223, 2, 25, 2500, "price_target_attention")
	contract, binding, _ := seedStripeUpgradeContract(t, 7127, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:               contract.Id,
		UserId:                   7127,
		RequestId:                "stripe-upgrade-attention",
		ChangeVersion:            1,
		Kind:                     model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		Status:                   model.SubscriptionChangeIntentStatusSyncing,
		FromPlanId:               currentPlan.Id,
		ToPlanId:                 targetPlan.Id,
		ProviderBindingId:        binding.Id,
		PreviousScheduleSnapshot: `{"subscription_id":"sub_upgrade","phases":[{"start_date":1000,"end_date":2000,"items":[{"price_id":"price_current_attention","quantity":1}]}]}`,
	}
	require.NoError(t, model.DB.Create(intent).Error)

	require.NoError(t, markStripeSubscriptionUpgradeFailed(intent.Id, errors.New("schedule restoration uncertain")))

	var reloadedIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&reloadedIntent, "id = ?", intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusCompensationRequired, reloadedIntent.Status)
	require.NotEmpty(t, reloadedIntent.PreviousScheduleSnapshot)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusNeedsAttention, reloadedContract.Status)
}

func TestStripeUpgradeUpdatesExistingItemAndKeepsOldEntitlementDuring3DS(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7131, 0)
	currentPlan := insertStripeUpgradePlan(t, 7231, 1, 10, 1000, "price_current")
	targetPlan := insertStripeUpgradePlan(t, 7232, 2, 25, 2500, "price_target")
	contract, binding, oldEntitlement := seedStripeUpgradeContract(t, 7131, currentPlan)
	originalUpgrade := stripeSubscriptionUpgradeExecutor
	t.Cleanup(func() { stripeSubscriptionUpgradeExecutor = originalUpgrade })
	var gotInput StripeSubscriptionUpgradeInput
	stripeSubscriptionUpgradeExecutor = func(ctx context.Context, input StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
		gotInput = input
		return &StripeSubscriptionUpgradeResult{
			Status:            model.SubscriptionChangeIntentStatusAwaitingPayment,
			ProviderInvoiceID: "in_upgrade_3ds",
			HostedInvoiceURL:  "https://stripe.test/invoice/in_upgrade_3ds",
			Snapshot: model.ProviderSubscriptionSnapshot{
				ProviderSubscriptionId:     input.ProviderSubscriptionID,
				ProviderSubscriptionItemId: input.ProviderSubscriptionItemID,
				ProviderCustomerId:         "cus_upgrade",
				ProviderPriceId:            "price_current",
				ProviderLatestInvoiceId:    "in_upgrade_3ds",
				ProviderStatus:             "active",
				CancelAtPeriodEnd:          false,
				CurrentPeriodStart:         1000,
				CurrentPeriodEnd:           2000,
			},
		}, nil
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      7131,
		PlanID:      targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "stripe-upgrade-3ds",
	})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusPaymentActionRequired, result.Status)
	require.Equal(t, "https://stripe.test/invoice/in_upgrade_3ds", result.HostedInvoiceURL)
	require.Equal(t, contract.Id, gotInput.ContractID)
	require.Equal(t, int64(1), gotInput.ChangeVersion)
	require.Equal(t, targetPlan.Id, gotInput.TargetPlanID)
	require.Equal(t, "price_target", gotInput.TargetPriceID)
	require.Equal(t, "sub_upgrade", gotInput.ProviderSubscriptionID)
	require.Equal(t, "si_current_item", gotInput.ProviderSubscriptionItemID)
	require.Equal(t, stripeSubscriptionUpgradeIntentIdempotencyKey(contract.Id, 1, targetPlan.Id, result.Intent.Id), gotInput.IdempotencyKey)

	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, currentPlan.Id, reloadedContract.CurrentPlanId)
	require.Equal(t, oldEntitlement.Id, reloadedContract.CurrentEntitlementId)
	require.Equal(t, result.Intent.Id, reloadedContract.LatestChangeIntentId)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, result.Intent.Status)
	require.Equal(t, "in_upgrade_3ds", result.Intent.ProviderInvoiceId)

	var entitlement model.UserSubscription
	require.NoError(t, model.DB.First(&entitlement, "id = ?", oldEntitlement.Id).Error)
	require.Equal(t, currentPlan.Id, entitlement.PlanId)
	require.Equal(t, int64(77), entitlement.AmountUsed)
	require.NotNil(t, entitlement.CurrentSlot)

	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("provider_subscription_id = ?", binding.ProviderSubscriptionId).Count(&bindingCount).Error)
	require.Equal(t, int64(1), bindingCount)
}

func TestStripeUpgradePaidInvoiceRotatesTargetEntitlement(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7132, 0)
	currentPlan := insertStripeUpgradePlan(t, 7233, 1, 10, 1000, "price_current_paid")
	targetPlan := insertStripeUpgradePlan(t, 7234, 2, 25, 2500, "price_target_paid")
	contract, binding, oldEntitlement := seedStripeUpgradeContract(t, 7132, currentPlan)
	require.NoError(t, model.DB.Model(binding).Update("cancel_at_period_end", true).Error)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7132,
		RequestId:              "stripe-upgrade-paid",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusAwaitingPayment,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderInvoiceId:      "in_upgrade_paid",
		ProviderIdempotencyKey: "subscription-upgrade:1:1:7234",
		EffectiveAt:            common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(contract).Update("latest_change_intent_id", intent.Id).Error)
	invoice := stripeInvoiceFixture("in_upgrade_paid", "sub_upgrade")
	invoice.AmountPaid = 2500
	invoice.AmountDue = 2500
	invoice.Total = 2500
	setStripeInvoiceLinePrice(invoice.Lines.Data[0], "price_target_paid")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: 3000, End: 4000}
	subscription := stripeSubscriptionFixture("sub_upgrade", map[string]string{
		"trade_no":         "",
		"user_id":          "7132",
		"plan_id":          fmt.Sprintf("%d", targetPlan.Id),
		"contract_id":      fmt.Sprintf("%d", contract.Id),
		"change_intent_id": fmt.Sprintf("%d", intent.Id),
	})
	invoice.Customer = &stripe.Customer{ID: "cus_upgrade"}
	subscription.Customer = &stripe.Customer{ID: "cus_upgrade"}
	subscription.Items.Data[0].ID = "si_current_item"
	subscription.Items.Data[0].Price = &stripe.Price{ID: "price_target_paid"}
	setStripeSubscriptionCurrentPeriod(subscription, 3000, 4000)
	subscription.CancelAtPeriodEnd = true
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()
	originalResume := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() { stripeUpdateSubscriptionCancelAtPeriodEnd = originalResume })
	resumeCalled := false
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		resumeCalled = true
		require.Equal(t, "sub_upgrade", providerSubscriptionID)
		require.False(t, cancelAtPeriodEnd)
		require.Equal(t, intent.ProviderIdempotencyKey+":resume-recurring", idempotencyKey)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:     "sub_upgrade",
			ProviderSubscriptionItemId: "si_current_item",
			ProviderCustomerId:         "cus_upgrade",
			ProviderPriceId:            "price_target_paid",
			ProviderLatestInvoiceId:    "in_upgrade_paid",
			ProviderStatus:             "active",
			CancelAtPeriodEnd:          false,
			CurrentPeriodStart:         3000,
			CurrentPeriodEnd:           4000,
		}, nil
	}

	reconciled, err := ReconcilePaidInvoice(context.Background(), "in_upgrade_paid")

	require.NoError(t, err)
	require.True(t, resumeCalled)
	require.True(t, reconciled.Applied)
	require.NotNil(t, reconciled.Entitlement)
	require.Equal(t, targetPlan.Id, reconciled.Entitlement.PlanId)
	require.Equal(t, int64(0), reconciled.Entitlement.AmountUsed)
	require.Equal(t, int64(3000), reconciled.Entitlement.StartTime)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, targetPlan.Id, reloadedContract.CurrentPlanId)
	require.Equal(t, reconciled.Entitlement.Id, reloadedContract.CurrentEntitlementId)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, targetPlan.Id, reloadedBinding.PlanId)
	require.Equal(t, "price_target_paid", reloadedBinding.ProviderPriceId)
	require.Equal(t, "si_current_item", reloadedBinding.ProviderSubscriptionItemId)
	require.False(t, reloadedBinding.CancelAtPeriodEnd)
	var archivedOld model.UserSubscription
	require.NoError(t, model.DB.First(&archivedOld, "id = ?", oldEntitlement.Id).Error)
	require.Nil(t, archivedOld.CurrentSlot)
	require.Equal(t, model.SubscriptionEntitlementEndReasonUpgraded, archivedOld.EndReason)
	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("provider_subscription_id = ?", binding.ProviderSubscriptionId).Count(&bindingCount).Error)
	require.Equal(t, int64(1), bindingCount)
}

func TestStripeUpgradePaidInvoiceUsesFrozenUpgradeOrderPlanSnapshotAfterPlanEdit(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7138, 0)
	currentPlan := insertStripeUpgradePlan(t, 7248, 1, 10, 1000, "price_current_snapshot")
	targetPlan := insertStripeUpgradePlan(t, 7249, 2, 25, 2500, "price_target_snapshot")
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", targetPlan.Id).Updates(map[string]interface{}{
		"media_credits_monthly": int64(55),
		"window_5h_amount":      int64(125),
		"window_week_amount":    int64(900),
		"upgrade_group":         "snapshot_group",
	}).Error)
	contract, binding, _ := seedStripeUpgradeContract(t, 7138, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7138,
		RequestId:              "stripe-upgrade-snapshot",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindUpgrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusAwaitingPayment,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		ProviderInvoiceId:      "in_upgrade_snapshot",
		ProviderIdempotencyKey: "subscription-upgrade:1:1:7249",
		EffectiveAt:            common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(intent).Error)
	order := model.SubscriptionOrder{
		UserId:          7138,
		PlanId:          targetPlan.Id,
		Money:           25,
		TradeNo:         "sub_upgrade_snapshot_order",
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
		PlanSnapshot:    `{"plan_id":7249,"title":"Entitlement Plan","price_amount":25,"currency":"USD","duration_unit":"month","duration_value":1,"total_amount":2500,"window_5h_amount":125,"window_week_amount":900,"media_credits_monthly":55,"upgrade_group":"snapshot_group"}`,
		PurchaseIntent:  model.SubscriptionChangeIntentKindUpgrade,
		ChangeIntentId:  intent.Id,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	require.NoError(t, model.DB.Model(contract).Update("latest_change_intent_id", intent.Id).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", targetPlan.Id).Updates(map[string]interface{}{
		"price_amount":          99.99,
		"total_amount":          int64(999999),
		"media_credits_monthly": int64(999),
		"window_5h_amount":      int64(999),
		"window_week_amount":    int64(888),
		"upgrade_group":         "edited_group",
	}).Error)
	invoice := stripeInvoiceFixture("in_upgrade_snapshot", "sub_upgrade")
	invoice.AmountPaid = 2500
	invoice.AmountDue = 2500
	invoice.Total = 2500
	setStripeInvoiceLinePrice(invoice.Lines.Data[0], "price_target_snapshot")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: 3000, End: 4000}
	subscription := stripeSubscriptionFixture("sub_upgrade", map[string]string{
		"user_id":          "7138",
		"plan_id":          fmt.Sprintf("%d", targetPlan.Id),
		"contract_id":      fmt.Sprintf("%d", contract.Id),
		"change_intent_id": fmt.Sprintf("%d", intent.Id),
	})
	invoice.Customer = &stripe.Customer{ID: "cus_upgrade"}
	subscription.Customer = &stripe.Customer{ID: "cus_upgrade"}
	subscription.Items.Data[0].ID = "si_current_item"
	subscription.Items.Data[0].Price = &stripe.Price{ID: "price_target_snapshot"}
	setStripeSubscriptionCurrentPeriod(subscription, 3000, 4000)
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	reconciled, err := ReconcilePaidInvoice(context.Background(), "in_upgrade_snapshot")

	require.NoError(t, err)
	require.True(t, reconciled.Applied)
	require.NotNil(t, reconciled.Entitlement)
	require.Equal(t, int64(2500), reconciled.Entitlement.AmountTotal)
	require.Equal(t, int64(55), reconciled.Entitlement.MediaCreditsTotal)
	require.NotNil(t, reconciled.Entitlement.Window5hAmount)
	require.NotNil(t, reconciled.Entitlement.WindowWeekAmount)
	require.Equal(t, int64(125), *reconciled.Entitlement.Window5hAmount)
	require.Equal(t, int64(900), *reconciled.Entitlement.WindowWeekAmount)
	require.Equal(t, "snapshot_group", reconciled.Entitlement.UpgradeGroup)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, order.Id, reloadedBinding.InitialOrderId)
}
