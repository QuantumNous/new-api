package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestLegacySubscriptionPurchaseGateDisabledUsesLegacyHandler(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 906)
	insertSubscriptionControllerPlan(t, 9906)
	configureLegacySubscriptionPaymentSettingsForBlockTest(t)
	originalGate := common.SubscriptionSingleContractEnabled
	common.SubscriptionSingleContractEnabled = false
	t.Cleanup(func() { common.SubscriptionSingleContractEnabled = originalGate })

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 906)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/epay/pay",
		strings.NewReader(`{"plan_id":9906,"payment_method":"alipay"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestEpay(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.NotContains(t, recorder.Body.String(), "pending migration")
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 906).Count(&orderCount).Error)
	require.Equal(t, int64(1), orderCount)
}

func TestChangeSubscriptionPlanBlocksMigrationConflict(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 907)
	insertSubscriptionControllerPlan(t, 9907)
	insertSubscriptionControllerPlan(t, 9908)
	originalGate := common.SubscriptionSingleContractEnabled
	common.SubscriptionSingleContractEnabled = true
	t.Cleanup(func() { common.SubscriptionSingleContractEnabled = originalGate })
	now := common.GetTimestamp()
	first := model.SubscriptionProviderBinding{
		UserId:                 907,
		PlanId:                 9907,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: "sub_controller_first",
		ProviderStatus:         "active",
		CurrentPeriodStart:     now - 60,
		CurrentPeriodEnd:       now + 3600,
	}
	require.NoError(t, model.DB.Create(&first).Error)
	second := model.SubscriptionProviderBinding{
		UserId:                 907,
		PlanId:                 9908,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: "sub_controller_second",
		ProviderStatus:         "active",
		CurrentPeriodStart:     now - 60,
		CurrentPeriodEnd:       now + 7200,
	}
	require.NoError(t, model.DB.Create(&second).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId:            907,
		PlanId:            9907,
		ProviderBindingId: first.Id,
		AmountTotal:       1000,
		StartTime:         now - 60,
		EndTime:           now + 3600,
		AccessEndTime:     now + 3600,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
	}).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId:            907,
		PlanId:            9908,
		ProviderBindingId: second.Id,
		AmountTotal:       2000,
		StartTime:         now - 60,
		EndTime:           now + 7200,
		AccessEndTime:     now + 7200,
		Status:            model.SubscriptionEntitlementStatusActive,
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 907)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/self/change-plan",
		strings.NewReader(`{"plan_id":9908,"payment_mode":"balance_one_period","request_id":"550e8400-e29b-41d4-a716-446655440002"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	ChangeSubscriptionPlan(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "administrator review")
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 907).Count(&intentCount).Error)
	require.Zero(t, intentCount)
}

func TestLegacyBalancePayBlocksMigrationConflictBeforeAnySideEffects(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 908)
	insertSubscriptionControllerPlan(t, 9909)
	const startingQuota = 10_000_000
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 908).Update("quota", startingQuota).Error)
	originalGate := common.SubscriptionSingleContractEnabled
	common.SubscriptionSingleContractEnabled = true
	t.Cleanup(func() { common.SubscriptionSingleContractEnabled = originalGate })
	now := common.GetTimestamp()
	first := model.SubscriptionProviderBinding{
		UserId:                 908,
		PlanId:                 9909,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: "sub_balance_pay_first",
		ProviderStatus:         "active",
		CurrentPeriodStart:     now - 60,
		CurrentPeriodEnd:       now + 3600,
	}
	require.NoError(t, model.DB.Create(&first).Error)
	second := model.SubscriptionProviderBinding{
		UserId:                 908,
		PlanId:                 9909,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: "sub_balance_pay_second",
		ProviderStatus:         "active",
		CurrentPeriodStart:     now - 60,
		CurrentPeriodEnd:       now + 7200,
	}
	require.NoError(t, model.DB.Create(&second).Error)
	for _, binding := range []model.SubscriptionProviderBinding{first, second} {
		require.NoError(t, model.DB.Create(&model.UserSubscription{
			UserId:            908,
			PlanId:            9909,
			ProviderBindingId: binding.Id,
			AmountTotal:       1000,
			StartTime:         now - 60,
			EndTime:           binding.CurrentPeriodEnd,
			AccessEndTime:     binding.CurrentPeriodEnd,
			Status:            model.SubscriptionEntitlementStatusActive,
			PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		}).Error)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 908)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/balance/pay",
		strings.NewReader(`{"plan_id":9909,"request_id":"legacy-balance-conflict"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestBalancePay(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "administrator review")
	var contractCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("user_id = ?", 908).Count(&contractCount).Error)
	require.Zero(t, contractCount)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 908).Count(&intentCount).Error)
	require.Zero(t, intentCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 908).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 908).Error)
	require.Equal(t, startingQuota, user.Quota)
}
