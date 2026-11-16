package core

import (
	"math"
	"testing"
)

// golden 数值与 js/test/core.test.js、python/tests/test_core.py 一一对拍。
// 修改任何公式时，必须同步更新另两份用例。

func TestClassify(t *testing.T) {
	if got := Classify("你好"); got.Type != "other" || got.Complexity != 0 {
		t.Errorf("Classify(你好) = %+v", got)
	}
	c1 := Classify("帮我总结这篇文章的要点")
	if c1.Type != "summarize" || c1.Complexity != 0.05 {
		t.Errorf("c1 = %+v", c1)
	}
	c2 := Classify("def solve(x):\n  return x + 1\n```python")
	if c2.Type != "code" || c2.Complexity != 0.55 {
		t.Errorf("c2 = %+v", c2)
	}
	c3 := Classify("请帮我重构这个模块并做性能优化")
	if c3.Type != "agentic" || c3.Complexity != 0.55 {
		t.Errorf("c3 = %+v", c3)
	}
}

func TestFeaturesOf(t *testing.T) {
	text := "def solve(x):\n  return x + 1\n```python"
	f := FeaturesOf(Classify(text), text)
	want := []float64{1, 0.55, 38.0 / 4000, 1, 0, 0, 0, 0, 0}
	for i := range want {
		if f[i] != want[i] {
			t.Errorf("f[%d] = %v, want %v", i, f[i], want[i])
		}
	}
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
		if got := TierOf(c.model); got != c.want {
			t.Errorf("TierOf(%q) = %q, want %q", c.model, got, c.want)
		}
	}
}

func TestRecommendRule(t *testing.T) {
	if got := RecommendRule(Classification{Complexity: 0.8}).Tier; got != "strong" {
		t.Errorf("0.8 → %s", got)
	}
	if got := RecommendRule(Classification{Complexity: 0.2}).Tier; got != "fast" {
		t.Errorf("0.2 → %s", got)
	}
	if got := RecommendRule(Classification{Complexity: 0.5}).Tier; got != "mid" {
		t.Errorf("0.5 → %s", got)
	}
}

func TestResolveTier(t *testing.T) {
	mt := ModelTiers{
		Providers: []ProviderEntry{{Provider: "a"}, {Provider: "b"}},
		Tiers: map[string][]string{
			"fast": {"a/flash"}, "mid": {"b/mid"}, "strong": {"a/pro"},
		},
	}
	if r := ResolveTier("fast", "a", mt, true); r.Target != "flash" || r.Provider != "a" || r.Used != "fast" || r.Note != "" {
		t.Errorf("same-provider: %+v", r)
	}
	if r := ResolveTier("mid", "a", mt, true); r.Target != "mid" || r.Provider != "b" || r.Note != "cross-provider" {
		t.Errorf("cross-provider: %+v", r)
	}
	if r := ResolveTier("mid", "a", mt, false); r.Target != "pro" || r.Used != "strong" || r.Note != "mid->strong fallback" {
		t.Errorf("mid fallback: %+v", r)
	}
	if r := ResolveTier("mid", "a", ModelTiers{}, true); r.Note != "tiers-not-ready" {
		t.Errorf("not ready: %+v", r)
	}
}

func TestRewardOf(t *testing.T) {
	if r, _ := RewardOf(Outcome{Success: true, DtMs: 5000}, true); r != 1 {
		t.Errorf("clean = %v", r)
	}
	if r, _ := RewardOf(Outcome{Success: false}, false); r != 0 {
		t.Errorf("failed = %v", r)
	}
	// 工具失败2(0.4) + 重试1(0.2) + 成本0.02(0.4) + 延迟45s(0.1) → 负 → 钳 0
	if r, _ := RewardOf(Outcome{Success: true, ToolErrors: 2, Retries: 1, CostYuan: 0.02, DtMs: 45000}, true); r != 0 {
		t.Errorf("penalties = %v", r)
	}
	// 1 - 0.2(一次工具失败) - 0.04(成本) = 0.76
	if r, _ := RewardOf(Outcome{Success: true, ToolErrors: 1, CostYuan: 0.002, DtMs: 5000}, true); r != 0.76 {
		t.Errorf("0.76 case = %v", r)
	}
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
	if s.UCB.Total != 1 {
		t.Errorf("ucb total = %d", s.UCB.Total)
	}
	arm := s.UCB.Arms["code:fast"]
	if arm.N != 1 || arm.Mean != 1 {
		t.Errorf("arm = %+v", arm)
	}
	wantW := []float64{1, 0.5, 0.1, 1, 0, 0, 0, 0, 0}
	for i, w := range s.Lin.TierW["fast"] {
		if w != wantW[i] {
			t.Errorf("lin w[%d] = %v, want %v", i, w, wantW[i])
		}
	}
	if s.Lin.TierN["fast"] != 1 || s.Lin.Total != 1 {
		t.Errorf("lin counters")
	}
	if len(s.KNN.Pool) != 1 || s.KNN.Pool[0].Tier != "fast" || s.KNN.Pool[0].R != 1 {
		t.Errorf("knn pool = %+v", s.KNN.Pool)
	}
	w1 := 2.5 * math.Exp(0.075)
	if math.Abs(s.Exp3.Weights["rule"]-w1) > 1e-12 {
		t.Errorf("exp3 w1 = %v, want %v", s.Exp3.Weights["rule"], w1)
	}

	// 第二次：lr=0.5, dot=2.26, err=-1.26
	ApplyReward(s, &RewardRec{
		ClsType: "code", UcbTier: "fast", LinTier: "fast",
		F: rec.F, Reward: 1, Chosen: "rule", PChosen: 0.5,
		Pool: rec.Pool,
	})
	if arm.N != 2 || arm.Mean != 1 {
		t.Errorf("arm after 2nd = %+v", arm)
	}
	wants := []float64{0.37, 0.185, 0.037}
	for i, wv := range wants {
		if math.Abs(s.Lin.TierW["fast"][i]-wv) > 1e-12 {
			t.Errorf("lin2 w[%d] = %v, want %v", i, s.Lin.TierW["fast"][i], wv)
		}
	}
	w2 := w1 * math.Exp(0.15)
	if math.Abs(s.Exp3.Weights["rule"]-w2) > 1e-12 {
		t.Errorf("exp3 w2 = %v, want %v", s.Exp3.Weights["rule"], w2)
	}
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
	if arm := s.UCB.Arms["code:fast"]; arm.Mean != 0 || arm.N != 1 {
		t.Errorf("arm = %+v", arm)
	}
	for i, w := range s.Lin.TierW["fast"] {
		if w != 0 {
			t.Errorf("lin w[%d] = %v, want 0", i, w)
		}
	}
	if len(s.KNN.Pool) != 2 || s.KNN.Pool[1].R != 0 {
		t.Errorf("knn = %+v", s.KNN.Pool)
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
	if d.ID != 1 || d.Type != "summarize" || d.Settled {
		t.Errorf("d = %+v", d)
	}
	switch d.Model {
	case "lite", "base", "pro":
	default:
		t.Errorf("model = %q", d.Model)
	}

	res := r.Settle(1, Outcome{Success: true, DtMs: 5000})
	if res == nil || res.Reward != 1 {
		t.Errorf("res = %+v", res)
	}
	if r.State.UCB.Total != 1 {
		t.Errorf("ucb total = %d", r.State.UCB.Total)
	}
	if again := r.Settle(1, Outcome{Success: true}); again != nil {
		t.Errorf("double settle should be nil, got %+v", again)
	}
}
