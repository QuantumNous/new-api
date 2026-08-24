package setting

import "testing"

func TestGetSubscriptionModelWeight(t *testing.T) {
	if err := UpdateSubscriptionModelWeightsByJSONString(`{
		"claude-sonnet": 1.5,
		"claude-opus": 2.5,
		"claude": 1.25,
		"gemini-3.1-pro": 1.2
	}`); err != nil {
		t.Fatalf("update weights: %v", err)
	}
	defer func() { _ = UpdateSubscriptionModelWeightsByJSONString(`{}`) }()

	cases := []struct {
		model    string
		expected float64
	}{
		{"claude-sonnet-4-6", 1.5}, // 最长前缀优先于 "claude"
		{"claude-opus-4-8", 2.5},
		{"claude-haiku-4-5-20251001", 1.25}, // 回退到 "claude"
		{"gemini-3.1-pro-preview", 1.2},
		{"gemini-3-flash-preview", 1.0}, // 未命中 → 缺省
		{"deepseek-v3", 1.0},
		{"", 1.0},
	}
	for _, c := range cases {
		if got := GetSubscriptionModelWeight(c.model); got != c.expected {
			t.Errorf("GetSubscriptionModelWeight(%q) = %v, want %v", c.model, got, c.expected)
		}
	}
}

func TestCheckSubscriptionModelWeights(t *testing.T) {
	if err := CheckSubscriptionModelWeights(`{"claude-sonnet": 1.5}`); err != nil {
		t.Errorf("valid weights rejected: %v", err)
	}
	for name, payload := range map[string]string{
		"zero weight":     `{"claude": 0}`,
		"negative weight": `{"claude": -1}`,
		"too large":       `{"claude": 101}`,
		"empty prefix":    `{" ": 2}`,
		"bad json":        `{`,
	} {
		if err := CheckSubscriptionModelWeights(payload); err == nil {
			t.Errorf("%s should be rejected", name)
		}
	}
}
