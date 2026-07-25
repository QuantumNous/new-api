package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func TestCodexLimitReportFetchConcurrencyIsTen(t *testing.T) {
	if codexLimitReportFetchConcurrency != 10 {
		t.Fatalf("codexLimitReportFetchConcurrency = %d, want 10", codexLimitReportFetchConcurrency)
	}
}

func TestBuildCodexLimitReportLimitsConcurrentFetches(t *testing.T) {
	channels := make([]*model.Channel, codexLimitReportFetchConcurrency+3)
	for i := range channels {
		channels[i] = &model.Channel{Id: i + 1, Name: "Codex", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled}
	}
	release := make(chan struct{})
	started := make(chan struct{}, len(channels))
	fetcher := CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		started <- struct{}{}
		select {
		case <-release:
			return 200, []byte(`{"rate_limit":{"allowed":true}}`), nil
		case <-ctx.Done():
			return 0, nil, ctx.Err()
		}
	})

	done := make(chan struct{})
	go func() {
		BuildCodexLimitReport(context.Background(), channels, fetcher)
		close(done)
	}()
	defer func() {
		close(release)
		<-done
	}()

	for i := 0; i < codexLimitReportFetchConcurrency; i++ {
		select {
		case <-started:
		case <-time.After(time.Second):
			t.Fatalf("timed out waiting for fetch %d", i+1)
		}
	}

	select {
	case <-started:
		t.Fatalf("more than %d fetches started concurrently", codexLimitReportFetchConcurrency)
	case <-time.After(25 * time.Millisecond):
	}
}

func TestBuildCodexLimitReportSummarizesSuccessfulUsage(t *testing.T) {
	channels := []*model.Channel{
		{Id: 11, Name: "Codex Pro", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
	}
	fetcher := CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		return 200, []byte(`{
			"plan_type": "pro",
			"email": "owner@example.com",
			"account_id": "acct_123",
			"rate_limit": {
				"allowed": true,
				"limit_reached": false,
				"primary_window": {
					"used_percent": 23.5,
					"reset_at": 1893456000,
					"reset_after_seconds": 7200,
					"limit_window_seconds": 18000
				},
				"secondary_window": {
					"used_percent": 51,
					"reset_at": 1893888000,
					"reset_after_seconds": 172800,
					"limit_window_seconds": 604800
				}
			},
			"additional_rate_limits": [
				{
					"limit_name": "gpt-5.3-codex",
					"metered_feature": "responses",
					"rate_limit": {
						"primary_window": {
							"used_percent": 77,
							"limit_window_seconds": 18000
						}
					}
				},
				{
					"rate_limit": {
						"primary_window": {
							"used_percent": 12,
							"limit_window_seconds": 18000
						}
					}
				}
			]
		}`), nil
	})

	report := BuildCodexLimitReport(context.Background(), channels, fetcher)

	if report.TotalChannels != 1 || report.SuccessCount != 1 || report.FailureCount != 0 {
		t.Fatalf("unexpected counts: %#v", report)
	}
	row := report.Rows[0]
	if !row.Success {
		t.Fatalf("expected success row, got message %q", row.Message)
	}
	if row.PlanType != "pro" || row.Email != "owner@example.com" || row.AccountID != "acct_123" {
		t.Fatalf("unexpected identity fields: %#v", row)
	}
	if row.BaseFiveHourWindow == nil || row.BaseFiveHourWindow.UsedPercent != 23.5 {
		t.Fatalf("unexpected five-hour window: %#v", row.BaseFiveHourWindow)
	}
	if row.BaseWeeklyWindow == nil || row.BaseWeeklyWindow.UsedPercent != 51 {
		t.Fatalf("unexpected weekly window: %#v", row.BaseWeeklyWindow)
	}
	if len(row.AdditionalLimits) != 2 {
		t.Fatalf("additional limits len = %d", len(row.AdditionalLimits))
	}
	if row.AdditionalLimits[0].Name != "gpt-5.3-codex" {
		t.Fatalf("unexpected additional limit: %#v", row.AdditionalLimits[0])
	}
	if row.AdditionalLimits[0].FiveHourWindow == nil || row.AdditionalLimits[0].FiveHourWindow.UsedPercent != 77 {
		t.Fatalf("unexpected additional five-hour window: %#v", row.AdditionalLimits[0])
	}
	if row.AdditionalLimits[1].Name != "Additional Restriction" {
		t.Fatalf("unexpected fallback additional limit name: %#v", row.AdditionalLimits[1])
	}
}

