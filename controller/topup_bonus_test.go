package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestTopUpBonusAmountUsesRequestedPreset(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	originalDisplayType := operation_setting.GetQuotaDisplayType()
	originalBonus := paymentSetting.AmountBonus
	originalGroups := paymentSetting.AmountBonusGroups
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
		paymentSetting.AmountBonus = originalBonus
		paymentSetting.AmountBonusGroups = originalGroups
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	paymentSetting.AmountBonus = map[int]int64{
		20: 5,
	}
	paymentSetting.AmountBonusGroups = map[int][]string{
		20: {TopUpBonusGroupAll},
	}

	require.Equal(t, int64(20), normalizeTopUpAmount(20))
	require.Equal(t, int64(5), configuredTopUpBonusAmount(20, "default"))
	require.Equal(t, int64(0), configuredTopUpBonusAmount(33, "default"))
}

func TestConfiguredTopUpAmountsReturnsBaseAndBonusSeparately(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	originalDisplayType := operation_setting.GetQuotaDisplayType()
	originalBonus := paymentSetting.AmountBonus
	originalGroups := paymentSetting.AmountBonusGroups
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
		paymentSetting.AmountBonus = originalBonus
		paymentSetting.AmountBonusGroups = originalGroups
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	paymentSetting.AmountBonus = map[int]int64{20: 5}
	paymentSetting.AmountBonusGroups = map[int][]string{20: {TopUpBonusGroupAll}}

	amount, bonus := configuredTopUpAmounts(20, "default")

	require.Equal(t, int64(20), amount) // Amount 只存本金，赠送是否发放推迟到回调判次
	require.Equal(t, int64(5), bonus)
}

func TestTopUpBonusAmountNormalizesTokenDisplay(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	originalDisplayType := operation_setting.GetQuotaDisplayType()
	originalBonus := paymentSetting.AmountBonus
	originalGroups := paymentSetting.AmountBonusGroups
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
		paymentSetting.AmountBonus = originalBonus
		paymentSetting.AmountBonusGroups = originalGroups
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	requestAmount := int64(20 * common.QuotaPerUnit)
	paymentSetting.AmountBonus = map[int]int64{
		int(requestAmount): int64(5 * common.QuotaPerUnit),
	}
	paymentSetting.AmountBonusGroups = map[int][]string{
		int(requestAmount): {TopUpBonusGroupAll},
	}

	require.Equal(t, int64(20), normalizeTopUpAmount(requestAmount))
	require.Equal(t, int64(5), configuredTopUpBonusAmount(requestAmount, "default"))
}

// TestTopUpBonusGroupWhitelist 覆盖 opt-in 用户组白名单的全部分支。
func TestTopUpBonusGroupWhitelist(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	originalDisplayType := operation_setting.GetQuotaDisplayType()
	originalBonus := paymentSetting.AmountBonus
	originalGroups := paymentSetting.AmountBonusGroups
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
		paymentSetting.AmountBonus = originalBonus
		paymentSetting.AmountBonusGroups = originalGroups
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	paymentSetting.AmountBonus = map[int]int64{20: 5}

	cases := []struct {
		name   string
		groups map[int][]string
		group  string
		want   int64
	}{
		{"未配该档位=不送", map[int][]string{}, "plg", 0},
		{"空数组=不送", map[int][]string{20: {}}, "plg", 0},
		{"all=全送", map[int][]string{20: {TopUpBonusGroupAll}}, "plg", 5},
		{"命中组=送", map[int][]string{20: {"plg"}}, "plg", 5},
		{"不命中组=不送", map[int][]string{20: {"vip"}}, "plg", 0},
		{"多组之一命中=送", map[int][]string{20: {"vip", "plg"}}, "plg", 5},
		{"all 与具体组混合=全送", map[int][]string{20: {"vip", TopUpBonusGroupAll}}, "enterprise-x", 5},
		{"组名带空格也命中(兼容历史脏数据)", map[int][]string{20: {" plg "}}, "plg", 5},
		{"all 带空格也全送", map[int][]string{20: {" all "}}, "plg", 5},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			paymentSetting.AmountBonusGroups = tc.groups
			require.Equal(t, tc.want, configuredTopUpBonusAmount(20, tc.group))
		})
	}
}

// TestConfiguredTopUpAmountsKeepsBaseWhenBonusGroupDenied 验证白名单拒绝时本金照常、
// 赠送归零。归零后下游 applyTopUpBonusInTx 因 BonusAmount<=0 直接返回，不触发限次逻辑，
// 这正是白名单与限次两层的边界。
func TestConfiguredTopUpAmountsKeepsBaseWhenBonusGroupDenied(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	originalDisplayType := operation_setting.GetQuotaDisplayType()
	originalBonus := paymentSetting.AmountBonus
	originalGroups := paymentSetting.AmountBonusGroups
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
		paymentSetting.AmountBonus = originalBonus
		paymentSetting.AmountBonusGroups = originalGroups
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	paymentSetting.AmountBonus = map[int]int64{20: 5}
	paymentSetting.AmountBonusGroups = map[int][]string{20: {"vip"}} // 当前用户组 plg 不在白名单

	amount, bonus := configuredTopUpAmounts(20, "plg")

	require.Equal(t, int64(20), amount)
	require.Equal(t, int64(0), bonus)
}

func TestConfiguredBonusDoesNotChangeChannelPayMoney(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	originalDisplayType := operation_setting.GetQuotaDisplayType()
	originalPrice := operation_setting.Price
	originalStripeUnitPrice := setting.StripeUnitPrice
	originalPaddleUnitPrice := setting.PaddleUnitPrice
	originalWaffoUnitPrice := setting.WaffoUnitPrice
	originalWaffoPancakeUnitPrice := setting.WaffoPancakeUnitPrice
	originalDiscount := paymentSetting.AmountDiscount
	originalBonus := paymentSetting.AmountBonus
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
		operation_setting.Price = originalPrice
		setting.StripeUnitPrice = originalStripeUnitPrice
		setting.PaddleUnitPrice = originalPaddleUnitPrice
		setting.WaffoUnitPrice = originalWaffoUnitPrice
		setting.WaffoPancakeUnitPrice = originalWaffoPancakeUnitPrice
		paymentSetting.AmountDiscount = originalDiscount
		paymentSetting.AmountBonus = originalBonus
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio))
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	operation_setting.Price = 1
	setting.StripeUnitPrice = 1
	setting.PaddleUnitPrice = 1
	setting.WaffoUnitPrice = 1
	setting.WaffoPancakeUnitPrice = 1
	paymentSetting.AmountDiscount = map[int]float64{}
	paymentSetting.AmountBonus = map[int]int64{20: 5}
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1}`))

	require.Equal(t, 20.0, getPayMoney(20, "default"))
	require.Equal(t, 20.0, getStripePayMoney(20, "default"))
	require.Equal(t, 20.0, getPaddlePayMoney(20, "default"))
	require.Equal(t, 20.0, getWaffoPayMoney(20, "default"))
	require.Equal(t, 20.0, getWaffoPancakePayMoney(20, "default"))
}
