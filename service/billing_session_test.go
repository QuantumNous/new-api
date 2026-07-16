package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

type billingSessionTestFunding struct {
	settleCalls int
	deltas      []int
}

func (f *billingSessionTestFunding) Source() string {
	return BillingSourceWallet
}

func (f *billingSessionTestFunding) PreConsume(int) error {
	return nil
}

func (f *billingSessionTestFunding) Settle(delta int) error {
	f.settleCalls++
	f.deltas = append(f.deltas, delta)
	return nil
}

func (f *billingSessionTestFunding) Refund() error {
	return nil
}

func TestBillingSessionSettleRetriesTokenAdjustmentWithoutSettlingFundingTwice(t *testing.T) {
	truncate(t)
	seedToken(t, 901, 801, "billing-session-token", 5)

	funding := &billingSessionTestFunding{}
	session := &BillingSession{
		relayInfo: &relaycommon.RelayInfo{
			UserId:   801,
			TokenId:  901,
			TokenKey: "billing-session-token",
		},
		funding: funding,
	}

	err := session.Settle(10)
	require.Error(t, err)
	require.True(t, session.fundingSettled)
	require.False(t, session.settled)
	require.Equal(t, 1, funding.settleCalls)
	require.Equal(t, []int{10}, funding.deltas)

	require.NoError(t, model.DB.Model(&model.Token{}).
		Where("id = ?", session.relayInfo.TokenId).
		Update("remain_quota", 20).Error)

	require.NoError(t, session.Settle(10))
	require.True(t, session.settled)
	require.Equal(t, 1, funding.settleCalls)

	var token model.Token
	require.NoError(t, model.DB.First(&token, session.relayInfo.TokenId).Error)
	require.Equal(t, 10, token.RemainQuota)
	require.Equal(t, 10, token.UsedQuota)
}
