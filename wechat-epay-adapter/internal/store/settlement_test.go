package store

import (
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/wechat"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfirmWechatPaymentPersistsOrderAndSingleNotificationTask(t *testing.T) {
	repository := newTestStore(t)
	paymentOrder := testOrder("settlement")
	paymentOrder.Status = order.StatusPayable
	require.NoError(t, repository.DB().Create(&paymentOrder).Error)
	notice := wechat.PaymentNotice{
		NotificationID: "notice-1", MerchantOrderNo: paymentOrder.OutTradeNo, WechatOrderNo: "wechat-1",
		MerchantID: "merchant", AppID: "app", TradeState: wechat.TradeStateSuccess,
		AmountFen: paymentOrder.AmountFen, Currency: wechat.CurrencyCNY, PaidAt: time.Now().UTC(),
	}
	result, err := repository.ConfirmWechatPayment(ConfirmWechatPaymentInput{Notice: notice, ExpectedMerchant: "merchant", ExpectedAppID: "app"})
	require.NoError(t, err)
	assert.False(t, result.Idempotent)

	var actual PaymentOrder
	require.NoError(t, repository.DB().First(&actual, "id = ?", paymentOrder.ID).Error)
	assert.Equal(t, order.StatusPaidPendingNotify, actual.Status)
	require.NotNil(t, actual.WechatTransactionID)
	assert.Equal(t, "wechat-1", *actual.WechatTransactionID)
	var taskCount int64
	require.NoError(t, repository.DB().Model(&NotificationTask{}).Where("order_id = ?", paymentOrder.ID).Count(&taskCount).Error)
	assert.Equal(t, int64(1), taskCount)
	var task NotificationTask
	require.NoError(t, repository.DB().First(&task, "order_id = ?", paymentOrder.ID).Error)
	var payload NotificationPayload
	require.NoError(t, json.Unmarshal([]byte(task.PayloadSnapshot), &payload))
	assert.Equal(t, paymentOrder.GatewayTradeNo, payload.GatewayTradeNo)
	assert.Equal(t, paymentOrder.AmountText, payload.AmountText)

	duplicate, err := repository.ConfirmWechatPayment(ConfirmWechatPaymentInput{Notice: notice, ExpectedMerchant: "merchant", ExpectedAppID: "app"})
	require.NoError(t, err)
	assert.True(t, duplicate.Idempotent)
	require.NoError(t, repository.DB().Model(&NotificationTask{}).Where("order_id = ?", paymentOrder.ID).Count(&taskCount).Error)
	assert.Equal(t, int64(1), taskCount)
}

func TestConfirmWechatPaymentConcurrentDuplicateNoticesCreateOneTask(t *testing.T) {
	repository := newTestStore(t)
	paymentOrder := testOrder("concurrent-settlement")
	paymentOrder.Status = order.StatusPayable
	require.NoError(t, repository.DB().Create(&paymentOrder).Error)
	notice := wechat.PaymentNotice{
		NotificationID: "notice-concurrent", MerchantOrderNo: paymentOrder.OutTradeNo, WechatOrderNo: "wechat-concurrent",
		MerchantID: "merchant", AppID: "app", TradeState: wechat.TradeStateSuccess,
		AmountFen: paymentOrder.AmountFen, Currency: wechat.CurrencyCNY, PaidAt: time.Now().UTC(),
	}
	const callers = 10
	errors := make(chan error, callers)
	start := make(chan struct{})
	var group sync.WaitGroup
	for i := 0; i < callers; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			<-start
			_, err := repository.ConfirmWechatPayment(ConfirmWechatPaymentInput{Notice: notice, ExpectedMerchant: "merchant", ExpectedAppID: "app"})
			errors <- err
		}()
	}
	close(start)
	group.Wait()
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}
	var taskCount int64
	require.NoError(t, repository.DB().Model(&NotificationTask{}).Where("order_id = ?", paymentOrder.ID).Count(&taskCount).Error)
	assert.Equal(t, int64(1), taskCount)
	var actual PaymentOrder
	require.NoError(t, repository.DB().First(&actual, "id = ?", paymentOrder.ID).Error)
	assert.Equal(t, order.StatusPaidPendingNotify, actual.Status)
}

func TestConfirmWechatPaymentRollsBackWhenTaskCreationFails(t *testing.T) {
	repository := newTestStore(t)
	paymentOrder := testOrder("rollback-payment")
	paymentOrder.Status = order.StatusPayable
	require.NoError(t, repository.DB().Create(&paymentOrder).Error)
	repository.confirmPaymentHook = func() error { return errors.New("injected notification task failure") }
	notice := wechat.PaymentNotice{
		NotificationID: "notice-rollback", MerchantOrderNo: paymentOrder.OutTradeNo, WechatOrderNo: "wechat-rollback",
		MerchantID: "merchant", AppID: "app", TradeState: wechat.TradeStateSuccess,
		AmountFen: paymentOrder.AmountFen, Currency: wechat.CurrencyCNY, PaidAt: time.Now().UTC(),
	}
	_, err := repository.ConfirmWechatPayment(ConfirmWechatPaymentInput{Notice: notice, ExpectedMerchant: "merchant", ExpectedAppID: "app"})
	require.EqualError(t, err, "injected notification task failure")
	var actual PaymentOrder
	require.NoError(t, repository.DB().First(&actual, "id = ?", paymentOrder.ID).Error)
	assert.Equal(t, order.StatusPayable, actual.Status)
	assert.Nil(t, actual.WechatTransactionID)
	var taskCount int64
	require.NoError(t, repository.DB().Model(&NotificationTask{}).Count(&taskCount).Error)
	assert.Zero(t, taskCount)
}

func TestConfirmWechatPaymentSendsMismatchedOrderToManualReview(t *testing.T) {
	repository := newTestStore(t)
	paymentOrder := testOrder("mismatch")
	paymentOrder.Status = order.StatusPayable
	require.NoError(t, repository.DB().Create(&paymentOrder).Error)
	notice := wechat.PaymentNotice{
		NotificationID: "notice-mismatch", MerchantOrderNo: paymentOrder.OutTradeNo, WechatOrderNo: "wechat-mismatch",
		MerchantID: "merchant", AppID: "app", TradeState: wechat.TradeStateSuccess,
		AmountFen: paymentOrder.AmountFen + 1, Currency: wechat.CurrencyCNY, PaidAt: time.Now().UTC(),
	}
	_, err := repository.ConfirmWechatPayment(ConfirmWechatPaymentInput{Notice: notice, ExpectedMerchant: "merchant", ExpectedAppID: "app"})
	require.NoError(t, err)
	var actual PaymentOrder
	require.NoError(t, repository.DB().First(&actual, "id = ?", paymentOrder.ID).Error)
	assert.Equal(t, order.StatusManualReview, actual.Status)
}

func TestConfirmWechatPaymentAcceptsUnknownOrderWithoutTask(t *testing.T) {
	repository := newTestStore(t)
	result, err := repository.ConfirmWechatPayment(ConfirmWechatPaymentInput{Notice: wechat.PaymentNotice{MerchantOrderNo: "missing"}, ExpectedMerchant: "merchant", ExpectedAppID: "app"})
	require.NoError(t, err)
	assert.True(t, result.UnknownOrder)
	var taskCount int64
	require.NoError(t, repository.DB().Model(&NotificationTask{}).Count(&taskCount).Error)
	assert.Zero(t, taskCount)
}