func TestBuildCodexLimitReportIgnoresUnclassifiedWindows(t *testing.T) {
	channels := []*model.Channel{
		{Id: 11, Name: "Codex Pro", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
	}
	fetcher := CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		return 200, []byte(`{
			"rate_limit": {"primary_window": {}},
			"additional_rate_limits": [
				{"rate_limit": {"primary_window": {"used_percent": 0}}},
				{"rate_limit": {"primary_window": {"used_percent": 10, "limit_window_seconds": 3600}}},
				{"rate_limit": {"primary_window": {"used_percent": 20, "limit_window_seconds": 43200}}}
			]
		}`), nil
	})

	row := BuildCodexLimitReport(context.Background(), channels, fetcher).Rows[0]
	if row.BaseFiveHourWindow != nil || row.BaseWeeklyWindow != nil {
		t.Fatalf("unclassified base window should be hidden: %#v", row)
	}
	for _, limit := range row.AdditionalLimits {
		if limit.FiveHourWindow != nil || limit.WeeklyWindow != nil {
			t.Fatalf("unclassified additional window should be hidden: %#v", limit)
		}
	}
}

func TestBuildCodexLimitReportMergesRangeUsageStats(t *testing.T) {
	channels := []*model.Channel{
		{Id: 11, Name: "Codex Pro", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
		{Id: 12, Name: "Codex Team", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
	}
	fetcher := CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		return 200, []byte(`{"rate_limit":{"allowed":true}}`), nil
	})
	usageStats := map[int]model.CodexChannelUsageStat{
		11: {ChannelID: 11, TokenUsed: 1000, Quota: 2500},
		12: {ChannelID: 12, TokenUsed: 3000, Quota: 7500},
	}

	report := BuildCodexLimitReportWithUsage(
		context.Background(),
		channels,
		fetcher,
		usageStats,
		1700000000,
		1700600000,
	)

	if report.StartTimestamp != 1700000000 || report.EndTimestamp != 1700600000 {
		t.Fatalf("unexpected range: %#v", report)
	}
	if report.TotalTokenUsed != 4000 || report.TotalQuota != 10000 {
		t.Fatalf("unexpected totals: %#v", report)
	}
	if report.Rows[0].RangeTokenUsed != 1000 || report.Rows[0].RangeQuota != 2500 {
		t.Fatalf("unexpected row 0 usage: %#v", report.Rows[0])
	}
	if report.Rows[1].RangeTokenUsed != 3000 || report.Rows[1].RangeQuota != 7500 {
		t.Fatalf("unexpected row 1 usage: %#v", report.Rows[1])
	}
}

func TestBuildCodexLimitReportClassifiesFreePlanFromRateLimitPlanType(t *testing.T) {
	channels := []*model.Channel{
		{Id: 12, Name: "Codex Free", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
	}
	fetcher := CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		return 200, []byte(`{
			"rate_limit": {
				"plan_type": "free",
				"allowed": true,
				"primary_window": {
					"used_percent": 64,
					"limit_window_seconds": 18000
				},
				"secondary_window": {
					"used_percent": 92,
					"limit_window_seconds": 18000
				}
			}
		}`), nil
	})

	report := BuildCodexLimitReport(context.Background(), channels, fetcher)

	row := report.Rows[0]
	if row.PlanType != "free" {
		t.Fatalf("expected rate_limit.plan_type fallback, got %#v", row.PlanType)
	}
	if row.BaseFiveHourWindow != nil {
		t.Fatalf("free plan should not expose five-hour window: %#v", row.BaseFiveHourWindow)
	}
	if row.BaseWeeklyWindow != nil {
		t.Fatalf("unclassified free-plan window should remain hidden: %#v", row.BaseWeeklyWindow)
	}
}

func TestBuildCodexLimitReportKeepsFailureRows(t *testing.T) {
	channels := []*model.Channel{
		{Id: 12, Name: "Expired Codex", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
	}
	fetcher := CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		return 0, nil, errors.New("upstream timeout")
	})

	report := BuildCodexLimitReport(context.Background(), channels, fetcher)

	if report.TotalChannels != 1 || report.SuccessCount != 0 || report.FailureCount != 1 {
		t.Fatalf("unexpected counts: %#v", report)
	}
	row := report.Rows[0]
	if row.Success {
		t.Fatalf("expected failure row: %#v", row)
	}
	if row.ChannelID != 12 || row.Message != "upstream timeout" {
		t.Fatalf("unexpected failure row: %#v", row)
	}
}

func TestBuildCodexLimitReportRejectsNonSuccessUpstreamStatus(t *testing.T) {
	channels := []*model.Channel{
		{Id: 13, Name: "Limited Codex", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
	}
	fetcher := CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		return 403, []byte(`{"error":"forbidden"}`), nil
	})

	report := BuildCodexLimitReport(context.Background(), channels, fetcher)

	if report.SuccessCount != 0 || report.FailureCount != 1 {
		t.Fatalf("unexpected counts: %#v", report)
	}
	row := report.Rows[0]
	if row.Success || row.UpstreamStatus != 403 || row.Message != "upstream status: 403" {
		t.Fatalf("unexpected non-success row: %#v", row)
	}
}
