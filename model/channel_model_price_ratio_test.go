package model

import "testing"

func strPtr(s string) *string { return &s }
func f64Ptr(f float64) *float64 { return &f }

func TestResolveModelPriceRatio(t *testing.T) {
	ratios := strPtr(`{"gpt-5.4":2.0,"gpt-5.5":0}`)
	channelRatio := f64Ptr(1.8)

	// 模型覆盖优先
	if got := ResolveModelPriceRatio(ratios, channelRatio, "gpt-5.4"); got != 2.0 {
		t.Fatalf("override: want 2.0, got %v", got)
	}
	// 覆盖值非正 → 回落渠道默认
	if got := ResolveModelPriceRatio(ratios, channelRatio, "gpt-5.5"); got != 1.8 {
		t.Fatalf("non-positive override falls back: want 1.8, got %v", got)
	}
	// 未配置模型 → 渠道默认
	if got := ResolveModelPriceRatio(ratios, channelRatio, "claude-opus-4-8"); got != 1.8 {
		t.Fatalf("unset model: want 1.8, got %v", got)
	}
	// 渠道默认也没有 → 1.0
	if got := ResolveModelPriceRatio(ratios, nil, "claude-opus-4-8"); got != 1.0 {
		t.Fatalf("no channel ratio: want 1.0, got %v", got)
	}
	// 全空 → 1.0
	if got := ResolveModelPriceRatio(nil, nil, "x"); got != 1.0 {
		t.Fatalf("all empty: want 1.0, got %v", got)
	}
	// 非法 JSON → 渠道默认
	if got := ResolveModelPriceRatio(strPtr("{bad"), channelRatio, "gpt-5.4"); got != 1.8 {
		t.Fatalf("bad json: want 1.8, got %v", got)
	}
}

func TestChannelGetModelPriceRatio(t *testing.T) {
	ch := Channel{ApimasterPriceRatio: f64Ptr(1.5), ModelPriceRatios: strPtr(`{"a":3}`)}
	if got := ch.GetModelPriceRatio("a"); got != 3 {
		t.Fatalf("want 3, got %v", got)
	}
	if got := ch.GetModelPriceRatio("b"); got != 1.5 {
		t.Fatalf("want 1.5, got %v", got)
	}
}
