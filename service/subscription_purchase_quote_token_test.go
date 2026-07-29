package service

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestSignSubscriptionPurchaseQuoteTokenRejectsLegacyVersion(t *testing.T) {
	_, err := SignSubscriptionPurchaseQuoteToken(SubscriptionPurchaseQuoteTokenClaims{
		Version:          1,
		UserID:           17,
		PlanID:           3,
		PaymentChoice:    SubscriptionPaymentChoicePix,
		Months:           1,
		RequestID:        "purchase-request-legacy-sign",
		Currency:         "BRL",
		UnitAmountMinor:  4990,
		TotalAmountMinor: 4990,
		PlanRevision:     1_753_268_400,
		ExpiresAt:        1_753_269_000,
	})

	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
}

func TestSubscriptionPurchaseQuoteTokenRoundTrip(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	claims := SubscriptionPurchaseQuoteTokenClaims{
		Version:          2,
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
	claims.DiscountKind = SubscriptionDiscountKindNone
	require.Equal(t, claims, verified)
}

func TestSubscriptionPurchaseQuoteTokenRoundTripWithEpayConcreteMethod(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	claims := SubscriptionPurchaseQuoteTokenClaims{
		Version:          2,
		UserID:           17,
		PlanID:           3,
		PaymentChoice:    SubscriptionPaymentChoiceEpay,
		PaymentMethod:    " Alipay ",
		Months:           1,
		RequestID:        "purchase-request-epay",
		Currency:         "USD",
		UnitAmountMinor:  999,
		TotalAmountMinor: 999,
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
	require.Equal(t, SubscriptionPaymentChoiceEpay, verified.PaymentChoice)
	require.Equal(t, "alipay", verified.PaymentMethod)
}

func TestSubscriptionPurchaseQuoteTokenRoundTripWithFirstMonthDiscount(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	claims := SubscriptionPurchaseQuoteTokenClaims{
		Version:             2,
		UserID:              17,
		PlanID:              3,
		PaymentChoice:       SubscriptionPaymentChoicePix,
		Months:              3,
		RequestID:           "purchase-request-17",
		Currency:            "BRL",
		UnitAmountMinor:     10000,
		DiscountAmountMinor: 2000,
		TotalAmountMinor:    28000,
		RecallCampaignID:    42,
		RecallRecipientID:   99,
		PlanRevision:        1_753_268_400,
		ExpiresAt:           1_753_269_000,
	}

	token, err := SignSubscriptionPurchaseQuoteToken(claims)
	require.NoError(t, err)

	verified, err := VerifySubscriptionPurchaseQuoteToken(
		token,
		time.Unix(1_753_268_500, 0),
	)
	require.NoError(t, err)
	claims.DiscountKind = SubscriptionDiscountKindRecall
	claims.OtherDiscountKind = SubscriptionDiscountKindRecall
	claims.OtherDiscountAmountMinor = claims.DiscountAmountMinor
	require.Equal(t, claims, verified)
}

func TestSubscriptionPurchaseQuoteTokenRoundTripWithInvitationDiscount(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	claims := SubscriptionPurchaseQuoteTokenClaims{
		Version:                       2,
		UserID:                        17,
		PlanID:                        3,
		PaymentChoice:                 SubscriptionPaymentChoicePix,
		Months:                        3,
		RequestID:                     "purchase-request-17",
		Currency:                      "BRL",
		UnitAmountMinor:               10000,
		DiscountKind:                  SubscriptionDiscountKindInvitation,
		DiscountAmountMinor:           20000,
		TotalAmountMinor:              10000,
		InvitationAvailableUSDMinor:   500,
		InvitationDiscountUSDMinor:    500,
		InvitationDiscountAmountMinor: 20000,
		InvitationRemainingUSDMinor:   0,
		PlanRevision:                  1_753_268_400,
		ExpiresAt:                     1_753_269_000,
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

func TestSubscriptionPurchaseQuoteTokenRoundTripWithRecurringZeroTotalInvitationDiscount(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	claims := SubscriptionPurchaseQuoteTokenClaims{
		Version:                       2,
		UserID:                        17,
		PlanID:                        3,
		PaymentChoice:                 SubscriptionPaymentChoiceStripeRecurring,
		Months:                        1,
		RequestID:                     "purchase-request-17",
		Currency:                      "USD",
		UnitAmountMinor:               999,
		DiscountKind:                  SubscriptionDiscountKindInvitation,
		DiscountAmountMinor:           999,
		TotalAmountMinor:              0,
		InvitationAvailableUSDMinor:   999,
		InvitationDiscountUSDMinor:    999,
		InvitationDiscountAmountMinor: 999,
		InvitationRemainingUSDMinor:   0,
		OtherDiscountKind:             SubscriptionDiscountKindRecall,
		OtherDiscountAmountMinor:      500,
		PlanRevision:                  1_753_268_400,
		ExpiresAt:                     1_753_269_000,
	}

	token, err := SignSubscriptionPurchaseQuoteToken(claims)
	require.NoError(t, err)

	verified, err := VerifySubscriptionPurchaseQuoteToken(
		token,
		time.Unix(1_753_268_500, 0),
	)
	require.NoError(t, err)
	require.Equal(t, claims, verified)
	require.Zero(t, verified.RecallCampaignID)
	require.Zero(t, verified.RecallRecipientID)
}

func TestSubscriptionPurchaseQuoteTokenRejectsInvitationAmountTamperingWithoutResigning(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	token, err := SignSubscriptionPurchaseQuoteToken(SubscriptionPurchaseQuoteTokenClaims{
		Version:                       2,
		UserID:                        17,
		PlanID:                        3,
		PaymentChoice:                 SubscriptionPaymentChoiceStripeRecurring,
		Months:                        1,
		RequestID:                     "purchase-request-17",
		Currency:                      "USD",
		UnitAmountMinor:               999,
		DiscountKind:                  SubscriptionDiscountKindInvitation,
		DiscountAmountMinor:           999,
		TotalAmountMinor:              0,
		InvitationAvailableUSDMinor:   999,
		InvitationDiscountUSDMinor:    999,
		InvitationDiscountAmountMinor: 999,
		InvitationRemainingUSDMinor:   0,
		PlanRevision:                  1_753_268_400,
		ExpiresAt:                     1_753_269_000,
	})
	require.NoError(t, err)

	parts := strings.Split(token, ".")
	require.Len(t, parts, 2)
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	require.NoError(t, err)
	tamperedPayload := strings.Replace(string(payload), `"invitation_discount_usd_minor":999`, `"invitation_discount_usd_minor":998`, 1)
	require.NotEqual(t, string(payload), tamperedPayload)
	parts[0] = base64.RawURLEncoding.EncodeToString([]byte(tamperedPayload))

	_, err = VerifySubscriptionPurchaseQuoteToken(
		strings.Join(parts, "."),
		time.Unix(1_753_268_500, 0),
	)
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
}

func TestSubscriptionPurchaseQuoteTokenRejectsTampering(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	token, err := SignSubscriptionPurchaseQuoteToken(SubscriptionPurchaseQuoteTokenClaims{
		Version:          2,
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
		Version:          2,
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
		Version:          2,
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
		Version:          2,
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

func TestSubscriptionPurchaseQuoteTokenRejectsDiscountInconsistentTotal(t *testing.T) {
	_, err := SignSubscriptionPurchaseQuoteToken(SubscriptionPurchaseQuoteTokenClaims{
		Version:             2,
		UserID:              17,
		PlanID:              3,
		PaymentChoice:       SubscriptionPaymentChoicePix,
		Months:              3,
		RequestID:           "purchase-request-17",
		Currency:            "BRL",
		UnitAmountMinor:     10000,
		DiscountAmountMinor: 2000,
		TotalAmountMinor:    30000,
		RecallCampaignID:    42,
		RecallRecipientID:   99,
		PlanRevision:        1_753_268_400,
		ExpiresAt:           1_753_269_000,
	})
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
}

func TestSubscriptionPurchaseQuoteTokenRejectsDiscountGreaterThanMonthlyUnit(t *testing.T) {
	_, err := SignSubscriptionPurchaseQuoteToken(SubscriptionPurchaseQuoteTokenClaims{
		Version:             2,
		UserID:              17,
		PlanID:              3,
		PaymentChoice:       SubscriptionPaymentChoicePix,
		Months:              3,
		RequestID:           "purchase-request-17",
		Currency:            "BRL",
		UnitAmountMinor:     10000,
		DiscountAmountMinor: 10001,
		TotalAmountMinor:    19999,
		RecallCampaignID:    42,
		RecallRecipientID:   99,
		PlanRevision:        1_753_268_400,
		ExpiresAt:           1_753_269_000,
	})
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
}

func TestSubscriptionPurchaseQuoteTokenRequiresRecallIDsWithDiscount(t *testing.T) {
	base := SubscriptionPurchaseQuoteTokenClaims{
		Version:             2,
		UserID:              17,
		PlanID:              3,
		PaymentChoice:       SubscriptionPaymentChoicePix,
		Months:              3,
		RequestID:           "purchase-request-17",
		Currency:            "BRL",
		UnitAmountMinor:     10000,
		DiscountAmountMinor: 2000,
		TotalAmountMinor:    28000,
		PlanRevision:        1_753_268_400,
		ExpiresAt:           1_753_269_000,
	}
	_, err := SignSubscriptionPurchaseQuoteToken(base)
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)

	base.RecallCampaignID = 42
	_, err = SignSubscriptionPurchaseQuoteToken(base)
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
}

func TestSubscriptionPurchaseQuoteTokenRejectsInvitationDiscountWithRecallIDs(t *testing.T) {
	_, err := SignSubscriptionPurchaseQuoteToken(SubscriptionPurchaseQuoteTokenClaims{
		Version:             2,
		UserID:              17,
		PlanID:              3,
		PaymentChoice:       SubscriptionPaymentChoicePix,
		Months:              3,
		RequestID:           "purchase-request-17",
		Currency:            "BRL",
		UnitAmountMinor:     10000,
		DiscountKind:        SubscriptionDiscountKindInvitation,
		DiscountAmountMinor: 2000,
		TotalAmountMinor:    28000,
		RecallCampaignID:    42,
		RecallRecipientID:   99,
		PlanRevision:        1_753_268_400,
		ExpiresAt:           1_753_269_000,
	})
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
}

func TestSubscriptionPurchaseQuoteTokenRejectsRecallIDsWithoutDiscount(t *testing.T) {
	_, err := SignSubscriptionPurchaseQuoteToken(SubscriptionPurchaseQuoteTokenClaims{
		Version:          2,
		UserID:           17,
		PlanID:           3,
		PaymentChoice:    SubscriptionPaymentChoicePix,
		Months:           3,
		RequestID:        "purchase-request-17",
		Currency:         "BRL",
		UnitAmountMinor:  10000,
		TotalAmountMinor: 30000,
		RecallCampaignID: 42,
		PlanRevision:     1_753_268_400,
		ExpiresAt:        1_753_269_000,
	})
	require.ErrorIs(t, err, ErrSubscriptionPurchaseQuoteInvalid)
}

func TestSubscriptionPurchaseQuoteTokenVerifiesLegacyTokenWithoutDiscountFields(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	legacyPayload, err := common.Marshal(map[string]any{
		"v":                  1,
		"uid":                17,
		"pid":                3,
		"payment_choice":     SubscriptionPaymentChoicePix,
		"months":             6,
		"request_id":         "purchase-request-17",
		"currency":           "BRL",
		"unit_amount_minor":  4990,
		"total_amount_minor": 29940,
		"plan_revision":      1_753_268_400,
		"expires_at":         1_753_269_000,
	})
	require.NoError(t, err)
	encodedPayload := base64.RawURLEncoding.EncodeToString(legacyPayload)
	token := encodedPayload + "." + common.GenerateHMAC(encodedPayload)

	verified, err := VerifySubscriptionPurchaseQuoteToken(token, time.Unix(1_753_268_500, 0))
	require.NoError(t, err)
	require.Equal(t, SubscriptionDiscountKindNone, verified.DiscountKind)
	require.Zero(t, verified.DiscountAmountMinor)
	require.Zero(t, verified.OtherDiscountAmountMinor)
	require.Zero(t, verified.RecallCampaignID)
	require.Zero(t, verified.RecallRecipientID)
	require.Equal(t, int64(29940), verified.TotalAmountMinor)
}

func TestSubscriptionPurchaseQuoteTokenNormalizesLegacyRecallToken(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "subscription-quote-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	legacyPayload, err := common.Marshal(map[string]any{
		"v":                     1,
		"uid":                   17,
		"pid":                   3,
		"payment_choice":        SubscriptionPaymentChoicePix,
		"months":                3,
		"request_id":            "purchase-request-17",
		"currency":              "BRL",
		"unit_amount_minor":     10000,
		"discount_amount_minor": 2000,
		"total_amount_minor":    28000,
		"recall_campaign_id":    42,
		"recall_recipient_id":   99,
		"plan_revision":         1_753_268_400,
		"expires_at":            1_753_269_000,
	})
	require.NoError(t, err)
	encodedPayload := base64.RawURLEncoding.EncodeToString(legacyPayload)
	token := encodedPayload + "." + common.GenerateHMAC(encodedPayload)

	verified, err := VerifySubscriptionPurchaseQuoteToken(token, time.Unix(1_753_268_500, 0))
	require.NoError(t, err)
	require.Equal(t, SubscriptionDiscountKindRecall, verified.DiscountKind)
	require.Equal(t, SubscriptionDiscountKindRecall, verified.OtherDiscountKind)
	require.Equal(t, int64(2000), verified.OtherDiscountAmountMinor)
	require.Equal(t, int64(42), verified.RecallCampaignID)
	require.Equal(t, int64(99), verified.RecallRecipientID)
}
