package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestGetTopUpInfoRejectsRechargeRestrictedUser(t *testing.T) {
	db := setupUserRechargeControllerTestDB(t)
	user := seedRechargeUser(t, db, model.User{
		Username:      "topup-disabled-user",
		Password:      "password123",
		DisplayName:   "Topup Disabled",
		Role:          common.RoleCommonUser,
		Status:        common.UserStatusEnabled,
		Group:         "default",
		AllowRecharge: false,
	})

	ctx, recorder := newUserRechargeContext(t, http.MethodGet, "/api/user/topup/info", nil, user.Id, common.RoleCommonUser)
	GetTopUpInfo(ctx)

	response := decodeUserRechargeResponse(t, recorder)
	require.False(t, response.Success)
	require.Equal(t, "当前账户不支持充值", response.Message)
}

func TestRequestAmountRejectsRechargeRestrictedUser(t *testing.T) {
	db := setupUserRechargeControllerTestDB(t)
	user := seedRechargeUser(t, db, model.User{
		Username:      "amount-disabled-user",
		Password:      "password123",
		DisplayName:   "Amount Disabled",
		Role:          common.RoleCommonUser,
		Status:        common.UserStatusEnabled,
		Group:         "default",
		AllowRecharge: false,
	})

	ctx, recorder := newUserRechargeContext(t, http.MethodPost, "/api/user/amount", map[string]any{
		"amount": 1,
	}, user.Id, common.RoleCommonUser)
	RequestAmount(ctx)

	response := decodeUserRechargeResponse(t, recorder)
	require.False(t, response.Success)
	require.Equal(t, "当前账户不支持充值", response.Message)
}

func TestGetTopUpInfoAllowsRechargeEnabledUser(t *testing.T) {
	db := setupUserRechargeControllerTestDB(t)
	user := seedRechargeUser(t, db, model.User{
		Username:      "topup-enabled-user",
		Password:      "password123",
		DisplayName:   "Topup Enabled",
		Role:          common.RoleCommonUser,
		Status:        common.UserStatusEnabled,
		Group:         "default",
		AllowRecharge: true,
	})

	ctx, recorder := newUserRechargeContext(t, http.MethodGet, "/api/user/topup/info", nil, user.Id, common.RoleCommonUser)
	GetTopUpInfo(ctx)

	response := decodeUserRechargeResponse(t, recorder)
	require.True(t, response.Success, response.Message)
}
