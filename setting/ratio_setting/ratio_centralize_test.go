package ratio_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/require"
)

// TestBaseRatioEquivalence 锁死计费基准单一来源：USD 与 common.QuotaPerUnit 等价，
// 且 common 的换算函数互逆（阶段2 R2）。
func TestBaseRatioEquivalence(t *testing.T) {
	require.Equal(t, USD*1000, int(common.QuotaPerUnit), "USD*1000 必须等于 QuotaPerUnit")
	require.Equal(t, 500000, int(common.QuotaPerUnit), "QuotaPerUnit 运行期值必须严格为 500000")

	// RatioToUSDPerMillion / PricePerMillionToRatio 互逆
	for _, ratio := range []float64{0, 0.5, 1, 2.5, 37.5, 300} {
		usd := common.RatioToUSDPerMillion(ratio)
		require.InDelta(t, ratio, common.PricePerMillionToRatio(usd), 1e-9,
			"ratio->usd->ratio 必须往返恒等")
	}

	// 系数 = 1e6/QuotaPerUnit = 2
	require.InDelta(t, 2.0, common.RatioToUSDPerMillion(1), 1e-9)

	// USDToQuota：$1 = QuotaPerUnit/0.002 ... 这里直接验证语义 usd*QuotaPerUnit
	require.InDelta(t, common.QuotaPerUnit, common.USDToQuota(1), 1e-9)
}

// TestCacheRatioPrefixFallback 验证 claude-* 前缀回退（阶段2 2.5）：
// 未逐条枚举但匹配 claude- 前缀的型号必须返回 0.1，而非兜底 1。
func TestCacheRatioPrefixFallback(t *testing.T) {
	InitRatioSettings()

	t.Run("未枚举的 claude 新型号走前缀回退返回 0.1", func(t *testing.T) {
		ratio, ok := GetCacheRatio("claude-opus-4-9-future-not-enumerated")
		require.True(t, ok, "claude 前缀应视为有意义命中")
		require.Equal(t, 0.1, ratio)
	})

	t.Run("曾被逐条枚举的 claude 型号仍返回 0.1", func(t *testing.T) {
		ratio, ok := GetCacheRatio("claude-3-7-sonnet-20250219")
		require.True(t, ok)
		require.Equal(t, 0.1, ratio)
	})

	t.Run("非 claude 未配置型号回退兜底 1", func(t *testing.T) {
		ratio, ok := GetCacheRatio("totally-unknown-model-xyz")
		require.False(t, ok)
		require.Equal(t, defaultCacheRatioFallback, ratio)
	})

	t.Run("非 claude 精确命中走表值而非兜底1（gemini-2.5-pro=0.1）", func(t *testing.T) {
		ratio, ok := GetCacheRatio("gemini-2.5-pro")
		require.True(t, ok, "默认表精确命中应为有意义命中")
		require.Equal(t, 0.1, ratio)
	})
}
