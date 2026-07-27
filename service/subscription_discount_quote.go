package service

import (
	"errors"
	"math"
	"strings"

	"github.com/shopspring/decimal"
)

const (
	SubscriptionDiscountKindNone       = "none"
	SubscriptionDiscountKindInvitation = "invitation"
	SubscriptionDiscountKindRecall     = "recall"
)

type SubscriptionDiscountQuoteInput struct {
	Currency                 string
	OriginalAmountMinor      int64
	OriginalUSDMinor         int64
	AvailableUSDMinor        int64
	OtherDiscountAmountMinor int64
	OtherDiscountKind        string
}

type SubscriptionDiscountQuote struct {
	SelectedKind                  string
	SelectedDiscountAmountMinor   int64
	FinalAmountMinor              int64
	InvitationAvailableUSDMinor   int64
	InvitationDiscountUSDMinor    int64
	InvitationDiscountAmountMinor int64
	InvitationRemainingUSDMinor   int64
	OtherDiscountKind             string
	OtherDiscountAmountMinor      int64
}

func BuildSubscriptionDiscountQuote(input SubscriptionDiscountQuoteInput) (SubscriptionDiscountQuote, error) {
	if input.OriginalAmountMinor < 0 || input.OriginalUSDMinor <= 0 ||
		input.AvailableUSDMinor < 0 || input.OtherDiscountAmountMinor < 0 {
		return SubscriptionDiscountQuote{}, errors.New("subscription discount quote amount is invalid")
	}
	if input.OriginalAmountMinor == 0 {
		return SubscriptionDiscountQuote{}, errors.New("subscription discount quote original amount is invalid")
	}

	quote := SubscriptionDiscountQuote{
		SelectedKind:                SubscriptionDiscountKindNone,
		FinalAmountMinor:            input.OriginalAmountMinor,
		InvitationAvailableUSDMinor: input.AvailableUSDMinor,
		InvitationRemainingUSDMinor: input.AvailableUSDMinor,
		OtherDiscountKind:           strings.TrimSpace(input.OtherDiscountKind),
		OtherDiscountAmountMinor:    input.OtherDiscountAmountMinor,
	}

	invitationLocal, err := subscriptionInvitationDiscountAmountMinor(input.AvailableUSDMinor, input.OriginalAmountMinor, input.OriginalUSDMinor)
	if err != nil {
		return SubscriptionDiscountQuote{}, err
	}
	invitationUSD := minInt64(input.AvailableUSDMinor, input.OriginalUSDMinor)

	otherLocal := minInt64(input.OtherDiscountAmountMinor, input.OriginalAmountMinor)
	if otherLocal > 0 && quote.OtherDiscountKind == "" {
		return SubscriptionDiscountQuote{}, errors.New("subscription discount quote other discount kind is required")
	}

	if invitationLocal > 0 && invitationLocal > otherLocal {
		quote.SelectedKind = SubscriptionDiscountKindInvitation
		quote.SelectedDiscountAmountMinor = invitationLocal
		quote.InvitationDiscountAmountMinor = invitationLocal
		quote.InvitationDiscountUSDMinor = invitationUSD
		quote.InvitationRemainingUSDMinor = input.AvailableUSDMinor - invitationUSD
	} else if otherLocal > 0 {
		quote.SelectedKind = quote.OtherDiscountKind
		quote.SelectedDiscountAmountMinor = otherLocal
	}
	quote.FinalAmountMinor = input.OriginalAmountMinor - quote.SelectedDiscountAmountMinor
	if quote.FinalAmountMinor < 0 {
		quote.FinalAmountMinor = 0
	}
	return quote, nil
}

func subscriptionInvitationDiscountAmountMinor(availableUSDMinor int64, originalAmountMinor int64, originalUSDMinor int64) (int64, error) {
	if availableUSDMinor == 0 {
		return 0, nil
	}
	discount := decimal.NewFromInt(availableUSDMinor).
		Mul(decimal.NewFromInt(originalAmountMinor)).
		Div(decimal.NewFromInt(originalUSDMinor)).
		Round(0)
	if discount.GreaterThan(decimal.NewFromInt(math.MaxInt64)) {
		return 0, errors.New("subscription discount quote amount overflows")
	}
	discountMinor := discount.IntPart()
	if discountMinor > originalAmountMinor {
		discountMinor = originalAmountMinor
	}
	return discountMinor, nil
}

func minInt64(a int64, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
