package core

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
)

// golden 数值与 js/test/core.test.js、python/tests/test_core.py 一一对拍。
// 修改任何公式时，必须同步更新另两份用例。

func TestClassify(t *testing.T) {
	got := Classify("你好")
	assert.Equal(t, Classification{Type: "other", Complexity: 0}, got, "Classify(你好)")

	c1 := Classify("帮我总结这篇文章的要点")
	assert.Equal(t, "summarize", c1.Type)
	assert.Equal(t, 0.05, c1.Complexity)

	c2 := Classify("def solve(x):\n  return x + 1\n```python")
	assert.Equal(t, "code", c2.Type)
	assert.Equal(t, 0.55, c2.Complexity)

	c3 := Classify("请帮我重构这个模块并做性能优化")
	assert.Equal(t, "agentic", c3.Type)
	assert.Equal(t, 0.55, c3.Complexity)
}

func TestFeaturesOf(t *testing.T) {
	text := "def solve(x):\n  return x + 1\n```python"
	f := FeaturesOf(Classify(text), text)
	want := []float64{1, 0.55, 38.0 / 4000, 1, 0, 0, 0, 0, 0}
	assert.Equal(t, want, f)
}

func TestTierOf(t *testing.T) {
	cases := []struct {
		model, want string
	}{
		{"deepseek-v4-flash", "fast"},
		{"gpt-mini", "fast"},
		{"gpt-4o", "mid"},
		{"claude-pro", "strong"},
		{"", "unknown"},
	}
	for _, c := range cases {
		assert.Equal(t, c.want, TierOf(c.model), "TierOf(%q)", c.model)
	}
}

func TestRecommendRule(t *testing.T) {
	assert.Equal(t, "strong", RecommendRule(Classification{Complexity: 0.8}).Tier)
	assert.Equal(t, "fast", RecommendRule(Classification{Complexity: 0.2}).Tier)
	assert.Equal(t, "mid", RecommendRule(Classification{Complexity: 0.5}).Tier)
}

func TestResolveTier(t *testing.T) {
	mt := ModelTiers{
		Providers: []ProviderEntry{{Provider: "a"}, {Provider: "b"}},
		Tiers: map[string][]string{
			"fast": {"a/flash"}, "mid": {"b/mid"}, "strong": {"a/pro"},
		},
	}
	r := ResolveTier("fast", "a", mt, true)
	assert.Equal(t, "flash", r.Target)
	assert.Equal(t, "a", r.Provider)
	assert.Equal(t, "fast", r.Used)
	assert.Equal(t, "", r.Note)

	r = ResolveTier("mid", "a", mt, true)
	assert.Equal(t, "mid", r.Target)
	assert.Equal(t, "b", r.Provider)
	assert.Equal(t, "cross-provider", r.Note)

	r = ResolveTier("mid", "a", mt, false)
	assert.Equal(t, "pro", r.Target)
	assert.Equal(t, "strong", r.Used)
	assert.Equal(t, "mid->strong fallback", r.Note)

	assert.Equal(t, "tiers-not-ready", ResolveTier("mid", "a", ModelTiers{}, true).Note)
}

func TestRewardOf(t *testing.T) {
	r, _ := RewardOf(Outcome{Success: true, DtMs: 5000}, true)
	assert.Equal(t, 1.0, r, "clean close")

	r, _ = RewardOf(Outcome{Success: false}, false)
	assert.Equal(t, 0.0, r, "failed")

	// 工具失败2(0.4) + 重试1(0.2) + 成本0.02(0.4) + 延迟45s(0.1) → 负 → 钳 0
	r, _ = RewardOf(Outcome{Success: true, ToolErrors: 2, Retries: 1, CostYuan: 0.02, DtMs: 45000}, true)
	assert.Equal(t, 0.0, r, "penalties clamp to zero")

	// 1 - 0.2(一次工具失败) - 0.04(成本) = 0.76
	r, _ = RewardOf(Outcome{Success: true, ToolErrors: 1, CostYuan: 0.002, DtMs: 5000}, true)
	assert.Equal(t, 0.76, r)
}

