package httpserver

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newCashierRouter(t *testing.T, status order.Status, codeURL *string) (*gin.Engine, string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, store.Migrate(db))
	database := store.New(db)
	token := "0123456789abcdefghijklmnopqrstuvwxyz-ABCDEF"
	returnURL := "https://app.example.com/console/billing"
	paymentOrder := store.PaymentOrder{
		ID: "cashier-order", OutTradeNo: "cashier-out-trade-no", GatewayTradeNo: "cashier-gateway", RequestFingerprint: "cashier-fingerprint",
		EpayPID: "10001", PaymentType: "wxpay", Subject: "Top up", AmountText: "1.00", AmountFen: 100,
		NotifyURL: "https://pay.example.com/api/v1/wechat/notify", ReturnURL: &returnURL, CashierTokenHash: order.HashCashierToken(token),
		Status: status, WechatCodeURL: codeURL, ExpiresAt: time.Now().UTC().Add(10 * time.Minute), Version: 1,
	}
	require.NoError(t, database.DB().Create(&paymentOrder).Error)
	policy, err := order.NewReturnURLPolicy("https://app.example.com/console/", func(context.Context, string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("8.8.8.8")}, nil
	})
	require.NoError(t, err)
	router := New(db)
	cashier := NewCashierHandler(database, policy)
	router.GET("/cashier/:access_token", cashier.Show)
	router.GET("/api/v1/cashier/:access_token/status", cashier.Status)
	_, err = database.FindPaymentOrderByCashierTokenHash(order.HashCashierToken(token))
	require.NoError(t, err)
	return router, token
}

func TestCashierShowsQRCodeOnlyForPayableOrder(t *testing.T) {
	codeURL := "weixin://wxpay/bizpayurl?pr=payment-code"
	router, token := newCashierRouter(t, order.StatusPayable, &codeURL)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/cashier/"+token, nil))

	require.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Body.String(), "payment-code")
	assert.Contains(t, response.Body.String(), "data:image/png;base64,")
	assert.Contains(t, response.Body.String(), "请使用微信扫码完成支付")
	assert.Contains(t, response.Body.String(), "checkStatus();")
	assert.Contains(t, response.Body.String(), "setInterval(checkStatus, 2000)")
	assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))
}

func TestCashierHidesQRCodeForNonPayableOrder(t *testing.T) {
	codeURL := "weixin://wxpay/bizpayurl?pr=payment-code"
	router, token := newCashierRouter(t, order.StatusCreateFailed, &codeURL)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/cashier/"+token, nil))

	require.Equal(t, http.StatusOK, response.Code)
	assert.NotContains(t, response.Body.String(), `<img id="payment-code"`)
	assert.NotContains(t, response.Body.String(), "payment-code\" alt")
}

func TestCashierStatusIsReadOnlyAndRedirectsOnlyAfterNotification(t *testing.T) {
	router, token := newCashierRouter(t, order.StatusNotified, nil)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/cashier/"+token+"/status", nil))

	require.Equal(t, http.StatusOK, response.Code)
	assert.JSONEq(t, `{"out_trade_no":"cashier-out-trade-no","subject":"Top up","amount":"1.00","status":"NOTIFIED","redirect_allowed":true,"return_url":"https://app.example.com/console/billing"}`, withoutTimes(response.Body.String()))
	assert.NotContains(t, response.Body.String(), "code_url")
	assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))
}

func TestCashierRejectsUnknownAccessTokenWithoutDisclosure(t *testing.T) {
	router, _ := newCashierRouter(t, order.StatusPayable, nil)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/cashier/0123456789abcdefghijklmnopqrstuvwxyz-ABCDX1", nil))

	assert.Equal(t, http.StatusNotFound, response.Code)
	assert.NotContains(t, response.Body.String(), "cashier-out-trade-no")
}

func withoutTimes(body string) string {
	var response map[string]any
	if err := json.Unmarshal([]byte(body), &response); err != nil {
		return body
	}
	delete(response, "expires_at")
	delete(response, "paid_at")
	delete(response, "notified_at")
	result, err := json.Marshal(response)
	if err != nil {
		return body
	}
	return string(result)
}
