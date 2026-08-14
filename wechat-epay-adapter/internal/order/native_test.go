package order_test

import (
	"context"
	"errors"
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

type fakeWechatClient struct {
	create func(context.Context, wechat.NativeOrderRequest) (wechat.NativeOrder, error)
	query  func(context.Context, string) (wechat.OrderQuery, error)
}

func (f fakeWechatClient) CreateNativeOrder(ctx context.Context, request wechat.NativeOrderRequest) (wechat.NativeOrder, error) {
	return f.create(ctx, request)
}

func (f fakeWechatClient) QueryOrder(ctx context.Context, merchantOrderNo string) (wechat.OrderQuery, error) {
	return f.query(ctx, merchantOrderNo)
}

func newNativeOrderStore(t *testing.T, status order.Status, createdAt time.Time) (*store.Store, store.PaymentOrder) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, store.Migrate(db))
	repository := store.New(db)
	paymentOrder := store.PaymentOrder{
		ID: "order-1", OutTradeNo: "merchant-order-1", GatewayTradeNo: "gateway-order-1", RequestFingerprint: "fingerprint",
		EpayPID: "10001", PaymentType: "wxpay", Subject: "Top up", AmountText: "1.00", AmountFen: 100,
		NotifyURL: "https://pay.example.com/api/v1/wechat/notify", CashierTokenHash: "cashier-token", Status: status,
		ExpiresAt: time.Now().UTC().Add(15 * time.Minute), Version: 1, CreatedAt: createdAt,
	}
	require.NoError(t, db.Create(&paymentOrder).Error)
	return repository, paymentOrder
}

func record(paymentOrder store.PaymentOrder) order.NativeOrderRecord {
	return order.NativeOrderRecord{
		ID: paymentOrder.ID, OutTradeNo: paymentOrder.OutTradeNo, Subject: paymentOrder.Subject, AmountFen: paymentOrder.AmountFen,
		NotifyURL: paymentOrder.NotifyURL, ExpiresAt: paymentOrder.ExpiresAt, Status: paymentOrder.Status,
		Version: paymentOrder.Version, CreatedAt: paymentOrder.CreatedAt,
	}
}

func TestNativeOrderCreatePersistsValidCodeURL(t *testing.T) {
	repository, paymentOrder := newNativeOrderStore(t, order.StatusCreating, time.Now().UTC())
	service := order.NewNativeOrderService(repository, fakeWechatClient{
		create: func(context.Context, wechat.NativeOrderRequest) (wechat.NativeOrder, error) {
			return wechat.NativeOrder{CodeURL: "weixin://wxpay/bizpayurl?pr=test"}, nil
		},
		query: func(context.Context, string) (wechat.OrderQuery, error) { return wechat.OrderQuery{}, nil },
	})

	require.NoError(t, service.Create(context.Background(), record(paymentOrder)))
	var actual store.PaymentOrder
	require.NoError(t, repository.DB().First(&actual, "id = ?", paymentOrder.ID).Error)
	assert.Equal(t, order.StatusPayable, actual.Status)
	require.NotNil(t, actual.WechatCodeURL)
	assert.Equal(t, "weixin://wxpay/bizpayurl?pr=test", *actual.WechatCodeURL)
}

func TestNativeOrderCreateClassifiesRejectedAndUnknownResults(t *testing.T) {
	for _, test := range []struct {
		name   string
		err    error
		status order.Status
	}{
		{name: "rejected", err: wechat.ErrRequestRejected, status: order.StatusCreateFailed},
		{name: "unknown", err: wechat.ErrResultUnknown, status: order.StatusCreateUnknown},
	} {
		t.Run(test.name, func(t *testing.T) {
			repository, paymentOrder := newNativeOrderStore(t, order.StatusCreating, time.Now().UTC())
			service := order.NewNativeOrderService(repository, fakeWechatClient{
				create: func(context.Context, wechat.NativeOrderRequest) (wechat.NativeOrder, error) {
					return wechat.NativeOrder{}, test.err
				},
				query: func(context.Context, string) (wechat.OrderQuery, error) { return wechat.OrderQuery{}, nil },
			})
			require.NoError(t, service.Create(context.Background(), record(paymentOrder)))
			var actual store.PaymentOrder
			require.NoError(t, repository.DB().First(&actual, "id = ?", paymentOrder.ID).Error)
			assert.Equal(t, test.status, actual.Status)
		})
	}
}

func TestNativeOrderCreateRejectsInvalidCodeURL(t *testing.T) {
	repository, paymentOrder := newNativeOrderStore(t, order.StatusCreating, time.Now().UTC())
	service := order.NewNativeOrderService(repository, fakeWechatClient{
		create: func(context.Context, wechat.NativeOrderRequest) (wechat.NativeOrder, error) {
			return wechat.NativeOrder{CodeURL: "https://example.com"}, nil
		},
		query: func(context.Context, string) (wechat.OrderQuery, error) { return wechat.OrderQuery{}, nil },
	})
	require.NoError(t, service.Create(context.Background(), record(paymentOrder)))
	var actual store.PaymentOrder
	require.NoError(t, repository.DB().First(&actual, "id = ?", paymentOrder.ID).Error)
	assert.Equal(t, order.StatusCreateFailed, actual.Status)
	assert.Nil(t, actual.WechatCodeURL)
}

func TestRecoverUnknownQueriesWithoutCreatingAnotherOrder(t *testing.T) {
	repository, paymentOrder := newNativeOrderStore(t, order.StatusCreateUnknown, time.Now().UTC())
	createCalls := 0
	queryCalls := 0
	service := order.NewNativeOrderService(repository, fakeWechatClient{
		create: func(context.Context, wechat.NativeOrderRequest) (wechat.NativeOrder, error) {
			createCalls++
			return wechat.NativeOrder{}, errors.New("must not create")
		},
		query: func(context.Context, string) (wechat.OrderQuery, error) {
			queryCalls++
			return wechat.OrderQuery{MerchantOrderNo: paymentOrder.OutTradeNo, AmountFen: paymentOrder.AmountFen, Currency: wechat.CurrencyCNY, TradeState: "NOTPAY"}, nil
		},
	})

	require.NoError(t, service.RecoverUnknown(context.Background(), record(paymentOrder)))
	assert.Zero(t, createCalls)
	assert.Equal(t, 1, queryCalls)
}

func TestRecoverUnknownEventuallyMovesToManualReview(t *testing.T) {
	repository, paymentOrder := newNativeOrderStore(t, order.StatusCreateUnknown, time.Now().UTC().Add(-order.UnknownCreateObservationWindow))
	service := order.NewNativeOrderService(repository, fakeWechatClient{
		create: func(context.Context, wechat.NativeOrderRequest) (wechat.NativeOrder, error) {
			return wechat.NativeOrder{}, nil
		},
		query: func(context.Context, string) (wechat.OrderQuery, error) {
			return wechat.OrderQuery{}, errors.New("must not query after window")
		},
	})

	require.NoError(t, service.RecoverUnknown(context.Background(), record(paymentOrder)))
	var actual store.PaymentOrder
	require.NoError(t, repository.DB().First(&actual, "id = ?", paymentOrder.ID).Error)
	assert.Equal(t, order.StatusManualReview, actual.Status)
}
