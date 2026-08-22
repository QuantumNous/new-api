package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionSelfOpenAPIUsesSelfSpecificSchemas(t *testing.T) {
	body, err := os.ReadFile("../docs/openapi/api.json")
	require.NoError(t, err)

	var spec map[string]any
	require.NoError(t, common.Unmarshal(body, &spec))

	paths := spec["paths"].(map[string]any)
	require.Contains(t, paths, "/api/subscription/self/renewal/cancel")
	require.Contains(t, paths, "/api/subscription/self/renewal/resume")
	require.NotContains(t, paths, "/api/subscription/self/recurring/{binding_id}/cancel")
	require.NotContains(t, paths, "/api/subscription/self/recurring/{binding_id}/resume")

	components := spec["components"].(map[string]any)
	schemas := components["schemas"].(map[string]any)
	selfSubscription := schemas["SubscriptionSelfResponse"].(map[string]any)
	selfProperties := selfSubscription["properties"].(map[string]any)
	recurringSubscriptions := selfProperties["recurring_subscriptions"].(map[string]any)
	recurringItems := recurringSubscriptions["items"].(map[string]any)
	require.Equal(
		t,
		"#/components/schemas/SubscriptionSelfRecurringSubscription",
		recurringItems["$ref"],
	)

	selfRecurring := schemas["SubscriptionSelfRecurringSubscription"].(map[string]any)
	selfRecurringProperties := selfRecurring["properties"].(map[string]any)
	for _, key := range []string{"binding_id", "provider", "provider_status", "can_cancel", "can_resume"} {
		require.NotContains(t, selfRecurringProperties, key)
	}
	require.ElementsMatch(t, []any{
		"plan_id",
		"cancel_at_period_end",
		"current_period_start",
		"current_period_end",
		"grace_period_end",
		"requires_support",
	}, selfRecurring["required"])

	changePlan := schemas["ChangeSubscriptionPlanResponse"].(map[string]any)
	changePlanProperties := changePlan["properties"].(map[string]any)
	changePlanData := changePlanProperties["data"].(map[string]any)
	changePlanDataProperties := changePlanData["properties"].(map[string]any)
	require.Equal(t, "#/components/schemas/SubscriptionSelfContract", changePlanDataProperties["contract"].(map[string]any)["$ref"])
	require.Equal(t, "#/components/schemas/SubscriptionSelfPendingChange", changePlanDataProperties["intent"].(map[string]any)["$ref"])
}

func TestGetSubscriptionSelfReturnsCanonicalContractWithoutProviderIDs(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 910)
	currentRank := 10
	pendingRank := 5
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:               9910,
		Title:            "Current",
		PriceAmount:      20,
		Currency:         "USD",
		DurationUnit:     model.SubscriptionDurationMonth,
		DurationValue:    1,
		Enabled:          true,
		TierRank:         &currentRank,
		TotalAmount:      2000,
		AllowBalancePay:  common.GetPointer(true),
		QuotaResetPeriod: model.SubscriptionResetMonthly,
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:               9911,
		Title:            "Pending",
		PriceAmount:      10,
		Currency:         "USD",
		DurationUnit:     model.SubscriptionDurationMonth,
		DurationValue:    1,
		Enabled:          true,
		TierRank:         &pendingRank,
		TotalAmount:      1000,
		AllowBalancePay:  common.GetPointer(true),
		QuotaResetPeriod: model.SubscriptionResetMonthly,
	}).Error)
	now := common.GetTimestamp()
	binding := model.SubscriptionProviderBinding{
		UserId:                     910,
		PlanId:                     9910,
		Provider:                   model.PaymentProviderStripe,
		ProviderSubscriptionId:     "sub_should_not_leak",
		ProviderSubscriptionItemId: "si_should_not_leak",
		ProviderCustomerId:         "cus_should_not_leak",
		ProviderPriceId:            "price_should_not_leak",
		ProviderLatestInvoiceId:    "in_should_not_leak",
		ProviderStatus:             "active",
		CancelAtPeriodEnd:          true,
		CurrentPeriodStart:         now - 100,
		CurrentPeriodEnd:           now + 3600,
	}
	require.NoError(t, model.DB.Create(&binding).Error)
	contract := model.UserSubscriptionContract{
		UserId:                   910,
		Status:                   model.SubscriptionContractStatusGrace,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            9910,
		CurrentProviderBindingId: binding.Id,
		LatestChangeIntentId:     777,
		PendingPlanId:            9911,
		PendingEffectiveAt:       now + 3600,
		CurrentPeriodStart:       now - 100,
		CurrentPeriodEnd:         now + 3600,
		GracePeriodEnd:           now + 7200,
		ChangeVersion:            4,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("contract_id", contract.Id).Error)
	entitlement := model.UserSubscription{
		UserId:            910,
		PlanId:            9910,
		ContractId:        contract.Id,
		ProviderBindingId: binding.Id,
		AmountTotal:       2000,
		AmountUsed:        400,
		StartTime:         now - 100,
		EndTime:           now + 3600,
		AccessEndTime:     now + 7200,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
	}
	require.NoError(t, model.DB.Create(&entitlement).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("current_entitlement_id", entitlement.Id).Error)
	intent := model.SubscriptionChangeIntent{
		Id:                777,
		ContractId:        contract.Id,
		UserId:            910,
		RequestId:         "550e8400-e29b-41d4-a716-446655440010",
		ChangeVersion:     4,
		Kind:              model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		Status:            model.SubscriptionChangeIntentStatusScheduled,
		FromPlanId:        9910,
		ToPlanId:          9911,
		ProviderBindingId: binding.Id,
		EffectiveAt:       now + 3600,
	}
	require.NoError(t, model.DB.Create(&intent).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 910)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/self", nil)

	GetSubscriptionSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := recorder.Body.String()
	require.NotContains(t, body, "sub_should_not_leak")
	require.NotContains(t, body, "cus_should_not_leak")
	require.NotContains(t, body, "price_should_not_leak")
	require.NotContains(t, body, "si_should_not_leak")
	require.NotContains(t, body, "in_should_not_leak")

	var envelope map[string]any
	require.NoError(t, common.Unmarshal([]byte(body), &envelope))
	data := envelope["data"].(map[string]any)
	require.Contains(t, data, "contract")
	require.Contains(t, data, "current_entitlement")
	require.Contains(t, data, "current_period")
	require.Contains(t, data, "quota")
	require.Contains(t, data, "pending_change")
	require.Contains(t, data, "capabilities")
	require.Contains(t, data, "migration")
	require.Contains(t, data, "subscriptions")
	require.Contains(t, data, "all_subscriptions")
	require.Contains(t, data, "recurring_subscriptions")

	contractDTO := data["contract"].(map[string]any)
	require.Equal(t, float64(contract.Id), contractDTO["contract_id"])
	require.Equal(t, "grace", contractDTO["status"])
	require.Equal(t, "stripe_recurring", contractDTO["payment_mode"])
	require.Equal(t, float64(9910), contractDTO["current_plan_id"])
	require.NotContains(t, contractDTO, "current_provider_binding_id")
	require.NotContains(t, contractDTO, "provider_subscription_id")

	quota := data["quota"].(map[string]any)
	require.Equal(t, float64(2000), quota["amount_total"])
	require.Equal(t, float64(400), quota["amount_used"])
	require.Equal(t, float64(1600), quota["amount_remaining"])

	pending := data["pending_change"].(map[string]any)
	require.Equal(t, float64(777), pending["intent_id"])
	require.Equal(t, "downgrade", pending["kind"])
	require.Equal(t, "scheduled", pending["status"])
	require.Equal(t, float64(9911), pending["to_plan_id"])
	require.NotContains(t, pending, "provider_binding_id")
	require.NotContains(t, pending, "provider_schedule_id")

	capabilities := data["capabilities"].(map[string]any)
	require.Equal(t, false, capabilities["can_resume"])
	require.Equal(t, false, capabilities["can_cancel"])
	require.Equal(t, false, capabilities["can_change_plan"])
	require.Equal(t, true, capabilities["has_pending_intent"])
	require.Equal(t, false, capabilities["is_cancel_at_period_end"])
	require.Equal(t, false, capabilities["can_use_balance_one_period"])

	migration := data["migration"].(map[string]any)
	require.Equal(t, false, migration["requires_admin_review"])
}

