package httpserver

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/admin"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const testAdminToken = "admin-token-which-is-long-enough-for-tests"

func newAdminRouter(t *testing.T, paymentStatus order.Status, taskState order.NotificationState) (*gin.Engine, *store.Store, store.PaymentOrder, store.NotificationTask) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, store.Migrate(db))
	database := store.New(db)
	now := time.Now().UTC().Add(-time.Minute)
	transactionID := "42000012345678901234"
	paymentOrder := store.PaymentOrder{
		ID: "admin-order-id", OutTradeNo: "admin-out-trade-no", GatewayTradeNo: "admin-gateway", RequestFingerprint: "admin-fingerprint",
		EpayPID: "10001", PaymentType: "wxpay", Subject: "Top up", AmountText: "1.00", AmountFen: 100,
		NotifyURL: "https://pay.example.com/api/v1/wechat/notify", CashierTokenHash: "cashier-token-hash",
		Status: paymentStatus, WechatTransactionID: &transactionID, ExpiresAt: now.Add(time.Hour), PaidAt: &now, Version: 1,
	}
	require.NoError(t, database.DB().Create(&paymentOrder).Error)
	leaseOwner := "worker-a"
	leaseUntil := now.Add(time.Minute)
	lastError := "notification delivery failed"
	nextAttempt := now.Add(30 * time.Minute)
	task := store.NotificationTask{
		ID: "admin-notification-task", OrderID: paymentOrder.ID, State: taskState, PayloadSnapshot: "{}", AttemptCount: 3,
		NextAttemptAt: nextAttempt, LeaseOwner: &leaseOwner, LeaseUntil: &leaseUntil, LastError: &lastError, Version: 4,
	}
	require.NoError(t, database.DB().Create(&task).Error)
	router := New(db)
	handler := NewAdminHandler(admin.New(database))
	routes := router.Group("/api/v1/admin", AdminBearer(testAdminToken))
	routes.GET("/orders/:out_trade_no", handler.GetOrder)
	routes.POST("/orders/:out_trade_no/retry-notification", handler.RetryNotification)
	return router, database, paymentOrder, task
}

func adminRequest(method, path, body string, authorized bool) *http.Request {
	request := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	if authorized {
		request.Header.Set("Authorization", "Bearer "+testAdminToken)
	}
	return request
}

func TestAdminOrderRequiresBearerAndMasksTransactionID(t *testing.T) {
	router, _, _, _ := newAdminRouter(t, order.StatusPaidPendingNotify, order.NotificationRetry)

	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, adminRequest(http.MethodGet, "/api/v1/admin/orders/admin-out-trade-no", "", false))
	require.Equal(t, http.StatusUnauthorized, unauthorized.Code)
	assert.JSONEq(t, `{"error":"unauthorized"}`, unauthorized.Body.String())

	authorized := httptest.NewRecorder()
	router.ServeHTTP(authorized, adminRequest(http.MethodGet, "/api/v1/admin/orders/admin-out-trade-no", "", true))
	require.Equal(t, http.StatusOK, authorized.Code)
	assert.Contains(t, authorized.Body.String(), `"wechat_trade_no":"****1234"`)
	assert.NotContains(t, authorized.Body.String(), "42000012345678901234")
	assert.Contains(t, authorized.Body.String(), `"notification_status":"RETRY"`)
}

func TestAdminRetryReusesRetryAndDeadTasks(t *testing.T) {
	for _, state := range []order.NotificationState{order.NotificationRetry, order.NotificationDead} {
		t.Run(string(state), func(t *testing.T) {
			router, database, _, originalTask := newAdminRouter(t, order.StatusPaidPendingNotify, state)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, adminRequest(http.MethodPost, "/api/v1/admin/orders/admin-out-trade-no/retry-notification", `{"reason":"verified by operations"}`, true))

			require.Equal(t, StatusNotificationRetryAccepted, response.Code)
			var task store.NotificationTask
			require.NoError(t, database.DB().First(&task, "id = ?", originalTask.ID).Error)
			assert.Equal(t, order.NotificationPending, task.State)
			assert.Nil(t, task.LeaseOwner)
			assert.Nil(t, task.LeaseUntil)
			assert.Equal(t, originalTask.Version+1, task.Version)
			assert.Equal(t, originalTask.ID, task.ID)
			var audit store.PaymentAuditEvent
			require.NoError(t, database.DB().Where("event_type = ?", "ADMIN_NOTIFICATION_RETRY").First(&audit).Error)
			assert.Equal(t, "ADMIN", audit.ActorType)
			assert.Equal(t, "SUCCESS", audit.Result)
			assert.Contains(t, *audit.Metadata, "verified by operations")
		})
	}
}

func TestAdminRetryDoesNotRequeueNotifiedOrder(t *testing.T) {
	router, database, paymentOrder, originalTask := newAdminRouter(t, order.StatusNotified, order.NotificationSucceeded)
	notifiedAt := time.Now().UTC().Add(-time.Minute)
	require.NoError(t, database.DB().Model(&store.PaymentOrder{}).Where("id = ?", paymentOrder.ID).Update("notified_at", notifiedAt).Error)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, adminRequest(http.MethodPost, "/api/v1/admin/orders/admin-out-trade-no/retry-notification", `{"reason":"duplicate operator action"}`, true))

	require.Equal(t, http.StatusOK, response.Code)
	var task store.NotificationTask
	require.NoError(t, database.DB().First(&task, "id = ?", originalTask.ID).Error)
	assert.Equal(t, order.NotificationSucceeded, task.State)
	assert.Equal(t, originalTask.Version, task.Version)
}

func TestAdminRetryRejectsUnpaidOrder(t *testing.T) {
	router, _, _, _ := newAdminRouter(t, order.StatusPayable, order.NotificationRetry)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, adminRequest(http.MethodPost, "/api/v1/admin/orders/admin-out-trade-no/retry-notification", `{"reason":"must not run"}`, true))

	require.Equal(t, http.StatusConflict, response.Code)
	assert.JSONEq(t, `{"error":"not_ready"}`, response.Body.String())
}

func TestAdminRetryRejectsSensitiveAuditReason(t *testing.T) {
	router, _, _, _ := newAdminRouter(t, order.StatusPaidPendingNotify, order.NotificationRetry)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, adminRequest(http.MethodPost, "/api/v1/admin/orders/admin-out-trade-no/retry-notification", `{"reason":"token=must-not-be-persisted"}`, true))

	require.Equal(t, http.StatusBadRequest, response.Code)
	assert.JSONEq(t, `{"error":"invalid_request"}`, response.Body.String())
}
