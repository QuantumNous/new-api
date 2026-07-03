package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type orderStatusResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Data    map[string]interface{} `json:"data"`
}

func setupOrderStatusTestDB(t *testing.T) {
	t.Helper()

	dsn := fmt.Sprintf("file:test_order_status_%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.SubscriptionOrder{}))

	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(5)

	originalDB := model.DB
	originalRedisEnabled := common.RedisEnabled
	model.DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = originalDB
		common.RedisEnabled = originalRedisEnabled
	})
}

func newOrderStatusTestContext(t *testing.T, userID int, rawURL string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", userID)
	c.Request = httptest.NewRequest(http.MethodGet, rawURL, nil)
	return c, recorder
}

func decodeOrderStatusResponse(t *testing.T, recorder *httptest.ResponseRecorder) orderStatusResponse {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)

	var payload orderStatusResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	return payload
}

func TestGetOrderStatusAutoFindsTopUp(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupOrderStatusTestDB(t)

	require.NoError(t, model.DB.Create(&model.TopUp{
		UserId:          11,
		Amount:          100,
		Money:           12.5,
		TradeNo:         "topup-auto-1",
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		Status:          common.TopUpStatusPending,
		CreateTime:      123,
	}).Error)

	c, recorder := newOrderStatusTestContext(t, 11, "/api/user/self/order/status?trade_no=topup-auto-1")
	GetOrderStatus(c)

	payload := decodeOrderStatusResponse(t, recorder)
	require.True(t, payload.Success)
	require.Equal(t, "topup", payload.Data["order_type"])
	require.Equal(t, "topup-auto-1", payload.Data["trade_no"])
	require.Equal(t, common.TopUpStatusPending, payload.Data["status"])
	require.Equal(t, float64(100), payload.Data["amount"])
}

func TestGetOrderStatusSupportsTopUpFilter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupOrderStatusTestDB(t)

	require.NoError(t, model.DB.Create(&model.TopUp{
		UserId:          12,
		Amount:          200,
		Money:           30,
		TradeNo:         "topup-filter-1",
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      456,
		CompleteTime:    789,
	}).Error)

	c, recorder := newOrderStatusTestContext(t, 12, "/api/user/self/order/status?trade_no=topup-filter-1&type=topup")
	GetOrderStatus(c)

	payload := decodeOrderStatusResponse(t, recorder)
	require.True(t, payload.Success)
	require.Equal(t, "topup", payload.Data["order_type"])
	require.Equal(t, common.TopUpStatusSuccess, payload.Data["status"])
	require.Equal(t, float64(789), payload.Data["complete_time"])
}

func TestGetOrderStatusSupportsSubscriptionFilter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupOrderStatusTestDB(t)

	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:          21,
		PlanId:          9,
		Money:           19.9,
		TradeNo:         "sub-filter-1",
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      1001,
		CompleteTime:    1002,
	}).Error)

	c, recorder := newOrderStatusTestContext(t, 21, "/api/user/self/order/status?trade_no=sub-filter-1&type=subscription")
	GetOrderStatus(c)

	payload := decodeOrderStatusResponse(t, recorder)
	require.True(t, payload.Success)
	require.Equal(t, "subscription", payload.Data["order_type"])
	require.Equal(t, "sub-filter-1", payload.Data["trade_no"])
	require.Equal(t, float64(9), payload.Data["plan_id"])
}

func TestGetOrderStatusRejectsInvalidType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupOrderStatusTestDB(t)

	c, recorder := newOrderStatusTestContext(t, 1, "/api/user/self/order/status?trade_no=abc&type=invalid")
	GetOrderStatus(c)

	payload := decodeOrderStatusResponse(t, recorder)
	require.False(t, payload.Success)
	require.NotEmpty(t, payload.Message)
}

func TestGetOrderStatusRejectsOtherUsersOrder(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupOrderStatusTestDB(t)

	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:          31,
		PlanId:          7,
		Money:           8.8,
		TradeNo:         "sub-other-user-1",
		PaymentMethod:   model.PaymentMethodCreem,
		PaymentProvider: model.PaymentProviderCreem,
		Status:          common.TopUpStatusPending,
		CreateTime:      111,
	}).Error)

	c, recorder := newOrderStatusTestContext(t, 32, "/api/user/self/order/status?trade_no=sub-other-user-1")
	GetOrderStatus(c)

	payload := decodeOrderStatusResponse(t, recorder)
	require.False(t, payload.Success)
	require.NotEmpty(t, payload.Message)
}

func TestGetOrderStatusReturnsNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupOrderStatusTestDB(t)

	c, recorder := newOrderStatusTestContext(t, 41, "/api/user/self/order/status?trade_no=missing-order&type=subscription")
	GetOrderStatus(c)

	payload := decodeOrderStatusResponse(t, recorder)
	require.False(t, payload.Success)
	require.NotEmpty(t, payload.Message)
}
