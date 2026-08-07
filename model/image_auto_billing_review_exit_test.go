package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The settlement_manual_review operational exit: an admin supplies a verified
// actual quota and the journal must settle through the normal reconcile money
// math (refunding the reserve/actual difference), then leave the review queue.
func TestSettlementReviewJournalResolvesThroughSettleAndRefundsDifference(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	user := User{Id: 701, Username: "review-exit-user", Password: "password", Quota: 1000}
	token := Token{Id: 801, UserId: user.Id, Key: "review-exit-token", RemainQuota: 1000}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&token).Error)

	journal, err := ReserveImageAutoBilling(ImageAutoBillingReserveParams{
		RequestId:     "review-exit-1",
		UserId:        user.Id,
		TokenId:       token.Id,
		ReservedQuota: 400,
		FundingSource: ImageAutoBillingFundingWallet,
	})
	require.NoError(t, err)
	require.Equal(t, ImageAutoBillingStatusReserved, journal.Status)
	require.NoError(t, MarkImageAutoBillingSettlementReview("review-exit-1", nil))

	parked, err := ListImageAutoBillingReviewJournals(0)
	require.NoError(t, err)
	require.Len(t, parked, 1)
	assert.Equal(t, "review-exit-1", parked[0].RequestId)

	// Verified actual usage is 150 of the 400 reserve: settle must refund 250.
	require.NoError(t, SettleImageAutoBilling("review-exit-1", 150))

	resolved, err := GetImageAutoBillingJournalByRequestId("review-exit-1")
	require.NoError(t, err)
	require.NotNil(t, resolved)
	assert.Equal(t, ImageAutoBillingStatusSettled, resolved.Status)
	assert.Equal(t, 150, resolved.ActualQuota)

	require.NoError(t, db.First(&user, user.Id).Error)
	require.NoError(t, db.First(&token, token.Id).Error)
	assert.Equal(t, 850, user.Quota, "wallet must end at initial minus verified actual")
	assert.Equal(t, 850, token.RemainQuota)
	assert.Equal(t, 150, token.UsedQuota)

	emptied, err := ListImageAutoBillingReviewJournals(0)
	require.NoError(t, err)
	assert.Empty(t, emptied, "resolved journal must leave the review queue")
}

// Resolving at zero releases the whole reservation — the "bill never happened"
// exit for a lease-expired request that is confirmed to have done no work.
func TestSettlementReviewJournalResolvedAtZeroReleasesFullReserve(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	user := User{Id: 702, Username: "review-zero-user", Password: "password", Quota: 500}
	token := Token{Id: 802, UserId: user.Id, Key: "review-zero-token", RemainQuota: 500}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&token).Error)

	_, err := ReserveImageAutoBilling(ImageAutoBillingReserveParams{
		RequestId:     "review-zero-1",
		UserId:        user.Id,
		TokenId:       token.Id,
		ReservedQuota: 300,
		FundingSource: ImageAutoBillingFundingWallet,
	})
	require.NoError(t, err)
	require.NoError(t, MarkImageAutoBillingSettlementReview("review-zero-1", nil))

	require.NoError(t, SettleImageAutoBilling("review-zero-1", 0))

	require.NoError(t, db.First(&user, user.Id).Error)
	require.NoError(t, db.First(&token, token.Id).Error)
	assert.Equal(t, 500, user.Quota, "zero-quota resolution must return the full reserve")
	assert.Equal(t, 500, token.RemainQuota)
	assert.Equal(t, 0, token.UsedQuota)
}
