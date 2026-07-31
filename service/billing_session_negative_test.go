package service

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type negativeGuardFunding struct {
	settleCalls []int
}

func (f *negativeGuardFunding) Source() string         { return BillingSourceWallet }
func (f *negativeGuardFunding) PreConsume(_ int) error { return nil }
func (f *negativeGuardFunding) Refund() error          { return nil }
func (f *negativeGuardFunding) Settle(delta int) error {
	f.settleCalls = append(f.settleCalls, delta)
	return nil
}

func TestBillingSessionRejectsNegativeActualQuota(t *testing.T) {
	funding := &negativeGuardFunding{}
	session := &BillingSession{
		relayInfo:        &relaycommon.RelayInfo{IsPlayground: true},
		funding:          funding,
		preConsumedQuota: 1000,
	}

	err := session.Settle(-1)

	require.ErrorContains(t, err, "actual quota cannot be negative")
	assert.Empty(t, funding.settleCalls)
	assert.False(t, session.settled)
}

func TestBillingSessionRejectsNegativeReserveTarget(t *testing.T) {
	funding := &negativeGuardFunding{}
	session := &BillingSession{
		relayInfo:        &relaycommon.RelayInfo{IsPlayground: true},
		funding:          funding,
		preConsumedQuota: 1000,
	}

	err := session.Reserve(-1)

	require.ErrorContains(t, err, "reserve target quota cannot be negative")
	assert.Empty(t, funding.settleCalls)
	assert.Equal(t, 1000, session.GetPreConsumedQuota())
}

func TestSettleBillingRejectsNegativeQuotaWithoutSession(t *testing.T) {
	err := SettleBilling(nil, &relaycommon.RelayInfo{FinalPreConsumedQuota: 1000}, -1)

	require.ErrorContains(t, err, "actual quota cannot be negative")
}