func TestGetSubscriptionSelfReturnsProviderNeutralRecurringReviewShape(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 918)
	insertSubscriptionControllerPlan(t, 9932)
	insertSubscriptionControllerPlan(t, 9933)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).
		Where("id = ?", 9932).
		Updates(map[string]any{
			"stripe_price_id":          "price_self_plan_should_not_leak",
			"creem_product_id":         "prod_self_plan_should_not_leak",
			"waffo_pancake_product_id": "waffo_self_plan_should_not_leak",
		}).Error)
	now := common.GetTimestamp()
	binding := model.SubscriptionProviderBinding{
		UserId:                 918,
		PlanId:                 9932,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: "sub_self_shape_should_not_leak",
		ProviderCustomerId:     "cus_self_shape_should_not_leak",
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      true,
		CurrentPeriodStart:     now - 60,
		CurrentPeriodEnd:       now + 3600,
	}
	require.NoError(t, model.DB.Create(&binding).Error)
	contract := model.UserSubscriptionContract{
		UserId:                   918,
		Status:                   model.SubscriptionContractStatusActive,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            9932,
		CurrentProviderBindingId: binding.Id,
		PendingPlanId:            9933,
		PendingEffectiveAt:       now + 3600,
		CurrentPeriodStart:       now - 60,
		CurrentPeriodEnd:         now + 3600,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("contract_id", contract.Id).Error)
	grantKey := "grant_self_should_not_leak"
	currentSlot := 1
	entitlement := model.UserSubscription{
		UserId:            918,
		PlanId:            9932,
		ContractId:        contract.Id,
		ProviderBindingId: binding.Id,
		GrantKey:          &grantKey,
		CurrentSlot:       &currentSlot,
		AmountTotal:       1000,
		StartTime:         now - 60,
		EndTime:           now + 3600,
		AccessEndTime:     now + 3600,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
	}
	require.NoError(t, model.DB.Create(&entitlement).Error)
	intent := model.SubscriptionChangeIntent{
		ContractId:        contract.Id,
		UserId:            918,
		RequestId:         "550e8400-e29b-41d4-a716-446655440018",
		Kind:              model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		Status:            model.SubscriptionChangeIntentStatusScheduled,
		FromPlanId:        9932,
		ToPlanId:          9933,
		ProviderBindingId: binding.Id,
		EffectiveAt:       now + 3600,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Updates(map[string]any{"current_entitlement_id": entitlement.Id, "latest_change_intent_id": intent.Id}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 918)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/self", nil)

	GetSubscriptionSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	data := envelope["data"].(map[string]any)
	require.Equal(t, model.SubscriptionRenewalSourceProvider, data["renewal_source"])
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, data["renewal_status"])

	contractDTO := data["contract"].(map[string]any)
	require.NotContains(t, contractDTO, "current_provider_binding_id")
	entitlementDTO := data["current_entitlement"].(map[string]any)
	require.NotContains(t, entitlementDTO, "provider_binding_id")
	pendingDTO := data["pending_change"].(map[string]any)
	require.NotContains(t, pendingDTO, "provider_binding_id")
	capabilities := data["capabilities"].(map[string]any)
	require.Equal(t, false, capabilities["can_cancel"])
	require.Equal(t, false, capabilities["can_resume"])

	recurring := data["recurring_subscriptions"].([]any)
	require.Len(t, recurring, 1)
	recurringDTO := recurring[0].(map[string]any)
	for _, key := range []string{"binding_id", "provider", "provider_status", "can_cancel", "can_resume"} {
		require.NotContains(t, recurringDTO, key)
	}
	require.Equal(t, true, recurringDTO["cancel_at_period_end"])

	current := data["current_subscription"].(map[string]any)
	currentSubscription := current["subscription"].(map[string]any)
	require.NotContains(t, currentSubscription, "provider_binding_id")
	require.NotContains(t, currentSubscription, "grant_key")
	currentPlan := current["plan"].(map[string]any)
	for _, key := range []string{"stripe_price_id", "creem_product_id", "waffo_pancake_product_id"} {
		require.NotContains(t, currentPlan, key)
	}
	for _, key := range []string{"subscriptions", "all_subscriptions"} {
		summaries := data[key].([]any)
		require.NotEmpty(t, summaries)
		summary := summaries[0].(map[string]any)
		require.NotContains(t, summary, "provider_binding")
		subscription := summary["subscription"].(map[string]any)
		require.NotContains(t, subscription, "provider_binding_id")
		require.NotContains(t, subscription, "grant_key")
	}
}

func TestGetSubscriptionSelfFallsBackRecurringRenewalForLegacyBindingWithoutContract(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 919)
	insertSubscriptionControllerPlan(t, 9934)
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Create(&model.SubscriptionProviderBinding{
		UserId:                 919,
		PlanId:                 9934,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: "sub_self_no_contract",
		ProviderStatus:         "active",
		CurrentPeriodStart:     now - 60,
		CurrentPeriodEnd:       now + 3600,
	}).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId:        919,
		PlanId:        9934,
		AmountTotal:   1000,
		StartTime:     now - 60,
		EndTime:       now + 3600,
		AccessEndTime: now + 3600,
		Status:        model.SubscriptionEntitlementStatusActive,
		PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 919)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/self", nil)

	GetSubscriptionSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	data := envelope["data"].(map[string]any)
	require.Equal(t, model.SubscriptionRenewalSourceProvider, data["renewal_source"])
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, data["renewal_status"])
}

