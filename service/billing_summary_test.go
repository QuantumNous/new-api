package service

import "testing"

func TestBillingDayStartUsesBeijingBoundary(t *testing.T) {
	// 2026-07-12 14:00:00 Asia/Shanghai == 2026-07-12 06:00:00 UTC
	got := billingDayStart(1_783_836_000)
	// 2026-07-12 00:00:00 Asia/Shanghai == 2026-07-11 16:00:00 UTC
	const want int64 = 1_783_785_600
	if got != want {
		t.Fatalf("billingDayStart() = %d, want %d", got, want)
	}
}

func TestPlanBillingDailyHybridRange_HistoryOnly(t *testing.T) {
	nowUnix := int64(1_783_836_000) // 2026-07-12 14:00:00 Asia/Shanghai
	start := int64(1_783_612_800)   // 2026-07-10 00:00:00 Asia/Shanghai
	end := int64(1_783_785_599)     // 2026-07-11 23:59:59 Asia/Shanghai

	plan := planBillingDailyHybridRange(start, end, nowUnix)
	if !plan.useSummary || plan.useRaw {
		t.Fatalf("expected history-only summary plan, got %+v", plan)
	}
	if plan.summaryStart != start || plan.summaryEnd != end {
		t.Fatalf("unexpected summary range: %+v", plan)
	}
}

func TestPlanBillingDailyHybridRange_TodayOnly(t *testing.T) {
	nowUnix := int64(1_783_836_000) // 2026-07-12 14:00:00 Asia/Shanghai
	start := int64(1_783_785_600)   // 2026-07-12 00:00:00 Asia/Shanghai
	end := int64(1_783_871_999)     // 2026-07-12 23:59:59 Asia/Shanghai

	plan := planBillingDailyHybridRange(start, end, nowUnix)
	if plan.useSummary || !plan.useRaw {
		t.Fatalf("expected today-only raw plan, got %+v", plan)
	}
	if plan.rawStart != start || plan.rawEnd != end {
		t.Fatalf("unexpected raw range: %+v", plan)
	}
}

func TestPlanBillingDailyHybridRange_MixedHistoryAndToday(t *testing.T) {
	nowUnix := int64(1_783_836_000) // 2026-07-12 14:00:00 Asia/Shanghai
	start := int64(1_783_612_800)   // 2026-07-10 00:00:00 Asia/Shanghai

	plan := planBillingDailyHybridRange(start, 0, nowUnix)
	if !plan.useSummary || !plan.useRaw {
		t.Fatalf("expected hybrid plan, got %+v", plan)
	}
	if plan.summaryStart != start {
		t.Fatalf("unexpected summary start: %+v", plan)
	}
	if plan.summaryEnd != 1_783_785_599 {
		t.Fatalf("unexpected summary end: %+v", plan)
	}
	if plan.rawStart != 1_783_785_600 || plan.rawEnd != 0 {
		t.Fatalf("unexpected raw range: %+v", plan)
	}
}
