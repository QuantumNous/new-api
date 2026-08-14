package order_test

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/order"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/wechat"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newRecoveryStore(t *testing.T) *store.Store {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, store.Migrate(db))
	return store.New(db)
}

func recoveryOrder(id string, status order.Status, createdAt, expiresAt time.Time) store.PaymentOrder {
	return store.PaymentOrder{
		ID: id, OutTradeNo: "out-" + id, GatewayTradeNo: "gateway-" + id, RequestFingerprint: "fingerprint-" + id,
		EpayPID: "10001", PaymentType: "wxpay", Subject: "Top up", AmountText: "1.00", AmountFen: 100,
		NotifyURL: "https://pay.example.com/api/v1/wechat/notify", CashierTokenHash: "token-" + id, Status: status,
		CreatedAt: createdAt, ExpiresAt: expiresAt, Version: 1,
	}
}

func TestRecoverySchedulerExpiresOnlyPayableOrdersAndNeverRecreatesUnknownOrders(t *testing.T) {
	repository := newRecoveryStore(t)
	now := time.Now().UTC()
	payable := recoveryOrder("payable", order.StatusPayable, now.Add(-time.Hour), now.Add(-time.Minute))
	paid := recoveryOrder("paid", order.StatusPaidPendingNotify, now.Add(-time.Hour), now.Add(-time.Minute))
	unknown := recoveryOrder("unknown", order.StatusCreateUnknown, now.Add(-time.Minute), now.Add(10*time.Minute))
	require.NoError(t, repository.DB().Create(&payable).Error)
	require.NoError(t, repository.DB().Create(&paid).Error)
	require.NoError(t, repository.DB().Create(&unknown).Error)
	createCalls := 0
	queryCalls := 0
	native := order.NewNativeOrderService(repository, schedulerWechatClient{
		create: func(context.Context, wechat.NativeOrderRequest) (wechat.NativeOrder, error) {
			createCalls++
			return wechat.NativeOrder{}, nil
		},
		query: func(context.Context, string) (wechat.OrderQuery, error) {
			queryCalls++
			return wechat.OrderQuery{MerchantOrderNo: unknown.OutTradeNo, AmountFen: unknown.AmountFen, Currency: wechat.CurrencyCNY}, nil
		},
	})
	scheduler := order.NewRecoveryScheduler(repository, native)

	require.NoError(t, scheduler.Process(context.Background()))
	assert.Zero(t, createCalls)
	assert.Equal(t, 1, queryCalls)
	var actualPayable, actualPaid store.PaymentOrder
	require.NoError(t, repository.DB().First(&actualPayable, "id = ?", payable.ID).Error)
	require.NoError(t, repository.DB().First(&actualPaid, "id = ?", paid.ID).Error)
	assert.Equal(t, order.StatusExpired, actualPayable.Status)
	assert.Equal(t, order.StatusPaidPendingNotify, actualPaid.Status)
}

func TestRecoverySchedulerMovesExpiredUnknownOrdersToManualReview(t *testing.T) {
	repository := newRecoveryStore(t)
	now := time.Now().UTC()
	unknown := recoveryOrder("unknown-window", order.StatusCreateUnknown, now.Add(-order.UnknownCreateObservationWindow-time.Second), now.Add(time.Hour))
	require.NoError(t, repository.DB().Create(&unknown).Error)
	native := order.NewNativeOrderService(repository, schedulerWechatClient{
		create: func(context.Context, wechat.NativeOrderRequest) (wechat.NativeOrder, error) {
			return wechat.NativeOrder{}, nil
		},
		query: func(context.Context, string) (wechat.OrderQuery, error) { return wechat.OrderQuery{}, nil },
	})
	scheduler := order.NewRecoveryScheduler(repository, native)

	require.NoError(t, scheduler.Process(context.Background()))
	var actual store.PaymentOrder
	require.NoError(t, repository.DB().First(&actual, "id = ?", unknown.ID).Error)
	assert.Equal(t, order.StatusManualReview, actual.Status)
}

type schedulerWechatClient struct {
	create func(context.Context, wechat.NativeOrderRequest) (wechat.NativeOrder, error)
	query  func(context.Context, string) (wechat.OrderQuery, error)
}

func (client schedulerWechatClient) CreateNativeOrder(ctx context.Context, request wechat.NativeOrderRequest) (wechat.NativeOrder, error) {
	return client.create(ctx, request)
}

func (client schedulerWechatClient) QueryOrder(ctx context.Context, merchantOrderNo string) (wechat.OrderQuery, error) {
	return client.query(ctx, merchantOrderNo)
}
