package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestTopUpCreditQuotaFirstTopupPromoPayPal(t *testing.T) {
	topUp := &TopUp{
		Amount:          10,
		Money:           7.5,
		PaymentProvider: PaymentProviderPayPal,
	}
	got := topUpCreditQuota(topUp)
	want := float64(10) * common.QuotaPerUnit
	require.InDelta(t, want, got, 1, "promo PayPal must credit tier Amount, not discounted Money")
}

func TestTopUpCreditQuotaStripeUsesMoney(t *testing.T) {
	topUp := &TopUp{
		Amount:          10,
		Money:           10.5,
		PaymentProvider: PaymentProviderStripe,
	}
	got := topUpCreditQuota(topUp)
	want := 10.5 * common.QuotaPerUnit
	require.InDelta(t, want, got, 1)
}
