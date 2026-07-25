package service

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
)

func TestStripeDowngradeLatestSelectionSupersedesPreviousAndKeepsOnlyLatestPending(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7150, 0)
	currentPlan := insertStripeUpgradePlan(t, 7250, 3, 30, 3000, "price_current_down_latest")
	firstTarget := insertStripeUpgradePlan(t, 7251, 2, 20, 2000, "price_mid_down_latest")
	secondTarget := insertStripeUpgradePlan(t, 7252, 1, 10, 1000, "price_low_down_latest")
	contract, _, oldEntitlement := seedStripeUpgradeContract(t, 7150, currentPlan)

	originalExecutor := stripeSubscriptionDowngradeExecutor
	t.Cleanup(func() { stripeSubscriptionDowngradeExecutor = originalExecutor })
	stripeSubscriptionDowngradeExecutor = func(ctx context.Context, input StripeSubscriptionDowngradeInput) (*StripeSubscriptionDowngradeResult, error) {
		return &StripeSubscriptionDowngradeResult{
			Status:             model.SubscriptionChangeIntentStatusScheduled,
			ProviderScheduleID: "sched_latest",
			Snapshot: model.ProviderSubscriptionSnapshot{
				ProviderSubscriptionId:     input.ProviderSubscriptionID,
				ProviderSubscriptionItemId: input.ProviderSubscriptionItemID,
				ProviderPriceId:            input.CurrentPriceID,
				ProviderScheduleId:         "sched_latest",
				ProviderScheduleIdObserved: true,
				ProviderStatus:             "active",
				CurrentPeriodStart:         1000,
				CurrentPeriodEnd:           2000,
			},
		}, nil
	}

	first, err := ChangeSubscriptionPlan(ChangePlanCommand{UserID: 7150, PlanID: firstTarget.Id, PaymentMode: model.SubscriptionPaymentModeStripeRecurring, RequestID: "down-latest-1"})
	require.NoError(t, err)
	second, err := ChangeSubscriptionPlan(ChangePlanCommand{UserID: 7150, PlanID: secondTarget.Id, PaymentMode: model.SubscriptionPaymentModeStripeRecurring, RequestID: "down-latest-2"})
	require.NoError(t, err)

	require.Equal(t, ChangePlanStatusScheduled, second.Status)
	var oldIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&oldIntent, "id = ?", first.Intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, oldIntent.Status)
	require.Equal(t, second.Intent.Id, oldIntent.SupersededById)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, int64(2), reloadedContract.ChangeVersion)
	require.Equal(t, second.Intent.Id, reloadedContract.LatestChangeIntentId)
	require.Equal(t, secondTarget.Id, reloadedContract.PendingPlanId)
	require.Equal(t, int64(2000), reloadedContract.PendingEffectiveAt)
	require.Equal(t, currentPlan.Id, reloadedContract.CurrentPlanId)
	require.Equal(t, oldEntitlement.Id, reloadedContract.CurrentEntitlementId)
}

