package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

// TestNormalizeAmountBonusGroupsOptionValue 覆盖充值赠送用户组白名单的保存校验与归一化：
// 重点是组名首尾空格会被 trim 后落库，避免「配置看似有效却因精确匹配永不命中而不发放」。
func TestNormalizeAmountBonusGroupsOptionValue(t *testing.T) {
	t.Run("空串归一为 {}", func(t *testing.T) {
		out, err := normalizeAmountBonusGroupsOptionValue("")
		require.NoError(t, err)
		require.Equal(t, "{}", out)
	})

	t.Run("组名首尾空格被 trim 后落库", func(t *testing.T) {
		out, err := normalizeAmountBonusGroupsOptionValue(`{"20":[" plg ","  vip"]}`)
		require.NoError(t, err)
		// 重新解析校验值已 trim，不依赖序列化后的字面顺序。
		var got map[int][]string
		require.NoError(t, common.UnmarshalJsonStr(out, &got))
		require.Equal(t, []string{"plg", "vip"}, got[20])
	})

	t.Run("all 关键字带空格也被 trim", func(t *testing.T) {
		out, err := normalizeAmountBonusGroupsOptionValue(`{"100":[" all "]}`)
		require.NoError(t, err)
		var got map[int][]string
		require.NoError(t, common.UnmarshalJsonStr(out, &got))
		require.Equal(t, []string{"all"}, got[100])
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
		var got map[int][]string
		require.NoError(t, common.UnmarshalJsonStr(out, &got))
		require.Equal(t, []string{}, got[20])
	})
}
