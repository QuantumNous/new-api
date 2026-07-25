package service

import (
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionPurchaseQuoteTokenRoundTrip(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	claims := SubscriptionPurchaseQuoteTokenClaims{
		Version:          1,
		UserID:           17,
		PlanID:           3,
		PaymentChoice:    SubscriptionPaymentChoicePix,
		Months:           6,
		RequestID:        "purchase-request-17",
		Currency:         "BRL",
		UnitAmountMinor:  4990,
		TotalAmountMinor: 29940,
		PlanRevision:     1_753_268_400,
		ExpiresAt:        1_753_269_000,
	}

	token, err := SignSubscriptionPurchaseQuoteToken(claims)
	require.NoError(t, err)

	verified, err := VerifySubscriptionPurchaseQuoteToken(
		token,
		time.Unix(1_753_268_500, 0),
	)
	require.NoError(t, err)
	require.Equal(t, claims, verified)
}

func TestSubscriptionPurchaseQuoteTokenRejectsTampering(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	token, err := SignSubscriptionPurchaseQuoteToken(SubscriptionPurchaseQuoteTokenClaims{
		Version:          1,
		UserID:           17,
		PlanID:           3,
		PaymentChoice:    SubscriptionPaymentChoiceUPI,
		Months:           3,
		RequestID:        "purchase-request-17",
		Currency:         "INR",
		UnitAmountMinor:  149900,
		TotalAmountMinor: 449700,
		PlanRevision:     1_753_268_400,
		ExpiresAt:        1_753_269_000,
	})
	require.NoError(t, err)

	parts := strings.Split(token, ".")
	require.Len(t, parts, 2)
	parts[0] = parts[0][:len(parts[0])-1] + "A"

	_, err = VerifySubscriptionPurchaseQuoteToken(
		strings.Join(parts, "."),
		time.Unix(1_753_268_500, 0),
	)
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
}

func TestSubscriptionPurchaseQuoteTokenRejectsExpiredQuote(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	token, err := SignSubscriptionPurchaseQuoteToken(SubscriptionPurchaseQuoteTokenClaims{
		Version:          1,
		UserID:           17,
		PlanID:           3,
		PaymentChoice:    SubscriptionPaymentChoicePix,
		Months:           1,
		RequestID:        "purchase-request-17",
		Currency:         "BRL",
		UnitAmountMinor:  4990,
		TotalAmountMinor: 4990,
		PlanRevision:     1_753_268_400,
		ExpiresAt:        1_753_269_000,
	})
	require.NoError(t, err)

	_, err = VerifySubscriptionPurchaseQuoteToken(
		token,
		time.Unix(1_753_269_000, 0),
	)
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteExpired)
}

func TestSubscriptionPurchaseQuoteTokenRejectsCurrencyMethodMismatch(t *testing.T) {
	_, err := SignSubscriptionPurchaseQuoteToken(SubscriptionPurchaseQuoteTokenClaims{
		Version:          1,
		UserID:           17,
		PlanID:           3,
		PaymentChoice:    SubscriptionPaymentChoicePix,
		Months:           1,
		RequestID:        "purchase-request-17",
		Currency:         "USD",
		UnitAmountMinor:  1000,
		TotalAmountMinor: 1000,
		PlanRevision:     1_753_268_400,
		ExpiresAt:        1_753_269_000,
	})
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
}

func TestSubscriptionPurchaseQuoteTokenRejectsInconsistentTotal(t *testing.T) {
	_, err := SignSubscriptionPurchaseQuoteToken(SubscriptionPurchaseQuoteTokenClaims{
		Version:          1,
		UserID:           17,
		PlanID:           3,
		PaymentChoice:    SubscriptionPaymentChoiceUPI,
		Months:           12,
		RequestID:        "purchase-request-17",
		Currency:         "INR",
		UnitAmountMinor:  149900,
		TotalAmountMinor: 149900,
		PlanRevision:     1_753_268_400,
		ExpiresAt:        1_753_269_000,
	})
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
}
