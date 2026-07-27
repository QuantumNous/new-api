package service

import (
	"math"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildSubscriptionDiscountQuoteSelectsBestNonStackingOffer(t *testing.T) {
	tests := []struct {
		name                    string
		input                   SubscriptionDiscountQuoteInput
		wantKind                string
		wantInvitationLocal     int64
		wantInvitationUSD       int64
		wantInvitationRemaining int64
		wantFinal               int64
	}{
		{
			name: "usd_invitation_beats_smaller_recall",
			input: SubscriptionDiscountQuoteInput{
				Currency:                 "USD",
				OriginalAmountMinor:      2000,
				OriginalUSDMinor:         2000,
				AvailableUSDMinor:        700,
				OtherDiscountKind:        SubscriptionDiscountKindRecall,
				OtherDiscountAmountMinor: 500,
			},
			wantKind:                SubscriptionDiscountKindInvitation,
			wantInvitationLocal:     700,
			wantInvitationUSD:       700,
			wantInvitationRemaining: 0,
			wantFinal:               1300,
		},
		{
			name: "brl_scales_usd_credit_to_local_minor_units",
			input: SubscriptionDiscountQuoteInput{
				Currency:            "BRL",
				OriginalAmountMinor: 8000,
				OriginalUSDMinor:    2000,
				AvailableUSDMinor:   500,
			},
			wantKind:                SubscriptionDiscountKindInvitation,
			wantInvitationLocal:     2000,
			wantInvitationUSD:       500,
			wantInvitationRemaining: 0,
			wantFinal:               6000,
		},
		{
			name: "inr_scales_usd_credit_to_local_minor_units",
			input: SubscriptionDiscountQuoteInput{
				Currency:            "INR",
				OriginalAmountMinor: 83000,
				OriginalUSDMinor:    1000,
				AvailableUSDMinor:   250,
			},
			wantKind:                SubscriptionDiscountKindInvitation,
			wantInvitationLocal:     20750,
			wantInvitationUSD:       250,
			wantInvitationRemaining: 0,
			wantFinal:               62250,
		},
		{
			name: "recall_wins_when_reduction_is_larger",
			input: SubscriptionDiscountQuoteInput{
				Currency:                 "USD",
				OriginalAmountMinor:      2000,
				OriginalUSDMinor:         2000,
				AvailableUSDMinor:        700,
				OtherDiscountKind:        SubscriptionDiscountKindRecall,
				OtherDiscountAmountMinor: 800,
			},
			wantKind:                SubscriptionDiscountKindRecall,
			wantInvitationLocal:     0,
			wantInvitationUSD:       0,
			wantInvitationRemaining: 700,
			wantFinal:               1200,
		},
		{
			name: "recall_wins_tie_to_preserve_invitation_credit",
			input: SubscriptionDiscountQuoteInput{
				Currency:                 "USD",
				OriginalAmountMinor:      2000,
				OriginalUSDMinor:         2000,
				AvailableUSDMinor:        700,
				OtherDiscountKind:        SubscriptionDiscountKindRecall,
				OtherDiscountAmountMinor: 700,
			},
			wantKind:                SubscriptionDiscountKindRecall,
			wantInvitationLocal:     0,
			wantInvitationUSD:       0,
			wantInvitationRemaining: 700,
			wantFinal:               1300,
		},
		{
			name: "invitation_caps_at_original_local_amount",
			input: SubscriptionDiscountQuoteInput{
				Currency:            "USD",
				OriginalAmountMinor: 400,
				OriginalUSDMinor:    400,
				AvailableUSDMinor:   900,
			},
			wantKind:                SubscriptionDiscountKindInvitation,
			wantInvitationLocal:     400,
			wantInvitationUSD:       400,
			wantInvitationRemaining: 500,
			wantFinal:               0,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			quote, err := BuildSubscriptionDiscountQuote(test.input)

			require.NoError(t, err)
			require.Equal(t, test.wantKind, quote.SelectedKind)
			require.Equal(t, test.wantInvitationLocal, quote.InvitationDiscountAmountMinor)
			require.Equal(t, test.wantInvitationUSD, quote.InvitationDiscountUSDMinor)
			require.Equal(t, test.wantInvitationRemaining, quote.InvitationRemainingUSDMinor)
			require.Equal(t, test.wantFinal, quote.FinalAmountMinor)
			require.Equal(t, test.input.AvailableUSDMinor, quote.InvitationAvailableUSDMinor)
			require.Equal(t, test.input.OtherDiscountKind, quote.OtherDiscountKind)
			require.Equal(t, test.input.OtherDiscountAmountMinor, quote.OtherDiscountAmountMinor)
		})
	}
}

func TestBuildSubscriptionDiscountQuoteRejectsInvalidMoney(t *testing.T) {
	tests := []struct {
		name  string
		input SubscriptionDiscountQuoteInput
	}{
		{
			name: "missing_canonical_usd_price_with_invitation_credit",
			input: SubscriptionDiscountQuoteInput{
				Currency:            "USD",
				OriginalAmountMinor: 2000,
				OriginalUSDMinor:    0,
				AvailableUSDMinor:   500,
			},
		},
		{
			name: "negative_original_local",
			input: SubscriptionDiscountQuoteInput{
				Currency:            "USD",
				OriginalAmountMinor: -1,
				OriginalUSDMinor:    2000,
			},
		},
		{
			name: "negative_other_discount",
			input: SubscriptionDiscountQuoteInput{
				Currency:                 "USD",
				OriginalAmountMinor:      2000,
				OriginalUSDMinor:         2000,
				OtherDiscountKind:        SubscriptionDiscountKindRecall,
				OtherDiscountAmountMinor: -1,
			},
		},
		{
			name: "overflow_scale",
			input: SubscriptionDiscountQuoteInput{
				Currency:            "USD",
				OriginalAmountMinor: math.MaxInt64,
				OriginalUSDMinor:    1,
				AvailableUSDMinor:   math.MaxInt64,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := BuildSubscriptionDiscountQuote(test.input)
			require.Error(t, err)
		})
	}
}
