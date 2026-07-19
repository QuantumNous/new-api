package controller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v81"
)

func TestFulfillOrderRejectsPaidEventWithoutReferenceID(t *testing.T) {
	err := fulfillOrder(
		context.Background(),
		stripe.Event{Type: stripe.EventTypeCheckoutSessionCompleted},
		"",
		"cus_missing_reference",
		"127.0.0.1",
	)
	require.ErrorContains(t, err, "client_reference_id")
}
