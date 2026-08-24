package model

import (
	"errors"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestClaimRedemptionByPurposeAllocatesOneCodePerUser(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	for userID, username := range map[int]string{8101: "redeem-user-one", 8102: "redeem-user-two", 8103: "redeem-user-three"} {
		require.NoError(t, DB.Create(&User{Id: userID, Username: username, AffCode: username, Quota: 0}).Error)
	}
	for _, code := range []string{"yc-code-one", "yc-code-two"} {
		require.NoError(t, DB.Create(&Redemption{
			Key:         code,
			Name:        "YCPrompt",
			Quota:       500,
			Status:      common.RedemptionCodeStatusEnabled,
			CreatedTime: common.GetTimestamp(),
		}).Error)
	}

	first, err := ClaimRedemptionByPurpose(" YCPrompt ", 8101)
	require.NoError(t, err)
	require.Equal(t, "yc-code-one", first.Key)
	require.Equal(t, 8101, first.ClaimedUserId)
	require.NotZero(t, first.ClaimedTime)

	replay, err := ClaimRedemptionByPurpose("YCPrompt", 8101)
	require.NoError(t, err)
	require.Equal(t, first.Key, replay.Key)

	second, err := ClaimRedemptionByPurpose("YCPrompt", 8102)
	require.NoError(t, err)
	require.Equal(t, "yc-code-two", second.Key)
	require.Equal(t, 8102, second.ClaimedUserId)

	_, err = ClaimRedemptionByPurpose("YCPrompt", 8103)
	require.ErrorIs(t, err, ErrRedemptionCodesExhausted)
}

func TestClaimRedemptionByPurposeAllocatesUniqueCodesConcurrently(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 4)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	for _, userID := range []int{8151, 8152} {
		require.NoError(t, DB.Create(&User{Id: userID, Username: fmt.Sprintf("concurrent-user-%d", userID), AffCode: fmt.Sprintf("concurrent-user-%d", userID)}).Error)
	}
	for _, code := range []string{"concurrent-one", "concurrent-two"} {
		require.NoError(t, DB.Create(&Redemption{
			Key:    code,
			Name:   "YCPrompt",
			Status: common.RedemptionCodeStatusEnabled,
		}).Error)
	}

	type claimResult struct {
		redemption *Redemption
		err        error
	}
	start := make(chan struct{})
	results := make(chan claimResult, 2)
	for _, userID := range []int{8151, 8152} {
		go func() {
			<-start
			redemption, err := ClaimRedemptionByPurpose("YCPrompt", userID)
			results <- claimResult{redemption: redemption, err: err}
		}()
	}
	close(start)

	first := <-results
	second := <-results
	require.NoError(t, first.err)
	require.NoError(t, second.err)
	require.NotEqual(t, first.redemption.Key, second.redemption.Key)
}

func TestClaimRedemptionByPurposeIsIdempotentForConcurrentSameUser(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 4)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Create(&User{Id: 8161, Username: "same-redeem-user", AffCode: "same-redeem-user"}).Error)
	for _, code := range []string{"same-user-one", "same-user-two"} {
		require.NoError(t, DB.Create(&Redemption{
			Key:    code,
			Name:   "YCPrompt",
			Status: common.RedemptionCodeStatusEnabled,
		}).Error)
	}

	start := make(chan struct{})
	results := make(chan *Redemption, 2)
	errors := make(chan error, 2)
	for range 2 {
		go func() {
			<-start
			redemption, err := ClaimRedemptionByPurpose("YCPrompt", 8161)
			results <- redemption
			errors <- err
		}()
	}
	close(start)

	first := <-results
	second := <-results
	require.NoError(t, <-errors)
	require.NoError(t, <-errors)
	require.NotNil(t, first)
	require.NotNil(t, second)
	require.Equal(t, first.Id, second.Id)

	var claimedCount int64
	require.NoError(t, DB.Model(&Redemption{}).
		Where("name = ? AND claimed_user_id = ?", "YCPrompt", 8161).
		Count(&claimedCount).Error)
	require.EqualValues(t, 1, claimedCount)
}

func TestClaimedRedemptionCanOnlyBeRedeemedByOwner(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Create(&User{Id: 8201, Username: "owner", AffCode: "owner", Quota: 0}).Error)
	require.NoError(t, DB.Create(&User{Id: 8202, Username: "other", AffCode: "other", Quota: 0}).Error)
	require.NoError(t, DB.Create(&Redemption{
		Key:         "owner-only-code",
		Name:        "YCPrompt",
		Quota:       700,
		Status:      common.RedemptionCodeStatusEnabled,
		CreatedTime: common.GetTimestamp(),
	}).Error)

	claimed, err := ClaimRedemptionByPurpose("YCPrompt", 8201)
	require.NoError(t, err)
	require.Equal(t, "owner-only-code", claimed.Key)

	_, err = Redeem(claimed.Key, 8202)
	require.ErrorIs(t, err, ErrRedeemFailed)

	quota, err := Redeem(claimed.Key, 8201)
	require.NoError(t, err)
	require.Equal(t, 700, quota)
	var owner User
	require.NoError(t, DB.First(&owner, 8201).Error)
	require.Equal(t, 700, owner.Quota)
	var stored Redemption
	require.NoError(t, DB.First(&stored, claimed.Id).Error)
	require.Equal(t, common.RedemptionCodeStatusUsed, stored.Status)
	require.Equal(t, 8201, stored.UsedUserId)

	_, err = ClaimRedemptionByPurpose("YCPrompt", 8201)
	require.True(t, errors.Is(err, ErrRedemptionAlreadyClaimed))
}

func TestClaimRedemptionByPurposeSkipsExpiredAndDisabledCodes(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Create(&User{Id: 8301, Username: "skip-user", AffCode: "skip-user"}).Error)
	now := common.GetTimestamp()
	fixtures := []Redemption{
		{Key: "expired", Name: "YCPrompt", Status: common.RedemptionCodeStatusEnabled, ExpiredTime: now - 1},
		{Key: "disabled", Name: "YCPrompt", Status: common.RedemptionCodeStatusDisabled},
		{Key: "available", Name: "YCPrompt", Status: common.RedemptionCodeStatusEnabled},
	}
	for index := range fixtures {
		require.NoError(t, DB.Create(&fixtures[index]).Error)
	}

	claimed, err := ClaimRedemptionByPurpose("YCPrompt", 8301)
	require.NoError(t, err)
	require.Equal(t, "available", claimed.Key)
}

func TestClaimRedemptionByPurposeIncludesLegacyUnclaimedCodes(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Create(&User{Id: 8401, Username: "legacy-user", AffCode: "legacy-user"}).Error)
	legacy := Redemption{
		Key:    "legacy-unclaimed",
		Name:   "YCPrompt",
		Status: common.RedemptionCodeStatusEnabled,
	}
	require.NoError(t, DB.Create(&legacy).Error)
	require.NoError(t, DB.Model(&Redemption{}).
		Where("id = ?", legacy.Id).
		UpdateColumn("claimed_user_id", nil).Error)

	claimed, err := ClaimRedemptionByPurpose("YCPrompt", 8401)
	require.NoError(t, err)
	require.Equal(t, legacy.Id, claimed.Id)
	require.Equal(t, 8401, claimed.ClaimedUserId)
}