func TestSubscriptionSelfRenewalStateDoesNotEnableTerminalRecurringState(t *testing.T) {
	now := common.GetTimestamp()
	activeContract := model.UserSubscriptionContract{
		Id:                       1,
		Status:                   model.SubscriptionContractStatusActive,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            9935,
		CurrentEntitlementId:     2,
		CurrentProviderBindingId: 3,
		CurrentPeriodEnd:         now + 3600,
	}
	activeEntitlement := model.UserSubscription{
		Id:                2,
		PlanId:            9935,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		ProviderBindingId: 3,
		EndTime:           now + 3600,
		AccessEndTime:     now + 3600,
	}
	activeBinding := RecurringSubscriptionDTO{
		BindingId:        3,
		Provider:         model.PaymentProviderStripe,
		PlanId:           9935,
		ProviderStatus:   "active",
		CurrentPeriodEnd: now + 3600,
	}

	testCases := []struct {
		name        string
		contract    *model.UserSubscriptionContract
		entitlement *model.UserSubscription
		bindings    []RecurringSubscriptionDTO
	}{
		{
			name: "ended contract with stored enabled pair",
			contract: func() *model.UserSubscriptionContract {
				contract := activeContract
				contract.Status = model.SubscriptionContractStatusEnded
				contract.RenewalSource = model.SubscriptionRenewalSourceProvider
				contract.RenewalStatus = model.SubscriptionRenewalStatusEnabled
				return &contract
			}(),
			entitlement: &activeEntitlement,
			bindings:    []RecurringSubscriptionDTO{activeBinding},
		},
		{
			name:     "expired entitlement",
			contract: &activeContract,
			entitlement: func() *model.UserSubscription {
				entitlement := activeEntitlement
				entitlement.EndTime = now - 1
				entitlement.AccessEndTime = now - 1
				return &entitlement
			}(),
			bindings: []RecurringSubscriptionDTO{activeBinding},
		},
		{
			name:        "terminal provider binding",
			contract:    &activeContract,
			entitlement: &activeEntitlement,
			bindings: []RecurringSubscriptionDTO{func() RecurringSubscriptionDTO {
				binding := activeBinding
				binding.ProviderStatus = "canceled"
				return binding
			}()},
		},
		{
			name:        "expired provider binding",
			contract:    &activeContract,
			entitlement: &activeEntitlement,
			bindings: []RecurringSubscriptionDTO{func() RecurringSubscriptionDTO {
				binding := activeBinding
				binding.CurrentPeriodEnd = now - 1
				return binding
			}()},
		},
		{
			name:        "ended provider binding",
			contract:    &activeContract,
			entitlement: &activeEntitlement,
			bindings: recurringSubscriptionDTOs([]model.SubscriptionProviderBinding{{
				Id:                     3,
				Provider:               model.PaymentProviderStripe,
				ProviderSubscriptionId: "sub_ended_binding",
				PlanId:                 9935,
				ProviderStatus:         "active",
				CurrentPeriodEnd:       now + 3600,
				EndedAt:                now,
			}}),
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			source, status := subscriptionSelfRenewalState(testCase.contract, testCase.entitlement, testCase.bindings)
			require.Empty(t, source)
			require.Empty(t, status)
		})
	}
}

func TestSubscriptionSelfRenewalStateSafelyDerivesPartialStoredPair(t *testing.T) {
	now := common.GetTimestamp()
	activeEntitlement := &model.UserSubscription{
		Id:                2,
		PlanId:            9936,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		ProviderBindingId: 3,
		EndTime:           now + 3600,
		AccessEndTime:     now + 3600,
	}
	activeBinding := []RecurringSubscriptionDTO{{
		BindingId:        3,
		Provider:         model.PaymentProviderStripe,
		PlanId:           9936,
		ProviderStatus:   "active",
		CurrentPeriodEnd: now + 3600,
	}}

	testCases := []struct {
		name       string
		contract   model.UserSubscriptionContract
		bindings   []RecurringSubscriptionDTO
		wantSource string
		wantStatus string
	}{
		{
			name: "provider source without status derives active recurring pair",
			contract: model.UserSubscriptionContract{
				Id:                       1,
				Status:                   model.SubscriptionContractStatusActive,
				PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
				CurrentPlanId:            9936,
				CurrentProviderBindingId: 3,
				CurrentPeriodEnd:         now + 3600,
				RenewalSource:            model.SubscriptionRenewalSourceProvider,
			},
			bindings:   activeBinding,
			wantSource: model.SubscriptionRenewalSourceProvider,
			wantStatus: model.SubscriptionRenewalStatusEnabled,
		},
		{
			name: "enabled status without source derives active recurring pair",
			contract: model.UserSubscriptionContract{
				Id:                       1,
				Status:                   model.SubscriptionContractStatusActive,
				PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
				CurrentPlanId:            9936,
				CurrentProviderBindingId: 3,
				CurrentPeriodEnd:         now + 3600,
				RenewalStatus:            model.SubscriptionRenewalStatusEnabled,
			},
			bindings:   activeBinding,
			wantSource: model.SubscriptionRenewalSourceProvider,
			wantStatus: model.SubscriptionRenewalStatusEnabled,
		},
		{
			name: "wallet source without status is discarded without wallet evidence",
			contract: model.UserSubscriptionContract{
				Id:            1,
				Status:        model.SubscriptionContractStatusActive,
				PaymentMode:   model.SubscriptionPaymentModeBalanceOnePeriod,
				RenewalSource: model.SubscriptionRenewalSourceWallet,
			},
			bindings:   nil,
			wantSource: "",
			wantStatus: "",
		},
		{
			name: "invalid complete pair is discarded",
			contract: model.UserSubscriptionContract{
				Id:            1,
				Status:        model.SubscriptionContractStatusActive,
				PaymentMode:   model.SubscriptionPaymentModeBalanceOnePeriod,
				RenewalSource: model.SubscriptionRenewalSourceWallet,
				RenewalStatus: "unknown",
			},
			bindings:   nil,
			wantSource: "",
			wantStatus: "",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			source, status := subscriptionSelfRenewalState(&testCase.contract, activeEntitlement, testCase.bindings)
			require.Equal(t, testCase.wantSource, source)
			require.Equal(t, testCase.wantStatus, status)
		})
	}
}

