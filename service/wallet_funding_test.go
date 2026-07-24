package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

// cleanLedgers 清理免费明细表（truncate 未覆盖）。
func cleanLedgers(t *testing.T) {
	t.Helper()
	model.DB.Exec("DELETE FROM free_quota_ledgers")
	t.Cleanup(func() { model.DB.Exec("DELETE FROM free_quota_ledgers") })
}

// readWalletSvc 直接读 DB 充值/免费钱包真值。
func readWalletSvc(t *testing.T, userId int) (recharge, free int) {
	t.Helper()
	var u model.User
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userId).
		Select("quota", "free_quota").First(&u).Error)
	return u.Quota, u.FreeQuota
}

// TC-D01：WalletFunding 预扣走三级扣减，账本记录正确，consumed 镜像一致。
func TestWalletFundingPreConsumeLedger(t *testing.T) {
	truncate(t)
	cleanLedgers(t)
	seedUser(t, 1, 3000)
	now := common.GetTimestamp()
	require.NoError(t, model.AddFreeQuota(nil, 1, 2000, model.FreeQuotaSourceCheckin, 0, now+3*86400))

	w := &WalletFunding{userId: 1}
	// 预扣 2500：免费 2000 + 充值 500
	require.NoError(t, w.PreConsume(2500))
	require.Equal(t, 2500, w.consumed)
	require.Equal(t, 500, w.fromRecharge)
	require.Equal(t, 2000, sumFree(w.fromFree))
	// 不变式：consumed == sumFree + fromRecharge
	require.Equal(t, w.consumed, sumFree(w.fromFree)+w.fromRecharge)

	recharge, free := readWalletSvc(t, 1)
	require.Equal(t, 2500, recharge) // 3000-500
	require.Equal(t, 0, free)        // 2000 扣光
}

// TC-D02：预扣→补扣(Settle delta>0)→账本合并；再全额 Refund 原路返回。
func TestWalletFundingSettleUpThenRefund(t *testing.T) {
	truncate(t)
	cleanLedgers(t)
	seedUser(t, 1, 5000)
	now := common.GetTimestamp()
	require.NoError(t, model.AddFreeQuota(nil, 1, 1000, model.FreeQuotaSourceCheckin, 0, now+3*86400))

	w := &WalletFunding{userId: 1}
	require.NoError(t, w.PreConsume(800)) // 全从免费扣 800
	require.Equal(t, 800, sumFree(w.fromFree))
	require.Equal(t, 0, w.fromRecharge)

	// 补扣 700：免费剩 200 扣光 + 充值 500
	require.NoError(t, w.Settle(700))
	require.Equal(t, 1500, w.consumed)
	require.Equal(t, 500, w.fromRecharge)
	require.Equal(t, 1000, sumFree(w.fromFree)) // 800+200 合并
	require.Equal(t, w.consumed, sumFree(w.fromFree)+w.fromRecharge)

	recharge, free := readWalletSvc(t, 1)
	require.Equal(t, 4500, recharge)
	require.Equal(t, 0, free)

	// 全额退款：充值退回 500，免费明细恢复 1000
	require.NoError(t, w.Refund())
	require.Equal(t, 0, w.consumed)
	require.Nil(t, w.fromFree)
	recharge, free = readWalletSvc(t, 1)
	require.Equal(t, 5000, recharge)
	require.Equal(t, 1000, free)
}

// TC-D03：部分退还(Settle delta<0)——先退充值钱包，再退免费明细 LIFO。
func TestWalletFundingSettleDownRefundOrder(t *testing.T) {
	truncate(t)
	cleanLedgers(t)
	seedUser(t, 1, 2000)
	now := common.GetTimestamp()
	require.NoError(t, model.AddFreeQuota(nil, 1, 1500, model.FreeQuotaSourceCheckin, 0, now+3*86400))

	w := &WalletFunding{userId: 1}
	// 预扣 3000：免费 1500 + 充值 1500
	require.NoError(t, w.PreConsume(3000))
	require.Equal(t, 1500, w.fromRecharge)
	require.Equal(t, 1500, sumFree(w.fromFree))
	recharge, free := readWalletSvc(t, 1)
	require.Equal(t, 500, recharge)
	require.Equal(t, 0, free)

	// 退还 1000：策略先退充值钱包（1500 里退 1000）
	require.NoError(t, w.Settle(-1000))
	require.Equal(t, 2000, w.consumed)
	require.Equal(t, 500, w.fromRecharge)    // 1500-1000
	require.Equal(t, 1500, sumFree(w.fromFree)) // 免费未动
	recharge, free = readWalletSvc(t, 1)
	require.Equal(t, 1500, recharge) // 500+1000 退回充值
	require.Equal(t, 0, free)        // 免费还没恢复

	// 再退 800：充值只剩 500 记录，退完 500 后从免费 LIFO 退 300
	require.NoError(t, w.Settle(-800))
	require.Equal(t, 1200, w.consumed)
	require.Equal(t, 0, w.fromRecharge)
	require.Equal(t, 1200, sumFree(w.fromFree)) // 1500-300
	recharge, free = readWalletSvc(t, 1)
	require.Equal(t, 2000, recharge) // 1500+500
	require.Equal(t, 300, free)      // 免费恢复 300
}

// TC-D04：透支补扣——余额不足时 Settle 补扣差额透支充值钱包。
func TestWalletFundingSettleOverdraft(t *testing.T) {
	truncate(t)
	cleanLedgers(t)
	seedUser(t, 1, 500)

	w := &WalletFunding{userId: 1}
	require.NoError(t, w.PreConsume(500)) // 充值 500 扣光
	require.Equal(t, 500, w.fromRecharge)

	// 补扣 300，但余额已 0 → 透支 300
	require.NoError(t, w.Settle(300))
	require.Equal(t, 800, w.consumed)
	require.Equal(t, 800, w.fromRecharge) // 500 + 300 透支
	recharge, free := readWalletSvc(t, 1)
	require.Equal(t, -300, recharge) // 透支为负
	require.Equal(t, 0, free)
}
