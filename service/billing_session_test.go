package service

import (
	"errors"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

type billingSessionTestFunding struct {
	source      string
	settleErr   error
	settleCalls int
	settleDelta int
}

func (f *billingSessionTestFunding) Source() string {
	if f.source == "" {
		return BillingSourceWallet
	}
	return f.source
}

func (f *billingSessionTestFunding) PreConsume(amount int) error {
	return nil
}

func (f *billingSessionTestFunding) Settle(delta int) error {
	f.settleCalls++
	f.settleDelta = delta
	return f.settleErr
}

func (f *billingSessionTestFunding) Refund() error {
	return nil
}

func TestBillingSessionSettleKeepsFundingErrorFatal(t *testing.T) {
	oldAdjust := adjustTokenQuotaAfterFundingSettled
	t.Cleanup(func() {
		adjustTokenQuotaAfterFundingSettled = oldAdjust
	})
	adjustCalled := false
	adjustTokenQuotaAfterFundingSettled = func(info *relaycommon.RelayInfo, delta int) error {
		adjustCalled = true
		return nil
	}

	fundingErr := errors.New("funding settle failed")
	funding := &billingSessionTestFunding{settleErr: fundingErr}
	session := &BillingSession{
		relayInfo:        &relaycommon.RelayInfo{UserId: 1, TokenId: 2, TokenKey: "token-key"},
		funding:          funding,
		preConsumedQuota: 100,
	}

	err := session.Settle(150)

	require.ErrorIs(t, err, fundingErr)
	require.Equal(t, 1, funding.settleCalls)
	require.Equal(t, 50, funding.settleDelta)
	require.False(t, adjustCalled)
	require.False(t, session.fundingSettled)
	require.False(t, session.settled)
}

func TestBillingSessionSettleIgnoresTokenAdjustErrorAfterFundingSettled(t *testing.T) {
	oldAdjust := adjustTokenQuotaAfterFundingSettled
	t.Cleanup(func() {
		adjustTokenQuotaAfterFundingSettled = oldAdjust
	})
	tokenErr := errors.New("token adjust failed")
	adjustTokenQuotaAfterFundingSettled = func(info *relaycommon.RelayInfo, delta int) error {
		require.Equal(t, 50, delta)
		return tokenErr
	}

	funding := &billingSessionTestFunding{}
	session := &BillingSession{
		relayInfo:        &relaycommon.RelayInfo{UserId: 1, TokenId: 2, TokenKey: "token-key"},
		funding:          funding,
		preConsumedQuota: 100,
	}

	err := session.Settle(150)

	require.NoError(t, err)
	require.Equal(t, 1, funding.settleCalls)
	require.Equal(t, 50, funding.settleDelta)
	require.True(t, session.fundingSettled)
	require.True(t, session.settled)
	require.False(t, session.NeedsRefund())
}