func TestSubscriptionSelfRenewalCanonicalProjectionAndCapabilities(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	now := common.GetTimestamp()
	currentSlot := 1
	activeContract := model.UserSubscriptionContract{
		Id:                       1,
		Status:                   model.SubscriptionContractStatusActive,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            9937,
		CurrentEntitlementId:     2,
		CurrentProviderBindingId: 3,
		CurrentPeriodStart:       now - 3600,
		CurrentPeriodEnd:         now + 3600,
	}
	activeEntitlement := model.UserSubscription{
		Id:                2,
		PlanId:            9937,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		ProviderBindingId: 3,
		StartTime:         now - 3600,
		EndTime:           now + 3600,
		AccessEndTime:     now + 3600,
		CurrentSlot:       &currentSlot,
	}
	activeBinding := RecurringSubscriptionDTO{
		BindingId:        3,
		Provider:         model.PaymentProviderStripe,
		PlanId:           9937,
		ProviderStatus:   "active",
		CurrentPeriodEnd: now + 3600,
	}

	testCases := []struct {
		name            string
		contract        model.UserSubscriptionContract
		entitlement     model.UserSubscription
		bindings        []RecurringSubscriptionDTO
		pendingChange   *model.SubscriptionChangeIntent
		migration       SubscriptionMigrationDTO
		wantSource      string
		wantStatus      string
		wantCanCancel   bool
		wantCanResume   bool
		wantCancelAtEnd bool
		wantSupport     bool
	}{
		{
			name:          "stripe active enabled",
			contract:      activeContract,
			entitlement:   activeEntitlement,
			bindings:      []RecurringSubscriptionDTO{activeBinding},
			wantSource:    model.SubscriptionRenewalSourceProvider,
			wantStatus:    model.SubscriptionRenewalStatusEnabled,
			wantCanCancel: true,
		},
		{
			name: "same-plan stripe binding without current contract binding requires support",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.CurrentProviderBindingId = 0
				return contract
			}(),
			entitlement: activeEntitlement,
			bindings:    []RecurringSubscriptionDTO{activeBinding},
			wantSupport: true,
		},
		{
			name: "stripe active cancelled by provider flag",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.CurrentProviderBindingId = activeBinding.BindingId
				return contract
			}(),
			entitlement: activeEntitlement,
			bindings: []RecurringSubscriptionDTO{func() RecurringSubscriptionDTO {
				binding := activeBinding
				binding.CancelAtPeriodEnd = true
				return binding
			}()},
			wantSource:      model.SubscriptionRenewalSourceProvider,
			wantStatus:      model.SubscriptionRenewalStatusCancelledByUser,
			wantCanResume:   true,
			wantCancelAtEnd: true,
		},
		{
			name: "wallet enabled",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.PaymentMode = model.SubscriptionPaymentModeBalanceOnePeriod
				contract.RenewalSource = model.SubscriptionRenewalSourceWallet
				contract.RenewalStatus = model.SubscriptionRenewalStatusEnabled
				return contract
			}(),
			entitlement: func() model.UserSubscription {
				entitlement := activeEntitlement
				entitlement.PaymentMode = model.SubscriptionPaymentModeBalanceOnePeriod
				entitlement.Source = model.PaymentMethodBalance
				return entitlement
			}(),
			wantSource:    model.SubscriptionRenewalSourceWallet,
			wantStatus:    model.SubscriptionRenewalStatusEnabled,
			wantCanCancel: true,
		},
		{
			name: "wallet pending intent hides renewal actions",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.PaymentMode = model.SubscriptionPaymentModeBalanceOnePeriod
				contract.RenewalSource = model.SubscriptionRenewalSourceWallet
				contract.RenewalStatus = model.SubscriptionRenewalStatusEnabled
				return contract
			}(),
			entitlement: func() model.UserSubscription {
				entitlement := activeEntitlement
				entitlement.PaymentMode = model.SubscriptionPaymentModeBalanceOnePeriod
				entitlement.Source = model.PaymentMethodBalance
				return entitlement
			}(),
			pendingChange: &model.SubscriptionChangeIntent{
				Id:     5001,
				Status: model.SubscriptionChangeIntentStatusAwaitingPayment,
			},
			wantSource: model.SubscriptionRenewalSourceWallet,
			wantStatus: model.SubscriptionRenewalStatusEnabled,
		},
		{
			name: "stripe scheduled downgrade keeps cancel action",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.CurrentProviderBindingId = activeBinding.BindingId
				return contract
			}(),
			entitlement: activeEntitlement,
			bindings:    []RecurringSubscriptionDTO{activeBinding},
			pendingChange: &model.SubscriptionChangeIntent{
				Id:                5002,
				ContractId:        activeContract.Id,
				Kind:              model.SubscriptionChangeIntentKindDowngrade,
				PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
				Status:            model.SubscriptionChangeIntentStatusScheduled,
				ProviderBindingId: activeBinding.BindingId,
			},
			wantSource:    model.SubscriptionRenewalSourceProvider,
			wantStatus:    model.SubscriptionRenewalStatusEnabled,
			wantCanCancel: true,
		},
		{
			name: "stripe scheduled downgrade for stale binding hides cancel action",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.CurrentProviderBindingId = activeBinding.BindingId
				return contract
			}(),
			entitlement: activeEntitlement,
			bindings:    []RecurringSubscriptionDTO{activeBinding},
			pendingChange: &model.SubscriptionChangeIntent{
				Id:                5006,
				ContractId:        activeContract.Id,
				Kind:              model.SubscriptionChangeIntentKindDowngrade,
				PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
				Status:            model.SubscriptionChangeIntentStatusScheduled,
				ProviderBindingId: activeBinding.BindingId + 100,
			},
			wantSource: model.SubscriptionRenewalSourceProvider,
			wantStatus: model.SubscriptionRenewalStatusEnabled,
		},
		{
			name: "stripe syncing downgrade hides renewal actions",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.CurrentProviderBindingId = activeBinding.BindingId
				return contract
			}(),
			entitlement: activeEntitlement,
			bindings:    []RecurringSubscriptionDTO{activeBinding},
			pendingChange: &model.SubscriptionChangeIntent{
				Id:     5005,
				Kind:   model.SubscriptionChangeIntentKindDowngrade,
				Status: model.SubscriptionChangeIntentStatusSyncing,
			},
			wantSource: model.SubscriptionRenewalSourceProvider,
			wantStatus: model.SubscriptionRenewalStatusEnabled,
		},
		{
			name: "stripe pending upgrade hides cancel action",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.CurrentProviderBindingId = activeBinding.BindingId
				return contract
			}(),
			entitlement: activeEntitlement,
			bindings:    []RecurringSubscriptionDTO{activeBinding},
			pendingChange: &model.SubscriptionChangeIntent{
				Id:     5003,
				Kind:   model.SubscriptionChangeIntentKindUpgrade,
				Status: model.SubscriptionChangeIntentStatusAwaitingPayment,
			},
			wantSource: model.SubscriptionRenewalSourceProvider,
			wantStatus: model.SubscriptionRenewalStatusEnabled,
		},
		{
			name: "stripe scheduled downgrade hides resume action",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.CurrentProviderBindingId = activeBinding.BindingId
				return contract
			}(),
			entitlement: activeEntitlement,
			bindings: []RecurringSubscriptionDTO{func() RecurringSubscriptionDTO {
				binding := activeBinding
				binding.CancelAtPeriodEnd = true
				return binding
			}()},
			pendingChange: &model.SubscriptionChangeIntent{
				Id:     5004,
				Kind:   model.SubscriptionChangeIntentKindDowngrade,
				Status: model.SubscriptionChangeIntentStatusScheduled,
			},
			wantSource:      model.SubscriptionRenewalSourceProvider,
			wantStatus:      model.SubscriptionRenewalStatusCancelledByUser,
			wantCancelAtEnd: true,
		},
		{
			name: "wallet cancelled persists",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.PaymentMode = model.SubscriptionPaymentModeBalanceOnePeriod
				contract.RenewalSource = model.SubscriptionRenewalSourceWallet
				contract.RenewalStatus = model.SubscriptionRenewalStatusCancelledByUser
				return contract
			}(),
			entitlement: func() model.UserSubscription {
				entitlement := activeEntitlement
				entitlement.PaymentMode = model.SubscriptionPaymentModeBalanceOnePeriod
				entitlement.Source = model.PaymentMethodBalance
				return entitlement
			}(),
			wantSource:      model.SubscriptionRenewalSourceWallet,
			wantStatus:      model.SubscriptionRenewalStatusCancelledByUser,
			wantCanResume:   true,
			wantCancelAtEnd: true,
		},
		{
			name: "one-time pix does not inherit legacy wallet renewal state",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.PaymentMode = model.SubscriptionPaymentModePrepaid
				contract.RenewalSource = model.SubscriptionRenewalSourceWallet
				contract.RenewalStatus = model.SubscriptionRenewalStatusEnabled
				return contract
			}(),
			entitlement: func() model.UserSubscription {
				entitlement := activeEntitlement
				entitlement.PaymentMode = model.SubscriptionPaymentModePrepaid
				entitlement.Source = model.SubscriptionPaymentMethodPix
				return entitlement
			}(),
		},
		{
			name: "wallet access extension outside renewal period has no lifecycle action",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.PaymentMode = model.SubscriptionPaymentModePrepaid
				contract.RenewalSource = model.SubscriptionRenewalSourceWallet
				contract.RenewalStatus = model.SubscriptionRenewalStatusEnabled
				contract.CurrentPeriodEnd = now - 1
				return contract
			}(),
			entitlement: func() model.UserSubscription {
				entitlement := activeEntitlement
				entitlement.PaymentMode = model.SubscriptionPaymentModePrepaid
				entitlement.Source = model.PaymentMethodBalance
				entitlement.EndTime = now - 1
				entitlement.AccessEndTime = now + 3600
				return entitlement
			}(),
			wantSource: model.SubscriptionRenewalSourceWallet,
			wantStatus: model.SubscriptionRenewalStatusEnabled,
		},
		{
			name:        "empty one period stays empty",
			contract:    model.UserSubscriptionContract{Id: 1, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod, CurrentPeriodEnd: now + 3600},
			entitlement: model.UserSubscription{Id: 2, Status: model.SubscriptionEntitlementStatusActive, PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod, EndTime: now + 3600, AccessEndTime: now + 3600},
		},
		{
			name: "incomplete stripe binding requires support",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.CurrentProviderBindingId = activeBinding.BindingId
				return contract
			}(),
			entitlement: activeEntitlement,
			bindings: []RecurringSubscriptionDTO{func() RecurringSubscriptionDTO {
				binding := activeBinding
				binding.CancelAtPeriodEnd = true
				binding.RequiresSupport = true
				return binding
			}()},
			wantSupport: true,
		},
		{
			name: "incomplete stripe provider status requires support",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.CurrentProviderBindingId = activeBinding.BindingId
				return contract
			}(),
			entitlement: activeEntitlement,
			bindings: recurringSubscriptionDTOs([]model.SubscriptionProviderBinding{{
				Id:                     activeBinding.BindingId,
				Provider:               model.PaymentProviderStripe,
				PlanId:                 activeBinding.PlanId,
				ProviderSubscriptionId: "sub_incomplete_requires_support",
				ProviderStatus:         "incomplete",
				CancelAtPeriodEnd:      true,
				CurrentPeriodEnd:       now + 3600,
			}}),
			wantSupport: true,
		},
		{
			name: "past due stripe binding requires support instead of period end cancellation",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.CurrentProviderBindingId = activeBinding.BindingId
				return contract
			}(),
			entitlement: activeEntitlement,
			bindings: recurringSubscriptionDTOs([]model.SubscriptionProviderBinding{{
				Id:                     activeBinding.BindingId,
				Provider:               model.PaymentProviderStripe,
				PlanId:                 activeBinding.PlanId,
				ProviderSubscriptionId: "sub_past_due_requires_support",
				ProviderStatus:         "past_due",
				CurrentPeriodEnd:       now + 3600,
			}}),
			wantSupport: true,
		},
		{
			name: "mismatched stripe binding requires support",
			contract: func() model.UserSubscriptionContract {
				contract := activeContract
				contract.CurrentProviderBindingId = activeBinding.BindingId + 100
				return contract
			}(),
			entitlement: activeEntitlement,
			bindings: []RecurringSubscriptionDTO{func() RecurringSubscriptionDTO {
				binding := activeBinding
				binding.CancelAtPeriodEnd = true
				return binding
			}()},
			wantSupport: true,
		},
		{
			name:        "ambiguous migration conflict requires support",
			contract:    activeContract,
			entitlement: activeEntitlement,
			bindings: []RecurringSubscriptionDTO{func() RecurringSubscriptionDTO {
				binding := activeBinding
				binding.CancelAtPeriodEnd = true
				return binding
			}()},
			migration:   SubscriptionMigrationDTO{RequiresAdminReview: true},
			wantSupport: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			response := buildSubscriptionSelfResponse(
				"subscription_first",
				&testCase.contract,
				&testCase.entitlement,
				testCase.pendingChange,
				testCase.migration,
				nil,
				nil,
				testCase.bindings,
			)

			require.Equal(t, testCase.wantSource, response.RenewalSource)
			require.Equal(t, testCase.wantStatus, response.RenewalStatus)
			require.Equal(t, testCase.wantCanCancel, response.Capabilities.CanCancel)
			require.Equal(t, testCase.wantCanResume, response.Capabilities.CanResume)
			require.Equal(t, testCase.wantCancelAtEnd, response.Capabilities.IsCancelAtPeriodEnd)
			require.Equal(t, testCase.wantSupport, response.Capabilities.RequiresSupport)
		})
	}
}

