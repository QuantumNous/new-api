package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

// TestNormalizeAmountBonusGroupsOptionValue 覆盖充值赠送用户组白名单的保存校验与归一化：
// - 组名首尾空格 trim 后落库（避免精确匹配漏命中、silent under-grant）
// - 孤儿档位（无对应 bonus 金额）自动丢弃
// - all 与真实用户组冲突时拒绝
func TestNormalizeAmountBonusGroupsOptionValue(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	originalBonus := paymentSetting.AmountBonus
	t.Cleanup(func() {
		paymentSetting.AmountBonus = originalBonus
	})
	// 让 20 / 100 成为有效赠送档位，否则白名单会被孤儿规则丢弃。
	paymentSetting.AmountBonus = map[int]int64{20: 5, 100: 30}

	parse := func(t *testing.T, s string) map[int][]string {
		t.Helper()
		var got map[int][]string
		require.NoError(t, common.UnmarshalJsonStr(s, &got))
		return got
	}

	t.Run("空串归一为 {}", func(t *testing.T) {
		out, err := normalizeAmountBonusGroupsOptionValue("")
		require.NoError(t, err)
		require.Equal(t, "{}", out)
	})

	t.Run("组名首尾空格被 trim 后落库", func(t *testing.T) {
		out, err := normalizeAmountBonusGroupsOptionValue(`{"20":[" plg ","  vip"]}`)
		require.NoError(t, err)
		require.Equal(t, []string{"plg", "vip"}, parse(t, out)[20])
	})

	t.Run("all 关键字带空格也被 trim", func(t *testing.T) {
		out, err := normalizeAmountBonusGroupsOptionValue(`{"100":[" all "]}`)
		require.NoError(t, err)
		require.Equal(t, []string{"all"}, parse(t, out)[100])
	})

	t.Run("纯空格组名报错", func(t *testing.T) {
		_, err := normalizeAmountBonusGroupsOptionValue(`{"20":["   "]}`)
		require.Error(t, err)
	})

	t.Run("非正充值金额报错", func(t *testing.T) {
		_, err := normalizeAmountBonusGroupsOptionValue(`{"0":["plg"]}`)
		require.Error(t, err)
	})

	t.Run("非法 JSON 报错", func(t *testing.T) {
		_, err := normalizeAmountBonusGroupsOptionValue(`not-json`)
		require.Error(t, err)
	})

	t.Run("空数组保留(显式不发)", func(t *testing.T) {
		out, err := normalizeAmountBonusGroupsOptionValue(`{"20":[]}`)
		require.NoError(t, err)
		require.Equal(t, []string{}, parse(t, out)[20])
	})

	t.Run("孤儿档位(无对应 bonus)被丢弃", func(t *testing.T) {
		// 999 不在 AmountBonus 档位里 → 丢弃；20 有效 → 保留。
		out, err := normalizeAmountBonusGroupsOptionValue(`{"20":["plg"],"999":["vip"]}`)
		require.NoError(t, err)
		got := parse(t, out)
		require.Equal(t, []string{"plg"}, got[20])
		_, has999 := got[999]
		require.False(t, has999, "孤儿档位 999 应被丢弃")
	})
}

// TestNormalizeAmountBonusGroupsOptionValue_AllReservedConflict 覆盖 all 保留字冲突：
// 当系统真实存在名为 all 的用户组时，白名单里的 all 有歧义，拒绝保存。
func TestNormalizeAmountBonusGroupsOptionValue_AllReservedConflict(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	originalBonus := paymentSetting.AmountBonus
	originalTopupRatio := common.TopupGroupRatio2JSONString()
	t.Cleanup(func() {
		paymentSetting.AmountBonus = originalBonus
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupRatio))
	})
	paymentSetting.AmountBonus = map[int]int64{20: 5}

	t.Run("无名为 all 的真实组时 all 通配符正常", func(t *testing.T) {
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"plg":1,"vip":0.9}`))
		out, err := normalizeAmountBonusGroupsOptionValue(`{"20":["all"]}`)
		require.NoError(t, err)
		require.Contains(t, out, "all")
	})

	t.Run("存在名为 all 的真实组时拒绝", func(t *testing.T) {
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"plg":1,"all":0.8}`))
		_, err := normalizeAmountBonusGroupsOptionValue(`{"20":["all"]}`)
		require.Error(t, err)
	})
}
