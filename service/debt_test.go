package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedServiceDebtUser(t *testing.T, id, quota, debt int) {
	t.Helper()
	require.NoError(t, model.DB.Unscoped().Where("id = ?", id).Delete(&model.User{}).Error)
	require.NoError(t, model.DB.Create(&model.User{
		Id:       id,
		Username: "svc_debt_" + itoa(id),
		AffCode:  "svc_aff_" + itoa(id),
		Quota:    quota,
		Debt:     debt,
	}).Error)
	t.Cleanup(func() {
		_ = model.DB.Unscoped().Where("id = ?", id).Delete(&model.User{}).Error
	})
}

func itoa(i int) string {
	return string(rune('0' + i%10))
}

// FR-015（service 层链路）：WalletFunding.Settle 在余额不足时清零余额并把不足部分
// 记入 user.Debt。这条路径正是 BillingSession 结算时实际触发 debt 的入口。
func TestWalletFundingSettleCreatesDebtWhenInsufficient(t *testing.T) {
	cases := []struct {
		name        string
		quota       int
		delta       int
		wantQuota   int
		wantDebt    int
		wantShort   bool
	}{
		{name: "余额充足仅扣 quota", quota: 100, delta: 30, wantQuota: 70, wantDebt: 0, wantShort: false},
		{name: "余额不足清零并记 debt", quota: 2, delta: 10, wantQuota: 0, wantDebt: 8, wantShort: true},
		{name: "零余额全额 debt", quota: 0, delta: 5, wantQuota: 0, wantDebt: 5, wantShort: true},
		{name: "余额恰好不生 debt", quota: 50, delta: 50, wantQuota: 0, wantDebt: 0, wantShort: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			seedServiceDebtUser(t, 8001, tc.quota, 0)
			funding := &WalletFunding{userId: 8001}
			err := funding.Settle(tc.delta)
			require.NoError(t, err)
			var u model.User
			require.NoError(t, model.DB.Where("id = ?", 8001).First(&u).Error)
			assert.Equal(t, tc.wantQuota, u.Quota, "余额不匹配")
			assert.Equal(t, tc.wantDebt, u.Debt, "debt 不匹配")
			assert.GreaterOrEqual(t, u.Quota, 0, "余额不得为负")
		})
	}
}

// FR-016 的前提条件：debt > 0 时，NewBillingSession 在选源之前会基于
// GetUserDebt 拒绝请求。这里验证该判定信号在 service 层 settle 后被正确置位。
func TestWalletFundingSettleThenDebtBlocksCondition(t *testing.T) {
	seedServiceDebtUser(t, 8002, 2, 0)
	funding := &WalletFunding{userId: 8002}
	require.NoError(t, funding.Settle(10))

	debt, err := model.GetUserDebt(8002)
	require.NoError(t, err)
	assert.Equal(t, 8, debt, "debt>0 应触发 NewBillingSession 的阻塞分支")

	// FR-017：后续充值应优先抵扣该 debt
	net, repaid, err := model.OffsetUserDebtOnTopUp(8002, 100)
	require.NoError(t, err)
	assert.Equal(t, 92, net, "充值应先还 debt 8 再入 quota 92")
	assert.Equal(t, 8, repaid)

	debtAfter, err := model.GetUserDebt(8002)
	require.NoError(t, err)
	assert.Equal(t, 0, debtAfter, "充值后 debt 应清零，解除阻塞")
}

// delta=0 是 no-op，不触碰 quota 也不产生 debt。
func TestWalletFundingSettleNoOpOnZeroDelta(t *testing.T) {
	seedServiceDebtUser(t, 8003, 100, 0)
	funding := &WalletFunding{userId: 8003}
	require.NoError(t, funding.Settle(0))
	var u model.User
	require.NoError(t, model.DB.Where("id = ?", 8003).First(&u).Error)
	assert.Equal(t, 100, u.Quota)
	assert.Equal(t, 0, u.Debt)
}

// 退款路径（delta<0）不应被 debt 吞掉：必须增加 quota。
func TestWalletFundingSettleNegativeDeltaIsRefund(t *testing.T) {
	seedServiceDebtUser(t, 8004, 10, 0)
	funding := &WalletFunding{userId: 8004}
	require.NoError(t, funding.Settle(-5))
	var u model.User
	require.NoError(t, model.DB.Where("id = ?", 8004).First(&u).Error)
	assert.Equal(t, 15, u.Quota, "负 delta 是退款，应增加 quota")
	assert.Equal(t, 0, u.Debt, "退款不得影响 debt")
}