func TestStripeDowngradeScheduleUsesCurrentAndNextPhaseWithoutImmediateEntitlementChange(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7151, 0)
	currentPlan := insertStripeUpgradePlan(t, 7253, 3, 30, 3000, "price_current_down_schedule")
	targetPlan := insertStripeUpgradePlan(t, 7254, 1, 10, 1000, "price_target_down_schedule")
	contract, binding, oldEntitlement := seedStripeUpgradeContract(t, 7151, currentPlan)

	var createForm url.Values
	var updateForm url.Values
	getCalls := 0
	useStripeUpgradeTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/subscriptions/sub_upgrade":
			getCalls++
			if getCalls > 1 {
				_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","schedule":"sched_down_schedule","cancel_at_period_end":false,"current_period_start":1000,"current_period_end":2000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_current_down_schedule","object":"price"}}]}}`))
				return
			}
			_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","cancel_at_period_end":false,"current_period_start":1000,"current_period_end":2000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_current_down_schedule","object":"price"}}]}}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscription_schedules":
			require.NoError(t, r.ParseForm())
			createForm = r.PostForm
			_, _ = w.Write([]byte(`{"id":"sched_down_schedule","object":"subscription_schedule","status":"active","subscription":"sub_upgrade"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscription_schedules/sched_down_schedule":
			require.NoError(t, r.ParseForm())
			updateForm = r.PostForm
			_, _ = w.Write([]byte(`{"id":"sched_down_schedule","object":"subscription_schedule","status":"active","end_behavior":"release","subscription":"sub_upgrade","current_phase":{"start_date":1000,"end_date":2000},"phases":[{"start_date":1000,"end_date":2000,"items":[{"price":"price_current_down_schedule","quantity":1}]},{"start_date":2000,"end_date":4592000,"items":[{"price":"price_target_down_schedule","quantity":1}]}]}`))
		default:
			http.NotFound(w, r)
		}
	}))

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{UserID: 7151, PlanID: targetPlan.Id, PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod, RequestID: "down-schedule"})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusScheduled, result.Status)
	require.Equal(t, "sub_upgrade", createForm.Get("from_subscription"))
	require.Equal(t, "release", updateForm.Get("end_behavior"))
	require.Equal(t, "1000", updateForm.Get("phases[0][start_date]"))
	require.Equal(t, "2000", updateForm.Get("phases[0][end_date]"))
	require.Equal(t, "price_current_down_schedule", updateForm.Get("phases[0][items][0][price]"))
	require.Equal(t, "2000", updateForm.Get("phases[1][start_date]"))
	require.Equal(t, "2680400", updateForm.Get("phases[1][end_date]"))
	require.Equal(t, "price_target_down_schedule", updateForm.Get("phases[1][items][0][price]"))
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, currentPlan.Id, reloadedContract.CurrentPlanId)
	require.Equal(t, oldEntitlement.Id, reloadedContract.CurrentEntitlementId)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7151).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, "sched_down_schedule", reloadedBinding.ProviderScheduleId)
}

func TestStripeDowngradeStaleWriterConvergesScheduleToLatestVersion(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7152, 0)
	currentPlan := insertStripeUpgradePlan(t, 7255, 3, 30, 3000, "price_current_down_stale")
	oldTarget := insertStripeUpgradePlan(t, 7256, 2, 20, 2000, "price_old_down_stale")
	latestTarget := insertStripeUpgradePlan(t, 7257, 1, 10, 1000, "price_latest_down_stale")
	contract, binding, _ := seedStripeUpgradeContract(t, 7152, currentPlan)
	oldIntent := &model.SubscriptionChangeIntent{ContractId: contract.Id, UserId: 7152, RequestId: "old-stale", ChangeVersion: 1, Kind: model.SubscriptionChangeIntentKindDowngrade, PaymentMode: model.SubscriptionPaymentModeStripeRecurring, Status: model.SubscriptionChangeIntentStatusSyncing, FromPlanId: currentPlan.Id, ToPlanId: oldTarget.Id, ProviderBindingId: binding.Id, EffectiveAt: 2000, ProviderIdempotencyKey: stripeSubscriptionDowngradeIntentIdempotencyKey(contract.Id, 1, oldTarget.Id, 1)}
	require.NoError(t, model.DB.Create(oldIntent).Error)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{"latest_change_intent_id": oldIntent.Id, "pending_plan_id": oldTarget.Id, "pending_effective_at": int64(2000), "change_version": int64(1)}).Error)
	var latestIntent *model.SubscriptionChangeIntent
	originalHook := stripeSubscriptionDowngradeAfterLatestRead
	t.Cleanup(func() { stripeSubscriptionDowngradeAfterLatestRead = originalHook })
	hookCalled := false
	stripeSubscriptionDowngradeAfterLatestRead = func() {
		if hookCalled {
			return
		}
		hookCalled = true
		latestIntent = &model.SubscriptionChangeIntent{ContractId: contract.Id, UserId: 7152, RequestId: "latest-stale", ChangeVersion: 2, Kind: model.SubscriptionChangeIntentKindDowngrade, PaymentMode: model.SubscriptionPaymentModeStripeRecurring, Status: model.SubscriptionChangeIntentStatusSyncing, FromPlanId: currentPlan.Id, ToPlanId: latestTarget.Id, ProviderBindingId: binding.Id, EffectiveAt: 2000, ProviderIdempotencyKey: stripeSubscriptionDowngradeIntentIdempotencyKey(contract.Id, 2, latestTarget.Id, 2)}
		require.NoError(t, model.DB.Create(latestIntent).Error)
		require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{"latest_change_intent_id": latestIntent.Id, "pending_plan_id": latestTarget.Id, "pending_effective_at": int64(2000), "change_version": int64(2)}).Error)
	}

	var updateForm url.Values
	getCalls := 0
	useStripeUpgradeTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/subscriptions/sub_upgrade":
			getCalls++
			if getCalls > 1 {
				_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","schedule":"sched_down_stale","cancel_at_period_end":false,"current_period_start":1000,"current_period_end":2000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_current_down_stale","object":"price"}}]}}`))
				return
			}
			_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","cancel_at_period_end":false,"current_period_start":1000,"current_period_end":2000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_current_down_stale","object":"price"}}]}}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscription_schedules":
			_, _ = w.Write([]byte(`{"id":"sched_down_stale","object":"subscription_schedule","status":"active","subscription":"sub_upgrade"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscription_schedules/sched_down_stale":
			require.NoError(t, r.ParseForm())
			updateForm = r.PostForm
			_, _ = w.Write([]byte(`{"id":"sched_down_stale","object":"subscription_schedule","status":"active","end_behavior":"release","subscription":"sub_upgrade"}`))
		default:
			http.NotFound(w, r)
		}
	}))

	result, err := executeStripeSubscriptionDowngrade(context.Background(), StripeSubscriptionDowngradeInput{ContractID: contract.Id, ChangeIntentID: oldIntent.Id, ChangeVersion: 1, CurrentPlanID: currentPlan.Id, TargetPlanID: oldTarget.Id, CurrentPriceID: currentPlan.StripePriceId, TargetPriceID: oldTarget.StripePriceId, ProviderSubscriptionID: binding.ProviderSubscriptionId, ProviderSubscriptionItemID: binding.ProviderSubscriptionItemId, CurrentPeriodStart: 1000, CurrentPeriodEnd: 2000, IdempotencyKey: oldIntent.ProviderIdempotencyKey})

	require.NoError(t, err)
	require.True(t, hookCalled)
	require.NotNil(t, latestIntent)
	require.Equal(t, latestIntent.Id, result.ChangeIntentID)
	require.Equal(t, "price_latest_down_stale", updateForm.Get("phases[1][items][0][price]"))
}

