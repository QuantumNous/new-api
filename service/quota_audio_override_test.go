package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/stretchr/testify/require"
)

// 这些测试刻画 calculateAudioQuota 中「每模型 + 每分组直接价格覆盖」定制特性
// (custom feature #4/#5)在音频计费路径上的对外行为。该路径此前零测试覆盖,
// 这里补上安全网:既守护覆盖逻辑不被上游升级冲掉,也作为后续重构的回归基线。
//
// 关键设计:当某个分量价格被设置时,结果只由 price / tokens / QuotaPerUnit 决定,
// 完全不依赖任何全局 ratio 配置(GetCompletionRatio/GetAudioRatio 等),因此在
// 内存 SQLite、零预置配置的测试环境下也是确定值。
//
// 推导基于 common.QuotaPerUnit = 500000,折算因子 = QuotaPerUnit / 1e6 = 0.5。
// 即「USD/百万 token」价格 p、token 数 n 的额度 = p * n * 0.5。

// 按次计费(UsePrice)时,分组的 model_price 覆盖优先于 info.ModelPrice,
// 且不再叠乘 GroupRatio。证明覆盖值彻底接管按次计费。
func TestCalculateAudioQuota_UsePrice_OverrideModelPriceWins(t *testing.T) {
	got := calculateAudioQuota(QuotaInfo{
		UsePrice:   true,
		ModelPrice: 99, // 上游价格,必须被忽略
		GroupRatio: 99, // 覆盖路径不叠乘分组倍率,必须被忽略
		Override:   &types.ModelGroupPricing{ModelPrice: testFloat64Ptr(0.25)},
	})

	// 0.25 * 500000 = 125000
	require.Equal(t, 125000, got)
}

// 按量计费时,四个分量价格(prompt / completion / audio_in / audio_out)全部设置,
// 结果完全由覆盖价决定,ModelRatio / GroupRatio 即便设成 99 也被忽略。
func TestCalculateAudioQuota_TokenPath_AllComponentPricesOverrideRatios(t *testing.T) {
	// 锚定折算前提:期望值按 QuotaPerUnit=500000 推导,若该常量变动需重算。
	require.Equal(t, 500000.0, common.QuotaPerUnit, "本测试的期望额度基于 QuotaPerUnit=500000")

	got := calculateAudioQuota(QuotaInfo{
		UsePrice:      false,
		ModelName:     "irrelevant-all-prices-set",
		ModelRatio:    99, // 全分量覆盖时被忽略
		GroupRatio:    99, // 全分量覆盖时被忽略
		InputDetails:  TokenDetails{TextTokens: 1000, AudioTokens: 2000},
		OutputDetails: TokenDetails{TextTokens: 500, AudioTokens: 300},
		Override: &types.ModelGroupPricing{
			PromptPrice:          testFloat64Ptr(0.1), // 输入文本
			CompletionPrice:      testFloat64Ptr(0.6), // 输出文本
			AudioPrice:           testFloat64Ptr(2.0), // 输入音频
			AudioCompletionPrice: testFloat64Ptr(4.0), // 输出音频
		},
	})

	// prompt:     0.1 * 1000 * 0.5 = 50
	// completion: 0.6 * 500  * 0.5 = 150
	// audio in:   2.0 * 2000 * 0.5 = 2000
	// audio out:  4.0 * 300  * 0.5 = 600
	// total = 2800
	require.Equal(t, 2800, got)
}

// 按量计费时,部分分量有覆盖价、部分留空回退到倍率公式:
// PromptPrice 留空 → 输入文本走 tokens*1*modelRatio*groupRatio;
// CompletionPrice 有值 → 输出文本走覆盖价,忽略 completionRatio。
// 证明同一次计费里覆盖与倍率回退可以共存。
func TestCalculateAudioQuota_TokenPath_MixedOverrideAndRatioFallback(t *testing.T) {
	got := calculateAudioQuota(QuotaInfo{
		UsePrice:      false,
		ModelName:     "unknown-mixed-x",
		ModelRatio:    2,
		GroupRatio:    3,
		InputDetails:  TokenDetails{TextTokens: 1000}, // prompt 价留空 → 倍率回退
		OutputDetails: TokenDetails{TextTokens: 500},  // completion 价覆盖
		Override: &types.ModelGroupPricing{
			CompletionPrice: testFloat64Ptr(0.6),
		},
	})

	// prompt 回退:    1000 * 1 * 2 * 3 = 6000
	// completion 覆盖: 0.6 * 500 * 0.5 = 150
	// 音频 0 token  = 0
	// total = 6150
	require.Equal(t, 6150, got)
}

// 按量计费时,覆盖价把额度算成 0 但确有 token,则按最低计费 1 处理。
// PromptPrice 设成指向 0 的指针:HasPriceOverride() 为真(进入覆盖分支),但额度算 0。
func TestCalculateAudioQuota_TokenPath_OverrideZeroQuotaWithTokensChargesOne(t *testing.T) {
	got := calculateAudioQuota(QuotaInfo{
		UsePrice:     false,
		ModelName:    "unknown-min-charge-x",
		ModelRatio:   2,
		GroupRatio:   3,
		InputDetails: TokenDetails{TextTokens: 1000},
		Override:     &types.ModelGroupPricing{PromptPrice: testFloat64Ptr(0)},
	})

	require.Equal(t, 1, got)
}

// Override 为 nil(无分组价格覆盖)时,音频计费完全走上游倍率公式,
// 定制分支不得泄漏到默认路径。这是「升级维护」最重要的一条安全网。
func TestCalculateAudioQuota_TokenPath_NilOverrideUsesUpstreamRatioPath(t *testing.T) {
	got := calculateAudioQuota(QuotaInfo{
		UsePrice:     false,
		ModelName:    "unknown-baseline-x",
		ModelRatio:   2,
		GroupRatio:   3,
		InputDetails: TokenDetails{TextTokens: 1000},
		Override:     nil,
	})

	// 上游路径:quota = 1000(输入文本) * (groupRatio*modelRatio = 3*2 = 6) = 6000
	require.Equal(t, 6000, got)
}
