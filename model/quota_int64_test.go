package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestGetUserByIdSupportsLargeQuotaValue(t *testing.T) {
	const userID = 91001
	const largeQuota = int64(3542971632)

	require.NoError(t, DB.Where("id = ?", userID).Delete(&User{}).Error)

	user := &User{
		Id:       userID,
		Username: "large_quota_user",
		Status:   common.UserStatusEnabled,
		Quota:    largeQuota,
		AffCode:  "uq01",
	}
	require.NoError(t, DB.Create(user).Error)

	readBack, err := GetUserById(userID, false)
	require.NoError(t, err)
	require.Equal(t, largeQuota, readBack.Quota)

	quota, err := GetUserQuota(userID, true)
	require.NoError(t, err)
	require.Equal(t, common.SafeInt64ToInt(largeQuota), quota)
}

func TestGetTokenByIdSupportsLargeQuotaValue(t *testing.T) {
	const userID = 91002
	const tokenID = 91003
	const largeQuota = int64(3542971632)

	require.NoError(t, DB.Where("id = ?", tokenID).Delete(&Token{}).Error)
	require.NoError(t, DB.Where("id = ?", userID).Delete(&User{}).Error)

	user := &User{
		Id:       userID,
		Username: "large_quota_token_user",
		Status:   common.UserStatusEnabled,
		Quota:    largeQuota,
		AffCode:  "uq02",
	}
	require.NoError(t, DB.Create(user).Error)

	token := &Token{
		Id:          tokenID,
		UserId:      userID,
		Key:         "sk-large-token-quota",
		Name:        "large token quota",
		Status:      common.TokenStatusEnabled,
		RemainQuota: largeQuota,
		UsedQuota:   largeQuota,
	}
	require.NoError(t, DB.Create(token).Error)

	readBack, err := GetTokenById(tokenID)
	require.NoError(t, err)
	require.Equal(t, largeQuota, readBack.RemainQuota)
	require.Equal(t, largeQuota, readBack.UsedQuota)
}
