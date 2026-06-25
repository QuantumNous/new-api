package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUserEditPreservesEnterpriseFlagWhenRequestOmitsIt(t *testing.T) {
	truncateTables(t)

	user := &User{
		Username:     "enterprise_user",
		DisplayName:  "Enterprise User",
		Password:     "hashed-password",
		Role:         common.RoleCommonUser,
		Status:       common.UserStatusEnabled,
		Group:        "Enterprise",
		IsEnterprise: true,
	}
	require.NoError(t, DB.Create(user).Error)

	update := &User{
		Id:          user.Id,
		Username:    user.Username,
		DisplayName: "Renamed User",
		Group:       user.Group,
		Remark:      "updated",
	}
	require.NoError(t, update.Edit(false))

	var got User
	require.NoError(t, DB.First(&got, user.Id).Error)
	require.True(t, got.IsEnterprise)
	require.Equal(t, "Renamed User", got.DisplayName)
	require.Equal(t, "updated", got.Remark)
}

func TestAdminInsertDefaultsToDefaultGroup(t *testing.T) {
	truncateTables(t)

	user := &User{
		Username:    "admin_default_group",
		DisplayName: "Admin Default Group",
		Password:    "password123",
		Role:        common.RoleAdminUser,
		Status:      common.UserStatusEnabled,
	}
	require.NoError(t, user.Insert(0))

	var got User
	require.NoError(t, DB.First(&got, user.Id).Error)
	require.Equal(t, defaultUserGroup, got.Group)
	require.True(t, got.IsEnterprise)
}
