package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func insertUserWithCustomOAuthBinding(t *testing.T, userId int, providerId int) {
	t.Helper()
	require.NoError(t, DB.Create(&User{
		Id:       userId,
		Username: "custom_oauth_deleted_user",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, CreateUserOAuthBinding(&UserOAuthBinding{
		UserId:         userId,
		ProviderId:     providerId,
		ProviderUserId: "provider-user-id",
	}))
}

func countCustomOAuthBindingsForUser(t *testing.T, userId int) int64 {
	t.Helper()
	var count int64
	require.NoError(t, DB.Model(&UserOAuthBinding{}).Where("user_id = ?", userId).Count(&count).Error)
	return count
}

func TestDeleteUserById_RemovesCustomOAuthBindings(t *testing.T) {
	truncateTables(t)

	insertUserWithCustomOAuthBinding(t, 201, 301)
	require.Equal(t, int64(1), countCustomOAuthBindingsForUser(t, 201))

	require.NoError(t, DeleteUserById(201))

	require.Equal(t, int64(0), countCustomOAuthBindingsForUser(t, 201))
}

func TestHardDeleteUserById_RemovesCustomOAuthBindings(t *testing.T) {
	truncateTables(t)

	insertUserWithCustomOAuthBinding(t, 202, 302)
	require.Equal(t, int64(1), countCustomOAuthBindingsForUser(t, 202))

	require.NoError(t, HardDeleteUserById(202))

	require.Equal(t, int64(0), countCustomOAuthBindingsForUser(t, 202))
}
