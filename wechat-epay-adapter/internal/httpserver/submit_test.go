package httpserver

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/config"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/epay"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/wechat"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newSubmitRouter(t *testing.T) (*gin.Engine, *store.Store) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, store.Migrate(db))
	database := store.New(db)
	resolver := func(context.Context, string) ([]net.IP, error) { return []net.IP{net.ParseIP("8.8.8.8")}, nil }
	policy, err := order.NewReturnURLPolicy("https://app.example.com/console/", resolver)
	require.NoError(t, err)
	appConfig := config.Config{
		EpayPartnerID: "10001", EpayKey: "shared-secret", NewAPINotifyURL: "https://api.example.com/api/user/epay/notify",
		MaxOrderAmountYuan: "5000.00",
	}
	router := gin.New()
	require.NoError(t, applySecurityMiddleware(router, SecurityOptions{}))
	router.POST(RouteSubmit, NewSubmitHandler(database, appConfig, policy).Handle)
	return router, database
}

type submitWechatClient struct {
	request wechat.NativeOrderRequest
}

func (client *submitWechatClient) CreateNativeOrder(_ context.Context, request wechat.NativeOrderRequest) (wechat.NativeOrder, error) {
	client.request = request
	return wechat.NativeOrder{CodeURL: "weixin://wxpay/bizpayurl?pr=test"}, nil
}

func (client *submitWechatClient) QueryOrder(context.Context, string) (wechat.OrderQuery, error) {
	return wechat.OrderQuery{}, nil
}
func signedSubmitForm(subject string) url.Values {
	params := map[string]string{
		"pid": "10001", "type": "wxpay", "out_trade_no": "USR1NO123", "notify_url": "https://api.example.com/api/user/epay/notify",
		"return_url": "https://app.example.com/console/billing", "name": subject, "money": "1.00", "device": "pc", "sign_type": "MD5",
	}
	params["sign"] = epay.Sign(params, "shared-secret")
	form := url.Values{}
	for name, value := range params {
		form.Set(name, value)
	}
	return form
}

func submitRequest(form url.Values, cookie *http.Cookie) *http.Request {
	request := httptest.NewRequest(http.MethodPost, RouteSubmit, strings.NewReader(form.Encode()))
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if cookie != nil {
		request.AddCookie(cookie)
	}
	return request
}

func TestSubmitCreatesOrderAndCookieBasedIdempotentRedirect(t *testing.T) {
	router, database := newSubmitRouter(t)
	first := httptest.NewRecorder()
	router.ServeHTTP(first, submitRequest(signedSubmitForm("TUC100"), nil))
	require.Equal(t, http.StatusSeeOther, first.Code)
	firstLocation := first.Header().Get("Location")
	assert.Regexp(t, `^/cashier/[A-Za-z0-9_-]{43}$`, firstLocation)
	cookies := first.Result().Cookies()
	require.Len(t, cookies, 1)
	assert.True(t, cookies[0].HttpOnly)
	assert.True(t, cookies[0].Secure)

	repeated := httptest.NewRecorder()
	router.ServeHTTP(repeated, submitRequest(signedSubmitForm("TUC100"), cookies[0]))
	assert.Equal(t, http.StatusSeeOther, repeated.Code)
	assert.Equal(t, firstLocation, repeated.Header().Get("Location"))

	var count int64
	require.NoError(t, database.DB().Model(&store.PaymentOrder{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestSubmitUsesWechatCallbackForNativeOrder(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, store.Migrate(db))
	database := store.New(db)
	resolver := func(context.Context, string) ([]net.IP, error) { return []net.IP{net.ParseIP("8.8.8.8")}, nil }
	policy, err := order.NewReturnURLPolicy("https://app.example.com/console/", resolver)
	require.NoError(t, err)
	client := &submitWechatClient{}
	nativeOrders := order.NewNativeOrderService(database, client)
	appConfig := config.Config{
		EpayPartnerID: "10001", EpayKey: "shared-secret", NewAPINotifyURL: "https://api.example.com/api/user/epay/notify",
		WechatNotifyURL: "https://pay.example.com/api/v1/wechat/notify", MaxOrderAmountYuan: "5000.00",
	}
	router := gin.New()
	require.NoError(t, applySecurityMiddleware(router, SecurityOptions{}))
	router.POST(RouteSubmit, NewSubmitHandler(database, appConfig, policy, nativeOrders).Handle)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, submitRequest(signedSubmitForm("TUC100"), nil))
	require.Equal(t, http.StatusSeeOther, response.Code)
	assert.Equal(t, appConfig.WechatNotifyURL, client.request.NotifyURL)
	assert.NotEqual(t, appConfig.NewAPINotifyURL, client.request.NotifyURL)
}
func TestSubmitRejectsConflictingOrderAndAuditsIt(t *testing.T) {
	router, database := newSubmitRouter(t)
	first := httptest.NewRecorder()
	router.ServeHTTP(first, submitRequest(signedSubmitForm("TUC100"), nil))
	require.Equal(t, http.StatusSeeOther, first.Code)

	conflict := httptest.NewRecorder()
	router.ServeHTTP(conflict, submitRequest(signedSubmitForm("TUC200"), nil))
	assert.Equal(t, http.StatusConflict, conflict.Code)
	assert.NotContains(t, conflict.Body.String(), "shared-secret")

	var audits int64
	require.NoError(t, database.DB().Model(&store.PaymentAuditEvent{}).Where("event_type = ?", "ORDER_CONFLICT").Count(&audits).Error)
	assert.Equal(t, int64(1), audits)
}
