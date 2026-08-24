package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCreemCheckoutCompletedCorrectsFailedTopUp(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	insertStripeFulfillmentUser(t, 910)
	topUp := &model.TopUp{
		UserId:          910,
		Amount:          7,
		Money:           7,
		PaymentCurrency: "USD",
		TradeNo:         "creem-corrected-failed",
		PaymentMethod:   model.PaymentMethodCreem,
		PaymentProvider: model.PaymentProviderCreem,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	require.NoError(t, model.UpdatePendingTopUpStatus(topUp.TradeNo, model.PaymentProviderCreem, common.TopUpStatusFailed))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/creem/webhook", nil)
	event := &CreemWebhookEvent{
		Id:        "evt_creem_corrected_failed",
		EventType: "checkout.completed",
	}
	event.Object.RequestId = topUp.TradeNo
	event.Object.Order.Id = "order_creem_corrected_failed"
	event.Object.Order.Status = "paid"
	event.Object.Order.Type = "onetime"
	event.Object.Order.AmountPaid = 700
	event.Object.Order.Currency = "USD"
	event.Object.Customer.Email = "paid@example.com"
	event.Object.Customer.Name = "Paid User"

	handleCheckoutCompleted(ctx, event)

	require.Equal(t, http.StatusOK, recorder.Code)
	stored := model.GetTopUpByTradeNo(topUp.TradeNo)
	require.NotNil(t, stored)
	require.Equal(t, common.TopUpStatusSuccess, stored.Status)
	require.Equal(t, 7, stripeFulfillmentUserQuota(t, 910))
}

func TestRequestCreemPayMarksOrderFailedWhenCheckoutLinkCreationFails(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalProducts := setting.CreemProducts
	originalAPIKey := setting.CreemApiKey
	t.Cleanup(func() {
		setting.CreemProducts = originalProducts
		setting.CreemApiKey = originalAPIKey
	})
	setting.CreemProducts = `[{"productId":"prod_fail","name":"Fail Plan","price":3.5,"currency":"USD","quota":9}]`
	setting.CreemApiKey = ""
	insertStripeFulfillmentUser(t, 911)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 911)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/creem/pay", bytes.NewBufferString(`{"product_id":"prod_fail","payment_method":"creem"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	RequestCreemPay(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var topUps []model.TopUp
	require.NoError(t, model.DB.Where("user_id = ? AND payment_provider = ?", 911, model.PaymentProviderCreem).Find(&topUps).Error)
	require.Len(t, topUps, 1)
	require.Equal(t, common.TopUpStatusFailed, topUps[0].Status)
	var failureEvents int64
	require.NoError(t, model.DB.Model(&model.RecallLifecycleEvent{}).Where("event_type = ? AND scope_id = ?", model.RecallLifecycleTriggerPaymentFailed, topUps[0].TradeNo).Count(&failureEvents).Error)
	require.EqualValues(t, 1, failureEvents)
}
