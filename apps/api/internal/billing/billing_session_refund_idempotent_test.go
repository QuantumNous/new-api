package billing

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// noopFunding is an inert FundingSource: Settle/Refund touch no database, so
// these tests assert only the synchronous idempotency guards on BillingSession
// that the unconditional-defer refund in Relay()/RelayTask() relies on.
// IsPlayground skips the async token-refund branch inside Refund (it would
// otherwise need a live DB).
type noopFunding struct{}

func (noopFunding) Source() string              { return "wallet" }
func (noopFunding) PreConsume(amount int) error { return nil }
func (noopFunding) Settle(delta int) error      { return nil }
func (noopFunding) Refund() error               { return nil }

// preConsumedSession builds a session that has already pre-consumed quota but
// has neither settled nor refunded.
func preConsumedSession() *BillingSession {
	return &BillingSession{
		relayInfo: &relaycommon.RelayInfo{
			UserId:       1,
			TokenId:      1,
			TokenKey:     "k",
			IsPlayground: true,
		},
		funding:          noopFunding{},
		tokenConsumed:    100,
		preConsumedQuota: 100,
	}
}

// TestBillingSessionSettleThenRefundIsNoOp pins the invariant the
// unconditional-refund refund depends on: once a session is settled (the
// success path), calling Refund must not return quota a second time.
func TestBillingSessionSettleThenRefundIsNoOp(t *testing.T) {
	ctx, _ := fiberadapter.NewSyntheticContext(nil)
	session := preConsumedSession()

	assert.True(t, session.NeedsRefund(), "pre-consumed quota needs refund before settle")

	require.NoError(t, session.Settle(100), "delta==0 settle must succeed")

	assert.False(t, session.NeedsRefund(), "settled session must not need refund")
	session.Refund(ctx)
	assert.False(t, session.NeedsRefund(), "refund after settle must remain a no-op")
}

// TestBillingSessionRefundWithoutSettleIdempotent pins the other half: a
// refund without a prior settle marks the session refunded exactly once, so a
// panic-path and an error-path Refund cannot double-refund.
func TestBillingSessionRefundWithoutSettleIdempotent(t *testing.T) {
	ctx, _ := fiberadapter.NewSyntheticContext(nil)
	session := preConsumedSession()

	assert.True(t, session.NeedsRefund(), "fresh pre-consumed session needs refund")

	session.Refund(ctx)
	assert.False(t, session.NeedsRefund(), "first refund marks the session refunded")

	session.Refund(ctx)
	assert.False(t, session.NeedsRefund(), "second refund is idempotent, not a double refund")
}
