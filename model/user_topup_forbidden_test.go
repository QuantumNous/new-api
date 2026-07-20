package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserById_PopulatesTopupForbidden(t *testing.T) {
	truncateTables(t)

	user := &User{
		Id:       1001,
		Username: "topup_forbidden_user",
		Status:   common.UserStatusEnabled,
	}
	user.SetSetting(dto.UserSetting{DisableTopup: true})
	require.NoError(t, DB.Create(user).Error)

	loaded, err := GetUserById(user.Id, false)
	require.NoError(t, err)
	require.NotNil(t, loaded)
	assert.True(t, loaded.TopupForbidden)
	assert.True(t, loaded.IsTopupForbidden())
}

func TestIsUserTopupForbidden_ReadsFromUserSetting(t *testing.T) {
	truncateTables(t)

	user := &User{
		Id:       1002,
		Username: "topup_guard_cache_user",
		Status:   common.UserStatusEnabled,
	}
	user.SetSetting(dto.UserSetting{DisableTopup: true})
	require.NoError(t, DB.Create(user).Error)

	forbidden, err := IsUserTopupForbidden(user.Id)
	require.NoError(t, err)
	assert.True(t, forbidden)
}
