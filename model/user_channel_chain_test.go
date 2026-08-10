package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelChainTest(t *testing.T) *User {
	t.Helper()
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&UserChannelChain{}).Error)
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Token{}).Error)
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&User{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&UserChannelChain{}).Error)
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Token{}).Error)
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&User{}).Error)
	})
	user := User{
		Id:       92001,
		Username: "channel-chain-user",
		Password: "password123",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, DB.Create(&user).Error)
	return &user
}

func TestParseUserChannelChain(t *testing.T) {
	chainId, ok := ParseUserChannelChain("chain:OUwA5H5q")
	require.True(t, ok)
	assert.Equal(t, "OUwA5H5q", chainId)

	_, ok = ParseUserChannelChain("chain")
	assert.False(t, ok)
	_, ok = ParseUserChannelChain("chain:")
	assert.False(t, ok)
	_, ok = ParseUserChannelChain("default")
	assert.False(t, ok)
}

func TestUserChannelChainCRUDAndTokenReset(t *testing.T) {
	user := setupChannelChainTest(t)

	chain, err := CreateUserChannelChain(user.Id, "chain-a", []int{1, 2})
	require.NoError(t, err)
	require.NotEmpty(t, chain.ChainId)
	assert.Equal(t, []int{1, 2}, chain.GetChannelList())

	chainGroup := "chain:" + chain.ChainId
	token := Token{
		UserId:          user.Id,
		Key:             "channel-chain-token-key",
		Status:          common.TokenStatusEnabled,
		Name:            "chain-token",
		CreatedTime:     common.GetTimestamp(),
		AccessedTime:    common.GetTimestamp(),
		ExpiredTime:     -1,
		RemainQuota:     0,
		UnlimitedQuota:  true,
		Group:           chainGroup,
		CrossGroupRetry: false,
	}
	require.NoError(t, DB.Create(&token).Error)

	err = UpdateUserChannelChain(user.Id, chain.ChainId, "chain-b", []int{2, 1})
	require.NoError(t, err)
	updated, err := GetUserChannelChain(user.Id, chain.ChainId)
	require.NoError(t, err)
	assert.Equal(t, "chain-b", updated.Name)
	assert.Equal(t, []int{2, 1}, updated.GetChannelList())

	resetTokens, err := DeleteUserChannelChain(user.Id, chain.ChainId)
	require.NoError(t, err)
	assert.Equal(t, 1, resetTokens)

	_, err = GetUserChannelChain(user.Id, chain.ChainId)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)

	var stored Token
	require.NoError(t, DB.First(&stored, "id = ?", token.Id).Error)
	assert.Equal(t, "default", stored.Group)
	assert.False(t, stored.CrossGroupRetry)
	assert.Empty(t, stored.AutoGroups)
}

func TestCreateUserChannelChainEnforcesLimit(t *testing.T) {
	user := setupChannelChainTest(t)

	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&UserChannelChain{}).Error)
	for i := 0; i < MaxUserChannelChains; i++ {
		_, err := CreateUserChannelChain(user.Id, "chain", []int{1})
		require.NoError(t, err)
	}
	_, err := CreateUserChannelChain(user.Id, "overflow", []int{1})
	require.ErrorIs(t, err, ErrChannelChainLimit)
}
