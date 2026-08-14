package observability

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMetricsExposeOnlyBoundedLabelsAndStateCounts(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, store.Migrate(db))
	database := store.New(db)
	require.NoError(t, database.DB().Create(&store.PaymentOrder{
		ID: "metrics-order", OutTradeNo: "sensitive-order-number", GatewayTradeNo: "gateway", RequestFingerprint: "fingerprint",
		EpayPID: "10001", PaymentType: "wxpay", Subject: "Top up", AmountText: "1.00", AmountFen: 100,
		NotifyURL: "https://pay.example.com/notify", CashierTokenHash: "token-hash", Status: order.StatusPayable,
		ExpiresAt: time.Now().UTC().Add(time.Hour), Version: 1,
	}).Error)

	metrics := NewMetrics(database)
	metrics.ObserveRequest("/api/v1/cashier/:access_token/status", http.MethodGet, http.StatusOK, 20*time.Millisecond)
	response := httptest.NewRecorder()
	metrics.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/metrics", nil))

	require.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Body.String(), `payment_order_state{state="PAYABLE"} 1`)
	assert.Contains(t, response.Body.String(), `route="/api/v1/cashier/:access_token/status",method="GET",status="200"`)
	assert.NotContains(t, response.Body.String(), "sensitive-order-number")
	assert.NotContains(t, response.Body.String(), "https://pay.example.com/notify")
}