func TestStripeDowngradeSameRequestReplayDoesNotCreateAnotherSchedule(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7153, 0)
	currentPlan := insertStripeUpgradePlan(t, 7258, 3, 30, 3000, "price_current_down_replay")
	targetPlan := insertStripeUpgradePlan(t, 7259, 1, 10, 1000, "price_target_down_replay")
	_, _, _ = seedStripeUpgradeContract(t, 7153, currentPlan)
	originalExecutor := stripeSubscriptionDowngradeExecutor
	t.Cleanup(func() { stripeSubscriptionDowngradeExecutor = originalExecutor })
	calls := 0
	stripeSubscriptionDowngradeExecutor = func(ctx context.Context, input StripeSubscriptionDowngradeInput) (*StripeSubscriptionDowngradeResult, error) {
		calls++
		return &StripeSubscriptionDowngradeResult{Status: model.SubscriptionChangeIntentStatusScheduled, ProviderScheduleID: "sched_down_replay", Snapshot: model.ProviderSubscriptionSnapshot{ProviderSubscriptionId: input.ProviderSubscriptionID, ProviderSubscriptionItemId: input.ProviderSubscriptionItemID, ProviderPriceId: input.CurrentPriceID, ProviderScheduleId: "sched_down_replay", ProviderScheduleIdObserved: true, ProviderStatus: "active", CurrentPeriodStart: 1000, CurrentPeriodEnd: 2000}}, nil
	}

	first, err := ChangeSubscriptionPlan(ChangePlanCommand{UserID: 7153, PlanID: targetPlan.Id, PaymentMode: model.SubscriptionPaymentModeStripeRecurring, RequestID: "down-replay"})
	require.NoError(t, err)
	second, err := ChangeSubscriptionPlan(ChangePlanCommand{UserID: 7153, PlanID: targetPlan.Id, PaymentMode: model.SubscriptionPaymentModeStripeRecurring, RequestID: "down-replay"})
	require.NoError(t, err)

	require.Equal(t, first.Intent.Id, second.Intent.Id)
	require.Equal(t, 1, calls)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 7153).Count(&intentCount).Error)
	require.Equal(t, int64(1), intentCount)
}

