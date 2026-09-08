package main

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mustLegacyCreditEvent(t *testing.T, event string) string {
	t.Helper()
	mapped, ok := mapCurrentCreditEvent(event)
	require.True(t, ok)
	return mapped
}

func TestMapCurrentCreditEvent(t *testing.T) {
	require.Equal(t, "purchase", mustLegacyCreditEvent(t, model.AgentCreditEventPurchase))
	require.Equal(t, "refund", mustLegacyCreditEvent(t, model.AgentCreditEventRefund))
	require.Equal(t, "topup", mustLegacyCreditEvent(t, model.AgentCreditEventAdminCredit))
	require.Equal(t, "deduct", mustLegacyCreditEvent(t, model.AgentCreditEventAdminDebit))
	_, ok := mapCurrentCreditEvent("unknown")
	assert.False(t, ok)
}

func TestLegacyPurchaseRemark(t *testing.T) {
	assert.Equal(t, "购买兑换码: pro x3", legacyPurchaseRemark(" pro ", 3))
}

func TestSubscriptionRemaining(t *testing.T) {
	remaining, err := subscriptionRemaining(500, 125)
	require.NoError(t, err)
	assert.Equal(t, int64(375), remaining)
	_, err = subscriptionRemaining(10, 11)
	require.Error(t, err)
	_, err = subscriptionRemaining(-1, 0)
	require.Error(t, err)
}

func TestValidateRollbackRunID(t *testing.T) {
	require.NoError(t, validateRollbackRunID("cutover_20260723"))
	assert.Error(t, validateRollbackRunID("cutover;drop"))
	assert.Error(t, validateRollbackRunID(""))
}

func TestLegacyQuotaInt(t *testing.T) {
	value, err := legacyQuotaInt(123)
	require.NoError(t, err)
	assert.Equal(t, 123, value)
	_, err = legacyQuotaInt(-1)
	require.Error(t, err)
}