func TestRecurringSubscriptionDTOsRequiresSupportForNonActionableProviderStatuses(t *testing.T) {
	for _, providerStatus := range []string{"past_due", "paused", "unknown"} {
		t.Run(providerStatus, func(t *testing.T) {
			bindings := recurringSubscriptionDTOs([]model.SubscriptionProviderBinding{{
				Provider:               model.PaymentProviderStripe,
				ProviderSubscriptionId: "sub_non_actionable_" + providerStatus,
				ProviderStatus:         providerStatus,
				CurrentPeriodEnd:       common.GetTimestamp() + 3600,
			}})

			require.Len(t, bindings, 1)
			require.True(t, bindings[0].RequiresSupport)
			require.False(t, bindings[0].CanCancel)
			require.False(t, bindings[0].CanResume)
		})
	}
}

func TestGetSubscriptionSelfReturnsCurrentEntitlementQuotaReadModelWithoutShortWindows(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 915)
	now := common.GetTimestamp()
	planWindow5h := int64(999)
	planWindowWeek := int64(9999)
	entitlementWindow5h := int64(125)
	entitlementWindowWeek := int64(900)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:                  9930,
		Title:               "Snapshot Plan",
		PriceAmount:         20,
		Currency:            "USD",
		DurationUnit:        model.SubscriptionDurationMonth,
		DurationValue:       1,
		Enabled:             true,
		TotalAmount:         999999,
		Window5hAmount:      planWindow5h,
		WindowWeekAmount:    planWindowWeek,
		MediaCreditsMonthly: 999,
		QuotaResetPeriod:    model.SubscriptionResetMonthly,
		AllowBalancePay:     common.GetPointer(true),
	}).Error)
	contract := model.UserSubscriptionContract{
		UserId:             915,
		Status:             model.SubscriptionContractStatusActive,
		PaymentMode:        model.SubscriptionPaymentModeBalanceOnePeriod,
		RenewalSource:      model.SubscriptionRenewalSourceWallet,
		RenewalStatus:      model.SubscriptionRenewalStatusPausedInsufficientBalance,
		CurrentPlanId:      9930,
		CurrentPeriodStart: now - 60,
		CurrentPeriodEnd:   now + 49*3600 + 1,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	entitlement := model.UserSubscription{
		UserId:            915,
		PlanId:            9930,
		ContractId:        contract.Id,
		AmountTotal:       2000,
		AmountUsed:        450,
		MediaCreditsTotal: 20,
		MediaCreditsUsed:  25,
		Window5hAmount:    &entitlementWindow5h,
		WindowWeekAmount:  &entitlementWindowWeek,
		StartTime:         now - 60,
		EndTime:           now + 49*3600 + 1,
		AccessEndTime:     now + 49*3600 + 1,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeBalanceOnePeriod,
		Source:            model.PaymentMethodBalance,
		NextResetTime:     now + 3600,
	}
	require.NoError(t, model.DB.Create(&entitlement).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("current_entitlement_id", entitlement.Id).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 915)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/self", nil)

	GetSubscriptionSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	data := envelope["data"].(map[string]any)
	require.Equal(t, float64(3), data["remaining_days"])
	require.Equal(t, model.SubscriptionRenewalSourceWallet, data["renewal_source"])
	require.Equal(t, model.SubscriptionRenewalStatusPausedInsufficientBalance, data["renewal_status"])

	monthly := data["monthly_bucket"].(map[string]any)
	require.Equal(t, float64(450), monthly["used"])
	require.Equal(t, float64(2000), monthly["total"])
	require.Equal(t, float64(1550), monthly["remaining"])
	require.Equal(t, float64(now+3600), monthly["reset_at"])
	require.Equal(t, false, monthly["unlimited"])
	require.NotContains(t, data, "window_5h")
	require.NotContains(t, data, "window_7d")
	require.NotContains(t, data, "media_credits")

	current := data["current_subscription"].(map[string]any)
	require.NotContains(t, current, "usage_limits")
	currentSubscription := current["subscription"].(map[string]any)
	require.NotContains(t, currentSubscription, "window_5h_amount")
	require.NotContains(t, currentSubscription, "window_week_amount")
	require.NotContains(t, currentSubscription, "media_credits_total")
	require.NotContains(t, currentSubscription, "media_credits_used")
	currentPlan := current["plan"].(map[string]any)
	require.NotContains(t, currentPlan, "window_5h_amount")
	require.NotContains(t, currentPlan, "window_week_amount")
	require.NotContains(t, currentPlan, "media_credits_monthly")
}