func TestStripeDowngradeSyncingReplayReusesRemoteScheduleWhenLocalPersistWasLost(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7157, 0)
	currentPlan := insertStripeUpgradePlan(t, 7276, 3, 30, 3000, "price_current_down_remote_replay")
	targetPlan := insertStripeUpgradePlan(t, 7277, 1, 10, 1000, "price_target_down_remote_replay")
	contract, binding, _ := seedStripeUpgradeContract(t, 7157, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7157,
		RequestId:              "down-remote-replay",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusSyncing,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		EffectiveAt:            2000,
		ProviderIdempotencyKey: stripeSubscriptionDowngradeIntentIdempotencyKey(contract.Id, 1, targetPlan.Id, 1),
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{"latest_change_intent_id": intent.Id, "pending_plan_id": targetPlan.Id, "pending_effective_at": int64(2000), "change_version": int64(1)}).Error)

	createCalls := 0
	updateCalls := 0
	useStripeUpgradeTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/subscriptions/sub_upgrade":
			_, _ = w.Write([]byte(`{"id":"sub_upgrade","object":"subscription","status":"active","schedule":"sched_existing_remote","cancel_at_period_end":false,"current_period_start":1000,"current_period_end":2000,"customer":"cus_upgrade","items":{"object":"list","data":[{"id":"si_current_item","object":"subscription_item","price":{"id":"price_current_down_remote_replay","object":"price"}}]}}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscription_schedules":
			createCalls++
			_, _ = w.Write([]byte(`{"id":"sched_duplicate","object":"subscription_schedule","status":"active","subscription":"sub_upgrade"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscription_schedules/sched_existing_remote":
			updateCalls++
			_, _ = w.Write([]byte(`{"id":"sched_existing_remote","object":"subscription_schedule","status":"active","end_behavior":"release","subscription":"sub_upgrade"}`))
		default:
			http.NotFound(w, r)
		}
	}))

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{UserID: 7157, PlanID: targetPlan.Id, PaymentMode: model.SubscriptionPaymentModeStripeRecurring, RequestID: "down-remote-replay"})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusScheduled, result.Status)
	require.Zero(t, createCalls)
	require.Equal(t, 1, updateCalls)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, "sched_existing_remote", reloadedBinding.ProviderScheduleId)
	var reloadedIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&reloadedIntent, "id = ?", intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusScheduled, reloadedIntent.Status)
	require.Equal(t, "sched_existing_remote", reloadedIntent.ProviderScheduleId)
}

func TestStripeDowngradeRejectsInvalidSourcesBeforeStripeSideEffects(t *testing.T) {
	testCases := []struct {
		name   string
		mutate func(*model.UserSubscriptionContract, *model.SubscriptionProviderBinding)
	}{
		{name: "balance current", mutate: func(c *model.UserSubscriptionContract, b *model.SubscriptionProviderBinding) {
			c.PaymentMode = model.SubscriptionPaymentModeBalanceOnePeriod
			c.CurrentProviderBindingId = 0
		}},
		{name: "non recurring binding", mutate: func(c *model.UserSubscriptionContract, b *model.SubscriptionProviderBinding) {
			b.ProviderStatus = "canceled"
		}},
		{name: "grace contract", mutate: func(c *model.UserSubscriptionContract, b *model.SubscriptionProviderBinding) {
			c.Status = model.SubscriptionContractStatusGrace
		}},
	}
	for index, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionContractServiceTestDB(t)
			insertContractServiceUser(t, 7160+index, 0)
			currentPlan := insertStripeUpgradePlan(t, 7260+index*10, 3, 30, 3000, "price_current_down_reject")
			targetPlan := insertStripeUpgradePlan(t, 7261+index*10, 1, 10, 1000, "price_target_down_reject")
			contract, binding, _ := seedStripeUpgradeContract(t, 7160+index, currentPlan)
			tc.mutate(contract, binding)
			require.NoError(t, model.DB.Save(contract).Error)
			require.NoError(t, model.DB.Save(binding).Error)
			originalExecutor := stripeSubscriptionDowngradeExecutor
			t.Cleanup(func() { stripeSubscriptionDowngradeExecutor = originalExecutor })
			calls := 0
			stripeSubscriptionDowngradeExecutor = func(ctx context.Context, input StripeSubscriptionDowngradeInput) (*StripeSubscriptionDowngradeResult, error) {
				calls++
				return nil, errors.New("must not call Stripe")
			}

			_, err := ChangeSubscriptionPlan(ChangePlanCommand{UserID: 7160 + index, PlanID: targetPlan.Id, PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod, RequestID: "down-reject-" + tc.name})

			require.Error(t, err)
			require.Zero(t, calls)
			var orderCount int64
			require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 7160+index).Count(&orderCount).Error)
			require.Zero(t, orderCount)
		})
	}
}

