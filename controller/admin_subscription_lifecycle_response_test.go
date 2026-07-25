package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestAdminListUserSubscriptionsReturnsCanonicalLifecycleResponse(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 951)
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:               9951,
		Title:            "Admin Current",
		PriceAmount:      20,
		Currency:         "USD",
		DurationUnit:     model.SubscriptionDurationMonth,
		DurationValue:    1,
		Enabled:          true,
		TotalAmount:      2000,
		QuotaResetPeriod: model.SubscriptionResetMonthly,
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:               9952,
		Title:            "Admin Pending",
		PriceAmount:      10,
		Currency:         "USD",
		DurationUnit:     model.SubscriptionDurationMonth,
		DurationValue:    1,
		Enabled:          true,
		TotalAmount:      1000,
		QuotaResetPeriod: model.SubscriptionResetMonthly,
	}).Error)

	binding := model.SubscriptionProviderBinding{
		UserId:                     951,
		PlanId:                     9951,
		Provider:                   model.PaymentProviderStripe,
		ProviderSubscriptionId:     "sub_admin_should_not_leak",
		ProviderSubscriptionItemId: "si_admin_should_not_leak",
		ProviderCustomerId:         "cus_admin_should_not_leak",
		ProviderPriceId:            "price_admin_should_not_leak",
		ProviderStatus:             "past_due",
		CancelAtPeriodEnd:          true,
		CurrentPeriodStart:         now - 100,
		CurrentPeriodEnd:           now + 3600,
		GracePeriodEnd:             now + 7200,
	}
	require.NoError(t, model.DB.Create(&binding).Error)
	contract := model.UserSubscriptionContract{
		UserId:                   951,
		Status:                   model.SubscriptionContractStatusGrace,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		CurrentPlanId:            9951,
		CurrentProviderBindingId: binding.Id,
		LatestChangeIntentId:     9517,
		PendingPlanId:            9952,
		PendingEffectiveAt:       now + 3600,
		CurrentPeriodStart:       now - 100,
		CurrentPeriodEnd:         now + 3600,
		GracePeriodEnd:           now + 7200,
		ChangeVersion:            3,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("contract_id", contract.Id).Error)
	current := model.UserSubscription{
		UserId:            951,
		PlanId:            9951,
		ContractId:        contract.Id,
		ProviderBindingId: binding.Id,
		AmountTotal:       2000,
		AmountUsed:        300,
		StartTime:         now - 100,
		EndTime:           now + 3600,
		AccessEndTime:     now + 7200,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
	}
	require.NoError(t, model.DB.Create(&current).Error)
	history := model.UserSubscription{
		UserId:        951,
		PlanId:        9952,
		AmountTotal:   1000,
		AmountUsed:    1000,
		StartTime:     now - 7200,
		EndTime:       now - 3600,
		AccessEndTime: now - 3600,
		Status:        model.SubscriptionEntitlementStatusHistorical,
		PaymentMode:   model.SubscriptionPaymentModeBalanceOnePeriod,
	}
	require.NoError(t, model.DB.Create(&history).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("current_entitlement_id", current.Id).Error)
	intent := model.SubscriptionChangeIntent{
		Id:                9517,
		ContractId:        contract.Id,
		UserId:            951,
		RequestId:         "550e8400-e29b-41d4-a716-446655449517",
		ChangeVersion:     3,
		Kind:              model.SubscriptionChangeIntentKindDowngrade,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		Status:            model.SubscriptionChangeIntentStatusScheduled,
		FromPlanId:        9951,
		ToPlanId:          9952,
		ProviderBindingId: binding.Id,
		EffectiveAt:       now + 3600,
	}
	require.NoError(t, model.DB.Create(&intent).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: "951"}}
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/admin/users/951/subscriptions", nil)

	AdminListUserSubscriptions(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := recorder.Body.String()
	require.NotContains(t, body, "sub_admin_should_not_leak")
	require.NotContains(t, body, "cus_admin_should_not_leak")
	require.NotContains(t, body, "price_admin_should_not_leak")
	require.NotContains(t, body, "si_admin_should_not_leak")

	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	data := envelope["data"].(map[string]any)
	require.Contains(t, data, "contract")
	require.Contains(t, data, "current_entitlement")
	require.Contains(t, data, "current_period")
	require.Contains(t, data, "quota")
	require.Contains(t, data, "current_binding")
	require.Contains(t, data, "pending_change")
	require.Contains(t, data, "migration")
	require.Contains(t, data, "history")

	contractDTO := data["contract"].(map[string]any)
	require.Equal(t, float64(contract.Id), contractDTO["contract_id"])
	require.Equal(t, "grace", contractDTO["status"])
	require.Equal(t, "stripe_recurring", contractDTO["payment_mode"])
	require.Equal(t, float64(current.Id), contractDTO["current_entitlement_id"])

	currentDTO := data["current_entitlement"].(map[string]any)
	require.Equal(t, float64(current.Id), currentDTO["entitlement_id"])
	require.Equal(t, float64(9951), currentDTO["plan_id"])
	require.Equal(t, float64(now+7200), currentDTO["access_end_time"])

	period := data["current_period"].(map[string]any)
	require.Equal(t, float64(now+7200), period["grace_period_end"])

	bindingDTO := data["current_binding"].(map[string]any)
	require.Equal(t, float64(binding.Id), bindingDTO["binding_id"])
	require.Equal(t, "past_due", bindingDTO["provider_status"])
	require.Equal(t, true, bindingDTO["cancel_at_period_end"])
	require.Equal(t, float64(now+7200), bindingDTO["grace_period_end"])

	pending := data["pending_change"].(map[string]any)
	require.Equal(t, float64(9517), pending["intent_id"])
	require.Equal(t, "downgrade", pending["kind"])
	require.Equal(t, "scheduled", pending["status"])

	migration := data["migration"].(map[string]any)
	require.Equal(t, false, migration["requires_admin_review"])

	historyItems := data["history"].([]any)
	require.Len(t, historyItems, 2)
}

func TestAdminListUserSubscriptionsDoesNotInferCanonicalStateFromLegacyRows(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 952)
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:               9953,
		Title:            "Legacy Active",
		PriceAmount:      10,
		Currency:         "USD",
		DurationUnit:     model.SubscriptionDurationMonth,
		DurationValue:    1,
		Enabled:          true,
		TotalAmount:      1000,
		QuotaResetPeriod: model.SubscriptionResetMonthly,
	}).Error)

	binding := model.SubscriptionProviderBinding{
		UserId:                 952,
		PlanId:                 9953,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: "sub_legacy_only",
		ProviderStatus:         "active",
		CurrentPeriodStart:     now - 100,
		CurrentPeriodEnd:       now + 3600,
	}
	require.NoError(t, model.DB.Create(&binding).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId:            952,
		PlanId:            9953,
		ProviderBindingId: binding.Id,
		AmountTotal:       1000,
		AmountUsed:        100,
		StartTime:         now - 100,
		EndTime:           now + 3600,
		AccessEndTime:     now + 3600,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: "952"}}
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/admin/users/952/subscriptions", nil)

	AdminListUserSubscriptions(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	data := envelope["data"].(map[string]any)
	require.NotContains(t, data, "current_entitlement")
	require.NotContains(t, data, "current_binding")
	require.Len(t, data["history"].([]any), 1)

	require.Nil(t, currentRecurringSubscriptionDTO(
		&model.UserSubscriptionContract{CurrentProviderBindingId: binding.Id + 1},
		[]RecurringSubscriptionDTO{{BindingId: binding.Id}},
	))
}