func TestGetSubscriptionSelfReturnsZeroQuotaReadModelWithoutSubscriptionOrShortWindows(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 916)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 916)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/self", nil)

	GetSubscriptionSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	data := envelope["data"].(map[string]any)
	require.Equal(t, float64(0), data["remaining_days"])
	require.Equal(t, "", data["renewal_source"])
	require.Equal(t, "", data["renewal_status"])
	bucket := data["monthly_bucket"].(map[string]any)
	require.Equal(t, float64(0), bucket["used"])
	require.Equal(t, float64(0), bucket["total"])
	require.Equal(t, float64(0), bucket["remaining"])
	require.Equal(t, float64(0), bucket["reset_at"])
	require.Equal(t, false, bucket["unlimited"])
	require.NotContains(t, data, "media_credits")
	require.NotContains(t, data, "window_5h")
	require.NotContains(t, data, "window_7d")
	require.Nil(t, data["current_subscription"])
}

func TestGetSubscriptionSelfOmitsShortWindowUsageCounters(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 917)
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	previousRDB := common.RDB
	previousRedisEnabled := common.RedisEnabled
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	t.Cleanup(func() {
		_ = common.RDB.Close()
		common.RDB = previousRDB
		common.RedisEnabled = previousRedisEnabled
	})

	now := common.GetTimestamp()
	window5h := int64(500)
	window7d := int64(1000)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:               9931,
		Title:            "Counter Plan",
		PriceAmount:      20,
		Currency:         "USD",
		DurationUnit:     model.SubscriptionDurationMonth,
		DurationValue:    1,
		Enabled:          true,
		Window5hAmount:   999,
		WindowWeekAmount: 9999,
	}).Error)
	contract := model.UserSubscriptionContract{
		UserId:             917,
		Status:             model.SubscriptionContractStatusActive,
		PaymentMode:        model.SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:      9931,
		CurrentPeriodStart: now - 3600,
		CurrentPeriodEnd:   now + 3600,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	entitlement := model.UserSubscription{
		UserId:           917,
		PlanId:           9931,
		ContractId:       contract.Id,
		Window5hAmount:   &window5h,
		WindowWeekAmount: &window7d,
		StartTime:        now - 3600,
		EndTime:          now + 3600,
		AccessEndTime:    now + 3600,
		Status:           model.SubscriptionEntitlementStatusActive,
	}
	require.NoError(t, model.DB.Create(&entitlement).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("current_entitlement_id", entitlement.Id).Error)
	identity := int(contract.Id)
	currentBucket := now / int64(1800) * int64(1800)
	require.NoError(t, common.RDB.Set(context.Background(), "sub:win:5h:"+strconv.Itoa(identity)+":"+strconv.FormatInt(currentBucket, 10), "75", time.Hour).Err())
	require.NoError(t, common.RDB.Set(context.Background(), "sub:win:w:"+strconv.Itoa(identity)+":0", "250", time.Hour).Err())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 917)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/self", nil)

	GetSubscriptionSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	data := envelope["data"].(map[string]any)
	require.Contains(t, data, "monthly_bucket")
	require.NotContains(t, data, "media_credits")
	require.NotContains(t, data, "window_5h")
	require.NotContains(t, data, "window_7d")
}

