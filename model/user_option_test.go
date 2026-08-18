package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSearchUserOptionsTotalTokensExcludesSoftDeletedUsers 回归测试：
// SearchUserOptions(true) 的 totalTokens 必须与分组统计保持同一作用域——
// 软删除用户的令牌不计入 totalTokens，软删除令牌也不计入单用户 Count。
// 修复前 totalTokens 会包含软删除用户的令牌，导致总数虚高。
func TestSearchUserOptionsTotalTokensExcludesSoftDeletedUsers(t *testing.T) {
	setupUserUpdateTestState(t)

	// 可见用户 A：2 个有效令牌 + 1 个软删除令牌
	userA := User{Username: "option-visible-user", Password: "password", Status: common.UserStatusEnabled, AffCode: "aff-visible"}
	require.NoError(t, DB.Create(&userA).Error)

	// 软删除用户 B：2 个有效令牌（其令牌不应计入 totalTokens）
	userB := User{Username: "option-soft-deleted-user", Password: "password", Status: common.UserStatusEnabled, AffCode: "aff-deleted"}
	require.NoError(t, DB.Create(&userB).Error)
	require.NoError(t, DB.Delete(&userB).Error)

	validTokenA1 := Token{UserId: userA.Id, Key: "sk-option-a-1", Name: "a1"}
	require.NoError(t, DB.Create(&validTokenA1).Error)
	validTokenA2 := Token{UserId: userA.Id, Key: "sk-option-a-2", Name: "a2"}
	require.NoError(t, DB.Create(&validTokenA2).Error)
	softDeletedTokenA := Token{UserId: userA.Id, Key: "sk-option-a-deleted", Name: "a-deleted"}
	require.NoError(t, DB.Create(&softDeletedTokenA).Error)
	require.NoError(t, DB.Delete(&softDeletedTokenA).Error)

	for _, b := range []struct {
		UserId int
		Key    string
		Name   string
	}{
		{UserId: userB.Id, Key: "sk-option-b-1", Name: "b1"},
		{UserId: userB.Id, Key: "sk-option-b-2", Name: "b2"},
	} {
		require.NoError(t, DB.Create(&Token{UserId: b.UserId, Key: b.Key, Name: b.Name}).Error)
	}

	options, totalTokens, err := SearchUserOptions(true)
	require.NoError(t, err)

	// totalTokens 仅统计可见用户的未删除令牌：A 的 2 个（B 的 2 个与 A 的软删除 1 个均排除）
	assert.Equal(t, int64(2), totalTokens)

	// 下拉选项只包含可见用户 A，且 Count 为其有效令牌数
	require.Len(t, options, 1)
	assert.Equal(t, userA.Id, options[0].UserId)
	assert.Equal(t, userA.Username, options[0].Username)
	assert.Equal(t, int64(2), options[0].Count)
}
