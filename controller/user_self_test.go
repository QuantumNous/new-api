package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildSelfUserDataIncludesAccountOverviewFields(t *testing.T) {
	accessToken := "management-token"
	user := &model.User{
		Id:           42,
		Username:     "member-overview",
		Password:     "password-hash",
		AccessToken:  &accessToken,
		Remark:       "administrator-only",
		Role:         common.RoleCommonUser,
		Status:       common.UserStatusEnabled,
		RequestCount: 12_345,
		CreatedAt:    1_700_000_000,
		Quota:        50_000,
		UsedQuota:    20_000,
		DisplayName:  "Member Overview",
		Email:        "member@example.com",
		AuthVersion:  1,
	}

	data := buildSelfUserData(user)

	require.NotNil(t, data)
	assert.Equal(t, common.UserStatusEnabled, data["status"])
	assert.Equal(t, 12_345, data["request_count"])
	assert.Equal(t, int64(1_700_000_000), data["created_at"])
	assert.NotContains(t, data, "password")
	assert.NotContains(t, data, "access_token")
	assert.NotContains(t, data, "remark")
}