func TestGetSubscriptionPlansAnnotatesTierRankAndRelation(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 911)
	lowRank := 10
	highRank := 20
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:               9912,
		Title:            "Current",
		PriceAmount:      10,
		Currency:         "USD",
		DurationUnit:     model.SubscriptionDurationMonth,
		DurationValue:    1,
		Enabled:          true,
		TierRank:         &lowRank,
		QuotaResetPeriod: model.SubscriptionResetNever,
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:               9913,
		Title:            "Upgrade",
		PriceAmount:      20,
		Currency:         "USD",
		DurationUnit:     model.SubscriptionDurationMonth,
		DurationValue:    1,
		Enabled:          true,
		TierRank:         &highRank,
		AllowBalancePay:  common.GetPointer(false),
		QuotaResetPeriod: model.SubscriptionResetNever,
		StripePriceId:    "price_plan_should_not_leak",
	}).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscriptionContract{
		UserId:        911,
		Status:        model.SubscriptionContractStatusActive,
		PaymentMode:   model.SubscriptionPaymentModeBalanceOnePeriod,
		CurrentPlanId: 9912,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 911)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/plans", nil)

	GetSubscriptionPlans(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.NotContains(t, recorder.Body.String(), "price_plan_should_not_leak")
	require.NotContains(t, recorder.Body.String(), "stripe_price_id")
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	requireNoProviderIDStrings(t, envelope)
	items := envelope["data"].([]any)
	relations := map[int]string{}
	ranks := map[int]float64{}
	paymentModes := map[int][]string{}
	for _, item := range items {
		row := item.(map[string]any)
		require.Contains(t, row, "relation")
		require.Contains(t, row, "tier_rank")
		plan := row["plan"].(map[string]any)
		require.Contains(t, plan, "payment_modes")
		id := int(plan["id"].(float64))
		relations[id] = row["relation"].(string)
		ranks[id] = row["tier_rank"].(float64)
		for _, mode := range plan["payment_modes"].([]any) {
			paymentModes[id] = append(paymentModes[id], mode.(string))
		}
	}
	require.Equal(t, "current", relations[9912])
	require.Equal(t, "upgrade", relations[9913])
	require.Equal(t, float64(lowRank), ranks[9912])
	require.Equal(t, float64(highRank), ranks[9913])
	require.Equal(t, []string{model.SubscriptionPaymentModeBalanceOnePeriod}, paymentModes[9912])
	require.Equal(t, []string{model.SubscriptionPaymentModeStripeRecurring}, paymentModes[9913])
}

func TestGetSubscriptionPlansExposesConfiguredUsageLimitsWithoutShortWindowFields(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:                  9932,
		Title:               "Configured Limits",
		PriceAmount:         30,
		Currency:            "USD",
		DurationUnit:        model.SubscriptionDurationMonth,
		DurationValue:       1,
		Enabled:             true,
		TotalAmount:         3000,
		Window5hAmount:      500,
		WindowWeekAmount:    2000,
		MediaCreditsMonthly: 75,
		QuotaResetPeriod:    model.SubscriptionResetMonthly,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/plans", nil)

	GetSubscriptionPlans(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	items := envelope["data"].([]any)
	require.Len(t, items, 1)
	plan := items[0].(map[string]any)["plan"].(map[string]any)
	require.NotContains(t, plan, "window_5h_amount")
	require.NotContains(t, plan, "window_week_amount")
	require.NotContains(t, plan, "media_credits_monthly")
}

func TestSubscriptionPlanRelationLimitsDowngradesToActiveBoundStripeRecurring(t *testing.T) {
	currentRank := 20
	lowerRank := 10
	currentPlanID := 9920
	lowerPlan := &model.SubscriptionPlan{Id: 9921, TierRank: &lowerRank}
	currentPlan := &model.SubscriptionPlan{Id: currentPlanID, TierRank: &currentRank}
	higherRank := 30
	higherPlan := &model.SubscriptionPlan{Id: 9922, TierRank: &higherRank}

	testCases := []struct {
		name     string
		contract model.UserSubscriptionContract
		want     string
	}{
		{
			name: "balance one period",
			contract: model.UserSubscriptionContract{
				Status:        model.SubscriptionContractStatusActive,
				PaymentMode:   model.SubscriptionPaymentModeBalanceOnePeriod,
				CurrentPlanId: currentPlanID,
			},
			want: "unavailable",
		},
		{
			name: "external one period",
			contract: model.UserSubscriptionContract{
				Status:        model.SubscriptionContractStatusActive,
				PaymentMode:   model.SubscriptionPaymentModeExternalOnePeriod,
				CurrentPlanId: currentPlanID,
			},
			want: "unavailable",
		},
		{
			name: "active bound stripe recurring",
			contract: model.UserSubscriptionContract{
				Status:                   model.SubscriptionContractStatusActive,
				PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
				CurrentPlanId:            currentPlanID,
				CurrentProviderBindingId: 99,
			},
			want: "downgrade",
		},
		{
			name: "stripe recurring missing binding",
			contract: model.UserSubscriptionContract{
				Status:        model.SubscriptionContractStatusActive,
				PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
				CurrentPlanId: currentPlanID,
			},
			want: "unavailable",
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, subscriptionPlanRelation(&tt.contract, &currentRank, lowerPlan))
			require.Equal(t, "current", subscriptionPlanRelation(&tt.contract, &currentRank, currentPlan))
			require.Equal(t, "upgrade", subscriptionPlanRelation(&tt.contract, &currentRank, higherPlan))
		})
	}
}

