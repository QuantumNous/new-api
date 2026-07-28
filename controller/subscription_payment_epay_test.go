package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSubscriptionRequestEpayInvitationDiscountUsesPurchasePathAndKeepsEpayProvider(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	configureSubscriptionEpayAllowedMethod(t, model.SubscriptionPaymentMethodAlipay, true)
	insertSubscriptionControllerUser(t, 9701)
	insertSubscriptionControllerPlan(t, 19701)
	grantSubscriptionControllerDiscount(t, 9701, 500, "epay-invitation-discount")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 9701)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/epay/pay",
		strings.NewReader(`{"plan_id":19701,"payment_method":"alipay","request_id":"legacy-epay-invitation-discount"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestEpay(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)
	require.Contains(t, recorder.Body.String(), `"message":"success"`)
	require.NotContains(t, recorder.Body.String(), `"url":""`)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "user_id = ? AND plan_id = ?", 9701, 19701).Error)
	require.Equal(t, model.PaymentProviderEpay, order.PaymentProvider)
	require.Equal(t, model.SubscriptionPaymentMethodAlipay, order.PaymentMethod)
	require.Equal(t, common.TopUpStatusPending, order.Status)
	require.Equal(t, int64(500), order.SubscriptionDiscountUSDMinor)
	require.Equal(t, int64(500), order.SubscriptionDiscountAmountMinor)
	require.NotEmpty(t, order.SubscriptionDiscountReservationKey)
	require.Zero(t, order.DiscountUSD)
	require.NotZero(t, order.ChangeIntentId)

	var intent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&intent, "id = ?", order.ChangeIntentId).Error)
	require.Equal(t, model.SubscriptionChangeIntentKindPurchase, intent.Kind)
	require.Equal(t, model.SubscriptionPaymentModePrepaid, intent.PaymentMode)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, intent.Status)
	require.Equal(t, 19701, intent.ToPlanId)

	account, err := model.GetSubscriptionDiscountAccount(9701)
	require.NoError(t, err)
	require.Zero(t, account.AvailableUSDMinor)
	require.Equal(t, int64(500), account.ReservedUSDMinor)

	var reserve model.SubscriptionDiscountEntry
	require.NoError(t, model.DB.First(&reserve, "user_id = ? AND entry_type = ?", 9701, model.SubscriptionDiscountEntryTypeReserve).Error)
	require.Equal(t, order.Id, reserve.OrderID)
	require.Equal(t, order.TradeNo, reserve.TradeNo)
}

func TestSubscriptionRequestEpayFullDiscountCompletesWithoutGatewayConfiguration(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	configureSubscriptionEpayAllowedMethod(t, model.SubscriptionPaymentMethodPix, false)
	insertSubscriptionControllerUser(t, 9702)
	insertSubscriptionControllerPlan(t, 19702)
	grantSubscriptionControllerDiscount(t, 9702, 999, "epay-full-discount")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 9702)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/epay/pay",
		strings.NewReader(`{"plan_id":19702,"payment_method":"pix","request_id":"legacy-epay-full-discount"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestEpay(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)
	require.Contains(t, recorder.Body.String(), `"message":"success"`)
	require.NotContains(t, recorder.Body.String(), `"url":""`)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "user_id = ? AND plan_id = ?", 9702, 19702).Error)
	require.Equal(t, model.PaymentProviderEpay, order.PaymentProvider)
	require.Equal(t, model.SubscriptionPaymentMethodPix, order.PaymentMethod)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)
	require.Zero(t, order.PaymentAmountMinor)
	require.Zero(t, order.Money)
	require.Equal(t, int64(999), order.SubscriptionDiscountUSDMinor)
	require.Equal(t, int64(999), order.SubscriptionDiscountAmountMinor)
	require.NotEmpty(t, order.SubscriptionDiscountReservationKey)
	require.Zero(t, order.DiscountUSD)

	var intent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&intent, "id = ?", order.ChangeIntentId).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusApplied, intent.Status)

	var entitlement model.UserSubscription
	require.NoError(t, model.DB.First(&entitlement, "user_id = ? AND plan_id = ? AND status = ?", 9702, 19702, "active").Error)
	require.Equal(t, int64(1000), entitlement.AmountTotal)

	account, err := model.GetSubscriptionDiscountAccount(9702)
	require.NoError(t, err)
	require.Zero(t, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)

	var commit model.SubscriptionDiscountEntry
	require.NoError(t, model.DB.First(&commit, "user_id = ? AND entry_type = ?", 9702, model.SubscriptionDiscountEntryTypeCommit).Error)
	require.Equal(t, order.TradeNo, commit.TradeNo)
}