func TestStripeDowngradeDoesNotSwitchEntitlementBeforePaidTargetInvoice(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7154, 0)
	currentPlan := insertStripeUpgradePlan(t, 7270, 3, 30, 3000, "price_current_down_unpaid")
	targetPlan := insertStripeUpgradePlan(t, 7271, 1, 10, 1000, "price_target_down_unpaid")
	contract, _, oldEntitlement := seedStripeUpgradeContract(t, 7154, currentPlan)
	originalExecutor := stripeSubscriptionDowngradeExecutor
	t.Cleanup(func() { stripeSubscriptionDowngradeExecutor = originalExecutor })
	stripeSubscriptionDowngradeExecutor = func(ctx context.Context, input StripeSubscriptionDowngradeInput) (*StripeSubscriptionDowngradeResult, error) {
		return &StripeSubscriptionDowngradeResult{Status: model.SubscriptionChangeIntentStatusScheduled, ProviderScheduleID: "sched_down_unpaid", Snapshot: model.ProviderSubscriptionSnapshot{ProviderSubscriptionId: input.ProviderSubscriptionID, ProviderSubscriptionItemId: input.ProviderSubscriptionItemID, ProviderPriceId: input.CurrentPriceID, ProviderScheduleId: "sched_down_unpaid", ProviderScheduleIdObserved: true, ProviderStatus: "active", CurrentPeriodStart: 1000, CurrentPeriodEnd: 2000}}, nil
	}

	result, err := ChangeSubscriptionPlan(ChangePlanCommand{UserID: 7154, PlanID: targetPlan.Id, PaymentMode: model.SubscriptionPaymentModeStripeRecurring, RequestID: "down-unpaid"})

	require.NoError(t, err)
	require.Equal(t, ChangePlanStatusScheduled, result.Status)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, currentPlan.Id, reloadedContract.CurrentPlanId)
	require.Equal(t, oldEntitlement.Id, reloadedContract.CurrentEntitlementId)
	var entitlement model.UserSubscription
	require.NoError(t, model.DB.First(&entitlement, "id = ?", oldEntitlement.Id).Error)
	require.Equal(t, currentPlan.Id, entitlement.PlanId)
	require.Equal(t, int64(77), entitlement.AmountUsed)
	require.NotNil(t, entitlement.CurrentSlot)
}

