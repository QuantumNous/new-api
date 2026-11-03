package billing

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/common/dbx"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/stretchr/testify/require"
)

// TestSubscriptionSettleChargesOverageAsWalletDebt pins the F8 invariant:
// a post-delivery settlement delta larger than the subscription's remaining
// quota must consume the subscription to its cap AND charge the remainder to
// the wallet (debt-allowed, mirroring WalletFunding.Settle). Before the fix
// the strict all-or-nothing delta failed, the settle error was logged away,
// and the delivered overage was billed to nobody.
func TestSubscriptionSettleChargesOverageAsWalletDebt(t *testing.T) {
	setupIdentityTestDB(t)
	seedUser(t, 91, 700)
	require.NoError(t, dbx.DB.Create(&UserSubscription{
		Id: 93, UserId: 91, AmountTotal: 1000, AmountUsed: 900, Status: "active",
	}).Error)

	funding := &SubscriptionFunding{userId: 91, subscriptionId: 93}
	require.NoError(t, funding.Settle(200))

	var used int64
	require.NoError(t, dbx.DB.Raw("SELECT amount_used FROM user_subscriptions WHERE id = ?", 93).Scan(&used).Error)
	require.Equal(t, int64(1000), used, "subscription absorbs everything up to its cap")
	require.Equal(t, int64(100), funding.WalletOverflow, "overflow portion recorded on funding")
	require.Equal(t, 700-100, scanUserQuota(t), "the 100-unit overflow is charged to the wallet")
}

// TestSubscriptionSettleOverflowSplitsPostDeltaAndWalletOverflow pins the
// split-charge invariant: when a delivery settle exceeds the subscription's
// remaining quota, SubscriptionPostDelta must only contain the portion the
// subscription absorbed, and the wallet overflow must be recorded separately
// on both the funding source and the relay info for accurate log attribution.
func TestSubscriptionSettleOverflowSplitsPostDeltaAndWalletOverflow(t *testing.T) {
	setupIdentityTestDB(t)
	seedUser(t, 91, 700)
	require.NoError(t, dbx.DB.Create(&UserSubscription{
		Id: 93, UserId: 91, AmountTotal: 1000, AmountUsed: 900, Status: "active",
	}).Error)

	relayInfo := &relaycommon.RelayInfo{
		UserId:       91,
		IsPlayground: true, // skip token quota adjustment
	}
	funding := &SubscriptionFunding{userId: 91, subscriptionId: 93}
	session := &BillingSession{
		relayInfo:        relayInfo,
		funding:          funding,
		preConsumedQuota: 0,
	}

	// delta = 200, subscription remaining = 100 → overflow = 100
	require.NoError(t, session.Settle(200))

	require.Equal(t, int64(100), funding.WalletOverflow, "overflow portion recorded on funding")
	require.Equal(t, int64(100), relayInfo.SubscriptionPostDelta, "post delta counts only the subscription-absorbed portion")
	require.Equal(t, int64(100), relayInfo.SubscriptionWalletOverflow, "wallet overflow recorded on relay info")
}

// TestSubscriptionSettleWithinRemainingQuotaLeavesWalletUntouched guards the
// happy path of the capped settle: no cap hit, wallet untouched.
func TestSubscriptionSettleWithinRemainingQuotaLeavesWalletUntouched(t *testing.T) {
	setupIdentityTestDB(t)
	seedUser(t, 91, 700)
	require.NoError(t, dbx.DB.Create(&UserSubscription{
		Id: 93, UserId: 91, AmountTotal: 1000, AmountUsed: 100, Status: "active",
	}).Error)

	funding := &SubscriptionFunding{userId: 91, subscriptionId: 93}
	require.NoError(t, funding.Settle(200))

	var used int64
	require.NoError(t, dbx.DB.Raw("SELECT amount_used FROM user_subscriptions WHERE id = ?", 93).Scan(&used).Error)
	require.Equal(t, int64(300), used)
	require.Equal(t, 700, scanUserQuota(t))
}

// TestSubscriptionSettleNegativeDeltaRefunds keeps the refund leg on the
// strict delta path (floor at zero), so settle adjustments can still give
// quota back without touching the wallet.
func TestSubscriptionSettleNegativeDeltaRefunds(t *testing.T) {
	setupIdentityTestDB(t)
	seedUser(t, 91, 700)
	require.NoError(t, dbx.DB.Create(&UserSubscription{
		Id: 93, UserId: 91, AmountTotal: 1000, AmountUsed: 300, Status: "active",
	}).Error)

	funding := &SubscriptionFunding{userId: 91, subscriptionId: 93}
	require.NoError(t, funding.Settle(-500))

	var used int64
	require.NoError(t, dbx.DB.Raw("SELECT amount_used FROM user_subscriptions WHERE id = ?", 93).Scan(&used).Error)
	require.Equal(t, int64(0), used)
	require.Equal(t, 700, scanUserQuota(t))
}
