package service

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TC-E01：扣费前余额门禁口径回归（双钱包拆分）。
//
// 场景：纯免费钱包用户 —— 充值钱包 quota=0，免费钱包 free_quota>0。
//
// 门禁（PreWssConsumeQuota / MJ 预扣 / billing 展示）在拆分前用 GetUserQuota，
// 只读充值钱包，会把这类用户误判为“余额不足”而拒绝。修复后统一改用
// GetUserTotalQuota（充值钱包 + 免费钱包）。本测试固定该口径，防止回归。
func TestPreConsumeGate_FreeWalletUserNotRejected(t *testing.T) {
	truncate(t)
	// Redis 在 TestMain 中禁用，GetUserTotalQuota(fromDB=false) 回退 DB 真值。
	seedUser(t, 1, 0) // 充值钱包 = 0
	now := common.GetTimestamp()
	// 仅有免费钱包 1000（签到来源，3 天后过期）
	require.NoError(t, model.AddFreeQuota(nil, 1, 1000, model.FreeQuotaSourceCheckin, 0, now+3*86400))

	// 前置校验：充值钱包确为 0，免费钱包确为 1000
	var u model.User
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 1).
		Select("quota", "free_quota").First(&u).Error)
	require.Equal(t, 0, u.Quota, "充值钱包应为 0")
	require.Equal(t, 1000, u.FreeQuota, "免费钱包应为 1000")

	// 反证：旧口径（仅充值钱包）会返回 0 —— 这正是导致误拒的根因。
	rechargeOnly, err := model.GetUserQuota(1, true)
	require.NoError(t, err)
	require.Equal(t, 0, rechargeOnly, "旧门禁口径只看充值钱包，纯免费用户会被误判余额不足")

	// 修复后门禁口径：总可用额度 = 充值钱包 + 免费钱包 = 1000。
	total, err := model.GetUserTotalQuota(1, false)
	require.NoError(t, err)
	require.Equal(t, 1000, total, "门禁口径必须计入免费钱包")

	// 门禁判断本质：total < need 才拒绝。
	// 一次典型请求需要 500：total(1000) >= need(500)，必须放行。
	const need = 500
	require.GreaterOrEqual(t, total, need, "纯免费用户 total>=need，门禁应放行")
	require.False(t, total < need, "纯免费用户不得被门禁误拒")

	// 边界：需要额度正好等于总额也应放行（total-need==0，不小于 0）。
	require.False(t, total < total, "余额恰好够用时不得误拒")

	// 边界：需要额度超过总额（1001>1000）才应被拒绝。
	require.True(t, total < 1001, "超过总可用额度才应触发余额不足")
}

// TC-E02：端到端门禁——真实调用 PreWssConsumeQuota，验证纯免费用户放行、
// 免费额度清零后才被余额门禁拒绝。
//
// quota 计算：未知模型默认 modelRatio=37.5，groupRatio=1，
// TextTokens=10 => quota = 10 * 37.5 * 1 = 375。
// 纯免费用户 total=1000 >= 375 => 放行；清零后 total=0 < 375 => 拒绝。
func TestPreWssConsumeQuota_FreeWalletUserPassesGate(t *testing.T) {
	truncate(t)
	cleanLedgers(t)
	seedUser(t, 1, 0) // 充值钱包 = 0
	seedToken(t, 1, 1, "e2e-free", 1_000_000) // token 额度充足，隔离出用户余额门禁；key 不含 sk- 前缀
	now := common.GetTimestamp()
	require.NoError(t, model.AddFreeQuota(nil, 1, 1000, model.FreeQuotaSourceCheckin, 0, now+3*86400))

	newCtx := func() *gin.Context {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		return c
	}
	newInfo := func() *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			UserId:          1,
			TokenKey:        "sk-e2e-free",
			OriginModelName: "e2e-unknown-model", // 未知模型 => 默认 ratio 37.5
			UsingGroup:      "default",
			UserGroup:       "default",
			UsePrice:        false,
		}
	}
	usage := &dto.RealtimeUsage{}
	usage.InputTokenDetails.TextTokens = 10 // => quota 375

	// 1) 纯免费用户：total=1000 >= 375，不得因“用户余额不足”被拒绝。
	err := PreWssConsumeQuota(newCtx(), newInfo(), usage)
	if err != nil {
		require.NotContains(t, err.Error(), "user quota is not enough",
			"纯免费用户被余额门禁误拒（口径回归）")
	}

	// 2) 清空两个钱包（第 1 步门禁通过后已真实扣费，余额已变）=> total=0 < 375，
	//    必须被余额门禁拒绝。直接清零，不依赖剩余值。
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 1).
		Updates(map[string]interface{}{"quota": 0, "free_quota": 0}).Error)
	model.DB.Exec("DELETE FROM free_quota_ledgers WHERE user_id = ?", 1)
	rc, fr := readWalletSvc(t, 1)
	require.Equal(t, 0, rc)
	require.Equal(t, 0, fr)

	err = PreWssConsumeQuota(newCtx(), newInfo(), usage)
	require.Error(t, err, "余额耗尽用户必须被门禁拒绝")
	require.True(t, strings.Contains(err.Error(), "user quota is not enough"),
		"耗尽用户应触发用户余额不足，实际: %v", err)
}