func TestStripeDowngradePaidTargetInvoiceSwitchesPlanAndClearsPending(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7155, 0)
	currentPlan := insertStripeUpgradePlan(t, 7272, 3, 30, 3000, "price_current_down_paid")
	targetPlan := insertStripeUpgradePlan(t, 7273, 1, 10, 1000, "price_target_down_paid")
	contract, binding, oldEntitlement := seedStripeUpgradeContract(t, 7155, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:        contract.Id,
		UserId:            7155,
		RequestId:         "down-paid",
		ChangeVersion:     1,
		Kind:              model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		Status:            model.SubscriptionChangeIntentStatusScheduled,
		FromPlanId:        currentPlan.Id,
		ToPlanId:          targetPlan.Id,
		ProviderBindingId: binding.Id,
		EffectiveAt:       oldEntitlement.EndTime,
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{"latest_change_intent_id": intent.Id, "pending_plan_id": targetPlan.Id, "pending_effective_at": oldEntitlement.EndTime}).Error)
	invoice := stripeInvoiceFixture("in_down_paid", binding.ProviderSubscriptionId)
	invoice.AmountPaid = 1000
	invoice.AmountDue = 1000
	invoice.Total = 1000
	invoice.Customer = &stripe.Customer{ID: "cus_upgrade"}
	setStripeInvoiceLinePrice(invoice.Lines.Data[0], "price_target_down_paid")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: oldEntitlement.EndTime, End: oldEntitlement.EndTime + 2592000}
	subscription := stripeSubscriptionFixture(binding.ProviderSubscriptionId, map[string]string{})
	subscription.Customer = &stripe.Customer{ID: "cus_upgrade"}
	subscription.Items.Data[0].ID = binding.ProviderSubscriptionItemId
	subscription.Items.Data[0].Price = &stripe.Price{ID: "price_target_down_paid"}
	setStripeSubscriptionCurrentPeriod(subscription, oldEntitlement.EndTime, oldEntitlement.EndTime + 2592000)
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	result, err := ReconcilePaidInvoice(context.Background(), "in_down_paid")

	require.NoError(t, err)
	require.True(t, result.Applied)
	require.NotNil(t, result.Entitlement)
	require.Equal(t, targetPlan.Id, result.Entitlement.PlanId)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, targetPlan.Id, reloadedContract.CurrentPlanId)
	require.Equal(t, result.Entitlement.Id, reloadedContract.CurrentEntitlementId)
	require.Zero(t, reloadedContract.PendingPlanId)
	require.Zero(t, reloadedContract.PendingEffectiveAt)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, targetPlan.Id, reloadedBinding.PlanId)
	require.Equal(t, targetPlan.StripePriceId, reloadedBinding.ProviderPriceId)
	var reloadedIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&reloadedIntent, "id = ?", intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusApplied, reloadedIntent.Status)
	require.Equal(t, "in_down_paid", reloadedIntent.ProviderInvoiceId)
}

func TestStripeDowngradeFailedTargetInvoiceKeepsCurrentPlanAndPending(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7156, 0)
	currentPlan := insertStripeUpgradePlan(t, 7274, 3, 30, 3000, "price_current_down_failed")
	targetPlan := insertStripeUpgradePlan(t, 7275, 1, 10, 1000, "price_target_down_failed")
	contract, binding, oldEntitlement := seedStripeUpgradeContract(t, 7156, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:        contract.Id,
		UserId:            7156,
		RequestId:         "down-failed",
		ChangeVersion:     1,
		Kind:              model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		Status:            model.SubscriptionChangeIntentStatusScheduled,
		FromPlanId:        currentPlan.Id,
		ToPlanId:          targetPlan.Id,
		ProviderBindingId: binding.Id,
		EffectiveAt:       oldEntitlement.EndTime,
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{"latest_change_intent_id": intent.Id, "pending_plan_id": targetPlan.Id, "pending_effective_at": oldEntitlement.EndTime}).Error)
	invoice := stripeInvoiceFixture("in_down_failed", binding.ProviderSubscriptionId)
	markStripeInvoiceUnpaid(invoice)
	invoice.Status = stripe.InvoiceStatusOpen
	invoice.AmountPaid = 0
	invoice.AmountDue = 1000
	invoice.Total = 1000
	invoice.Customer = &stripe.Customer{ID: "cus_upgrade"}
	setStripeInvoiceLinePrice(invoice.Lines.Data[0], "price_target_down_failed")
	invoice.Lines.Data[0].Period = &stripe.Period{Start: oldEntitlement.EndTime, End: oldEntitlement.EndTime + 2592000}
	subscription := stripeSubscriptionFixture(binding.ProviderSubscriptionId, map[string]string{})
	subscription.Customer = &stripe.Customer{ID: "cus_upgrade"}
	subscription.Items.Data[0].ID = binding.ProviderSubscriptionItemId
	subscription.Items.Data[0].Price = &stripe.Price{ID: "price_target_down_failed"}
	setStripeSubscriptionCurrentPeriod(subscription, oldEntitlement.EndTime, oldEntitlement.EndTime + 2592000)
	restore := replaceStripeInvoiceReconcilers(t, invoice, subscription)
	defer restore()

	err := ReconcileFailedInvoice(context.Background(), "in_down_failed")

	require.NoError(t, err)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusGrace, reloadedContract.Status)
	require.Equal(t, currentPlan.Id, reloadedContract.CurrentPlanId)
	require.Equal(t, targetPlan.Id, reloadedContract.PendingPlanId)
	require.Equal(t, oldEntitlement.EndTime, reloadedContract.PendingEffectiveAt)
	var reloadedEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&reloadedEntitlement, "id = ?", oldEntitlement.Id).Error)
	require.Equal(t, currentPlan.Id, reloadedEntitlement.PlanId)
	require.Equal(t, oldEntitlement.EndTime+int64((72*time.Hour).Seconds()), reloadedEntitlement.AccessEndTime)
	require.Equal(t, int64(77), reloadedEntitlement.AmountUsed)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, currentPlan.Id, reloadedBinding.PlanId)
	require.Equal(t, currentPlan.StripePriceId, reloadedBinding.ProviderPriceId)
}

