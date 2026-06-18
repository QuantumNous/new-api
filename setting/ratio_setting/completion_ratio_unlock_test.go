package ratio_setting

import "testing"

// 这些测试刻画「补全倍率解锁」定制特性的对外行为(custom feature #1):
// 管理员在 completionRatioMap 里配置的补全倍率,永远优先于 getHardcodedCompletionModelRatio
// 返回的硬编码「锁定」倍率,且允许任意值(含 < 1)。GetCompletionRatioInfo 永不上报 Locked=true。
//
// 它们既守护该特性不被上游升级冲掉,也作为「把解锁逻辑从巨型 switch 迁移到消费函数」这一
// 行为保持重构的安全网:重构前后都必须 GREEN。
//
// 锚点模型用 "claude-3-opus":在原始上游 getHardcodedCompletionModelRatio 中
// strings.Contains(name,"claude-3") 命中并返回 (5, true)(锁定)。

const unlockAnchorModel = "claude-3-opus"

// withSeededCompletionRatio 用给定 JSON 覆盖 completionRatioMap,并在测试结束后还原,
// 保证全局状态隔离。
func withSeededCompletionRatio(t *testing.T, jsonStr string) {
	t.Helper()
	saved := CompletionRatio2JSONString()
	t.Cleanup(func() {
		if err := UpdateCompletionRatioByJSONString(saved); err != nil {
			t.Fatalf("还原 completionRatioMap 失败: %v", err)
		}
	})
	if err := UpdateCompletionRatioByJSONString(jsonStr); err != nil {
		t.Fatalf("注入 completionRatioMap 失败: %v", err)
	}
}

// 核心解锁:管理员配置覆盖硬编码的「锁定」倍率。
// 原始上游会因 (5, true) 直接返回 5 而失败,以此证明本测试有牙齿。
func TestGetCompletionRatio_AdminOverrideBeatsHardcodedLock(t *testing.T) {
	withSeededCompletionRatio(t, `{"claude-3-opus":7.5}`)

	got := GetCompletionRatio(unlockAnchorModel)

	if got != 7.5 {
		t.Fatalf("管理员覆盖应优先于硬编码锁定倍率: 期望 7.5, 实得 %v", got)
	}
}

// 解锁允许补全倍率取任意值,包括 < 1(feature #1 的标题能力)。
func TestGetCompletionRatio_AllowsBelowOne(t *testing.T) {
	withSeededCompletionRatio(t, `{"claude-3-opus":0.5}`)

	got := GetCompletionRatio(unlockAnchorModel)

	if got != 0.5 {
		t.Fatalf("解锁应允许补全倍率 < 1: 期望 0.5, 实得 %v", got)
	}
}

// 无管理员配置时,回退到硬编码倍率(claude-3 → 5),回退路径完好。
func TestGetCompletionRatio_FallbackToHardcodedWhenNoOverride(t *testing.T) {
	withSeededCompletionRatio(t, `{}`)

	got := GetCompletionRatio(unlockAnchorModel)

	if got != 5 {
		t.Fatalf("无覆盖时应回退到硬编码 5: 实得 %v", got)
	}
}

// GetCompletionRatioInfo 永不把模型上报为 Locked(前端据此始终允许编辑补全倍率)。
// 原始上游对 claude-3 会返回 Locked=true 而失败。
func TestGetCompletionRatioInfo_NeverLocked(t *testing.T) {
	withSeededCompletionRatio(t, `{}`)

	info := GetCompletionRatioInfo(unlockAnchorModel)

	if info.Locked {
		t.Fatalf("解锁后模型不应被标记为 Locked: %+v", info)
	}
	if info.Ratio != 5 {
		t.Fatalf("无覆盖时 Ratio 应回退到硬编码 5: 实得 %v", info.Ratio)
	}
}
