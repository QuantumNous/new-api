package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStripeSubscriptionUpgradeIntentIdempotencyKeyScopesByIntent(t *testing.T) {
	first := stripeSubscriptionUpgradeIntentIdempotencyKey(11, 2, 33, 44)
	replayed := stripeSubscriptionUpgradeIntentIdempotencyKey(11, 2, 33, 44)
	secondIntent := stripeSubscriptionUpgradeIntentIdempotencyKey(11, 2, 33, 45)

	require.Equal(t, first, replayed)
	require.NotEqual(t, first, secondIntent)
	require.Equal(t, "subscription-upgrade:contract:11:version:2:target-plan:33:intent:44", first)
}
