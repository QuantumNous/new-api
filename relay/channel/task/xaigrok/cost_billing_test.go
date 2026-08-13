package xaigrok

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
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

func TestSettledQuotaFromCost(t *testing.T) {
	// A 480P second at $0.05, group ratio 1, markup 1: the customer pays cost.
	got := settledQuotaFromCost(0.05, 1.0)
	want := int(0.05 * grokMarkup * common.QuotaPerUnit)
	if got != want {
		t.Fatalf("quota = %d, want %d", got, want)
	}
}

func TestSettledQuotaAppliesGroupRatio(t *testing.T) {
	full := settledQuotaFromCost(0.05, 1.0)
	discounted := settledQuotaFromCost(0.05, 0.9)
	if discounted >= full {
		t.Fatalf("group ratio must reduce the quota: %d vs %d", discounted, full)
	}
	want := int(0.05 * grokMarkup * common.QuotaPerUnit * 0.9)
	if discounted != want {
		t.Fatalf("quota = %d, want %d", discounted, want)
	}
}

func TestSettledQuotaRejectsUnusableInput(t *testing.T) {
	// Returning 0 tells the caller to keep the reservation.
	for _, tc := range []struct {
		name  string
		usd   float64
		ratio float64
	}{
		{"zero cost", 0, 1},
		{"negative cost", -0.05, 1},
		{"zero group ratio", 0.05, 0},
		{"negative group ratio", 0.05, -1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := settledQuotaFromCost(tc.usd, tc.ratio); got != 0 {
				t.Fatalf("quota = %d, want 0", got)
			}
		})
	}
}
