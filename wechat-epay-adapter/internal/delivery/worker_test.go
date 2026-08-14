package delivery

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/config"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return f(request) }

func newWorkerFixture(t *testing.T) (*store.Store, store.NotificationTask, config.Config) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, store.Migrate(db))
	repository := store.New(db)
	paymentOrder := store.PaymentOrder{
		ID: "delivery-order", OutTradeNo: "delivery-out-trade", GatewayTradeNo: "delivery-gateway", RequestFingerprint: "delivery-fingerprint",
		EpayPID: "10001", PaymentType: "wxpay", Subject: "Top up", AmountText: "1.00", AmountFen: 100,
		NotifyURL: "https://api.example.com/api/user/epay/notify", CashierTokenHash: "delivery-token", Status: order.StatusPaidPendingNotify,
		ExpiresAt: time.Now().UTC().Add(15 * time.Minute), Version: 1,
	}
	require.NoError(t, repository.DB().Create(&paymentOrder).Error)
	payload, err := json.Marshal(store.NotificationPayload{
		PartnerID: paymentOrder.EpayPID, PaymentType: paymentOrder.PaymentType, MerchantOrderNo: paymentOrder.OutTradeNo,
		GatewayTradeNo: paymentOrder.GatewayTradeNo, Subject: paymentOrder.Subject, AmountText: paymentOrder.AmountText,
	})
	require.NoError(t, err)
	task := store.NotificationTask{ID: "delivery-task", OrderID: paymentOrder.ID, State: order.NotificationPending, PayloadSnapshot: string(payload), NextAttemptAt: time.Now().UTC().Add(-time.Second), Version: 1}
	require.NoError(t, repository.DB().Create(&task).Error)
	return repository, task, config.Config{EpayPartnerID: "10001", EpayKey: "shared-key", NewAPINotifyURL: "https://api.example.com/api/user/epay/notify"}
}

func TestWorkerCompletesOnlyStrictEpaySuccessResponse(t *testing.T) {
	repository, task, appConfig := newWorkerFixture(t)
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		values, err := url.ParseQuery(string(body))
		require.NoError(t, err)
		assert.Equal(t, "delivery-gateway", values.Get("trade_no"))
		assert.Equal(t, "TRADE_SUCCESS", values.Get("trade_status"))
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(" success\n")), Header: make(http.Header)}, nil
	})}
	worker := NewWorker(repository, appConfig, "worker-1", client)
	worker.now = func() time.Time { return time.Now().UTC() }

	require.NoError(t, worker.ProcessOne(context.Background()))
	var actualTask store.NotificationTask
	require.NoError(t, repository.DB().First(&actualTask, "id = ?", task.ID).Error)
	assert.Equal(t, order.NotificationSucceeded, actualTask.State)
	var actualOrder store.PaymentOrder
	require.NoError(t, repository.DB().First(&actualOrder, "id = ?", task.OrderID).Error)
	assert.Equal(t, order.StatusNotified, actualOrder.Status)
}

func TestWorkerRetriesRejectedResponsesAndReclaimsExpiredLease(t *testing.T) {
	repository, task, appConfig := newWorkerFixture(t)
	now := time.Now().UTC()
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusTooManyRequests, Body: io.NopCloser(strings.NewReader("busy")), Header: make(http.Header)}, nil
	})}
	worker := NewWorker(repository, appConfig, "worker-1", client)
	worker.now = func() time.Time { return now }
	require.NoError(t, worker.ProcessOne(context.Background()))

	var retried store.NotificationTask
	require.NoError(t, repository.DB().First(&retried, "id = ?", task.ID).Error)
	assert.Equal(t, order.NotificationRetry, retried.State)
	require.NotNil(t, retried.LastHTTPStatus)
	assert.Equal(t, http.StatusTooManyRequests, *retried.LastHTTPStatus)
	assert.True(t, retried.NextAttemptAt.After(now))

	leaseOwner := "abandoned-worker"
	leaseUntil := now.Add(-time.Second)
	require.NoError(t, repository.DB().Model(&store.NotificationTask{}).Where("id = ?", task.ID).Updates(map[string]any{
		"state": order.NotificationProcessing, "lease_owner": leaseOwner, "lease_until": leaseUntil, "version": retried.Version + 1,
	}).Error)
	client.Transport = roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("success")), Header: make(http.Header)}, nil
	})
	require.NoError(t, worker.ProcessOne(context.Background()))
	var reclaimed store.NotificationTask
	require.NoError(t, repository.DB().First(&reclaimed, "id = ?", task.ID).Error)
	assert.Equal(t, order.NotificationSucceeded, reclaimed.State)
}
