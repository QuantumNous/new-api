package model

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedDebtUser(t *testing.T, id, quota, debt int) {
	t.Helper()
	require.NoError(t, DB.Unscoped().Where("id = ?", id).Delete(&User{}).Error)
	require.NoError(t, DB.Create(&User{
		Id:       id,
		Username: "debt_user_" + strconv.Itoa(id),
		AffCode:  "aff_" + strconv.Itoa(id),
		Quota:    quota,
		Debt:     debt,
	}).Error)
}

func reloadDebtUser(t *testing.T, id int) User {
	t.Helper()
	var u User
	require.NoError(t, DB.Where("id = ?", id).First(&u).Error)
	return u
}

// FR-015：结算扣费时余额不足，余额清零，不足部分记入 debt，余额永不为负。
func TestSettleWalletChargeWithDebt(t *testing.T) {
	cases := []struct {
		name          string
		quota         int
		charge        int
		wantShortfall int
		wantQuota     int
		wantDebt      int
	}{
		{name: "余额充足", quota: 100, charge: 30, wantShortfall: 0, wantQuota: 70, wantDebt: 0},
		{name: "余额恰好", quota: 50, charge: 50, wantShortfall: 0, wantQuota: 0, wantDebt: 0},
		{name: "余额不足记欠额", quota: 2, charge: 10, wantShortfall: 8, wantQuota: 0, wantDebt: 8},
		{name: "零余额全额欠", quota: 0, charge: 5, wantShortfall: 5, wantQuota: 0, wantDebt: 5},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			seedDebtUser(t, 7001, tc.quota, 0)
			shortfall, err := SettleWalletChargeWithDebt(7001, tc.charge)
			require.NoError(t, err)
			assert.Equal(t, tc.wantShortfall, shortfall)
			u := reloadDebtUser(t, 7001)
			assert.Equal(t, tc.wantQuota, u.Quota)
			assert.Equal(t, tc.wantDebt, u.Debt)
			assert.GreaterOrEqual(t, u.Quota, 0, "余额不能为负")
		})
	}
}

func TestSettleWalletChargeWithDebtRejectsNegative(t *testing.T) {
	seedDebtUser(t, 7002, 100, 0)
	_, err := SettleWalletChargeWithDebt(7002, -1)
	require.Error(t, err)
	u := reloadDebtUser(t, 7002)
	assert.Equal(t, 100, u.Quota)
}

// FR-017：充值入账时优先抵扣 debt，剩余部分才进入 quota。
func TestOffsetUserDebtOnTopUp(t *testing.T) {
	cases := []struct {
		name       string
		quota      int
		debt       int
		amount     int
		wantNet    int
		wantRepaid int
		wantQuota  int
		wantDebt   int
	}{
		{name: "无欠额全额入账", quota: 10, debt: 0, amount: 100, wantNet: 100, wantRepaid: 0, wantQuota: 110, wantDebt: 0},
		{name: "充值大于欠额", quota: 0, debt: 30, amount: 100, wantNet: 70, wantRepaid: 30, wantQuota: 70, wantDebt: 0},
		{name: "充值恰好抵欠额", quota: 5, debt: 40, amount: 40, wantNet: 0, wantRepaid: 40, wantQuota: 5, wantDebt: 0},
		{name: "充值小于欠额", quota: 5, debt: 100, amount: 40, wantNet: 0, wantRepaid: 40, wantQuota: 5, wantDebt: 60},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			seedDebtUser(t, 7003, tc.quota, tc.debt)
			net, repaid, err := OffsetUserDebtOnTopUp(7003, tc.amount)
			require.NoError(t, err)
			assert.Equal(t, tc.wantNet, net)
			assert.Equal(t, tc.wantRepaid, repaid)
			u := reloadDebtUser(t, 7003)
			assert.Equal(t, tc.wantQuota, u.Quota)
			assert.Equal(t, tc.wantDebt, u.Debt)
		})
	}
}

func TestOffsetUserDebtOnTopUpRejectsNonPositive(t *testing.T) {
	seedDebtUser(t, 7004, 0, 50)
	_, _, err := OffsetUserDebtOnTopUp(7004, 0)
	require.Error(t, err)
	u := reloadDebtUser(t, 7004)
	assert.Equal(t, 50, u.Debt, "非法入账不得改变 debt")
}

func TestGetUserDebt(t *testing.T) {
	seedDebtUser(t, 7005, 0, 123)
	debt, err := GetUserDebt(7005)
	require.NoError(t, err)
	assert.Equal(t, 123, debt)
}