func TestCompleteEpaySubscriptionOrderDoesNotFallbackForUnifiedOrder(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	configureSubscriptionEpayAllowedMethod(t, model.SubscriptionPaymentMethodAlipay, true)
	insertSubscriptionControllerUser(t, 9703)
	insertSubscriptionControllerPlan(t, 19703)
	grantSubscriptionControllerDiscount(t, 9703, 500, "epay-no-legacy-fallback")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 9703)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/epay/pay",
		strings.NewReader(`{"plan_id":19703,"payment_method":"alipay","request_id":"epay-no-legacy-fallback"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestEpay(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "user_id = ? AND plan_id = ?", 9703, 19703).Error)
	require.NotZero(t, order.ChangeIntentId)
	require.NoError(t, model.DB.Model(&order).Update("plan_snapshot", "").Error)

	err := completeEpaySubscriptionOrder(context.Background(), order.TradeNo, `{}`, model.SubscriptionPaymentMethodAlipay)
	require.Error(t, err)
	require.NoError(t, model.DB.First(&order, "id = ?", order.Id).Error)
	require.Equal(t, common.TopUpStatusPending, order.Status)

	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", 9703).Count(&entitlementCount).Error)
	require.Zero(t, entitlementCount)

	account, accountErr := model.GetSubscriptionDiscountAccount(9703)
	require.NoError(t, accountErr)
	require.Zero(t, account.AvailableUSDMinor)
	require.Equal(t, int64(500), account.ReservedUSDMinor)
}

func TestSubscriptionRequestEpayGatewayConfigurationFailureReleasesReservation(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	configureSubscriptionEpayAllowedMethod(t, model.SubscriptionPaymentMethodAlipay, false)
	insertSubscriptionControllerUser(t, 9704)
	insertSubscriptionControllerPlan(t, 19704)
	grantSubscriptionControllerDiscount(t, 9704, 500, "epay-gateway-failure-release")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 9704)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/epay/pay",
		strings.NewReader(`{"plan_id":19704,"payment_method":"alipay","request_id":"epay-gateway-failure-release"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestEpay(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "payment information is not configured")

	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "user_id = ? AND plan_id = ?", 9704, 19704).Error)
	require.Equal(t, common.TopUpStatusFailed, order.Status)
	require.NotZero(t, order.ChangeIntentId)

	var intent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&intent, "id = ?", order.ChangeIntentId).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusFailed, intent.Status)

	account, err := model.GetSubscriptionDiscountAccount(9704)
	require.NoError(t, err)
	require.Equal(t, int64(500), account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)

	var release model.SubscriptionDiscountEntry
	require.NoError(t, model.DB.First(&release, "user_id = ? AND entry_type = ?", 9704, model.SubscriptionDiscountEntryTypeRelease).Error)
	require.Equal(t, order.TradeNo, release.TradeNo)
}

func configureSubscriptionEpayAllowedMethod(t *testing.T, paymentMethod string, withGateway bool) {
	t.Helper()
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
	})
	operation_setting.PayMethods = []map[string]string{{"type": paymentMethod}}
	if withGateway {
		operation_setting.PayAddress = "https://pay.example.com"
		operation_setting.EpayId = "epay_id"
		operation_setting.EpayKey = "epay_key"
		return
	}
	operation_setting.PayAddress = ""
	operation_setting.EpayId = ""
	operation_setting.EpayKey = ""
}

func grantSubscriptionControllerDiscount(t *testing.T, userID int, amountUSDMinor int64, key string) {
	t.Helper()
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.GrantSubscriptionDiscountTx(tx, model.SubscriptionDiscountGrantInput{
			UserID:          userID,
			USDMinor:        amountUSDMinor,
			EntryType:       model.SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType:      "test_invitation",
			SourceKey:       key,
			IdempotencyKey:  key,
			PricingSnapshot: `{"source":"test"}`,
		})
		return err
	}))
}
