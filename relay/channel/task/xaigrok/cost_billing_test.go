package xaigrok

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
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

func newGrokTask(t *testing.T, body string, groupRatio float64) *model.Task {
	t.Helper()
	task := &model.Task{Data: []byte(body)}
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		GroupRatio: groupRatio,
	}
	return task
}

func TestCompletedQuotaFromRealResponse(t *testing.T) {
	task := newGrokTask(t,
		`{"model":"grok-imagine-video","usage":{"cost_in_usd_ticks":500000000},"video":{"url":"x","duration":1},"status":"done"}`,
		1.0)
	got := completedQuota(task)
	want := int(0.05 * grokMarkup * common.QuotaPerUnit)
	if got != want {
		t.Fatalf("quota = %d, want %d", got, want)
	}
}

// The case that touches user balances: a render cheaper than the reservation
// must settle below it so the difference is refunded.
func TestCompletedQuotaBelowReservationRefunds(t *testing.T) {
	// Reserved at the 1080P worst case, rendered at 480P.
	task := newGrokTask(t,
		`{"usage":{"cost_in_usd_ticks":500000000}}`, 1.0)
	reserved := int(0.25 * common.QuotaPerUnit)
	settled := completedQuota(task)
	if settled <= 0 {
		t.Fatalf("settlement must produce a quota, got %d", settled)
	}
	if settled >= reserved {
		t.Fatalf("a 480P render must settle below a 1080P reservation: %d vs %d",
			settled, reserved)
	}
}

func TestCompletedQuotaKeepsReservationWhenUnusable(t *testing.T) {
	for _, tc := range []struct {
		name string
		task *model.Task
	}{
		{"nil task", nil},
		{"no billing snapshot", &model.Task{Data: []byte(`{"usage":{"cost_in_usd_ticks":500000000}}`)}},
		{"usage absent", newGrokTask(t, `{"status":"done"}`, 1.0)},
		{"cost absent", newGrokTask(t, `{"usage":{"completion_tokens":5}}`, 1.0)},
		{"cost zero", newGrokTask(t, `{"usage":{"cost_in_usd_ticks":0}}`, 1.0)},
		{"malformed body", newGrokTask(t, `{not json`, 1.0)},
		{"empty body", newGrokTask(t, ``, 1.0)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// 0 tells the caller to keep the reservation.
			if got := completedQuota(tc.task); got != 0 {
				t.Fatalf("quota = %d, want 0", got)
			}
		})
	}
}

// The interface is unexported in package service, so assert the method set.
var _ interface {
	AdjustPerCallBillingOnComplete(*model.Task, *relaycommon.TaskInfo) int
} = (*TaskAdaptor)(nil)

// xAI's published worst-case rates. The reservation must not fall below these,
// or a customer could start a 1080P render they cannot pay for.
func TestWorstCaseRatePerSecond(t *testing.T) {
	tests := map[string]float64{
		"grok-imagine-video":     0.07, // 720P, the highest tier this model has
		"grok-imagine-video-1.5": 0.25, // 1080P
	}
	for name, want := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := worstCaseRatePerSecond(name)
			if !ok {
				t.Fatalf("no worst-case rate for %s", name)
			}
			if got != want {
				t.Fatalf("rate = %v, want %v", got, want)
			}
		})
	}
}

func TestWorstCaseRateUnknownModel(t *testing.T) {
	// An unknown model must not silently reserve at zero.
	if _, ok := worstCaseRatePerSecond("some-future-model"); ok {
		t.Fatal("an unknown model must not resolve a rate")
	}
}
