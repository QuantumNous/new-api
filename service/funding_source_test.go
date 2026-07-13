package service

import (
	"errors"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ===========================================================================
// refundWithRetry tests — pure logic, no DB needed
// ===========================================================================

// callTracker records how many times a retryable function was invoked.
type callTracker struct {
	calls   int
	failN   int          // fail the first N calls
	err     error        // error to return on failure
	records []error      // records all errors returned
}

func (c *callTracker) fn() error {
	c.calls++
	if c.calls <= c.failN {
		c.records = append(c.records, c.err)
		return c.err
	}
	c.records = append(c.records, nil)
	return nil
}

func TestRefundWithRetry_SuccessFirstTry(t *testing.T) {
	counter := &callTracker{}
	err := refundWithRetry(counter.fn)
	assert.NoError(t, err)
	assert.Equal(t, 1, counter.calls, "should succeed on first attempt, no retries")
}

func TestRefundWithRetry_SuccessAfterOneRetry(t *testing.T) {
	counter := &callTracker{failN: 1, err: errors.New("transient error")}
	err := refundWithRetry(counter.fn)
	assert.NoError(t, err, "should succeed on second attempt")
	assert.Equal(t, 2, counter.calls)
}

func TestRefundWithRetry_SuccessAfterTwoRetries(t *testing.T) {
	counter := &callTracker{failN: 2, err: errors.New("transient error")}
	err := refundWithRetry(counter.fn)
	assert.NoError(t, err, "should succeed on third (last) attempt")
	assert.Equal(t, 3, counter.calls)
}

func TestRefundWithRetry_AllAttemptsFail(t *testing.T) {
	counter := &callTracker{failN: 3, err: errors.New("persistent error")}
	err := refundWithRetry(counter.fn)
	assert.Error(t, err, "should return error after exhausting all retries")
	assert.ErrorIs(t, err, counter.err)
	assert.Equal(t, 3, counter.calls, "should have tried exactly 3 times")
}

func TestRefundWithRetry_NilFunction(t *testing.T) {
	err := refundWithRetry(nil)
	assert.NoError(t, err, "nil function should return nil error")
}

func TestRefundWithRetry_ReturnsLastError(t *testing.T) {
	// Each retry returns a different error; verify the LAST error is returned.
	var attempt int
	lastErr := errors.New("final error")
	fn := func() error {
		attempt++
		if attempt < 3 {
			return fmt.Errorf("attempt %d error", attempt)
		}
		return lastErr
	}
	err := refundWithRetry(fn)
	assert.ErrorIs(t, err, lastErr, "should return the error from the last attempt")
}

// ===========================================================================
// WalletFunding integration tests — uses shared test DB from task_billing_test.go
// ===========================================================================

func TestWalletFunding_PreConsume(t *testing.T) {
	truncate(t)
	const userID = 1
	const initQuota = 10000
	seedUser(t, userID, initQuota)

	wf := &WalletFunding{userId: userID}
	err := wf.PreConsume(3000)
	require.NoError(t, err)

	assert.Equal(t, 3000, wf.consumed, "WalletFunding.consumed should track pre-consumed amount")

	// Verify DB: user quota decreased by 3000
	remaining, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, initQuota-3000, remaining)
}

func TestWalletFunding_PreConsume_ZeroAmount(t *testing.T) {
	truncate(t)
	const userID = 2
	const initQuota = 5000
	seedUser(t, userID, initQuota)

	wf := &WalletFunding{userId: userID}
	err := wf.PreConsume(0)
	assert.NoError(t, err, "PreConsume(0) should be a no-op")
	assert.Equal(t, 0, wf.consumed)

	remaining, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, initQuota, remaining, "user quota should not change for zero pre-consume")
}

func TestWalletFunding_Settle_PositiveDelta(t *testing.T) {
	truncate(t)
	const userID = 3
	const initQuota = 10000
	seedUser(t, userID, initQuota)

	wf := &WalletFunding{userId: userID}

	// Simulate: pre-consume 5000, actual is 7000 (needs additional 2000)
	// Since Settle is independent of preConsume, delta=2000 means charge 2000 more
	err := wf.Settle(2000)
	require.NoError(t, err)

	remaining, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, initQuota-2000, remaining, "positive delta should decrease user quota")
}

func TestWalletFunding_Settle_NegativeDelta(t *testing.T) {
	truncate(t)
	const userID = 4
	const initQuota = 10000
	seedUser(t, userID, initQuota)

	wf := &WalletFunding{userId: userID}

	// Simulate: pre-consume 5000, actual is 3000 (refund 2000)
	err := wf.Settle(-2000)
	require.NoError(t, err)

	remaining, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, initQuota+2000, remaining, "negative delta should increase user quota")
}

func TestWalletFunding_Settle_ZeroDelta(t *testing.T) {
	truncate(t)
	const userID = 5
	const initQuota = 10000
	seedUser(t, userID, initQuota)

	wf := &WalletFunding{userId: userID}
	err := wf.Settle(0)
	assert.NoError(t, err)

	remaining, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, initQuota, remaining, "zero delta should not change quota")
}

func TestWalletFunding_Refund(t *testing.T) {
	truncate(t)
	const userID = 6
	const initQuota = 10000
	seedUser(t, userID, initQuota)

	wf := &WalletFunding{userId: userID, consumed: 4000}

	err := wf.Refund()
	require.NoError(t, err)

	// After refund, user quota should be restored by consumed amount
	remaining, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, initQuota+4000, remaining)
}

func TestWalletFunding_Refund_ZeroConsumed(t *testing.T) {
	truncate(t)
	const userID = 7
	const initQuota = 10000
	seedUser(t, userID, initQuota)

	wf := &WalletFunding{userId: userID, consumed: 0}

	err := wf.Refund()
	assert.NoError(t, err, "refund with zero consumed should be a no-op")

	remaining, err := model.GetUserQuota(userID, true)
	require.NoError(t, err)
	assert.Equal(t, initQuota, remaining, "user quota should not change")
}

func TestWalletFunding_Source(t *testing.T) {
	wf := &WalletFunding{}
	assert.Equal(t, BillingSourceWallet, wf.Source())
}

// ===========================================================================
// SubscriptionFunding — skipped due to model-layer transaction deadlock risk
// ===========================================================================

func TestSubscriptionFunding_Source(t *testing.T) {
	sf := &SubscriptionFunding{}
	assert.Equal(t, BillingSourceSubscription, sf.Source())
}

func TestSubscriptionFunding_PreConsume(t *testing.T) {
	t.Skip("SubscriptionFunding.PreConsume calls model.PreConsumeUserSubscription, which uses DB transactions internally. " +
		"With SQLite in-memory + MaxOpenConns(1), nested transactions may cause deadlock. " +
		"Ref: model/subscription_test.go had 5 subtests skipped for the same reason. " +
		"Fix: run these tests with a real DB (MySQL/PostgreSQL) or increase MaxOpenConns.")
}

func TestSubscriptionFunding_Settle(t *testing.T) {
	t.Skip("SubscriptionFunding.Settle calls model.PostConsumeUserSubscriptionDelta, which requires a pre-consume record. " +
		"Cannot be tested without PreConsume succeeding first, which is skipped above.")
}

func TestSubscriptionFunding_Refund(t *testing.T) {
	t.Skip("SubscriptionFunding.Refund calls refundWithRetry(model.RefundSubscriptionPreConsume), " +
		"which requires a pre-consume record created by PreConsume. Cannot be tested without PreConsume succeeding first.")
}
