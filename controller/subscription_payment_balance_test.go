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

func TestSubscriptionRequestBalancePayInvitationDiscountUsesUnifiedPurchasePath(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 9705)
	insertSubscriptionControllerPlan(t, 19705)
	grantSubscriptionControllerDiscount(t, 9705, 999, "balance-full-discount")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 9705)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/balance/pay",
		strings.NewReader(`{"plan_id":19705,"request_id":"550e8400-e29b-41d4-a716-446655449705"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestBalancePay(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)

	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "user_id = ? AND plan_id = ?", 9705, 19705).Error)
	require.Equal(t, model.PaymentProviderBalance, order.PaymentProvider)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)
	require.Zero(t, order.PaymentAmountMinor)
	require.Equal(t, int64(999), order.SubscriptionDiscountUSDMinor)
	require.Equal(t, int64(999), order.SubscriptionDiscountAmountMinor)
	require.NotEmpty(t, order.SubscriptionDiscountReservationKey)
	require.NotZero(t, order.ChangeIntentId)

	var intent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&intent, "id = ?", order.ChangeIntentId).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusApplied, intent.Status)

	account, err := model.GetSubscriptionDiscountAccount(9705)
	require.NoError(t, err)
	require.Zero(t, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)

	var commit model.SubscriptionDiscountEntry
	require.NoError(t, model.DB.First(&commit, "user_id = ? AND entry_type = ?", 9705, model.SubscriptionDiscountEntryTypeCommit).Error)
	require.Equal(t, order.TradeNo, commit.TradeNo)
}

func TestSubscriptionRequestBalancePayRejectsMissingStableRequestID(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 9706)
	insertSubscriptionControllerPlan(t, 19706)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 9706)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/balance/pay",
		strings.NewReader(`{"plan_id":19706}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestBalancePay(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), "request_id is required")
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9706).Count(&orderCount).Error)
	require.Zero(t, orderCount)
}