func TestApplyReward(t *testing.T) {
	s := FreshState()
	rec := &RewardRec{
		ClsType: "code", UcbTier: "fast", LinTier: "fast",
		F:      []float64{1, 0.5, 0.1, 1, 0, 0, 0, 0, 0},
		Reward: 1, Chosen: "rule", PChosen: 1,
		Pool: []string{"ucb", "linucb", "knn", "rule"},
	}
	ApplyReward(s, rec)
	assert.Equal(t, 1, s.UCB.Total)
	arm := s.UCB.Arms["code:fast"]
	if assert.NotNil(t, arm) {
		assert.Equal(t, 1, arm.N)
		assert.Equal(t, 1.0, arm.Mean)
	}
	wantW := []float64{1, 0.5, 0.1, 1, 0, 0, 0, 0, 0}
	assert.Equal(t, wantW, s.Lin.TierW["fast"])
	assert.Equal(t, 1, s.Lin.TierN["fast"])
	assert.Equal(t, 1, s.Lin.Total)
	if assert.Len(t, s.KNN.Pool, 1) {
		assert.Equal(t, "fast", s.KNN.Pool[0].Tier)
		assert.Equal(t, 1.0, s.KNN.Pool[0].R)
	}
	w1 := 2.5 * math.Exp(0.075)
	assert.InDelta(t, w1, s.Exp3.Weights["rule"], 1e-12)

	// 第二次：lr=0.5, dot=2.26, err=-1.26
	ApplyReward(s, &RewardRec{
		ClsType: "code", UcbTier: "fast", LinTier: "fast",
		F: rec.F, Reward: 1, Chosen: "rule", PChosen: 0.5,
		Pool: rec.Pool,
	})
	assert.Equal(t, 2, s.UCB.Arms["code:fast"].N)
	assert.Equal(t, 1.0, s.UCB.Arms["code:fast"].Mean)
	wants := []float64{0.37, 0.185, 0.037}
	for i, wv := range wants {
		assert.InDelta(t, wv, s.Lin.TierW["fast"][i], 1e-12, "lin2 w[%d]", i)
	}
	w2 := w1 * math.Exp(0.15)
	assert.InDelta(t, w2, s.Exp3.Weights["rule"], 1e-12)
}

func TestCorrectReward(t *testing.T) {
	s := FreshState()
	rec := &RewardRec{
		ClsType: "code", UcbTier: "fast", LinTier: "fast",
		F:      []float64{1, 0, 0, 1, 0, 0, 0, 0, 0},
		Reward: 1, Chosen: "rule", PChosen: 1,
		Pool: []string{"ucb", "linucb", "knn", "rule"},
	}
	ApplyReward(s, rec)
	CorrectReward(s, rec, 0) // 👎：1 → 0
	arm := s.UCB.Arms["code:fast"]
	if assert.NotNil(t, arm) {
		assert.Equal(t, 0.0, arm.Mean)
		assert.Equal(t, 1, arm.N)
	}
	assert.Equal(t, []float64{0, 0, 0, 0, 0, 0, 0, 0, 0}, s.Lin.TierW["fast"])
	if assert.Len(t, s.KNN.Pool, 2) {
		assert.Equal(t, 0.0, s.KNN.Pool[1].R)
	}
}

func TestRouterDecideSettle(t *testing.T) {
	mt := ModelTiers{
		Providers: []ProviderEntry{{Provider: "p1"}},
		Tiers: map[string][]string{
			"fast": {"p1/lite"}, "mid": {"p1/base"}, "strong": {"p1/pro"},
		},
	}
	// 固定 rng 保证确定性
	seq := []float64{0.99}
	r := NewRouter(nil, mt, true, func() float64 {
		v := seq[0]
		seq[0] = 0.0
		return v
	})
	r.Exploration = 0 // 测试关掉 ε 探索保证确定性
	r.SetMode("active")

	d := r.Decide("帮我总结这篇文章的要点", "p1", nil)
	assert.Equal(t, 1, d.ID)
	assert.Equal(t, "summarize", d.Type)
	assert.False(t, d.Settled)
	assert.Contains(t, []string{"lite", "base", "pro"}, d.Model)

	res := r.Settle(1, Outcome{Success: true, DtMs: 5000})
	if assert.NotNil(t, res) {
		assert.Equal(t, 1.0, res.Reward)
	}
	assert.Equal(t, 1, r.State.UCB.Total)
	assert.Nil(t, r.Settle(1, Outcome{Success: true}), "double settle must be a no-op")
}
