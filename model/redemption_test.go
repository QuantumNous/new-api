package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRedemptionListsIncludeCreatorUsername(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{
		Id:          9301,
		Username:    "creator_a",
		DisplayName: "Creator A",
		AffCode:     "creator_a_code",
		Status:      common.UserStatusEnabled,
		Role:        common.RoleCommonUser,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id:       9302,
		Username: "creator_b",
		AffCode:  "creator_b_code",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
	}).Error)
	require.NoError(t, DB.Create(&Redemption{
		UserId:      9301,
		Name:        "creator-list-a",
		Key:         "creator-list-a-key",
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       100,
		CreatedTime: common.GetTimestamp(),
	}).Error)
	require.NoError(t, DB.Create(&Redemption{
		UserId:      9302,
		Name:        "creator-list-b",
		Key:         "creator-list-b-key",
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       100,
		CreatedTime: common.GetTimestamp(),
	}).Error)

	redemptions, total, err := GetAllRedemptions(0, 10)
	require.NoError(t, err)
	require.EqualValues(t, 2, total)
	require.Len(t, redemptions, 2)
	creatorsByName := map[string]string{}
	for _, redemption := range redemptions {
		creatorsByName[redemption.Name] = redemption.CreatorUsername
	}
	assert.Equal(t, "Creator A", creatorsByName["creator-list-a"])
	assert.Equal(t, "creator_b", creatorsByName["creator-list-b"])

	searchResults, searchTotal, err := SearchRedemptions("creator-list-a", 0, 10)
	require.NoError(t, err)
	require.EqualValues(t, 1, searchTotal)
	require.Len(t, searchResults, 1)
	assert.Equal(t, "Creator A", searchResults[0].CreatorUsername)
}
