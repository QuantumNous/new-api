package xaigrok

import (
	"math"
	"testing"
)

// The observed pairs come from real production task rows: grok-imagine-video at
// 500000000 ticks and grok-imagine-video-1.5 at 800000000, which are exactly
// xAI's published 480P rates of $0.05 and $0.08.
func TestUpstreamCostUSD(t *testing.T) {
	tests := []struct {
		name  string
		ticks int64
		want  float64
		ok    bool
	}{
		{"grok-imagine-video 1s at 480P", 500000000, 0.05, true},
		{"grok-imagine-video-1.5 1s at 480P", 800000000, 0.08, true},
		{"six seconds at 480P", 3000000000, 0.30, true},
		{"zero is not a usable cost", 0, 0, false},
		{"negative is not a usable cost", -1, 0, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := upstreamCostUSD(tc.ticks)
			if ok != tc.ok {
				t.Fatalf("ok = %v, want %v", ok, tc.ok)
			}
			if ok && math.Abs(got-tc.want) > 1e-9 {
				t.Fatalf("usd = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestParseUpstreamCost(t *testing.T) {
	tests := []struct {
		name string
		body string
		want float64
		ok   bool
	}{
		{
			name: "real production response",
			body: `{"model":"grok-imagine-video","usage":{"cost_in_usd_ticks":500000000},"video":{"url":"x","duration":1},"status":"done"}`,
			want: 0.05,
			ok:   true,
		},
		{"usage absent", `{"model":"grok-imagine-video","status":"done"}`, 0, false},
		{"cost field absent", `{"usage":{"completion_tokens":5}}`, 0, false},
		{"cost is zero", `{"usage":{"cost_in_usd_ticks":0}}`, 0, false},
		{"cost is negative", `{"usage":{"cost_in_usd_ticks":-5}}`, 0, false},
		{"malformed json", `{not json`, 0, false},
		{"empty body", ``, 0, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := parseUpstreamCost([]byte(tc.body))
			if ok != tc.ok {
				t.Fatalf("ok = %v, want %v", ok, tc.ok)
			}
			if ok && math.Abs(got-tc.want) > 1e-9 {
				t.Fatalf("usd = %v, want %v", got, tc.want)
			}
		})
	}
}
