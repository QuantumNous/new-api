package httpserver

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/config"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/wechat"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type fakeNotificationVerifier struct {
	notice wechat.PaymentNotice
	err    error
}

func (f fakeNotificationVerifier) VerifyAndDecrypt(_ context.Context, headers wechat.NotificationHeaders, body []byte) (wechat.PaymentNotice, error) {
	if headers.Timestamp == "" || headers.Nonce == "" || headers.Signature == "" || headers.Serial == "" || string(body) != "signed-body" {
		return wechat.PaymentNotice{}, errors.New("unexpected notification")
	}
	return f.notice, f.err
}

func newWechatNotificationRouter(t *testing.T, verifier wechat.NotificationVerifier) (*gin.Engine, *store.Store, store.PaymentOrder) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, store.Migrate(db))
	database := store.New(db)
	paymentOrder := store.PaymentOrder{
		ID: "notify-order", OutTradeNo: "notify-out-trade", GatewayTradeNo: "notify-gateway", RequestFingerprint: "notify-fingerprint",
		EpayPID: "10001", PaymentType: "wxpay", Subject: "Top up", AmountText: "1.00", AmountFen: 100,
		NotifyURL: "https://pay.example.com/api/v1/wechat/notify", CashierTokenHash: "notify-token", Status: order.StatusPayable,
		ExpiresAt: time.Now().UTC().Add(15 * time.Minute), Version: 1,
	}
	require.NoError(t, database.DB().Create(&paymentOrder).Error)
	router := gin.New()
	router.POST(RouteWechatNotification, NewWechatNotificationHandler(database, verifier, config.Config{WechatMerchantID: "merchant", WechatAppID: "app"}).Handle)
	return router, database, paymentOrder
}

func notificationRequest() *http.Request {
	request := httptest.NewRequest(http.MethodPost, RouteWechatNotification, strings.NewReader("signed-body"))
	request.Header.Set("Wechatpay-Timestamp", "1")
	request.Header.Set("Wechatpay-Nonce", "nonce")
	request.Header.Set("Wechatpay-Signature", "signature")
	request.Header.Set("Wechatpay-Serial", "key-id")
	return request
}

func TestWechatNotificationPersistsVerifiedMatchingPayment(t *testing.T) {
	notice := wechat.PaymentNotice{
		NotificationID: "notice-1", MerchantOrderNo: "notify-out-trade", WechatOrderNo: "wechat-1", MerchantID: "merchant", AppID: "app",
		TradeState: wechat.TradeStateSuccess, AmountFen: 100, Currency: wechat.CurrencyCNY, PaidAt: time.Now().UTC(),
	}
	router, database, paymentOrder := newWechatNotificationRouter(t, fakeNotificationVerifier{notice: notice})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, notificationRequest())
	require.Equal(t, http.StatusNoContent, response.Code)
	var actual store.PaymentOrder
	require.NoError(t, database.DB().First(&actual, "id = ?", paymentOrder.ID).Error)
	assert.Equal(t, order.StatusPaidPendingNotify, actual.Status)
}

func TestWechatNotificationRejectsInvalidSignature(t *testing.T) {
	router, database, paymentOrder := newWechatNotificationRouter(t, fakeNotificationVerifier{err: wechat.ErrInvalidNotice})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, notificationRequest())
	assert.Equal(t, http.StatusBadRequest, response.Code)
	var actual store.PaymentOrder
	require.NoError(t, database.DB().First(&actual, "id = ?", paymentOrder.ID).Error)
	assert.Equal(t, order.StatusPayable, actual.Status)
}

func TestWechatNotificationAcknowledgesUnknownOrderWithoutSettlement(t *testing.T) {
	notice := wechat.PaymentNotice{NotificationID: "notice-missing", MerchantOrderNo: "missing-order", MerchantID: "merchant", AppID: "app", TradeState: wechat.TradeStateSuccess, AmountFen: 100, Currency: wechat.CurrencyCNY, WechatOrderNo: "wechat-missing", PaidAt: time.Now().UTC()}
	router, database, _ := newWechatNotificationRouter(t, fakeNotificationVerifier{notice: notice})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, notificationRequest())
	assert.Equal(t, http.StatusOK, response.Code)
	var taskCount int64
	require.NoError(t, database.DB().Model(&store.NotificationTask{}).Count(&taskCount).Error)
	assert.Zero(t, taskCount)
}
