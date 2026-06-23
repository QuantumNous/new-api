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