func TestGetSubscriptionPlansMarksLowerTierUnavailableForOnePeriodContract(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 914)
	lowRank := 10
	highRank := 20
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            9923,
		Title:         "Lower",
		PriceAmount:   10,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TierRank:      &lowRank,
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            9924,
		Title:         "Current",
		PriceAmount:   20,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TierRank:      &highRank,
	}).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscriptionContract{
		UserId:        914,
		Status:        model.SubscriptionContractStatusActive,
		PaymentMode:   model.SubscriptionPaymentModeBalanceOnePeriod,
		CurrentPlanId: 9924,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 914)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/plans", nil)

	GetSubscriptionPlans(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	items := envelope["data"].([]any)
	relations := map[int]string{}
	for _, item := range items {
		row := item.(map[string]any)
		plan := row["plan"].(map[string]any)
		relations[int(plan["id"].(float64))] = row["relation"].(string)
	}
	require.Equal(t, "unavailable", relations[9923])
	require.Equal(t, "current", relations[9924])
}

func requireNoProviderIDStrings(t *testing.T, value any) {
	t.Helper()
	switch typed := value.(type) {
	case map[string]any:
		for _, nested := range typed {
			requireNoProviderIDStrings(t, nested)
		}
	case []any:
		for _, nested := range typed {
			requireNoProviderIDStrings(t, nested)
		}
	case string:
		for _, prefix := range []string{"price_", "sub_", "cus_"} {
			require.Falsef(t, strings.HasPrefix(typed, prefix), "response leaked provider ID %q", typed)
		}
	}
}

func TestSubscriptionSelfResponseDoesNotLeakProviderIDsFromLegacySummaries(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 912)
	insertSubscriptionControllerPlan(t, 9914)
	now := common.GetTimestamp()
	binding := model.SubscriptionProviderBinding{
		UserId:                 912,
		PlanId:                 9914,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: "sub_legacy_should_not_leak",
		ProviderCustomerId:     "cus_legacy_should_not_leak",
		ProviderPriceId:        "price_legacy_should_not_leak",
		ProviderStatus:         "active",
		CurrentPeriodStart:     now - 60,
		CurrentPeriodEnd:       now + 3600,
	}
	require.NoError(t, model.DB.Create(&binding).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId:            912,
		PlanId:            9914,
		ProviderBindingId: binding.Id,
		AmountTotal:       1000,
		StartTime:         now - 60,
		EndTime:           now + 3600,
		AccessEndTime:     now + 3600,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 912)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/self", nil)

	GetSubscriptionSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := recorder.Body.String()
	require.NotContains(t, body, "sub_legacy_should_not_leak")
	require.NotContains(t, body, "cus_legacy_should_not_leak")
	require.NotContains(t, body, "price_legacy_should_not_leak")
	require.True(t, strings.Contains(body, `"all_subscriptions"`))
	require.True(t, strings.Contains(body, `"recurring_subscriptions"`))
}

func TestChangeSubscriptionPlanReplayReturnsSanitizedLocalContract(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 913)
	insertSubscriptionControllerPlan(t, 9915)
	insertSubscriptionControllerPlan(t, 9916)
	now := common.GetTimestamp()
	binding := model.SubscriptionProviderBinding{
		UserId:                     913,
		PlanId:                     9915,
		Provider:                   model.PaymentProviderStripe,
		ProviderSubscriptionId:     "sub_change_should_not_leak",
		ProviderSubscriptionItemId: "si_change_should_not_leak",
		ProviderCustomerId:         "cus_change_should_not_leak",
		ProviderPriceId:            "price_change_should_not_leak",
		ProviderStatus:             "active",
		CurrentPeriodStart:         now - 60,
		CurrentPeriodEnd:           now + 3600,
	}
	require.NoError(t, model.DB.Create(&binding).Error)
	contract := model.UserSubscriptionContract{
		UserId:                   913,
		Status:                   model.SubscriptionContractStatusActive,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            9915,
		CurrentProviderBindingId: binding.Id,
		PendingPlanId:            9916,
		PendingEffectiveAt:       now + 3600,
		CurrentPeriodStart:       now - 60,
		CurrentPeriodEnd:         now + 3600,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("contract_id", contract.Id).Error)
	intent := model.SubscriptionChangeIntent{
		ContractId:               contract.Id,
		UserId:                   913,
		RequestId:                "550e8400-e29b-41d4-a716-446655440011",
		Kind:                     model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		Status:                   model.SubscriptionChangeIntentStatusScheduled,
		FromPlanId:               9915,
		ToPlanId:                 9916,
		ProviderBindingId:        binding.Id,
		ProviderScheduleId:       "sub_sched_should_not_leak",
		ProviderIdempotencyKey:   "price_idempotency_should_not_leak",
		PreviousScheduleSnapshot: "cus_snapshot_should_not_leak",
		WalletDebitTradeNo:       "local-wallet-trade",
		EffectiveAt:              now + 3600,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("latest_change_intent_id", intent.Id).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 913)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/self/change-plan",
		strings.NewReader(`{"plan_id":9916,"payment_mode":"stripe_recurring","request_id":"550e8400-e29b-41d4-a716-446655440011"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	ChangeSubscriptionPlan(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := recorder.Body.String()
	require.NotContains(t, body, "sub_change_should_not_leak")
	require.NotContains(t, body, "cus_change_should_not_leak")
	require.NotContains(t, body, "price_change_should_not_leak")
	require.NotContains(t, body, "sub_sched_should_not_leak")
	require.NotContains(t, body, "price_idempotency_should_not_leak")
	require.NotContains(t, body, "cus_snapshot_should_not_leak")

	var envelope map[string]any
	require.NoError(t, common.Unmarshal([]byte(body), &envelope))
	data := envelope["data"].(map[string]any)
	contractDTO := data["contract"].(map[string]any)
	intentDTO := data["intent"].(map[string]any)
	require.Equal(t, float64(contract.Id), contractDTO["contract_id"])
	require.NotContains(t, contractDTO, "current_provider_binding_id")
	require.Equal(t, float64(intent.Id), intentDTO["intent_id"])
	require.NotContains(t, intentDTO, "provider_binding_id")
	require.NotContains(t, intentDTO, "provider_schedule_id")
}
