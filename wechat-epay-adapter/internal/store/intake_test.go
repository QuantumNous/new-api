package store

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createInput(id, fingerprint string) CreatePaymentOrderInput {
	return CreatePaymentOrderInput{
		ID: id, OutTradeNo: "USR1NO123", GatewayTradeNo: "GATEWAY" + id, RequestFingerprint: fingerprint,
		EpayPID: "10001", PaymentType: "wxpay", Subject: "TUC100", AmountText: "1.00", AmountFen: 100,
		NotifyURL: "https://api.example.com/api/user/epay/notify", CashierTokenHash: "token-" + id,
		ExpiresAt: time.Now().Add(15 * time.Minute), RequestID: "request-1",
	}
}

func TestCreatePaymentOrderConcurrentMatchingRequestsCreateOneOrder(t *testing.T) {
	repository := newTestStore(t)
	const callers = 10
	results := make(chan CreatePaymentOrderResult, callers)
	errors := make(chan error, callers)
	start := make(chan struct{})
	var group sync.WaitGroup
	for i := 0; i < callers; i++ {
		group.Add(1)
		go func(index int) {
			defer group.Done()
			<-start
			input := createInput("concurrent-"+string(rune('a'+index)), "same-request")
			result, err := repository.CreatePaymentOrder(input)
			if err != nil {
				errors <- err
				return
			}
			results <- result
		}(i)
	}
	close(start)
	group.Wait()
	close(results)
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}
	var orderIDs []string
	for result := range results {
		orderIDs = append(orderIDs, result.Order.ID)
	}
	require.Len(t, orderIDs, callers)
	for _, orderID := range orderIDs {
		assert.Equal(t, orderIDs[0], orderID)
	}
	var count int64
	require.NoError(t, repository.DB().Model(&PaymentOrder{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestCreatePaymentOrderReusesMatchingRequestAndAuditsConflict(t *testing.T) {
	store := newTestStore(t)
	first, err := store.CreatePaymentOrder(createInput("one", "same"))
	require.NoError(t, err)
	assert.False(t, first.Existing)

	reused, err := store.CreatePaymentOrder(createInput("two", "same"))
	require.NoError(t, err)
	assert.True(t, reused.Existing)
	assert.False(t, reused.Conflict)
	assert.Equal(t, first.Order.ID, reused.Order.ID)

	conflict, err := store.CreatePaymentOrder(createInput("three", "different"))
	require.NoError(t, err)
	assert.True(t, conflict.Conflict)

	var audits int64
	require.NoError(t, store.DB().Model(&PaymentAuditEvent{}).Where("event_type = ?", "ORDER_CONFLICT").Count(&audits).Error)
	assert.Equal(t, int64(1), audits)
}