func TestStripeDowngradeReconciliationConvergesPendingScheduleWithoutChangingEntitlement(t *testing.T) {
	setupSubscriptionContractServiceTestDB(t)
	insertContractServiceUser(t, 7158, 0)
	currentPlan := insertStripeUpgradePlan(t, 7278, 3, 30, 3000, "price_current_down_reconcile")
	targetPlan := insertStripeUpgradePlan(t, 7279, 1, 10, 1000, "price_target_down_reconcile")
	contract, binding, oldEntitlement := seedStripeUpgradeContract(t, 7158, currentPlan)
	intent := &model.SubscriptionChangeIntent{
		ContractId:             contract.Id,
		UserId:                 7158,
		RequestId:              "down-reconcile",
		ChangeVersion:          1,
		Kind:                   model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:            model.SubscriptionPaymentModeStripeRecurring,
		Status:                 model.SubscriptionChangeIntentStatusScheduled,
		FromPlanId:             currentPlan.Id,
		ToPlanId:               targetPlan.Id,
		ProviderBindingId:      binding.Id,
		EffectiveAt:            2000,
		ProviderIdempotencyKey: stripeSubscriptionDowngradeIntentIdempotencyKey(contract.Id, 1, targetPlan.Id, 1),
	}
	require.NoError(t, model.DB.Create(intent).Error)
	require.NoError(t, model.DB.Model(contract).Updates(map[string]interface{}{"latest_change_intent_id": intent.Id, "pending_plan_id": targetPlan.Id, "pending_effective_at": int64(2000), "change_version": int64(1)}).Error)
	originalIsMaster := common.IsMasterNode
	originalExecutor := stripeSubscriptionDowngradeExecutor
	originalSnapshot := stripeSubscriptionSnapshotForReconciliation
	t.Cleanup(func() {
		common.IsMasterNode = originalIsMaster
		stripeSubscriptionDowngradeExecutor = originalExecutor
		stripeSubscriptionSnapshotForReconciliation = originalSnapshot
	})
	common.IsMasterNode = true
	calls := 0
	stripeSubscriptionDowngradeExecutor = func(ctx context.Context, input StripeSubscriptionDowngradeInput) (*StripeSubscriptionDowngradeResult, error) {
		calls++
		require.Equal(t, intent.Id, input.ChangeIntentID)
		require.Equal(t, targetPlan.Id, input.TargetPlanID)
		return &StripeSubscriptionDowngradeResult{Status: model.SubscriptionChangeIntentStatusScheduled, ChangeIntentID: intent.Id, ProviderScheduleID: "sched_down_reconcile", Snapshot: model.ProviderSubscriptionSnapshot{ProviderSubscriptionId: binding.ProviderSubscriptionId, ProviderSubscriptionItemId: binding.ProviderSubscriptionItemId, ProviderPriceId: currentPlan.StripePriceId, ProviderScheduleId: "sched_down_reconcile", ProviderScheduleIdObserved: true, ProviderStatus: "active", CurrentPeriodStart: 1000, CurrentPeriodEnd: 2000}}, nil
	}
	stripeSubscriptionSnapshotForReconciliation = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{ProviderSubscriptionId: providerSubscriptionID, ProviderStatus: "active", ProviderScheduleId: "sched_down_reconcile", ProviderScheduleIdObserved: true}, nil
	}

	count, err := RunStripeSubscriptionReconciliationOnce()

	require.NoError(t, err)
	require.GreaterOrEqual(t, count, 1)
	require.Equal(t, 1, calls)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, currentPlan.Id, reloadedContract.CurrentPlanId)
	require.Equal(t, oldEntitlement.Id, reloadedContract.CurrentEntitlementId)
	require.Equal(t, targetPlan.Id, reloadedContract.PendingPlanId)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, "sched_down_reconcile", reloadedBinding.ProviderScheduleId)
}
